import fs from "node:fs";
import AdmZip from "adm-zip";
import { mergeBhavcopyHistory, normalizeBhavcopyRows, parseCsv } from "./bhavcopy.js";

const BASE = "https://nsearchives.nseindia.com/content/cm/";
const headers = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "text/csv,application/zip,*/*",
};
const readJson = (path, fallback) => {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); } catch { return fallback; }
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
      const bytes = Buffer.from(await response.arrayBuffer());
      const zip = new AdmZip(bytes);
      const entry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith(".csv"));
      if (!entry) throw new Error("ZIP did not contain a CSV");
      const csv = entry.getData().toString("utf8");
      const rows = normalizeBhavcopyRows(parseCsv(csv), isoDate(date));
      if (!rows.length) throw new Error("CSV contained no valid EQ/BE closing prices");
      return { date: isoDate(date), rows, url };
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(failures.join("; "));
}

fs.mkdirSync("data", { recursive: true });
const existing = readJson("data/history.json", { series: {}, meta: {} });
const archive = readJson("data/bhavcopy.json", { days: {} });
const cfg = readJson("symbols.json", {});
const wanted = new Set((cfg.symbols || []).map(s => String(s).trim().toUpperCase()).filter(Boolean));
const today = new Date();
let result = null;
const failures = [];
// NSE archives are not published on weekends/holidays. Walk back up to seven days.
for (let offset = 0; offset <= 7 && !result; offset++) {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
  const day = isoDate(date);
  if (archive.days?.[day]?.length && offset > 0) { result = { date: day, rows: archive.days[day], cached: true }; break; }
  try { result = await fetchDay(date); }
  catch (error) { failures.push(`${day}: ${error.message}`); console.warn(failures.at(-1)); }
}
if (!result) {
  console.error("Unable to retrieve an NSE Bhavcopy for the last 8 calendar days.");
  process.exit(1);
}

const allRows = result.rows;
const relevant = wanted.size ? allRows.filter(r => wanted.has(r.symbol)) : allRows;
const nextArchive = { ...archive, updated: new Date().toISOString(), latestDate: result.date, days: { ...(archive.days || {}), [result.date]: allRows } };
// Keep a bounded archive in the MCP dataset; full daily series are maintained separately in history.json.
const dates = Object.keys(nextArchive.days).sort();
for (const date of dates.slice(0, -30)) delete nextArchive.days[date];
fs.writeFileSync("data/bhavcopy.json", JSON.stringify(nextArchive) + "\n");

const merged = mergeBhavcopyHistory(existing, relevant);
merged.meta = { ...(merged.meta || {}) };
for (const row of relevant) merged.meta[row.symbol] = { ...(merged.meta[row.symbol] || {}), name: merged.meta[row.symbol]?.name || row.symbol, cls: "Equities", source: "NSE Bhavcopy" };
fs.writeFileSync("data/history.json", JSON.stringify(merged) + "\n");
console.log(`Bhavcopy ${result.date}: ${allRows.length} EQ/BE rows; merged ${relevant.length} configured symbols into data/history.json`);
if (failures.length) console.log(`Archive fallback attempts: ${failures.length}`);
