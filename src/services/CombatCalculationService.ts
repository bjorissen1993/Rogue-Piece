import type { CombatSide, CombatantState, PlayerStats, StatName } from "../models/types";
import { clamp } from "../utils/stats";
import type { RandomService } from "./RandomService";

export interface HitChanceBreakdown {
  baseAccuracy: number;
  speedBonus: number;
  accuracyBonus: number;
  techniqueMod: number;
  dodgeChance: number;
  combined: number;
  parts: string[];
}

export interface DamageBreakdown {
  baseCore: number;
  powerBonus: number;
  variance: number;
  defenseReduction: number;
  defendMultiplier: number;
  weakPointBonus: number;
  softCapApplied: boolean;
  softCapValue?: number;
  crit: boolean;
  critMultiplier?: number;
  finalDamage: number;
  minDamage: number;
  maxDamage: number;
  parts: string[];
}

export interface CombatCalcInput {
  attacker: CombatantState;
  defender: CombatantState;
  powerBonus?: number;
  accuracyMod?: number;
  isHeavy?: boolean;
}

export interface CombatCalcPreview extends CombatCalcInput {
  rng?: RandomService;
}

export interface CombatCalcResult {
  hit: boolean;
  dodged: boolean;
  crit: boolean;
  damage: number;
  hitBreakdown: HitChanceBreakdown;
  damageBreakdown: DamageBreakdown;
}

const BASE_ACCURACY = 0.78;
const BASE_DAMAGE = 8;
const STR_MULTIPLIER = 3;
const DEF_MULTIPLIER = 1.4;
const CRIT_BASE = 0.06;
const CRIT_MULT = 1.45;

function softenEarlyEnemyDamage(
  damage: number,
  enemyStrength: number,
  defenderMaxHp: number,
  isHeavy: boolean,
): number {
  if (enemyStrength > 10) {
    return damage;
  }
  const normalPct =
    enemyStrength <= 4 ? 0.06 : enemyStrength <= 6 ? 0.085 : enemyStrength <= 8 ? 0.11 : 0.125;
  const targetPct = isHeavy ? normalPct * 1.55 : normalPct;
  const softCap = Math.max(3, Math.round(defenderMaxHp * targetPct) + (isHeavy ? 2 : 0));
  return Math.min(damage, softCap);
}

export function computeHitChance(
  attacker: CombatantState,
  defender: CombatantState,
  accuracyMod = 0,
): HitChanceBreakdown {
  const speedBonus = attacker.stats.speed * 0.015;
  const accuracyBonus = attacker.accuracyBonus / 100;
  const techniqueMod = accuracyMod / 100;
  const accuracy = clamp(
    BASE_ACCURACY + speedBonus + accuracyBonus + techniqueMod,
    0.45,
    0.98,
  );
  const dodgeChance = clamp(
    0.04 + defender.stats.speed * 0.012 + defender.dodgeBonus / 100 - attacker.stats.speed * 0.006,
    0.02,
    0.35,
  );
  const combined = accuracy * (1 - dodgeChance);
  const parts = [
    `Base accuracy ${(BASE_ACCURACY * 100).toFixed(0)}%`,
    `Speed +${(speedBonus * 100).toFixed(1)}%`,
    attacker.accuracyBonus ? `Observe/bonus +${attacker.accuracyBonus}%` : null,
    accuracyMod ? `Technique mod ${accuracyMod >= 0 ? "+" : ""}${accuracyMod}%` : null,
    `Enemy dodge ~${(dodgeChance * 100).toFixed(0)}%`,
    `Net hit ~${(combined * 100).toFixed(0)}%`,
  ].filter(Boolean) as string[];
  return {
    baseAccuracy: BASE_ACCURACY,
    speedBonus,
    accuracyBonus: attacker.accuracyBonus,
    techniqueMod: accuracyMod,
    dodgeChance,
    combined,
    parts,
  };
}

export function computeDamageRange(input: CombatCalcInput): DamageBreakdown {
  const { attacker, defender, powerBonus = 0, isHeavy = false } = input;
  const rollMin = -2;
  const rollMax = 4;
  const baseCore = BASE_DAMAGE + attacker.stats.strength * STR_MULTIPLIER + powerBonus;
  const critChance = clamp(CRIT_BASE + attacker.stats.speed * 0.008, 0.02, 0.35);
  const reduction = defender.stats.defense * DEF_MULTIPLIER;
  const weak =
    defender.weakPointDiscovered && attacker.side === "PLAYER" ? 4 : 0;
  const defendMul = defender.defending ? 0.5 : 1;

  const rawMin = baseCore + rollMin;
  const rawMax = baseCore + rollMax;
  let afterMin = Math.max(1, Math.round((rawMin - reduction) * defendMul)) + weak;
  let afterMax = Math.max(1, Math.round((rawMax - reduction) * defendMul)) + weak;
  let critMin =
    Math.max(1, Math.round(Math.round(rawMin * CRIT_MULT) - reduction) * (defender.defending ? 0.5 : 1)) +
    weak;
  let critMax =
    Math.max(1, Math.round(Math.round(rawMax * CRIT_MULT) - reduction) * (defender.defending ? 0.5 : 1)) +
    weak;

  let softCapApplied = false;
  let softCapValue: number | undefined;
  if (attacker.side === "ENEMY" && attacker.stats.strength <= 10) {
    const str = attacker.stats.strength;
    const normalPct = str <= 4 ? 0.06 : str <= 6 ? 0.085 : str <= 8 ? 0.11 : 0.125;
    const heavy = isHeavy || powerBonus > 0;
    softCapValue = Math.max(
      3,
      Math.round(defender.maxHp * (heavy ? normalPct * 1.55 : normalPct)) + (heavy ? 2 : 0),
    );
    afterMin = Math.min(afterMin, softCapValue);
    afterMax = Math.min(afterMax, softCapValue);
    critMin = Math.min(critMin, softCapValue);
    critMax = Math.min(critMax, softCapValue);
    softCapApplied = true;
  }

  const parts = [
    `Base ${BASE_DAMAGE} + Str×${STR_MULTIPLIER} (${attacker.stats.strength * STR_MULTIPLIER}) + power ${powerBonus}`,
    `Variance ${rollMin}…${rollMax}`,
    `Enemy defense −${reduction.toFixed(1)}`,
    defender.defending ? "Enemy bracing ×0.5" : null,
    weak ? "Weak point +4" : null,
    softCapApplied ? `Early foe soft cap ${softCapValue}` : null,
    `Crit chance ${(critChance * 100).toFixed(0)}% (×${CRIT_MULT})`,
  ].filter(Boolean) as string[];

  return {
    baseCore,
    powerBonus,
    variance: 0,
    defenseReduction: reduction,
    defendMultiplier: defendMul,
    weakPointBonus: weak,
    softCapApplied,
    softCapValue,
    crit: false,
    finalDamage: 0,
    minDamage: afterMin,
    maxDamage: Math.max(afterMax, critMax),
    parts,
  };
}

export function rollCombatResult(input: CombatCalcPreview): CombatCalcResult {
  const { attacker, defender, powerBonus = 0, accuracyMod = 0, isHeavy = false, rng } = input;
  const hitBreakdown = computeHitChance(attacker, defender, accuracyMod);

  if (rng) {
    const accuracy = clamp(
      hitBreakdown.baseAccuracy +
        hitBreakdown.speedBonus +
        hitBreakdown.accuracyBonus / 100 +
        hitBreakdown.techniqueMod / 100,
      0.45,
      0.98,
    );
    if (rng.next() > accuracy || rng.chance(hitBreakdown.dodgeChance)) {
      return {
        hit: false,
        dodged: true,
        crit: false,
        damage: 0,
        hitBreakdown,
        damageBreakdown: computeDamageRange(input),
      };
    }
  }

  const rollMin = -2;
  const rollMax = 4;
  const variance = rng ? rng.nextInt(rollMin, rollMax) : 0;
  const baseCore = BASE_DAMAGE + attacker.stats.strength * STR_MULTIPLIER + powerBonus + variance;
  const crit = rng ? rng.chance(CRIT_BASE + attacker.stats.speed * 0.008) : false;
  const raw = crit ? Math.round(baseCore * CRIT_MULT) : baseCore;
  const reduction = defender.stats.defense * DEF_MULTIPLIER;
  let damage = Math.max(1, Math.round(raw - reduction));
  if (defender.defending) {
    damage = Math.max(1, Math.round(damage * 0.5));
  }
  const weak =
    defender.weakPointDiscovered && attacker.side === "PLAYER" ? 4 : 0;
  damage += weak;

  if (attacker.side === "ENEMY") {
    damage = softenEarlyEnemyDamage(
      damage,
      attacker.stats.strength,
      defender.maxHp,
      isHeavy || powerBonus > 0,
    );
  }

  const range = computeDamageRange(input);
  const damageBreakdown: DamageBreakdown = {
    ...range,
    variance,
    crit,
    critMultiplier: crit ? CRIT_MULT : undefined,
    finalDamage: damage,
  };

  return {
    hit: true,
    dodged: false,
    crit,
    damage,
    hitBreakdown,
    damageBreakdown,
  };
}

export function formatCombatDetail(result: CombatCalcResult): string {
  const lines = [
    ...result.hitBreakdown.parts,
    ...result.damageBreakdown.parts,
    result.crit ? "Critical hit!" : null,
    result.dodged ? "Attack missed or dodged." : `Final damage: ${result.damage}`,
  ].filter(Boolean);
  return lines.join(" · ");
}

export function statsFromStrength(strength: number): PlayerStats {
  return {
    strength,
    defense: Math.max(1, strength - 1),
    speed: Math.max(1, strength - 2),
    willpower: Math.max(2, Math.floor(strength / 2)),
    charisma: 2,
  };
}

export function observeBonuses(willpower: number): { accuracy: number; dodge: number; weakPointChance: number } {
  const scale = 1 + willpower * 0.04;
  return {
    accuracy: Math.round(12 * scale),
    dodge: Math.round(8 * scale),
    weakPointChance: clamp(0.25 + willpower * 0.02, 0.25, 0.65),
  };
}

export function scalingStatValue(stats: PlayerStats, stat: StatName): number {
  return stats[stat];
}

export type { CombatSide };
