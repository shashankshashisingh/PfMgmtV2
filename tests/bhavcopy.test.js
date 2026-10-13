import assert from "node:assert/strict";
import { mergeBhavcopyHistory, normalizeBhavcopyRows, parseCsv } from "../scripts/bhavcopy.js";

const csv = [
  "TradDt,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,Company",
  '2026-10-12,RELIANCE,EQ,1450.25,1432.5,"Reliance Industries, Ltd"',
  "2026-10-12,TESTBE,BE,10.5,10",
  "2026-10-12,TESTFUT,XX,20,19",
].join("\n");
const parsed = parseCsv(csv);
assert.equal(parsed.length, 3);
assert.equal(parsed[0].Company, "Reliance Industries, Ltd");
const rows = normalizeBhavcopyRows(parsed);
assert.equal(rows.length, 2);
assert.deepEqual(rows[0], { date: "2026-10-12", symbol: "RELIANCE", series: "EQ", close: 1450.25, previousClose: 1432.5, name: "Reliance Industries, Ltd" });
const old = { series: { RELIANCE: { d: ["2026-10-09"], c: [1420] } }, meta: { RELIANCE: { name: "Reliance" } } };
const merged = mergeBhavcopyHistory(old, rows);
assert.deepEqual(merged.series.RELIANCE, { d: ["2026-10-09", "2026-10-12"], c: [1420, 1450.25] });
assert.equal(merged.series.TESTBE.c[0], 10.5);
console.log("Bhavcopy tests passed");
