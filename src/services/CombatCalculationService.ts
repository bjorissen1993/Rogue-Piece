import type { Ability, CombatSide, CombatantState, PlayerStats, StatName, StatusEffect } from "../models/types";
import { powerLevelFromLegacyPower, techniqueBaseHitChance } from "../game/techniquePower";
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
  /** When set, accuracy is driven by power level vs attacker.level. */
  techniquePowerLevel?: number;
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

function statusSum(
  effects: StatusEffect[],
  key: "accuracyBonus" | "dodgeBonus" | "damageDealtMod" | "damageTakenMod",
): number {
  return effects.reduce((sum, effect) => sum + (effect[key] ?? 0), 0);
}

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

export function resolveAbilityPowerLevel(ability: Ability): number {
  return ability.powerLevel ?? powerLevelFromLegacyPower(ability.power);
}

/**
 * Flat technique power added into damage.
 * When `powerLevel` is set, power level is accuracy-only — damage comes from scalingStat.
 */
export function resolveAbilityPower(ability: Ability): number {
  if (ability.powerLevel != null) {
    return 0;
  }
  return ability.power;
}

export function techniqueScalingPowerBonus(
  stats: PlayerStats,
  scalingStat: StatName,
  damageMult = 1,
): number {
  return Math.round(scalingStatValue(stats, scalingStat) * damageMult);
}

const HEAL_PER_SCALING = 2;

/** Heal amount for technique offers / resolution (base + scaling). */
export function techniqueHealAmount(
  baseHeal: number | undefined,
  stats: PlayerStats,
  scalingStat: StatName,
): number {
  return Math.max(1, (baseHeal ?? 8) + scalingStatValue(stats, scalingStat) * HEAL_PER_SCALING);
}

/** Rough damage range vs a typical foe (for technique pick UI). */
export function estimateTechniqueDamageRange(
  stats: PlayerStats,
  scalingStat: StatName,
  damageMult = 1,
  referenceDefense = 3,
): { minDamage: number; maxDamage: number } {
  const powerBonus = techniqueScalingPowerBonus(stats, scalingStat, damageMult);
  const baseCore = BASE_DAMAGE + stats.strength * STR_MULTIPLIER + powerBonus;
  const reduction = referenceDefense * DEF_MULTIPLIER;
  const minDamage = Math.max(1, Math.round(baseCore - 2 - reduction));
  const maxDamage = Math.max(minDamage, Math.round(baseCore + 4 - reduction));
  return { minDamage, maxDamage };
}

export function computeHitChance(
  attacker: CombatantState,
  defender: CombatantState,
  accuracyMod = 0,
  techniquePowerLevel?: number,
): HitChanceBreakdown {
  const speedBonus = attacker.stats.speed * 0.015;
  const statusAcc = statusSum(attacker.statusEffects, "accuracyBonus") / 100;
  const accuracyBonus = attacker.accuracyBonus / 100 + statusAcc;
  const statusDodge = statusSum(defender.statusEffects, "dodgeBonus");
  let baseAccuracy = BASE_ACCURACY;
  let techniqueMod = accuracyMod / 100;
  const parts: string[] = [];

  if (techniquePowerLevel != null) {
    const characterLevel = attacker.level ?? 1;
    baseAccuracy = techniqueBaseHitChance(techniquePowerLevel, characterLevel, accuracyMod);
    techniqueMod = 0;
    parts.push(
      `Power Lv ${techniquePowerLevel} vs Lv ${characterLevel} → ${(baseAccuracy * 100).toFixed(0)}%`,
    );
  } else {
    parts.push(`Base accuracy ${(BASE_ACCURACY * 100).toFixed(0)}%`);
    if (accuracyMod) {
      parts.push(`Technique bias ${accuracyMod >= 0 ? "+" : ""}${accuracyMod}%`);
    }
  }

  const accuracy = clamp(baseAccuracy + speedBonus + accuracyBonus + techniqueMod, 0.15, 0.98);
  const dodgeChance = clamp(
    0.04 +
      defender.stats.speed * 0.012 +
      defender.dodgeBonus / 100 +
      statusDodge / 100 -
      attacker.stats.speed * 0.006,
    0.02,
    0.4,
  );
  const combined = accuracy * (1 - dodgeChance);
  parts.push(`Speed +${(speedBonus * 100).toFixed(1)}%`);
  if (attacker.accuracyBonus || statusAcc) {
    parts.push(`Bonuses +${((accuracyBonus) * 100).toFixed(0)}%`);
  }
  parts.push(`Enemy dodge ~${(dodgeChance * 100).toFixed(0)}%`);
  parts.push(`Net hit ~${(combined * 100).toFixed(0)}%`);

  return {
    baseAccuracy,
    speedBonus,
    accuracyBonus: attacker.accuracyBonus + statusSum(attacker.statusEffects, "accuracyBonus"),
    techniqueMod: techniquePowerLevel != null ? 0 : accuracyMod,
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
  const {
    attacker,
    defender,
    powerBonus = 0,
    accuracyMod = 0,
    techniquePowerLevel,
    isHeavy = false,
    rng,
  } = input;
  const hitBreakdown = computeHitChance(attacker, defender, accuracyMod, techniquePowerLevel);

  if (rng && !rng.chance(hitBreakdown.combined)) {
    return {
      hit: false,
      dodged: true,
      crit: false,
      damage: 0,
      hitBreakdown,
      damageBreakdown: computeDamageRange(input),
    };
  }

  const rollMin = -2;
  const rollMax = 4;
  const variance = rng ? rng.nextInt(rollMin, rollMax) : 0;
  const dealtMod = 1 + statusSum(attacker.statusEffects, "damageDealtMod");
  const takenMod = 1 + statusSum(defender.statusEffects, "damageTakenMod");
  const baseCore =
    (BASE_DAMAGE + attacker.stats.strength * STR_MULTIPLIER + powerBonus + variance) * dealtMod;
  const crit = rng ? rng.chance(CRIT_BASE + attacker.stats.speed * 0.008) : false;
  const raw = crit ? Math.round(baseCore * CRIT_MULT) : Math.round(baseCore);
  const reduction = defender.stats.defense * DEF_MULTIPLIER;
  let damage = Math.max(1, Math.round((raw - reduction) * takenMod));
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
    intelligence: Math.max(2, Math.floor(strength / 2)),
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
