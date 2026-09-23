import type { SeastoneMod, WeaponType } from "../models/types";
import { WEAPON_SERVICE_GATES } from "./weaponProgression";

export type SeastoneOptionDef = {
  id: SeastoneMod;
  label: string;
  description: string;
  functional: boolean;
  /** Hint for projectile weapons; still offered on others as compatibility warning. */
  rangedPreferred?: boolean;
};

export const SEASTONE_OPTIONS: SeastoneOptionDef[] = [
  {
    id: "TIP",
    label: "Seastone Tip",
    description: "A seastone point. Functional — Devil Fruit users feel the bite.",
    functional: true,
  },
  {
    id: "EDGE",
    label: "Seastone Edge",
    description: "The striking edge is lined with seastone. Functional.",
    functional: true,
  },
  {
    id: "REINFORCEMENT",
    label: "Seastone Reinforcement",
    description: "Core ribs of seastone stiffen the frame. Functional.",
    functional: true,
  },
  {
    id: "PROJECTILE",
    label: "Projectile Compatibility",
    description: "Shot or thrown heads can take a seastone load. Functional.",
    functional: true,
    rangedPreferred: true,
  },
  {
    id: "FULL_CONVERSION",
    label: "Full Conversion",
    description: "The weapon is remade as seastone alloy. Functional. Permanent.",
    functional: true,
  },
];

export function seastoneOption(id: SeastoneMod): SeastoneOptionDef | undefined {
  return SEASTONE_OPTIONS.find((entry) => entry.id === id);
}

export function seastoneCompatibleWithType(mod: SeastoneMod, weaponType: WeaponType): { ok: boolean; warning?: string } {
  const option = seastoneOption(mod);
  if (!option) {
    return { ok: false, warning: "Unknown seastone work." };
  }
  if (option.rangedPreferred && weaponType !== "GUN") {
    return {
      ok: true,
      warning: "Projectile seastone is meant for ranged weapons. The smith can still force a fit.",
    };
  }
  return { ok: true };
}

export { WEAPON_SERVICE_GATES };

export const FRUITBOUND_REMNANT_ITEM_ID = "fruitbound_remnant";
export const ORDINARY_FRUIT_ITEM_IDS = ["island_apple", "island_mango", "wild_banana"] as const;
