import { resolveWeaponGrip } from "../game/weaponClasses";
import type { GeneratedWeapon, WeaponCategory, WeaponRarity } from "../models/types";

export type WeaponShopTab = "all" | WeaponCategory;

export const WEAPON_SHOP_CATEGORY_ICONS: Record<WeaponCategory, string> = {
  BLADE: "/icons/Weapons/Weapon_Sword.png",
  POLEARM: "/icons/Weapons/Weapon_Spear.png",
  BLUNT: "/icons/Weapons/Weapon_Blunt.png",
  RANGED: "/icons/Weapons/Weapon_Pistol.png",
  UNUSUAL: "/icons/Weapons/Weapon_Flexible.png",
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
    return twoHand ? "/icons/Weapons/Weapon_Axe_2Handed.png" : "/icons/Weapons/Weapon_Axe.png";
  }
  if (/whip|chain/.test(id)) {
    return "/icons/Weapons/Weapon_Flexible.png";
  }
  if (/gauntlet|knuckle|fist/.test(id)) {
    return "/icons/Weapons/Weapon_Unarmed.png";
  }
  if (/staff/.test(id)) {
    return "/icons/Weapons/Weapon_Staff_2H.png";
  }
  if (/pistol|flintlock|slingshot/.test(id)) {
    return "/icons/Weapons/Weapon_Pistol.png";
  }
  if (/rifle|musket|scatter|bow|crossbow/.test(id)) {
    return twoHand || /rifle|musket|scatter|bow|crossbow/.test(id)
      ? "/icons/Weapons/Weapon_Heavy_Ranged.png"
      : "/icons/Weapons/Weapon_Pistol.png";
  }
  if (/spear|trident|halberd|glaive|naginata|hook/.test(id)) {
    return "/icons/Weapons/Weapon_Spear.png";
  }
  if (/scythe/.test(id)) {
    return "/icons/Weapons/Weapon_Axe_2Handed.png";
  }
  if (weapon.category === "BLADE") {
    return twoHand ? "/icons/Weapons/Weapon_Sword_2Handed.png" : "/icons/Weapons/Weapon_Sword.png";
  }
  if (weapon.category === "POLEARM") {
    return twoHand ? "/icons/Weapons/Weapon_Staff_2H.png" : "/icons/Weapons/Weapon_Spear.png";
  }
  if (weapon.category === "BLUNT") {
    return twoHand ? "/icons/Weapons/Weapon_Blunt_2Handed.png" : "/icons/Weapons/Weapon_Blunt.png";
  }
  if (weapon.category === "RANGED") {
    return twoHand ? "/icons/Weapons/Weapon_Heavy_Ranged.png" : "/icons/Weapons/Weapon_Pistol.png";
  }
  return "/icons/Weapons/Weapon_Flexible.png";
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
