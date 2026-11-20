import type { CharacterClassId, MagePathId, MasteryDisciplineId, SkillTrack } from "@/lib/contracts";
import type { RelicRarity } from "@/lib/client/relics";

const CLASS_ART: Record<CharacterClassId, { src: string; alt: string }> = {
  adventurer: { src: "/art/classes/adventurer.jpg", alt: "Adventurer emblem: brass compass, wayfarer lantern and map scroll" },
  warrior: { src: "/art/classes/warrior.jpg", alt: "Warrior emblem: forged broadsword, hammer and burning anvil crest" },
  healer: { src: "/art/classes/healer.jpg", alt: "Healer emblem: restorative emerald chalice and botanical staff" },
  mage: { src: "/art/classes/mage.jpg", alt: "Mage emblem: arcane amethyst crystal astrolabe and luminous grimoire" },
  scribe: { src: "/art/classes/scribe.jpg", alt: "Scribe emblem: silver feather quill, inkwell and frost-sealed scroll" },
  guardian: { src: "/art/classes/guardian.jpg", alt: "Guardian emblem: hexagonal verdigris tower shield and bastion gate" },
};

/** Illustrated class medallion portrait backed by generated artwork in public/art/classes/. */
export function ClassPortrait({
  classId,
  size = "md",
  decorative = true,
}: {
  classId: CharacterClassId;
  size?: "sm" | "md" | "lg";
  decorative?: boolean;
}) {
  const art = CLASS_ART[classId];
  return (
    <span className={`class-portrait class-portrait-${size} class-${classId}`} aria-hidden={decorative || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.src} alt={decorative ? "" : art.alt} loading="lazy" decoding="async" />
      <span className="portrait-frame" aria-hidden="true" />
    </span>
  );
}

/** Crisp inline SVG emblem for each character class (used in badges, mix rows, and compact chips). */
export function ClassMiniIcon({ classId, size = 18 }: { classId: CharacterClassId; size?: number }) {
  return (
    <svg className={`obj-icon class-${classId}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {classId === "warrior" && (
        <>
          <path d="M5 19L16 8M14 5l5 5-2 2-5-5 2-2ZM4 16l4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 3.5L20.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </>
      )}
      {classId === "healer" && (
        <>
          <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" strokeOpacity=".55" />
        </>
      )}
      {classId === "mage" && (
        <>
          <path d="M12 2.5L14.4 9.6L21.5 12L14.4 14.4L12 21.5L9.6 14.4L2.5 12L9.6 9.6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="currentColor" fillOpacity=".18" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </>
      )}
      {classId === "scribe" && (
        <>
          <path d="M19.5 4.5C15 5 11.2 8.2 8.5 13.5L6 19l5.5-2.5c5.3-2.7 8.5-6.5 8-12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="currentColor" fillOpacity=".15" />
          <path d="M9.5 14.5L15 9M4.5 20.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {classId === "guardian" && (
        <>
          <path d="M12 3L19.5 6.2V12.5C19.5 16.8 16.2 19.9 12 21.5C7.8 19.9 4.5 16.8 4.5 12.5V6.2L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="currentColor" fillOpacity=".16" />
          <path d="M12 7.5v9M8.5 11.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {classId === "adventurer" && (
        <>
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
          <polygon points="12,5.5 14.2,11.8 12,18.5 9.8,11.8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity=".22" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** Illustrated treasure chest for Quests & Relic Vault (locked iron chest vs glowing open chest). */
export function QuestChest({
  completed,
  track,
  size = "md",
}: {
  completed: boolean;
  track?: SkillTrack;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`quest-chest quest-chest-${size} ${completed ? "opened" : "locked"}${track ? ` track-${track}` : ""}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={completed ? "/art/objects/chest-open.jpg" : "/art/objects/chest-locked.jpg"}
        alt=""
        loading="lazy"
        decoding="async"
      />
      {completed && <span className="chest-glow" />}
    </span>
  );
}

/** Multi-layered SVG medallion for each Skill Track. */
export function TrackEmblem({ track, size = 44 }: { track: SkillTrack; size?: number }) {
  return (
    <span className={`track-emblem track-${track}`} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <polygon points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5" fill="#0d1215" stroke="currentColor" strokeWidth="2" />
        <polygon points="24,8 37.5,15.8 37.5,32.2 24,40 10.5,32.2 10.5,15.8" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.2" />
        {track === "engineering" && (
          <>
            <path d="M16 32L31 17M27 14l7 7-3 3-7-7 3-3Z" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity=".2" />
            <path d="M15 28l5 5M14 34l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {track === "documentation" && (
          <>
            <path d="M33 14c-6 1-11.5 5-15 12l-3 7 7-3c7-3.5 11-9 11-16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" fillOpacity=".2" />
            <path d="M20 28l8-8M15 35h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {track === "review" && (
          <>
            <path d="M24 12l10 4.2v7.8c0 5.4-4 9.3-10 11.5-6-2.2-10-6.1-10-11.5v-7.8L24 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" fillOpacity=".18" />
            <path d="M19.5 24l3 3.2 6.5-6.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </span>
  );
}

/** Hand-crafted SVG achievement token medallion with unique vector art per achievement ID. */
export function AchievementToken({
  id,
  track,
  unlocked,
  size = 52,
}: {
  id: string;
  track: string;
  unlocked: boolean;
  size?: number;
}) {
  const toneClass = track === "engineering" || track === "documentation" || track === "review" ? `token-${track}` : "token-general";
  const isMonarch = id.startsWith("mastery-");
  return (
    <span className={`ach-token ${toneClass} ${unlocked ? "unlocked" : "locked"}${isMonarch ? " token-monarch" : ""}`} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        {isMonarch ? (
          <>
            <polygon points="28,3 48,12 52,33 38,51 18,51 4,33 8,12" fill="var(--ink)" stroke="currentColor" strokeWidth="2.2" />
            <polygon points="28,8 43,15 46,31 35,45 21,45 10,31 13,15" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.2" />
          </>
        ) : (
          <>
            <circle cx="28" cy="28" r="24" fill="var(--ink)" stroke="currentColor" strokeWidth="2.2" />
            <circle cx="28" cy="28" r="19.5" stroke="currentColor" strokeOpacity=".38" strokeWidth="1.2" strokeDasharray={unlocked ? undefined : "3 3"} />
          </>
        )}
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity={unlocked ? 0.2 : 0.06}>
          {renderAchievementGlyph(id)}
        </g>
        {!unlocked && (
          <g transform="translate(36, 36)">
            <circle cx="8" cy="8" r="8" fill="#141b1f" stroke="var(--rule-2)" strokeWidth="1.5" />
            <rect x="5" y="7.5" width="6" height="4.5" rx="1" fill="none" stroke="var(--mute)" strokeWidth="1.3" />
            <path d="M6.2 7.5V6a1.8 1.8 0 0 1 3.6 0v1.5" fill="none" stroke="var(--mute)" strokeWidth="1.3" />
          </g>
        )}
      </svg>
    </span>
  );
}

function renderAchievementGlyph(id: string) {
  switch (id) {
    case "merge-initiate":
      return (
        <>
          <circle cx="21" cy="19" r="3" />
          <circle cx="35" cy="19" r="3" />
          <circle cx="28" cy="37" r="3.2" />
          <path d="M21 22c0 5 7 6 7 12M35 22c0 5-7 6-7 12" fill="none" />
        </>
      );
    case "merge-vanguard":
      return (
        <>
          <path d="M18 37L36 19M31 15l7 7-3 3-7-7 3-3Z" />
          <path d="M38 37L20 19" fill="none" />
        </>
      );
    case "merge-architect":
      return (
        <>
          <polygon points="28,14 40,21 28,28 16,21" />
          <path d="M16 28l12 7 12-7M16 34l12 7 12-7" fill="none" />
        </>
      );
    case "scribe-awakens":
      return (
        <>
          <path d="M37 16c-6 1-11 5-14 12l-3 8 8-3c7-3 10-9 9-17Z" />
          <path d="M18 39h18" fill="none" />
        </>
      );
    case "scribe-steady":
      return (
        <>
          <rect x="17" y="16" width="22" height="24" rx="2" />
          <path d="M22 22h12M22 27h12M22 32h8" fill="none" />
        </>
      );
    case "scribe-master":
      return (
        <>
          <path d="M14 20c5-2 10-1 14 2 4-3 9-4 14-2v17c-5-2-10-1-14 2-4-3-9-4-14-2V20Z" />
          <path d="M28 22v17" fill="none" />
        </>
      );
    case "reviewer-first-pass":
      return (
        <>
          <circle cx="25" cy="25" r="8" />
          <path d="M31 31l7 7M22 25l2.2 2.2L29 22.5" fill="none" />
        </>
      );
    case "reviewer-keeper":
      return (
        <>
          <path d="M17 38V23a11 11 0 0 1 22 0v15" fill="none" />
          <path d="M15 38h26M23 38v-9a5 5 0 0 1 10 0v9" />
        </>
      );
    case "reviewer-sentinel":
      return (
        <>
          <path d="M28 14l12 5v9c0 6.5-5 11.2-12 13.5C21 39.2 16 34.5 16 28v-9l12-5Z" />
          <path d="M23 28l3.5 3.5 7-7.5" fill="none" />
        </>
      );
    case "cross-discipline":
      return (
        <>
          <circle cx="28" cy="18" r="4" />
          <circle cx="19" cy="34" r="4" />
          <circle cx="37" cy="34" r="4" />
          <path d="M25.5 21.5L21 30.5M30.5 21.5L35 30.5M23 34h10" fill="none" />
        </>
      );
    case "realm-dual":
      return (
        <>
          <polygon points="15,20 24,16 32,20 41,16 41,36 32,40 24,36 15,40" />
          <path d="M24 16v20M32 20v20" fill="none" />
        </>
      );
    case "realm-triple":
      return (
        <>
          <circle cx="28" cy="28" r="11" fill="none" />
          <polygon points="28,15 31,25 41,28 31,31 28,41 25,31 15,28 25,25" />
        </>
      );
    case "history-deep":
      return (
        <>
          <path d="M19 15h18M19 41h18M21 15c0 7 7 10 7 13s-7 6-7 13M35 15c0 7-7 10-7 13s7 6 7 13" fill="none" />
          <polygon points="24,38 32,38 28,32" />
        </>
      );
    case "history-epic":
      return (
        <>
          <polygon points="14,39 24,20 31,31 35,24 42,39" />
          <path d="M24 15l1.5-2.5L27 15" fill="none" />
        </>
      );
    case "cadence-steady":
      return (
        <>
          <rect x="16" y="18" width="24" height="21" rx="2" />
          <path d="M16 24h24M22 15v5M34 15v5M22 30h4M30 30h4M22 35h4" fill="none" />
        </>
      );
    default:
      // Monarch achievements & fallback: Sovereign Crown
      return (
        <>
          <path d="M15 36l3-14 10 7 10-7 3 14H15Z" />
          <circle cx="28" cy="17" r="2.2" />
          <path d="M16 40h24" fill="none" />
        </>
      );
  }
}

/** Sovereign Crown Crest for Monarch Ascension cards. */
export function MonarchCrown({
  disciplineId,
  unlocked,
  size = 48,
}: {
  disciplineId: MasteryDisciplineId;
  unlocked: boolean;
  size?: number;
}) {
  return (
    <span className={`monarch-crest monarch-${disciplineId} ${unlocked ? "unlocked" : "locked"}`} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <polygon points="26,3 45,11 49,31 36,48 16,48 3,31 7,11" fill="var(--ink)" stroke="currentColor" strokeWidth="2" />
        <path d="M13 33l3-13 10 6.5L36 20l3 13H13Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" fill="currentColor" fillOpacity={unlocked ? 0.25 : 0.08} />
        <path d="M15 37.5h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {disciplineId === "backend" && <circle cx="26" cy="14" r="2.6" fill="currentColor" />}
        {disciplineId === "frontend" && <polygon points="26,10 30,15 26,19 22,15" fill="currentColor" />}
        {disciplineId === "ai" && <path d="M26 10l1.5 3.5L31 15l-3.5 1.5L26 20l-1.5-3.5L21 15l3.5-1.5Z" fill="currentColor" />}
        {disciplineId === "systems" && (
          <>
            <circle cx="21" cy="14" r="1.8" fill="currentColor" />
            <circle cx="31" cy="14" r="1.8" fill="currentColor" />
            <circle cx="26" cy="11" r="1.8" fill="currentColor" />
          </>
        )}
        {disciplineId === "qa" && <path d="M23 15l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {disciplineId === "documentation" && <path d="M26 11v7M22.5 14.5h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {disciplineId === "review" && <circle cx="26" cy="14.5" r="3" stroke="currentColor" strokeWidth="1.6" />}
      </svg>
    </span>
  );
}

/** Crisp SVG icon for each technical specialty. */
export function SpecialtyBadgeIcon({ specialtyId, size = 20 }: { specialtyId: string; size?: number }) {
  return (
    <svg className={`obj-icon spec-icon spec-${specialtyId}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {specialtyId === "backend" && (
        <>
          <rect x="4" y="4" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="4" y="14" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="8" cy="7" r="1" fill="currentColor" />
          <circle cx="8" cy="17" r="1" fill="currentColor" />
        </>
      )}
      {specialtyId === "frontend" && (
        <>
          <polygon points="12,3 21,12 12,21 3,12" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity=".15" />
          <polygon points="12,7.5 16.5,12 12,16.5 7.5,12" stroke="currentColor" strokeWidth="1.3" />
        </>
      )}
      {specialtyId === "ai" && (
        <>
          <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity=".16" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </>
      )}
      {specialtyId === "systems" && (
        <>
          <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="5.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="18.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M10.7 7.2L6.8 15.6M13.3 7.2l3.9 8.4M8 18h8" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      {specialtyId === "qa" && (
        <>
          <path d="M12 3l8 3.5v6c0 4.5-3.2 7.8-8 9.5-4.8-1.7-8-5-8-9.5v-6L12 3Z" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.5 12l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {!["backend", "frontend", "ai", "systems", "qa"].includes(specialtyId) && (
        <>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** Arcane SVG seal for each Mage Path. */
export function MagePathSigil({ pathId, size = 28 }: { pathId?: MagePathId | null; size?: number }) {
  return (
    <svg className="obj-icon mage-path-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.4" />
      {pathId === "intelligence_monarch" ? (
        <>
          <polygon points="16,4 19,12 28,16 19,20 16,28 13,20 4,16 13,12" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity=".24" />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
        </>
      ) : pathId === "agents_monarch" ? (
        <>
          <path d="M8 22l2-10 6 4 6-4 2 10H8Z" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity=".22" />
          <circle cx="16" cy="9" r="2" fill="currentColor" />
        </>
      ) : pathId === "orchestrator" ? (
        <>
          <circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="9.5" cy="21" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="22.5" cy="21" r="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14.5 11.2L10.8 18.6M17.5 11.2l3.7 7.4M12 21h8" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : pathId === "agent_weaver" ? (
        <>
          <ellipse cx="16" cy="16" rx="9" ry="4.5" stroke="currentColor" strokeWidth="1.6" transform="rotate(35 16 16)" />
          <ellipse cx="16" cy="16" rx="9" ry="4.5" stroke="currentColor" strokeWidth="1.6" transform="rotate(-35 16 16)" />
          <circle cx="16" cy="16" r="2.2" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M16 6l2.5 7.5L26 16l-7.5 2.5L16 26l-2.5-7.5L6 16l7.5-2.5Z" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity=".2" />
        </>
      )}
    </svg>
  );
}

/** Heraldic banner crest for Repository Realms. */
export function RealmCrest({ tone }: { tone: string }) {
  return (
    <span className={`realm-crest realm-tone-${tone}`} aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <path d="M6 4h16v15l-8 5-8-5V4Z" fill="var(--slate-2)" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M14 8v10M10 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".8" />
      </svg>
    </span>
  );
}

/** Crisp vector icon for Contribution Evidence kinds (PR, Review, Issue). */
export function EvidenceKindIcon({ kind, track }: { kind: string; track: SkillTrack }) {
  return (
    <span className={`ev-icon ev-${track}`} aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--slate-2)" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.3" />
        {kind === "pull_request" && (
          <>
            <circle cx="8.5" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="15.5" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="16.5" r="1.8" fill="currentColor" />
            <path d="M8.5 9.8c0 3 3.5 3.2 3.5 5M15.5 9.8c0 3-3.5 3.2-3.5 5" stroke="currentColor" strokeWidth="1.5" />
          </>
        )}
        {kind === "review" && (
          <>
            <path d="M12 6l5.5 2.2v4c0 3.2-2.2 5.4-5.5 6.8-3.3-1.4-5.5-3.6-5.5-6.8v-4L12 6Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 12.2l1.8 1.8 3.2-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}
        {kind !== "pull_request" && kind !== "review" && (
          <>
            <path d="M8 7h8v10H8V7Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10h4M10 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  );
}

/** Small heraldic ribbon icon for earned title chips. */
export function TitleRibbonIcon() {
  return (
    <svg className="title-ribbon-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity=".2" />
      <path d="M5.5 9.5L4.5 14l3.5-1.6L11.5 14l-1-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** Custom SVG item illustration for each collectible RPG relic in the Relic Vault. */
export function RelicItemIcon({
  relicId,
  rarity,
  unlocked,
}: {
  relicId: string;
  rarity: RelicRarity;
  unlocked: boolean;
}) {
  if (relicId === "quest-hoard-chest") {
    return <QuestChest completed={unlocked} size="sm" />;
  }
  return (
    <span className={`vault-relic-icon rarity-${rarity} ${unlocked ? "unlocked" : "locked"}`} aria-hidden="true">
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="var(--ink)" stroke="currentColor" strokeWidth="1.8" />
        <rect x="8" y="8" width="32" height="32" rx="5" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" />
        <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity={unlocked ? 0.2 : 0.05}>
          {renderRelicGlyph(relicId)}
        </g>
      </svg>
    </span>
  );
}

function renderRelicGlyph(relicId: string) {
  switch (relicId) {
    case "iron-merge-blade":
      return (
        <>
          <path d="M15 33L32 16l3-3-3 3-17 17Z" />
          <path d="M29 14l5 5M14 29l5 5M13 35l2-2" fill="none" />
        </>
      );
    case "vanguard-hammer":
      return (
        <>
          <rect x="22" y="13" width="13" height="8" rx="1.5" transform="rotate(45 28.5 17)" />
          <path d="M25 23L14 34" fill="none" strokeWidth="2.4" />
        </>
      );
    case "architect-compass":
      return (
        <>
          <circle cx="24" cy="14" r="2.5" />
          <path d="M22.5 16.5L15 34M25.5 16.5L33 34M17 28a10 10 0 0 0 14 0" fill="none" />
        </>
      );
    case "silver-quill":
      return (
        <>
          <path d="M33 13c-5.5 1-10.5 4.8-13.5 11.5L16 33l8.5-3.5c6.7-3 10.5-8 8.5-16.5Z" />
          <path d="M15 35h16" fill="none" />
        </>
      );
    case "illuminated-codex":
    case "grand-archive-tome":
      return (
        <>
          <path d="M13 17c4-1.8 8-1 11 1.8 3-2.8 7-3.6 11-1.8v15c-4-1.8-8-1-11 1.8-3-2.8-7-3.6-11-1.8V17Z" />
          <path d="M24 19v15" fill="none" />
        </>
      );
    case "sentinel-spyglass":
      return (
        <>
          <circle cx="21" cy="21" r="7" />
          <path d="M26.5 26.5L34 34" fill="none" strokeWidth="2.4" />
        </>
      );
    case "gatekeeper-buckler":
    case "bastion-aegis":
      return (
        <>
          <path d="M24 12l10 4v8c0 5.5-4 9.5-10 11.5-6-2-10-6-10-11.5v-8l10-4Z" />
          <path d="M24 17v13M19 23h10" fill="none" />
        </>
      );
    case "tri-track-prism":
      return (
        <>
          <polygon points="24,11 36,33 12,33" />
          <polygon points="24,18 30,29 18,29" fill="none" />
        </>
      );
    case "astral-sundial":
      return (
        <>
          <circle cx="24" cy="24" r="10" fill="none" />
          <path d="M24 14v10l6 4M14 24h2M32 24h2M24 32v2" fill="none" />
        </>
      );
    case "wayfarer-astrolabe":
      return (
        <>
          <circle cx="24" cy="24" r="10" fill="none" />
          <polygon points="24,15 26.5,24 24,33 21.5,24" />
        </>
      );
    case "hourglass-of-ages":
      return (
        <>
          <path d="M17 13h14M17 35h14M19 13c0 6 5 8 5 11s-5 5-5 11M29 13c0 6-5 8-5 11s5 5 5 11" fill="none" />
        </>
      );
    case "arcane-grimoire":
      return (
        <>
          <rect x="15" y="12" width="18" height="24" rx="2" />
          <path d="M24 18l1.6 4.4L30 24l-4.4 1.6L24 30l-1.6-4.4L18 24l4.4-1.6Z" />
        </>
      );
    case "sovereign-rank-signet":
      return (
        <>
          <polygon points="24,11 35,17.5 35,30.5 24,37 13,30.5 13,17.5" />
          <circle cx="24" cy="24" r="4" />
        </>
      );
    case "monarch-diadem":
    default:
      return (
        <>
          <path d="M13 31l3-12 8 6 8-6 3 12H13Z" />
          <path d="M15 35h18" fill="none" />
          <circle cx="24" cy="14" r="2" />
        </>
      );
  }
}
