import type { AbilityEffectSpec, CombatStatusKind, EnemyFamily, EnemyRole } from "../models/types";

export const COMBAT_STATUS_KINDS: CombatStatusKind[] = [
  "BURN",
  "BLEED",
  "POISON",
  "BLIND",
  "STUN",
  "DAZED",
  "FEAR",
  "PANIC",
  "CONFUSION",
];

export type CombatStatusDef = {
  kind: CombatStatusKind;
  name: string;
  turns: number;
  chipTone: string;
  summary: string;
  accuracyBonus?: number;
  dodgeBonus?: number;
  damageDealtMod?: number;
  damageTakenMod?: number;
  /** Fraction of max HP lost at the start of each of their turns. */
  damagePctMaxHp?: number;
  skipTurn?: boolean;
  skipChance?: number;
  randomizeTarget?: boolean;
};

export const COMBAT_STATUS_DEFS: Record<CombatStatusKind, CombatStatusDef> = {
  BURN: {
    kind: "BURN",
    name: "Burn",
    turns: 3,
    chipTone: "is-burn",
    summary: "Seared — takes heat damage each turn and incoming hits hurt more.",
    damagePctMaxHp: 0.06,
    damageTakenMod: 0.1,
  },
  BLEED: {
    kind: "BLEED",
    name: "Bleed",
    turns: 3,
    chipTone: "is-bleed",
    summary: "Open wound — loses HP at the start of each turn.",
    damagePctMaxHp: 0.05,
  },
  POISON: {
    kind: "POISON",
    name: "Poison",
    turns: 3,
    chipTone: "is-poison",
    summary: "Venom in the blood — ticks each turn and weakens their strikes.",
    damagePctMaxHp: 0.04,
    damageDealtMod: -0.1,
  },
  BLIND: {
    kind: "BLIND",
    name: "Blind",
    turns: 3,
    chipTone: "is-blind",
    summary: "Can't see the opening — accuracy drops sharply.",
    accuracyBonus: -28,
  },
  STUN: {
    kind: "STUN",
    name: "Stun",
    turns: 1,
    chipTone: "is-stun",
    summary: "Locked up — loses the next turn.",
    skipTurn: true,
    dodgeBonus: -12,
  },
  DAZED: {
    kind: "DAZED",
    name: "Dazed",
    turns: 2,
    chipTone: "is-dazed",
    summary: "Head ringing — accuracy down, and they may miss the turn entirely.",
    accuracyBonus: -12,
    skipChance: 0.35,
  },
  FEAR: {
    kind: "FEAR",
    name: "Fear",
    turns: 3,
    chipTone: "is-fear",
    summary: "Hesitation in the hands — weaker hits and poorer aim.",
    damageDealtMod: -0.2,
    accuracyBonus: -8,
  },
  PANIC: {
    kind: "PANIC",
    name: "Panic",
    turns: 2,
    chipTone: "is-panic",
    summary: "Footing gone — dodge down, and they may freeze instead of acting.",
    dodgeBonus: -14,
    skipChance: 0.28,
  },
  CONFUSION: {
    kind: "CONFUSION",
    name: "Confusion",
    turns: 2,
    chipTone: "is-confusion",
    summary: "Can't tell friend from foe — strikes may land on anyone.",
    accuracyBonus: -10,
    randomizeTarget: true,
  },
};

export function isCombatStatusKind(value: string): value is CombatStatusKind {
  return (COMBAT_STATUS_KINDS as string[]).includes(value);
}

/** Ability/technique payload that applies the canonical named status. */
export function namedCombatStatus(
  kind: CombatStatusKind,
  target: AbilityEffectSpec["target"] = "TARGET",
  turns?: number,
): AbilityEffectSpec {
  const def = COMBAT_STATUS_DEFS[kind];
  return {
    id: kind.toLowerCase(),
    name: def.name,
    kind: "DEBUFF",
    turns: turns ?? def.turns,
    target,
    statusKind: kind,
  };
}

export type EnemyOnHitStatus = {
  kind: CombatStatusKind;
  chance: number;
};

/** Family/role on-hit inflict. Friendly/training fights should skip this. */
export function enemyOnHitStatus(
  family: EnemyFamily | undefined,
  role: EnemyRole | undefined,
  isHeavy: boolean,
): EnemyOnHitStatus | null {
  if (!family || family === "TRAINING") {
    return null;
  }
  const roleBonus = role === "BOSS" ? 0.12 : role === "ELITE" ? 0.08 : 0;
  const withRole = (chance: number): number => Math.min(0.45, chance + roleBonus);

  if (family === "SEA_BEAST") {
    return { kind: "POISON", chance: withRole(isHeavy ? 0.28 : 0.18) };
  }
  if (family === "BEAST") {
    return { kind: "BLEED", chance: withRole(isHeavy ? 0.26 : 0.16) };
  }
  if (family === "HUNTER") {
    return { kind: "BLIND", chance: withRole(isHeavy ? 0.22 : 0.14) };
  }
  if (family === "MARINE") {
    if (isHeavy && (role === "ELITE" || role === "BOSS")) {
      return { kind: "STUN", chance: withRole(0.16) };
    }
    return isHeavy ? { kind: "DAZED", chance: withRole(0.2) } : null;
  }
  if (family === "GOVERNMENT") {
    if (isHeavy && (role === "ELITE" || role === "BOSS")) {
      return { kind: "PANIC", chance: withRole(0.16) };
    }
    return { kind: "FEAR", chance: withRole(isHeavy ? 0.22 : 0.12) };
  }
  if (family === "REVOLUTIONARY") {
    return isHeavy ? { kind: "CONFUSION", chance: withRole(0.18) } : null;
  }
  if (family === "PIRATE") {
    if (isHeavy) {
      return { kind: "FEAR", chance: withRole(0.14) };
    }
    return { kind: "BLEED", chance: withRole(0.12) };
  }
  if (family === "STREET") {
    return isHeavy ? { kind: "BLEED", chance: withRole(0.2) } : null;
  }
  if (family === "STORY") {
    return isHeavy ? { kind: "DAZED", chance: withRole(0.14) } : null;
  }
  return null;
}
