import "server-only";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const LEGACY_PATH = resolve(process.cwd(), ".repoquest", "repoquest.sqlite");
const DEFAULT_PATH = resolve(process.cwd(), "data", "repoquest.db");
const DB_TIMEOUT_MS = 5000;
const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS profiles (
    username TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS coverage (
    username TEXT NOT NULL,
    repository_id TEXT NOT NULL,
    requested_scope TEXT NOT NULL,
    supported_kinds_json TEXT NOT NULL,
    backfill_status TEXT NOT NULL,
    oldest_evidence_at TEXT,
    newest_evidence_at TEXT,
    last_attempt_at TEXT,
    last_successful_sync_at TEXT,
    covered_through TEXT,
    can_resume INTEGER NOT NULL DEFAULT 0,
    limitations_json TEXT NOT NULL DEFAULT '[]',
    failure_reason TEXT,
    retry_at TEXT,
    checkpoint_json TEXT,
    PRIMARY KEY (username, repository_id)
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    actor_login TEXT NOT NULL,
    actor_id INTEGER NOT NULL,
    repository_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    track TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    state TEXT NOT NULL,
    reason TEXT NOT NULL,
    imported_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_evidence_username_time ON evidence(username, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_evidence_repo_user ON evidence(username, repository_id);

  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT,
    last_synced_at TEXT,
    last_attempt_at TEXT,
    warnings_json TEXT NOT NULL DEFAULT '[]',
    selected_repositories_json TEXT NOT NULL DEFAULT '[]'
  );
`;

function resolveDatabasePath(): string {
  const modern = process.env.DATABASE_PATH?.trim();
  if (modern) return resolve(modern);
  const legacy = process.env.REPOQUEST_DB_PATH?.trim();
  if (legacy) return resolve(legacy);
  if (existsSync(LEGACY_PATH)) return LEGACY_PATH;
  return DEFAULT_PATH;
}

const DB_PATH = resolveDatabasePath();
let db: DatabaseSync | null = null;

function ensureSyncStateColumn(connection: DatabaseSync): void {
  const syncColumns = connection.prepare("PRAGMA table_info(sync_state)").all() as Array<{ name: string }>;
  if (!syncColumns.some((column) => column.name === "selected_repositories_json")) {
    try {
      connection.exec("ALTER TABLE sync_state ADD COLUMN selected_repositories_json TEXT NOT NULL DEFAULT '[]'");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("duplicate column name")) {
        throw error;
      }
    }
  }
}

function initializeDatabase(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const connection = new DatabaseSync(DB_PATH, {
    timeout: DB_TIMEOUT_MS,
    enableForeignKeyConstraints: true,
  });
  try {
    connection.exec(SCHEMA_SQL);
    ensureSyncStateColumn(connection);
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

export function database(): DatabaseSync {
  if (db) return db;
  db = initializeDatabase();
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function databasePath(): string {
  return DB_PATH;
}
