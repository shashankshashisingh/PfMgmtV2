// Writes data/prices.json (live quotes) and, once a day, data/directory.json (symbol names for lookup).
// Quotes come from the unofficial stock-nse-india package. Names come from NSE's public listing files.
import fs from 'node:fs';
import { NseIndia } from 'stock-nse-india';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const cfg = readJSON('symbols.json', {});
const symbols = [...new Set((cfg.symbols || []).map(s => String(s).trim().toUpperCase()).filter(Boolean))];
const indices = readJSON('scripts/indices.json', []);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', Accept: 'text/csv,*/*' };
async function csv(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  const rows = []; let row = [], cur = '', q = false;
  for (const ch of (await r.text()).replace(/\r/g, '')) {
    if (q) { if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
  const head = rows.shift().map(h => h.toUpperCase());
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

fs.mkdirSync('data', { recursive: true });
const previous = readJSON('data/prices.json', {}).prices || {};
const errors = {};
const prices = {};
const nse = new NseIndia();

// ---- 1. Bulk quotes: every NIFTY 500 stock in one request ----
try {
  const idx = await nse.getEquityStockIndices('NIFTY 500');
  for (const r of idx.data || []) {
    const ltp = num(r.lastPrice);
    if (!r.symbol || ltp === null || r.symbol === 'NIFTY 500') continue;
    prices[r.symbol] = { ltp, prevClose: num(r.previousClose), changePct: num(r.pChange), name: r.meta?.companyName || '', sector: r.meta?.industry || '' };
  }
  console.log(`Bulk: ${Object.keys(prices).length} NIFTY 500 stocks`);
} catch (e) {
  errors._bulk = String(e?.message || e);
  console.warn('Bulk quotes failed:', errors._bulk);
}

// ---- 2. Index levels, keyed the way the dashboard names them ----
try {
  const all = await nse.getAllIndices();
  for (const ix of indices) {
    const row = (all.data || []).find(r => String(r.indexName).toUpperCase() === ix.nse);
    if (row && num(row.last) !== null) prices[ix.key] = { ltp: num(row.last), prevClose: num(row.previousClose), changePct: num(row.percChange), name: ix.name, sector: '' };
  }
} catch (e) {
  errors._indices = String(e?.message || e);
  console.warn('Index quotes failed:', errors._indices);
}

// ---- 3. Single-stock quotes (NSE refuses the bulk call from GitHub, so this goes one symbol at a time) ----
// Your own symbols come first. Then every stock in the chosen index lists, so most new holdings already have a price.
const LISTS = { 'NIFTY 50': 'ind_nifty50list.csv', 'NIFTY NEXT 50': 'ind_niftynext50list.csv', 'NIFTY 500': 'ind_nifty500list.csv',
  'NIFTY MIDCAP 150': 'ind_niftymidcap150list.csv', 'NIFTY SMALLCAP 250': 'ind_niftysmallcap250list.csv' };
const universe = {};
for (const name of cfg.universe === false ? [] : (cfg.universe || ['NIFTY 500'])) {
  const file = LISTS[String(name).toUpperCase()];
  if (!file) continue;
  try {
    for (const r of await csv('https://nsearchives.nseindia.com/content/indices/' + file)) {
      const sym = (r.SYMBOL || '').toUpperCase();
      if (sym) universe[sym] = { name: r['COMPANY NAME'] || '', sector: r.INDUSTRY || '' };
    }
  } catch (e) { errors['_list ' + name] = String(e?.message || e); }
}
console.log(`Universe: ${Object.keys(universe).length} symbols`);

const t0 = Date.now();
const BUDGET = 8 * 60 * 1000;
const targets = [...new Set([...symbols, ...Object.keys(universe)])].filter(s => !prices[s]);
let ok = 0, failed = 0, skipped = 0;
let next = 0;
async function worker() {
  while (next < targets.length) {
    const sym = targets[next++];
    if (Date.now() - t0 > BUDGET) { skipped++; if (previous[sym]) prices[sym] = previous[sym]; continue; }
    try {
      const d = await nse.getEquityDetails(sym);
      const p = d.priceInfo || {};
      const ltp = num(p.lastPrice);
      if (ltp === null) throw new Error('no last price in response');
      prices[sym] = { ltp, prevClose: num(p.previousClose), changePct: num(p.pChange),
        name: d.info?.companyName || universe[sym]?.name || '', sector: d.industryInfo?.sector || d.industryInfo?.macro || universe[sym]?.sector || '' };
      ok++;
    } catch (e) {
      failed++;
      if (symbols.includes(sym)) errors[sym] = String(e?.message || e);
      if (previous[sym]) prices[sym] = previous[sym]; // keep the last known quote
    }
    await sleep(200);
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`Quotes: ${ok} fetched, ${failed} failed, ${skipped} skipped for time, ${Math.round((Date.now() - t0) / 1000)}s`);
// Fill in names and sectors for anything that came back without them
for (const [s, p] of Object.entries(prices)) { if (universe[s]) { p.name = p.name || universe[s].name; p.sector = p.sector || universe[s].sector; } }

const got = Object.keys(prices).length;
console.log(`Prices written for ${got} symbols; ${Object.keys(errors).length} errors`);
if (got === 0) {
  console.error('No prices at all. NSE may be blocking this network. Leaving data/prices.json unchanged.');
  process.exit(1);
}
fs.writeFileSync('data/prices.json', JSON.stringify({ updated: new Date().toISOString(), prices, errors }) + '\n');

// ---- 4. Symbol directory, refreshed at most once a day ----
const DIR = 'data/directory.json';
const dirOld = readJSON(DIR, {});
const fresh = dirOld.updated && Date.now() - Date.parse(dirOld.updated) < 20 * 3600 * 1000 && Object.keys(dirOld.symbols || {}).length > 100;
if (!fresh || process.env.FORCE_DIRECTORY) {
  const out = {};
  const derrors = {};
  try {
    for (const r of await csv('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv')) {
      if (r.SYMBOL) out[r.SYMBOL.toUpperCase()] = { n: r['NAME OF COMPANY'] || '', c: 'Equities' };
    }
  } catch (e) { derrors.equities = String(e?.message || e); }
  try {
    for (const r of await csv('https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv')) {
      const s = (r.SYMBOL || '').toUpperCase();
      if (s) out[s] = { n: r.SECURITYNAME || r['SECURITY NAME'] || r.UNDERLYING || s, c: 'ETFs' };
    }
  } catch (e) { derrors.etfs = String(e?.message || e); }
  // Fall back to names from the quote call, so lookup still works for NIFTY 500 stocks
  for (const [s, p] of Object.entries(prices)) if (!out[s] && p.name && !indices.some(i => i.key === s)) out[s] = { n: p.name, c: 'Equities', s: p.sector || '' };
  for (const [s, u] of Object.entries(universe)) if (out[s]) out[s].s = out[s].s || u.sector || '';
  if (Object.keys(out).length > 50) {
    fs.writeFileSync(DIR, JSON.stringify({ updated: new Date().toISOString(), errors: derrors, symbols: out }) + '\n');
    console.log(`Directory: ${Object.keys(out).length} symbols`, Object.keys(derrors).length ? derrors : '');
  } else console.warn('Directory not updated:', derrors);
}
