import type { DashboardSnapshot } from "@/lib/contracts";

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

export function renderShareSvg(snapshot: DashboardSnapshot): string {
  const width = 860;
  const height = 460;
  const tracks = snapshot.tracks.slice(0, 3);
  const bars = tracks.map((track, index) => {
    const y = 220 + index * 56;
    const progress = pct(track.xp, snapshot.progression.totalXp || 1);
    return `
      <text x="36" y="${y}" fill="#CBD5E1" font-size="14">${esc(track.name)}</text>
      <rect x="180" y="${y - 13}" width="460" height="16" rx="8" fill="#1E293B" />
      <rect x="180" y="${y - 13}" width="${Math.max(4, Math.round(4.6 * progress))}" height="16" rx="8" fill="#38BDF8" />
      <text x="654" y="${y}" fill="#E2E8F0" font-size="13">${track.xp} XP</text>
    `;
  }).join("");
  const warning = snapshot.warnings[0] ? `Warning: ${snapshot.warnings[0]}` : "No warnings";
  const repoCount = snapshot.repositories.length;
  const scopeLabel = snapshot.scope.kind === "global" ? "Global" : `Repository: ${snapshot.scope.repositoryId}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">RepoQuest card for ${esc(snapshot.profile.username)}</title>
  <desc id="desc">Local-first contribution RPG summary generated from ${esc(snapshot.source)} data.</desc>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" rx="18" />
  <text x="36" y="56" fill="#E2E8F0" font-size="15">RepoQuest • ${esc(snapshot.source === "demo" ? "Demo data (sample character)" : "Live sync snapshot")} • ${esc(scopeLabel)}</text>
  <text x="36" y="104" fill="#F8FAFC" font-size="34" font-weight="700">${esc(snapshot.profile.displayName || snapshot.profile.username)}</text>
  <text x="36" y="136" fill="#BFDBFE" font-size="18">@${esc(snapshot.profile.username)}</text>
  <text x="36" y="174" fill="#DBEAFE" font-size="20">${esc(snapshot.profile.title)} • Rank ${snapshot.progression.rank} • Lv ${snapshot.progression.level}</text>
  <text x="36" y="198" fill="#DBEAFE" font-size="16">Total XP: ${snapshot.progression.totalXp} • Evidence: ${snapshot.evidence.length} • Repositories: ${repoCount}</text>
  ${bars}
  <text x="36" y="418" fill="#E2E8F0" font-size="12">${esc(warning)}</text>
  <text x="36" y="438" fill="#94A3B8" font-size="12">Generated ${esc(snapshot.generatedAt)}. Card omits private evidence details and credentials.</text>
</svg>`;
}
