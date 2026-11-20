import { describe, expect, it, vi } from "vitest";
import { savePreference } from "./api";
import { AI_USAGE_LABELS } from "./types";
import { AI_TOOL_USAGE_VALUES, deriveDisplayTitle, withMagePreference } from "@/lib/domain/classes";
import { GLOBAL, scopeMatches, scopeQuery } from "./scope";
import { describeCoverage } from "./coverage";
import { formatDate, isValidSlug, isValidUsername, percent } from "./format";
import { normalizeDashboard, safeUrl } from "./normalize";
import type { DashboardSnapshot } from "@/lib/contracts";

const cov = { username: "u", repositoryId: "a/b", requestedScope: "all_accessible_history" as const, supportedKinds: [], backfillStatus: "partial" as const, oldestEvidenceAt: null, newestEvidenceAt: null, lastAttemptAt: null, lastSuccessfulSyncAt: null, coveredThrough: null, canResume: true, limitations: [] };
const snap = (over: Partial<DashboardSnapshot> = {}): DashboardSnapshot => ({
  source: "live", liveSyncAvailable: true, scope: { kind: "global" }, trackedRepositories: ["a/b"], generatedAt: "2026-01-01T00:00:00Z", lastSyncedAt: null,
  profile: { username: "u", displayName: "", avatarUrl: null, title: "T", displayTitle: "T" },
  progression: { scoringVersion: "1", totalXp: 5, level: 1, rank: "E", levelXp: 5, nextLevelXp: 100, titles: [], nextRankRequirement: null },
  tracks: [], repositories: [{ id: "a/b", owner: "a", name: "b", url: "https://github.com/a/b", description: "", xp: 0, evidenceCount: 0, coverage: cov }],
  evidence: [{ id: "e1", actor: { login: "u", id: 1 }, repositoryId: "a/b", kind: "pull_request", track: "engineering", title: "x", url: "javascript:alert(1)", occurredAt: "2020-01-01T00:00:00Z", state: "merged", xp: 3, reason: "r" }],
  achievements: [{ id: "g", name: "G", description: "", icon: "", track: "general", progress: 1, target: 1, unlockedAt: "2020-01-02T00:00:00Z", evidenceIds: ["e1", "gone"] }], quests: [],
  characterClass: {
    id: "warrior",
    name: "Warrior",
    summary: "Implementation-heavy engineer focused on shipping code changes.",
    state: "specialized",
    mix: [{ classId: "warrior", share: 1, evidenceCount: 1, evidenceIds: ["e1"] }],
    specialties: [{ id: "general", label: "General Engineering", explanation: "No clear backend/frontend/AI/systems/QA keyword signal was found.", evidenceIds: [] }],
    basis: { classifierVersion: "v1", qualifyingEvidenceCount: 1, consideredEvidenceIds: ["e1"], rejectedEvidenceIds: [], assignments: [{ evidenceId: "e1", classId: "warrior", reason: "engineering implementation contribution votes for warrior" }] },
    classificationLimits: [],
  },
  classPreference: { isAiEngineer: false, aiToolUsage: "unspecified", mageActive: false, mageQuiz: null, magePath: null, editable: true },
  mastery: { version: "v1", disciplines: [] },
  warnings: [], ...over,
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
  it("links class evidence only from the scoped snapshot, with shared reasons", () => {
    const base = snap();
    const good = { ...base.evidence[0], url: "https://github.com/a/b/pull/1" };
    const v = normalizeDashboard({ ...base, evidence: [good], characterClass: { ...base.characterClass, mix: [{ classId: "warrior", share: 1, evidenceCount: 2, evidenceIds: ["e1", "not-in-scope"] }] } });
    const m = v.characterClass!.mix[0];
    expect(m.evidence).toEqual([{ id: "e1", title: "x", url: "https://github.com/a/b/pull/1", reason: "engineering implementation contribution votes for warrior" }]);
    expect(m.unlinked).toBe(1);
    expect(normalizeDashboard(snap()).characterClass!.mix[0].evidence).toEqual([]); // unsafe url never linked
  });
  it("keeps the earned title separate from the self-reported display title and preference", () => {
    const base = snap();
    const v = normalizeDashboard({ ...base, profile: { ...base.profile, title: "Gate Sentinel", displayTitle: "Gate Sentinel · Mage" }, classPreference: { isAiEngineer: true, aiToolUsage: "frequent", mageActive: true, mageQuiz: null, magePath: null, editable: true } });
    expect(v.title).toBe("Gate Sentinel · Mage");
    expect(v.earnedTitle).toBe("Gate Sentinel");
    expect(v.preference).toEqual({ isAiEngineer: true, aiToolUsage: "frequent", mageActive: true, mageQuiz: null, magePath: null, editable: true });
    expect(v.characterClass?.id).toBe("warrior"); // the contribution class is untouched by the preference
    const demo = normalizeDashboard({ ...base, source: "demo", classPreference: { isAiEngineer: false, aiToolUsage: "unspecified", mageActive: false, mageQuiz: null, magePath: null, editable: false } });
    expect(demo.preference.editable).toBe(false);
  });
  it("previews Mage only for an AI engineer or non-zero reported use, from the shared rule", () => {
    expect(deriveDisplayTitle("Gate Sentinel", { isAiEngineer: false, aiToolUsage: "unspecified" })).toBe("Gate Sentinel");
    expect(deriveDisplayTitle("Gate Sentinel", { isAiEngineer: false, aiToolUsage: "none" })).toBe("Gate Sentinel");
    for (const u of ["occasional", "frequent", "ai_first"] as const) expect(deriveDisplayTitle("Gate Sentinel", { isAiEngineer: false, aiToolUsage: u })).toBe("Gate Sentinel · Mage");
    expect(deriveDisplayTitle("Gate Sentinel", { isAiEngineer: true, aiToolUsage: "none" })).toBe("Gate Sentinel · Mage");
    for (const v of AI_TOOL_USAGE_VALUES) expect(AI_USAGE_LABELS[v]).toBeTruthy(); // every enum value has a friendly label
  });
  it("preserves quiz answers and the derived path without changing earned progression", () => {
    const base = snap();
    const preference = withMagePreference({ isAiEngineer: true, aiToolUsage: "frequent", mageQuiz: { workflow: "multi_agent", engineering: "integrating", verification: "manual" } }, true);
    const view = normalizeDashboard({ ...base, classPreference: preference, profile: { ...base.profile, displayTitle: deriveDisplayTitle(base.profile.title, preference) } });
    expect(view.preference.mageQuiz).toEqual(preference.mageQuiz);
    expect(view.preference.magePath?.name).toBe("Orchestrator");
    expect(view.title).toBe("T · Mage — Orchestrator");
    expect(view.earnedTitle).toBe(base.profile.title);
    expect(view.totalXp).toBe(base.progression.totalXp);
    expect(view.rank).toBe(base.progression.rank);
  });
  it("keeps Monarch gates separate and links only safe in-scope mastery evidence", () => {
    const base = snap();
    const evidence = { ...base.evidence[0], url: "https://github.com/a/b/pull/1" };
    const view = normalizeDashboard({ ...base, evidence: [evidence], mastery: { version: "v1", disciplines: [{
      id: "backend", title: "Shadow Monarch", track: "engineering",
      rankGate: { required: "S", met: false },
      contributionGate: { required: 20, current: 20, remaining: 0 },
      monthGate: { required: 3, current: 2, remaining: 1 },
      unlockedAt: null, evidenceIds: ["e1", "another-repository"],
    }] } });
    expect(view.mastery[0].unlockedAt).toBeNull();
    expect(view.mastery[0].rankGate.met).toBe(false);
    expect(view.mastery[0].monthGate.remaining).toBe(1);
    expect(view.mastery[0].evidence).toEqual([{ id: "e1", title: evidence.title, url: evidence.url }]);
    expect(view.mastery[0].unlinked).toBe(1);
    const hostile = normalizeDashboard({ ...base, mastery: { version: "v1", disciplines: [{ ...view.mastery[0], evidenceIds: ["e1"] }] } });
    expect(hostile.mastery[0].evidence).toEqual([]);
    expect(hostile.mastery[0].unlinked).toBe(1);
  });
  it("saves preferences bound to the active username and surfaces field errors", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = { username: "u", preference: { isAiEngineer: true, aiToolUsage: "none", mageActive: true, editable: true } };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return calls.length === 1 ? new Response(JSON.stringify(ok), { status: 200 }) : new Response(JSON.stringify({ error: { code: "invalid_request", message: "Invalid profile preference payload.", fields: { "preference.aiToolUsage": "bad" } } }), { status: 400 });
    }));
    await expect(savePreference("u", { isAiEngineer: true, aiToolUsage: "none" })).resolves.toEqual(ok);
    expect(calls[0].url).toBe("/api/profile");
    expect(calls[0].init.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ username: "u", preference: { isAiEngineer: true, aiToolUsage: "none" } });
    await expect(savePreference("u", { isAiEngineer: false, aiToolUsage: "none" })).rejects.toMatchObject({ code: "invalid_request", status: 400, fields: { "preference.aiToolUsage": "bad" } });
    vi.unstubAllGlobals();
  });
});
