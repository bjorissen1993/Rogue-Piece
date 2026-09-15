import { getAbilitiesForCrewmember, getAbilitiesForPlayer } from "../data/abilities";
import { DevilFruitCombatService } from "./DevilFruitCombatService";
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
  resolveAbilityPower,
  resolveAbilityPowerLevel,
  rollCombatResult,
  statsFromStrength,
  techniqueHealAmount,
  computeHitChance,
} from "./CombatCalculationService";
import { CrewCombatService } from "./CrewCombatService";
import { PartyCombatService } from "./PartyCombatService";
import { WorldCombatProgressionService } from "./WorldCombatProgressionService";
import { inferEnemyFamily, inferEnemyRole } from "./EncounterCompositionService";
import {
  TargetResolutionService,
  abilityTechniqueEffects,
} from "./TargetResolutionService";
import type { RandomService } from "./RandomService";
import { escapeChances, isUnescapableRequest, threatLevelFor } from "./ThreatService";
import type { ItemUseResult } from "./ItemService";
import type { AbilityEffectSpec } from "../models/types";

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
  const before = target.hp;
  const raw = before - amount;
  if (raw < 0) {
    target.overkillDamage = (target.overkillDamage ?? 0) + Math.abs(raw);
  }
  target.hp = clamp(raw, 0, target.maxHp);
  if (target.hp <= 0) {
    target.condition = "KNOCKED_OUT";
    target.defending = false;
  }
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
    techniquePowerLevel?: number;
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
    techniquePowerLevel: options.techniquePowerLevel,
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
  if (defender.hp <= 0 && defender.condition === "KNOCKED_OUT") {
    const label =
      defender.side === "PLAYER"
        ? `${defender.name} is knocked out!`
        : `${defender.name} goes down!`;
    log(state, label);
  }

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

function applyStatusSpec(
  state: CombatState,
  _actor: CombatantState,
  recipients: CombatantState[],
  spec: AbilityEffectSpec,
  abilityName: string,
  label: string,
): void {
  const effect = {
    id: spec.id,
    name: spec.name,
    remainingTurns: spec.turns,
    kind: spec.kind,
    accuracyBonus: spec.accuracyBonus,
    dodgeBonus: spec.dodgeBonus,
    damageDealtMod: spec.damageDealtMod,
    damageTakenMod: spec.damageTakenMod,
  };
  for (const recipient of recipients) {
    recipient.statusEffects = recipient.statusEffects.filter((entry) => entry.id !== effect.id);
    recipient.statusEffects.push({ ...effect });
    log(
      state,
      `${label}'s ${abilityName} applies ${effect.name} to ${recipient.name} (${effect.remainingTurns} turns).`,
    );
  }
}

function observeRevealText(actor: CombatantState, observed: CombatantState): { body: string; detail: string } {
  const intel = actor.stats.intelligence ?? 1;
  const will = actor.stats.willpower ?? 1;
  const bonuses = observeBonuses(will);
  let body = `${observed.name}: HP ${observed.hp}/${observed.maxHp}.`;
  if (intel <= 3) {
    const defBand =
      observed.stats.defense >= 10 ? "High" : observed.stats.defense >= 6 ? "Moderate" : "Low";
    body += ` Defense: ${defBand}.`;
  } else if (intel <= 7) {
    body += ` Str ${observed.stats.strength}, Def ${observed.stats.defense}, Spd ${observed.stats.speed}.`;
  } else {
    body += ` Str ${observed.stats.strength}, Def ${observed.stats.defense}, Spd ${observed.stats.speed}, Will ${observed.stats.willpower}, Int ${observed.stats.intelligence ?? "?"}.`;
    if (observed.weakPointDiscovered) {
      body += " Weakness: exposed guard — heavy strikes punish.";
    } else if (intel >= 10) {
      body += " Suspected low stagger resistance.";
    }
  }
  if (observed.nextActionHint) {
    body += ` ${observed.nextActionHint}`;
  }
  return {
    body: body.trim(),
    detail: `Intelligence ${intel} · Willpower ${will} · +${bonuses.accuracy} accuracy, +${bonuses.dodge} dodge`,
  };
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
  maxHp?: number;
  stats: CombatantState["stats"];
  abilities: Ability[];
  mp?: number;
  maxMp?: number;
  formation?: CombatantState["formation"];
  level?: number;
  participating?: boolean;
  enemyRole?: CombatantState["enemyRole"];
  enemyFamily?: CombatantState["enemyFamily"];
}): CombatantState {
  const maxHp = Math.max(1, options.maxHp ?? options.hp);
  return {
    id: options.id,
    name: options.name,
    side: options.side,
    hp: clamp(options.hp, 0, maxHp),
    maxHp,
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
    level: options.level ?? 1,
    participating: options.participating,
    condition: "ACTIVE",
    overkillDamage: 0,
    enemyRole: options.enemyRole,
    enemyFamily: options.enemyFamily,
  };
}

export const CombatEngine = {
  skillCheck(statValue: number, difficulty: number, rng: RandomService): boolean {
    return statValue + rng.roll(6) >= difficulty;
  },

  /** Keep captain combat HP pool aligned with the run player (max HP can rise via levels/items). */
  syncCaptainVitals(combat: CombatState, player: Player, run?: RunState): void {
    const captain = combat.playerCombatant;
    const maxHp = Math.max(1, player.maxHp);
    if (captain.maxHp !== maxHp) {
      captain.maxHp = maxHp;
      captain.hp = clamp(captain.hp, 0, maxHp);
    }
    const maxMp = MpService.maxMpFor(player);
    if (captain.maxMp !== maxMp) {
      captain.maxMp = maxMp;
      captain.mp = clamp(captain.mp ?? 0, 0, maxMp);
    }
    captain.stats = DevilFruitCombatService.effectiveStats(player);
    captain.abilities = getAbilitiesForPlayer(player);

    // Refresh crew technique lists mid-fight (weapon gating / loadout).
    if (run && combat.party?.allyCombatants) {
      for (const ally of combat.party.allyCombatants) {
        ally.abilities = getAbilitiesForCrewmember(run, ally.id);
      }
    }
  },

  createFromRequest(
    player: Player,
    request: CombatRequest,
    rng: RandomService,
    run?: RunState,
  ): CombatState {
    const battleFormat = WorldCombatProgressionService.resolveBattleFormat(request);
    const enemyFamily = request.enemyFamily ?? inferEnemyFamily(request.enemyName);
    const enemyRole = inferEnemyRole(request.enemyName, request.combatKind, request.enemyRole);
    const enemyStats = statsFromStrength(request.enemyStrength);
    const enemyHp = request.enemyHp ?? 22 + request.enemyStrength * 5;
    const enemy = createCombatant({
      id: createId("foe"),
      name: request.enemyName,
      side: "ENEMY",
      hp: enemyHp,
      stats: enemyStats,
      abilities: [],
      level: Math.max(1, Math.round(request.enemyStrength / 2)),
      enemyRole,
      enemyFamily,
    });
    pickEnemyIntent(enemy, rng);
    enemy.nextActionHint = hintFor(enemy.intendedAction);

    const extras = run
      ? WorldCombatProgressionService.additionalEnemies(run, request, rng)
      : (request.extraEnemies ?? []).map((entry, index) => ({
          name: entry.name,
          strength: entry.strength,
          hp: entry.hp ?? Math.max(10, Math.round(enemyHp * 0.55)),
          formation: entry.formation ?? (index === 0 ? "FRONT" : ("BACK" as const)),
          enemyRole: entry.enemyRole ?? ("SUPPORT" as const),
          enemyFamily: entry.enemyFamily ?? enemyFamily,
        }));
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
        level: Math.max(1, Math.round(strength / 2)),
        enemyRole: spec.enemyRole ?? "SUPPORT",
        enemyFamily: spec.enemyFamily ?? enemyFamily,
      });
      pickEnemyIntent(extra, rng);
      extra.nextActionHint = hintFor(extra.intendedAction);
      return extra;
    });
    enemy.formation = extraCombatants.length ? "FRONT" : "FRONT";

    const combatKind = request.combatKind ?? "NORMAL";
    const unescapable = isUnescapableRequest(request);
    const canEscape = request.isFriendly ? false : unescapable ? false : request.canEscape !== false;
    const threatLevel = threatLevelFor(player, request);
    const canSurrender = request.isFriendly
      ? false
      : (request.canSurrender ??
        (combatKind !== "BOSS" &&
          combatKind !== "DUEL" &&
          combatKind !== "SPARRING" &&
          (threatLevel === "DANGEROUS" || threatLevel === "DEADLY")));

    const playerMaxMp = MpService.maxMpFor(player);
    MpService.ensurePlayer(player);

    const state: CombatState = {
      round: 1,
      playerCombatant: createCombatant({
        id: player.id,
        name: player.name,
        side: "PLAYER",
        hp: player.hp,
        maxHp: player.maxHp,
        stats: DevilFruitCombatService.effectiveStats(player),
        abilities: getAbilitiesForPlayer(player),
        mp: player.mp ?? playerMaxMp,
        maxMp: playerMaxMp,
        level: player.progression?.level ?? 1,
        participating: true,
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
      battleFormat,
      isFriendly: Boolean(request.isFriendly || combatKind === "SPARRING"),
      wager: request.wager ?? null,
      opponentCharacterId: request.opponentCharacterId ?? null,
      sparKey: request.sparKey ?? null,
    };

    if (run) {
      const party = CrewCombatService.initCombatParty(run, state, {
        participantIds: request.participantIds,
        forcedParticipantIds: request.forcedParticipantIds,
        lockParticipants: request.lockParticipants ?? battleFormat.playerChoosesParticipants,
        maxPlayerFighters: battleFormat.maxPlayerFighters,
        allowCaptainSitOut: battleFormat.allowCaptainSitOut,
      });
      const supportLines = CrewCombatService.triggerSupportAbilities(state, run, "COMBAT_START", rng);
      for (const line of supportLines) {
        log(state, line);
      }
      const activeNames = [
        state.playerCombatant.participating === false ? null : state.playerCombatant.name,
        ...party.allyCombatants.map((entry) => entry.name),
      ].filter(Boolean);
      if (activeNames.length) {
        log(state, `Active party: ${activeNames.join(", ")}.`);
      }
      PartyCombatService.initTurnOrder(state, run, rng);
    } else {
      PartyCombatService.initTurnOrder(state, null, rng);
    }

    const names = [enemy, ...extraCombatants].map((entry) => entry.name).join(", ");
    if (enemyRole === "BOSS") {
      log(state, `BOSS ENCOUNTER — ${enemy.name} dominates the field.`);
    } else {
      log(state, `${names} block your path.`);
    }
    log(state, battleFormat.label);
    if (!canEscape && !state.isFriendly) {
      log(state, state.unescapableReason ?? "Escape is not an option.");
    }
    if (state.isFriendly) {
      log(state, "Friendly match — no lethal consequences.");
    }
    if (state.wager && state.wager.type !== "NONE") {
      log(state, `Stakes: ${state.wager.label}`);
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

        const usability = TargetResolutionService.canUseAbility(next, actor, ability);
        if (!usability.ok) {
          log(next, `${label} cannot use ${ability.name}: ${usability.reason ?? "invalid targets"}.`);
          break;
        }

        actor.mp = Math.max(0, (actor.mp ?? 0) - mpCost);
        if (next.party) {
          const contrib = next.party.contributions.find((entry) => entry.combatantId === actor.id);
          if (contrib) {
            contrib.mpSpent = (contrib.mpSpent ?? 0) + mpCost;
          }
        }

        const powerLevel = resolveAbilityPowerLevel(ability);
        const power = resolveAbilityPower(ability);
        const scale = actor.stats[ability.scalingStat] ?? 0;
        const selectedIds =
          action.targetIds?.length
            ? action.targetIds
            : action.targetId
              ? [action.targetId]
              : [];
        const hitTargets: CombatantState[] = [];
        let anyResolved = false;

        for (const effect of abilityTechniqueEffects(ability)) {
          const resolution = TargetResolutionService.resolve({
            state: next,
            actor,
            targeting: effect.targeting,
            selectedIds,
            rng,
            damageMult: effect.damageMult ?? 1,
          });
          if (!resolution.ok) {
            log(next, `${label}'s ${ability.name} fails: ${resolution.reason ?? "no targets"}.`);
            continue;
          }
          anyResolved = true;

          if (effect.kind === "DAMAGE") {
            for (const hit of resolution.hits) {
              const target = PartyCombatService.getCombatant(next, hit.targetId);
              if (!target || target.hp <= 0) {
                continue;
              }
              const result = resolveAttack(next, actor, target, rng, {
                // Power level is accuracy-only; damage bonus is scalingStat (+ legacy flat power).
                powerBonus: Math.round((power + scale) * hit.damageMult),
                accuracyMod: ability.accuracyMod,
                techniquePowerLevel: powerLevel,
                attackerLabel: label,
                defenderLabel: target.name,
                techniqueName: `${ability.name} lands (${mpCost} MP)`,
              });
              if (result.hit) {
                hitTargets.push(target);
                const status = effect.statusEffect ?? effect.applyEffect;
                if (status && (effect.statusChance == null || rng.chance(effect.statusChance))) {
                  applyStatusSpec(next, actor, [target], status, ability.name, label);
                }
              }
            }
          } else if (effect.kind === "HEAL") {
            log(next, `${label} uses ${ability.name} (${mpCost} MP).`);
            for (const targetId of resolution.targetIds) {
              const target = PartyCombatService.getCombatant(next, targetId);
              if (!target || target.condition === "KNOCKED_OUT" || target.hp <= 0) {
                continue;
              }
              const base =
                effect.healAmount ??
                Math.round(target.maxHp * (effect.healMaxHpFraction ?? 0.2));
              const amount = techniqueHealAmount(base, actor.stats, ability.scalingStat);
              const before = target.hp;
              target.hp = clamp(target.hp + amount, 0, target.maxHp);
              const healed = target.hp - before;
              if (healed > 0) {
                next.lastHits.push({
                  id: createId("hit"),
                  combatantId: target.id,
                  side: target.side,
                  amount: healed,
                  kind: "HEAL",
                });
                log(next, `${target.name} recovers ${healed} HP.`);
              }
              hitTargets.push(target);
            }
          } else if (effect.kind === "BUFF" || effect.kind === "DEBUFF" || effect.kind === "UTILITY") {
            log(next, `${label} uses ${ability.name} (${mpCost} MP).`);
            const recipients = resolution.targetIds
              .map((id) => PartyCombatService.getCombatant(next, id))
              .filter((entry): entry is CombatantState => Boolean(entry));
            const status = effect.applyEffect ?? effect.statusEffect ?? ability.applyEffect;
            const applied: CombatantState[] = [];
            for (const recipient of recipients) {
              const needsHitCheck =
                effect.kind === "DEBUFF" &&
                recipient.side !== actor.side &&
                recipient.id !== actor.id;
              if (needsHitCheck) {
                const hit = computeHitChance(actor, recipient, ability.accuracyMod ?? 0, powerLevel);
                if (!rng.chance(hit.combined)) {
                  recordHit(next, recipient, 0, "MISS");
                  log(next, `${label}'s ${ability.name} misses ${recipient.name}.`);
                  continue;
                }
              }
              if (status) {
                applyStatusSpec(next, actor, [recipient], status, ability.name, label);
              }
              applied.push(recipient);
            }
            hitTargets.push(...applied);
          }
        }

        if (!anyResolved) {
          // Refund MP if nothing happened
          actor.mp = Math.min(actor.maxMp ?? actor.mp ?? 0, (actor.mp ?? 0) + mpCost);
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
        const intel = actor.stats.intelligence ?? 1;
        const weakChance = clamp(bonuses.weakPointChance + intel * 0.015, 0.25, 0.85);
        if (!observed.weakPointDiscovered && rng.chance(weakChance)) {
          observed.weakPointDiscovered = true;
          log(next, `${label} spots a weak point on ${observed.name}.`);
        }
        const reveal = observeRevealText(actor, observed);
        log(next, reveal.body, reveal.detail);
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
    targetCombatantId?: string,
  ): CombatState {
    if (state.finished || !PartyCombatService.isPlayerTurn(state)) {
      return state;
    }
    const next: CombatState = structuredClone(state);
    next.lastHits = [];
    const target =
      (targetCombatantId
        ? PartyCombatService.allAllies(next).find((ally) => ally.id === targetCombatantId)
        : null) ??
      PartyCombatService.getActiveCombatant(next) ??
      next.playerCombatant;
    if (result.hpHealed > 0) {
      target.hp = clamp(target.hp + result.hpHealed, 0, target.maxHp);
      recordHit(next, target, result.hpHealed, "HEAL");
    }
    if (result.mpRestored > 0) {
      const maxMp = target.maxMp ?? 0;
      target.mp = clamp((target.mp ?? 0) + result.mpRestored, 0, maxMp);
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
        mpRestored: 0,
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
