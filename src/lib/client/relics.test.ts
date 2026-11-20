import { describe, expect, it } from "vitest";
import { deriveRelicVault } from "./relics";
import type { DashboardView } from "./types";

function makeView(overrides: Partial<DashboardView> = {}): DashboardView {
  return {
    mode: "live",
    liveSyncAvailable: true,
    scope: { kind: "global" },
    trackedRepositories: ["owner/alpha", "owner/beta"],
    generatedAt: "2026-11-20T00:00:00.000Z",
    lastSyncedAt: "2026-11-20T00:00:00.000Z",
    profile: { username: "hero", displayName: "Hero", avatarUrl: null },
    totalXp: 0,
    level: 1,
    levelXp: 0,
    nextLevelXp: 120,
    rank: "E",
    title: "Contributor",
    titles: [],
    nextRankRequirement: "Submit one qualifying contribution.",
    scoringVersion: "v2",
    tracks: [],
    repositories: [],
    contributions: [],
    achievements: [],
    quests: [
      { id: "q1", title: "Forge 5", description: "desc", track: "engineering", progress: 2, target: 5, completed: false, rewardXp: 0 },
      { id: "q2", title: "Docs 4", description: "desc", track: "documentation", progress: 4, target: 4, completed: true, rewardXp: 0 },
    ],
    characterClass: null,
    earnedTitle: "Contributor",
    preference: { isAiEngineer: false, aiToolUsage: "unspecified", mageActive: false, mageQuiz: null, magePath: null, editable: true },
    mastery: [],
    warnings: [],
    ...overrides,
  };
}

describe("deriveRelicVault", () => {
  it("counts completed quests as opened chests and unlocks the quest hoard chest", () => {
    const vault = deriveRelicVault(makeView());
    expect(vault.chestsOpened).toBe(1);
    expect(vault.chestsTotal).toBe(2);
    expect(vault.items.find((i) => i.id === "quest-hoard-chest")?.unlocked).toBe(true);
    expect(vault.items.find((i) => i.id === "iron-merge-blade")?.unlocked).toBe(false);
  });

  it("unlocks relics matching achievements, Rank S, Mage, and Monarchs", () => {
    const vault = deriveRelicVault(
      makeView({
        rank: "S",
        achievements: [
          { id: "merge-initiate", name: "Merge Initiate", description: "", track: "engineering", unlocked: true, unlockedAt: "2026-01-01T00:00:00Z", progress: 1, target: 1, evidence: [], missingEvidence: 0 },
          { id: "history-epic", name: "Epic Chronicle", description: "", track: "general", unlocked: true, unlockedAt: "2026-02-01T00:00:00Z", progress: 75, target: 75, evidence: [], missingEvidence: 0 },
        ],
        preference: {
          isAiEngineer: true,
          aiToolUsage: "frequent",
          mageActive: true,
          mageQuiz: null,
          magePath: { id: "orchestrator", name: "Orchestrator", summary: "", explanation: "", classifierVersion: "v1", selfReported: true },
          editable: true,
        },
        mastery: [
          {
            id: "backend",
            title: "Shadow Monarch",
            track: "engineering",
            rankGate: { required: "S", met: true },
            contributionGate: { required: 20, current: 20, remaining: 0 },
            monthGate: { required: 3, current: 3, remaining: 0 },
            unlockedAt: "2026-03-01T00:00:00Z",
            evidence: [],
            unlinked: 0,
          },
        ],
      }),
    );

    expect(vault.items.find((i) => i.id === "iron-merge-blade")?.unlocked).toBe(true);
    expect(vault.items.find((i) => i.id === "hourglass-of-ages")?.sourceLabel).toBe("Epic Chronicle");
    expect(vault.items.find((i) => i.id === "arcane-grimoire")?.unlocked).toBe(true);
    expect(vault.items.find((i) => i.id === "sovereign-rank-signet")?.unlocked).toBe(true);
    expect(vault.items.find((i) => i.id === "monarch-diadem")?.sourceLabel).toBe("Shadow Monarch");
    expect(vault.byRarity.mythic.unlocked).toBe(2);
  });

  it("omits global-only Wayfarer Astrolabe in repository scope", () => {
    const globalVault = deriveRelicVault(makeView({ scope: { kind: "global" } }));
    const repoVault = deriveRelicVault(makeView({ scope: { kind: "repository", repositoryId: "owner/alpha" } }));
    expect(globalVault.items.some((i) => i.id === "wayfarer-astrolabe")).toBe(true);
    expect(repoVault.items.some((i) => i.id === "wayfarer-astrolabe")).toBe(false);
  });
});
