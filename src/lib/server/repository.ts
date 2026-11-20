import "server-only";
import type { ContributionEvidence, Profile, Repository, RepositoryCoverage } from "@/lib/contracts";
import { database, nowIso } from "./db";

type CoverageCheckpoint = Record<string, unknown> | null;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function saveProfile(profile: Omit<Profile, "title">): void {
  database().prepare(`
    INSERT INTO profiles (username, display_name, avatar_url, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = excluded.updated_at
  `).run(profile.username, profile.displayName, profile.avatarUrl, nowIso());
}

export function readProfile(username: string): Omit<Profile, "title"> | null {
  const row = database().prepare("SELECT username, display_name, avatar_url FROM profiles WHERE username = ?").get(username) as
    | { username: string; display_name: string; avatar_url: string | null }
    | undefined;
  if (!row) return null;
  return {
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? null,
  };
}

export function upsertRepository(repository: Pick<Repository, "id" | "owner" | "name" | "url" | "description">): void {
  database().prepare(`
    INSERT INTO repositories (id, owner, name, url, description)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner = excluded.owner,
      name = excluded.name,
      url = excluded.url,
      description = excluded.description
  `).run(repository.id, repository.owner, repository.name, repository.url, repository.description);
}

export function readRepositories(ids: string[]): Map<string, Pick<Repository, "id" | "owner" | "name" | "url" | "description">> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = database()
    .prepare(`SELECT id, owner, name, url, description FROM repositories WHERE id IN (${placeholders})`)
    .all(...ids) as Array<{ id: string; owner: string; name: string; url: string; description: string }>;
  return new Map(rows.map((row) => [row.id, row]));
}

export function resolveCanonicalRepositoryId(username: string, repositoryIdCandidate: string): string | null {
  const fromCoverage = database().prepare(`
    SELECT repository_id
    FROM coverage
    WHERE username = ? AND lower(repository_id) = lower(?)
    LIMIT 1
  `).get(username, repositoryIdCandidate) as { repository_id: string } | undefined;
  if (fromCoverage?.repository_id) return fromCoverage.repository_id;
  const fromRepos = database().prepare(`
    SELECT id
    FROM repositories
    WHERE lower(id) = lower(?)
    LIMIT 1
  `).get(repositoryIdCandidate) as { id: string } | undefined;
  return fromRepos?.id ?? null;
}

export function insertEvidence(username: string, evidence: ContributionEvidence[]): { imported: number; unchanged: number } {
  const insertOrUpdate = database().prepare(`
    INSERT INTO evidence (
      id, username, actor_login, actor_id, repository_id, kind, track, title, url, occurred_at, state, reason, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
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
  `);
  return runEvidenceInsert(username, evidence, insertOrUpdate);
}

function runEvidenceInsert(
  username: string,
  evidence: ContributionEvidence[],
  upsert: ReturnType<ReturnType<typeof database>["prepare"]>,
): { imported: number; unchanged: number } {
  const exists = database().prepare("SELECT id FROM evidence WHERE id = ? LIMIT 1");
  let imported = 0;
  let unchanged = 0;
  for (const item of evidence) {
    const present = Boolean(exists.get(item.id));
    upsert.run(
      item.id,
      username,
      item.actor.login,
      item.actor.id,
      item.repositoryId,
      item.kind,
      item.track,
      item.title,
      item.url,
      item.occurredAt,
      item.state,
      item.reason,
      nowIso(),
    );
    if (present) unchanged += 1;
    else imported += 1;
  }
  return { imported, unchanged };
}

export function persistEvidenceAndCoverage(
  username: string,
  evidence: ContributionEvidence[],
  coverage: RepositoryCoverage,
  checkpoint: Record<string, unknown> | null,
): { imported: number; unchanged: number } {
  const db = database();
  const evidenceStatement = db.prepare(`
    INSERT INTO evidence (
      id, username, actor_login, actor_id, repository_id, kind, track, title, url, occurred_at, state, reason, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
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
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    const counts = runEvidenceInsert(username, evidence, evidenceStatement);
    updateCoverage(coverage, checkpoint);
    db.exec("COMMIT");
    return counts;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function readEvidence(username: string): ContributionEvidence[] {
  const rows = database().prepare(`
    SELECT id, actor_login, actor_id, repository_id, kind, track, title, url, occurred_at, state, reason
    FROM evidence
    WHERE username = ?
    ORDER BY occurred_at DESC, id ASC
  `).all(username) as Array<{
    id: string;
    actor_login: string;
    actor_id: number;
    repository_id: string;
    kind: ContributionEvidence["kind"];
    track: ContributionEvidence["track"];
    title: string;
    url: string;
    occurred_at: string;
    state: ContributionEvidence["state"];
    reason: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    actor: { login: row.actor_login, id: row.actor_id },
    repositoryId: row.repository_id,
    kind: row.kind,
    track: row.track,
    title: row.title,
    url: row.url,
    occurredAt: row.occurred_at,
    state: row.state,
    xp: 0,
    reason: row.reason,
  }));
}

export function updateCoverage(coverage: RepositoryCoverage, checkpoint: CoverageCheckpoint): void {
  database().prepare(`
    INSERT INTO coverage (
      username, repository_id, requested_scope, supported_kinds_json, backfill_status, oldest_evidence_at, newest_evidence_at,
      last_attempt_at, last_successful_sync_at, covered_through, can_resume, limitations_json, failure_reason, retry_at, checkpoint_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username, repository_id) DO UPDATE SET
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
  `).run(
    coverage.username,
    coverage.repositoryId,
    coverage.requestedScope,
    JSON.stringify(coverage.supportedKinds),
    coverage.backfillStatus,
    coverage.oldestEvidenceAt,
    coverage.newestEvidenceAt,
    coverage.lastAttemptAt,
    coverage.lastSuccessfulSyncAt,
    coverage.coveredThrough,
    coverage.canResume ? 1 : 0,
    JSON.stringify(coverage.limitations),
    coverage.failureReason ?? null,
    coverage.retryAt ?? null,
    checkpoint ? JSON.stringify(checkpoint) : null,
  );
}

export function readCoverage(username: string, repositoryId: string): { coverage: RepositoryCoverage; checkpoint: CoverageCheckpoint } | null {
  const row = database().prepare(`
    SELECT *
    FROM coverage
    WHERE username = ? AND repository_id = ?
  `).get(username, repositoryId) as
    | {
      username: string;
      repository_id: string;
      requested_scope: RepositoryCoverage["requestedScope"];
      supported_kinds_json: string;
      backfill_status: RepositoryCoverage["backfillStatus"];
      oldest_evidence_at: string | null;
      newest_evidence_at: string | null;
      last_attempt_at: string | null;
      last_successful_sync_at: string | null;
      covered_through: string | null;
      can_resume: number;
      limitations_json: string;
      failure_reason: RepositoryCoverage["failureReason"] | null;
      retry_at: string | null;
      checkpoint_json: string | null;
    }
    | undefined;
  if (!row) return null;
  return {
    coverage: {
      username: row.username,
      repositoryId: row.repository_id,
      requestedScope: row.requested_scope,
      supportedKinds: parseJson(row.supported_kinds_json, []),
      backfillStatus: row.backfill_status,
      oldestEvidenceAt: row.oldest_evidence_at,
      newestEvidenceAt: row.newest_evidence_at,
      lastAttemptAt: row.last_attempt_at,
      lastSuccessfulSyncAt: row.last_successful_sync_at,
      coveredThrough: row.covered_through,
      canResume: row.can_resume === 1,
      limitations: parseJson(row.limitations_json, []),
      failureReason: row.failure_reason ?? undefined,
      retryAt: row.retry_at ?? undefined,
    },
    checkpoint: parseJson<CoverageCheckpoint>(row.checkpoint_json, null),
  };
}

export function readCoverageForUser(username: string): RepositoryCoverage[] {
  const rows = database().prepare("SELECT * FROM coverage WHERE username = ? ORDER BY repository_id ASC").all(username) as Array<{
    username: string;
    repository_id: string;
    requested_scope: RepositoryCoverage["requestedScope"];
    supported_kinds_json: string;
    backfill_status: RepositoryCoverage["backfillStatus"];
    oldest_evidence_at: string | null;
    newest_evidence_at: string | null;
    last_attempt_at: string | null;
    last_successful_sync_at: string | null;
    covered_through: string | null;
    can_resume: number;
    limitations_json: string;
    failure_reason: RepositoryCoverage["failureReason"] | null;
    retry_at: string | null;
  }>;
  return rows.map((row) => ({
    username: row.username,
    repositoryId: row.repository_id,
    requestedScope: row.requested_scope,
    supportedKinds: parseJson(row.supported_kinds_json, []),
    backfillStatus: row.backfill_status,
    oldestEvidenceAt: row.oldest_evidence_at,
    newestEvidenceAt: row.newest_evidence_at,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    coveredThrough: row.covered_through,
    canResume: row.can_resume === 1,
    limitations: parseJson(row.limitations_json, []),
    failureReason: row.failure_reason ?? undefined,
    retryAt: row.retry_at ?? undefined,
  }));
}

export function upsertSyncState(
  username: string | null,
  lastSyncedAt: string | null,
  warnings: string[],
  selectedRepositories: string[],
): void {
  database().prepare(`
    INSERT INTO sync_state (id, username, last_synced_at, last_attempt_at, warnings_json, selected_repositories_json)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      last_synced_at = excluded.last_synced_at,
      last_attempt_at = excluded.last_attempt_at,
      warnings_json = excluded.warnings_json,
      selected_repositories_json = excluded.selected_repositories_json
  `).run(username, lastSyncedAt, nowIso(), JSON.stringify(warnings), JSON.stringify(selectedRepositories));
}

export function readSyncState(): { username: string | null; lastSyncedAt: string | null; warnings: string[]; selectedRepositories: string[] } {
  const row = database().prepare("SELECT username, last_synced_at, warnings_json, selected_repositories_json FROM sync_state WHERE id = 1").get() as
    | { username: string | null; last_synced_at: string | null; warnings_json: string; selected_repositories_json: string | null }
    | undefined;
  if (!row) return { username: null, lastSyncedAt: null, warnings: [], selectedRepositories: [] };
  return {
    username: row.username,
    lastSyncedAt: row.last_synced_at,
    warnings: parseJson(row.warnings_json, []),
    selectedRepositories: parseJson(row.selected_repositories_json, []),
  };
}
