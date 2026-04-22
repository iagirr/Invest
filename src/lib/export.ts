import fs from "node:fs";
import path from "node:path";

import { getDatabase, getExportsDir } from "@/lib/db";
import { getDashboardData } from "@/lib/portfolio";

type TransactionExportRow = {
  id: number;
  symbol: string;
  name: string;
  asset_type: string;
  operation: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  fx_rate_to_eur: number;
  trade_date: string;
  created_at: string;
};

function toCsvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function buildExportPayload() {
  const db = getDatabase();
  const transactions = db
    .prepare(
      `
        SELECT id, symbol, name, asset_type, operation, quantity, price, fee, currency, fx_rate_to_eur, trade_date, created_at
        FROM transactions
        ORDER BY trade_date ASC, id ASC
      `,
    )
    .all() as TransactionExportRow[];
  const quotes = db.prepare("SELECT * FROM market_quotes ORDER BY symbol ASC").all();
  const fxRates = db.prepare("SELECT * FROM fx_rates ORDER BY currency ASC").all();
  const snapshots = db.prepare("SELECT * FROM portfolio_snapshots ORDER BY captured_at ASC").all();
  const settings = db.prepare("SELECT * FROM app_settings ORDER BY key ASC").all();
  const trackedInstruments = db.prepare("SELECT * FROM tracked_instruments ORDER BY created_at ASC, id ASC").all();
  const trackedInstrumentFlows = db
    .prepare("SELECT * FROM tracked_instrument_flows ORDER BY flow_date ASC, id ASC")
    .all();

  return {
    exportedAt: new Date().toISOString(),
    dashboard: await getDashboardData(),
    settings,
    transactions,
    trackedInstruments,
    trackedInstrumentFlows,
    marketQuotes: quotes,
    fxRates,
    snapshots,
  };
}

export async function exportJsonFile() {
  const payload = await buildExportPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `portfolio-export-${stamp}.json`;
  const filePath = path.join(getExportsDir(), fileName);
  const content = JSON.stringify(payload, null, 2);

  fs.writeFileSync(filePath, content, "utf8");

  return {
    fileName,
    path: filePath,
    content,
  };
}

export async function exportTransactionsCsvFile() {
  const rows = (await buildExportPayload()).transactions;
  const header = [
    "id",
    "symbol",
    "name",
    "asset_type",
    "operation",
    "quantity",
    "price",
    "fee",
    "currency",
    "fx_rate_to_eur",
    "trade_date",
    "created_at",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.symbol,
        row.name,
        row.asset_type,
        row.operation,
        row.quantity,
        row.price,
        row.fee,
        row.currency,
        row.fx_rate_to_eur,
        row.trade_date,
        row.created_at,
      ]
        .map(toCsvCell)
        .join(","),
    ),
  ];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `transactions-export-${stamp}.csv`;
  const filePath = path.join(getExportsDir(), fileName);
  const content = `${lines.join("\n")}\n`;

  fs.writeFileSync(filePath, content, "utf8");

  return {
    fileName,
    path: filePath,
    content,
  };
}
