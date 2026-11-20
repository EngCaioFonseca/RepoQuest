import type { DashboardView } from "./types";

export type RelicRarity = "common" | "uncommon" | "rare" | "epic" | "mythic";

export type RelicCategory = "weapon" | "tome" | "shield" | "artifact" | "crown" | "chest";

export interface RelicItem {
  id: string;
  name: string;
  rarity: RelicRarity;
  category: RelicCategory;
  unlocked: boolean;
  sourceLabel: string;
  unlockHint: string;
}

export interface RelicVaultSummary {
  items: RelicItem[];
  unlockedCount: number;
  totalCount: number;
  chestsOpened: number;
  chestsTotal: number;
  byRarity: Record<RelicRarity, { unlocked: number; total: number }>;
}

const RARITY_ORDER: RelicRarity[] = ["common", "uncommon", "rare", "epic", "mythic"];

export function deriveRelicVault(view: DashboardView): RelicVaultSummary {
  const unlockedAch = new Set(view.achievements.filter((a) => a.unlocked).map((a) => a.id));
  const completedQuests = view.quests.filter((q) => q.completed).length;
  const unlockedMonarchs = view.mastery.filter((m) => Boolean(m.unlockedAt));
  const isGlobal = view.scope.kind === "global";

  const items: RelicItem[] = [
    {
      id: "iron-merge-blade",
      name: "Iron Merge Blade",
      rarity: "common",
      category: "weapon",
      unlocked: unlockedAch.has("merge-initiate"),
      sourceLabel: "Merge Initiate",
      unlockHint: "Land your first merged pull request.",
    },
    {
      id: "silver-quill",
      name: "Silver Scribe Quill",
      rarity: "common",
      category: "tome",
      unlocked: unlockedAch.has("scribe-awakens"),
      sourceLabel: "Scribe Awakens",
      unlockHint: "Record your first documentation contribution.",
    },
    {
      id: "sentinel-spyglass",
      name: "Sentinel Spyglass",
      rarity: "common",
      category: "shield",
      unlocked: unlockedAch.has("reviewer-first-pass"),
      sourceLabel: "First Pass",
      unlockHint: "Submit your first accepted review signal.",
    },
    {
      id: "vanguard-hammer",
      name: "Vanguard Forge Hammer",
      rarity: "uncommon",
      category: "weapon",
      unlocked: unlockedAch.has("merge-vanguard"),
      sourceLabel: "Merge Vanguard",
      unlockHint: "Land 5 merged pull requests.",
    },
    {
      id: "illuminated-codex",
      name: "Illuminated Codex",
      rarity: "uncommon",
      category: "tome",
      unlocked: unlockedAch.has("scribe-steady"),
      sourceLabel: "Scribe Steady",
      unlockHint: "Complete 4 documentation contributions.",
    },
    {
      id: "gatekeeper-buckler",
      name: "Gatekeeper Buckler",
      rarity: "uncommon",
      category: "shield",
      unlocked: unlockedAch.has("reviewer-keeper"),
      sourceLabel: "Gate Keeper",
      unlockHint: "Submit 5 accepted review signals.",
    },
    {
      id: "tri-track-prism",
      name: "Tri-Track Prism",
      rarity: "rare",
      category: "artifact",
      unlocked: unlockedAch.has("cross-discipline"),
      sourceLabel: "Cross Discipline",
      unlockHint: "Earn evidence in Engineering, Documentation, and Review.",
    },
    {
      id: "astral-sundial",
      name: "Astral Sundial",
      rarity: "rare",
      category: "artifact",
      unlocked: unlockedAch.has("cadence-steady"),
      sourceLabel: "Steady Cadence",
      unlockHint: "Contribute in 3 distinct calendar months.",
    },
    ...(isGlobal
      ? [
          {
            id: "wayfarer-astrolabe",
            name: "Wayfarer Astrolabe",
            rarity: "rare" as const,
            category: "artifact" as const,
            unlocked: unlockedAch.has("realm-dual"),
            sourceLabel: "Realm Walker",
            unlockHint: "Contribute across 2 tracked repositories.",
          },
        ]
      : []),
    {
      id: "architect-compass",
      name: "Architect's Compass",
      rarity: "epic",
      category: "weapon",
      unlocked: unlockedAch.has("merge-architect"),
      sourceLabel: "Merge Architect",
      unlockHint: "Land 15 merged pull requests.",
    },
    {
      id: "grand-archive-tome",
      name: "Grand Archive Tome",
      rarity: "epic",
      category: "tome",
      unlocked: unlockedAch.has("scribe-master"),
      sourceLabel: "Scribe Master",
      unlockHint: "Complete 10 documentation contributions.",
    },
    {
      id: "bastion-aegis",
      name: "Bastion Aegis",
      rarity: "epic",
      category: "shield",
      unlocked: unlockedAch.has("reviewer-sentinel"),
      sourceLabel: "Review Sentinel",
      unlockHint: "Submit 12 accepted review signals.",
    },
    {
      id: "hourglass-of-ages",
      name: "Hourglass of Ages",
      rarity: "epic",
      category: "artifact",
      unlocked: unlockedAch.has("history-deep") || unlockedAch.has("history-epic"),
      sourceLabel: unlockedAch.has("history-epic") ? "Epic Chronicle" : "History Deep-Dive",
      unlockHint: "Record 25 pieces of contribution evidence.",
    },
    {
      id: "quest-hoard-chest",
      name: "Quest Hoard Chest",
      rarity: "rare",
      category: "chest",
      unlocked: completedQuests > 0,
      sourceLabel: completedQuests > 0 ? `${completedQuests} quest${completedQuests === 1 ? "" : "s"} cleared` : "Quests",
      unlockHint: "Complete any suggested quest.",
    },
    {
      id: "arcane-grimoire",
      name: "Arcane Grimoire",
      rarity: "rare",
      category: "tome",
      unlocked: view.preference.mageActive,
      sourceLabel: view.preference.magePath ? `Mage — ${view.preference.magePath.name}` : "Mage (self-reported)",
      unlockHint: "Enable the self-reported Mage designation in your profile.",
    },
    {
      id: "sovereign-rank-signet",
      name: "Sovereign Rank Signet",
      rarity: "mythic",
      category: "crown",
      unlocked: view.rank === "S",
      sourceLabel: "Rank S",
      unlockHint: "Ascend to Rank S.",
    },
    {
      id: "monarch-diadem",
      name: "Monarch Diadem",
      rarity: "mythic",
      category: "crown",
      unlocked: unlockedMonarchs.length > 0,
      sourceLabel: unlockedMonarchs.length > 0 ? unlockedMonarchs[0].title : "Monarch Ascension",
      unlockHint: "Unlock any earned specialty Monarch title.",
    },
  ];

  const byRarity: Record<RelicRarity, { unlocked: number; total: number }> = {
    common: { unlocked: 0, total: 0 },
    uncommon: { unlocked: 0, total: 0 },
    rare: { unlocked: 0, total: 0 },
    epic: { unlocked: 0, total: 0 },
    mythic: { unlocked: 0, total: 0 },
  };
  for (const item of items) {
    byRarity[item.rarity].total += 1;
    if (item.unlocked) byRarity[item.rarity].unlocked += 1;
  }

  return {
    items,
    unlockedCount: items.filter((i) => i.unlocked).length,
    totalCount: items.length,
    chestsOpened: completedQuests,
    chestsTotal: view.quests.length,
    byRarity,
  };
}

export const RARITY_LABELS: Record<RelicRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  mythic: "Mythic",
};

export const RARITY_LIST = RARITY_ORDER;
