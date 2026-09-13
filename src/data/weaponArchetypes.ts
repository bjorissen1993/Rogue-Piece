import type {
  StatName,
  WeaponCategory,
  WeaponType,
} from "../models/types";

export type WeaponArchetype = {
  id: string;
  name: string;
  category: WeaponCategory;
  weaponType: WeaponType;
  baseDamage: number;
  baseSpeed: number;
  baseAccuracy: number;
  baseReach: number;
  baseWeight: number;
  scalingStat: StatName;
  techniqueIds: string[];
  tags: string[];
  priceBase: number;
};

/** Expandable catalog of weapon shapes. Combat techniques use weaponType families. */
export const WEAPON_ARCHETYPES: WeaponArchetype[] = [
  // Blades
  { id: "dagger", name: "Dagger", category: "BLADE", weaponType: "SWORD", baseDamage: 5, baseSpeed: 9, baseAccuracy: 8, baseReach: 1, baseWeight: 2, scalingStat: "speed", techniqueIds: ["sword_slash"], tags: ["fast", "concealable"], priceBase: 70 },
  { id: "knife", name: "Knife", category: "BLADE", weaponType: "SWORD", baseDamage: 4, baseSpeed: 9, baseAccuracy: 7, baseReach: 1, baseWeight: 1, scalingStat: "speed", techniqueIds: ["sword_slash"], tags: ["improvised", "fast"], priceBase: 40 },
  { id: "short_sword", name: "Short Sword", category: "BLADE", weaponType: "SWORD", baseDamage: 7, baseSpeed: 7, baseAccuracy: 7, baseReach: 2, baseWeight: 4, scalingStat: "strength", techniqueIds: ["sword_slash", "sword_parry_riposte"], tags: ["balanced"], priceBase: 120 },
  { id: "saber", name: "Saber", category: "BLADE", weaponType: "SWORD", baseDamage: 8, baseSpeed: 7, baseAccuracy: 7, baseReach: 2, baseWeight: 4, scalingStat: "strength", techniqueIds: ["sword_slash", "sword_parry_riposte"], tags: ["naval", "slashing"], priceBase: 150 },
  { id: "cutlass", name: "Cutlass", category: "BLADE", weaponType: "SWORD", baseDamage: 8, baseSpeed: 6, baseAccuracy: 6, baseReach: 2, baseWeight: 5, scalingStat: "strength", techniqueIds: ["sword_slash", "sword_parry_riposte"], tags: ["pirate", "boarding"], priceBase: 140 },
  { id: "longsword", name: "Longsword", category: "BLADE", weaponType: "SWORD", baseDamage: 10, baseSpeed: 5, baseAccuracy: 6, baseReach: 3, baseWeight: 6, scalingStat: "strength", techniqueIds: ["sword_slash", "sword_crescent"], tags: ["heavy_blade"], priceBase: 200 },
  { id: "katana", name: "Katana", category: "BLADE", weaponType: "SWORD", baseDamage: 9, baseSpeed: 8, baseAccuracy: 8, baseReach: 3, baseWeight: 4, scalingStat: "speed", techniqueIds: ["sword_slash", "sword_crescent", "sword_cross_cut"], tags: ["precise", "exotic"], priceBase: 280 },
  { id: "rapier", name: "Rapier", category: "BLADE", weaponType: "SWORD", baseDamage: 6, baseSpeed: 9, baseAccuracy: 10, baseReach: 3, baseWeight: 3, scalingStat: "speed", techniqueIds: ["sword_slash", "sword_parry_riposte"], tags: ["precise", "duelist"], priceBase: 220 },
  { id: "greatsword", name: "Greatsword", category: "BLADE", weaponType: "SWORD", baseDamage: 13, baseSpeed: 3, baseAccuracy: 4, baseReach: 4, baseWeight: 9, scalingStat: "strength", techniqueIds: ["sword_slash", "sword_crescent"], tags: ["heavy", "two_hand"], priceBase: 320 },
  { id: "cleaver", name: "Cleaver", category: "BLADE", weaponType: "SWORD", baseDamage: 9, baseSpeed: 4, baseAccuracy: 5, baseReach: 2, baseWeight: 6, scalingStat: "strength", techniqueIds: ["sword_slash"], tags: ["brutal", "kitchen"], priceBase: 110 },
  { id: "machete", name: "Machete", category: "BLADE", weaponType: "SWORD", baseDamage: 7, baseSpeed: 6, baseAccuracy: 6, baseReach: 2, baseWeight: 4, scalingStat: "strength", techniqueIds: ["sword_slash"], tags: ["jungle", "utility"], priceBase: 90 },

  // Polearms
  { id: "spear", name: "Spear", category: "POLEARM", weaponType: "SPEAR", baseDamage: 7, baseSpeed: 6, baseAccuracy: 7, baseReach: 5, baseWeight: 5, scalingStat: "strength", techniqueIds: ["spear_thrust", "spear_sweep"], tags: ["reach"], priceBase: 100 },
  { id: "long_spear", name: "Long Spear", category: "POLEARM", weaponType: "SPEAR", baseDamage: 8, baseSpeed: 4, baseAccuracy: 6, baseReach: 7, baseWeight: 6, scalingStat: "strength", techniqueIds: ["spear_thrust", "spear_sweep"], tags: ["reach", "formation"], priceBase: 150 },
  { id: "trident", name: "Trident", category: "POLEARM", weaponType: "SPEAR", baseDamage: 8, baseSpeed: 5, baseAccuracy: 6, baseReach: 5, baseWeight: 6, scalingStat: "strength", techniqueIds: ["spear_thrust", "spear_impale"], tags: ["reach", "naval"], priceBase: 180 },
  { id: "halberd", name: "Halberd", category: "POLEARM", weaponType: "SPEAR", baseDamage: 11, baseSpeed: 3, baseAccuracy: 5, baseReach: 6, baseWeight: 8, scalingStat: "strength", techniqueIds: ["spear_thrust", "spear_sweep"], tags: ["heavy", "reach"], priceBase: 240 },
  { id: "glaive", name: "Glaive", category: "POLEARM", weaponType: "SPEAR", baseDamage: 10, baseSpeed: 5, baseAccuracy: 6, baseReach: 5, baseWeight: 7, scalingStat: "strength", techniqueIds: ["spear_thrust", "spear_sweep"], tags: ["slashing", "reach"], priceBase: 210 },
  { id: "naginata", name: "Naginata", category: "POLEARM", weaponType: "SPEAR", baseDamage: 9, baseSpeed: 6, baseAccuracy: 7, baseReach: 5, baseWeight: 5, scalingStat: "speed", techniqueIds: ["spear_thrust", "spear_sweep"], tags: ["exotic", "reach"], priceBase: 260 },
  { id: "staff", name: "Staff", category: "POLEARM", weaponType: "CLUB", baseDamage: 5, baseSpeed: 7, baseAccuracy: 8, baseReach: 4, baseWeight: 3, scalingStat: "speed", techniqueIds: ["club_swing"], tags: ["training", "nonlethal"], priceBase: 60 },
  { id: "bo_staff", name: "Bo Staff", category: "POLEARM", weaponType: "CLUB", baseDamage: 6, baseSpeed: 8, baseAccuracy: 8, baseReach: 4, baseWeight: 3, scalingStat: "speed", techniqueIds: ["club_swing", "club_bash"], tags: ["martial", "training"], priceBase: 90 },

  // Blunt
  { id: "club", name: "Club", category: "BLUNT", weaponType: "CLUB", baseDamage: 6, baseSpeed: 5, baseAccuracy: 5, baseReach: 2, baseWeight: 5, scalingStat: "strength", techniqueIds: ["club_swing", "club_bash"], tags: ["crude"], priceBase: 45 },
  { id: "mace", name: "Mace", category: "BLUNT", weaponType: "CLUB", baseDamage: 9, baseSpeed: 4, baseAccuracy: 5, baseReach: 2, baseWeight: 7, scalingStat: "strength", techniqueIds: ["club_swing", "club_bash"], tags: ["armor_break"], priceBase: 160 },
  { id: "hammer", name: "Hammer", category: "BLUNT", weaponType: "CLUB", baseDamage: 8, baseSpeed: 4, baseAccuracy: 5, baseReach: 2, baseWeight: 7, scalingStat: "strength", techniqueIds: ["club_bash"], tags: ["impact"], priceBase: 130 },
  { id: "warhammer", name: "Warhammer", category: "BLUNT", weaponType: "CLUB", baseDamage: 12, baseSpeed: 2, baseAccuracy: 4, baseReach: 3, baseWeight: 10, scalingStat: "strength", techniqueIds: ["club_swing", "club_bash"], tags: ["heavy", "impact"], priceBase: 280 },
  { id: "baton", name: "Baton", category: "BLUNT", weaponType: "CLUB", baseDamage: 5, baseSpeed: 8, baseAccuracy: 8, baseReach: 2, baseWeight: 3, scalingStat: "speed", techniqueIds: ["club_swing"], tags: ["military", "nonlethal"], priceBase: 80 },
  { id: "iron_pipe", name: "Iron Pipe", category: "BLUNT", weaponType: "CLUB", baseDamage: 7, baseSpeed: 5, baseAccuracy: 4, baseReach: 3, baseWeight: 6, scalingStat: "strength", techniqueIds: ["club_swing", "club_bash"], tags: ["improvised", "dockside"], priceBase: 35 },
  { id: "kanabo", name: "Kanabo", category: "BLUNT", weaponType: "CLUB", baseDamage: 14, baseSpeed: 2, baseAccuracy: 3, baseReach: 3, baseWeight: 11, scalingStat: "strength", techniqueIds: ["club_swing", "club_bash"], tags: ["heavy", "brutal", "exotic"], priceBase: 340 },

  // Ranged
  { id: "pistol", name: "Pistol", category: "RANGED", weaponType: "GUN", baseDamage: 9, baseSpeed: 5, baseAccuracy: 6, baseReach: 8, baseWeight: 3, scalingStat: "speed", techniqueIds: ["gun_shot"], tags: ["ranged", "sidearm"], priceBase: 180 },
  { id: "flintlock", name: "Flintlock", category: "RANGED", weaponType: "GUN", baseDamage: 10, baseSpeed: 3, baseAccuracy: 5, baseReach: 8, baseWeight: 4, scalingStat: "intelligence", techniqueIds: ["gun_shot"], tags: ["ranged", "single_shot"], priceBase: 200 },
  { id: "rifle", name: "Rifle", category: "RANGED", weaponType: "GUN", baseDamage: 12, baseSpeed: 2, baseAccuracy: 8, baseReach: 12, baseWeight: 7, scalingStat: "intelligence", techniqueIds: ["gun_shot"], tags: ["ranged", "precision"], priceBase: 320 },
  { id: "musket", name: "Musket", category: "RANGED", weaponType: "GUN", baseDamage: 13, baseSpeed: 1, baseAccuracy: 4, baseReach: 10, baseWeight: 8, scalingStat: "strength", techniqueIds: ["gun_shot"], tags: ["ranged", "military"], priceBase: 260 },
  { id: "scattergun", name: "Scattergun", category: "RANGED", weaponType: "GUN", baseDamage: 11, baseSpeed: 2, baseAccuracy: 5, baseReach: 5, baseWeight: 7, scalingStat: "strength", techniqueIds: ["gun_shot"], tags: ["ranged", "close"], priceBase: 290 },
  { id: "slingshot", name: "Slingshot", category: "RANGED", weaponType: "GUN", baseDamage: 4, baseSpeed: 8, baseAccuracy: 6, baseReach: 6, baseWeight: 1, scalingStat: "speed", techniqueIds: ["gun_shot"], tags: ["ranged", "improvised", "cheap"], priceBase: 25 },
  { id: "bow", name: "Bow", category: "RANGED", weaponType: "GUN", baseDamage: 8, baseSpeed: 5, baseAccuracy: 7, baseReach: 10, baseWeight: 3, scalingStat: "speed", techniqueIds: ["gun_shot"], tags: ["ranged", "quiet"], priceBase: 140 },
  { id: "crossbow", name: "Crossbow", category: "RANGED", weaponType: "GUN", baseDamage: 10, baseSpeed: 3, baseAccuracy: 8, baseReach: 9, baseWeight: 5, scalingStat: "intelligence", techniqueIds: ["gun_shot"], tags: ["ranged", "armor_pierce"], priceBase: 210 },

  // Unusual
  { id: "chain_whip", name: "Chain Whip", category: "UNUSUAL", weaponType: "SWORD", baseDamage: 7, baseSpeed: 6, baseAccuracy: 5, baseReach: 5, baseWeight: 4, scalingStat: "speed", techniqueIds: ["sword_slash"], tags: ["exotic", "flexible"], priceBase: 170 },
  { id: "whip", name: "Whip", category: "UNUSUAL", weaponType: "SWORD", baseDamage: 5, baseSpeed: 8, baseAccuracy: 6, baseReach: 5, baseWeight: 2, scalingStat: "speed", techniqueIds: ["sword_slash"], tags: ["flexible", "control"], priceBase: 100 },
  { id: "gauntlets", name: "Gauntlets", category: "UNUSUAL", weaponType: "FISTS", baseDamage: 6, baseSpeed: 8, baseAccuracy: 7, baseReach: 1, baseWeight: 4, scalingStat: "strength", techniqueIds: ["fist_jab", "fist_combo"], tags: ["brawling", "martial"], priceBase: 110 },
  { id: "knuckles", name: "Knuckle Dusters", category: "UNUSUAL", weaponType: "FISTS", baseDamage: 5, baseSpeed: 9, baseAccuracy: 8, baseReach: 1, baseWeight: 2, scalingStat: "speed", techniqueIds: ["fist_jab", "fist_combo"], tags: ["brawling", "concealable"], priceBase: 70 },
  { id: "tonfa", name: "Tonfa", category: "UNUSUAL", weaponType: "CLUB", baseDamage: 6, baseSpeed: 8, baseAccuracy: 8, baseReach: 2, baseWeight: 3, scalingStat: "speed", techniqueIds: ["club_swing", "club_bash"], tags: ["martial", "defensive"], priceBase: 120 },
  { id: "scythe", name: "Scythe", category: "UNUSUAL", weaponType: "SPEAR", baseDamage: 10, baseSpeed: 4, baseAccuracy: 5, baseReach: 4, baseWeight: 7, scalingStat: "strength", techniqueIds: ["spear_sweep", "spear_thrust"], tags: ["exotic", "reaping"], priceBase: 230 },
  { id: "hook_blades", name: "Hooked Blades", category: "UNUSUAL", weaponType: "SWORD", baseDamage: 7, baseSpeed: 7, baseAccuracy: 6, baseReach: 2, baseWeight: 4, scalingStat: "speed", techniqueIds: ["sword_slash", "sword_parry_riposte"], tags: ["exotic", "grapple"], priceBase: 190 },
  { id: "axe", name: "Axe", category: "UNUSUAL", weaponType: "CLUB", baseDamage: 10, baseSpeed: 4, baseAccuracy: 5, baseReach: 2, baseWeight: 7, scalingStat: "strength", techniqueIds: ["club_swing", "club_bash"], tags: ["brutal", "boarding"], priceBase: 150 },
  { id: "dual_blades", name: "Dual Blades", category: "UNUSUAL", weaponType: "SWORD", baseDamage: 8, baseSpeed: 8, baseAccuracy: 6, baseReach: 2, baseWeight: 5, scalingStat: "speed", techniqueIds: ["sword_slash", "sword_cross_cut"], tags: ["dual", "flashy"], priceBase: 250 },
  { id: "boarding_hook", name: "Boarding Hook", category: "UNUSUAL", weaponType: "SPEAR", baseDamage: 6, baseSpeed: 5, baseAccuracy: 5, baseReach: 4, baseWeight: 5, scalingStat: "strength", techniqueIds: ["spear_thrust"], tags: ["improvised", "pirate"], priceBase: 55 },
];

export const NAMED_WEAPON_TEMPLATES: Array<{
  id: string;
  name: string;
  archetypeId: string;
  special: string;
  rarity: "RARE" | "LEGENDARY";
  damageBonus: number;
  speedBonus: number;
  accuracyBonus: number;
  priceBonus: number;
  traits: string[];
}> = [
  {
    id: "tidebreaker",
    name: "Tidebreaker",
    archetypeId: "saber",
    special: "Old naval saber — unusually strong at breaking guards.",
    rarity: "RARE",
    damageBonus: 3,
    speedBonus: 1,
    accuracyBonus: 1,
    priceBonus: 220,
    traits: ["named", "guard_break", "naval"],
  },
  {
    id: "red_gull",
    name: "Red Gull",
    archetypeId: "pistol",
    special: "Lightweight pistol favored by local bounty hunters.",
    rarity: "RARE",
    damageBonus: 2,
    speedBonus: 2,
    accuracyBonus: 2,
    priceBonus: 260,
    traits: ["named", "hunter", "precise"],
  },
  {
    id: "salt_widow",
    name: "Salt Widow",
    archetypeId: "cutlass",
    special: "Stolen pirate blade with a notched edge and a dark story.",
    rarity: "RARE",
    damageBonus: 2,
    speedBonus: 0,
    accuracyBonus: 0,
    priceBonus: 180,
    traits: ["named", "stolen", "pirate"],
  },
  {
    id: "harbor_pin",
    name: "Harbor Pin",
    archetypeId: "rapier",
    special: "A duelist's needle from a wealthy trading city.",
    rarity: "RARE",
    damageBonus: 1,
    speedBonus: 2,
    accuracyBonus: 3,
    priceBonus: 300,
    traits: ["named", "duelist", "luxury"],
  },
  {
    id: "iron_sermon",
    name: "Iron Sermon",
    archetypeId: "mace",
    special: "Marine justice, delivered bluntly.",
    rarity: "RARE",
    damageBonus: 3,
    speedBonus: -1,
    accuracyBonus: 1,
    priceBonus: 240,
    traits: ["named", "military", "impact"],
  },
];

export function getArchetype(id: string): WeaponArchetype | undefined {
  return WEAPON_ARCHETYPES.find((entry) => entry.id === id);
}

export function archetypesByCategory(category: WeaponCategory): WeaponArchetype[] {
  return WEAPON_ARCHETYPES.filter((entry) => entry.category === category);
}

export function archetypesByWeaponType(weaponType: WeaponType): WeaponArchetype[] {
  return WEAPON_ARCHETYPES.filter((entry) => entry.weaponType === weaponType);
}
