"""Writes data/history.json: daily closes for your symbols and the benchmark indices.
Uses the unofficial jugaad-data package. Each run only fetches days it does not have yet."""
import datetime as dt
import json
import os
import re
import sys

from jugaad_data.nse import index_df, stock_df

OUT = "data/history.json"
KEEP = 800  # trading days kept per series
DAYS_BACK = 730

cfg = json.load(open("symbols.json"))
symbols = sorted({s.strip().upper() for s in cfg.get("symbols", []) if s.strip()})
known = {i["nse"]: i for i in json.load(open("scripts/indices.json"))}
wanted_indices = cfg.get("indices", ["NIFTY 50"])

try:
    old = json.load(open(OUT))
except Exception:
    old = {}
series = old.get("series", {})
meta = old.get("meta", {})
errors = {}
today = dt.date.today()


def window(key):
    s = series.get(key)
    if s and s["d"]:
        start = dt.date.fromisoformat(s["d"][-1]) + dt.timedelta(days=1)
    else:
        start = today - dt.timedelta(days=DAYS_BACK)
    return start, today


def merge(key, rows):
    cur = dict(zip(series.get(key, {}).get("d", []), series.get(key, {}).get("c", [])))
    for d, c in rows:
        cur[d] = c
    ds = sorted(cur)[-KEEP:]
    series[key] = {"d": ds, "c": [cur[d] for d in ds]}


def run(key, fetch, datecol):
    start, end = window(key)
    if start > end:
        return
    try:
        df = fetch(start, end)
        rows = [(r[datecol].strftime("%Y-%m-%d"), round(float(r["CLOSE"]), 4)) for _, r in df.iterrows() if r["CLOSE"] == r["CLOSE"]]
        if rows:
            merge(key, rows)
            print(f"{key}: +{len(rows)} days")
        else:
            print(f"{key}: no new rows")
    except Exception as e:  # keep going, record the reason
        errors[key] = str(e)[:200]
        print(f"{key}: failed - {errors[key]}", file=sys.stderr)


for sym in symbols:
    run(sym, lambda a, b, s=sym: stock_df(s, a, b, series="EQ"), "DATE")

for name in wanted_indices:
    info = known.get(name.upper(), {"key": re.sub(r"\W", "", name.upper()), "name": name.title()})
    run(info["key"], lambda a, b, n=name: index_df(n, a, b), "HistoricalDate")
    meta[info["key"]] = {"name": info["name"], "cls": "Index"}

if not series:
    print("No history fetched. NSE may be blocking this network.", file=sys.stderr)
    sys.exit(1)

os.makedirs("data", exist_ok=True)
json.dump({"updated": dt.datetime.utcnow().isoformat() + "Z", "series": series, "meta": meta, "errors": errors}, open(OUT, "w"), separators=(",", ":"))
print(f"Wrote {len(series)} series")
