/** Naming Evolution visual stages — not rarity, not path badges. */

export const NAMING_STAGE_ROMAN = ["", "I", "II", "III"] as const;

export const NAMING_STAGE_TITLES = [
  "Unformed Identity",
  "Emerging Identity",
  "Established Identity",
  "Completed Identity",
] as const;

export function namingStageRoman(stage: number): string {
  return NAMING_STAGE_ROMAN[Math.max(0, Math.min(3, stage))] ?? "";
}

export function namingStageTitle(stage: number): string {
  return NAMING_STAGE_TITLES[Math.max(0, Math.min(3, stage))] ?? NAMING_STAGE_TITLES[0];
}

export function namingStageBlurb(stage: number): string {
  if (stage <= 0) {
    return "This weapon has not yet developed a Naming Evolution.";
  }
  if (stage >= 3) {
    return "Naming Identity is complete. Mastery, upgrades, Soul, Fruit, Seastone, and Legacy can still grow.";
  }
  return "The weapon's name tracks the chosen direction. This badge only shows how far Naming has gone.";
}
