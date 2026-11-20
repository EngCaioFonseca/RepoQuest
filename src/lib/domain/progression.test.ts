import { describe, expect, it } from "vitest";
import type { ContributionEvidence, Repository } from "@/lib/contracts";
import { deriveProgression, getProgressionGuide, LEVEL_STEP, SCORING_VERSION, XP_RULES } from "./progression";
import { renderShareSvg } from "./share-svg";

const repos = (): Repository[] => [
  {
    id: "chaoss/8Knot",
    owner: "chaoss",
    name: "8Knot",
    url: "https://github.com/chaoss/8Knot",
    description: "",
    xp: 0,
    evidenceCount: 0,
    coverage: {
      username: "engcaiofonseca",
      repositoryId: "chaoss/8Knot",
      requestedScope: "all_accessible_history",
      supportedKinds: ["pull_request", "review", "issue"],
      backfillStatus: "complete",
      oldestEvidenceAt: null,
      newestEvidenceAt: null,
      lastAttemptAt: null,
      lastSuccessfulSyncAt: null,
      coveredThrough: null,
      canResume: false,
      limitations: [],
    },
  },
];

const evidence = (): ContributionEvidence[] => [
  {
    id: "e-pr",
    actor: { login: "engcaiofonseca", id: 1 },
    repositoryId: "chaoss/8Knot",
    kind: "pull_request",
    track: "engineering",
    title: "Core refactor",
    url: "https://github.com/chaoss/8Knot/pull/1",
    occurredAt: "2024-01-02T00:00:00.000Z",
    state: "merged",
    xp: 0,
    reason: "merged",
  },
  {
    id: "e-doc",
    actor: { login: "engcaiofonseca", id: 1 },
    repositoryId: "chaoss/8Knot",
    kind: "issue",
    track: "documentation",
    title: "Docs: onboarding",
    url: "https://github.com/chaoss/8Knot/issues/2",
    occurredAt: "2024-02-02T00:00:00.000Z",
    state: "closed",
    xp: 0,
    reason: "docs issue",
  },
  {
    id: "e-review",
    actor: { login: "engcaiofonseca", id: 1 },
    repositoryId: "chaoss/8Knot",
    kind: "review",
    track: "review",
    title: "Review",
    url: "https://github.com/chaoss/8Knot/pull/3#review-1",
    occurredAt: "2024-03-02T00:00:00.000Z",
    state: "submitted",
    xp: 0,
    reason: "review",
  },
];

function pullEvidence(count: number): ContributionEvidence[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `pr-${index + 1}`,
    actor: { login: "engcaiofonseca", id: 1 },
    repositoryId: "chaoss/8Knot",
    kind: "pull_request" as const,
    track: index % 2 === 0 ? "documentation" as const : "engineering" as const,
    title: index % 2 === 0 ? `Docs: ${index}` : `Core: ${index}`,
    url: `https://github.com/chaoss/8Knot/pull/${index + 1}`,
    occurredAt: `2024-01-${String((index % 27) + 1).padStart(2, "0")}T00:00:00.000Z`,
    state: "merged" as const,
    xp: 0,
    reason: "merged",
  }));
}

describe("progression", () => {
  it("is deterministic and stable across recalculation", () => {
    const first = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos(),
      evidence(),
      { kind: "global" },
      ["chaoss/8Knot"],
      "live",
      true,
      [],
      "2024-03-02T00:00:00.000Z",
    );
    const second = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos(),
      evidence(),
      { kind: "global" },
      ["chaoss/8Knot"],
      "live",
      true,
      [],
      "2024-03-02T00:00:00.000Z",
    );
    expect(first.progression).toEqual(second.progression);
    expect(first.achievements).toEqual(second.achievements);
    expect(first.progression.totalXp).toBe(250);
    expect(first.progression.rank).toBe("D");
  });

  it("escapes untrusted content in SVG and omits contribution details", () => {
    const snapshot = deriveProgression(
      { username: "engcaiofonseca", displayName: "<script>x</script>", avatarUrl: null },
      repos(),
      evidence(),
      { kind: "global" },
      ["chaoss/8Knot"],
      "live",
      true,
      ["warn <unsafe>"],
      "2024-03-02T00:00:00.000Z",
    );
    const svg = renderShareSvg(snapshot);
    expect(svg).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(svg).toContain("warn &lt;unsafe&gt;");
    expect(svg).not.toContain("<script>x</script>");
    expect(svg).not.toContain("Core refactor");
    expect(svg).not.toContain("pull/1");
  });

  it("exports progression guide metadata from the same scoring source", () => {
    const guide = getProgressionGuide();
    expect(guide.scoringVersion).toBe(SCORING_VERSION);
    expect(guide.xp.levelBaseStep).toBe(LEVEL_STEP);
    expect(guide.xp.evidenceRules.mergedEngineeringPr).toBe(XP_RULES.mergedEngineeringPr);
    expect(guide.xp.evidenceRules.mergedDocumentationPr).toBe(XP_RULES.mergedDocumentationPr);
    expect(guide.scopeRules.globalOnlyAchievementIds).toContain("realm-dual");
    expect(guide.titles.some((title) => title.title === "Realm Walker" && title.globalOnly)).toBe(true);
    expect(guide.displayedTitleSelection).toMatch(/last unlocked entry in TITLE_RULES list order/);
    expect(guide.titles.find((title) => title.title === "Integration Pathfinder")?.unlock).toMatch(/10 merged pull requests/);
  });

  it("keeps rank and pull-request milestones aligned with guide thresholds across tracks", () => {
    const below = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos(),
      pullEvidence(2),
      { kind: "repository", repositoryId: "chaoss/8Knot" },
      ["chaoss/8Knot"],
      "live",
      true,
      [],
      null,
    );
    const at = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos(),
      pullEvidence(3),
      { kind: "repository", repositoryId: "chaoss/8Knot" },
      ["chaoss/8Knot"],
      "live",
      true,
      [],
      null,
    );
    expect(below.progression.rank).toBe("D");
    expect(at.progression.rank).toBe("C");
    expect(at.progression.nextRankRequirement).toMatch(/documentation and 3 review/);
  });

  it("keeps realm-triple unlockable with explicit third-repository prerequisite text", () => {
    const snapshot = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos(),
      evidence(),
      { kind: "global" },
      ["chaoss/8Knot", "chaoss/CollectOSS"],
      "live",
      true,
      [],
      null,
    );
    const realmTriple = snapshot.achievements.find((achievement) => achievement.id === "realm-triple");
    expect(realmTriple?.description).toMatch(/third tracked repository|3 repositories|add a third/i);
    expect(realmTriple?.target).toBe(3);
  });
});
