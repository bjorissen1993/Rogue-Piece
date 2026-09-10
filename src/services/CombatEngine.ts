import { getAbilitiesForPlayer } from "../data/abilities";
import { MpService } from "./MpService";
import type {
  Ability,
  CombatAction,
  CombatHit,
  CombatLogEntry,
  CombatRequest,
  CombatResult,
  CombatState,
  CombatantState,
  Player,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { clamp } from "../utils/stats";
import {
  formatCombatDetail,
  observeBonuses,
  rollCombatResult,
  statsFromStrength,
} from "./CombatCalculationService";
import { CrewCombatService } from "./CrewCombatService";
import { PartyCombatService } from "./PartyCombatService";
import { WorldCombatProgressionService } from "./WorldCombatProgressionService";
import type { RandomService } from "./RandomService";
import { escapeChances, isUnescapableRequest, threatLevelFor } from "./ThreatService";
import type { ItemUseResult } from "./ItemService";

function cloneStats(stats: CombatantState["stats"]): CombatantState["stats"] {
  return { ...stats };
}

function log(state: CombatState, text: string, detail?: string): void {
  const entry: CombatLogEntry = {
    id: createId("clog"),
    round: state.round,
    text,
    detail,
  };
  state.log.push(entry);
}

function toCombatResult(calc: ReturnType<typeof rollCombatResult>): CombatResult {
  return {
    hit: calc.hit,
    dodged: calc.dodged,
    crit: calc.crit,
    damage: calc.damage,
    hitBreakdown: calc.hitBreakdown.parts,
    damageBreakdown: calc.damageBreakdown.parts,
  };
}

function livingEnemies(state: CombatState): CombatantState[] {
  return state.enemies.filter((enemy) => enemy.hp > 0);
}

function primaryEnemy(state: CombatState): CombatantState | undefined {
  return livingEnemies(state)[0];
}

function resolveActionTarget(state: CombatState, action: CombatAction): CombatantState | undefined {
  if (action.targetId) {
    const found = PartyCombatService.getCombatant(state, action.targetId);
    if (found && found.hp > 0) {
      return found;
    }
  }
  return primaryEnemy(state);
}

function applyDamage(target: CombatantState, amount: number): void {
  target.hp = clamp(target.hp - amount, 0, target.maxHp);
}

function recordHit(
  state: CombatState,
  target: CombatantState,
  amount: number,
  kind: CombatHit["kind"],
): void {
  state.lastHits.push({
    id: createId("hit"),
    combatantId: target.id,
    side: target.side,
    amount,
    kind,
  });
}

function finishIfNeeded(state: CombatState): void {
  if (!PartyCombatService.anyAllyAlive(state)) {
    state.finished = true;
    state.result = "LOSE";
    return;
  }
  if (livingEnemies(state).length === 0) {
    state.finished = true;
    state.result = "WIN";
  }
}

function actorLabel(actor: CombatantState, captainId: string): string {
  return actor.id === captainId ? "You" : actor.name;
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

function resolveAttack(
  state: CombatState,
  attacker: CombatantState,
  defender: CombatantState,
  rng: RandomService,
  options: {
    powerBonus?: number;
    accuracyMod?: number;
    isHeavy?: boolean;
    attackerLabel?: string;
    defenderLabel?: string;
    techniqueName?: string;
  },
): CombatResult {
  const calc = rollCombatResult({
    attacker,
    defender,
    powerBonus: options.powerBonus ?? 0,
    accuracyMod: options.accuracyMod ?? 0,
    isHeavy: options.isHeavy ?? false,
    rng,
  });
  const result = toCombatResult(calc);
  state.lastCombatResult = result;

  if (calc.dodged) {
    recordHit(state, defender, 0, "MISS");
    const who = options.attackerLabel ?? attacker.name;
    log(state, `${who} strikes — ${options.defenderLabel ?? defender.name} slips away.`);
    return result;
  }

  let damage = calc.damage;
  applyDamage(defender, damage);
  recordHit(state, defender, damage, "HIT");

  if (attacker.side === "PLAYER" && state.party) {
    const contrib = state.party.contributions.find((entry) => entry.combatantId === attacker.id);
    if (contrib) {
      contrib.damageDealt += damage;
    }
  }

  if (defender.side === "PLAYER" && state.party && damage > 0) {
    const contrib = state.party.contributions.find((entry) => entry.combatantId === defender.id);
    if (contrib) {
      contrib.damageTaken += damage;
    }
  }

  const who = options.attackerLabel ?? attacker.name;
  const action = options.techniqueName ?? (options.isHeavy ? "slams" : "hits");
  const crit = calc.crit ? " Critical!" : "";
  log(
    state,
    `${who} ${action} for ${damage} damage.${crit}`,
    formatCombatDetail(calc),
  );
  return result;
}

function endPlayerTurn(state: CombatState, run: RunState | null | undefined, rng: RandomService): void {
  finishIfNeeded(state);
  if (state.finished) {
    return;
  }
  PartyCombatService.advanceTurn(state, run ?? null, rng);
  finishIfNeeded(state);
}

function createCombatant(options: {
  id: string;
  name: string;
  side: CombatantState["side"];
  hp: number;
  stats: CombatantState["stats"];
  abilities: Ability[];
  mp?: number;
  maxMp?: number;
  formation?: CombatantState["formation"];
}): CombatantState {
  return {
    id: options.id,
    name: options.name,
    side: options.side,
    hp: options.hp,
    maxHp: options.hp,
    mp: options.mp ?? 0,
    maxMp: options.maxMp ?? 0,
    stats: cloneStats(options.stats),
    defending: false,
    observed: false,
    revealed: false,
    nextActionHint: null,
    intendedAction: "ATTACK",
    weakPointDiscovered: false,
    accuracyBonus: 0,
    dodgeBonus: 0,
    statusEffects: [],
    abilities: options.abilities,
    formation: options.formation,
  };
}

export const CombatEngine = {
  skillCheck(statValue: number, difficulty: number, rng: RandomService): boolean {
    return statValue + rng.roll(6) >= difficulty;
  },

  createFromRequest(
    player: Player,
    request: CombatRequest,
    rng: RandomService,
    run?: RunState,
  ): CombatState {
    const enemyStats = statsFromStrength(request.enemyStrength);
    const enemyHp = request.enemyHp ?? 22 + request.enemyStrength * 5;
    const enemy = createCombatant({
      id: createId("foe"),
      name: request.enemyName,
      side: "ENEMY",
      hp: enemyHp,
      stats: enemyStats,
      abilities: [],
    });
    pickEnemyIntent(enemy, rng);
    enemy.nextActionHint = hintFor(enemy.intendedAction);

    const extras = run ? WorldCombatProgressionService.additionalEnemies(run, request, rng) : request.extraEnemies ?? [];
    const extraCombatants = extras.slice(0, 3).map((spec, index) => {
      const strength = "strength" in spec ? spec.strength : request.enemyStrength;
      const hp = spec.hp ?? Math.max(10, Math.round(enemyHp * 0.55));
      const extra = createCombatant({
        id: createId("foe"),
        name: spec.name,
        side: "ENEMY",
        hp,
        stats: statsFromStrength(strength),
        abilities: [],
        formation: spec.formation ?? (index === 0 ? "FRONT" : "BACK"),
      });
      pickEnemyIntent(extra, rng);
      extra.nextActionHint = hintFor(extra.intendedAction);
      return extra;
    });
    enemy.formation = extraCombatants.length ? "FRONT" : "FRONT";

    const combatKind = request.combatKind ?? "NORMAL";
    const unescapable = isUnescapableRequest(request);
    const canEscape = unescapable ? false : request.canEscape !== false;
    const threatLevel = threatLevelFor(player, request);
    const canSurrender =
      request.canSurrender ??
      (combatKind !== "BOSS" && combatKind !== "DUEL" && (threatLevel === "DANGEROUS" || threatLevel === "DEADLY"));

    const playerMaxMp = MpService.maxMpFor(player);
    MpService.ensurePlayer(player);

    const state: CombatState = {
      round: 1,
      playerCombatant: createCombatant({
        id: player.id,
        name: player.name,
        side: "PLAYER",
        hp: player.hp,
        stats: player.stats,
        abilities: getAbilitiesForPlayer(player),
        mp: player.mp ?? playerMaxMp,
        maxMp: playerMaxMp,
      }),
      enemies: [enemy, ...extraCombatants],
      activeSide: "PLAYER",
      activeCombatantId: player.id,
      turnOrder: [],
      turnIndex: -1,
      log: [],
      lastHits: [],
      finished: false,
      result: null,
      canEscape,
      canSurrender,
      escapeAttempts: 0,
      guaranteedEscape: false,
      threatLevel,
      combatKind,
      unescapableReason: unescapable
        ? (request.unescapableReason ?? "There is no running from this.")
        : null,
      pendingOutcome: {
        win: request.win,
        lose: request.lose,
        escape: request.escape,
        surrender: request.surrender,
      },
    };

    if (run) {
      const party = CrewCombatService.initCombatParty(run, state);
      const supportLines = CrewCombatService.triggerSupportAbilities(state, run, "COMBAT_START", rng);
      for (const line of supportLines) {
        log(state, line);
      }
      if (party.allyCombatants.length) {
        const names = [state.playerCombatant.name, ...party.allyCombatants.map((entry) => entry.name)].join(", ");
        log(state, `Active party: ${names}.`);
      }
      PartyCombatService.initTurnOrder(state, run, rng);
    } else {
      PartyCombatService.initTurnOrder(state, null, rng);
    }

    const names = [enemy, ...extraCombatants].map((entry) => entry.name).join(", ");
    log(state, `${names} block your path.`);
    if (!canEscape) {
      log(state, state.unescapableReason ?? "Escape is not an option.");
    }
    return state;
  },

  performAction(
    state: CombatState,
    action: CombatAction,
    rng: RandomService,
    run?: RunState,
  ): CombatState {
    if (state.finished || !PartyCombatService.isPlayerTurn(state)) {
      return state;
    }
    const next: CombatState = structuredClone(state);
    next.lastHits = [];
    const actor = PartyCombatService.getActiveCombatant(next);
    const captainId = next.playerCombatant.id;
    if (!actor || actor.hp <= 0) {
      return state;
    }
    const enemy = resolveActionTarget(next, action);
    if (!enemy && action.type !== "DEFEND" && action.type !== "ESCAPE" && action.type !== "SURRENDER" && action.type !== "ITEM") {
      next.finished = true;
      next.result = "WIN";
      return next;
    }

    actor.defending = false;
    const label = actorLabel(actor, captainId);

    switch (action.type) {
      case "ATTACK":
        if (enemy) {
          resolveAttack(next, actor, enemy, rng, {
            attackerLabel: label,
            defenderLabel: enemy.name,
          });
        }
        break;
      case "TECHNIQUE": {
        const ability =
          actor.abilities.find((item) => item.id === action.abilityId) ?? actor.abilities[0];
        if (!ability) {
          log(next, `${label} has no technique ready — a plain strike instead.`);
          if (enemy) {
            resolveAttack(next, actor, enemy, rng, { attackerLabel: label, defenderLabel: enemy.name });
          }
          break;
        }
        const mpCost = MpService.abilityMpCost(ability);
        if ((actor.mp ?? 0) < mpCost) {
          log(next, `${label} lacks focus for ${ability.name} (${mpCost} MP). A normal strike instead.`);
          if (enemy) {
            resolveAttack(next, actor, enemy, rng, { attackerLabel: label, defenderLabel: enemy.name });
          }
          break;
        }
        actor.mp = Math.max(0, (actor.mp ?? 0) - mpCost);
        if (next.party) {
          const contrib = next.party.contributions.find((entry) => entry.combatantId === actor.id);
          if (contrib) {
            contrib.mpSpent = (contrib.mpSpent ?? 0) + mpCost;
          }
        }
        const scale = actor.stats[ability.scalingStat];
        const isAoe = ability.tags?.includes("AOE");
        const targets = isAoe
          ? livingEnemies(next)
          : enemy
            ? [enemy]
            : [];
        if (!targets.length) {
          log(next, `${label} has no target for ${ability.name}.`);
          break;
        }
        for (const target of targets) {
          resolveAttack(next, actor, target, rng, {
            powerBonus: ability.power + scale,
            accuracyMod: ability.accuracyMod,
            attackerLabel: label,
            defenderLabel: target.name,
            techniqueName: `${ability.name} lands (${mpCost} MP)`,
          });
        }
        break;
      }
      case "DEFEND":
        actor.defending = true;
        actor.dodgeBonus += 6;
        log(next, `${label} guards, cutting the next blow in half.`);
        break;
      case "OBSERVE": {
        const observed = enemy ?? primaryEnemy(next);
        if (!observed) {
          break;
        }
        actor.observed = true;
        observed.revealed = true;
        const bonuses = observeBonuses(actor.stats.willpower);
        actor.accuracyBonus += bonuses.accuracy;
        actor.dodgeBonus += bonuses.dodge;
        if (!observed.weakPointDiscovered && rng.chance(bonuses.weakPointChance)) {
          observed.weakPointDiscovered = true;
          log(next, `${label} spots a weak point on ${observed.name}.`);
        }
        log(
          next,
          `${observed.name}: HP ${observed.hp}/${observed.maxHp}. Str ${observed.stats.strength}, Def ${observed.stats.defense}, Spd ${observed.stats.speed}. ${observed.nextActionHint ?? ""}`.trim(),
          `Willpower ${actor.stats.willpower} · +${bonuses.accuracy} accuracy, +${bonuses.dodge} dodge`,
        );
        break;
      }
      case "ITEM": {
        log(next, `${label} reaches for a useful item.`);
        break;
      }
      case "ESCAPE": {
        if (!next.canEscape) {
          log(next, next.unescapableReason ?? "There is nowhere to run.");
          break;
        }
        const navBonus = run ? CrewCombatService.navigatorEscapeBonus(next, run) : 0;
        const chances = escapeChances(
          actor.stats.speed,
          (enemy ?? primaryEnemy(next))?.stats.speed ?? 4,
          next.escapeAttempts,
          next.guaranteedEscape,
        );
        const total = Math.min(0.98, chances.total + navBonus);
        if (chances.guaranteed || rng.chance(total)) {
          next.finished = true;
          next.result = "ESCAPE";
          log(next, chances.guaranteed ? "The party vanishes into smoke and spray." : "You break away from the fight.");
          return next;
        }
        next.escapeAttempts += 1;
        log(next, "Escape fails. They cut you off. The next opening will be clearer.");
        break;
      }
      case "SURRENDER": {
        if (!next.canSurrender) {
          log(next, "They will not take a surrender.");
          break;
        }
        next.finished = true;
        next.result = "SURRENDER";
        log(next, "You throw down what you are holding. The fight is over, on their terms.");
        return next;
      }
      default:
        break;
    }

    finishIfNeeded(next);
    if (next.finished) {
      return next;
    }

    endPlayerTurn(next, run, rng);
    return next;
  },

  applyItemResult(
    state: CombatState,
    result: ItemUseResult,
    rng: RandomService,
    run?: RunState,
  ): CombatState {
    if (state.finished || !PartyCombatService.isPlayerTurn(state)) {
      return state;
    }
    const next: CombatState = structuredClone(state);
    next.lastHits = [];
    const actor = PartyCombatService.getActiveCombatant(next) ?? next.playerCombatant;
    if (result.hpHealed > 0) {
      actor.hp = clamp(actor.hp + result.hpHealed, 0, actor.maxHp);
      recordHit(next, actor, result.hpHealed, "HEAL");
    }
    log(next, result.message);
    if (result.guaranteeEscape) {
      next.guaranteedEscape = true;
      if (next.canEscape) {
        next.finished = true;
        next.result = "ESCAPE";
        log(next, "The smoke holds. You are gone.");
        return next;
      }
      log(next, "Smoke fills the space — but there is still no way out.");
    }
    if (result.freeAction) {
      return next;
    }
    endPlayerTurn(next, run, rng);
    return next;
  },

  useItem(state: CombatState, healAmount: number, itemName: string, rng: RandomService, run?: RunState): CombatState {
    return this.applyItemResult(
      state,
      {
        ok: true,
        message: `You use ${itemName} and recover ${healAmount} HP.`,
        consumed: true,
        freeAction: false,
        hpHealed: healAmount,
        guaranteeEscape: false,
        itemName,
      },
      rng,
      run,
    );
  },

  resolveEnemyTurn(state: CombatState, rng: RandomService, run?: RunState): CombatState {
    if (state.finished || state.activeSide !== "ENEMY") {
      return state;
    }
    const next: CombatState = structuredClone(state);
    PartyCombatService.resolveEnemyTurn(next, run ?? null, rng);
    finishIfNeeded(next);
    return next;
  },
};
