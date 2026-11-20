import type {
  Achievement,
  ContributionEvidence,
  MasteryDisciplineId,
  MasteryDisciplineProgress,
  MasteryProgress,
  Rank,
  SkillTrack,
  TechnicalSpecialtyId,
} from "@/lib/contracts";
import { matchSpecialtiesForTitle } from "./classes";

export const MASTERY_VERSION = "v1";
export const MASTERY_REQUIRED_RANK: Rank = "S";
export const MASTERY_REQUIRED_CONTRIBUTIONS = 20;
export const MASTERY_REQUIRED_MONTHS = 3;

type MasteryDefinition = {
  id: MasteryDisciplineId;
  title: string;
  achievementId: string;
  icon: string;
  track: SkillTrack;
  qualifierLabel: string;
  isQualifying: (evidence: ContributionEvidence) => boolean;
};

type DatedEvidence = {
  item: ContributionEvidence;
  timestamp: number | null;
  utcMonth: string | null;
  stableKey: string;
};

function toDatedEvidence(item: ContributionEvidence): DatedEvidence {
  const timestamp = parseTimestamp(item.occurredAt);
  return {
    item,
    timestamp,
    utcMonth: utcMonthFromTimestamp(timestamp),
    stableKey: stableEvidenceKey(item),
  };
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcMonthFromTimestamp(timestamp: number | null): string | null {
  return timestamp === null ? null : new Date(timestamp).toISOString().slice(0, 7);
}

function stableEvidenceKey(item: ContributionEvidence): string {
  return [
    item.id,
    item.occurredAt,
    item.repositoryId,
    item.kind,
    item.track,
    item.state,
    item.title,
    item.url,
    item.reason,
  ].join("::");
}

function masteryUnlockDescription(qualifierLabel: string): string {
  return `Reach rank ${MASTERY_REQUIRED_RANK} and complete ${MASTERY_REQUIRED_CONTRIBUTIONS} ${qualifierLabel} contributions across ${MASTERY_REQUIRED_MONTHS} distinct UTC calendar months.`;
}

function isMergedEngineeringPr(evidence: ContributionEvidence): boolean {
  return evidence.kind === "pull_request" && evidence.track === "engineering" && evidence.state === "merged";
}

function hasTechnicalSpecialty(evidence: ContributionEvidence, specialty: TechnicalSpecialtyId): boolean {
  if (!isMergedEngineeringPr(evidence)) return false;
  return matchSpecialtiesForTitle(evidence.title, { includeGeneral: false }).includes(specialty);
}

const MASTERY_DEFINITIONS: MasteryDefinition[] = [
  {
    id: "backend",
    title: "Shadow Monarch",
    achievementId: "mastery-shadow-monarch",
    icon: "🕶️",
    track: "engineering",
    qualifierLabel: "qualifying backend",
    isQualifying: (evidence) => hasTechnicalSpecialty(evidence, "backend"),
  },
  {
    id: "frontend",
    title: "Prism Monarch",
    achievementId: "mastery-prism-monarch",
    icon: "🔷",
    track: "engineering",
    qualifierLabel: "qualifying frontend",
    isQualifying: (evidence) => hasTechnicalSpecialty(evidence, "frontend"),
  },
  {
    id: "ai",
    title: "Cognition Monarch",
    achievementId: "mastery-cognition-monarch",
    icon: "🧠",
    track: "engineering",
    qualifierLabel: "qualifying AI",
    isQualifying: (evidence) => hasTechnicalSpecialty(evidence, "ai"),
  },
  {
    id: "systems",
    title: "Nexus Monarch",
    achievementId: "mastery-nexus-monarch",
    icon: "🕸️",
    track: "engineering",
    qualifierLabel: "qualifying systems",
    isQualifying: (evidence) => hasTechnicalSpecialty(evidence, "systems"),
  },
  {
    id: "qa",
    title: "Aegis Monarch",
    achievementId: "mastery-aegis-monarch",
    icon: "🛡️",
    track: "engineering",
    qualifierLabel: "qualifying QA",
    isQualifying: (evidence) => hasTechnicalSpecialty(evidence, "qa"),
  },
  {
    id: "documentation",
    title: "Lore Monarch",
    achievementId: "mastery-lore-monarch",
    icon: "📜",
    track: "documentation",
    qualifierLabel: "merged documentation PR or closed documentation issue",
    isQualifying: (evidence) =>
      (evidence.kind === "pull_request" && evidence.track === "documentation" && evidence.state === "merged")
      || (evidence.kind === "issue" && evidence.track === "documentation" && evidence.state === "closed"),
  },
  {
    id: "review",
    title: "Sentinel Monarch",
    achievementId: "mastery-sentinel-monarch",
    icon: "🛡️",
    track: "review",
    qualifierLabel: "submitted review",
    isQualifying: (evidence) => evidence.kind === "review" && evidence.state === "submitted",
  },
];

export const MASTERY_TITLE_PRECEDENCE = MASTERY_DEFINITIONS.map((definition) => definition.id);

function sortEvidenceChronologically(evidenceInput: ContributionEvidence[]): ContributionEvidence[] {
  const seen = new Set<string>();
  return evidenceInput
    .map(toDatedEvidence)
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp !== null) return 1;
      if (a.timestamp !== null && b.timestamp === null) return -1;
      if (a.timestamp !== null && b.timestamp !== null && a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.stableKey.localeCompare(b.stableKey);
    })
    .filter(({ item }) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map(({ item }) => item);
}

function monthGateDate(evidence: DatedEvidence[]): string | null {
  const months = new Set<string>();
  for (const { item, utcMonth } of evidence) {
    if (!utcMonth) continue;
    months.add(utcMonth);
    if (months.size >= MASTERY_REQUIRED_MONTHS) return item.occurredAt;
  }
  return null;
}

function maxIso(values: Array<string | null>): string | null {
  if (values.some((value) => value === null)) return null;
  const required = values as string[];
  const parsed = required.map((value) => parseTimestamp(value));
  if (parsed.some((value) => value === null)) return null;
  const timestamps = parsed as number[];
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function buildDisciplineProgress(
  definition: MasteryDefinition,
  evidence: ContributionEvidence[],
  rank: Rank,
  rankSUnlockedAt: string | null,
): MasteryDisciplineProgress {
  const qualifyingDated = evidence
    .filter(definition.isQualifying)
    .map(toDatedEvidence)
    .filter((entry) => entry.timestamp !== null);
  const count = qualifyingDated.length;
  const monthCount = new Set(qualifyingDated.map((entry) => entry.utcMonth).filter((month): month is string => month !== null)).size;
  const countGateDate = count >= MASTERY_REQUIRED_CONTRIBUTIONS ? qualifyingDated[MASTERY_REQUIRED_CONTRIBUTIONS - 1].item.occurredAt : null;
  const monthsGateDate = monthGateDate(qualifyingDated);
  const rankTimestamp = parseTimestamp(rankSUnlockedAt ?? "");
  const rankMet = rank === MASTERY_REQUIRED_RANK && rankTimestamp !== null;
  const unlockedAt = rankMet && countGateDate && monthsGateDate ? maxIso([rankSUnlockedAt, countGateDate, monthsGateDate]) : null;
  const unlockedTimestamp = parseTimestamp(unlockedAt ?? "");
  const evidenceIds = unlockedAt
    ? qualifyingDated
      .filter((entry) => entry.timestamp !== null && unlockedTimestamp !== null && entry.timestamp <= unlockedTimestamp)
      .map((entry) => entry.item.id)
    : qualifyingDated.map((entry) => entry.item.id).slice(0, MASTERY_REQUIRED_CONTRIBUTIONS);
  return {
    id: definition.id,
    title: definition.title,
    track: definition.track,
    rankGate: { required: MASTERY_REQUIRED_RANK, met: rankMet },
    contributionGate: {
      required: MASTERY_REQUIRED_CONTRIBUTIONS,
      current: count,
      remaining: Math.max(0, MASTERY_REQUIRED_CONTRIBUTIONS - count),
    },
    monthGate: {
      required: MASTERY_REQUIRED_MONTHS,
      current: monthCount,
      remaining: Math.max(0, MASTERY_REQUIRED_MONTHS - monthCount),
    },
    unlockedAt,
    evidenceIds,
  };
}

export function deriveMastery(
  evidenceInput: ContributionEvidence[],
  rank: Rank,
  rankSUnlockedAt: string | null,
): { progress: MasteryProgress; achievements: Achievement[] } {
  const evidence = sortEvidenceChronologically(evidenceInput);
  const disciplines = MASTERY_DEFINITIONS.map((definition) => buildDisciplineProgress(definition, evidence, rank, rankSUnlockedAt));
  const achievements: Achievement[] = disciplines.map((discipline) => {
    const definition = MASTERY_DEFINITIONS.find((item) => item.id === discipline.id)!;
    return {
      id: definition.achievementId,
      name: definition.title,
      description: masteryUnlockDescription(definition.qualifierLabel),
      icon: definition.icon,
      track: definition.track,
      progress: Math.min(discipline.contributionGate.current, discipline.contributionGate.required),
      target: discipline.contributionGate.required,
      unlockedAt: discipline.unlockedAt,
      evidenceIds: discipline.evidenceIds,
    };
  });
  return {
    progress: { version: MASTERY_VERSION, disciplines },
    achievements,
  };
}

export type MasteryGuide = {
  version: string;
  requiredRank: Rank;
  requiredContributions: number;
  requiredDistinctMonths: number;
  titlePrecedence: MasteryDisciplineId[];
  disciplines: Array<{
    id: MasteryDisciplineId;
    title: string;
    track: SkillTrack;
    unlock: string;
  }>;
};

export function getMasteryGuide(): MasteryGuide {
  return {
    version: MASTERY_VERSION,
    requiredRank: MASTERY_REQUIRED_RANK,
    requiredContributions: MASTERY_REQUIRED_CONTRIBUTIONS,
    requiredDistinctMonths: MASTERY_REQUIRED_MONTHS,
    titlePrecedence: [...MASTERY_TITLE_PRECEDENCE],
    disciplines: MASTERY_DEFINITIONS.map((definition) => ({
      id: definition.id,
      title: definition.title,
      track: definition.track,
      unlock: masteryUnlockDescription(definition.qualifierLabel),
    })),
  };
}
