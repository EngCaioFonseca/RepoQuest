import "server-only";
import { z } from "zod";
import type { StorageStatus } from "@/lib/contracts";
import { database, isMemoryDatabase } from "./db";

/**
 * Optional "cloud save" for player state. SQLite stays the working store; a
 * backend only keeps a copy of one player's save:
 *
 * - `gist` (CLOUD_SAVE=gist): a secret GitHub Gist owned by the GITHUB_TOKEN
 *   user. No extra service or secret; the token needs Gist write permission.
 * - `postgres` (CLOUD_SAVE=postgres, or CLOUD_DATABASE_URL alone): a
 *   bring-your-own Postgres database such as a free Neon project.
 *
 * restore: when the local database has no player yet, the most recent save is
 * copied in, including coverage checkpoints, so the next sync is incremental
 * instead of a full GitHub backfill. save: after a sync or profile change, the
 * player's save is merged into the backend.
 *
 * Source evidence is saved rather than derived XP, so scoring changes still
 * apply after a restore. Cloud failures never fail a sync or the dashboard.
 */

const RESTORE_RETRY_MS = 60_000;

const text = z.string();
const optionalText = z.string().nullable();

const profileSchema = z.object({
  username: text,
  display_name: text,
  avatar_url: optionalText,
  is_ai_engineer: z.boolean(),
  ai_tool_usage: text,
  mage_quiz_json: optionalText,
  updated_at: text,
});
const syncStateSchema = z.object({
  selected_repositories_json: text,
  last_synced_at: optionalText,
  warnings_json: text,
});
const repositorySchema = z.object({ id: text, owner: text, name: text, url: text, description: text });
const coverageSchema = z.object({
  username: text,
  repository_id: text,
  requested_scope: text,
  supported_kinds_json: text,
  backfill_status: text,
  oldest_evidence_at: optionalText,
  newest_evidence_at: optionalText,
  last_attempt_at: optionalText,
  last_successful_sync_at: optionalText,
  covered_through: optionalText,
  can_resume: z.boolean(),
  limitations_json: text,
  failure_reason: optionalText,
  retry_at: optionalText,
  checkpoint_json: optionalText,
});
const evidenceSchema = z.object({
  id: text,
  username: text,
  actor_login: text,
  actor_id: z.number().int(),
  repository_id: text,
  kind: text,
  track: text,
  title: text,
  url: text,
  occurred_at: text,
  state: text,
  reason: text,
  imported_at: text,
});

/** One player's portable state. Column names and values mirror the SQLite tables so a round trip is exact. */
export const playerSaveSchema = z.object({
  format: z.literal("repoquest-save"),
  version: z.literal(1),
  savedAt: text,
  profile: profileSchema,
  /** Null when this install never synced the player; a merge then keeps the other save's selection. */
  syncState: syncStateSchema.nullable(),
  repositories: z.array(repositorySchema),
  coverage: z.array(coverageSchema),
  evidence: z.array(evidenceSchema),
});

export type PlayerSave = z.infer<typeof playerSaveSchema>;
export type CoverageRow = z.infer<typeof coverageSchema>;
export type EvidenceRow = z.infer<typeof evidenceSchema>;
export type RepositoryRow = z.infer<typeof repositorySchema>;

export const COVERAGE_COLUMNS = Object.keys(coverageSchema.shape) as Array<keyof CoverageRow>;
export const EVIDENCE_COLUMNS = Object.keys(evidenceSchema.shape) as Array<keyof EvidenceRow>;
export const REPOSITORY_COLUMNS = Object.keys(repositorySchema.shape) as Array<keyof RepositoryRow>;

export type CloudBackendKind = "gist" | "postgres";

export interface CloudBackend {
  kind: CloudBackendKind;
  /** The most recently saved player, or null when there is no save yet. */
  loadLatest(): Promise<PlayerSave | null>;
  /** Merges this install's save into the stored one. */
  store(save: PlayerSave): Promise<void>;
  close(): Promise<void>;
}

/** A failure with a message that is safe to show in the UI (no tokens, URLs or hosts). */
export class CloudSaveError extends Error {
  constructor(message: string, public readonly userMessage: string) {
    super(message);
  }
}

type Row = Record<string, unknown>;

function pick<T extends string>(row: Row, columns: readonly T[]): Record<T, unknown> {
  return Object.fromEntries(columns.map((column) => [column, row[column] ?? null])) as Record<T, unknown>;
}

/** Reads one player's save from the local database, or null when the player is unknown locally. */
export function exportLocalSave(username: string): PlayerSave | null {
  const db = database();
  const profile = db.prepare("SELECT * FROM profiles WHERE username = ?").get(username) as Row | undefined;
  if (!profile) return null;
  const syncState = db.prepare("SELECT * FROM sync_state WHERE id = 1 AND username = ?").get(username) as Row | undefined;
  const coverage = (db.prepare("SELECT * FROM coverage WHERE username = ? ORDER BY repository_id").all(username) as Row[])
    .map((row) => ({ ...pick(row, COVERAGE_COLUMNS), can_resume: row.can_resume === 1 }));
  const evidence = (db.prepare("SELECT * FROM evidence WHERE username = ? ORDER BY id").all(username) as Row[])
    .map((row) => pick(row, EVIDENCE_COLUMNS));
  const repositories = (db.prepare(`
    SELECT * FROM repositories WHERE id IN (
      SELECT repository_id FROM coverage WHERE username = ?
      UNION SELECT repository_id FROM evidence WHERE username = ?
    ) ORDER BY id
  `).all(username, username) as Row[]).map((row) => pick(row, REPOSITORY_COLUMNS));

  return playerSaveSchema.parse({
    format: "repoquest-save",
    version: 1,
    savedAt: new Date().toISOString(),
    profile: {
      username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url ?? null,
      is_ai_engineer: profile.is_ai_engineer === 1,
      ai_tool_usage: profile.ai_tool_usage ?? "unspecified",
      mage_quiz_json: profile.mage_quiz_json ?? null,
      updated_at: profile.updated_at,
    },
    syncState: syncState
      ? {
        selected_repositories_json: syncState.selected_repositories_json ?? "[]",
        last_synced_at: syncState.last_synced_at ?? null,
        warnings_json: syncState.warnings_json ?? "[]",
      }
      : null,
    repositories,
    coverage,
    evidence,
  });
}

/**
 * Combines a stored save with this install's save. Evidence and repositories
 * are a union by stable ID (this install wins on conflicts); a repository's
 * coverage keeps the more recent attempt so progress never moves backwards.
 */
export function mergeSaves(stored: PlayerSave | null, local: PlayerSave): PlayerSave {
  if (!stored || stored.profile.username !== local.profile.username) return local;
  const union = <T>(rows: T[], key: (row: T) => string, preferred: T[]): T[] => {
    const merged = new Map(rows.map((row) => [key(row), row]));
    for (const row of preferred) merged.set(key(row), row);
    return [...merged.values()].sort((a, b) => key(a).localeCompare(key(b)));
  };
  const coverage = new Map(stored.coverage.map((row) => [row.repository_id, row]));
  for (const row of local.coverage) {
    const existing = coverage.get(row.repository_id);
    if (!existing || (row.last_attempt_at ?? "") >= (existing.last_attempt_at ?? "")) coverage.set(row.repository_id, row);
  }
  return {
    ...local,
    syncState: local.syncState ?? stored.syncState,
    repositories: union(stored.repositories, (row) => row.id, local.repositories),
    coverage: [...coverage.values()].sort((a, b) => a.repository_id.localeCompare(b.repository_id)),
    evidence: union(stored.evidence, (row) => row.id, local.evidence),
  };
}

function localHasPlayer(): boolean {
  const db = database();
  const sync = db.prepare("SELECT username FROM sync_state WHERE id = 1").get() as { username: string | null } | undefined;
  if (sync?.username) return true;
  return Boolean(db.prepare("SELECT 1 FROM coverage LIMIT 1").get());
}

/** Copies a save into an empty local database. Returns false when a local player appeared meanwhile. */
function importSave(save: PlayerSave): boolean {
  const username = save.profile.username;
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    // A sync may have started while the save was loading; local state always wins.
    if (localHasPlayer()) {
      db.exec("ROLLBACK");
      return false;
    }
    const profile = save.profile;
    db.prepare(`
      INSERT INTO profiles (username, display_name, avatar_url, is_ai_engineer, ai_tool_usage, mage_quiz_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO NOTHING
    `).run(username, profile.display_name, profile.avatar_url, profile.is_ai_engineer ? 1 : 0, profile.ai_tool_usage, profile.mage_quiz_json, profile.updated_at);
    const insertRepository = db.prepare(`
      INSERT INTO repositories (${REPOSITORY_COLUMNS.join(", ")}) VALUES (${REPOSITORY_COLUMNS.map(() => "?").join(", ")})
      ON CONFLICT(id) DO NOTHING
    `);
    for (const row of save.repositories) insertRepository.run(...REPOSITORY_COLUMNS.map((column) => row[column]));
    const insertCoverage = db.prepare(`
      INSERT INTO coverage (${COVERAGE_COLUMNS.join(", ")}) VALUES (${COVERAGE_COLUMNS.map(() => "?").join(", ")})
      ON CONFLICT(username, repository_id) DO NOTHING
    `);
    for (const row of save.coverage) {
      if (row.username !== username) continue;
      insertCoverage.run(...COVERAGE_COLUMNS.map((column) => (column === "can_resume" ? (row.can_resume ? 1 : 0) : row[column] as string | null)));
    }
    const insertEvidence = db.prepare(`
      INSERT INTO evidence (${EVIDENCE_COLUMNS.join(", ")}) VALUES (${EVIDENCE_COLUMNS.map(() => "?").join(", ")})
      ON CONFLICT(id) DO NOTHING
    `);
    for (const row of save.evidence) {
      if (row.username !== username) continue;
      insertEvidence.run(...EVIDENCE_COLUMNS.map((column) => row[column]));
    }
    const syncState = save.syncState;
    db.prepare(`
      INSERT INTO sync_state (id, username, last_synced_at, last_attempt_at, warnings_json, selected_repositories_json)
      VALUES (1, ?, ?, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        last_synced_at = excluded.last_synced_at,
        warnings_json = excluded.warnings_json,
        selected_repositories_json = excluded.selected_repositories_json
    `).run(username, syncState?.last_synced_at ?? null, syncState?.warnings_json ?? "[]", syncState?.selected_repositories_json ?? "[]");
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

type BackendConfig = { kind: CloudBackendKind | null; problem: string | null };

function backendConfig(): BackendConfig {
  const mode = process.env.CLOUD_SAVE?.trim().toLowerCase() ?? "";
  const hasUrl = Boolean(process.env.CLOUD_DATABASE_URL?.trim());
  if (mode === "off") return { kind: null, problem: null };
  if (mode === "gist") {
    return { kind: "gist", problem: process.env.GITHUB_TOKEN?.trim() ? null : "Gist cloud save needs GITHUB_TOKEN to be configured." };
  }
  if (mode === "postgres" || (mode === "" && hasUrl)) {
    return { kind: "postgres", problem: hasUrl ? null : "Postgres cloud save needs CLOUD_DATABASE_URL to be configured." };
  }
  if (mode === "") return { kind: null, problem: null };
  return { kind: null, problem: "CLOUD_SAVE must be gist, postgres or off." };
}

let backend: CloudBackend | null = null;
let restoreDone = false;
let restoreInFlight: Promise<void> | null = null;
let lastRestoreFailureAt = 0;
let restoredFromCloud = false;
let lastCloudSaveAt: string | null = null;
let lastProblem: string | null = null;

async function activeBackend(kind: CloudBackendKind): Promise<CloudBackend> {
  if (backend?.kind === kind) return backend;
  // Loaded lazily so the Postgres driver is only initialized when it is used.
  backend = kind === "gist"
    ? (await import("./cloud-gist")).createGistBackend()
    : (await import("./cloud-postgres")).createPostgresBackend();
  return backend;
}

/** True when cloud save is configured, including misconfigured setups that should report an error. */
export function cloudSaveEnabled(): boolean {
  const config = backendConfig();
  return config.kind !== null || config.problem !== null;
}

function recordFailure(action: string, error: unknown): void {
  lastProblem = error instanceof CloudSaveError ? error.userMessage : "The cloud save could not be reached.";
  // Driver and HTTP errors carry status/host details, never tokens or passwords.
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`RepoQuest cloud ${action} failed: ${message}`);
}

/** Saves one player to the configured backend. Returns false when cloud save is off or failed. */
export async function saveToCloud(username: string): Promise<boolean> {
  const config = backendConfig();
  if (config.problem) {
    lastProblem = config.problem;
    return false;
  }
  if (!config.kind) return false;
  try {
    const save = exportLocalSave(username);
    if (!save) return false;
    await (await activeBackend(config.kind)).store(save);
    lastCloudSaveAt = save.savedAt;
    lastProblem = null;
    return true;
  } catch (error) {
    recordFailure("save", error);
    return false;
  }
}

/**
 * Restores the latest save into an empty local database, at most once per
 * process. A failed attempt is retried after a minute instead of on every request.
 */
export async function restoreFromCloudOnce(): Promise<void> {
  if (restoreDone) return;
  const config = backendConfig();
  if (config.problem) lastProblem = config.problem;
  const kind = config.kind;
  if (!kind || config.problem) return;
  if (restoreInFlight) return restoreInFlight;
  if (Date.now() - lastRestoreFailureAt < RESTORE_RETRY_MS) return;
  restoreInFlight = (async () => {
    if (localHasPlayer()) return;
    const save = await (await activeBackend(kind)).loadLatest();
    if (save && importSave(save)) restoredFromCloud = true;
  })()
    .then(() => {
      restoreDone = true;
      lastProblem = null;
    })
    .catch((error) => {
      lastRestoreFailureAt = Date.now();
      recordFailure("restore", error);
    })
    .finally(() => {
      restoreInFlight = null;
    });
  return restoreInFlight;
}

/** The user-facing reason the last cloud save or restore failed, if any. */
export function cloudSaveProblem(): string | null {
  return backendConfig().problem ?? lastProblem;
}

export function storageStatus(): StorageStatus {
  const config = backendConfig();
  const problem = config.problem ?? lastProblem;
  return {
    local: isMemoryDatabase() ? "memory" : "file",
    cloudSave: !cloudSaveEnabled() ? "off" : problem ? "error" : "ready",
    cloudBackend: config.kind,
    cloudProblem: cloudSaveEnabled() ? problem : null,
    lastCloudSaveAt,
    restoredFromCloud,
  };
}

/** Closes backend connections; used by tests. */
export async function closeCloudSave(): Promise<void> {
  const current = backend;
  backend = null;
  if (current) await current.close();
}
