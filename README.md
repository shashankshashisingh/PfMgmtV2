# PortfolioMgmt

A single-page portfolio dashboard for Indian holdings across asset classes (equities, ETFs, mutual funds, gold, debt, fixed deposits).

## Features
- **Today**: live value, day P&L, total profit, XIRR, allocation, movers
- **Holdings**: FIFO average cost, manual and CSV transaction entry, manual prices
- **Statistics**: volatility, Sharpe, Sortino, max drawdown, 1-day VaR, concentration, holding-period split
- **vs Benchmark**: beta, alpha, correlation, tracking error, information ratio, up/down capture, monthly returns
- **Rebalance**: target weights and trades needed
- Light, dark and system themes

## Run
Open `index.html` in a browser. No build step. Holdings are stored in the browser's localStorage.

## Data
- The first load shows a simulated example portfolio.
- Import transactions (`date,symbol,type,qty,price,class,name`) or price history (`date,symbol,close`) from the Data tab.
- Optional live feed: a JSON endpoint returning `{"RELIANCE": 1432.5}`, polled every 30 seconds.
- The symbol auto-fill (name, class, sector) only works inside Claude's artifact viewer.

## Tests
`node tests/core.test.js`

## Roadmap
- Real quote backend (NSE/BSE data source) with a `/api/quote` endpoint
- Dividends and corporate actions
- Tax-lot reports
