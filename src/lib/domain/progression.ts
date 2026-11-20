import type {
  Achievement,
  ContributionEvidence,
  DashboardScope,
  DashboardSnapshot,
  Profile,
  Progression,
  Quest,
  Rank,
  Repository,
  SkillTrack,
  TrackProgress,
  ContributorClassPreference,
  MasteryProgress,
} from "@/lib/contracts";
import { buildProfileWithDisplayTitle, defaultClassPreference, deriveCharacterClass, withMagePreference } from "./classes";
import { deriveMastery, getMasteryGuide } from "./mastery";

export const SCORING_VERSION = "v2";
export const TRACK_NAMES: Record<SkillTrack, string> = {
  engineering: "Engineering",
  documentation: "Documentation",
  review: "Review",
};

export const LEVEL_STEP = 120;

export const XP_RULES = {
  mergedEngineeringPr: 120,
  mergedDocumentationPr: 95,
  submittedReview: 70,
  documentationIssue: 60,
} as const;

const RANK_THRESHOLDS = {
  mergedPrsForC: 3,
  docsForB: 3,
  reviewsForB: 3,
  mergedPrsForA: 8,
  unlockedForS: 12,
  docsForS: 10,
  reviewsForS: 10,
} as const;

const GLOBAL_ONLY_ACHIEVEMENT_IDS = ["realm-dual", "realm-triple"] as const;
const TITLE_UNLOCK_THRESHOLDS = {
  mergedPrFirst: 1,
  mergedPrAdvanced: 10,
  docsFirst: 1,
  docsAdvanced: 10,
  reviewFirst: 1,
  reviewAdvanced: 10,
  repositoriesForRealmWalker: 2,
} as const;

type TitleRule = {
  title: string;
  meaning: string;
  unlock: string;
  globalOnly: boolean;
  unlocked: (ctx: EvidenceState, rank: Rank) => boolean;
};

const TITLE_RULES: TitleRule[] = [
  {
    title: "Merge Initiate",
    meaning: "First successful contributor milestone.",
    unlock: `Land ${TITLE_UNLOCK_THRESHOLDS.mergedPrFirst} merged pull request.`,
    globalOnly: false,
    unlocked: (ctx) => mergedPullRequests(ctx).length >= TITLE_UNLOCK_THRESHOLDS.mergedPrFirst,
  },
  {
    title: "Integration Pathfinder",
    meaning: "Consistently lands substantive merged work.",
    unlock: `Land ${TITLE_UNLOCK_THRESHOLDS.mergedPrAdvanced} merged pull requests.`,
    globalOnly: false,
    unlocked: (ctx) => mergedPullRequests(ctx).length >= TITLE_UNLOCK_THRESHOLDS.mergedPrAdvanced,
  },
  {
    title: "Doc Scribe",
    meaning: "Contributes documentation improvements.",
    unlock: `Complete ${TITLE_UNLOCK_THRESHOLDS.docsFirst} documentation contribution.`,
    globalOnly: false,
    unlocked: (ctx) => ctx.byTrack.documentation.length >= TITLE_UNLOCK_THRESHOLDS.docsFirst,
  },
  {
    title: "Lorekeeper",
    meaning: "Maintains documentation depth over time.",
    unlock: `Complete ${TITLE_UNLOCK_THRESHOLDS.docsAdvanced} documentation contributions.`,
    globalOnly: false,
    unlocked: (ctx) => ctx.byTrack.documentation.length >= TITLE_UNLOCK_THRESHOLDS.docsAdvanced,
  },
  {
    title: "Review Scout",
    meaning: "Provides accepted review feedback.",
    unlock: `Submit ${TITLE_UNLOCK_THRESHOLDS.reviewFirst} qualifying review.`,
    globalOnly: false,
    unlocked: (ctx) => ctx.byTrack.review.length >= TITLE_UNLOCK_THRESHOLDS.reviewFirst,
  },
  {
    title: "Gate Sentinel",
    meaning: "Reliably upholds quality in review.",
    unlock: `Submit ${TITLE_UNLOCK_THRESHOLDS.reviewAdvanced} qualifying reviews.`,
    globalOnly: false,
    unlocked: (ctx) => ctx.byTrack.review.length >= TITLE_UNLOCK_THRESHOLDS.reviewAdvanced,
  },
  {
    title: "Realm Walker",
    meaning: "Contributes across multiple tracked repositories.",
    unlock: `Contribute in ${TITLE_UNLOCK_THRESHOLDS.repositoriesForRealmWalker} tracked repositories.`,
    globalOnly: true,
    unlocked: (ctx) => ctx.byRepo.size >= TITLE_UNLOCK_THRESHOLDS.repositoriesForRealmWalker,
  },
  {
    title: "Open Source Champion",
    meaning: "Top progression rank reached.",
    unlock: "Reach rank S.",
    globalOnly: false,
    unlocked: (_ctx, rank) => rank === "S",
  },
];

const RANK_GUIDE = [
  { rank: "E", meaning: "Entry rank while building early contribution evidence." },
  { rank: "D", meaning: "Cross-track contributor with foundational milestones." },
  { rank: "C", meaning: "Active contributor with merged pull-request depth." },
  { rank: "B", meaning: "Balanced contributor across build, docs and review." },
  { rank: "A", meaning: "High-output contributor with strong merged contribution depth." },
  { rank: "S", meaning: "Sustained contributor with broad achievement completion." },
] as const satisfies ReadonlyArray<{ rank: Rank; meaning: string }>;

function xpForNextLevel(level: number): number {
  return Math.max(LEVEL_STEP, level * LEVEL_STEP);
}

function levelFromXp(totalXp: number): { level: number; levelXp: number; nextLevelXp: number } {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  return { level, levelXp: remaining, nextLevelXp: xpForNextLevel(level) };
}

type EvidenceState = {
  evidence: ContributionEvidence[];
  byTrack: Record<SkillTrack, ContributionEvidence[]>;
  byRepo: Map<string, ContributionEvidence[]>;
};

function pullRequests(ctx: EvidenceState): ContributionEvidence[] {
  return ctx.evidence.filter((item) => item.kind === "pull_request");
}

function prepareEvidence(input: ContributionEvidence[]): EvidenceState {
  const evidence = [...input].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const byTrack: Record<SkillTrack, ContributionEvidence[]> = {
    engineering: [],
    documentation: [],
    review: [],
  };
  const byRepo = new Map<string, ContributionEvidence[]>();
  for (const item of evidence) {
    byTrack[item.track].push(item);
    const bucket = byRepo.get(item.repositoryId) ?? [];
    bucket.push(item);
    byRepo.set(item.repositoryId, bucket);
  }
  return { evidence, byTrack, byRepo };
}

function mergedPullRequests(ctx: EvidenceState): ContributionEvidence[] {
  return ctx.evidence.filter((item) => item.kind === "pull_request");
}

function firstN(ids: string[], n: number): string[] {
  return ids.slice(0, Math.max(0, n));
}

type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  track: SkillTrack | "general";
  target: number;
  progress: (ctx: EvidenceState) => number;
  evidenceIds: (ctx: EvidenceState) => string[];
};

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "merge-initiate",
    name: "Merge Initiate",
    description: "Land your first merged pull request.",
    icon: "🛠️",
    track: "engineering",
    target: 1,
    progress: (ctx) => mergedPullRequests(ctx).length,
    evidenceIds: (ctx) => firstN(mergedPullRequests(ctx).map((e) => e.id), 1),
  },
  {
    id: "merge-vanguard",
    name: "Merge Vanguard",
    description: "Land 5 merged pull requests.",
    icon: "⚙️",
    track: "engineering",
    target: 5,
    progress: (ctx) => mergedPullRequests(ctx).length,
    evidenceIds: (ctx) => firstN(mergedPullRequests(ctx).map((e) => e.id), 5),
  },
  {
    id: "merge-architect",
    name: "Merge Architect",
    description: "Land 15 merged pull requests.",
    icon: "🏗️",
    track: "engineering",
    target: 15,
    progress: (ctx) => mergedPullRequests(ctx).length,
    evidenceIds: (ctx) => firstN(mergedPullRequests(ctx).map((e) => e.id), 15),
  },
  {
    id: "scribe-awakens",
    name: "Scribe Awakens",
    description: "Record your first documentation contribution.",
    icon: "📝",
    track: "documentation",
    target: 1,
    progress: ({ byTrack }) => byTrack.documentation.length,
    evidenceIds: ({ byTrack }) => firstN(byTrack.documentation.map((e) => e.id), 1),
  },
  {
    id: "scribe-steady",
    name: "Scribe Steady",
    description: "Complete 4 documentation contributions.",
    icon: "📚",
    track: "documentation",
    target: 4,
    progress: ({ byTrack }) => byTrack.documentation.length,
    evidenceIds: ({ byTrack }) => firstN(byTrack.documentation.map((e) => e.id), 4),
  },
  {
    id: "scribe-master",
    name: "Scribe Master",
    description: "Complete 10 documentation contributions.",
    icon: "📖",
    track: "documentation",
    target: 10,
    progress: ({ byTrack }) => byTrack.documentation.length,
    evidenceIds: ({ byTrack }) => firstN(byTrack.documentation.map((e) => e.id), 10),
  },
  {
    id: "reviewer-first-pass",
    name: "First Pass",
    description: "Submit your first accepted review signal.",
    icon: "🔍",
    track: "review",
    target: 1,
    progress: ({ byTrack }) => byTrack.review.length,
    evidenceIds: ({ byTrack }) => firstN(byTrack.review.map((e) => e.id), 1),
  },
  {
    id: "reviewer-keeper",
    name: "Gate Keeper",
    description: "Submit 5 accepted review signals.",
    icon: "🧭",
    track: "review",
    target: 5,
    progress: ({ byTrack }) => byTrack.review.length,
    evidenceIds: ({ byTrack }) => firstN(byTrack.review.map((e) => e.id), 5),
  },
  {
    id: "reviewer-sentinel",
    name: "Review Sentinel",
    description: "Submit 12 accepted review signals.",
    icon: "🛡️",
    track: "review",
    target: 12,
    progress: ({ byTrack }) => byTrack.review.length,
    evidenceIds: ({ byTrack }) => firstN(byTrack.review.map((e) => e.id), 12),
  },
  {
    id: "cross-discipline",
    name: "Cross Discipline",
    description: "Earn evidence in all three tracks.",
    icon: "🌉",
    track: "general",
    target: 3,
    progress: ({ byTrack }) => (["engineering", "documentation", "review"] as const).filter((track) => byTrack[track].length > 0).length,
    evidenceIds: ({ byTrack }) =>
      (["engineering", "documentation", "review"] as const)
        .map((track) => byTrack[track][0]?.id)
        .filter((id): id is string => Boolean(id)),
  },
  {
    id: "realm-dual",
    name: "Realm Walker",
    description: "Contribute in 2 repositories.",
    icon: "🗺️",
    track: "general",
    target: 2,
    progress: ({ byRepo }) => byRepo.size,
    evidenceIds: ({ byRepo }) => [...byRepo.values()].map((items) => items[0]?.id).filter((id): id is string => Boolean(id)).slice(0, 2),
  },
  {
    id: "realm-triple",
    name: "Realm Cartographer",
    description: "Track and contribute in 3 repositories (add a third tracked repository to unlock).",
    icon: "🧭",
    track: "general",
    target: 3,
    progress: ({ byRepo }) => byRepo.size,
    evidenceIds: ({ byRepo }) => [...byRepo.values()].map((items) => items[0]?.id).filter((id): id is string => Boolean(id)).slice(0, 3),
  },
  {
    id: "history-deep",
    name: "History Deep-Dive",
    description: "Record 25 pieces of evidence.",
    icon: "⏳",
    track: "general",
    target: 25,
    progress: ({ evidence }) => evidence.length,
    evidenceIds: ({ evidence }) => firstN(evidence.map((e) => e.id), 25),
  },
  {
    id: "history-epic",
    name: "Epic Chronicle",
    description: "Record 75 pieces of evidence.",
    icon: "🏔️",
    track: "general",
    target: 75,
    progress: ({ evidence }) => evidence.length,
    evidenceIds: ({ evidence }) => firstN(evidence.map((e) => e.id), 75),
  },
  {
    id: "cadence-steady",
    name: "Steady Cadence",
    description: "Contribute in 3 different calendar months.",
    icon: "📅",
    track: "general",
    target: 3,
    progress: ({ evidence }) => new Set(evidence.map((e) => e.occurredAt.slice(0, 7))).size,
    evidenceIds: ({ evidence }) => {
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const item of evidence) {
        const month = item.occurredAt.slice(0, 7);
        if (seen.has(month)) continue;
        seen.add(month);
        ids.push(item.id);
      }
      return ids.slice(0, 3);
    },
  },
];

function deriveAchievements(ctx: EvidenceState): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const progress = definition.progress(ctx);
    const evidenceIds = definition.evidenceIds(ctx);
    const unlockEvidenceId = progress >= definition.target ? evidenceIds[definition.target - 1] : undefined;
    const unlockedAt = unlockEvidenceId ? ctx.evidence.find((item) => item.id === unlockEvidenceId)?.occurredAt ?? null : null;
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      track: definition.track,
      progress: Math.min(progress, definition.target),
      target: definition.target,
      unlockedAt,
      evidenceIds,
    };
  });
}

function deriveRank(ctx: EvidenceState, achievements: Achievement[]): { rank: Rank; nextRankRequirement: string | null } {
  const trackCoverage = (["engineering", "documentation", "review"] as const).filter((track) => ctx.byTrack[track].length > 0).length;
  const mergedPrs = mergedPullRequests(ctx).length;
  const docs = ctx.byTrack.documentation.length;
  const reviews = ctx.byTrack.review.length;
  const unlocked = achievements.filter((item) => item.unlockedAt !== null).length;
  const next = (text: string, rank: Rank) => ({ rank, nextRankRequirement: text });
  if (trackCoverage < 1) return next("Submit one qualifying contribution.", "E");
  if (trackCoverage < 2) return next("Contribute in a second track to reach rank D.", "E");
  if (mergedPrs < RANK_THRESHOLDS.mergedPrsForC) return next(`Land ${RANK_THRESHOLDS.mergedPrsForC} merged pull requests to reach rank C.`, "D");
  if (docs < RANK_THRESHOLDS.docsForB || reviews < RANK_THRESHOLDS.reviewsForB) return next(`Add at least ${RANK_THRESHOLDS.docsForB} documentation and ${RANK_THRESHOLDS.reviewsForB} review contributions for rank B.`, "C");
  if (mergedPrs < RANK_THRESHOLDS.mergedPrsForA) return next(`Reach ${RANK_THRESHOLDS.mergedPrsForA} merged pull requests to reach rank A.`, "B");
  if (unlocked < RANK_THRESHOLDS.unlockedForS || docs < RANK_THRESHOLDS.docsForS || reviews < RANK_THRESHOLDS.reviewsForS) {
    return next(`Unlock ${RANK_THRESHOLDS.unlockedForS} achievements plus ${RANK_THRESHOLDS.docsForS} documentation and ${RANK_THRESHOLDS.reviewsForS} review contributions for rank S.`, "A");
  }
  return { rank: "S", nextRankRequirement: null };
}

function deriveTitles(ctx: EvidenceState, rank: Rank, scope: DashboardScope): string[] {
  return TITLE_RULES
    .filter((rule) => (scope.kind === "global" || !rule.globalOnly) && rule.unlocked(ctx, rank))
    .map((rule) => rule.title);
}

function chooseCurrentTitle(titles: string[], rank: Rank): string {
  if (titles.length === 0) return rank === "S" ? "Open Source Champion" : "Contributor";
  return titles[titles.length - 1];
}

function rankSUnlockedAt(baseEvidenceDesc: ContributionEvidence[], scope: DashboardScope, finalRank: Rank): string | null {
  if (finalRank !== "S") return null;
  const chronological = [...baseEvidenceDesc]
    .filter((item) => Number.isFinite(Date.parse(item.occurredAt)))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
  if (chronological.length === 0) return null;
  const reachesSAt = (count: number): boolean => {
    const ctx = prepareEvidence(chronological.slice(0, count));
    const achievements = deriveAchievements(ctx);
    const scoped = scope.kind === "repository"
      ? achievements.filter((entry) => entry.id !== "realm-dual" && entry.id !== "realm-triple")
      : achievements;
    return deriveRank(ctx, scoped).rank === "S";
  };
  if (!reachesSAt(chronological.length)) return null;
  let lo = 1;
  let hi = chronological.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (reachesSAt(mid)) hi = mid;
    else lo = mid + 1;
  }
  return chronological[lo - 1]?.occurredAt ?? null;
}

function applyXp(input: ContributionEvidence[]): ContributionEvidence[] {
  return input.map((item) => {
    if (item.kind === "pull_request") {
      return { ...item, xp: item.track === "documentation" ? XP_RULES.mergedDocumentationPr : XP_RULES.mergedEngineeringPr };
    }
    if (item.kind === "review") {
      return { ...item, xp: XP_RULES.submittedReview };
    }
    return { ...item, xp: XP_RULES.documentationIssue };
  });
}

function deriveQuests(state: EvidenceState): Quest[] {
  const engineering = mergedPullRequests(state).length;
  const docs = state.byTrack.documentation.length;
  const review = state.byTrack.review.length;
  return [
    {
      id: "quest-engineering-5",
      title: "Forge 5 merged changes",
      description: "Land five merged pull requests across any tracked repositories.",
      track: "engineering",
      repositoryId: null,
      progress: Math.min(engineering, 5),
      target: 5,
      completed: engineering >= 5,
      rewardXp: 0,
    },
    {
      id: "quest-docs-4",
      title: "Document 4 improvements",
      description: "Submit four evidence-backed documentation contributions.",
      track: "documentation",
      repositoryId: null,
      progress: Math.min(docs, 4),
      target: 4,
      completed: docs >= 4,
      rewardXp: 0,
    },
    {
      id: "quest-review-5",
      title: "Review 5 pull requests",
      description: "Submit five qualifying pull-request reviews.",
      track: "review",
      repositoryId: null,
      progress: Math.min(review, 5),
      target: 5,
      completed: review >= 5,
      rewardXp: 0,
    },
  ];
}

export function deriveProgression(
  profileBase: Omit<Profile, "title" | "displayTitle">,
  repositories: Repository[],
  evidenceInput: ContributionEvidence[],
  scope: DashboardScope,
  trackedRepositories: string[],
  source: DashboardSnapshot["source"],
  liveSyncAvailable: boolean,
  warnings: string[],
  lastSyncedAt: string | null,
  classPreferenceInput?: Pick<ContributorClassPreference, "isAiEngineer" | "aiToolUsage"> & { mageQuiz?: ContributorClassPreference["mageQuiz"] },
  classPreferenceEditable = source !== "demo",
): DashboardSnapshot {
  const evidence = applyXp(evidenceInput).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const ctx = prepareEvidence(evidence);
  const totalXp = evidence.reduce((sum, item) => sum + item.xp, 0);
  const levelMeta = levelFromXp(totalXp);
  const byTrack: TrackProgress[] = (["engineering", "documentation", "review"] as const).map((id) => {
    const items = ctx.byTrack[id];
    const xp = items.reduce((sum, item) => sum + item.xp, 0);
    return {
      id,
      name: TRACK_NAMES[id],
      xp,
      level: levelFromXp(xp).level,
      evidenceCount: items.length,
    };
  });
  const achievements = deriveAchievements(ctx);
  const scopedAchievements = scope.kind === "repository"
    ? achievements.filter((item) => item.id !== "realm-dual" && item.id !== "realm-triple")
    : achievements;
  const rankMeta = deriveRank(ctx, scopedAchievements);
  const mastery = deriveMastery(evidence, rankMeta.rank, rankSUnlockedAt(evidence, scope, rankMeta.rank));
  const titles = [
    ...deriveTitles(ctx, rankMeta.rank, scope),
    ...mastery.achievements
      .filter((item) => item.unlockedAt !== null)
      .map((item) => item.name),
  ];
  const progression: Progression = {
    scoringVersion: SCORING_VERSION,
    totalXp,
    level: levelMeta.level,
    rank: rankMeta.rank,
    levelXp: levelMeta.levelXp,
    nextLevelXp: levelMeta.nextLevelXp,
    titles,
    nextRankRequirement: rankMeta.nextRankRequirement,
  };
  return {
    source,
    scope,
    trackedRepositories,
    liveSyncAvailable,
    generatedAt: new Date().toISOString(),
    lastSyncedAt,
    profile: {
      ...buildProfileWithDisplayTitle(
        {
          ...profileBase,
          title: chooseCurrentTitle(titles, rankMeta.rank),
        },
        classPreferenceInput ?? defaultClassPreference(classPreferenceEditable),
      ),
    },
    progression,
    tracks: byTrack,
    repositories,
    evidence,
    achievements: [...scopedAchievements, ...mastery.achievements],
    quests: deriveQuests(ctx),
    characterClass: deriveCharacterClass(evidence),
    classPreference: withMagePreference(classPreferenceInput ?? defaultClassPreference(classPreferenceEditable), classPreferenceEditable),
    mastery: mastery.progress,
    warnings,
  };
}

export type ProgressionGuide = {
  scoringVersion: string;
  xp: {
    levelBaseStep: number;
    levelFormula: string;
    evidenceRules: {
      mergedEngineeringPr: number;
      mergedDocumentationPr: number;
      submittedReview: number;
      documentationIssue: number;
    };
  };
  ranks: Array<{
    rank: Rank;
    meaning: string;
    advancement: string;
  }>;
  titles: Array<{
    title: string;
    meaning: string;
    unlock: string;
    globalOnly: boolean;
  }>;
  displayedTitleSelection: string;
  scopeRules: {
    globalOnlyAchievementIds: string[];
    note: string;
  };
  mastery: {
    version: string;
    requiredRank: Rank;
    requiredContributions: number;
    requiredDistinctMonths: number;
    titles: Array<{
      id: string;
      title: string;
      track: SkillTrack;
      unlock: string;
    }>;
  };
};

export function getProgressionGuide(): ProgressionGuide {
  const masteryGuide = getMasteryGuide();
  const advancementByRank: Record<Rank, string> = {
    E: "Gain evidence in one track, then in a second track to move forward.",
    D: `Land at least ${RANK_THRESHOLDS.mergedPrsForC} merged pull requests to reach rank C.`,
    C: `Reach at least ${RANK_THRESHOLDS.docsForB} documentation and ${RANK_THRESHOLDS.reviewsForB} review contributions to reach rank B.`,
    B: `Reach at least ${RANK_THRESHOLDS.mergedPrsForA} merged pull requests to reach rank A.`,
    A: `Unlock ${RANK_THRESHOLDS.unlockedForS} achievements and reach ${RANK_THRESHOLDS.docsForS} documentation + ${RANK_THRESHOLDS.reviewsForS} review contributions for rank S.`,
    S: "Top rank reached.",
  };
  return {
    scoringVersion: SCORING_VERSION,
    xp: {
      levelBaseStep: LEVEL_STEP,
      levelFormula: "Each next level requires level × baseStep XP.",
      evidenceRules: {
        mergedEngineeringPr: XP_RULES.mergedEngineeringPr,
        mergedDocumentationPr: XP_RULES.mergedDocumentationPr,
        submittedReview: XP_RULES.submittedReview,
        documentationIssue: XP_RULES.documentationIssue,
      },
    },
    ranks: RANK_GUIDE.map((entry) => ({
      rank: entry.rank,
      meaning: entry.meaning,
      advancement: advancementByRank[entry.rank],
    })),
    titles: TITLE_RULES.map((rule) => ({
      title: rule.title,
      meaning: rule.meaning,
      unlock: rule.unlock,
      globalOnly: rule.globalOnly,
    })),
    displayedTitleSelection: `The displayed title is selected in two deterministic phases: first the last unlocked entry in TITLE_RULES list order (${TITLE_RULES.map((rule) => rule.title).join(" → ")}), then any unlocked mastery title overrides base titles using mastery precedence order (${masteryGuide.disciplines.map((item) => item.title).join(" → ")}). If none are unlocked, it defaults to Contributor (or Open Source Champion at rank S).`,
    scopeRules: {
      globalOnlyAchievementIds: [...GLOBAL_ONLY_ACHIEVEMENT_IDS],
      note: "Repository scope excludes global-only repository-breadth badges and titles.",
    },
    mastery: {
      version: masteryGuide.version,
      requiredRank: masteryGuide.requiredRank,
      requiredContributions: masteryGuide.requiredContributions,
      requiredDistinctMonths: masteryGuide.requiredDistinctMonths,
      titles: masteryGuide.disciplines.map((discipline) => ({
        id: discipline.id,
        title: discipline.title,
        track: discipline.track,
        unlock: discipline.unlock,
      })),
    },
  };
}
