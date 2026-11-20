import { describe, expect, it } from "vitest";
import type { ContributionEvidence, Repository } from "@/lib/contracts";
import { renderShareSvg } from "./share-svg";
import { deriveProgression, getProgressionGuide } from "./progression";
import { deriveMastery, getMasteryGuide } from "./mastery";

function ev(input: {
  id: string;
  occurredAt: string;
  repositoryId?: string;
  kind?: ContributionEvidence["kind"];
  track?: ContributionEvidence["track"];
  state?: ContributionEvidence["state"];
  title?: string;
}): ContributionEvidence {
  return {
    id: input.id,
    actor: { login: "engcaiofonseca", id: 1 },
    repositoryId: input.repositoryId ?? "chaoss/8Knot",
    kind: input.kind ?? "pull_request",
    track: input.track ?? "engineering",
    title: input.title ?? "Backend service API update",
    url: `https://github.com/${input.repositoryId ?? "chaoss/8Knot"}/pull/${input.id}`,
    occurredAt: input.occurredAt,
    state: input.state ?? (input.kind === "review" ? "submitted" : input.kind === "issue" ? "closed" : "merged"),
    xp: 0,
    reason: "test",
  };
}

function backendSeries(count: number, monthStarts: string[], repositoryId = "chaoss/8Knot"): ContributionEvidence[] {
  const out: ContributionEvidence[] = [];
  for (let i = 0; i < count; i += 1) {
    const month = monthStarts[Math.min(monthStarts.length - 1, Math.floor((i * monthStarts.length) / count))];
    const day = String((i % 20) + 1).padStart(2, "0");
    out.push(ev({ id: `be-${repositoryId}-${i + 1}`, occurredAt: `${month}-${day}T00:00:00.000Z`, repositoryId }));
  }
  return out;
}

describe("mastery", () => {
  it("unlocks at exact boundary of 20 contributions and 3 months using latest required gate date", () => {
    const evidence = [
      ...backendSeries(18, ["2024-01"], "chaoss/8Knot"),
      ev({ id: "be-19", occurredAt: "2024-02-01T00:00:00.000Z" }),
      ev({ id: "be-20", occurredAt: "2024-03-01T00:00:00.000Z" }),
    ];
    const { progress, achievements } = deriveMastery(evidence, "S", "2024-02-15T00:00:00.000Z");
    const backend = progress.disciplines.find((item) => item.id === "backend");
    const achievement = achievements.find((item) => item.id === "mastery-shadow-monarch");
    expect(backend?.contributionGate.current).toBe(20);
    expect(backend?.monthGate.current).toBe(3);
    expect(backend?.unlockedAt).toBe("2024-03-01T00:00:00.000Z");
    expect(achievement?.unlockedAt).toBe("2024-03-01T00:00:00.000Z");
  });

  it("does not unlock below rank S even with qualifying specialty volume", () => {
    const evidence = backendSeries(24, ["2024-01", "2024-02", "2024-03"]);
    const { progress } = deriveMastery(evidence, "A", null);
    const backend = progress.disciplines.find((item) => item.id === "backend");
    expect(backend?.rankGate.met).toBe(false);
    expect(backend?.unlockedAt).toBeNull();
  });

  it("does not treat reviews as backend specialty contributions", () => {
    const evidence = Array.from({ length: 25 }, (_, i) =>
      ev({
        id: `rv-${i + 1}`,
        kind: "review",
        track: "review",
        state: "submitted",
        occurredAt: `2024-${String((i % 3) + 1).padStart(2, "0")}-${String((i % 20) + 1).padStart(2, "0")}T00:00:00.000Z`,
        title: "Review: backend service",
      }),
    );
    const { progress } = deriveMastery(evidence, "S", "2024-03-30T00:00:00.000Z");
    const backend = progress.disciplines.find((item) => item.id === "backend");
    const review = progress.disciplines.find((item) => item.id === "review");
    expect(backend?.contributionGate.current).toBe(0);
    expect(backend?.unlockedAt).toBeNull();
    expect(review?.contributionGate.current).toBe(25);
  });

  it("deduplicates repeated evidence ids deterministically", () => {
    const unique = backendSeries(20, ["2024-01", "2024-02", "2024-03"]);
    const duplicate = { ...unique[18], occurredAt: "2024-03-15T00:00:00.000Z" };
    const { progress } = deriveMastery([...unique.slice(0, 19), duplicate], "S", "2024-03-31T00:00:00.000Z");
    const backend = progress.disciplines.find((item) => item.id === "backend");
    expect(backend?.contributionGate.current).toBe(19);
    expect(backend?.unlockedAt).toBeNull();
  });

  it("uses UTC months from parsed timestamps and ignores invalid dates for month gate", () => {
    const evidence = [
      ...backendSeries(17, ["2024-01"]),
      ev({ id: "tz-1", occurredAt: "2024-01-31T23:30:00-02:00" }),
      ev({ id: "tz-2", occurredAt: "2024-02-29T23:30:00+02:00" }),
      ev({ id: "tz-3", occurredAt: "not-a-date" }),
    ];
    const { progress } = deriveMastery(evidence, "S", "2024-03-01T00:00:00.000Z");
    const backend = progress.disciplines.find((item) => item.id === "backend");
    expect(backend?.contributionGate.current).toBe(19);
    expect(backend?.monthGate.current).toBe(2);
    expect(backend?.unlockedAt).toBeNull();
  });

  it("fails closed when twentieth qualifying contribution has invalid date", () => {
    const valid = backendSeries(20, ["2024-01", "2024-02", "2024-03"]);
    const probe = deriveMastery([...valid.slice(0, 19), ev({ id: "be-invalid-20", occurredAt: "not-a-date" })], "S", "2024-04-01T00:00:00.000Z");
    const backend = probe.progress.disciplines.find((item) => item.id === "backend");
    expect(backend?.rankGate.met).toBe(true);
    expect(backend?.contributionGate.current).toBe(19);
    expect(backend?.unlockedAt).toBeNull();
    expect(backend?.evidenceIds).toHaveLength(19);
  });

  it("fails closed when rank-S gate timestamp is invalid", () => {
    const valid = backendSeries(20, ["2024-01", "2024-02", "2024-03"]);
    const probe = deriveMastery(valid, "S", "not-a-date");
    const backend = probe.progress.disciplines.find((item) => item.id === "backend");
    expect(backend?.rankGate.met).toBe(false);
    expect(backend?.unlockedAt).toBeNull();
  });

  it("resolves same-id same-date duplicates with deterministic content tie-break", () => {
    const sharedIdA = ev({ id: "dup-1", occurredAt: "2024-03-01T00:00:00.000Z", title: "Backend API migration" });
    const sharedIdB = ev({ id: "dup-1", occurredAt: "2024-03-01T00:00:00.000Z", title: "Chore: rename docs" });
    const base = backendSeries(19, ["2024-01", "2024-02", "2024-03"]);
    const first = deriveMastery([...base, sharedIdA, sharedIdB], "S", "2024-03-31T00:00:00.000Z");
    const second = deriveMastery([...base, sharedIdB, sharedIdA], "S", "2024-03-31T00:00:00.000Z");
    const firstBackend = first.progress.disciplines.find((item) => item.id === "backend");
    const secondBackend = second.progress.disciplines.find((item) => item.id === "backend");
    expect(firstBackend).toEqual(secondBackend);
  });

  it("keeps scope-isolated counts when evidence is filtered by repository", () => {
    const repoA = backendSeries(10, ["2024-01", "2024-02"], "chaoss/8Knot");
    const repoB = backendSeries(10, ["2024-03", "2024-04"], "chaoss/CollectOSS");
    const global = deriveMastery([...repoA, ...repoB], "S", "2024-04-30T00:00:00.000Z");
    const localA = deriveMastery(repoA, "S", "2024-04-30T00:00:00.000Z");
    const globalBackend = global.progress.disciplines.find((item) => item.id === "backend");
    const localBackend = localA.progress.disciplines.find((item) => item.id === "backend");
    expect(globalBackend?.contributionGate.current).toBe(20);
    expect(globalBackend?.unlockedAt).not.toBeNull();
    expect(localBackend?.contributionGate.current).toBe(10);
    expect(localBackend?.unlockedAt).toBeNull();
  });

  it("does not let mastery achievements bootstrap rank S and keeps share/title parity", () => {
    const repos: Repository[] = [{
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
        requestedScope: "all_accessible_history" as const,
        supportedKinds: ["pull_request", "review", "issue"] as ContributionEvidence["kind"][],
        backfillStatus: "complete" as const,
        oldestEvidenceAt: null,
        newestEvidenceAt: null,
        lastAttemptAt: null,
        lastSuccessfulSyncAt: null,
        coveredThrough: null,
        canResume: false,
        limitations: [],
      },
    }];

    const notS = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos,
      backendSeries(24, ["2024-01", "2024-02", "2024-03"]),
      { kind: "global" },
      ["chaoss/8Knot"],
      "live",
      true,
      [],
      null,
      { isAiEngineer: true, aiToolUsage: "ai_first", mageQuiz: null },
      true,
    );
    expect(notS.progression.rank).not.toBe("S");
    expect(notS.mastery.disciplines.every((item) => item.unlockedAt === null)).toBe(true);

    const fullS = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos,
      [
        ...backendSeries(20, ["2024-01", "2024-02", "2024-03"]),
        ...Array.from({ length: 10 }, (_, i) =>
          ev({
            id: `doc-${i + 1}`,
            kind: i < 5 ? "pull_request" : "issue",
            track: "documentation",
            state: i < 5 ? "merged" : "closed",
            occurredAt: `2024-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
            title: "Docs: handbook update",
          }),
        ),
        ...Array.from({ length: 12 }, (_, i) =>
          ev({
            id: `review-${i + 1}`,
            kind: "review",
            track: "review",
            state: "submitted",
            occurredAt: `2024-05-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
            title: "Review: validation",
          }),
        ),
      ],
      { kind: "global" },
      ["chaoss/8Knot"],
      "live",
      true,
      [],
      null,
      { isAiEngineer: true, aiToolUsage: "ai_first", mageQuiz: null },
      true,
    );
    expect(fullS.progression.rank).toBe("S");
    expect(fullS.profile.title).toBe("Shadow Monarch");
    const shadow = fullS.achievements.find((item) => item.id === "mastery-shadow-monarch");
    expect(shadow?.unlockedAt).toBe("2024-05-12T00:00:00.000Z");
    const svg = renderShareSvg(fullS);
    expect(svg).toContain("Shadow Monarch");

    const noAiPrefs = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos,
      [
        ...backendSeries(20, ["2024-01", "2024-02", "2024-03"]),
        ...Array.from({ length: 10 }, (_, i) =>
          ev({
            id: `doc-noai-${i + 1}`,
            kind: i < 5 ? "pull_request" : "issue",
            track: "documentation",
            state: i < 5 ? "merged" : "closed",
            occurredAt: `2024-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
            title: "Docs: handbook update",
          }),
        ),
        ...Array.from({ length: 12 }, (_, i) =>
          ev({
            id: `review-noai-${i + 1}`,
            kind: "review",
            track: "review",
            state: "submitted",
            occurredAt: `2024-05-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
            title: "Review: validation",
          }),
        ),
      ],
      { kind: "global" },
      ["chaoss/8Knot"],
      "live",
      true,
      [],
      null,
      { isAiEngineer: false, aiToolUsage: "unspecified", mageQuiz: null },
      true,
    );
    expect(noAiPrefs.progression.rank).toBe("S");
    expect(noAiPrefs.profile.title).toBe("Shadow Monarch");

    const invalidReviewBoost = deriveProgression(
      { username: "engcaiofonseca", displayName: "Eng", avatarUrl: null },
      repos,
      [
        ...backendSeries(20, ["2024-01", "2024-02", "2024-03"]),
        ...Array.from({ length: 10 }, (_, i) =>
          ev({
            id: `doc-boost-${i + 1}`,
            repositoryId: i === 0 ? "chaoss/CollectOSS" : "chaoss/8Knot",
            kind: i < 5 ? "pull_request" : "issue",
            track: "documentation",
            state: i < 5 ? "merged" : "closed",
            occurredAt: `2024-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
            title: "Docs: handbook update",
          }),
        ),
        ...Array.from({ length: 9 }, (_, i) =>
          ev({
            id: `review-valid-${i + 1}`,
            kind: "review",
            track: "review",
            state: "submitted",
            occurredAt: `2024-05-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
            title: "Review: validation",
          }),
        ),
        ev({
          id: "review-invalid-10",
          kind: "review",
          track: "review",
          state: "submitted",
          occurredAt: "not-a-date",
          title: "Review: validation",
        }),
      ],
      { kind: "global" },
      ["chaoss/8Knot", "chaoss/CollectOSS"],
      "live",
      true,
      [],
      null,
      { isAiEngineer: false, aiToolUsage: "none", mageQuiz: null },
      true,
    );
    expect(invalidReviewBoost.progression.rank).toBe("S");
    const invalidBoostBackend = invalidReviewBoost.mastery.disciplines.find((item) => item.id === "backend");
    expect(invalidBoostBackend?.rankGate.met).toBe(false);
    expect(invalidBoostBackend?.unlockedAt).toBeNull();
  });

  it("publishes mastery guide constants through both guide seams", () => {
    const masteryGuide = getMasteryGuide();
    const progressionGuide = getProgressionGuide();
    expect(masteryGuide.requiredContributions).toBe(20);
    expect(masteryGuide.requiredDistinctMonths).toBe(3);
    expect(masteryGuide.titlePrecedence).toEqual(["backend", "frontend", "ai", "systems", "qa", "documentation", "review"]);
    expect(masteryGuide.disciplines).toHaveLength(7);
    expect(masteryGuide.disciplines[0]?.unlock).toMatch(/rank S and complete 20/i);
    expect(progressionGuide.mastery.requiredContributions).toBe(masteryGuide.requiredContributions);
    expect(progressionGuide.mastery.requiredDistinctMonths).toBe(masteryGuide.requiredDistinctMonths);
    expect(progressionGuide.mastery.titles.map((item) => item.title)).toContain("Shadow Monarch");
    expect(progressionGuide.displayedTitleSelection).toMatch(/mastery precedence order/i);
  });
});
