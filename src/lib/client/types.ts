// Client view-model derived from src/lib/contracts.ts by normalize.ts.
import type { DashboardScope, Rank, RepositoryCoverage, SkillTrack } from "@/lib/contracts";
export type { Rank, SkillTrack as Track, RepositoryCoverage };
export const TRACKS: SkillTrack[] = ["engineering", "documentation", "review"];

export interface TrackView { id: SkillTrack; name: string; level: number; xp: number; evidenceCount: number }
export interface RepoView { slug: string; url: string; description: string; xp: number; evidenceCount: number; coverage: RepositoryCoverage }
export interface ContributionView { id: string; kind: string; title: string; url: string; repo: string; track: SkillTrack; state: string; xp: number; occurredAt: string; reason: string }
export interface AchievementView { id: string; name: string; description: string; track: string; unlocked: boolean; unlockedAt: string | null; progress: number; target: number; evidence: { label: string; url: string }[]; missingEvidence: number }
export interface QuestView { id: string; title: string; description: string; track: SkillTrack; progress: number; target: number; completed: boolean; rewardXp: number }

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
  warnings: string[];
}

export interface SyncSummary { imported: number; unchanged: number; partial: boolean; warnings: string[]; retryAt?: string }

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public retryAt?: string, public fields?: Record<string, string>) { super(message); }
}
