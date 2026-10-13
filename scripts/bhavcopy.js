// Shared, dependency-light helpers for NSE CM Bhavcopy CSV files.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = String(text).replace(/^\uFEFF/, "").replace(/\r/g, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field.trim()); field = ""; }
    else if (ch === "\n") { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

const pick = (row, ...keys) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== "") return row[key];
  return undefined;
};

export function normalizeBhavcopyRows(rows, fallbackDate) {
  const out = [];
  for (const row of rows) {
    const symbol = String(pick(row, "TckrSymb", "SYMBOL", "Symbol") || "").trim().toUpperCase();
    const series = String(pick(row, "SctySrs", "SERIES", "Series") || "EQ").trim().toUpperCase();
    const rawDate = pick(row, "TradDt", "TIMESTAMP", "DATE1", "Date") || fallbackDate;
    const close = Number(pick(row, "ClsPric", "CLOSE", "Close"));
    const prevCloseRaw = pick(row, "PrvsClsgPric", "PREVCLOSE", "PREV_CLOSE", "Prev Close");
    const previousClose = prevCloseRaw === undefined ? null : Number(prevCloseRaw);
    if (!symbol || !["EQ", "BE"].includes(series) || !Number.isFinite(close) || close <= 0) continue;
    const date = normalizeDate(rawDate);
    if (!date) continue;
    const name = String(pick(row, "FinInstrmNm", "NAME OF COMPANY", "Company Name", "COMPANY NAME", "Company", "SC_NAME", "Security Name") || symbol).trim();
    out.push({ date, symbol, series, close, previousClose: Number.isFinite(previousClose) ? previousClose : null, name });
  }
  return out;
}

export function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const month = months.findIndex(x => x.toLowerCase() === m[2].toLowerCase()) + 1;
    return month ? `${m[3]}-${String(month).padStart(2,"0")}-${m[1]}` : null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function mergeBhavcopyHistory(history, rows, keep = 800) {
  const series = history?.series && typeof history.series === "object" ? history.series : {};
  for (const row of rows) {
    const current = series[row.symbol] || { d: [], c: [] };
    const values = new Map((current.d || []).map((d, i) => [d, current.c?.[i]]));
    values.set(row.date, row.close);
    const dates = [...values.keys()].filter(d => Number.isFinite(Number(values.get(d)))).sort().slice(-keep);
    series[row.symbol] = { d: dates, c: dates.map(d => values.get(d)) };
  }
  return { ...history, updated: new Date().toISOString(), series };
}
