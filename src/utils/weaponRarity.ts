import type { WeaponMaterial, WeaponRarity } from "../models/types";

/** CSS class bundle for rarity-tinted weapon labels (optional sea-stone black corona). */
export function weaponRarityClass(
  rarity?: WeaponRarity | string | null,
  material?: WeaponMaterial | string | null,
): string {
  const parts = ["weapon-rarity"];
  const key = (rarity ?? "COMMON").toString().toLowerCase();
  if (key === "common" || key === "uncommon" || key === "rare" || key === "legendary") {
    parts.push(`weapon-rarity--${key}`);
  } else {
    parts.push("weapon-rarity--common");
  }
  if (material === "SEA_STONE_ALLOY") {
    parts.push("weapon-rarity--sea-stone");
  }
  return parts.join(" ");
}

export function isSeaStoneMaterial(material?: WeaponMaterial | string | null): boolean {
  return material === "SEA_STONE_ALLOY";
}
