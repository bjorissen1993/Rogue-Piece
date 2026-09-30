import { resolveWeaponGrip } from "../game/weaponClasses";
import type { GeneratedWeapon, WeaponCategory, WeaponRarity } from "../models/types";

export type WeaponShopTab = "all" | WeaponCategory;

export const WEAPON_SHOP_CATEGORY_ICONS: Record<WeaponCategory, string> = {
  BLADE: "/icons/Items/Weapons/Sword/Cutlass1.png",
  POLEARM: "/icons/Items/Weapons/Polearm/Spear1_2H.png",
  BLUNT: "/icons/Items/Weapons/Blunt/Club.png",
  RANGED: "/icons/Items/Weapons/Ranged/Pistol.png",
  UNUSUAL: "/icons/Items/Weapons/Flexible/Whip.png",
};

export const WEAPON_SHOP_TABS: Array<{ id: WeaponShopTab; label: string; iconSrc?: string }> = [
  { id: "all", label: "All" },
  { id: "BLADE", label: "Blades", iconSrc: WEAPON_SHOP_CATEGORY_ICONS.BLADE },
  { id: "POLEARM", label: "Polearms", iconSrc: WEAPON_SHOP_CATEGORY_ICONS.POLEARM },
  { id: "BLUNT", label: "Blunt", iconSrc: WEAPON_SHOP_CATEGORY_ICONS.BLUNT },
  { id: "RANGED", label: "Ranged", iconSrc: WEAPON_SHOP_CATEGORY_ICONS.RANGED },
  { id: "UNUSUAL", label: "Unusual", iconSrc: WEAPON_SHOP_CATEGORY_ICONS.UNUSUAL },
];

export function weaponCategoryTitle(category: WeaponCategory): string {
  if (category === "BLADE") {
    return "Blade";
  }
  if (category === "POLEARM") {
    return "Polearm";
  }
  if (category === "BLUNT") {
    return "Blunt";
  }
  if (category === "RANGED") {
    return "Ranged";
  }
  return "Unusual";
}

export function matchesWeaponTab(category: WeaponCategory, tab: WeaponShopTab): boolean {
  return tab === "all" || category === tab;
}

export function weaponShopRarityGlow(
  rarity?: WeaponRarity | string | null,
  material?: string | null,
): string {
  if (material === "SEA_STONE_ALLOY") {
    return "shop-item-rarity shop-item-rarity--sea-king";
  }
  const key = (rarity ?? "").toString().toLowerCase();
  if (key === "common" || key === "uncommon" || key === "rare" || key === "legendary") {
    return `shop-item-rarity shop-item-rarity--${key}`;
  }
  return "";
}

type WeaponIconInput = {
  archetypeId?: string;
  category: WeaponCategory;
  traits?: string[];
  grip?: "ONE_HAND" | "TWO_HAND";
};

export function weaponIconSrc(weapon: WeaponIconInput): string {
  const id = (weapon.archetypeId ?? "").toLowerCase();
  const grip = resolveWeaponGrip({
    grip: weapon.grip,
    traits: weapon.traits,
    archetypeId: weapon.archetypeId,
  });
  const twoHand = grip === "TWO_HAND";

  if (/axe/.test(id)) {
    return twoHand
      ? "/icons/Items/Weapons/Axe/GreatAxe1_2H.png"
      : "/icons/Items/Weapons/Axe/HandAxe.png";
  }
  if (/whip|chain/.test(id)) {
    return "/icons/Items/Weapons/Flexible/Whip.png";
  }
  if (/gauntlet|knuckle|fist/.test(id)) {
    return "/icons/Items/Weapons/Blunt/BrassKnuckles.png";
  }
  if (/staff/.test(id)) {
    return "/icons/Items/Weapons/Polearm/BoStaff_2H.png";
  }
  if (/pistol|flintlock|slingshot/.test(id)) {
    return "/icons/Items/Weapons/Ranged/Flintlock.png";
  }
  if (/rifle|musket|scatter|bow|crossbow/.test(id)) {
    return twoHand || /rifle|musket|scatter|bow|crossbow/.test(id)
      ? "/icons/Items/Weapons/Ranged/Rifle_2H.png"
      : "/icons/Items/Weapons/Ranged/Pistol.png";
  }
  if (/spear|trident|halberd|glaive|naginata|hook/.test(id)) {
    return /trident/.test(id)
      ? "/icons/Items/Weapons/Polearm/Trident_2H.png"
      : "/icons/Items/Weapons/Polearm/Spear1_2H.png";
  }
  if (/scythe/.test(id)) {
    return "/icons/Items/Weapons/Special/Scythe1_2H.png";
  }
  if (weapon.category === "BLADE") {
    return twoHand
      ? "/icons/Items/Weapons/Sword/LongSword1_2H.png"
      : "/icons/Items/Weapons/Sword/Cutlass1.png";
  }
  if (weapon.category === "POLEARM") {
    return twoHand
      ? "/icons/Items/Weapons/Polearm/BoStaff_2H.png"
      : "/icons/Items/Weapons/Polearm/Spear1_2H.png";
  }
  if (weapon.category === "BLUNT") {
    return twoHand
      ? "/icons/Items/Weapons/Blunt/Club_2H.png"
      : "/icons/Items/Weapons/Blunt/Club.png";
  }
  if (weapon.category === "RANGED") {
    return twoHand
      ? "/icons/Items/Weapons/Ranged/Rifle_2H.png"
      : "/icons/Items/Weapons/Ranged/Pistol.png";
  }
  return "/icons/Items/Weapons/Flexible/Whip.png";
}

export function weaponShopDescription(weapon: GeneratedWeapon): string {
  if (weapon.special?.trim()) {
    return weapon.special.trim();
  }
  const traits = weapon.traits.filter(Boolean).slice(0, 3).join(", ");
  if (traits) {
    return `${weaponCategoryTitle(weapon.category)} work — ${traits}.`;
  }
  return `${weaponCategoryTitle(weapon.category)} from the rack.`;
}

export function weaponShopMeta(weapon: GeneratedWeapon): string {
  const rarity = weapon.rarity.charAt(0) + weapon.rarity.slice(1).toLowerCase();
  return `${rarity} · ${weaponCategoryTitle(weapon.category)}`;
}
