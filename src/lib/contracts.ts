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
export type CharacterClassId = "adventurer" | "healer" | "warrior" | "mage" | "scribe" | "guardian";
export type CharacterClassState = "provisional" | "specialized" | "hybrid" | "ambiguous";
export type TechnicalSpecialtyId = "general" | "backend" | "frontend" | "ai" | "systems" | "qa";
export type AiToolUsage = "unspecified" | "none" | "occasional" | "frequent" | "ai_first";
export type MageWorkflowLevel = "prompting" | "single_agent" | "multi_agent" | "agent_systems";
export type MageEngineeringLevel = "prompting" | "integrating" | "building" | "operating";
export type MageVerificationLevel = "manual" | "automated_tests" | "evaluations" | "continuous";
export type MagePathId = "prompt_adept" | "agent_weaver" | "orchestrator" | "agents_monarch" | "intelligence_monarch";
export type MasteryDisciplineId = "backend" | "frontend" | "ai" | "systems" | "qa" | "documentation" | "review";

/** Read-only view scope; global means the contributor's tracked repositories. */
export type DashboardScope =
  | { kind: "global" }
  | { kind: "repository"; repositoryId: string };

export interface Profile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Progression-earned title only, never self-reported additions. */
  title: string;
  /** UI-ready presentation title; may append self-reported class add-ons. */
  displayTitle: string;
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

export type QuestTrack = SkillTrack | "general";
export type RelicRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** A collectible earned by completing a quest. Cosmetic: it never adds XP or changes rank E–S. */
export interface Relic {
  id: string;
  name: string;
  icon: string;
  rarity: RelicRarity;
  description: string;
}

export interface Quest {
  id: string;
  /** Questline this quest belongs to; the next tier appears as soon as this one completes. */
  chainId: string;
  /** 1-based position in the questline. Monthly bounties use 1. */
  tier: number;
  title: string;
  description: string;
  track: QuestTrack;
  repositoryId: string | null;
  progress: number;
  target: number;
  completed: boolean;
  /** Suggested effort only; no XP is granted until evidence is imported. */
  rewardXp: number;
  reward: Relic;
  /** Why this quest is suggested next, or null. */
  recommendation: string | null;
  /** ISO-8601 end of a time-limited quest (monthly bounty), else null. */
  endsAt: string | null;
}

export interface CompletedQuest {
  id: string;
  chainId: string;
  tier: number;
  title: string;
  description: string;
  track: QuestTrack;
  target: number;
  /** Original date of the evidence that completed the quest. */
  completedAt: string;
  /** Character level right after the completing evidence was credited. */
  levelAtCompletion: number;
  evidenceIds: string[];
  reward: Relic;
}

export interface Renown {
  points: number;
  rank: string;
  nextRank: string | null;
  nextRankPoints: number | null;
}

/** Quest history, derived deterministically from evidence; nothing here is stored. */
export interface QuestLog {
  completed: CompletedQuest[];
  renown: Renown;
}

export interface CharacterClassSpecialty {
  id: TechnicalSpecialtyId;
  label: string;
  explanation: string;
  evidenceIds: string[];
}

export interface CharacterClass {
  id: CharacterClassId;
  name: string;
  summary: string;
  state: CharacterClassState;
  mix: Array<{
    classId: CharacterClassId;
    share: number;
    evidenceCount: number;
    evidenceIds: string[];
  }>;
  specialties: CharacterClassSpecialty[];
  basis: {
    classifierVersion: string;
    qualifyingEvidenceCount: number;
    consideredEvidenceIds: string[];
    rejectedEvidenceIds: string[];
    assignments: Array<{
      evidenceId: string;
      classId: CharacterClassId;
      reason: string;
    }>;
  };
  classificationLimits: string[];
}

export interface ContributorClassPreference {
  isAiEngineer: boolean;
  aiToolUsage: AiToolUsage;
  mageActive: boolean;
  mageQuiz: MageQuizAnswers | null;
  magePath: MagePath | null;
  /** Demo snapshots do not represent a live identity and should not be editable. */
  editable: boolean;
}

export interface MasteryDisciplineProgress {
  id: MasteryDisciplineId;
  title: string;
  track: SkillTrack;
  rankGate: { required: Rank; met: boolean };
  contributionGate: { required: number; current: number; remaining: number };
  monthGate: { required: number; current: number; remaining: number };
  unlockedAt: string | null;
  evidenceIds: string[];
}

export interface MasteryProgress {
  version: string;
  disciplines: MasteryDisciplineProgress[];
}

export interface MageQuizAnswers {
  workflow: MageWorkflowLevel;
  engineering: MageEngineeringLevel;
  verification: MageVerificationLevel;
}

export interface MagePath {
  id: MagePathId;
  name: string;
  summary: string;
  explanation: string;
  classifierVersion: string;
  selfReported: true;
}

/** Where this server keeps player state. Never exposes paths or connection strings. */
export interface StorageStatus {
  /** `memory` discards everything when the server stops; `file` is the local SQLite database. */
  local: "memory" | "file";
  /** `off` when cloud save is not configured; `error` when it is misconfigured or the last save/restore failed. */
  cloudSave: "off" | "ready" | "error";
  /** `gist` saves to a secret GitHub Gist owned by the token user. */
  cloudBackend: "gist" | null;
  /** Safe, user-facing reason for an `error` state. */
  cloudProblem: string | null;
  lastCloudSaveAt: string | null;
  restoredFromCloud: boolean;
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
  questLog: QuestLog;
  characterClass: CharacterClass;
  classPreference: ContributorClassPreference;
  mastery: MasteryProgress;
  /** Partial imports and provider limitations must remain visible. */
  warnings: string[];
  storage?: StorageStatus;
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

export const profilePreferencePatchSchema = z.object({
  isAiEngineer: z.boolean(),
  aiToolUsage: z.enum(["unspecified", "none", "occasional", "frequent", "ai_first"]),
  mageQuiz: z.object({
    workflow: z.enum(["prompting", "single_agent", "multi_agent", "agent_systems"]),
    engineering: z.enum(["prompting", "integrating", "building", "operating"]),
    verification: z.enum(["manual", "automated_tests", "evaluations", "continuous"]),
  }).strict().nullable().optional(),
}).strict();
export type ProfilePreferencePatch = z.infer<typeof profilePreferencePatchSchema>;

export const profilePreferenceUpdateRequestSchema = z.object({
  username: z.string().trim().regex(githubLogin, "Enter a valid GitHub username.").toLowerCase(),
  preference: profilePreferencePatchSchema,
}).strict();
export type ProfilePreferenceUpdateRequest = z.infer<typeof profilePreferenceUpdateRequestSchema>;

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
