import type { GeneratedWeapon, Weapon, WeaponType } from "../models/types";

/** One-handed vs two-handed grip for dual-wield rules. */
export type WeaponGrip = "ONE_HAND" | "TWO_HAND";

const MELEE_TYPES: WeaponType[] = ["SWORD", "SPEAR", "CLUB", "FISTS", "KICKS"];

/** Tags that force a two-hand grip even when the type is usually one-handed. */
const TWO_HAND_TAGS = new Set([
  "two_hand",
  "heavy",
  "precision", // rifle-style
  "military", // musket
]);

const TWO_HAND_ARCHETYPE_IDS = new Set([
  "greatsword",
  "long_spear",
  "halberd",
  "warhammer",
  "kanabo",
  "rifle",
  "musket",
  "scattergun",
  "bow",
  "crossbow",
  "scythe",
  "dual_blades", // paired set occupies both hands as one item
]);

export function isMeleeWeaponType(type: WeaponType): boolean {
  return MELEE_TYPES.includes(type);
}

export function gripFromTags(tags: string[] | undefined, archetypeId?: string): WeaponGrip {
  if (archetypeId && TWO_HAND_ARCHETYPE_IDS.has(archetypeId)) {
    return "TWO_HAND";
  }
  if ((tags ?? []).some((tag) => TWO_HAND_TAGS.has(tag))) {
    return "TWO_HAND";
  }
  return "ONE_HAND";
}

export function resolveWeaponGrip(weapon: {
  grip?: WeaponGrip;
  traits?: string[];
  tags?: string[];
  archetypeId?: string;
}): WeaponGrip {
  if (weapon.grip) {
    return weapon.grip;
  }
  return gripFromTags(weapon.traits ?? weapon.tags, weapon.archetypeId);
}

/** Weapon types currently usable for technique gating (primary + secondary). */
export function equippedWeaponTypes(
  weapons: Array<{ weaponType: WeaponType } | undefined | null>,
): WeaponType[] {
  const types = new Set<WeaponType>();
  for (const weapon of weapons) {
    if (weapon?.weaponType) {
      types.add(weapon.weaponType);
    }
  }
  return [...types];
}

/**
 * A technique with `weaponType` / `requiredWeaponTypes` is usable only if that class is equipped.
 * Techniques without either are universal (styles / race).
 */
export function techniqueMatchesEquipped(
  tech: { weaponType?: WeaponType; requiredWeaponTypes?: WeaponType[] },
  equippedTypes: WeaponType[],
): boolean {
  if (tech.requiredWeaponTypes?.length) {
    return tech.requiredWeaponTypes.some((type) => equippedTypes.includes(type));
  }
  if (tech.weaponType) {
    return equippedTypes.includes(tech.weaponType);
  }
  return true;
}

/** Focused Strike / basic melee — needs any melee grip, not a lone firearm. */
export const BASIC_MELEE_WEAPON_TYPES: WeaponType[] = [...MELEE_TYPES];

/**
 * Dual-wield rules:
 * - Two-hand primary fills both hands (no secondary).
 * - Secondary must be one-hand.
 * - Primary must be one-hand to accept a secondary.
 */
export function canEquipAsSecondary(
  primary: { grip?: WeaponGrip; traits?: string[]; archetypeId?: string } | null | undefined,
  secondary: { grip?: WeaponGrip; traits?: string[]; archetypeId?: string },
): { ok: boolean; reason: string } {
  if (primary) {
    const primaryGrip = resolveWeaponGrip(primary);
    if (primaryGrip === "TWO_HAND") {
      return { ok: false, reason: "Your primary weapon needs both hands." };
    }
  }
  const secondaryGrip = resolveWeaponGrip(secondary);
  if (secondaryGrip === "TWO_HAND") {
    return { ok: false, reason: "That weapon needs both hands — equip it as primary instead." };
  }
  return { ok: true, reason: "" };
}

export function catalogGripForWeapon(weapon: Weapon): WeaponGrip {
  return gripFromTags(weapon.traits, weapon.id);
}

export function generatedGrip(weapon: GeneratedWeapon): WeaponGrip {
  return resolveWeaponGrip({
    grip: weapon.grip,
    traits: weapon.traits,
    archetypeId: weapon.archetypeId,
  });
}
