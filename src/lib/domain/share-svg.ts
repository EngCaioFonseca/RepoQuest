import type { CharacterClassId, DashboardSnapshot, Rank, SkillTrack } from "@/lib/contracts";

function esc(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pct(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

const RANK_COLORS: Record<Rank, string> = {
  E: "#9fb0ad",
  D: "#7fe0a6",
  C: "#74bdf0",
  B: "#b9a0f5",
  A: "#ff8aa8",
  S: "#f5cf6a",
};

const CLASS_COLORS: Record<CharacterClassId, string> = {
  healer: "#7fe0a6",
  warrior: "#e8935a",
  mage: "#b9a0f5",
  scribe: "#74bdf0",
  guardian: "#52d6b8",
  adventurer: "#a3b3b0",
};

const TRACK_COLORS: Record<SkillTrack, string> = {
  engineering: "#e8935a",
  documentation: "#74bdf0",
  review: "#b9a0f5",
};

export function renderShareSvg(snapshot: DashboardSnapshot): string {
  const width = 860;
  const height = 470;
  const rankColor = RANK_COLORS[snapshot.progression.rank] ?? "#a3b3b0";
  const classColor = CLASS_COLORS[snapshot.characterClass.id] ?? "#52d6b8";
  const unlockedTokens = snapshot.achievements.filter((a) => a.unlockedAt !== null).length;
  const openedChests = snapshot.quests.filter((q) => q.completed).length;

  const tracks = snapshot.tracks.slice(0, 3);
  const bars = tracks.map((track, index) => {
    const y = 248 + index * 50;
    const progress = pct(track.xp, snapshot.progression.totalXp || 1);
    const barColor = TRACK_COLORS[track.id] ?? "#52d6b8";
    return `
      <circle cx="46" cy="${y - 5}" r="6" fill="${barColor}" />
      <text x="64" y="${y}" fill="#ece6d6" font-size="14" font-family="ui-sans-serif, system-ui, sans-serif">${esc(track.name)} (Lv ${track.level})</text>
      <rect x="240" y="${y - 14}" width="420" height="16" rx="4" fill="#0d1215" stroke="#2b3a41" stroke-width="1" />
      <rect x="240" y="${y - 14}" width="${Math.max(4, Math.round(4.2 * progress))}" height="16" rx="4" fill="${barColor}" />
      <text x="676" y="${y}" fill="#ece6d6" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif">${track.xp} XP</text>
    `;
  }).join("");

  const warning = snapshot.warnings[0] ? `Warning: ${snapshot.warnings[0]}` : "No warnings";
  const repoCount = snapshot.repositories.length;
  const scopeLabel = snapshot.scope.kind === "global" ? "Global" : `Repository: ${snapshot.scope.repositoryId}`;
  const displayTitle = snapshot.classPreference.mageActive
    ? snapshot.classPreference.magePath
      ? `${snapshot.profile.title} · Mage — ${snapshot.classPreference.magePath.name} (self-reported)`
      : `${snapshot.profile.title} · Mage (self-reported)`
    : snapshot.profile.displayTitle;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">RepoQuest card for ${esc(snapshot.profile.username)}</title>
  <desc id="desc">Local-first contribution RPG summary generated from ${esc(snapshot.source)} data.</desc>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b252a" />
      <stop offset="55%" stop-color="#141b1f" />
      <stop offset="100%" stop-color="#0d1215" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" rx="18" stroke="#3d5159" stroke-width="2" />
  <rect x="0" y="0" width="${width}" height="6" fill="#52d6b8" rx="3" />

  <g transform="translate(722, 46)">
    <polygon points="48,4 88,26 88,70 48,92 8,70 8,26" fill="#0d1215" stroke="${rankColor}" stroke-width="3" />
    <polygon points="48,14 78,31 78,65 48,82 18,65 18,31" fill="none" stroke="${rankColor}" stroke-opacity="0.45" stroke-width="1.5" />
    <text x="48" y="61" text-anchor="middle" fill="${rankColor}" font-size="40" font-weight="700" font-family="Georgia, serif">${esc(snapshot.progression.rank)}</text>
    <text x="48" y="112" text-anchor="middle" fill="${classColor}" font-size="13" font-weight="600" font-family="ui-sans-serif, system-ui, sans-serif">${esc(snapshot.characterClass.name)}</text>
  </g>

  <text x="36" y="48" fill="#52d6b8" font-size="14" font-weight="600" font-family="ui-sans-serif, system-ui, sans-serif">RepoQuest • ${esc(snapshot.source === "demo" ? "Demo data (sample character)" : "Live sync snapshot")} • ${esc(scopeLabel)}</text>
  <text x="36" y="96" fill="#ece6d6" font-size="34" font-weight="700" font-family="Georgia, serif">${esc(snapshot.profile.displayName || snapshot.profile.username)}</text>
  <text x="36" y="126" fill="#a3b3b0" font-size="16" font-family="ui-sans-serif, system-ui, sans-serif">@${esc(snapshot.profile.username)}</text>
  <text x="36" y="160" fill="#f08a4b" font-size="19" font-style="italic" font-family="Georgia, serif">${esc(displayTitle)}</text>
  <text x="36" y="190" fill="#ece6d6" font-size="15" font-family="ui-sans-serif, system-ui, sans-serif">Class: ${esc(snapshot.characterClass.name)} • Rank ${snapshot.progression.rank} • Lv ${snapshot.progression.level} • ${snapshot.progression.totalXp} XP</text>
  <text x="36" y="214" fill="#a3b3b0" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif">Tokens: ${unlockedTokens}/${snapshot.achievements.length} • Quest chests: ${openedChests}/${snapshot.quests.length} • Evidence: ${snapshot.evidence.length} • Realms: ${repoCount}</text>
  ${bars}
  <text x="36" y="424" fill="#a3b3b0" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif">${esc(warning)}</text>
  <text x="36" y="446" fill="#7c8f8c" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif">Generated ${esc(snapshot.generatedAt)}. Card omits private evidence details and credentials.</text>
</svg>`;
}
