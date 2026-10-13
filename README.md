# PortfolioMgmt

A single-page portfolio dashboard for Indian holdings across asset classes (equities, ETFs, mutual funds, gold, debt, fixed deposits).

## Features
- **Funds**: create funds such as Large Cap, Mid Cap and Small Cap, each with its own benchmark, and compare them side by side. Every other tab can be switched to one fund or all funds
- **Today**: live value, day P&L, total profit, XIRR, allocation, movers
- **Holdings**: FIFO average cost, manual and CSV transaction entry, manual prices
- **Statistics**: volatility, Sharpe, Sortino, max drawdown, 1-day VaR, concentration, holding-period split
- **vs Benchmark**: beta, alpha, correlation, tracking error, information ratio, up/down capture, monthly returns
- **Rebalance**: target weights and trades needed
- Light, dark and system themes

## Asset classes
Equities, ETFs, Mutual Funds, Futures, Options, Commodities, REIT, InvIT, Money Market Funds, Long Term Fixed Income. Holdings are bundled under their class, with a subtotal row you can fold. Imports also accept common names (stock, etf, mf, gold, liquid, FD) and map them. Futures and options are valued as quantity times price; short positions and margin are not modelled yet.

## Run
Open `index.html` in a browser. No build step. Holdings are stored in the browser's localStorage.

## Data
- The first load shows a simulated example portfolio.
- Import transactions (`date,symbol,type,qty,price,class,name,fund`; the fund column is optional and creates the fund if it is new) or price history (`date,symbol,close`) from the Data tab.
- Live prices: a GitHub Action (`.github/workflows/update-prices.yml`) runs during NSE hours, fetches quotes with [stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india) for symbols in `symbols.json`, and commits `data/prices.json`. The dashboard reads that file when served over HTTP (for example GitHub Pages) and polls it periodically.
- Optional custom feed: any JSON endpoint returning `{"RELIANCE": 1432.5}`.
- The symbol auto-fill (name, class, sector) only works inside Claude's artifact viewer.

## Live data (GitHub Actions)
The existing live quote and price-history workflows remain in place. This feature adds a third workflow for official NSE end-of-day cash-market data.

| Job | When | Writes | Source |
|---|---|---|---|
| Update prices | Scheduled during NSE hours | `data/prices.json`, `data/directory.json` | Existing quote adapter and NSE listing files |
| Update price history | Daily and when symbols change | `data/history.json` | Existing `jugaad-data` workflow |
| Update NSE Bhavcopy | Weekdays at 18:00 IST (12:30 UTC), manually, or when its scripts/config change | `data/bhavcopy.json` and merged configured-symbol closes in `data/history.json` | NSE CM Bhavcopy archives |

The Bhavcopy workflow tries the current NSE CM archive name and the legacy ZIP format, and walks back across recent calendar days for weekends and holidays. It retains up to 30 cached daily Bhavcopies and merges the configured symbols' daily closing prices into the existing history series (up to 800 observations per symbol). It does not overwrite `data/prices.json`: Bhavcopy is end-of-day data and is not a live quote feed. NSE can block cloud requests, and GitHub scheduled runs can be delayed.

Setup for GitHub Pages:
1. In repository Settings → Pages, publish the `main` branch (root).
2. Put your tracked symbols in `symbols.json`; commits trigger the existing data jobs.
3. Inspect the Actions tab for workflow results and the Data tab for dashboard data status.

## NSE Bhavcopy MCP
A standalone local stdio MCP server is available in `mcp/server.js`. Install dependencies with `npm install`, then run `npm run bhavcopy`. MCP tools expose the latest cached Bhavcopy, date/symbol-filtered rows, symbol history and symbol search. See [mcp/README.md](mcp/README.md) for client configuration.

GitHub Actions refreshes the cache; it does not host a persistent MCP endpoint. To query through MCP, run the server locally against a checkout containing `data/bhavcopy.json` and `data/history.json`.

## Tests
- `npm test`
- `npm run test:bhavcopy`

## Roadmap
- Real quote backend (NSE/BSE data source) with a `/api/quote` endpoint
- Dividends and corporate actions
- Tax-lot reports
