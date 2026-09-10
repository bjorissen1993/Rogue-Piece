import { clamp } from "../utils/stats";

/** Hit chance from character level vs technique power level (before speed/dodge). */
export function techniqueBaseHitChance(
  powerLevel: number,
  characterLevel: number,
  accuracyBias = 0,
): number {
  const delta = characterLevel - powerLevel;
  // Matched level ≈ 55%. Each level above ≈ +9% (caps near 98%).
  // Each level below ≈ −9% (floors near 18% — risky high-power tools).
  return clamp(0.55 + delta * 0.09 + accuracyBias / 100, 0.18, 0.98);
}

/** Percentage points shown in UI (e.g. 92). */
export function techniqueHitChancePercent(
  powerLevel: number,
  characterLevel: number,
  accuracyBias = 0,
): number {
  return Math.round(techniqueBaseHitChance(powerLevel, characterLevel, accuracyBias) * 100);
}

/** Combat power contribution from power level.
 * Deprecated for damage: power level drives accuracy only. Kept for legacy callers. */
export function powerFromLevel(powerLevel: number): number {
  return Math.max(0, Math.round(powerLevel * 2.2));
}

/** Fallback power level when data only has legacy `power`. */
export function powerLevelFromLegacyPower(power: number): number {
  return Math.max(1, Math.round(power / 1.5));
}
