import { describe, expect, it } from "vitest";
import type { ContributionEvidence } from "@/lib/contracts";
import { deriveCharacterClass, deriveDisplayTitle, deriveMagePath, getClassGuide, isMageActive, MAGE_PATH_VERSION } from "./classes";

function evidence(
  id: string,
  title: string,
  track: ContributionEvidence["track"] = "engineering",
  kind: ContributionEvidence["kind"] = "pull_request",
  repositoryId = "chaoss/8Knot",
  occurredAt = "2024-01-01T00:00:00.000Z",
): ContributionEvidence {
  return {
    id,
    actor: { login: "engcaiofonseca", id: 1 },
    repositoryId,
    kind,
    track,
    title,
    url: `https://github.com/${repositoryId}/pull/${id}`,
    occurredAt,
    state: kind === "review" ? "submitted" : kind === "pull_request" ? "merged" : "closed",
    xp: 0,
    reason: "test",
  };
}

describe("character classes", () => {
  it("classifies healer/warrior/scribe/guardian signals conservatively", () => {
    expect(deriveCharacterClass([evidence("a", "Fix regression in API"), evidence("b", "Patch bug in auth flow")]).id).toBe("healer");
    expect(deriveCharacterClass([evidence("a", "Implement API pagination"), evidence("b", "Refactor server adapter")]).id).toBe("warrior");
    expect(deriveCharacterClass([evidence("a", "LLM orchestration pipeline"), evidence("b", "Architecture for infra routing")]).id).toBe("warrior");
    expect(deriveCharacterClass([evidence("a", "Docs: onboarding guide", "documentation", "issue"), evidence("b", "README update", "documentation", "issue")]).id).toBe("scribe");
    expect(deriveCharacterClass([evidence("a", "Review pass", "review", "review"), evidence("b", "Approve follow-up", "review", "review")]).id).toBe("guardian");
  });

  it("captures ordinary bug-fix title forms as healer (including live-style fixtures)", () => {
    const result = deriveCharacterClass([
      evidence("a", "fix: start db-init in podman e2e"),
      evidence("a2", "fix(db): handle null user in login"),
      evidence("b", "Fix GROUP BY mismatch in affiliation_query"),
      evidence("c", "Fixing DB connection tests in worker"),
      evidence("d", "Resolve crash when repo list is empty"),
    ]);
    expect(result.id).toBe("healer");
  });

  it("prioritizes guardian/scribe before keyword topic matches", () => {
    const reviewBugfix = deriveCharacterClass([
      evidence("a", "Fix API crash review", "review", "review"),
      evidence("b", "Review fixes for scheduler", "review", "review"),
      evidence("c", "Approve regression follow-up", "review", "review"),
    ]);
    expect(reviewBugfix.id).toBe("guardian");
    expect(reviewBugfix.basis.assignments.find((entry) => entry.evidenceId === "a")?.classId).toBe("guardian");
    const docFixes = deriveCharacterClass([
      evidence("c", "Fix guide typo", "documentation", "pull_request"),
      evidence("d", "Fix docs regression", "documentation", "pull_request"),
    ]);
    expect(docFixes.id).toBe("scribe");
  });

  it("returns adventurer for empty, insufficient, and tied top votes", () => {
    expect(deriveCharacterClass([]).id).toBe("adventurer");
    expect(deriveCharacterClass([evidence("a", "Implement endpoint")]).id).toBe("adventurer");
    const tied = deriveCharacterClass([evidence("a", "Fix regression"), evidence("b", "Implement API endpoint")]);
    expect(tied.id).toBe("adventurer");
    expect(tied.state).toBe("ambiguous");
  });

  it("keeps deterministic mix ordering and minority class visibility", () => {
    const mixed = deriveCharacterClass([
      evidence("3", "Implement API endpoint", "engineering", "pull_request", "chaoss/8Knot", "2024-02-03T00:00:00.000Z"),
      evidence("1", "Fix regression in scheduler", "engineering", "pull_request", "chaoss/8Knot", "2024-02-01T00:00:00.000Z"),
      evidence("2", "Patch bug in metrics", "engineering", "pull_request", "chaoss/8Knot", "2024-02-02T00:00:00.000Z"),
    ]);
    expect(mixed.id).toBe("healer");
    expect(mixed.state).toBe("hybrid");
    expect(mixed.mix[0]).toMatchObject({ classId: "healer", evidenceCount: 2 });
    expect(mixed.mix[1]).toMatchObject({ classId: "warrior", evidenceCount: 1 });
  });

  it("dedupes evidence ids and does not misclassify false-positive phrases", () => {
    const result = deriveCharacterClass([
      evidence("dup", "Repair docs for setup", "documentation", "issue"),
      evidence("dup", "Fix regression in runtime"),
      evidence("x", "domain model cleanup and user-agent docs", "engineering", "pull_request"),
      evidence("y", "Implement endpoint"),
      evidence("z1", "Add resolver for account graph"),
      evidence("z2", "PATCH endpoint for metadata"),
      evidence("z3", "Show next page button"),
      evidence("z4", "Improve type inference for props"),
      evidence("z5", "Prompt user before deleting repository"),
      evidence("z6", "Update data model for issues"),
    ]);
    expect(result.basis.consideredEvidenceIds.filter((id) => id === "dup")).toHaveLength(1);
    expect(result.basis.assignments.some((entry) => entry.evidenceId === "z1" && entry.classId === "healer")).toBe(false);
    expect(result.basis.assignments.some((entry) => entry.evidenceId === "z2" && entry.classId === "healer")).toBe(false);
    expect(result.specialties.some((entry) => entry.id === "ai" && entry.evidenceIds.some((id) => ["z4", "z5", "z6"].includes(id)))).toBe(false);
  });

  it("derives scoped specialties with evidence id backing", () => {
    const result = deriveCharacterClass([
      evidence("a", "Fix regression in API endpoint tests"),
      evidence("b", "Frontend component styling update"),
      evidence("c", "AI agents orchestration pipeline"),
    ]);
    const ids = new Set(result.specialties.map((item) => item.id));
    expect(ids.has("backend")).toBe(true);
    expect(ids.has("frontend")).toBe(true);
    expect(ids.has("ai")).toBe(true);
    expect(result.specialties.every((item) => item.evidenceIds.length > 0)).toBe(true);
  });

  it("rejects unqualified evidence before regex and keeps specialties scoped to qualifying evidence", () => {
    const result = deriveCharacterClass([
      evidence("a", "AI agents orchestration pipeline", "engineering", "pull_request", "chaoss/8Knot", "2024-01-01T00:00:00.000Z"),
      { ...evidence("b", "LLM inference and embeddings pipeline", "engineering", "pull_request"), state: "open" },
    ]);
    expect(result.id).toBe("adventurer");
    expect(result.basis.consideredEvidenceIds).toEqual(["a"]);
    expect(result.basis.rejectedEvidenceIds).toContain("b");
    expect(result.specialties.some((item) => item.id === "ai" && item.evidenceIds.includes("b"))).toBe(false);
  });

  it("captures explicit AI signals as specialty only and not primary mage", () => {
    const result = deriveCharacterClass([
      evidence("a", "AI agent orchestration for retrieval workflow"),
      evidence("b", "Embeddings and inference latency optimization"),
    ]);
    expect(result.id).toBe("warrior");
    expect(result.specialties.some((item) => item.id === "ai")).toBe(true);
  });

  it("does not infer AI-tool usage from assistance disclosures", () => {
    const result = deriveCharacterClass([
      evidence("a", "Refactor parser (AI-assisted)"),
      evidence("b", "Add chart with help from Copilot AI"),
    ]);
    expect(result.specialties.some((item) => item.id === "ai")).toBe(false);
  });

  it("requires meaningful runner-up share for hybrid", () => {
    const mostlyWarrior: ContributionEvidence[] = [];
    for (let i = 0; i < 8; i += 1) mostlyWarrior.push(evidence(`w-${i}`, `Implement service ${i}`));
    mostlyWarrior.push(evidence("h-1", "Fix regression in parser"));
    const result = deriveCharacterClass(mostlyWarrior);
    expect(result.id).toBe("warrior");
    expect(result.state).toBe("specialized");
  });

  it("returns empty specialties when no technical specialty signals are present", () => {
    const result = deriveCharacterClass([
      evidence("a", "Implement feature alpha"),
      evidence("b", "Build integration beta"),
    ]);
    expect(result.specialties).toEqual([]);
  });

  it("keeps duplicate-id tie resolution deterministic", () => {
    const first = deriveCharacterClass([
      evidence("dup", "Fix regression in scheduler", "engineering", "pull_request", "chaoss/8Knot", "2024-01-01T00:00:00.000Z"),
      evidence("dup", "Implement endpoint", "engineering", "pull_request", "chaoss/8Knot", "2024-01-01T00:00:00.000Z"),
    ]);
    const second = deriveCharacterClass([
      evidence("dup", "Implement endpoint", "engineering", "pull_request", "chaoss/8Knot", "2024-01-01T00:00:00.000Z"),
      evidence("dup", "Fix regression in scheduler", "engineering", "pull_request", "chaoss/8Knot", "2024-01-01T00:00:00.000Z"),
    ]);
    expect(first).toEqual(second);
  });

  it("derives self-reported mage activity and display title without changing earned title", () => {
    expect(isMageActive({ isAiEngineer: true, aiToolUsage: "none" })).toBe(true);
    expect(isMageActive({ isAiEngineer: false, aiToolUsage: "occasional" })).toBe(true);
    expect(isMageActive({ isAiEngineer: false, aiToolUsage: "unspecified" })).toBe(false);
    expect(deriveDisplayTitle("Gate Sentinel", { isAiEngineer: false, aiToolUsage: "none", mageQuiz: null })).toBe("Gate Sentinel");
    expect(deriveDisplayTitle("Gate Sentinel", { isAiEngineer: false, aiToolUsage: "frequent", mageQuiz: null })).toBe("Gate Sentinel · Mage");
    expect(
      deriveDisplayTitle("Gate Sentinel", {
        isAiEngineer: false,
        aiToolUsage: "frequent",
        mageQuiz: { workflow: "multi_agent", engineering: "integrating", verification: "automated_tests" },
      }),
    ).toBe("Gate Sentinel · Mage — Orchestrator");
  });

  it("derives mage quiz subclasses deterministically by thresholds", () => {
    const intelligence = deriveMagePath({ workflow: "agent_systems", engineering: "operating", verification: "continuous" });
    const agents = deriveMagePath({ workflow: "agent_systems", engineering: "building", verification: "evaluations" });
    const orchestrator = deriveMagePath({ workflow: "multi_agent", engineering: "integrating", verification: "manual" });
    const weaver = deriveMagePath({ workflow: "single_agent", engineering: "integrating", verification: "manual" });
    const prompt = deriveMagePath({ workflow: "prompting", engineering: "prompting", verification: "manual" });
    expect(intelligence?.id).toBe("intelligence_monarch");
    expect(agents?.id).toBe("agents_monarch");
    expect(orchestrator?.id).toBe("orchestrator");
    expect(weaver?.id).toBe("agent_weaver");
    expect(prompt?.id).toBe("prompt_adept");
  });

  it("keeps mage path monotonic across all quiz combinations", () => {
    const rank: Record<string, number> = {
      prompt_adept: 0,
      agent_weaver: 1,
      orchestrator: 2,
      agents_monarch: 3,
      intelligence_monarch: 4,
    };
    const workflows = ["prompting", "single_agent", "multi_agent", "agent_systems"] as const;
    const engineering = ["prompting", "integrating", "building", "operating"] as const;
    const verification = ["manual", "automated_tests", "evaluations", "continuous"] as const;
    let combos = 0;
    for (const e of engineering) {
      for (const v of verification) {
        let prev = -1;
        for (const w of workflows) {
          const path = deriveMagePath({ workflow: w, engineering: e, verification: v });
          expect(path).not.toBeNull();
          const current = rank[path!.id];
          expect(current).toBeGreaterThanOrEqual(prev);
          prev = current;
          combos += 1;
        }
      }
    }
    expect(combos).toBe(64);
  });

  it("exports class guide with class/specialty/state and distinction metadata", () => {
    const guide = getClassGuide();
    expect(guide.classifierVersion).toBe("v2");
    expect(guide.magePathVersion).toBe(MAGE_PATH_VERSION);
    expect(guide.classes.map((item) => item.id)).toEqual(["adventurer", "healer", "warrior", "mage", "scribe", "guardian"]);
    expect(guide.specialties.some((item) => item.id === "systems")).toBe(true);
    expect(guide.mageQuiz.questions.workflow.options.map((item) => item.value)).toContain("agent_systems");
    expect(guide.mageQuiz.paths.map((item) => item.id)).toContain("intelligence_monarch");
    expect(guide.mageQuiz.paths.every((item) => item.requirement.length > 20)).toBe(true);
    expect(guide.stateRules.some((item) => item.state === "ambiguous")).toBe(true);
    expect(guide.distinctions.progressionTitleVsClass).toMatch(/independent/i);
    expect(guide.distinctions.mageBadgeMode).toMatch(/self-reported/i);
    expect(guide.distinctions.magePathMode).toMatch(/quiz/i);
  });
});
