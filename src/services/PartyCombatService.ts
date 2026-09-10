import type { CombatState, CombatantState, RunState } from "../models/types";
import { clamp } from "../utils/stats";
import { CrewCombatService } from "./CrewCombatService";
import type { RandomService } from "./RandomService";
import {
  formatCombatDetail,
  rollCombatResult,
} from "./CombatCalculationService";

function livingEnemies(state: CombatState): CombatantState[] {
  return state.enemies.filter((enemy) => enemy.hp > 0);
}

function applyDamage(target: CombatantState, amount: number): void {
  target.hp = clamp(target.hp - amount, 0, target.maxHp);
}

function recordHit(
  state: CombatState,
  target: CombatantState,
  amount: number,
  kind: "HIT" | "MISS" | "HEAL",
): void {
  state.lastHits.push({
    id: `hit-${state.lastHits.length}-${Date.now()}`,
    combatantId: target.id,
    side: target.side,
    amount,
    kind,
  });
}

function recordDamageTaken(state: CombatState, combatantId: string, amount: number): void {
  const party = state.party;
  if (!party || amount <= 0) {
    return;
  }
  const contrib = party.contributions.find((entry) => entry.combatantId === combatantId);
  if (contrib) {
    contrib.damageTaken += amount;
  }
}

function pickEnemyIntent(enemy: CombatantState, rng: RandomService): void {
  const roll = rng.next();
  if (roll < 0.18) {
    enemy.intendedAction = "DEFEND";
  } else if (roll < 0.42) {
    enemy.intendedAction = "HEAVY";
  } else {
    enemy.intendedAction = "ATTACK";
  }
}

function hintFor(intent: CombatantState["intendedAction"]): string {
  if (intent === "HEAVY") {
    return "The enemy seems to be preparing a heavy attack.";
  }
  if (intent === "DEFEND") {
    return "They look ready to brace, not to strike.";
  }
  return "They will press a straightforward attack.";
}

function pickEnemyTarget(state: CombatState, rng: RandomService): CombatantState | undefined {
  const allies = PartyCombatService.livingAllies(state);
  if (!allies.length) {
    return undefined;
  }
  const weights = allies.map((ally) => {
    let weight = 1;
    if (ally.id === state.playerCombatant.id) {
      weight += 0.35;
    }
    if (ally.hp / Math.max(1, ally.maxHp) < 0.35) {
      weight += 0.25;
    }
    if (ally.defending) {
      weight -= 0.15;
    }
    return { ally, weight: Math.max(0.2, weight) };
  });
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.ally;
    }
  }
  return weights[weights.length - 1]?.ally;
}

function executeEnemyAction(
  state: CombatState,
  enemy: CombatantState,
  run: RunState | null,
  rng: RandomService,
): void {
  const intent = enemy.intendedAction;
  enemy.defending = intent === "DEFEND";
  if (intent === "DEFEND") {
    state.log.push({
      id: `clog-${state.log.length}`,
      round: state.round,
      text: `${enemy.name} braces for impact.`,
    });
    pickEnemyIntent(enemy, rng);
    enemy.nextActionHint = hintFor(enemy.intendedAction);
    return;
  }

  const target = pickEnemyTarget(state, rng);
  if (!target) {
    return;
  }

  const power = intent === "HEAVY" ? 10 : 0;
  const accuracyMod = intent === "HEAVY" ? -8 : 0;
  const calc = rollCombatResult({
    attacker: enemy,
    defender: target,
    powerBonus: power,
    accuracyMod,
    isHeavy: intent === "HEAVY",
    rng,
  });

  if (calc.dodged) {
    recordHit(state, target, 0, "MISS");
    state.log.push({
      id: `clog-${state.log.length}`,
      round: state.round,
      text: `${enemy.name} swings${intent === "HEAVY" ? " heavily" : ""} at ${target.name} — they slip aside.`,
      detail: formatCombatDetail(calc),
    });
  } else {
    let damage = calc.damage;
    if (run) {
      damage = CrewCombatService.trySupportIntervention(state, run, damage, target.id);
    }
    recordDamageTaken(state, target.id, damage);
    applyDamage(target, damage);
    recordHit(state, target, damage, "HIT");
    const crit = calc.crit ? " A brutal hit!" : "";
    state.log.push({
      id: `clog-${state.log.length}`,
      round: state.round,
      text: `${enemy.name} ${intent === "HEAVY" ? "slams" : "strikes"} ${target.name} for ${damage} damage.${crit}`,
      detail: formatCombatDetail(calc),
    });
    if (target.id === state.playerCombatant.id && target.hp <= 0) {
      state.log.push({
        id: `clog-${state.log.length}`,
        round: state.round,
        text: "The captain is down!",
      });
    }
  }
  pickEnemyIntent(enemy, rng);
  enemy.nextActionHint = hintFor(enemy.intendedAction);
}

function clearTurnBonuses(combatant: CombatantState): void {
  combatant.defending = false;
  combatant.accuracyBonus = Math.max(0, combatant.accuracyBonus - 8);
  combatant.dodgeBonus = Math.max(0, combatant.dodgeBonus - 8);
}

function tickStatusEffects(combatant: CombatantState): void {
  if (!combatant.statusEffects.length) {
    return;
  }
  combatant.statusEffects = combatant.statusEffects
    .map((effect) => ({ ...effect, remainingTurns: effect.remainingTurns - 1 }))
    .filter((effect) => effect.remainingTurns > 0);
}

export const PartyCombatService = {
  allAllies(state: CombatState): CombatantState[] {
    const allies = [state.playerCombatant];
    if (state.party?.allyCombatants.length) {
      allies.push(...state.party.allyCombatants);
    }
    return allies;
  },

  livingAllies(state: CombatState): CombatantState[] {
    return this.allAllies(state).filter((ally) => ally.hp > 0);
  },

  anyAllyAlive(state: CombatState): boolean {
    return this.livingAllies(state).length > 0;
  },

  getCombatant(state: CombatState, id: string): CombatantState | undefined {
    if (state.playerCombatant.id === id) {
      return state.playerCombatant;
    }
    return state.party?.allyCombatants.find((ally) => ally.id === id) ?? state.enemies.find((foe) => foe.id === id);
  },

  getActiveCombatant(state: CombatState): CombatantState | undefined {
    if (!state.activeCombatantId) {
      return state.playerCombatant;
    }
    return this.getCombatant(state, state.activeCombatantId);
  },

  isPlayerTurn(state: CombatState): boolean {
    if (state.finished || state.activeSide !== "PLAYER") {
      return false;
    }
    const active = this.getActiveCombatant(state);
    return Boolean(active && active.side === "PLAYER" && active.hp > 0);
  },

  buildTurnOrder(state: CombatState, rng: RandomService): string[] {
    const units = [
      ...this.allAllies(state).map((ally) => {
        const variance = rng.nextInt(0, 3);
        ally.initiativeVariance = variance;
        ally.initiativeScore = ally.stats.speed + variance;
        return { id: ally.id, speed: ally.initiativeScore };
      }),
      ...livingEnemies(state).map((enemy) => {
        const variance = rng.nextInt(0, 3);
        enemy.initiativeVariance = variance;
        enemy.initiativeScore = enemy.stats.speed + variance;
        return { id: enemy.id, speed: enemy.initiativeScore };
      }),
    ];
    units.sort((a, b) => b.speed - a.speed);
    return units.map((unit) => unit.id);
  },

  upcomingTurnPositions(state: CombatState): Array<{ id: string; position: number }> {
    const living = new Set(
      [...this.livingAllies(state), ...livingEnemies(state)].map((entry) => entry.id),
    );
    if (!state.turnOrder.length || living.size === 0) {
      return [];
    }
    const start = Math.max(0, state.turnIndex);
    const ordered: string[] = [];
    for (let i = 0; i < state.turnOrder.length; i += 1) {
      const id = state.turnOrder[(start + i) % state.turnOrder.length];
      if (living.has(id) && !ordered.includes(id)) {
        ordered.push(id);
      }
    }
    return ordered.map((id, index) => ({ id, position: index + 1 }));
  },

  initTurnOrder(state: CombatState, run: RunState | null, rng: RandomService): void {
    state.turnOrder = this.buildTurnOrder(state, rng);
    state.turnIndex = -1;
    this.advanceTurn(state, run, rng);
  },

  advanceTurn(state: CombatState, run: RunState | null, rng: RandomService): void {
    if (state.finished || !state.turnOrder.length) {
      return;
    }

    const maxSteps = state.turnOrder.length * 3;
    for (let step = 0; step < maxSteps; step += 1) {
      state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
      if (state.turnIndex === 0 && step > 0) {
        state.round += 1;
        if (run) {
          const supportLines = CrewCombatService.triggerSupportAbilities(state, run, "TURN_START", rng);
          for (const line of supportLines) {
            state.log.push({
              id: `clog-${state.log.length}`,
              round: state.round,
              text: line,
            });
          }
        }
        for (const ally of this.allAllies(state)) {
          clearTurnBonuses(ally);
        }
      }

      const combatantId = state.turnOrder[state.turnIndex];
      const combatant = this.getCombatant(state, combatantId);
      if (!combatant || combatant.hp <= 0) {
        continue;
      }

      tickStatusEffects(combatant);

      if (combatant.side === "ENEMY") {
        state.activeCombatantId = combatant.id;
        state.activeSide = "ENEMY";
        return;
      }

      state.activeCombatantId = combatant.id;
      state.activeSide = "PLAYER";
      return;
    }
  },

  /** Resolve the current enemy actor, then advance until a player turn or fight end. */
  resolveEnemyTurn(state: CombatState, run: RunState | null, rng: RandomService): void {
    if (state.finished || state.activeSide !== "ENEMY") {
      return;
    }
    const enemy = this.getActiveCombatant(state);
    if (!enemy || enemy.side !== "ENEMY" || enemy.hp <= 0) {
      this.advanceTurn(state, run, rng);
      return;
    }

    state.lastHits = [];
    executeEnemyAction(state, enemy, run, rng);

    if (!this.anyAllyAlive(state)) {
      state.finished = true;
      state.result = "LOSE";
      return;
    }
    if (livingEnemies(state).length === 0) {
      state.finished = true;
      state.result = "WIN";
      return;
    }

    this.advanceTurn(state, run, rng);
  },

  livingEnemies,
};
