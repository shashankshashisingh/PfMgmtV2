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
Equities, Futures, Options, Commodities, REIT, InvIT, Money Market Funds, Long Term Fixed Income. Imports also accept common names (stock, ETF, gold, liquid, FD) and map them. Futures and options are valued as quantity times price; short positions and margin are not modelled yet.

## Run
Open `index.html` in a browser. No build step. Holdings are stored in the browser's localStorage.

## Data
- The first load shows a simulated example portfolio.
- Import transactions (`date,symbol,type,qty,price,class,name,fund`; the fund column is optional and creates the fund if it is new) or price history (`date,symbol,close`) from the Data tab.
- Live prices: a GitHub Action (`.github/workflows/update-prices.yml`) runs every 10 minutes during NSE hours, fetches quotes with [stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india) for every symbol in `symbols.json`, and commits `data/prices.json`. The dashboard reads that file when it is served over HTTP (for example GitHub Pages) and polls it every 30 seconds.
- Optional custom feed: any JSON endpoint returning `{"RELIANCE": 1432.5}`.
- The symbol auto-fill (name, class, sector) only works inside Claude's artifact viewer.

## Live prices setup
1. In the repo, open Settings, then Pages, and publish the `main` branch (root). The dashboard then lives at your Pages URL.
2. Put your symbols in `symbols.json`. The Data tab has a "Copy symbols.json" button.
3. Run the "Update prices" workflow once from the Actions tab to check that NSE answers from GitHub's servers. NSE sometimes blocks cloud networks. If every symbol fails, the job stops and leaves the last prices in place.
4. Open the Pages URL, import your holdings, and the status bar shows the feed time.

Scheduled GitHub Actions runs can be delayed by several minutes, so treat prices as near-live, not tick-by-tick.

## Tests
`node tests/core.test.js`

## Roadmap
- Real quote backend (NSE/BSE data source) with a `/api/quote` endpoint
- Dividends and corporate actions
- Tax-lot reports
