import type { DashboardSnapshot, SyncResponse } from "@/lib/contracts";
import { TRACKS, type DashboardView, type SyncSummary } from "./types";

/** Only https://github.com/ URLs are ever rendered as links. */
export function safeUrl(u: unknown): string {
  return typeof u === "string" && /^https:\/\/github\.com\//i.test(u) ? u : "";
}

export function normalizeDashboard(s: DashboardSnapshot): DashboardView {
  const tracks = TRACKS.map((id) => {
    const t = (s.tracks ?? []).find((x) => x.id === id);
    return { id, name: t?.name ?? id, level: t?.level ?? 1, xp: t?.xp ?? 0, evidenceCount: t?.evidenceCount ?? 0 };
  });
  const evidenceById = new Map((s.evidence ?? []).map((e) => [e.id, e]));
  return {
    mode: s.source === "live" ? "live" : "demo", liveSyncAvailable: s.liveSyncAvailable, scope: s.scope, trackedRepositories: s.trackedRepositories ?? [],
    generatedAt: s.generatedAt, lastSyncedAt: s.lastSyncedAt ?? null,
    profile: { username: s.profile.username, displayName: s.profile.displayName || s.profile.username, avatarUrl: s.profile.avatarUrl ?? null },
    totalXp: s.progression.totalXp, level: s.progression.level, levelXp: s.progression.levelXp, nextLevelXp: Math.max(1, s.progression.nextLevelXp),
    rank: s.progression.rank, title: s.profile.title, titles: s.progression.titles ?? [], nextRankRequirement: s.progression.nextRankRequirement, scoringVersion: s.progression.scoringVersion,
    tracks,
    repositories: (s.repositories ?? []).map((r) => ({ slug: r.id, url: safeUrl(r.url) || `https://github.com/${r.id}`, description: r.description, xp: r.xp, evidenceCount: r.evidenceCount, coverage: r.coverage })),
    contributions: [...(s.evidence ?? [])].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).map((e) => ({
      id: e.id, kind: e.kind.replace("_", " "), title: e.title, url: safeUrl(e.url), repo: e.repositoryId, track: e.track, state: e.state, xp: e.xp, occurredAt: e.occurredAt, reason: e.reason,
    })),
    achievements: (s.achievements ?? []).map((a) => ({
      id: a.id, name: a.name, description: a.description, track: a.track, unlocked: a.unlockedAt !== null, unlockedAt: a.unlockedAt, progress: a.progress, target: Math.max(1, a.target),
      evidence: a.evidenceIds.map((id) => evidenceById.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e) && safeUrl(e?.url) !== "").map((e) => ({ label: e.title, url: e.url })),
      missingEvidence: a.evidenceIds.filter((id) => !evidenceById.get(id) || !safeUrl(evidenceById.get(id)?.url)).length,
    })),
    quests: (s.quests ?? []).map((q) => ({ id: q.id, title: q.title, description: q.description, track: q.track, progress: q.progress, target: Math.max(1, q.target), completed: q.completed, rewardXp: q.rewardXp })),
    warnings: s.warnings ?? [],
  };
}

export function normalizeSync(r: SyncResponse): { dashboard: DashboardView; summary: SyncSummary } {
  return { dashboard: normalizeDashboard(r.dashboard), summary: { imported: r.imported, unchanged: r.unchanged, partial: r.partial, warnings: r.warnings ?? [], retryAt: r.retryAt } };
}
