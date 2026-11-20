import "server-only";
import postgres from "postgres";
import {
  COVERAGE_COLUMNS,
  EVIDENCE_COLUMNS,
  REPOSITORY_COLUMNS,
  playerSaveSchema,
  type CloudBackend,
  type PlayerSave,
} from "./cloud-save";

/**
 * Bring-your-own Postgres backend (for example a free Neon project), selected
 * with CLOUD_DATABASE_URL. Rows are upserted in one transaction; evidence is a
 * union by ID and coverage only moves forward, so several installs can save.
 */

const CHUNK_SIZE = 500;

const CLOUD_SCHEMA_SQL = `
  CREATE SCHEMA IF NOT EXISTS repoquest;

  CREATE TABLE IF NOT EXISTS repoquest.players (
    username TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    is_ai_engineer BOOLEAN NOT NULL DEFAULT FALSE,
    ai_tool_usage TEXT NOT NULL DEFAULT 'unspecified',
    mage_quiz_json TEXT,
    profile_updated_at TEXT NOT NULL,
    has_sync_state BOOLEAN NOT NULL DEFAULT FALSE,
    selected_repositories_json TEXT NOT NULL DEFAULT '[]',
    last_synced_at TEXT,
    warnings_json TEXT NOT NULL DEFAULT '[]',
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS repoquest.repositories (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS repoquest.coverage (
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
    can_resume BOOLEAN NOT NULL DEFAULT FALSE,
    limitations_json TEXT NOT NULL DEFAULT '[]',
    failure_reason TEXT,
    retry_at TEXT,
    checkpoint_json TEXT,
    PRIMARY KEY (username, repository_id)
  );

  CREATE TABLE IF NOT EXISTS repoquest.evidence (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    actor_login TEXT NOT NULL,
    actor_id BIGINT NOT NULL,
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

  CREATE INDEX IF NOT EXISTS idx_evidence_username ON repoquest.evidence(username);
`;

type CloudValue = string | number | boolean | null;
type Row = Record<string, CloudValue>;

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += CHUNK_SIZE) result.push(items.slice(index, index + CHUNK_SIZE));
  return result;
}

function rows<T extends object>(items: T[]): Row[] {
  return items as unknown as Row[];
}

export function createPostgresBackend(): CloudBackend {
  const url = process.env.CLOUD_DATABASE_URL?.trim() ?? "";
  // prepare: false keeps pooled (PgBouncer) Neon endpoints working.
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    schemaReady ??= sql.unsafe(CLOUD_SCHEMA_SQL).simple().then(() => undefined);
    try {
      await schemaReady;
    } catch (error) {
      schemaReady = null;
      throw error;
    }
  }

  return {
    kind: "postgres",

    async loadLatest(): Promise<PlayerSave | null> {
      await ensureSchema();
      const [player] = await sql<Row[]>`SELECT * FROM repoquest.players ORDER BY saved_at DESC LIMIT 1`;
      if (!player) return null;
      const username = player.username as string;
      const coverage = await sql<Row[]>`SELECT * FROM repoquest.coverage WHERE username = ${username} ORDER BY repository_id`;
      const evidence = await sql<Row[]>`SELECT * FROM repoquest.evidence WHERE username = ${username} ORDER BY id`;
      const repositories = await sql<Row[]>`
        SELECT * FROM repoquest.repositories WHERE id IN (
          SELECT repository_id FROM repoquest.coverage WHERE username = ${username}
          UNION SELECT repository_id FROM repoquest.evidence WHERE username = ${username}
        ) ORDER BY id
      `;
      const only = (row: Row, columns: readonly string[]) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
      return playerSaveSchema.parse({
        format: "repoquest-save",
        version: 1,
        savedAt: new Date(player.saved_at as unknown as string).toISOString(),
        profile: {
          username,
          display_name: player.display_name,
          avatar_url: player.avatar_url,
          is_ai_engineer: player.is_ai_engineer,
          ai_tool_usage: player.ai_tool_usage,
          mage_quiz_json: player.mage_quiz_json,
          updated_at: player.profile_updated_at,
        },
        syncState: player.has_sync_state
          ? {
            selected_repositories_json: player.selected_repositories_json,
            last_synced_at: player.last_synced_at,
            warnings_json: player.warnings_json,
          }
          : null,
        repositories: repositories.map((row) => only(row, REPOSITORY_COLUMNS)),
        coverage: coverage.map((row) => only(row, COVERAGE_COLUMNS)),
        // BIGINT arrives as a string; GitHub user IDs fit in a JS number.
        evidence: evidence.map((row) => ({ ...only(row, EVIDENCE_COLUMNS), actor_id: Number(row.actor_id) })),
      });
    },

    async store(save: PlayerSave): Promise<void> {
      await ensureSchema();
      const hasSyncState = save.syncState !== null;
      const player: Row = {
        username: save.profile.username,
        display_name: save.profile.display_name,
        avatar_url: save.profile.avatar_url,
        is_ai_engineer: save.profile.is_ai_engineer,
        ai_tool_usage: save.profile.ai_tool_usage,
        mage_quiz_json: save.profile.mage_quiz_json,
        profile_updated_at: save.profile.updated_at,
        has_sync_state: hasSyncState,
        selected_repositories_json: save.syncState?.selected_repositories_json ?? "[]",
        last_synced_at: save.syncState?.last_synced_at ?? null,
        warnings_json: save.syncState?.warnings_json ?? "[]",
      };
      await sql.begin(async (tx) => {
        // Keep the stored sync selection when this install has not synced the player itself.
        await tx`
          INSERT INTO repoquest.players ${tx(player)}
          ON CONFLICT (username) DO UPDATE SET
            display_name = excluded.display_name,
            avatar_url = excluded.avatar_url,
            is_ai_engineer = excluded.is_ai_engineer,
            ai_tool_usage = excluded.ai_tool_usage,
            mage_quiz_json = excluded.mage_quiz_json,
            profile_updated_at = excluded.profile_updated_at,
            has_sync_state = excluded.has_sync_state OR repoquest.players.has_sync_state,
            selected_repositories_json = CASE WHEN excluded.has_sync_state THEN excluded.selected_repositories_json ELSE repoquest.players.selected_repositories_json END,
            last_synced_at = CASE WHEN excluded.has_sync_state THEN excluded.last_synced_at ELSE repoquest.players.last_synced_at END,
            warnings_json = CASE WHEN excluded.has_sync_state THEN excluded.warnings_json ELSE repoquest.players.warnings_json END,
            saved_at = now()
        `;
        for (const batch of chunks(rows(save.repositories))) {
          await tx`
            INSERT INTO repoquest.repositories ${tx(batch, ...REPOSITORY_COLUMNS)}
            ON CONFLICT (id) DO UPDATE SET
              owner = excluded.owner, name = excluded.name, url = excluded.url, description = excluded.description
          `;
        }
        for (const batch of chunks(rows(save.coverage))) {
          // Another install may have synced more recently; never move a repository's progress backwards.
          await tx`
            INSERT INTO repoquest.coverage ${tx(batch, ...COVERAGE_COLUMNS)}
            ON CONFLICT (username, repository_id) DO UPDATE SET
              requested_scope = excluded.requested_scope,
              supported_kinds_json = excluded.supported_kinds_json,
              backfill_status = excluded.backfill_status,
              oldest_evidence_at = excluded.oldest_evidence_at,
              newest_evidence_at = excluded.newest_evidence_at,
              last_attempt_at = excluded.last_attempt_at,
              last_successful_sync_at = excluded.last_successful_sync_at,
              covered_through = excluded.covered_through,
              can_resume = excluded.can_resume,
              limitations_json = excluded.limitations_json,
              failure_reason = excluded.failure_reason,
              retry_at = excluded.retry_at,
              checkpoint_json = excluded.checkpoint_json
            WHERE coalesce(excluded.last_attempt_at, '') >= coalesce(repoquest.coverage.last_attempt_at, '')
          `;
        }
        for (const batch of chunks(rows(save.evidence))) {
          // Evidence IDs are stable provider IDs, so saves from several installs merge as a union.
          await tx`
            INSERT INTO repoquest.evidence ${tx(batch, ...EVIDENCE_COLUMNS)}
            ON CONFLICT (id) DO UPDATE SET
              username = excluded.username,
              actor_login = excluded.actor_login,
              actor_id = excluded.actor_id,
              repository_id = excluded.repository_id,
              kind = excluded.kind,
              track = excluded.track,
              title = excluded.title,
              url = excluded.url,
              occurred_at = excluded.occurred_at,
              state = excluded.state,
              reason = excluded.reason
          `;
        }
      });
    },

    async close(): Promise<void> {
      await sql.end({ timeout: 5 });
    },
  };
}
