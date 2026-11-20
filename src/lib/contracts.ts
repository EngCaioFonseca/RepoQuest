/**
 * Public, JSON-safe API contract. No credentials or private contribution details.
 * GET /api/dashboard[?repository=owner%2Frepo] -> DashboardSnapshot
 * POST /api/sync (SyncRequest) -> SyncResponse or ApiError
 * GET /api/share[?repository=owner%2Frepo] -> image/svg+xml (same scope rules)
 * Dates are ISO-8601 strings; GitHub identities and slugs are case-insensitive.
 */
import { z } from "zod";

export type DataSource = "demo" | "live";
export type SkillTrack = "engineering" | "documentation" | "review";
export type Rank = "E" | "D" | "C" | "B" | "A" | "S";
export type EvidenceKind = "pull_request" | "issue" | "review";

/** Read-only view scope; global means the contributor's tracked repositories. */
export type DashboardScope =
  | { kind: "global" }
  | { kind: "repository"; repositoryId: string };

export interface Profile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  title: string;
}

export interface Progression {
  scoringVersion: string;
  totalXp: number;
  level: number;
  rank: Rank;
  /** XP earned within this level, and XP needed to complete this level. */
  levelXp: number;
  nextLevelXp: number;
  titles: string[];
  /** Human-readable milestone still needed for the next rank; null at S. */
  nextRankRequirement: string | null;
}

export interface TrackProgress {
  id: SkillTrack;
  name: string;
  xp: number;
  level: number;
  evidenceCount: number;
}

export interface Repository {
  /** Canonical owner/name slug, e.g. chaoss/8Knot. */
  id: string;
  owner: string;
  name: string;
  url: string;
  description: string;
  xp: number;
  evidenceCount: number;
  coverage: RepositoryCoverage;
}

export interface RepositoryCoverage {
  /** Coverage and checkpoints belong to this contributor/repository pair. */
  username: string;
  repositoryId: string;
  requestedScope: "all_accessible_history";
  supportedKinds: EvidenceKind[];
  backfillStatus: "not_started" | "in_progress" | "partial" | "complete" | "empty" | "failed";
  /** Original contribution dates, never the time an import happened. */
  oldestEvidenceAt: string | null;
  newestEvidenceAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  /** Full supported history was scanned up to this time; null if incomplete. */
  coveredThrough: string | null;
  /** Server keeps opaque pagination checkpoints; client only needs this flag. */
  canResume: boolean;
  /** API caps, permission gaps, unsupported history, or interrupted pages. */
  limitations: string[];
  failureReason?: "rate_limited" | "permission_denied" | "api_limit" | "network_error" | "provider_error" | "interrupted";
  /** ISO-8601 retry time for this repository, when known. */
  retryAt?: string;
}

export interface ContributionEvidence {
  /** Stable provider identity, NOT an array index or import timestamp. */
  id: string;
  /** GitHub actor who performed the action, not the PR author for reviews. */
  actor: { login: string; id: number };
  repositoryId: string;
  kind: EvidenceKind;
  track: SkillTrack;
  title: string;
  url: string;
  occurredAt: string;
  state: "open" | "closed" | "merged" | "submitted";
  xp: number;
  /** Explains the scoring decision; source evidence is persisted separately. */
  reason: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  track: SkillTrack | "general";
  progress: number;
  target: number;
  unlockedAt: string | null;
  /** Actual qualifying evidence identities; never infer these from track alone. */
  evidenceIds: string[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  track: SkillTrack;
  repositoryId: string | null;
  progress: number;
  target: number;
  completed: boolean;
  /** Suggested effort only; no XP is granted until evidence is imported. */
  rewardXp: number;
}

export interface DashboardSnapshot {
  source: DataSource;
  /** All character values, evidence and coverage below use this scope. */
  scope: DashboardScope;
  /** All tracked canonical slugs for the view selector, independent of scope. */
  trackedRepositories: string[];
  /** Whether the server has credentials configured; never exposes the token. */
  liveSyncAvailable: boolean;
  generatedAt: string;
  lastSyncedAt: string | null;
  /** Identity is unchanged by scope; profile.title is derived within scope. */
  profile: Profile;
  progression: Progression;
  /** Exactly one entry for each of engineering, documentation, review. */
  tracks: TrackProgress[];
  /** All tracked realms in global scope; only the selected realm in local scope. */
  repositories: Repository[];
  evidence: ContributionEvidence[];
  achievements: Achievement[];
  quests: Quest[];
  /** Partial imports and provider limitations must remain visible. */
  warnings: string[];
}

const githubLogin = /^(?!.*--)[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const repositorySlug = /^(?![^/]*--)[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d._-]{1,100}$/i;
const repositorySlugSchema = z.string().trim()
  .regex(repositorySlug, "Use an owner/repository slug, not a URL.")
  .refine((value) => ![".", ".."].includes(value.split("/")[1]), "Invalid repository name.")
  .toLowerCase();

/**
 * Shared GET dashboard/share query schema: {} -> global, {repository} -> local.
 * Routes reject duplicate query keys before parsing; unknown keys are rejected.
 * Resolve casing against stored tracked slugs, without GitHub calls or writes.
 * Invalid input -> 400; valid but untracked repository -> 404 repository_not_tracked.
 */
export const dashboardScopeQuerySchema = z.object({
  repository: repositorySlugSchema.optional(),
}).strict().transform(({ repository }): DashboardScope => repository === undefined
  ? { kind: "global" }
  : { kind: "repository", repositoryId: repository });

export type DashboardScopeQuery = z.input<typeof dashboardScopeQuerySchema>;

/** Shared runtime validation; public visibility is checked by the server. */
export const syncRequestSchema = z.object({
  username: z.string().trim().regex(githubLogin, "Enter a valid GitHub username.").toLowerCase(),
  repositories: z.array(repositorySlugSchema)
    .min(1).max(10).transform((repositories) => [...new Set(repositories)]),
}).strict();

export type SyncRequest = z.infer<typeof syncRequestSchema>;

export interface SyncResponse {
  /** Always global for compatibility; a local view refetches its GET after sync. */
  dashboard: DashboardSnapshot;
  imported: number;
  /** Existing stable evidence identities that did not earn XP again. */
  unchanged: number;
  /** True when at least one requested source could not be fully imported. */
  partial: boolean;
  warnings: string[];
  /** Optional reset time when a partial import encountered a rate limit. */
  retryAt?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    /** Optional ISO-8601 reset time, safe to show to the user. */
    retryAt?: string;
    fields?: Record<string, string>;
  };
}

export const DEFAULT_REPOSITORIES = ["chaoss/8Knot", "chaoss/CollectOSS"] as const;
export const SKILL_TRACKS: readonly SkillTrack[] = [
  "engineering",
  "documentation",
  "review",
];
