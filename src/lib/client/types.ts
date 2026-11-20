// Client view-model derived from src/lib/contracts.ts by normalize.ts.
import { SKILL_TRACKS, type AiToolUsage, CharacterClassId, CharacterClassState, ContributorClassPreference, DashboardScope, MasteryDisciplineProgress, QuestTrack, Rank, Relic, Renown, RepositoryCoverage, SkillTrack, StorageStatus } from "@/lib/contracts";
export type { QuestTrack, Relic, Renown };
export type { Rank, SkillTrack as Track, RepositoryCoverage };
export const TRACKS = SKILL_TRACKS;

export interface TrackView { id: SkillTrack; name: string; level: number; xp: number; evidenceCount: number }
export interface RepoView { slug: string; url: string; description: string; xp: number; evidenceCount: number; coverage: RepositoryCoverage }
export interface ContributionView { id: string; kind: string; title: string; url: string; repo: string; track: SkillTrack; state: string; xp: number; occurredAt: string; reason: string }
export interface AchievementView { id: string; name: string; description: string; track: string; unlocked: boolean; unlockedAt: string | null; progress: number; target: number; evidence: { label: string; url: string }[]; missingEvidence: number }
export interface QuestView { id: string; chainId: string; tier: number; title: string; description: string; track: QuestTrack; progress: number; target: number; completed: boolean; rewardXp: number; reward: Relic; recommendation: string | null; endsAt: string | null }
export interface CompletedQuestView { id: string; chainId: string; tier: number; title: string; description: string; track: QuestTrack; target: number; completedAt: string; levelAtCompletion: number; reward: Relic; evidence: { label: string; url: string }[]; missingEvidence: number }
export interface QuestLogView { completed: CompletedQuestView[]; renown: Renown }

export interface DashboardView {
  mode: "demo" | "live";
  liveSyncAvailable: boolean;
  scope: DashboardScope;
  trackedRepositories: string[];
  generatedAt: string;
  lastSyncedAt: string | null;
  profile: { username: string; displayName: string; avatarUrl: string | null };
  totalXp: number; level: number; levelXp: number; nextLevelXp: number;
  rank: Rank; title: string; titles: string[]; nextRankRequirement: string | null; scoringVersion: string;
  tracks: TrackView[];
  repositories: RepoView[];
  contributions: ContributionView[];
  achievements: AchievementView[];
  quests: QuestView[];
  questLog: QuestLogView;
  characterClass: ClassView | null;
  /** Earned title only; `title` above is the display title that may append the self-reported Mage badge. */
  earnedTitle: string;
  preference: PreferenceView;
  mastery: MasteryView[];
  warnings: string[];
  storage: StorageStatus | null;
}

/** A scoped evidence item that backs a class or specialty claim. Only items present in the snapshot's evidence appear. */
export interface ClassEvidenceView { id: string; title: string; url: string; reason?: string }
export type MasteryView = Omit<MasteryDisciplineProgress, "evidenceIds"> & { evidence: ClassEvidenceView[]; unlinked: number };
export interface ClassView {
  id: CharacterClassId; name: string; summary: string; state: CharacterClassState;
  mix: { classId: CharacterClassId; share: number; evidenceCount: number; evidence: ClassEvidenceView[]; unlinked: number }[];
  specialties: { id: string; label: string; explanation: string; evidence: ClassEvidenceView[]; unlinked: number }[];
  qualifying: number; rejected: number; classifierVersion: string; limits: string[];
}

/** Self-reported, never inferred from evidence. Does not affect XP, rank or the contribution class. */
export type PreferenceView = ContributorClassPreference;
export const AI_USAGE_LABELS: Record<AiToolUsage, string> = { unspecified: "Not specified", none: "None", occasional: "Occasional", frequent: "Frequent", ai_first: "AI-first" };

export interface SyncSummary { imported: number; unchanged: number; partial: boolean; warnings: string[]; retryAt?: string }

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public retryAt?: string, public fields?: Record<string, string>) { super(message); }
}
