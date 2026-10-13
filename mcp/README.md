# NSE Bhavcopy MCP

A local stdio MCP server for querying NSE cash-market Bhavcopy data cached by this repository's scheduled GitHub Action. It exposes:
- `get_latest_bhavcopy` — latest available trading date and a small sample.
- `get_bhavcopy_for_date` — cached EQ/BE rows for a date, optionally filtered by symbol.
- `get_symbol_history` — end-of-day closes from `data/history.json`.
- `search_bhavcopy_symbols` — find symbols in the latest cached Bhavcopy.

## Setup

Requires Node.js 20 or newer.

```sh
npm install
npm run bhavcopy
```

Configure your MCP client to launch this repository's `mcp/server.js` with Node. Example JSON configuration:

```json
{
  "mcpServers": {
    "nse-bhavcopy": {
      "command": "node",
      "args": ["/absolute/path/to/PortfolioMgmt/mcp/server.js"]
    }
  }
}
```

The server reads local cache files; it does not make a network request for every tool call. Run `npm run fetch:bhavcopy` or wait for the GitHub Action to refresh the cache. GitHub Actions does not host a persistent stdio MCP endpoint; use the local server for MCP access.

## Data caveats

Bhavcopy is official end-of-day market data, not a live feed. The workflow tries the current NSE CM archive format and the legacy ZIP format and walks back over recent calendar days for weekends/holidays. NSE may block requests from cloud runners; failed runs leave existing data files intact. Confirm usage against NSE's current terms and data policies.
