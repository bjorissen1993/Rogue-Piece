import type { CSSProperties, ReactNode } from "react";
import { TIME_OF_DAY_ORDER } from "../game/constants";
import type { InventoryItem, RelationFactionId, TimeOfDay, WeaponType } from "../models/types";

export type HudIconName =
  | "hourglass"
  | "compass"
  | "pin"
  | "skull"
  | "coin"
  | "heart"
  | "menu"
  | "map"
  | "quill"
  | "lock"
  | "scroll"
  | "anchor"
  | "news"
  | "potion"
  | "meat"
  | "bomb"
  | "book"
  | "blade"
  | "armor"
  | "gem"
  | "fruit"
  | "pouch"
  | "crosshair";

const MARKS: Record<HudIconName, ReactNode> = {
  hourglass: (
    <>
      <path d="M7 3.6h10M7 20.4h10" />
      <path d="M8.2 3.6c.2 3.6 2.4 5.1 3.8 8.4-1.4 3.3-3.6 4.8-3.8 8.4" />
      <path d="M15.8 3.6c-.2 3.6-2.4 5.1-3.8 8.4 1.4 3.3 3.6 4.8 3.8 8.4" />
      <path d="M9.6 12h4.8" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 5.8 14.4 12 12 18.2 9.6 12Z" />
      <circle cx="12" cy="12" r="1.15" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.6-5.8 6.6-11.1A6.6 6.6 0 1 0 5.4 9.9C5.4 15.2 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.15" />
    </>
  ),
  skull: (
    <>
      <path d="M7.2 10.2a4.8 4.8 0 0 1 9.6 0c0 2.2-1.1 3.5-1.1 5.1H8.3c0-1.6-1.1-2.9-1.1-5.1Z" />
      <path d="M9.2 16.8v2.1h1.5v-2.1M13.3 16.8v2.1h1.5v-2.1" />
      <circle cx="9.7" cy="11.4" r="1.15" />
      <circle cx="14.3" cy="11.4" r="1.15" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <circle cx="12" cy="12" r="5.2" />
      <path d="M12 8.4v7.2M10.2 9.6h2.4c1 0 1.7.6 1.7 1.5s-.7 1.5-1.7 1.5H10.6h2.2c1.1 0 1.8.6 1.8 1.6s-.8 1.6-1.9 1.6H10.2" />
    </>
  ),
  heart: (
    <path d="M12 19.6S5.2 14.8 5.2 10.2A3.6 3.6 0 0 1 12 8.2a3.6 3.6 0 0 1 6.8 2C18.8 14.8 12 19.6 12 19.6Z" />
  ),
  menu: (
    <>
      <path d="M5 7.2h14M5 12h14M5 16.8h14" />
    </>
  ),
  map: (
    <>
      <path d="M4.4 6.4 9.2 4.6l5.6 1.8 4.8-1.8v13l-4.8 1.8-5.6-1.8-4.8 1.8Z" />
      <path d="M9.2 4.6v13M14.8 6.4v13" />
    </>
  ),
  quill: (
    <>
      <path d="M5 19.2s2.4-.4 4.2-2.2L18.6 7.6c.8-.8.8-2.1 0-2.9s-2.1-.8-2.9 0L6.9 14.5C5.1 16.3 4.8 18.8 5 19.2Z" />
      <path d="M14.8 6 18 9.2" />
    </>
  ),
  lock: (
    <>
      <rect x="6.4" y="10.6" width="11.2" height="8.6" rx="1.4" />
      <path d="M8.6 10.6V8.4a3.4 3.4 0 0 1 6.8 0v2.2" />
    </>
  ),
  scroll: (
    <>
      <path d="M6.4 6.2h9.4a2 2 0 0 1 2 2v9.2H8.4a2 2 0 0 0-2 2V6.2Z" />
      <path d="M6.4 17.4h11.4" />
      <path d="M9.2 9.2h6.2M9.2 12h6.2" />
    </>
  ),
  anchor: (
    <>
      <circle cx="12" cy="5.8" r="1.7" />
      <path d="M12 7.5v11" />
      <path d="M8.2 11h7.6" />
      <path d="M6.2 15.2C6.8 18 9 19.4 12 19.4s5.2-1.4 5.8-4.2" />
    </>
  ),
  news: (
    <>
      <path d="M5 6.4h11.2a2 2 0 0 1 2 2v9.2H7a2 2 0 0 0-2 2V6.4Z" />
      <path d="M8.2 9.4h6.6M8.2 12.2h6.6M8.2 15h4.2" />
    </>
  ),
  potion: (
    <>
      <path d="M10 4.4h4M10.6 4.4v3.1L7.8 12.2A4.4 4.4 0 0 0 11.6 19.6h.8a4.4 4.4 0 0 0 3.8-7.4L13.4 7.5V4.4" />
      <path d="M8.6 13.6h6.8" />
    </>
  ),
  meat: (
    <>
      <path d="M6.2 13.2c0-3.6 2.8-6.6 6.6-6.6 2.2 0 3.4 1.4 3.4 3.1 0 3.8-3.2 6.5-6.6 6.5-2 0-3.4-1.3-3.4-3Z" />
      <path d="M15.4 8.2c1.6-.8 3.8-.2 4.2 1.6.3 1.4-.8 2.4-2.2 2.6" />
    </>
  ),
  bomb: (
    <>
      <circle cx="11.2" cy="13.4" r="6" />
      <path d="M15.2 8.6 17 6.6c.8.4 1.6-.2 2.2-1.2" />
      <path d="M16.6 5.8c.6.5 1.4.4 2 .1" />
    </>
  ),
  book: (
    <>
      <path d="M5.6 6.2h5.2c1.3 0 2.4.8 2.4 2.2v9.2c-1.2-.8-2.4-1-3.8-1H5.6Z" />
      <path d="M18.4 6.2h-5.2c-1.3 0-2.4.8-2.4 2.2v9.2c1.2-.8 2.4-1 3.8-1h3.8Z" />
    </>
  ),
  blade: (
    <>
      <path d="M6.2 17.8 16.8 6.4" />
      <path d="M14.6 5.8h3.8v3.8" />
      <path d="M6.6 14.6 9.4 17.4" />
    </>
  ),
  armor: (
    <>
      <path d="M8.2 5.6 12 7.2l3.8-1.6 2.4 2.2v3.2c0 5.1-2.8 7.8-6.2 8.8-3.4-1-6.2-3.7-6.2-8.8V7.8Z" />
    </>
  ),
  gem: (
    <>
      <path d="M8.2 5.8h7.6L19 9.4 12 19 5 9.4Z" />
      <path d="M5.4 9.4h13.2M12 19 8.4 9.4M12 19l3.6-9.6" />
    </>
  ),
  fruit: (
    <>
      <path d="M12 7.2c-3.6 0-6.2 3.1-6.2 6.6 0 3.2 2.4 5.8 6.2 5.8s6.2-2.6 6.2-5.8c0-3.5-2.6-6.6-6.2-6.6Z" />
      <path d="M12 7.4c.4-1.8 1.8-3 3.6-3.2" />
    </>
  ),
  pouch: (
    <>
      <path d="M8.2 9.6h7.6l1.4 9.2H6.8Z" />
      <path d="M9.4 9.6c0-2 1.1-3.6 2.6-3.6s2.6 1.6 2.6 3.6" />
      <path d="M10.4 12.4h3.2" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.2v3.6M12 17.2v3.6M3.2 12h3.6M17.2 12h3.6" />
    </>
  ),
};

export const HUD_ART: Partial<Record<HudIconName, string>> = {
  hourglass: "/icons/UI/time.png",
  compass: "/icons/UI/location.png",
  pin: "/icons/UI/region.png",
  coin: "/icons/UI/money.png",
  pouch: "/icons/UI/item.png",
  fruit: "/icons/Events/Devil_Fruit.png",
};

export const FACTION_ART: Record<RelationFactionId, string> = {
  MARINES: "/icons/Faction/marines.png",
  PIRATES: "/icons/Faction/pirates.png",
  WORLD_GOVERNMENT: "/icons/Faction/world-government.png",
  CIVILIANS: "/icons/Faction/civilians.png",
  REVOLUTIONARY_ARMY: "/icons/Faction/revolutionary-army.png",
};

/** Circular crew-card portraits (Leader = captain/player, Crew = crewmates). */
export type FactionPortraitRole = "leader" | "crew";

/**
 * Filename stems under public/icons/Crew (actual on-disk names).
 * Civilian → Civillian_*, Revolutionary → Revolutionairy_* (uploaded spellings).
 */
const FACTION_PORTRAIT_STEM: Record<RelationFactionId, string> = {
  MARINES: "Marines",
  PIRATES: "Pirates",
  WORLD_GOVERNMENT: "Government",
  CIVILIANS: "Civillian",
  REVOLUTIONARY_ARMY: "Revolutionairy",
};

export const FACTION_PORTRAIT_FALLBACK: Record<FactionPortraitRole, string> = {
  leader: "/icons/Crew/Civillian_Leader.png",
  crew: "/icons/Crew/Civillian_Crew.png",
};

/**
 * Resolve a faction id (career, relation, npc, or loose alias) to a portrait asset
 * in public/icons/Crew (*_Leader.png / *_Crew.png).
 */
export function factionPortraitSrc(
  factionId: string | null | undefined,
  role: FactionPortraitRole,
): string {
  const key = normalizeFactionPortraitKey(factionId);
  const stem = key ? FACTION_PORTRAIT_STEM[key] : null;
  if (!stem) {
    return FACTION_PORTRAIT_FALLBACK[role];
  }
  const suffix = role === "leader" ? "Leader" : "Crew";
  return `/icons/Crew/${stem}_${suffix}.png`;
}

function normalizeFactionPortraitKey(
  factionId: string | null | undefined,
): RelationFactionId | null {
  if (!factionId) {
    return null;
  }
  switch (factionId.toUpperCase()) {
    case "MARINES":
    case "MARINE":
      return "MARINES";
    case "PIRATES":
    case "PIRATE":
      return "PIRATES";
    case "WORLD_GOVERNMENT":
    case "GOVERNMENT":
      return "WORLD_GOVERNMENT";
    case "CIVILIANS":
    case "CIVILIAN":
      return "CIVILIANS";
    case "REVOLUTIONARY_ARMY":
    case "REVOLUTIONARY":
    case "REVOLUTIONAIRY":
      return "REVOLUTIONARY_ARMY";
    default:
      return null;
  }
}

export const BOUNTY_ART = "/icons/UI/bounty.png";
export const TITLE_ART = "/icons/UI/Title.png";
export const CREST_ART = "/icons/UI/pirate-head.png";
export const TIME_LOOP_ART = "/icons/UI/Time_Loop.png";
export const RECOVERING_ART = "/icons/Crew/Recovering.png";
export const UNAVAILABLE_ART = "/icons/Crew/Unavailable.png";
/** Affliction / DoT badge (poison, sickness). */
export const AFFLICTION_DOT_ART = "/icons/Skill_Badge/Badge_Damage_Over_Time-Affliction.png";
/** Skill-badge DF art (same asset as DEVIL_FRUIT in skillBadges). */
export const DEVIL_FRUIT_BADGE_ART = "/icons/Skill_Badge/Badge_Devil_Fruit.png";
export const DEVIL_FRUIT_ICON_FALLBACK = "/icons/Events/Devil_Fruit.png";

/** UI badge art for roster weapon-class icons. */
export type WeaponIconKind = "Unarmed" | "Sword" | "Spear" | "Staff" | "Rifle" | "Shield";

export const WEAPON_ICON_ART: Record<WeaponIconKind, string> = {
  Unarmed: "/icons/Weapons/Weapon_Unarmed.png",
  Sword: "/icons/Weapons/Weapon_Sword.png",
  Spear: "/icons/Weapons/Weapon_Spear.png",
  Staff: "/icons/Weapons/Weapon_Staff_2H.png",
  Rifle: "/icons/Weapons/Weapon_Pistol_2H.png",
  Shield: "/icons/Weapons/Weapon_Shield.png",
};

/**
 * Map game WeaponType → roster icon.
 * SWORD → Sword; SPEAR → Spear; CLUB → Staff; GUN → 2H pistol (rifles); FISTS/KICKS/none → Unarmed.
 */
export function weaponIconKind(weaponType?: WeaponType | null): WeaponIconKind {
  switch (weaponType) {
    case "SWORD":
      return "Sword";
    case "SPEAR":
      return "Spear";
    case "CLUB":
      return "Staff";
    case "GUN":
      return "Rifle";
    case "FISTS":
    case "KICKS":
    default:
      return "Unarmed";
  }
}

export function weaponIconSrc(
  weaponType?: WeaponType | null,
  emptyKind: WeaponIconKind = "Unarmed",
): string {
  if (!weaponType) {
    return WEAPON_ICON_ART[emptyKind];
  }
  return WEAPON_ICON_ART[weaponIconKind(weaponType)];
}

/** Day-bottom / night-top art: sweep 0°→180° across TIME_OF_DAY_ORDER so night lands upright. */
const TIME_LOOP_BASE_ROTATION_DEG = 270; // temporary: quarter-turn clockwise + 180°

export function timeLoopRotationDeg(timeOfDay: TimeOfDay): number {
  const index = Math.max(0, TIME_OF_DAY_ORDER.indexOf(timeOfDay));
  const last = TIME_OF_DAY_ORDER.length - 1;
  const sweep = last <= 0 ? 0 : (index / last) * 180;
  return TIME_LOOP_BASE_ROTATION_DEG + sweep;
}

export function TimeLoopEmblem({
  timeOfDay,
  size,
}: {
  timeOfDay: TimeOfDay;
  size?: number;
}) {
  const deg = timeLoopRotationDeg(timeOfDay);
  return (
    <span
      aria-hidden="true"
      className="time-loop-emblem"
      style={
        size != null
          ? ({ "--time-loop-size": `${size}px` } as CSSProperties)
          : undefined
      }
    >
      <img
        alt=""
        className="time-loop-emblem-dial"
        draggable={false}
        height={size}
        src={TIME_LOOP_ART}
        style={{ transform: `rotate(${deg}deg)` }}
        width={size}
      />
    </span>
  );
}

export function HudArt({
  src,
  size = 18,
  className = "",
  fallbackSrc,
}: {
  src: string;
  size?: number;
  className?: string;
  fallbackSrc?: string;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={["hud-art", "hud-icon", className].filter(Boolean).join(" ")}
      draggable={false}
      height={size}
      onError={(event) => {
        if (!fallbackSrc || event.currentTarget.dataset.fallbackApplied === "1") {
          return;
        }
        event.currentTarget.dataset.fallbackApplied = "1";
        event.currentTarget.src = fallbackSrc;
      }}
      src={src}
      width={size}
    />
  );
}

function SvgMark({
  size,
  className,
  children,
}: {
  size: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

export function HudIcon({
  name,
  size = 18,
  className = "",
}: {
  name: HudIconName;
  size?: number;
  className?: string;
}) {
  const art = HUD_ART[name];
  if (art) {
    return <HudArt className={className} size={size} src={art} />;
  }
  return (
    <SvgMark className={["hud-icon", className].filter(Boolean).join(" ") || undefined} size={size}>
      {MARKS[name]}
    </SvgMark>
  );
}

export function itemGlyphName(item: InventoryItem): HudIconName {
  const hay = `${item.name} ${item.type}`.toLowerCase();
  if (item.type === "DEVIL_FRUIT" || hay.includes("fruit")) return "fruit";
  if (item.type === "WEAPON" || item.weaponDefinitionId) return "blade";
  if (hay.includes("bomb") || hay.includes("smoke")) return "bomb";
  if (hay.includes("phoenix") || hay.includes("tear") || hay.includes("revive")) return "gem";
  if (hay.includes("medicine") || hay.includes("potion") || hay.includes("tincture") || hay.includes("salve"))
    return "potion";
  if (
    hay.includes("meat") ||
    hay.includes("ration") ||
    hay.includes("food") ||
    hay.includes("biscuit") ||
    hay.includes("rice") ||
    hay.includes("fish") ||
    hay.includes("meal") ||
    hay.includes("feast")
  )
    return "meat";
  if (hay.includes("chart") || hay.includes("folio") || hay.includes("book") || hay.includes("map")) return "book";
  if (hay.includes("cutlass") || hay.includes("sword") || hay.includes("blade")) return "blade";
  if (hay.includes("plate") || hay.includes("armor") || hay.includes("breast")) return "armor";
  if (item.type === "MATERIAL") return "gem";
  if (item.type === "CONSUMABLE") return "potion";
  if (item.type === "QUEST" || item.type === "KEY") return "scroll";
  return "pouch";
}

export function newsArtSrc(text: string): string | undefined {
  const hay = text.toLowerCase();
  if (hay.includes("marine")) return FACTION_ART.MARINES;
  if (hay.includes("bounty")) return BOUNTY_ART;
  if (hay.includes("pirate")) return FACTION_ART.PIRATES;
  if (hay.includes("revolutionary")) return FACTION_ART.REVOLUTIONARY_ARMY;
  if (hay.includes("government")) return FACTION_ART.WORLD_GOVERNMENT;
  return undefined;
}

export function newsGlyphName(text: string): HudIconName {
  const hay = text.toLowerCase();
  if (hay.includes("marine")) return "anchor";
  if (hay.includes("pirate") || hay.includes("bounty")) return "skull";
  if (hay.includes("government") || hay.includes("revolutionary")) return "scroll";
  return "news";
}

export function CrestEmblem({ size = 78 }: { size?: number }) {
  return <HudArt className="crest-emblem" size={size} src={CREST_ART} />;
}
