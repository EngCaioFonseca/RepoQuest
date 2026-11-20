import type {
  CompletedQuest,
  ContributionEvidence,
  DashboardScope,
  Quest,
  QuestLog,
  QuestTrack,
  Relic,
  RelicRarity,
  Renown,
} from "@/lib/contracts";

/**
 * Questlines never run out: completing a tier immediately reveals the next one, and every
 * completion is replayed from evidence into a dated quest log with a collectible relic.
 * Relics and renown are cosmetic; they never add XP or change rank E–S.
 */
export const QUEST_VERSION = "q1";

export const BOUNTY_TARGET = 3;

/** Injected by progression so quests share its scoring without a circular import. */
export type QuestScoring = {
  levelOf: (totalXp: number) => number;
  /** Lifetime XP needed to stand at `level`. */
  xpToReachLevel: (level: number) => number;
  /** Lowest XP one more qualifying item would earn in each questline track. */
  xpPerItem: Record<"engineering" | "documentation" | "review" | "any", number>;
};

const RARITY_POINTS: Record<RelicRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8 };

export const RENOWN_RANKS = [
  { rank: "Wanderer", points: 0 },
  { rank: "Squire", points: 5 },
  { rank: "Knight", points: 15 },
  { rank: "Champion", points: 35 },
  { rank: "Paragon", points: 70 },
  { rank: "Legend", points: 120 },
  { rank: "Mythic", points: 200 },
] as const;

export function rarityForTier(tier: number): RelicRarity {
  if (tier <= 1) return "common";
  if (tier === 2) return "uncommon";
  if (tier <= 4) return "rare";
  if (tier <= 6) return "epic";
  return "legendary";
}

/** Consecutive monthly bounties upgrade the chest. */
export function rarityForStreak(streak: number): RelicRarity {
  if (streak <= 1) return "common";
  if (streak === 2) return "uncommon";
  if (streak <= 5) return "rare";
  if (streak <= 11) return "epic";
  return "legendary";
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const roman = (n: number): string => ROMAN[n] ?? String(n);

function ladder(steps: number[], step: number): (tier: number) => number {
  return (tier) => (tier <= steps.length ? steps[tier - 1] : steps[steps.length - 1] + step * (tier - steps.length));
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

type Metric = {
  /** Metric value after each chronological evidence item; never decreases. */
  values: number[];
  /** Evidence that satisfied `target`, given the index where it was reached. */
  evidenceIds: (index: number, target: number) => string[];
};

type ChainDefinition = {
  id: string;
  name: string;
  track: QuestTrack;
  globalOnly: boolean;
  target: (tier: number) => number;
  title: (target: number) => string;
  description: (target: number, scope: DashboardScope) => string;
  relics: ReadonlyArray<readonly [name: string, icon: string]>;
  relicBlurb: string;
  metric: (chrono: ContributionEvidence[], scoring: QuestScoring) => Metric;
  rewardXp: (remaining: number, current: number, target: number, totalXp: number, scoring: QuestScoring) => number;
};

function countMetric(predicate: (item: ContributionEvidence) => boolean): ChainDefinition["metric"] {
  return (chrono) => {
    const qualifying: string[] = [];
    const values = chrono.map((item) => {
      if (predicate(item)) qualifying.push(item.id);
      return qualifying.length;
    });
    return { values, evidenceIds: (_index, target) => qualifying.slice(0, target) };
  };
}

function distinctMetric(key: (item: ContributionEvidence) => string): ChainDefinition["metric"] {
  return (chrono) => {
    const seen = new Set<string>();
    const firsts: string[] = [];
    const values = chrono.map((item) => {
      const k = key(item);
      if (!seen.has(k)) { seen.add(k); firsts.push(item.id); }
      return seen.size;
    });
    return { values, evidenceIds: (_index, target) => firsts.slice(0, target) };
  };
}

const monthOf = (iso: string): string => new Date(iso).toISOString().slice(0, 7);
const where = (scope: DashboardScope): string => (scope.kind === "global" ? "across your tracked repositories" : `in ${scope.repositoryId}`);

const COUNT_LADDER = ladder([1, 3, 5, 10, 15, 25, 40, 60, 80, 100], 25);

export const QUEST_CHAINS: ChainDefinition[] = [
  {
    id: "engineering",
    name: "The Forge",
    track: "engineering",
    globalOnly: false,
    target: COUNT_LADDER,
    title: (t) => `Forge ${plural(t, "merged change")}`,
    description: (t, scope) => `Land ${plural(t, "merged pull request")} ${where(scope)}.`,
    relics: [["Iron Hammer", "🔨"], ["Tempered Blade", "🗡️"], ["Runed Anvil", "⚒️"], ["Forgemaster's Gauntlet", "🧤"], ["Starmetal Ingot", "🪙"], ["Molten Core", "🔥"], ["Worldforge Hammer", "⚡"]],
    relicBlurb: "Forged from merged pull requests.",
    metric: countMetric((item) => item.kind === "pull_request"),
    rewardXp: (remaining, _c, _t, _x, s) => remaining * s.xpPerItem.engineering,
  },
  {
    id: "docs",
    name: "The Archive",
    track: "documentation",
    globalOnly: false,
    target: COUNT_LADDER,
    title: (t) => `Document ${plural(t, "improvement")}`,
    description: (t, scope) => `Complete ${plural(t, "documentation contribution")} ${where(scope)}.`,
    relics: [["Feather Quill", "🪶"], ["Everink Well", "🖋️"], ["Bound Codex", "📘"], ["Illuminated Tome", "📜"], ["Archive Key", "🗝️"], ["Living Grimoire", "📖"], ["Library of Ages", "🏛️"]],
    relicBlurb: "Bound from documentation contributions.",
    metric: countMetric((item) => item.track === "documentation"),
    rewardXp: (remaining, _c, _t, _x, s) => remaining * s.xpPerItem.documentation,
  },
  {
    id: "review",
    name: "The Watch",
    track: "review",
    globalOnly: false,
    target: COUNT_LADDER,
    title: (t) => `Review ${plural(t, "pull request")}`,
    description: (t, scope) => `Submit ${plural(t, "qualifying review")} ${where(scope)}.`,
    relics: [["Scout's Lens", "🔍"], ["Watch Lantern", "🏮"], ["Sentinel Shield", "🛡️"], ["Gatekeeper's Seal", "🔏"], ["Oracle Eye", "👁️"], ["Aegis Ward", "🔰"], ["Eternal Bastion", "🏰"]],
    relicBlurb: "Earned standing watch over other people's changes.",
    metric: countMetric((item) => item.track === "review"),
    rewardXp: (remaining, _c, _t, _x, s) => remaining * s.xpPerItem.review,
  },
  {
    id: "level",
    name: "Ascension",
    track: "general",
    globalOnly: false,
    target: ladder([2, 3, 5, 7, 10, 13, 16, 20], 5),
    title: (t) => `Ascend to level ${t}`,
    description: (t) => `Reach character level ${t} in this view.`,
    relics: [["Ember Sigil", "✨"], ["Flame Crest", "🔆"], ["Phoenix Feather", "🪽"], ["Sunforged Crown", "👑"], ["Astral Mantle", "🌌"], ["Starborn Halo", "💫"], ["Ascendant Throne", "🪐"]],
    relicBlurb: "Marks a level reached through credited XP.",
    metric: (chrono, scoring) => {
      let xp = 0;
      const values = chrono.map((item) => { xp += item.xp; return scoring.levelOf(xp); });
      return { values, evidenceIds: (index) => (chrono[index] ? [chrono[index].id] : []) };
    },
    rewardXp: (_r, _c, target, totalXp, s) => Math.max(0, s.xpToReachLevel(target) - totalXp),
  },
  {
    id: "cadence",
    name: "The Long Road",
    track: "general",
    globalOnly: false,
    target: ladder([2, 3, 6, 9, 12, 18, 24], 6),
    title: (t) => `Contribute in ${plural(t, "calendar month")}`,
    description: (t, scope) => `Record qualifying evidence in ${plural(t, "different UTC calendar month")} ${where(scope)}.`,
    relics: [["Sand Hourglass", "⏳"], ["Sun Dial", "🌞"], ["Moon Calendar", "🌙"], ["Season Wheel", "🍂"], ["Tidewatch Compass", "🧭"], ["Eclipse Clock", "🌘"], ["Eternal Chronometer", "⌛"]],
    relicBlurb: "Earned by showing up across the months.",
    metric: distinctMetric((item) => monthOf(item.occurredAt)),
    rewardXp: () => 0,
  },
  {
    id: "realms",
    name: "Realm Charting",
    track: "general",
    globalOnly: true,
    target: ladder([2, 3, 4, 5, 6, 8, 10], 2),
    title: (t) => `Chart ${plural(t, "realm")}`,
    description: (t) => `Contribute in ${plural(t, "tracked repository", "tracked repositories")}. Add repositories under Sync to open new realms.`,
    relics: [["Traveler's Map", "🗺️"], ["Brass Compass", "🧭"], ["Star Sextant", "🔭"], ["Realm Atlas", "📕"], ["Portal Stone", "🌀"], ["Skyship Charter", "⛵"], ["World Seed", "🌍"]],
    relicBlurb: "Collected by contributing across repositories.",
    metric: distinctMetric((item) => item.repositoryId.toLowerCase()),
    rewardXp: () => 0,
  },
];

function relicFor(chain: ChainDefinition, tier: number, questId: string): Relic {
  const base = chain.relics[Math.min(tier, chain.relics.length) - 1];
  const extra = tier - chain.relics.length;
  return {
    id: `relic-${questId}`,
    name: extra > 0 ? `${base[0]} ${roman(extra + 1)}` : base[0],
    icon: base[1],
    rarity: rarityForTier(tier),
    description: `${chain.name}, tier ${tier}. ${chain.relicBlurb}`,
  };
}

function bountyRelic(month: string, streak: number): Relic {
  return {
    id: `relic-bounty-${month}`,
    name: streak > 1 ? `Bounty Chest (${streak}-month streak)` : "Bounty Chest",
    icon: "🎁",
    rarity: rarityForStreak(streak),
    description: `Monthly bounty for ${monthLabel(month)}. Consecutive months upgrade the chest.`,
  };
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function previousMonth(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function nextMonthStart(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

export function deriveRenown(completed: CompletedQuest[]): Renown {
  const points = completed.reduce((sum, quest) => sum + RARITY_POINTS[quest.reward.rarity], 0);
  let index = 0;
  for (let i = 0; i < RENOWN_RANKS.length; i += 1) if (points >= RENOWN_RANKS[i].points) index = i;
  const next = RENOWN_RANKS[index + 1];
  return { points, rank: RENOWN_RANKS[index].rank, nextRank: next?.rank ?? null, nextRankPoints: next?.points ?? null };
}

export type QuestBoard = { quests: Quest[]; questLog: QuestLog };

/**
 * Deterministic: the same evidence, scope and month always produce the same board and log.
 * `evidence` must already carry credited XP.
 */
export function deriveQuestBoard(evidence: ContributionEvidence[], scope: DashboardScope, scoring: QuestScoring, now: Date = new Date()): QuestBoard {
  const chrono = evidence
    .filter((item) => Number.isFinite(Date.parse(item.occurredAt)))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
  const levelAfter: number[] = [];
  let runningXp = 0;
  for (const item of chrono) { runningXp += item.xp; levelAfter.push(scoring.levelOf(runningXp)); }
  const totalXp = runningXp;
  const scopeRepository = scope.kind === "repository" ? scope.repositoryId : null;

  const completed: CompletedQuest[] = [];
  const active: Quest[] = [];
  const closeness = new Map<string, number>();

  for (const chain of QUEST_CHAINS) {
    if (chain.globalOnly && scope.kind !== "global") continue;
    const metric = chain.metric(chrono, scoring);
    const current = metric.values[metric.values.length - 1] ?? (chain.id === "level" ? scoring.levelOf(0) : 0);
    let tier = 1;
    let cursor = 0;
    // Replay every tier already reached, in order, so the log has real completion dates.
    for (; tier < 10_000; tier += 1) {
      const target = chain.target(tier);
      if (current < target) break;
      while (cursor < metric.values.length && metric.values[cursor] < target) cursor += 1;
      const at = chrono[cursor];
      const id = `quest-${chain.id}-${target}`;
      completed.push({
        id, chainId: chain.id, tier, title: chain.title(target), description: chain.description(target, scope), track: chain.track, target,
        completedAt: at.occurredAt, levelAtCompletion: levelAfter[cursor], evidenceIds: metric.evidenceIds(cursor, target), reward: relicFor(chain, tier, id),
      });
    }
    const target = chain.target(tier);
    const id = `quest-${chain.id}-${target}`;
    // Share of the current tier already done, so a long-finished earlier tier does not look "close".
    const base = tier > 1 ? chain.target(tier - 1) : chain.id === "level" ? 1 : 0;
    closeness.set(id, chain.id === "level"
      ? (totalXp - scoring.xpToReachLevel(base)) / Math.max(1, scoring.xpToReachLevel(target) - scoring.xpToReachLevel(base))
      : (current - base) / Math.max(1, target - base));
    active.push({
      id, chainId: chain.id, tier, title: chain.title(target), description: chain.description(target, scope), track: chain.track,
      repositoryId: scopeRepository, progress: Math.min(current, target), target, completed: false,
      rewardXp: chain.rewardXp(target - current, current, target, totalXp, scoring), reward: relicFor(chain, tier, id), recommendation: null, endsAt: null,
    });
  }

  // Monthly bounties: every UTC month with BOUNTY_TARGET contributions is a claimed bounty.
  const byMonth = new Map<string, number[]>();
  chrono.forEach((item, index) => {
    const month = monthOf(item.occurredAt);
    const bucket = byMonth.get(month) ?? [];
    bucket.push(index);
    byMonth.set(month, bucket);
  });
  const claimed = new Set<string>();
  for (const month of [...byMonth.keys()].sort()) {
    const indices = byMonth.get(month) ?? [];
    if (indices.length < BOUNTY_TARGET) continue;
    claimed.add(month);
    let streak = 1;
    for (let m = previousMonth(month); claimed.has(m); m = previousMonth(m)) streak += 1;
    const at = indices[BOUNTY_TARGET - 1];
    completed.push({
      id: `bounty-${month}`, chainId: "bounty", tier: 1, title: `Monthly bounty: ${monthLabel(month)}`,
      description: `Make ${BOUNTY_TARGET} qualifying contributions in ${monthLabel(month)} (UTC).`, track: "general", target: BOUNTY_TARGET,
      completedAt: chrono[at].occurredAt, levelAtCompletion: levelAfter[at], evidenceIds: indices.slice(0, BOUNTY_TARGET).map((i) => chrono[i].id), reward: bountyRelic(month, streak),
    });
  }
  const thisMonth = now.toISOString().slice(0, 7);
  const thisMonthCount = byMonth.get(thisMonth)?.length ?? 0;
  let priorStreak = 0;
  for (let m = previousMonth(thisMonth); claimed.has(m); m = previousMonth(m)) priorStreak += 1;
  const bountyDone = thisMonthCount >= BOUNTY_TARGET;
  const bounty: Quest = {
    id: `bounty-${thisMonth}`, chainId: "bounty", tier: 1, title: `Monthly bounty: ${monthLabel(thisMonth)}`,
    description: `Make ${BOUNTY_TARGET} qualifying contributions before the month ends (UTC). A new bounty opens every month.`,
    track: "general", repositoryId: scopeRepository, progress: Math.min(thisMonthCount, BOUNTY_TARGET), target: BOUNTY_TARGET, completed: bountyDone,
    rewardXp: Math.max(0, BOUNTY_TARGET - thisMonthCount) * scoring.xpPerItem.any, reward: bountyRelic(thisMonth, priorStreak + 1),
    recommendation: !bountyDone && priorStreak > 0 ? `Claim it to extend your ${plural(priorStreak, "month")} bounty streak.` : null,
    endsAt: nextMonthStart(thisMonth),
  };

  // Suggest the questline closest to its next reward.
  const closest = active
    .filter((quest) => (closeness.get(quest.id) ?? 0) > 0)
    .sort((a, b) => (closeness.get(b.id) ?? 0) - (closeness.get(a.id) ?? 0))[0];
  if (closest) {
    const remaining = closest.target - closest.progress;
    closest.recommendation = closest.chainId === "level"
      ? `Closest to completion: about ${closest.rewardXp} more XP earns the ${closest.reward.name}.`
      : `Closest to completion: ${remaining} more earns the ${closest.reward.name}.`;
  }

  completed.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.id.localeCompare(b.id));
  return { quests: [bounty, ...active], questLog: { completed, renown: deriveRenown(completed) } };
}

export function getQuestGuide() {
  return {
    version: QUEST_VERSION,
    chains: QUEST_CHAINS.map((chain) => ({
      id: chain.id,
      name: chain.name,
      globalOnly: chain.globalOnly,
      firstTargets: Array.from({ length: 6 }, (_, i) => chain.target(i + 1)),
      example: chain.title(chain.target(1)),
      relics: chain.relics.map(([name, icon]) => `${icon} ${name}`),
    })),
    bountyTarget: BOUNTY_TARGET,
    rarityPoints: RARITY_POINTS,
    renownRanks: RENOWN_RANKS.map((r) => ({ ...r })),
  };
}
