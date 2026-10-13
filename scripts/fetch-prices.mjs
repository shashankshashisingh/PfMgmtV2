// Fetches the latest NSE quotes for every symbol in symbols.json and writes data/prices.json.
// Uses the unofficial stock-nse-india package (https://github.com/hi-imcodeman/stock-nse-india).
import fs from 'node:fs';
import { NseIndia } from 'stock-nse-india';

const OUT = 'data/prices.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const symbols = JSON.parse(fs.readFileSync('symbols.json', 'utf8')).symbols || [];

let previous = {};
try { previous = JSON.parse(fs.readFileSync(OUT, 'utf8')).prices || {}; } catch {}

const nse = new NseIndia();
const prices = {};
const errors = {};

for (const raw of symbols) {
  const sym = String(raw).trim().toUpperCase();
  if (!sym) continue;
  try {
    const d = await nse.getEquityDetails(sym);
    const p = d.priceInfo || {};
    const ltp = Number(p.lastPrice);
    if (!Number.isFinite(ltp)) throw new Error('no last price in response');
    prices[sym] = {
      ltp,
      prevClose: Number.isFinite(Number(p.previousClose)) ? Number(p.previousClose) : null,
      changePct: Number.isFinite(Number(p.pChange)) ? Number(p.pChange) : null,
      name: d.info?.companyName || previous[sym]?.name || '',
      sector: d.industryInfo?.sector || d.industryInfo?.macro || previous[sym]?.sector || ''
    };
  } catch (e) {
    errors[sym] = String(e?.message || e);
    if (previous[sym]) prices[sym] = previous[sym]; // keep the last known quote
  }
  await sleep(500); // be gentle with NSE
}

const fetched = symbols.length - Object.keys(errors).length;
console.log(`Fetched ${fetched}/${symbols.length} symbols`);
for (const [s, m] of Object.entries(errors)) console.warn(`  ${s}: ${m}`);

if (symbols.length && fetched === 0) {
  console.error('Every symbol failed. NSE may be blocking this network. Leaving prices.json unchanged.');
  process.exit(1);
}

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), prices, errors }, null, 2) + '\n');
