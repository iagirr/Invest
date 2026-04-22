import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "portfolio.db");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const EXPORTS_DIR = path.join(DATA_DIR, "exports");

function bootstrapDatabase(db: Database.Database) {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf', 'fund')),
      operation TEXT NOT NULL CHECK(operation IN ('buy', 'sell')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      fx_rate_to_eur REAL NOT NULL DEFAULT 1,
      trade_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS market_quotes (
      symbol TEXT PRIMARY KEY,
      short_name TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL,
      price REAL NOT NULL,
      previous_close REAL,
      change_percent REAL,
      exchange_name TEXT,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fx_rates (
      currency TEXT PRIMARY KEY,
      rate_to_eur REAL NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      captured_at TEXT PRIMARY KEY,
      total_value_eur REAL NOT NULL,
      total_cost_eur REAL NOT NULL,
      total_pl_eur REAL NOT NULL,
      benchmark_symbol TEXT NOT NULL,
      benchmark_price_eur REAL
    );

    CREATE TABLE IF NOT EXISTS portfolio_performance_metrics (
      captured_at TEXT PRIMARY KEY,
      day_change_percent REAL,
      week_change_percent REAL,
      month_change_percent REAL,
      year_change_percent REAL,
      since_start_change_percent REAL,
      day_reference_value_eur REAL,
      week_reference_value_eur REAL,
      month_reference_value_eur REAL,
      year_reference_value_eur REAL,
      basis_value_eur REAL
    );

    CREATE TABLE IF NOT EXISTS tracked_instruments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('stock', 'etf', 'fund')),
      start_date TEXT NOT NULL,
      start_date_precision TEXT NOT NULL DEFAULT 'estimated' CHECK(start_date_precision IN ('exact', 'estimated')),
      end_date TEXT,
      initial_amount_eur REAL NOT NULL,
      current_amount_eur REAL NOT NULL,
      basis_amount_eur REAL NOT NULL DEFAULT 0,
      estimated_contributions_eur REAL NOT NULL DEFAULT 0,
      total_return_percent REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      return_precision TEXT NOT NULL CHECK(return_precision IN ('exact', 'estimated')),
      inferred_units REAL,
      last_market_value_eur REAL,
      last_price_eur REAL,
      last_updated TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tracked_instrument_flows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracked_instrument_id INTEGER NOT NULL,
      flow_date TEXT NOT NULL,
      flow_type TEXT NOT NULL CHECK(flow_type IN ('contribution', 'withdrawal')),
      amount_eur REAL NOT NULL,
      inferred_units_delta REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tracked_instrument_id) REFERENCES tracked_instruments(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.prepare(
    `
      INSERT INTO app_settings (key, value)
      VALUES ('baseCurrency', 'EUR'), ('benchmarkSymbol', 'SPY'), ('themeVariant', 'diesel-neon')
      ON CONFLICT(key) DO NOTHING
    `,
  ).run();

  ensureColumn(db, "tracked_instruments", "start_date_precision", "TEXT NOT NULL DEFAULT 'estimated'");
  ensureColumn(db, "tracked_instruments", "end_date", "TEXT");
  ensureColumn(db, "tracked_instruments", "basis_amount_eur", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "tracked_instruments", "estimated_contributions_eur", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "tracked_instruments", "inferred_units", "REAL");
  ensureColumn(db, "tracked_instruments", "last_market_value_eur", "REAL");
  ensureColumn(db, "tracked_instruments", "last_price_eur", "REAL");
  ensureColumn(db, "tracked_instruments", "last_updated", "TEXT");
}

function ensureColumn(db: Database.Database, tableName: string, columnName: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

declare global {
  var __neonLedgerDb: Database.Database | undefined;
}

export function getDatabase() {
  if (global.__neonLedgerDb) {
    bootstrapDatabase(global.__neonLedgerDb);
    return global.__neonLedgerDb;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  bootstrapDatabase(db);
  global.__neonLedgerDb = db;
  return db;
}

export function getDatabasePath() {
  return DB_PATH;
}

export function getBackupsDir() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  return BACKUPS_DIR;
}

export function getExportsDir() {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  return EXPORTS_DIR;
}

export function getAppSettings() {
  const db = getDatabase();
  const rows = db.prepare("SELECT key, value FROM app_settings").all() as Array<{
    key: string;
    value: string;
  }>;

  const entries = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    baseCurrency: entries.baseCurrency ?? "EUR",
    benchmarkSymbol: entries.benchmarkSymbol ?? "SPY",
    themeVariant: entries.themeVariant ?? "diesel-neon",
  };
}

export function setAppSetting(key: string, value: string) {
  const db = getDatabase();

  db.prepare(
    `
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(key, value);
}

export async function createDatabaseBackup() {
  const db = getDatabase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetPath = path.join(getBackupsDir(), `portfolio-backup-${stamp}.db`);
  const escapedTarget = targetPath.replace(/'/g, "''");

  db.pragma("wal_checkpoint(FULL)");
  db.exec(`VACUUM INTO '${escapedTarget}'`);

  return {
    path: targetPath,
    fileName: path.basename(targetPath),
    createdAt: new Date().toISOString(),
  };
}
