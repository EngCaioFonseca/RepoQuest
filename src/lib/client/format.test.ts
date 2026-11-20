import { describe, expect, it } from "vitest";
import { GLOBAL, scopeMatches, scopeQuery } from "./scope";
import { describeCoverage } from "./coverage";
import { formatDate, isValidSlug, isValidUsername, percent } from "./format";
import { normalizeDashboard, safeUrl } from "./normalize";
import type { DashboardSnapshot } from "@/lib/contracts";

const cov = { username: "u", repositoryId: "a/b", requestedScope: "all_accessible_history" as const, supportedKinds: [], backfillStatus: "partial" as const, oldestEvidenceAt: null, newestEvidenceAt: null, lastAttemptAt: null, lastSuccessfulSyncAt: null, coveredThrough: null, canResume: true, limitations: [] };
const snap = (over: Partial<DashboardSnapshot> = {}): DashboardSnapshot => ({
  source: "live", liveSyncAvailable: true, scope: { kind: "global" }, trackedRepositories: ["a/b"], generatedAt: "2026-01-01T00:00:00Z", lastSyncedAt: null,
  profile: { username: "u", displayName: "", avatarUrl: null, title: "T" },
  progression: { scoringVersion: "1", totalXp: 5, level: 1, rank: "E", levelXp: 5, nextLevelXp: 100, titles: [], nextRankRequirement: null },
  tracks: [], repositories: [{ id: "a/b", owner: "a", name: "b", url: "https://github.com/a/b", description: "", xp: 0, evidenceCount: 0, coverage: cov }],
  evidence: [{ id: "e1", actor: { login: "u", id: 1 }, repositoryId: "a/b", kind: "pull_request", track: "engineering", title: "x", url: "javascript:alert(1)", occurredAt: "2020-01-01T00:00:00Z", state: "merged", xp: 3, reason: "r" }],
  achievements: [{ id: "g", name: "G", description: "", icon: "", track: "general", progress: 1, target: 1, unlockedAt: "2020-01-02T00:00:00Z", evidenceIds: ["e1", "gone"] }], quests: [], warnings: [], ...over,
});

describe("client helpers", () => {
  it("validates slugs and usernames", () => {
    expect(isValidSlug("oss-aspen/8Knot")).toBe(true);
    expect(isValidSlug("chaoss/CollectOSS")).toBe(true);
    expect(isValidSlug("nope")).toBe(false);
    expect(isValidSlug("a/b/c")).toBe(false);
    expect(isValidUsername("octocat")).toBe(true);
    expect(isValidUsername("-bad")).toBe(false);
  });
  it("matches the shared schema on edge cases the old regexes accepted", () => {
    for (const bad of ["bad--name/repo", "bad-/repo", "a-/b", "a/..", "a/.", "https://github.com/a/b"]) expect(isValidSlug(bad), bad).toBe(false);
    for (const bad of ["bad--name", "bad-", "-bad", "", "a b"]) expect(isValidUsername(bad), bad).toBe(false);
    expect(isValidSlug("Oss-Aspen/8Knot")).toBe(true);
  });
  it("clamps percent and formats dates", () => {
    expect(percent(5, 0)).toBe(0);
    expect(percent(150, 100)).toBe(100);
    expect(formatDate("2026-01-02T03:04:05Z")).toBe("2026-01-02");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("garbage")).toBe("—");
  });
  it("only accepts http(s) links and keeps original dates", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("http://github.com/a/b")).toBe("");
    expect(safeUrl("https://evil.example/a")).toBe("");
    expect(safeUrl("https://github.com/a/b/pull/1")).not.toBe("");
    const v = normalizeDashboard(snap());
    expect(v.contributions[0].occurredAt).toBe("2020-01-01T00:00:00Z");
    expect(v.achievements[0].evidence).toEqual([]);
    expect(v.achievements[0].missingEvidence).toBe(2);
    expect(v.liveSyncAvailable).toBe(true);
    expect(v.tracks).toHaveLength(3);
    expect(v.mode).toBe("live");
  });
  it("never calls partial or failed coverage zero activity", () => {
    expect(describeCoverage({ ...cov, backfillStatus: "partial" }).tone).toBe("warn");
    expect(describeCoverage({ ...cov, backfillStatus: "failed" }).detail).toMatch(/not evidence of zero/);
    expect(describeCoverage({ ...cov, backfillStatus: "empty" }).label).toBe("No activity found");
  });
  it("builds the scope query and refuses mismatched scopes", () => {
    expect(scopeQuery(GLOBAL)).toBe("");
    expect(scopeQuery({ kind: "repository", repositoryId: "chaoss/8Knot" })).toBe("?repository=chaoss%2F8Knot");
    const g = normalizeDashboard(snap());
    const r = normalizeDashboard(snap({ scope: { kind: "repository", repositoryId: "Chaoss/8Knot" } }));
    expect(scopeMatches(GLOBAL, g)).toBe(true);
    expect(scopeMatches(GLOBAL, r)).toBe(false);
    expect(scopeMatches({ kind: "repository", repositoryId: "chaoss/8knot" }, r)).toBe(true);
    expect(scopeMatches({ kind: "repository", repositoryId: "chaoss/8knot" }, g)).toBe(false);
    expect(scopeMatches({ kind: "repository", repositoryId: "chaoss/collectoss" }, r)).toBe(false);
  });
});
