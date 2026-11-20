import type {
  AiToolUsage,
  CharacterClass,
  CharacterClassId,
  CharacterClassState,
  CharacterClassSpecialty,
  ContributionEvidence,
  ContributorClassPreference,
  MageEngineeringLevel,
  MagePath,
  MagePathId,
  MageQuizAnswers,
  MageVerificationLevel,
  MageWorkflowLevel,
  Profile,
  TechnicalSpecialtyId,
} from "@/lib/contracts";

export const CLASSIFIER_VERSION = "v2";
export const MAGE_PATH_VERSION = "v1";

type ClassGuideEntry = {
  id: CharacterClassId;
  name: string;
  summary: string;
  voteRule: string;
};

type SpecialtyGuideEntry = {
  id: TechnicalSpecialtyId;
  label: string;
  explanation: string;
};

type MageQuestionOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

type SpecialtyMatchOptions = { includeGeneral?: boolean };

type ClassVote = { classId: CharacterClassId; reason: string };
type Qualification = { ok: true } | { ok: false; reason: string };

const CLASS_META: Record<CharacterClassId, { name: string; summary: string }> = {
  adventurer: {
    name: "Adventurer",
    summary: "Neutral profile used when evidence is insufficient or ambiguous.",
  },
  healer: {
    name: "Healer",
    summary: "Frequently resolves bugs, regressions, and production breakages.",
  },
  warrior: {
    name: "Warrior",
    summary: "Implementation-heavy engineer focused on shipping code changes.",
  },
  mage: {
    name: "Mage",
    summary: "Self-reported AI engineer designation (opt-in).",
  },
  scribe: {
    name: "Scribe",
    summary: "Documentation-focused contributor improving clarity and guidance.",
  },
  guardian: {
    name: "Guardian",
    summary: "Review-focused contributor providing acceptance and quality gates.",
  },
};

const MAGE_PATHS: Record<MagePathId, { name: string; summary: string }> = {
  prompt_adept: {
    name: "Prompt Adept",
    summary: "Uses assistant prompting to accelerate personal development workflow.",
  },
  agent_weaver: {
    name: "Agent Weaver",
    summary: "Builds reusable single-agent workflows with integration depth.",
  },
  orchestrator: {
    name: "Orchestrator",
    summary: "Coordinates multi-agent flows and cross-agent work decomposition.",
  },
  agents_monarch: {
    name: "Agents Monarch",
    summary: "Designs multi-agent/tool systems with automated verification discipline.",
  },
  intelligence_monarch: {
    name: "Intelligence Monarch",
    summary: "Operates agent systems at production-like reliability with continuous evaluation/monitoring.",
  },
};

const WORKFLOW_LABELS: Record<MageWorkflowLevel, string> = {
  prompting: "Prompting",
  single_agent: "Single-agent",
  multi_agent: "Multi-agent",
  agent_systems: "Agent systems",
};
const ENGINEERING_LABELS: Record<MageEngineeringLevel, string> = {
  prompting: "Prompting only",
  integrating: "Integrating",
  building: "Building",
  operating: "Operating",
};
const VERIFICATION_LABELS: Record<MageVerificationLevel, string> = {
  manual: "Manual checks",
  automated_tests: "Automated tests",
  evaluations: "Evaluations",
  continuous: "Continuous monitoring",
};

const SPECIALTY_META: Record<TechnicalSpecialtyId, { label: string; explanation: string }> = {
  general: {
    label: "General Engineering",
    explanation: "No clear backend/frontend/AI/systems/QA keyword signal was found.",
  },
  backend: {
    label: "Backend",
    explanation: "Evidence titles mention APIs, servers, data, or backend service details.",
  },
  frontend: {
    label: "Frontend",
    explanation: "Evidence titles mention UI/client/component work.",
  },
  ai: {
    label: "AI/LLM",
    explanation: "Evidence titles mention AI/LLM/model/prompt specific work.",
  },
  systems: {
    label: "Systems/Architecture",
    explanation: "Evidence titles mention orchestration, architecture, or infrastructure concerns.",
  },
  qa: {
    label: "QA/Reliability",
    explanation: "Evidence titles emphasize tests, regressions, or bug quality controls.",
  },
};

const MIN_EVIDENCE_FOR_NON_NEUTRAL = 2;
const HYBRID_RUNNER_UP_THRESHOLD = 0.25;
const CLASS_IDS = ["healer", "warrior", "scribe", "guardian"] as const;

const BUG_SIGNAL = /\b(?:bug(?:fix)?|regression(?:s)?|hotfix)\b|\bfix(?:es|ed|ing)?(?:\([^)]+\))?!?:\s+|\bfix(?:es|ed|ing)?\s+(?:bug|regression|crash|failure|flaky|leak|race|issue|error)\b|\bfixes\s+#\d+\b|\bresolve[sd]?\s+(?:bug|regression|crash|error|failure)\b|\bpatch(?:es|ed|ing)?\s+(?:bug|regression|crash|issue|error)\b/i;
const DOCS_SIGNAL = /\b(doc(?:s|umentation)?|readme|guide|tutorial|changelog)\b/i;
const WARRIOR_SIGNAL = /\b(feat(?:ure)?|implement(?:s|ed|ing)?|build(?:s|ing)?|refactor(?:s|ed|ing)?|optimiz(?:e|ed|ing|ation)|ship(?:ped|ping)?)\b/i;
const AI_TOOL_DISCLOSURE_SIGNAL = /\b(ai[- ]assisted|with (?:help from )?(?:copilot|claude|chatgpt|ai)|generated (?:by|with)|co-authored)\b/i;

const SPECIALTY_PATTERNS: Array<{ id: TechnicalSpecialtyId; regex: RegExp }> = [
  { id: "backend", regex: /\b(api|backend|server|database|db|sql|postgres|sqlite|auth|endpoint|service)\b/i },
  { id: "frontend", regex: /\b(frontend|front-end|ui|ux|react|next(?:\.js|js)\b|css|html|component|client-side|ui client)\b/i },
  { id: "ai", regex: /\b(ai\s+(?:agent|agents|feature|search|system)|llms?|embeddings?|rag|prompt engineering|model (?:serving|inference|training)|inference (?:pipeline|service|latency))\b|\b(agentic)\b|\bagents?\s+(?:orchestrat(?:ion|or)|workflow|routing|pipeline)\b/i },
  { id: "systems", regex: /\b(orchestrat(?:e|ion|or)|architect(?:ure|ural)?|infra(?:structure)?|kubernetes|docker|distributed|scalability)\b|(?:^|\s)(?:ci|cd|ci\/cd)\b/i },
  { id: "qa", regex: /\b(test(?:s|ing)?|qa|regression|bug|hotfix)\b/i },
];

function normalizeTitle(value: string): string {
  return value.trim();
}

function qualificationForEvidence(evidence: ContributionEvidence): Qualification {
  if (evidence.kind === "review") {
    return evidence.state === "submitted"
      ? { ok: true }
      : { ok: false, reason: "review is not submitted" };
  }
  if (evidence.kind === "pull_request") {
    return evidence.state === "merged"
      ? { ok: true }
      : { ok: false, reason: "pull request is not merged" };
  }
  if (evidence.kind === "issue") {
    if (evidence.track !== "documentation") return { ok: false, reason: "issue is not documentation track" };
    return evidence.state === "closed"
      ? { ok: true }
      : { ok: false, reason: "documentation issue is not closed" };
  }
  return { ok: false, reason: "unsupported evidence kind" };
}

function classifyEvidence(evidence: ContributionEvidence): ClassVote | null {
  const title = normalizeTitle(evidence.title);
  if (evidence.kind === "review" || evidence.track === "review") {
    return { classId: "guardian", reason: "review evidence votes for guardian" };
  }
  if (evidence.track === "documentation" || DOCS_SIGNAL.test(title)) {
    return { classId: "scribe", reason: "documentation evidence votes for scribe" };
  }
  const looksLikeBugFix = BUG_SIGNAL.test(title);
  if (looksLikeBugFix) {
    return { classId: "healer", reason: "title contains conservative bug-fix/regression terminology" };
  }
  if ((evidence.kind === "pull_request" || evidence.track === "engineering") && WARRIOR_SIGNAL.test(title)) {
    return { classId: "warrior", reason: "implementation-oriented title keywords vote for warrior" };
  }
  if (evidence.kind === "pull_request" || evidence.track === "engineering") {
    return { classId: "warrior", reason: "engineering implementation contribution votes for warrior" };
  }
  return null;
}

export function matchSpecialtiesForTitle(titleInput: string, options: SpecialtyMatchOptions = {}): TechnicalSpecialtyId[] {
  const title = normalizeTitle(titleInput);
  const suppressAiToolInference = AI_TOOL_DISCLOSURE_SIGNAL.test(title);
  const ids: TechnicalSpecialtyId[] = [];
  for (const pattern of SPECIALTY_PATTERNS) {
    if (suppressAiToolInference && pattern.id === "ai") continue;
    if (pattern.regex.test(title)) ids.push(pattern.id);
  }
  if (ids.length === 0 && options.includeGeneral) return ["general"];
  return ids;
}

function classifySpecialties(evidence: ContributionEvidence[]): CharacterClassSpecialty[] {
  const bucket = new Map<TechnicalSpecialtyId, Set<string>>();
  for (const item of evidence) {
    for (const specialtyId of matchSpecialtiesForTitle(item.title, { includeGeneral: false })) {
      const ids = bucket.get(specialtyId) ?? new Set<string>();
      ids.add(item.id);
      bucket.set(specialtyId, ids);
    }
  }
  if (bucket.size === 0) return [];
  return [...bucket.entries()]
    .map(([id, ids]) => ({
      id,
      label: SPECIALTY_META[id].label,
      explanation: SPECIALTY_META[id].explanation,
      evidenceIds: [...ids].sort(),
    }))
    .sort((a, b) => b.evidenceIds.length - a.evidenceIds.length || a.id.localeCompare(b.id));
}

function classStateForVotes(primary: CharacterClassId, totalVotes: number, tiedTop: boolean, mixCount: number): CharacterClassState {
  if (primary === "adventurer") return tiedTop ? "ambiguous" : "provisional";
  if (mixCount > 1) return "hybrid";
  if (totalVotes >= MIN_EVIDENCE_FOR_NON_NEUTRAL) return "specialized";
  return "provisional";
}

function summaryForClass(id: CharacterClassId, state: CharacterClassState, totalVotes: number): string {
  const base = CLASS_META[id].summary;
  if (id === "adventurer" && state === "ambiguous") return `${base} Current evidence splits across multiple classes.`;
  if (id === "adventurer") return `${base} Add more scoped contributions to establish a stable class.`;
  if (state === "hybrid") return `${base} Current mix shows meaningful cross-class signals.`;
  if (state === "provisional") return `${base} Classification is provisional until more qualifying evidence is available.`;
  return `${base} Based on ${totalVotes} qualifying contributions.`;
}

export function deriveCharacterClass(evidenceInput: ContributionEvidence[]): CharacterClass {
  const seen = new Set<string>();
  const uniqueEvidence = [...evidenceInput]
    .sort((a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
      || a.id.localeCompare(b.id)
      || a.title.localeCompare(b.title)
      || a.repositoryId.localeCompare(b.repositoryId)
      || a.kind.localeCompare(b.kind)
      || a.track.localeCompare(b.track)
      || a.state.localeCompare(b.state),
    )
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  const evidence: ContributionEvidence[] = [];

  const votes = new Map<CharacterClassId, ContributionEvidence[]>();
  const consideredEvidenceIds: string[] = [];
  const rejectedEvidenceIds: string[] = [];
  const assignments: Array<{ evidenceId: string; classId: CharacterClassId; reason: string }> = [];
  for (const item of uniqueEvidence) {
    const qualification = qualificationForEvidence(item);
    if (!qualification.ok) {
      rejectedEvidenceIds.push(item.id);
      continue;
    }
    evidence.push(item);
    const vote = classifyEvidence(item);
    if (!vote) {
      rejectedEvidenceIds.push(item.id);
      continue;
    }
    consideredEvidenceIds.push(item.id);
    assignments.push({ evidenceId: item.id, classId: vote.classId, reason: vote.reason });
    const bucket = votes.get(vote.classId) ?? [];
    bucket.push(item);
    votes.set(vote.classId, bucket);
  }

  const totalVotes = consideredEvidenceIds.length;
  const rank = CLASS_IDS
    .map((classId) => ({ classId, count: votes.get(classId)?.length ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.classId.localeCompare(b.classId));
  const highestCount = rank[0]?.count ?? 0;
  const topTies = rank.filter((entry) => entry.count === highestCount);
  const insufficient = totalVotes < MIN_EVIDENCE_FOR_NON_NEUTRAL;
  const primary: CharacterClassId = totalVotes === 0 || insufficient || topTies.length > 1 ? "adventurer" : rank[0].classId;
  const runnerUpShare = rank.length > 1 ? rank[1].count / totalVotes : 0;
  const meaningfulRunnerUp = runnerUpShare >= HYBRID_RUNNER_UP_THRESHOLD;

  const mix = rank.map((entry) => ({
    classId: entry.classId,
    share: Number((entry.count / totalVotes).toFixed(4)),
    evidenceCount: entry.count,
    evidenceIds: (votes.get(entry.classId) ?? []).map((item) => item.id),
  }));
  const specialties = classifySpecialties(evidence);
  const limits = [
    "Derived from imported contribution metadata (kind, track, and title text) only.",
    "Only qualifying evidence contributes votes: merged pull requests, submitted reviews, and closed documentation issues.",
    "No inference is made about tool usage, objective ability, or contribution quality.",
    "Unsupported or non-qualifying evidence contributes no class votes.",
  ];
  if (insufficient) {
    limits.push(`At least ${MIN_EVIDENCE_FOR_NON_NEUTRAL} qualifying votes are required for a non-neutral primary class.`);
  }
  if (topTies.length > 1) {
    limits.push("Top vote tie keeps the primary class neutral (Adventurer) until the tie is broken.");
  }

  const state = classStateForVotes(
    primary,
    totalVotes,
    topTies.length > 1,
    primary === "adventurer" ? mix.length : meaningfulRunnerUp ? mix.length : 1,
  );
  return {
    id: primary,
    name: CLASS_META[primary].name,
    summary: summaryForClass(primary, state, totalVotes),
    state,
    mix,
    specialties: specialties.map((specialty) => ({
      ...specialty,
      explanation: specialty.id === "general"
        ? specialty.explanation
        : `${specialty.explanation} (${specialty.evidenceIds.length} supporting contributions).`,
    })),
    basis: {
      classifierVersion: CLASSIFIER_VERSION,
      qualifyingEvidenceCount: totalVotes,
      consideredEvidenceIds,
      rejectedEvidenceIds,
      assignments,
    },
    classificationLimits: limits,
  };
}

export type ClassGuide = {
  classifierVersion: string;
  magePathVersion: string;
  classes: ClassGuideEntry[];
  specialties: SpecialtyGuideEntry[];
  mageQuiz: {
    questions: {
      workflow: { label: string; options: MageQuestionOption<MageWorkflowLevel>[] };
      engineering: { label: string; options: MageQuestionOption<MageEngineeringLevel>[] };
      verification: { label: string; options: MageQuestionOption<MageVerificationLevel>[] };
      usage: { label: string; options: MageQuestionOption<AiToolUsage>[] };
    };
    paths: Array<{ id: MagePathId; name: string; summary: string; requirement: string }>;
  };
  stateRules: Array<{ state: CharacterClassState; meaning: string }>;
  votePolicy: {
    oneVotePerContribution: string;
    dedupeRule: string;
    qualificationRule: string;
    precedenceRule: string;
    tieRule: string;
    insufficientEvidenceRule: string;
    scopeRule: string;
  };
    distinctions: {
      progressionTitleVsClass: string;
      mageBadgeMode: string;
      magePathMode: string;
      evolveHint: string;
    };
};

export const AI_TOOL_USAGE_VALUES = ["unspecified", "none", "occasional", "frequent", "ai_first"] as const satisfies ReadonlyArray<AiToolUsage>;
export const MAGE_WORKFLOW_LEVELS = ["prompting", "single_agent", "multi_agent", "agent_systems"] as const satisfies ReadonlyArray<MageWorkflowLevel>;
export const MAGE_ENGINEERING_LEVELS = ["prompting", "integrating", "building", "operating"] as const satisfies ReadonlyArray<MageEngineeringLevel>;
export const MAGE_VERIFICATION_LEVELS = ["manual", "automated_tests", "evaluations", "continuous"] as const satisfies ReadonlyArray<MageVerificationLevel>;

type MagePathRule = {
  id: MagePathId;
  requirement: string;
  matches: (quiz: MageQuizAnswers) => boolean;
};

const MAGE_PATH_RULES: MagePathRule[] = [
  {
    id: "intelligence_monarch",
    requirement: "Workflow is Agent systems, Engineering is Operating, and Verification is Continuous monitoring.",
    matches: (quiz) => quiz.workflow === "agent_systems" && quiz.engineering === "operating" && quiz.verification === "continuous",
  },
  {
    id: "agents_monarch",
    requirement: "Workflow is Multi-agent or Agent systems, Engineering is Building/Operating, and Verification is Automated tests, Evaluations, or Continuous monitoring.",
    matches: (quiz) =>
      (quiz.workflow === "multi_agent" || quiz.workflow === "agent_systems")
      && (quiz.engineering === "building" || quiz.engineering === "operating")
      && (quiz.verification === "automated_tests" || quiz.verification === "evaluations" || quiz.verification === "continuous"),
  },
  {
    id: "orchestrator",
    requirement: "Workflow is Multi-agent or Agent systems with Engineering at Integrating or higher.",
    matches: (quiz) =>
      (quiz.workflow === "multi_agent" || quiz.workflow === "agent_systems")
      && (quiz.engineering === "integrating" || quiz.engineering === "building" || quiz.engineering === "operating"),
  },
  {
    id: "agent_weaver",
    requirement: "Workflow is Single-agent or beyond with Engineering at Integrating or higher.",
    matches: (quiz) =>
      (quiz.workflow === "single_agent" || quiz.workflow === "multi_agent" || quiz.workflow === "agent_systems")
      && (quiz.engineering === "integrating" || quiz.engineering === "building" || quiz.engineering === "operating"),
  },
  {
    id: "prompt_adept",
    requirement: "Fallback path when higher-path requirements are not met.",
    matches: () => true,
  },
];

export function deriveMagePath(quiz: MageQuizAnswers | null): MagePath | null {
  if (!quiz) return null;
  const rule = MAGE_PATH_RULES.find((entry) => entry.matches(quiz)) ?? MAGE_PATH_RULES[MAGE_PATH_RULES.length - 1];
  const pathId = rule.id;
  const meta = MAGE_PATHS[pathId];
  return {
    id: pathId,
    name: meta.name,
    summary: meta.summary,
    explanation: `Derived from self-reported workflow ${WORKFLOW_LABELS[quiz.workflow]}, engineering ${ENGINEERING_LABELS[quiz.engineering]}, and verification ${VERIFICATION_LABELS[quiz.verification]}. Matched requirement: ${rule.requirement}.`,
    classifierVersion: MAGE_PATH_VERSION,
    selfReported: true,
  };
}

export function defaultClassPreference(editable: boolean): ContributorClassPreference {
  return {
    isAiEngineer: false,
    aiToolUsage: "unspecified",
    mageActive: false,
    mageQuiz: null,
    magePath: null,
    editable,
  };
}

export function isMageActive(input: Pick<ContributorClassPreference, "isAiEngineer" | "aiToolUsage">): boolean {
  return input.isAiEngineer || input.aiToolUsage === "occasional" || input.aiToolUsage === "frequent" || input.aiToolUsage === "ai_first";
}

export function deriveDisplayTitle(earnedTitle: string, preference: Pick<ContributorClassPreference, "isAiEngineer" | "aiToolUsage"> & { mageQuiz?: MageQuizAnswers | null }): string {
  if (!isMageActive(preference)) return earnedTitle;
  const path = deriveMagePath(preference.mageQuiz ?? null);
  return path ? `${earnedTitle} · Mage — ${path.name}` : `${earnedTitle} · Mage`;
}

export function withMagePreference(preference: Pick<ContributorClassPreference, "isAiEngineer" | "aiToolUsage"> & { mageQuiz?: MageQuizAnswers | null }, editable: boolean): ContributorClassPreference {
  const mageActive = isMageActive(preference);
  const magePath = mageActive ? deriveMagePath(preference.mageQuiz ?? null) : null;
  return {
    isAiEngineer: preference.isAiEngineer,
    aiToolUsage: preference.aiToolUsage,
    mageActive,
    mageQuiz: preference.mageQuiz ?? null,
    magePath,
    editable,
  };
}

export function buildProfileWithDisplayTitle(base: Omit<Profile, "title" | "displayTitle"> & { title: string }, preference: Pick<ContributorClassPreference, "isAiEngineer" | "aiToolUsage"> & { mageQuiz?: MageQuizAnswers | null }): Profile {
  return {
    ...base,
    displayTitle: deriveDisplayTitle(base.title, preference),
  };
}

export function getClassGuide(): ClassGuide {
  return {
    classifierVersion: CLASSIFIER_VERSION,
    magePathVersion: MAGE_PATH_VERSION,
    classes: [
      { id: "adventurer", name: CLASS_META.adventurer.name, summary: CLASS_META.adventurer.summary, voteRule: "Selected when no/insufficient evidence exists or top classes tie." },
      { id: "healer", name: CLASS_META.healer.name, summary: CLASS_META.healer.summary, voteRule: "Votes from conservative bug-fix/regression title matches." },
      { id: "warrior", name: CLASS_META.warrior.name, summary: CLASS_META.warrior.summary, voteRule: "Votes from implementation-heavy engineering contributions." },
      { id: "mage", name: CLASS_META.mage.name, summary: CLASS_META.mage.summary, voteRule: "Not auto-classified from evidence; appears only as self-reported add-on." },
      { id: "scribe", name: CLASS_META.scribe.name, summary: CLASS_META.scribe.summary, voteRule: "Votes from documentation contributions." },
      { id: "guardian", name: CLASS_META.guardian.name, summary: CLASS_META.guardian.summary, voteRule: "Votes from review contributions." },
    ],
    specialties: (Object.keys(SPECIALTY_META) as TechnicalSpecialtyId[]).map((id) => ({
      id,
      label: SPECIALTY_META[id].label,
      explanation: SPECIALTY_META[id].explanation,
    })),
    mageQuiz: {
      questions: {
        workflow: {
          label: "What type of AI workflow do you usually run?",
          options: [
            { value: "prompting", label: "Prompting", description: "Directly prompt assistants without reusable agents." },
            { value: "single_agent", label: "Single-agent", description: "Use reusable single-agent workflows." },
            { value: "multi_agent", label: "Multi-agent", description: "Coordinate multiple cooperating agents." },
            { value: "agent_systems", label: "Agent systems", description: "Design and operate multi-agent/tool systems." },
          ],
        },
        engineering: {
          label: "How deep is your AI engineering implementation?",
          options: [
            { value: "prompting", label: "Prompting only", description: "Mostly prompt design and adaptation." },
            { value: "integrating", label: "Integrating", description: "Integrate AI capabilities into existing systems." },
            { value: "building", label: "Building", description: "Build reusable AI workflow components." },
            { value: "operating", label: "Operating", description: "Operate production-like AI systems and tooling." },
          ],
        },
        verification: {
          label: "How do you verify AI behavior?",
          options: [
            { value: "manual", label: "Manual checks", description: "Human inspection and ad hoc checks." },
            { value: "automated_tests", label: "Automated tests", description: "Automated test cases for behavior checks." },
            { value: "evaluations", label: "Evaluations", description: "Structured evals/benchmarks beyond test cases." },
            { value: "continuous", label: "Continuous monitoring", description: "Continuous eval + monitoring in operation." },
          ],
        },
        usage: {
          label: "How often do you rely on AI engineering tools?",
          options: [
            { value: "unspecified", label: "Unspecified", description: "No self-report selected yet." },
            { value: "none", label: "None", description: "Do not rely on AI engineering tools." },
            { value: "occasional", label: "Occasional", description: "Use AI engineering tools on selected tasks." },
            { value: "frequent", label: "Frequent", description: "Use AI engineering tools in many tasks." },
            { value: "ai_first", label: "AI-first", description: "AI engineering tools are a default workflow." },
          ],
        },
      },
      paths: MAGE_PATH_RULES.map((rule) => ({
        id: rule.id,
        ...MAGE_PATHS[rule.id],
        requirement: rule.requirement,
      })),
    },
    stateRules: [
      { state: "provisional", meaning: "Low evidence volume or early signals; class may shift quickly." },
      { state: "specialized", meaning: "One class has stable evidence dominance." },
      { state: "hybrid", meaning: `Primary class exists and runner-up share is at least ${Math.round(HYBRID_RUNNER_UP_THRESHOLD * 100)}%.` },
      { state: "ambiguous", meaning: "Top class votes tie, so neutral Adventurer is retained." },
    ],
    votePolicy: {
      oneVotePerContribution: "Each qualifying contribution can cast at most one class vote.",
      dedupeRule: "Duplicate evidence IDs are ignored after first occurrence.",
      qualificationRule: "Only merged pull requests, submitted reviews, and closed documentation issues are eligible for voting.",
      precedenceRule: "Vote precedence is Guardian (review) → Scribe (documentation) → Healer bug signals → Warrior engineering fallback.",
      tieRule: "A top-vote tie resolves to Adventurer for deterministic neutrality.",
      insufficientEvidenceRule: `At least ${MIN_EVIDENCE_FOR_NON_NEUTRAL} qualifying votes are required for a non-neutral primary class.`,
      scopeRule: "Classification uses only the scoped snapshot evidence set (global vs repository).",
    },
    distinctions: {
      progressionTitleVsClass: "Progression titles and ranks remain independent from role class classification.",
      mageBadgeMode: "Mage is a self-reported preference (AI engineer / AI-tool usage), not an evidence-derived primary class.",
      magePathMode: "Mage subclass path is derived only from optional self-reported quiz answers when Mage is active.",
      evolveHint: "To evolve from Adventurer, add more qualifying scoped contributions that break ties and raise evidence volume.",
    },
  };
}
