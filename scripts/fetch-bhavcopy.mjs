import fs from "node:fs";
import AdmZip from "adm-zip";
import { mergeBhavcopyHistory, normalizeBhavcopyRows, parseCsv } from "./bhavcopy.js";

const BASE = "https://nsearchives.nseindia.com/content/cm/";
const headers = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "text/csv,application/zip,*/*",
};
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
};
const isoDate = d => d.toISOString().slice(0, 10);
const ymd = d => isoDate(d).replaceAll("-", "");
const legacyDate = d => {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(d.getUTCDate()).padStart(2, "0")}${months[d.getUTCMonth()]}${d.getUTCFullYear()}`;
};
const archiveUrls = d => [
  `${BASE}BhavCopy_NSE_CM_0_0_0_${ymd(d)}_F_0000.csv.zip`,
  `${BASE}cm${legacyDate(d)}bhav.csv.zip`,
];

async function fetchDay(date) {
  const failures = [];
  for (const url of archiveUrls(date)) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
      const entry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".csv"));
      if (!entry) throw new Error("ZIP did not contain a CSV");
      const rows = normalizeBhavcopyRows(parseCsv(entry.getData().toString("utf8")), isoDate(date));
      if (!rows.length) throw new Error("CSV contained no valid EQ/BE closing prices");
      return { date: isoDate(date), rows, url };
    } catch (error) { failures.push(`${url}: ${error.message}`); }
  }
  throw new Error(failures.join("; "));
}

fs.mkdirSync("data", { recursive: true });
const oldHistory = readJson("data/history.json", { series: {}, meta: {} });
const archive = readJson("data/bhavcopy.json", { days: {} });
const previousPrices = readJson("data/prices.json", { prices: {} });
const previousDirectory = readJson("data/directory.json", { symbols: {} });
const today = new Date();
let result = null;
const failures = [];
for (let offset = 0; offset <= 7 && !result; offset++) {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
  const day = isoDate(date);
  try { result = await fetchDay(date); }
  catch (error) {
    failures.push(`${day}: ${error.message}`);
    console.warn(failures.at(-1));
    if (offset > 0 && archive.days?.[day]?.length) result = { date: day, rows: archive.days[day], cached: true };
  }
}
if (!result) {
  console.error("No usable NSE Bhavcopy found in the last 8 calendar days; leaving existing data files unchanged.");
  process.exit(1);
}

const allRows = result.rows;
const stamp = new Date().toISOString();
const prices = {};
const directory = { ...(previousDirectory.symbols || {}) };
for (const row of allRows) {
  const key = row.symbol;
  prices[key] = {
    ltp: row.close,
    prevClose: row.previousClose,
    changePct: row.previousClose > 0 ? Number(((row.close / row.previousClose - 1) * 100).toFixed(4)) : null,
    name: row.name || directory[key]?.n || key,
    sector: directory[key]?.s || "",
    date: row.date,
    source: "NSE Bhavcopy (end of day)",
  };
  directory[key] = {
    n: row.name || directory[key]?.n || key,
    c: directory[key]?.c || "Equities",
    s: directory[key]?.s || "",
  };
}
const nextArchive = {
  ...archive, updated: stamp, latestDate: result.date,
  days: { ...(archive.days || {}), [result.date]: allRows },
};
const dates = Object.keys(nextArchive.days).sort();
for (const date of dates.slice(0, -30)) delete nextArchive.days[date];

const merged = mergeBhavcopyHistory(oldHistory, allRows);
merged.meta = { ...(merged.meta || {}) };
for (const row of allRows) {
  merged.meta[row.symbol] = {
    ...(merged.meta[row.symbol] || {}),
    name: row.name || row.symbol,
    cls: "Equities",
    source: "NSE Bhavcopy",
  };
}
fs.writeFileSync("data/bhavcopy.json", JSON.stringify(nextArchive) + "\n");
fs.writeFileSync("data/prices.json", JSON.stringify({ updated: stamp, source: "NSE Bhavcopy (end of day)", tradingDate: result.date, prices, errors: {} }) + "\n");
fs.writeFileSync("data/directory.json", JSON.stringify({ updated: stamp, source: "NSE Bhavcopy", symbols: directory }) + "\n");
fs.writeFileSync("data/history.json", JSON.stringify(merged) + "\n");
console.log(`NSE Bhavcopy ${result.date}: wrote ${allRows.length} prices and symbol names; merged daily closes into history.`);
if (failures.length) console.log(`Archive fallback attempts: ${failures.length}`);
