import {
  COMBAT_STATUS_DEFS,
  COMBAT_STATUS_KINDS,
  enemyOnHitStatus,
  isCombatStatusKind,
} from "../data/combatStatuses";
import type {
  AbilityEffectSpec,
  AfflictionKind,
  CombatState,
  CombatStatusKind,
  CombatantState,
  ItemEffect,
  RunState,
  StatusEffect,
} from "../models/types";
import { clamp } from "../utils/stats";
import { AfflictionService } from "./AfflictionService";
import type { RandomService } from "./RandomService";

function livingCombatants(state: CombatState): CombatantState[] {
  const allies: CombatantState[] = [];
  if (state.playerCombatant.participating !== false) {
    allies.push(state.playerCombatant);
  }
  if (state.party?.allyCombatants.length) {
    allies.push(...state.party.allyCombatants);
  }
  return [...allies, ...state.enemies].filter(
    (entry) => entry.hp > 0 && entry.condition !== "KNOCKED_OUT",
  );
}

function applyDamage(target: CombatantState, amount: number): number {
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
  return before - target.hp;
}

function recordHit(state: CombatState, target: CombatantState, amount: number, kind: "HIT" | "HEAL"): void {
  state.lastHits.push({
    id: `hit-status-${state.lastHits.length}-${target.id}`,
    combatantId: target.id,
    side: target.side,
    amount,
    kind,
  });
}

function recordDamageTaken(state: CombatState, combatantId: string, amount: number): void {
  const contrib = state.party?.contributions.find((entry) => entry.combatantId === combatantId);
  if (contrib && amount > 0) {
    contrib.damageTaken += amount;
  }
}

function pushLog(state: CombatState, text: string): void {
  state.log.push({
    id: `clog-${state.log.length}`,
    round: state.round,
    text,
  });
}

export const CombatStatusService = {
  kinds(): CombatStatusKind[] {
    return [...COMBAT_STATUS_KINDS];
  },

  def(kind: CombatStatusKind) {
    return COMBAT_STATUS_DEFS[kind];
  },

  chipTone(kind: CombatStatusKind | undefined): string | undefined {
    return kind ? COMBAT_STATUS_DEFS[kind].chipTone : undefined;
  },

  createEffect(kind: CombatStatusKind, maxHp: number, turns?: number): StatusEffect {
    const def = COMBAT_STATUS_DEFS[kind];
    return {
      id: kind.toLowerCase(),
      name: def.name,
      remainingTurns: turns ?? def.turns,
      kind: "DEBUFF",
      statusKind: kind,
      accuracyBonus: def.accuracyBonus,
      dodgeBonus: def.dodgeBonus,
      damageDealtMod: def.damageDealtMod,
      damageTakenMod: def.damageTakenMod,
      damagePerTurn: def.damagePctMaxHp
        ? Math.max(1, Math.round(maxHp * def.damagePctMaxHp))
        : undefined,
      skipTurn: def.skipTurn,
      skipChance: def.skipChance,
      randomizeTarget: def.randomizeTarget,
    };
  },

  fromSpec(spec: AbilityEffectSpec, maxHp: number): StatusEffect {
    if (spec.statusKind) {
      return this.createEffect(spec.statusKind, maxHp, spec.turns);
    }
    return {
      id: spec.id,
      name: spec.name,
      remainingTurns: spec.turns,
      kind: spec.kind,
      accuracyBonus: spec.accuracyBonus,
      dodgeBonus: spec.dodgeBonus,
      damageDealtMod: spec.damageDealtMod,
      damageTakenMod: spec.damageTakenMod,
      damagePerTurn: spec.damagePerTurn,
      skipTurn: spec.skipTurn,
      skipChance: spec.skipChance,
      randomizeTarget: spec.randomizeTarget,
    };
  },

  hasKind(combatant: CombatantState, kind: CombatStatusKind): boolean {
    return combatant.statusEffects.some((entry) => entry.statusKind === kind);
  },

  apply(
    state: CombatState,
    recipient: CombatantState,
    spec: AbilityEffectSpec,
    sourceLabel?: string,
  ): StatusEffect {
    const effect = this.fromSpec(spec, recipient.maxHp);
    recipient.statusEffects = recipient.statusEffects.filter((entry) =>
      effect.statusKind ? entry.statusKind !== effect.statusKind : entry.id !== effect.id,
    );
    recipient.statusEffects.push({ ...effect });
    const who = sourceLabel ? `${sourceLabel}: ` : "";
    pushLog(
      state,
      `${who}${effect.name} lands on ${recipient.name} (${effect.remainingTurns} turn${
        effect.remainingTurns === 1 ? "" : "s"
      }).`,
    );
    return effect;
  },

  applyKind(
    state: CombatState,
    recipient: CombatantState,
    kind: CombatStatusKind,
    sourceLabel?: string,
    turns?: number,
  ): StatusEffect {
    return this.apply(
      state,
      recipient,
      {
        id: kind.toLowerCase(),
        name: COMBAT_STATUS_DEFS[kind].name,
        kind: "DEBUFF",
        turns: turns ?? COMBAT_STATUS_DEFS[kind].turns,
        target: "TARGET",
        statusKind: kind,
      },
      sourceLabel,
    );
  },

  clearKinds(combatant: CombatantState, kinds: CombatStatusKind[]): string[] {
    const want = new Set(kinds);
    const removed = combatant.statusEffects.filter(
      (entry) => entry.statusKind && want.has(entry.statusKind),
    );
    if (!removed.length) {
      return [];
    }
    combatant.statusEffects = combatant.statusEffects.filter(
      (entry) => !entry.statusKind || !want.has(entry.statusKind),
    );
    return removed.map((entry) => entry.name);
  },

  clearAllNamed(combatant: CombatantState): string[] {
    return this.clearKinds(combatant, [...COMBAT_STATUS_KINDS]);
  },

  kindsClearedByItemEffects(effects: ItemEffect[]): CombatStatusKind[] {
    const collected = new Set<CombatStatusKind>();
    let clearAll = false;
    for (const effect of effects) {
      if (effect.type !== "CLEAR_AFFLICTION") {
        continue;
      }
      if (!effect.kinds?.length) {
        clearAll = true;
        break;
      }
      for (const kind of effect.kinds) {
        if (isCombatStatusKind(kind)) {
          collected.add(kind);
        }
      }
    }
    return clearAll ? [...COMBAT_STATUS_KINDS] : [...collected];
  },

  overworldKindsClearedByItemEffects(effects: ItemEffect[]): AfflictionKind[] {
    const collected = new Set<AfflictionKind>();
    let clearAll = false;
    for (const effect of effects) {
      if (effect.type !== "CLEAR_AFFLICTION") {
        continue;
      }
      if (!effect.kinds?.length) {
        clearAll = true;
        break;
      }
      for (const kind of effect.kinds) {
        if (kind === "POISON" || kind === "SICKNESS") {
          collected.add(kind);
        }
      }
    }
    return clearAll ? ["POISON", "SICKNESS"] : [...collected];
  },

  /** DoT + skip check. Duration still ticks separately after this returns. */
  beginTurn(state: CombatState, combatant: CombatantState, rng: RandomService): boolean {
    for (const effect of combatant.statusEffects) {
      const tick = effect.damagePerTurn ?? 0;
      if (tick <= 0 || combatant.hp <= 0) {
        continue;
      }
      const dealt = applyDamage(combatant, tick);
      if (dealt <= 0) {
        continue;
      }
      recordHit(state, combatant, dealt, "HIT");
      if (combatant.side === "PLAYER") {
        recordDamageTaken(state, combatant.id, dealt);
      }
      pushLog(state, `${effect.name} wracks ${combatant.name} for ${dealt} HP.`);
      if (combatant.hp <= 0) {
        pushLog(
          state,
          combatant.side === "PLAYER"
            ? `${combatant.name} collapses from ${effect.name.toLowerCase()}!`
            : `${combatant.name} goes down from ${effect.name.toLowerCase()}!`,
        );
      }
    }

    if (combatant.hp <= 0) {
      return true;
    }

    const stun = combatant.statusEffects.find((entry) => entry.skipTurn);
    if (stun) {
      pushLog(state, `${combatant.name} is stunned and loses the turn.`);
      return true;
    }
    const chancers = combatant.statusEffects.filter((entry) => (entry.skipChance ?? 0) > 0);
    for (const effect of chancers) {
      if (rng.chance(effect.skipChance ?? 0)) {
        const verb = effect.statusKind === "PANIC" ? "panics and freezes" : "is too dazed to act";
        pushLog(state, `${combatant.name} ${verb}.`);
        return true;
      }
    }
    return false;
  },

  randomizesTarget(combatant: CombatantState): boolean {
    return combatant.statusEffects.some((entry) => entry.randomizeTarget);
  },

  pickConfusedTarget(
    state: CombatState,
    actor: CombatantState,
    rng: RandomService,
  ): CombatantState | undefined {
    const pool = livingCombatants(state);
    if (!pool.length) {
      return undefined;
    }
    return rng.pick(pool);
  },

  tryInflictOnHit(
    state: CombatState,
    attacker: CombatantState,
    target: CombatantState,
    isHeavy: boolean,
    rng: RandomService,
  ): void {
    if (state.isFriendly) {
      return;
    }
    const spec = enemyOnHitStatus(attacker.enemyFamily, attacker.enemyRole, isHeavy);
    if (!spec || !rng.chance(spec.chance)) {
      return;
    }
    this.applyKind(state, target, spec.kind, attacker.name);
  },

  seedFromAfflictions(run: RunState, state: CombatState): void {
    const applyIfPoisoned = (characterId: string, combatant: CombatantState | undefined) => {
      if (!combatant) {
        return;
      }
      const poisoned = AfflictionService.list(run, characterId).some((entry) => entry.kind === "POISON");
      if (!poisoned || this.hasKind(combatant, "POISON")) {
        return;
      }
      this.applyKind(state, combatant, "POISON", undefined, 3);
    };
    applyIfPoisoned("player", state.playerCombatant);
    for (const ally of state.party?.allyCombatants ?? []) {
      applyIfPoisoned(ally.id, ally);
    }
  },
};
