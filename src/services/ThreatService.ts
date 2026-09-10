import { getAbilitiesForPlayer } from "../data/abilities";
import { getItemDefinition } from "../data/items";
import {
  EARLY_RUN_ENCOUNTER_LIMIT,
  EARLY_RUN_STRICT_LIMIT,
  ESCAPE_CHANCE_MAX,
  ESCAPE_CHANCE_MIN,
  ESCAPE_PITY_PER_ATTEMPT,
} from "../game/constants";
import type {
  CombatRequest,
  CombatantState,
  Encounter,
  Player,
  RunState,
  ThreatLevel,
} from "../models/types";
import { clamp } from "../utils/stats";

const THREAT_ORDER: ThreatLevel[] = ["TRIVIAL", "EASY", "FAIR", "DANGEROUS", "DEADLY"];

function combatItemBonus(player: Player): number {
  let bonus = 0;
  for (const item of player.inventory) {
    const def = getItemDefinition(item.itemId || item.id);
    if (!def) {
      continue;
    }
    if (def.effects.some((effect) => effect.type === "HEAL")) {
      bonus += 4;
    }
    if (def.effects.some((effect) => effect.type === "RESTORE_MP")) {
      bonus += 3;
    }
    if (def.effects.some((effect) => effect.type === "GUARANTEE_ESCAPE")) {
      bonus += 6;
    }
  }
  return Math.min(18, bonus);
}

export function estimatePlayerPower(player: Player): number {
  const stats = player.stats;
  const hpFactor = (player.hp / Math.max(1, player.maxHp)) * 18 + player.maxHp * 0.12;
  const statFactor =
    stats.strength * 3.2 +
    stats.defense * 2.2 +
    stats.speed * 1.8 +
    stats.willpower * 1.2 +
    stats.charisma * 0.4 +
    (stats.intelligence ?? 0) * 0.8;
  const abilityBonus = getAbilitiesForPlayer(player).length * 3;
  const fruitBonus = player.devilFruitId ? 10 : 0;
  return hpFactor + statFactor + abilityBonus + fruitBonus + combatItemBonus(player);
}

export function estimateEnemyPower(request: CombatRequest): number {
  const strength = request.enemyStrength;
  const hp = request.enemyHp ?? 22 + strength * 5;
  const defense = Math.max(1, strength - 1);
  const speed = Math.max(1, strength - 2);
  return hp * 0.35 + strength * 4.2 + defense * 2.4 + speed * 1.6;
}

export function estimateCombatantPower(combatant: CombatantState): number {
  const hpFactor = (combatant.hp / Math.max(1, combatant.maxHp)) * 18 + combatant.maxHp * 0.12;
  const stats = combatant.stats;
  return (
    hpFactor +
    stats.strength * 3.2 +
    stats.defense * 2.2 +
    stats.speed * 1.8 +
    stats.willpower * 1.2 +
    combatant.abilities.length * 3
  );
}

export function threatFromRatio(ratio: number): ThreatLevel {
  if (ratio < 0.55) return "TRIVIAL";
  if (ratio < 0.82) return "EASY";
  if (ratio < 1.18) return "FAIR";
  if (ratio < 1.55) return "DANGEROUS";
  return "DEADLY";
}

export function threatLevelFor(player: Player, request: CombatRequest): ThreatLevel {
  const playerPower = Math.max(1, estimatePlayerPower(player));
  return threatFromRatio(estimateEnemyPower(request) / playerPower);
}

export function maxThreat(levels: ThreatLevel[]): ThreatLevel {
  return levels.reduce<ThreatLevel>((highest, level) => {
    return THREAT_ORDER.indexOf(level) > THREAT_ORDER.indexOf(highest) ? level : highest;
  }, "TRIVIAL");
}

function collectCombatRequests(encounter: Encounter): CombatRequest[] {
  const found: CombatRequest[] = [];
  for (const choice of encounter.choices) {
    if (choice.outcome.combat) {
      found.push(choice.outcome.combat);
    }
    if (choice.outcome.skillCheck?.failure.combat) {
      found.push(choice.outcome.skillCheck.failure.combat);
    }
    if (choice.outcome.skillCheck?.success.combat) {
      found.push(choice.outcome.skillCheck.success.combat);
    }
  }
  return found;
}

export function encounterMaxThreat(encounter: Encounter, run: RunState): ThreatLevel | null {
  const requests = collectCombatRequests(encounter);
  if (!requests.length) {
    return null;
  }
  return maxThreat(requests.map((request) => threatLevelFor(run.player, request)));
}

export function encounterHasNonCombatExit(encounter: Encounter): boolean {
  return encounter.choices.some((choice) => !choice.outcome.combat);
}

export function threatWeightMultiplier(encounter: Encounter, run: RunState): number {
  const threat = encounterMaxThreat(encounter, run);
  const count = run.encounterCount;
  const hpRatio = run.player.hp / Math.max(1, run.player.maxHp);
  const hasExit = encounterHasNonCombatExit(encounter);
  let weight = 1;

  if (threat) {
    if (threat === "DEADLY" && count < EARLY_RUN_ENCOUNTER_LIMIT) {
      weight *= 0.05;
    } else if (threat === "DANGEROUS" && count < EARLY_RUN_STRICT_LIMIT) {
      weight *= hasExit ? 0.45 : 0.2;
    } else if (threat === "DANGEROUS" && count < EARLY_RUN_ENCOUNTER_LIMIT) {
      weight *= hasExit ? 0.7 : 0.35;
    }

    if (hpRatio < 0.35 && (threat === "DANGEROUS" || threat === "DEADLY")) {
      weight *= 0.35;
    }
    if (run.day <= 2 && threat === "DEADLY") {
      weight *= 0.4;
    }
  }

  // When hurt: bias toward recovery / settlement content, slightly dampen pure combat.
  const recoveryIds = new Set([
    "island_shore_day",
    "food_stall",
    "general_store",
    "clinic_shop",
    "island_inn",
    "supply_search",
    "deserted_island",
    "suspicious_merchant",
    "weapon_smith",
    "training_grounds",
  ]);
  const isCombatHeavy = Boolean(threat) && !hasExit;
  const isRecovery = recoveryIds.has(encounter.id) || encounter.category === "RECOVERY";

  if (hpRatio < 0.4) {
    if (isRecovery) {
      weight *= hpRatio < 0.25 ? 2.2 : 1.65;
    } else if (isCombatHeavy) {
      weight *= 0.55;
    } else if (threat === "EASY" || threat === "TRIVIAL" || !threat) {
      weight *= 1.15;
    }
  }

  // Early East Blue days: more food / clinic opportunities.
  if (run.day <= 5) {
    if (encounter.id === "food_stall" || encounter.id === "clinic_shop" || encounter.id === "supply_search") {
      weight *= 1.45;
    }
    if (encounter.id === "island_shore_day") {
      weight *= 1.35;
    }
  }

  return weight;
}

/** Player-facing threat labels (internal FAIR ≈ STANDARD). */
export function threatPlayerLabel(level: ThreatLevel): string {
  switch (level) {
    case "TRIVIAL":
      return "Low";
    case "EASY":
      return "Low";
    case "FAIR":
      return "Moderate";
    case "DANGEROUS":
      return "High";
    case "DEADLY":
      return "Very High";
    default:
      return level;
  }
}

export function isUnescapableRequest(request: CombatRequest): boolean {
  const kind = request.combatKind ?? "NORMAL";
  if (kind === "BOSS" || kind === "DUEL" || kind === "STORY") {
    return request.canEscape === false;
  }
  return false;
}

export function escapeChances(
  playerSpeed: number,
  enemySpeed: number,
  attempts: number,
  guaranteed: boolean,
): { base: number; pity: number; total: number; guaranteed: boolean } {
  if (guaranteed) {
    return { base: 1, pity: 0, total: 1, guaranteed: true };
  }
  const base = clamp(0.35 + playerSpeed * 0.06 - enemySpeed * 0.03, ESCAPE_CHANCE_MIN, 0.85);
  const pity = attempts * ESCAPE_PITY_PER_ATTEMPT;
  const total = clamp(base + pity, ESCAPE_CHANCE_MIN, ESCAPE_CHANCE_MAX);
  return { base, pity, total, guaranteed: false };
}

export function debugCombatSnapshot(run: RunState): {
  threatLevel: ThreatLevel | null;
  playerPower: number;
  enemyPower: number | null;
  escapeBase: number | null;
  escapePity: number | null;
  escapeTotal: number | null;
} {
  const combat = run.combat;
  if (!combat) {
    return {
      threatLevel: null,
      playerPower: Math.round(estimatePlayerPower(run.player)),
      enemyPower: null,
      escapeBase: null,
      escapePity: null,
      escapeTotal: null,
    };
  }
  const enemy = combat.enemies[0];
  const chances = enemy
    ? escapeChances(
        combat.playerCombatant.stats.speed,
        enemy.stats.speed,
        combat.escapeAttempts,
        combat.guaranteedEscape,
      )
    : null;
  return {
    threatLevel: combat.threatLevel,
    playerPower: Math.round(estimateCombatantPower(combat.playerCombatant)),
    enemyPower: enemy ? Math.round(estimateCombatantPower(enemy)) : null,
    escapeBase: chances ? Math.round(chances.base * 100) : null,
    escapePity: chances ? Math.round(chances.pity * 100) : null,
    escapeTotal: chances ? Math.round(chances.total * 100) : null,
  };
}
