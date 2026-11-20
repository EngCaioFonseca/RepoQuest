import { describe, expect, it } from "vitest";
import type { ContributionEvidence, DashboardScope } from "@/lib/contracts";
import { deriveQuestBoard, type QuestScoring } from "./quests";
import { deriveProgression } from "./progression";

const scoring: QuestScoring = {
  levelOf: (xp) => 1 + Math.floor(xp / 100),
  xpToReachLevel: (level) => (level - 1) * 100,
  xpPerItem: { engineering: 120, documentation: 60, review: 70, any: 60 },
};
const GLOBAL: DashboardScope = { kind: "global" };
const NOW = new Date("2026-03-10T12:00:00Z");

function item(id: string, occurredAt: string, over: Partial<ContributionEvidence> = {}): ContributionEvidence {
  return {
    id, actor: { login: "u", id: 1 }, repositoryId: "a/b", kind: "pull_request", track: "engineering", title: id,
    url: `https://github.com/a/b/pull/${id}`, occurredAt, state: "merged", xp: 120, reason: "r", ...over,
  };
}
const day = (n: number) => new Date(Date.UTC(2024, 0, 1 + n)).toISOString();

describe("quest board", () => {
  it("starts every questline at tier 1 with a monthly bounty and an empty log", () => {
    const { quests, questLog } = deriveQuestBoard([], GLOBAL, scoring, NOW);
    expect(quests.map((q) => q.chainId)).toEqual(["bounty", "engineering", "docs", "review", "level", "cadence", "realms"]);
    expect(quests.every((q) => q.tier === 1 && !q.completed)).toBe(true);
    expect(questLog.completed).toEqual([]);
    expect(questLog.renown).toMatchObject({ points: 0, rank: "Wanderer", nextRank: "Squire" });
  });

  it("logs reached tiers on the date of the completing evidence and opens the next tier", () => {
    const evidence = [item("p1", day(0)), item("p2", day(1)), item("p3", day(2)), item("p4", day(3))];
    const { quests, questLog } = deriveQuestBoard(evidence, GLOBAL, scoring, NOW);
    const forged = questLog.completed.filter((q) => q.chainId === "engineering");
    expect(forged.map((q) => [q.id, q.completedAt, q.reward.rarity])).toEqual([
      ["quest-engineering-1", day(0), "common"],
      ["quest-engineering-3", day(2), "uncommon"],
    ]);
    expect(forged[1].evidenceIds).toEqual(["p1", "p2", "p3"]);
    expect(forged[1].levelAtCompletion).toBe(4);
    const next = quests.find((q) => q.chainId === "engineering")!;
    expect(next).toMatchObject({ id: "quest-engineering-5", tier: 3, progress: 4, target: 5, rewardXp: 120 });
  });

  it("never runs out of tiers", () => {
    const evidence = Array.from({ length: 130 }, (_, i) => item(`p${i}`, day(i)));
    const { quests, questLog } = deriveQuestBoard(evidence, GLOBAL, scoring, NOW);
    const last = questLog.completed.filter((q) => q.chainId === "engineering").at(-1)!;
    expect(last).toMatchObject({ target: 125, tier: 11 });
    expect(last.reward).toMatchObject({ name: "Worldforge Hammer V", rarity: "legendary" });
    expect(quests.find((q) => q.chainId === "engineering")).toMatchObject({ target: 150, tier: 12 });
  });

  it("claims monthly bounties and upgrades the chest on a streak", () => {
    const evidence = [
      item("j1", "2026-01-02T00:00:00Z"), item("j2", "2026-01-03T00:00:00Z"), item("j3", "2026-01-04T00:00:00Z"),
      item("f1", "2026-02-02T00:00:00Z"), item("f2", "2026-02-03T00:00:00Z"), item("f3", "2026-02-04T00:00:00Z"),
      item("m1", "2026-03-02T00:00:00Z"),
    ];
    const { quests, questLog } = deriveQuestBoard(evidence, GLOBAL, scoring, NOW);
    const bounties = questLog.completed.filter((q) => q.chainId === "bounty");
    expect(bounties.map((q) => [q.id, q.reward.rarity])).toEqual([["bounty-2026-01", "common"], ["bounty-2026-02", "uncommon"]]);
    const active = quests[0];
    expect(active).toMatchObject({ id: "bounty-2026-03", progress: 1, target: 3, completed: false, endsAt: "2026-04-01T00:00:00.000Z" });
    expect(active.reward.rarity).toBe("rare");
    expect(active.recommendation).toMatch(/2 months/);
  });

  it("omits global-only questlines in a repository view", () => {
    const { quests } = deriveQuestBoard([item("p1", day(0))], { kind: "repository", repositoryId: "a/b" }, scoring, NOW);
    expect(quests.some((q) => q.chainId === "realms")).toBe(false);
    expect(quests.every((q) => q.repositoryId === "a/b")).toBe(true);
  });

  it("recommends the questline closest to its next reward", () => {
    const slow: QuestScoring = { ...scoring, levelOf: (xp) => 1 + Math.floor(xp / 10_000), xpToReachLevel: (level) => (level - 1) * 10_000 };
    const evidence = [...Array.from({ length: 9 }, (_, i) => item(`p${i}`, day(i))), item("r1", day(10), { kind: "review", track: "review", state: "submitted", xp: 70 })];
    const { quests } = deriveQuestBoard(evidence, GLOBAL, slow, NOW);
    const suggested = quests.filter((q) => q.chainId !== "bounty" && q.recommendation);
    expect(suggested).toHaveLength(1);
    expect(suggested[0].chainId).toBe("engineering");
    expect(suggested[0].recommendation).toMatch(/1 more earns the Forgemaster's Gauntlet/);
  });

  it("does not change XP, level or rank", () => {
    const evidence = Array.from({ length: 12 }, (_, i) => item(`p${i}`, day(i * 40)));
    const snapshot = deriveProgression({ username: "u", displayName: "U", avatarUrl: null }, [], evidence, GLOBAL, ["a/b"], "live", true, [], null);
    expect(snapshot.progression.totalXp).toBe(12 * 120);
    expect(snapshot.questLog.completed.length).toBeGreaterThan(0);
    expect(snapshot.quests.every((q) => q.rewardXp >= 0)).toBe(true);
  });
});
