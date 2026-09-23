import type {
  GeneratedWeapon,
  MasteryRank,
  NamingPoolCategory,
  WeaponCategory,
  WeaponNamingBuffs,
  WeaponNamingPath,
  WeaponSoulTrait,
  WeaponType,
} from "../models/types";
import { MASTERY_RANK_ORDER, MASTERY_THRESHOLDS } from "../game/constants";

/** Service gates use existing mastery ranks — not island visits. */
export const WEAPON_SERVICE_GATES = {
  UPGRADE: "TRAINED",
  ADVANCED_UPGRADE: "SKILLED",
  SEASTONE: "EXPERT",
  DEVIL_FRUIT_BIND: "MASTER",
} as const satisfies Record<string, MasteryRank>;

export const WEAPON_UPGRADE_COST = 80;
export const WEAPON_ADVANCED_UPGRADE_COST = 180;
export const WEAPON_SEASTONE_COST = 320;
export const WEAPON_FRUIT_BIND_COST = 0;
export const WEAPON_NAMING_COST = 40;
export const WEAPON_RENAME_COST = 25;

export const NAMING_STAGE_SCALE = { 1: 1, 2: 2, 3: 3 } as const;

export type NamingAdjectiveDef = {
  adjective: string;
  path: WeaponNamingPath;
  /** Stage 3 identity words — stronger, may unlock a trait. */
  identity?: boolean;
};

const SWORD_POOL: NamingAdjectiveDef[] = [
  { adjective: "Swift", path: "AGILITY" },
  { adjective: "Fleeting", path: "AGILITY" },
  { adjective: "Dancing", path: "AGILITY" },
  { adjective: "Razorwind", path: "AGILITY", identity: true },
  { adjective: "Precise", path: "EFFICIENCY" },
  { adjective: "Keen", path: "EFFICIENCY" },
  { adjective: "Measured", path: "EFFICIENCY" },
  { adjective: "Deadedge", path: "EFFICIENCY", identity: true },
  { adjective: "Furious", path: "POWER" },
  { adjective: "Heavy", path: "POWER" },
  { adjective: "Sundering", path: "POWER" },
  { adjective: "Kingslayer", path: "POWER", identity: true },
];

const BLUNT_POOL: NamingAdjectiveDef[] = [
  { adjective: "Quick", path: "AGILITY" },
  { adjective: "Lashing", path: "AGILITY" },
  { adjective: "Whirling", path: "AGILITY" },
  { adjective: "Stormspin", path: "AGILITY", identity: true },
  { adjective: "Steady", path: "EFFICIENCY" },
  { adjective: "True", path: "EFFICIENCY" },
  { adjective: "Balanced", path: "EFFICIENCY" },
  { adjective: "Anviltrue", path: "EFFICIENCY", identity: true },
  { adjective: "Crushing", path: "POWER" },
  { adjective: "Thunderous", path: "POWER" },
  { adjective: "Bonebreak", path: "POWER" },
  { adjective: "Earthbreak", path: "POWER", identity: true },
];

const RANGED_POOL: NamingAdjectiveDef[] = [
  { adjective: "Snappy", path: "AGILITY" },
  { adjective: "Sudden", path: "AGILITY" },
  { adjective: "Windfast", path: "AGILITY" },
  { adjective: "Stormshot", path: "AGILITY", identity: true },
  { adjective: "Marked", path: "EFFICIENCY" },
  { adjective: "True", path: "EFFICIENCY" },
  { adjective: "Deadeye", path: "EFFICIENCY", identity: true },
  { adjective: "Piercing", path: "POWER" },
  { adjective: "Thunder", path: "POWER" },
  { adjective: "Hullbreak", path: "POWER", identity: true },
];

const SHIELD_POOL: NamingAdjectiveDef[] = [
  { adjective: "Nimble", path: "AGILITY" },
  { adjective: "Shifting", path: "AGILITY" },
  { adjective: "Flickering", path: "AGILITY" },
  { adjective: "Warding", path: "EFFICIENCY" },
  { adjective: "Sure", path: "EFFICIENCY" },
  { adjective: "Guarded", path: "EFFICIENCY" },
  { adjective: "Aegis", path: "EFFICIENCY", identity: true },
  { adjective: "Bulwark", path: "POWER" },
  { adjective: "Ironwall", path: "POWER" },
  { adjective: "Bastion", path: "POWER", identity: true },
];

const POLEARM_POOL: NamingAdjectiveDef[] = [
  { adjective: "Swift", path: "AGILITY" },
  { adjective: "Reaching", path: "AGILITY" },
  { adjective: "Serpent", path: "AGILITY", identity: true },
  { adjective: "Precise", path: "EFFICIENCY" },
  { adjective: "Linetrue", path: "EFFICIENCY" },
  { adjective: "Phalanx", path: "EFFICIENCY", identity: true },
  { adjective: "Impaling", path: "POWER" },
  { adjective: "Spearstorm", path: "POWER", identity: true },
];

const UNUSUAL_POOL: NamingAdjectiveDef[] = [
  { adjective: "Flickering", path: "AGILITY" },
  { adjective: "Twisting", path: "AGILITY" },
  { adjective: "Weirdwind", path: "AGILITY", identity: true },
  { adjective: "Sure", path: "EFFICIENCY" },
  { adjective: "Cunning", path: "EFFICIENCY" },
  { adjective: "Hextrue", path: "EFFICIENCY", identity: true },
  { adjective: "Wicked", path: "POWER" },
  { adjective: "Hexfang", path: "POWER", identity: true },
];

export const NAMING_POOLS: Record<NamingPoolCategory, NamingAdjectiveDef[]> = {
  SWORD: SWORD_POOL,
  BLUNT: BLUNT_POOL,
  RANGED: RANGED_POOL,
  SHIELD: SHIELD_POOL,
  POLEARM: POLEARM_POOL,
  UNUSUAL: UNUSUAL_POOL,
};

const SHIELD_ARCHETYPE_IDS = new Set(["buckler", "shield", "tower_shield", "kite_shield"]);

export function namingPoolCategoryFor(input: {
  category?: WeaponCategory | null;
  weaponType?: WeaponType | null;
  archetypeId?: string | null;
}): NamingPoolCategory {
  const archetype = (input.archetypeId ?? "").toLowerCase();
  if (SHIELD_ARCHETYPE_IDS.has(archetype) || /shield|buckler|aegis/.test(archetype)) {
    return "SHIELD";
  }
  if (input.category === "BLADE" || input.weaponType === "SWORD") {
    return "SWORD";
  }
  if (input.category === "BLUNT" || input.weaponType === "CLUB") {
    return "BLUNT";
  }
  if (input.category === "RANGED" || input.weaponType === "GUN") {
    return "RANGED";
  }
  if (input.category === "POLEARM" || input.weaponType === "SPEAR") {
    return "POLEARM";
  }
  return "UNUSUAL";
}

export function namingPoolFor(input: {
  category?: WeaponCategory | null;
  weaponType?: WeaponType | null;
  archetypeId?: string | null;
}): NamingAdjectiveDef[] {
  return NAMING_POOLS[namingPoolCategoryFor(input)];
}

export function masteryRankFromXp(xp: number): MasteryRank {
  let rank: MasteryRank = "BEGINNER";
  for (const entry of MASTERY_RANK_ORDER) {
    if (xp >= (MASTERY_THRESHOLDS[entry] ?? 0)) {
      rank = entry;
    }
  }
  return rank;
}

export function masteryRankMeets(current: MasteryRank, required: MasteryRank): boolean {
  return MASTERY_RANK_ORDER.indexOf(current) >= MASTERY_RANK_ORDER.indexOf(required);
}

export function masteryRankLabel(rank: MasteryRank): string {
  if (rank === "BEGINNER") {
    return "Unfamiliar";
  }
  return rank.charAt(0) + rank.slice(1).toLowerCase();
}

export function namingBuffsFor(
  path: WeaponNamingPath,
  stage: 1 | 2 | 3,
  pool: NamingPoolCategory,
): WeaponNamingBuffs {
  const scale = NAMING_STAGE_SCALE[stage];
  if (path === "AGILITY") {
    return {
      speed: scale,
      initiative: scale,
      weight: pool === "BLUNT" ? -1 : undefined,
    };
  }
  if (path === "EFFICIENCY") {
    return {
      accuracy: pool === "RANGED" ? scale + 1 : scale,
      critBonus: scale,
    };
  }
  if (pool === "BLUNT") {
    return { damage: scale + 1 };
  }
  if (pool === "SHIELD") {
    return { damage: scale, accuracy: 1 };
  }
  return { damage: scale };
}

export function mergeNamingBuffs(base: WeaponNamingBuffs, add: WeaponNamingBuffs): WeaponNamingBuffs {
  const next: WeaponNamingBuffs = { ...base };
  (Object.keys(add) as Array<keyof WeaponNamingBuffs>).forEach((key) => {
    const value = add[key];
    if (value == null) {
      return;
    }
    next[key] = (next[key] ?? 0) + value;
  });
  return next;
}

export function stageTraitFor(adjective: string, path: WeaponNamingPath): string | undefined {
  const identity = Object.values(NAMING_POOLS)
    .flat()
    .find((entry) => entry.adjective === adjective && entry.identity);
  if (!identity) {
    return undefined;
  }
  if (path === "AGILITY") {
    return `${adjective} — techniques come a breath sooner.`;
  }
  if (path === "EFFICIENCY") {
    return `${adjective} — the weapon wastes no motion.`;
  }
  return `${adjective} — blows land with a named weight.`;
}

const SOUL_TRAITS: WeaponSoulTrait[] = ["GUARDIAN", "DUELIST", "PREDATOR", "SENTINEL", "WANDERER"];

export function stubSoulTraitFromHistory(history: string[]): WeaponSoulTrait {
  const blob = history.join(" ").toLowerCase();
  if (/guard|protect|block|shield/.test(blob)) {
    return "GUARDIAN";
  }
  if (/duel|spar|rival/.test(blob)) {
    return "DUELIST";
  }
  if (/boss|finisher|kill|hunt/.test(blob)) {
    return "PREDATOR";
  }
  if (/watch|hold|stand/.test(blob)) {
    return "SENTINEL";
  }
  if (/sail|voyage|wander|travel/.test(blob)) {
    return "WANDERER";
  }
  return SOUL_TRAITS[history.length % SOUL_TRAITS.length] ?? "NONE";
}

export function generatedLooksHistorical(weapon: Pick<GeneratedWeapon, "isNamed" | "namedId">): boolean {
  return Boolean(weapon.isNamed || weapon.namedId);
}
