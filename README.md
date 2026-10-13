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
- Live prices: a GitHub Action (`.github/workflows/update-prices.yml`) runs every 10 minutes during NSE hours, fetches quotes with [stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india) for every symbol in `symbols.json`, and commits `data/prices.json`. The dashboard reads that file when it is served over HTTP (for example GitHub Pages) and polls it every 30 seconds.
- Optional custom feed: any JSON endpoint returning `{"RELIANCE": 1432.5}`.
- The symbol auto-fill (name, class, sector) only works inside Claude's artifact viewer.

## Live data (GitHub Actions)
Two jobs keep the `data/` folder fresh. The dashboard reads it when served from GitHub Pages.

| Job | When | Writes | Source |
|---|---|---|---|
| Update prices | every 10 minutes during NSE hours, and when `symbols.json` changes | `data/prices.json` (all NIFTY 500 stocks plus your symbols and benchmark indices), `data/directory.json` (symbol names for lookup, daily) | [stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india) and NSE listing files |
| Update price history | daily at 17:00 IST, and when `symbols.json` changes | `data/history.json` (daily closes for your symbols and indices) | [jugaad-data](https://github.com/jugaad-py/jugaad-data) |

Setup:
1. Settings, then Pages: publish the `main` branch (root).
2. Put your symbols in `symbols.json`. The Data tab has a "Copy symbols.json" button. Committing the file runs both jobs.
3. Open the Data tab: "Live data status" shows what loaded and what did not.

Scheduled runs can be delayed by several minutes, so prices are near-live. NSE sometimes blocks cloud servers. If a job fails, the log in the Actions tab has the reason, and the dashboard keeps the last good data.

The Claude preview cannot reach NSE or this repository, so symbol lookup there uses Claude and prices are not live.

## Tests
`node tests/core.test.js`

## Roadmap
- Real quote backend (NSE/BSE data source) with a `/api/quote` endpoint
- Dividends and corporate actions
- Tax-lot reports
