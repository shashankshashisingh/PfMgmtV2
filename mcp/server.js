#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), "utf8")); } catch { return fallback; }
};
const server = new McpServer({ name: "nse-bhavcopy", version: "1.0.0" });

server.tool("get_latest_bhavcopy", "Return the latest cached NSE cash-market Bhavcopy date and summary. Data is end-of-day, not a live quote.", {}, async () => {
  const data = readJson("data/bhavcopy.json", { days: {} });
  const date = data.latestDate || Object.keys(data.days || {}).sort().at(-1);
  const rows = date ? data.days?.[date] || [] : [];
  return { content: [{ type: "text", text: JSON.stringify({ date: date || null, rows: rows.length, updated: data.updated || null, sample: rows.slice(0, 10) }, null, 2) }] };
});

server.tool("get_bhavcopy_for_date", "Get cached NSE cash-market EQ/BE closing prices for a trading date (YYYY-MM-DD). Only dates already cached by the scheduled job are available.", {
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  symbol: z.string().optional(),
}, async ({ date, symbol }) => {
  const data = readJson("data/bhavcopy.json", { days: {} });
  let rows = data.days?.[date] || [];
  if (symbol) rows = rows.filter(r => r.symbol === symbol.trim().toUpperCase());
  return { content: [{ type: "text", text: JSON.stringify({ date, count: rows.length, rows: rows.slice(0, 500) }, null, 2) }] };
});

server.tool("get_symbol_history", "Return daily closing-price history from data/history.json. This is end-of-day history, not real-time market data.", {
  symbol: z.string().min(1),
  limit: z.number().int().min(1).max(800).optional(),
}, async ({ symbol, limit = 30 }) => {
  const key = symbol.trim().toUpperCase();
  const data = readJson("data/history.json", { series: {}, meta: {} });
  const series = data.series?.[key];
  if (!series) return { content: [{ type: "text", text: JSON.stringify({ symbol: key, error: "No cached history for this symbol. Add it to symbols.json and wait for the scheduled Bhavcopy update." }) }] };
  const start = Math.max(0, series.d.length - limit);
  return { content: [{ type: "text", text: JSON.stringify({ symbol: key, meta: data.meta?.[key] || {}, updated: data.updated || null, history: series.d.slice(start).map((date, i) => ({ date, close: series.c[start + i] })) }, null, 2) }] };
});

server.tool("search_bhavcopy_symbols", "Search symbols present in the latest cached NSE Bhavcopy.", {
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
}, async ({ query, limit = 20 }) => {
  const q = query.trim().toUpperCase();
  const data = readJson("data/bhavcopy.json", { days: {}, latestDate: null });
  const date = data.latestDate || Object.keys(data.days || {}).sort().at(-1);
  const rows = (data.days?.[date] || []).filter(r => r.symbol.includes(q)).slice(0, limit);
  return { content: [{ type: "text", text: JSON.stringify({ date: date || null, query, count: rows.length, rows }, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
