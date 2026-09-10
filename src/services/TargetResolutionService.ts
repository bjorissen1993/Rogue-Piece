import type {
  Ability,
  CombatState,
  CombatantState,
  TargetingSpec,
  TechniqueEffect,
  TechniqueEffectKind,
} from "../models/types";
import type { RandomService } from "./RandomService";
import { PartyCombatService } from "./PartyCombatService";

export type ResolvedHit = {
  targetId: string;
  damageMult: number;
  isPrimary?: boolean;
};

export type TargetResolution = {
  ok: boolean;
  reason?: string;
  /** Unique affected combatants (for highlight / buffs). */
  targetIds: string[];
  /** Ordered hit resolutions (multi-hit / splash / chain). */
  hits: ResolvedHit[];
};

function living(list: CombatantState[]): CombatantState[] {
  return list.filter((entry) => entry.hp > 0);
}

function poolForGroup(
  state: CombatState,
  actor: CombatantState,
  targeting: TargetingSpec,
): CombatantState[] {
  if (targeting.group === "SELF") {
    return [actor];
  }
  if (targeting.group === "ENEMY") {
    const enemies =
      actor.side === "PLAYER"
        ? state.enemies
        : PartyCombatService.allAllies(state);
    return applyFormation(enemies, targeting);
  }
  if (targeting.group === "OTHER_ALLY") {
    const allies =
      actor.side === "PLAYER"
        ? PartyCombatService.allAllies(state).filter((ally) => ally.id !== actor.id)
        : state.enemies.filter((enemy) => enemy.id !== actor.id);
    return applyFormation(allies, targeting);
  }
  // ALLY
  const allies =
    actor.side === "PLAYER" ? PartyCombatService.allAllies(state) : state.enemies;
  const withSelf =
    targeting.includeSelf === false
      ? allies.filter((ally) => ally.id !== actor.id)
      : allies;
  return applyFormation(withSelf, targeting);
}

function applyFormation(list: CombatantState[], targeting: TargetingSpec): CombatantState[] {
  if (!targeting.formation || targeting.formation === "ANY") {
    return list;
  }
  const filtered = list.filter((entry) => (entry.formation ?? "FRONT") === targeting.formation);
  // If nobody is tagged for that row, fall back so content still works.
  return filtered.length ? filtered : list;
}

function applyConditions(
  pool: CombatantState[],
  targeting: TargetingSpec,
): CombatantState[] {
  const conditions = targeting.conditions ?? [{ type: "LIVING" }];
  let next = [...pool];
  for (const condition of conditions) {
    if (condition.type === "LIVING") {
      next = living(next);
    } else if (condition.type === "KO") {
      next = next.filter((entry) => entry.hp <= 0);
    } else if (condition.type === "INJURED") {
      next = living(next).filter((entry) => entry.hp < entry.maxHp);
    } else if (condition.type === "LOWEST_HP") {
      const alive = living(next);
      if (!alive.length) {
        next = [];
        continue;
      }
      const min = Math.min(...alive.map((entry) => entry.hp));
      next = alive.filter((entry) => entry.hp === min);
    } else if (condition.type === "HIGHEST_HP") {
      const alive = living(next);
      if (!alive.length) {
        next = [];
        continue;
      }
      const max = Math.max(...alive.map((entry) => entry.hp));
      next = alive.filter((entry) => entry.hp === max);
    } else if (condition.type === "HIGHEST_MAX_HP") {
      const alive = living(next);
      if (!alive.length) {
        next = [];
        continue;
      }
      const max = Math.max(...alive.map((entry) => entry.maxHp));
      next = alive.filter((entry) => entry.maxHp === max);
    } else if (condition.type === "MOST_INJURED") {
      const alive = living(next);
      if (!alive.length) {
        next = [];
        continue;
      }
      const ratios = alive.map((entry) => entry.hp / Math.max(1, entry.maxHp));
      const min = Math.min(...ratios);
      next = alive.filter((entry) => entry.hp / Math.max(1, entry.maxHp) === min);
    } else if (condition.type === "HIGHEST_STAT") {
      const alive = living(next);
      if (!alive.length) {
        next = [];
        continue;
      }
      const max = Math.max(...alive.map((entry) => entry.stats[condition.stat]));
      next = alive.filter((entry) => entry.stats[condition.stat] === max);
    } else if (condition.type === "LOWEST_STAT") {
      const alive = living(next);
      if (!alive.length) {
        next = [];
        continue;
      }
      const min = Math.min(...alive.map((entry) => entry.stats[condition.stat]));
      next = alive.filter((entry) => entry.stats[condition.stat] === min);
    }
  }
  return next;
}

function pickRandomUnique(
  pool: CombatantState[],
  count: number,
  rng: RandomService,
): CombatantState[] {
  const bag = [...pool];
  const picked: CombatantState[] = [];
  while (picked.length < count && bag.length) {
    const index = rng.nextInt(0, bag.length - 1);
    picked.push(bag[index]!);
    bag.splice(index, 1);
  }
  return picked;
}

function adjacentEnemies(state: CombatState, primaryId: string): CombatantState[] {
  const livingList = living(state.enemies);
  const index = livingList.findIndex((entry) => entry.id === primaryId);
  if (index < 0) {
    return [];
  }
  const neighbors: CombatantState[] = [];
  if (index > 0) {
    neighbors.push(livingList[index - 1]!);
  }
  if (index < livingList.length - 1) {
    neighbors.push(livingList[index + 1]!);
  }
  return neighbors;
}

function defaultChainMult(jumps: number): number[] {
  const mults = [1];
  let current = 0.75;
  for (let i = 0; i < jumps; i += 1) {
    mults.push(current);
    current = Math.max(0.25, current - 0.25);
  }
  return mults;
}

export function legacyTargetingFromAbility(ability: Ability): TargetingSpec {
  if (ability.targeting) {
    return ability.targeting;
  }
  const tags = ability.tags ?? [];
  if (ability.applyEffect?.target === "SELF" || tags.includes("DEFENSIVE")) {
    if (!tags.includes("MELEE") && !tags.includes("RANGED") && !tags.includes("AOE")) {
      return { group: "SELF", selection: "SELF" };
    }
  }
  if (tags.includes("AOE")) {
    return {
      group: "ENEMY",
      selection: "ALL",
      whenInsufficient: "REDUCE",
    };
  }
  if (tags.includes("ALLY") && (tags.includes("BUFF") || tags.includes("HEAL"))) {
    return {
      group: "ALLY",
      selection: "MANUAL",
      exactCount: 1,
      includeSelf: true,
      whenInsufficient: "DISABLE",
    };
  }
  return {
    group: "ENEMY",
    selection: "MANUAL",
    exactCount: 1,
    whenInsufficient: "DISABLE",
  };
}

export function abilityTechniqueEffects(ability: Ability): TechniqueEffect[] {
  if (ability.techniqueEffects?.length) {
    return ability.techniqueEffects;
  }
  const tags = ability.tags ?? [];
  const offense =
    tags.includes("MELEE") ||
    tags.includes("RANGED") ||
    tags.includes("AOE") ||
    tags.includes("MULTI_HIT") ||
    tags.includes("SINGLE");
  const supportOnly =
    (tags.includes("BUFF") || tags.includes("DEFENSIVE") || tags.includes("HEAL")) && !offense;

  const effects: TechniqueEffect[] = [];
  const offenseTargeting = legacyTargetingFromAbility({
    ...ability,
    applyEffect:
      ability.applyEffect?.target === "SELF" ? undefined : ability.applyEffect,
  });

  if (!supportOnly && offense) {
    const onTarget =
      ability.applyEffect && ability.applyEffect.target === "TARGET"
        ? ability.applyEffect
        : undefined;
    effects.push({
      id: `${ability.id}_damage`,
      kind: "DAMAGE",
      targeting: offenseTargeting.group === "SELF"
        ? { group: "ENEMY", selection: "MANUAL", exactCount: 1 }
        : offenseTargeting,
      damageMult: 1,
      applyEffect: onTarget,
      statusChance: onTarget ? 1 : undefined,
    });
  }

  if (ability.applyEffect?.target === "SELF") {
    effects.push({
      id: `${ability.id}_self`,
      kind: ability.applyEffect.kind === "DEBUFF" ? "DEBUFF" : "BUFF",
      targeting: { group: "SELF", selection: "SELF" },
      applyEffect: ability.applyEffect,
    });
  } else if (supportOnly) {
    let kind: TechniqueEffectKind = "BUFF";
    if (tags.includes("HEAL") || ability.animationType === "HEAL") {
      kind = "HEAL";
    } else if (ability.applyEffect?.kind === "DEBUFF") {
      kind = "DEBUFF";
    }
    effects.push({
      id: `${ability.id}_support`,
      kind,
      targeting: legacyTargetingFromAbility(ability),
      applyEffect: ability.applyEffect,
      healAmount: kind === "HEAL" ? Math.max(8, ability.power * 2) : undefined,
    });
  } else if (
    ability.applyEffect &&
    (ability.applyEffect.target === "ALL_ENEMIES" || ability.applyEffect.target === "ALL_ALLIES")
  ) {
    effects.push({
      id: `${ability.id}_aura`,
      kind: ability.applyEffect.kind === "DEBUFF" ? "DEBUFF" : "BUFF",
      targeting:
        ability.applyEffect.target === "ALL_ENEMIES"
          ? { group: "ENEMY", selection: "ALL" }
          : { group: "ALLY", selection: "ALL", includeSelf: true },
      applyEffect: ability.applyEffect,
    });
  }

  if (!effects.length) {
    effects.push({
      id: `${ability.id}_primary`,
      kind: "DAMAGE",
      targeting: { group: "ENEMY", selection: "MANUAL", exactCount: 1 },
      damageMult: 1,
    });
  }
  return effects;
}

export function targetingSummary(targeting: TargetingSpec): string {
  if (targeting.selection === "SELF" || targeting.group === "SELF") {
    return "Target: Self";
  }
  const group =
    targeting.group === "ENEMY"
      ? "Enemies"
      : targeting.group === "OTHER_ALLY"
        ? "Other Allies"
        : "Allies";
  const singular =
    targeting.group === "ENEMY"
      ? "Enemy"
      : targeting.group === "OTHER_ALLY"
        ? "Other Ally"
        : "Ally";
  if (targeting.selection === "ALL") {
    const row =
      targeting.formation === "FRONT"
        ? " Frontline"
        : targeting.formation === "BACK"
          ? " Backline"
          : "";
    return `Targets: All${row} ${group}`;
  }
  if (targeting.hitCount && targeting.retargetEachHit) {
    const repeats = targeting.allowRepeatedTargets ? "Repeats allowed" : "No repeated targets";
    return `Hits: ${targeting.hitCount} · Random ${singular} per Hit · ${repeats}`;
  }
  if (targeting.selection === "RANDOM") {
    const count = targeting.exactCount ?? targeting.maxCount ?? 1;
    const unique = targeting.allowRepeatedTargets ? "" : " Different";
    return `Targets: ${count} Random${unique} ${group}`;
  }
  if (targeting.selection === "AUTO") {
    const cond = targeting.conditions?.find((entry) => entry.type === "LOWEST_HP");
    if (cond) {
      return `Target: Lowest HP ${singular} · Automatic`;
    }
    return `Targets: Automatic ${group}`;
  }
  if (targeting.exactCount != null) {
    return targeting.exactCount === 1
      ? `Target: Choose 1 ${singular}`
      : `Targets: Choose ${targeting.exactCount} Different ${group}`;
  }
  if (targeting.maxCount != null) {
    const min = targeting.minCount ?? 1;
    return `Targets: Up to ${targeting.maxCount} ${group} (min ${min})`;
  }
  return `Target: Choose 1 ${singular}`;
}

export function abilityNeedsManualTarget(ability: Ability): boolean {
  return abilityTechniqueEffects(ability).some(
    (effect) => effect.targeting.selection === "MANUAL",
  );
}

export function primaryManualTargeting(ability: Ability): TargetingSpec | null {
  const effect = abilityTechniqueEffects(ability).find(
    (entry) => entry.targeting.selection === "MANUAL",
  );
  return effect?.targeting ?? null;
}

export function canUseAbility(
  state: CombatState,
  actor: CombatantState,
  ability: Ability,
): { ok: boolean; reason?: string } {
  for (const effect of abilityTechniqueEffects(ability)) {
    const pool = applyConditions(poolForGroup(state, actor, effect.targeting), effect.targeting);
    const needed =
      effect.targeting.exactCount ??
      effect.targeting.minCount ??
      (effect.targeting.selection === "MANUAL" ? 1 : 0);
    const mode = effect.targeting.whenInsufficient ??
      (effect.targeting.selection === "MANUAL" && effect.targeting.exactCount != null
        ? "DISABLE"
        : "REDUCE");
    if (needed > 0 && pool.length < needed && mode === "DISABLE") {
      return { ok: false, reason: `Needs ${needed} valid targets` };
    }
  }
  return { ok: true };
}

export const TargetResolutionService = {
  legacyTargetingFromAbility,
  abilityTechniqueEffects,
  targetingSummary,
  abilityNeedsManualTarget,
  primaryManualTargeting,
  canUseAbility,

  resolve(options: {
    state: CombatState;
    actor: CombatantState;
    targeting: TargetingSpec;
    selectedIds?: string[];
    rng: RandomService;
    damageMult?: number;
  }): TargetResolution {
    const { state, actor, targeting, rng } = options;
    const baseMult = options.damageMult ?? 1;
    const selectedIds = options.selectedIds ?? [];
    const pool = applyConditions(poolForGroup(state, actor, targeting), targeting);

    if (targeting.selection === "SELF" || targeting.group === "SELF") {
      return {
        ok: true,
        targetIds: [actor.id],
        hits: [{ targetId: actor.id, damageMult: baseMult, isPrimary: true }],
      };
    }

    const exact = targeting.exactCount;
    const max = targeting.maxCount ?? exact ?? 1;
    const min = targeting.minCount ?? (exact ?? 1);
    const insufficientMode =
      targeting.whenInsufficient ??
      (targeting.selection === "MANUAL" && exact != null ? "DISABLE" : "REDUCE");

    if (targeting.selection === "ALL") {
      if (!pool.length) {
        return { ok: false, reason: "No valid targets.", targetIds: [], hits: [] };
      }
      return {
        ok: true,
        targetIds: pool.map((entry) => entry.id),
        hits: pool.map((entry, index) => ({
          targetId: entry.id,
          damageMult: baseMult,
          isPrimary: index === 0,
        })),
      };
    }

    if (targeting.hitCount && targeting.retargetEachHit) {
      if (!pool.length) {
        return { ok: false, reason: "No valid targets.", targetIds: [], hits: [] };
      }
      const hits: ResolvedHit[] = [];
      const used = new Set<string>();
      for (let i = 0; i < targeting.hitCount; i += 1) {
        let bag = pool;
        if (!targeting.allowRepeatedTargets) {
          bag = pool.filter((entry) => !used.has(entry.id));
          if (!bag.length) {
            bag = pool;
          }
        }
        const pick = bag[rng.nextInt(0, bag.length - 1)]!;
        used.add(pick.id);
        hits.push({ targetId: pick.id, damageMult: baseMult, isPrimary: i === 0 });
      }
      return {
        ok: true,
        targetIds: [...new Set(hits.map((hit) => hit.targetId))],
        hits,
      };
    }

    if (targeting.selection === "AUTO") {
      const count = exact ?? max;
      const mode = insufficientMode;
      if (pool.length < (targeting.minCount ?? 1) && mode === "DISABLE") {
        return { ok: false, reason: "No valid automatic targets.", targetIds: [], hits: [] };
      }
      const take = Math.min(count, pool.length);
      // Prefer already-conditioned pool order; for LOWEST_HP etc. pool may be tied — take sorted.
      const sorted = [...pool].sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
      const picked = sorted.slice(0, take);
      return {
        ok: true,
        targetIds: picked.map((entry) => entry.id),
        hits: picked.map((entry, index) => ({
          targetId: entry.id,
          damageMult: baseMult,
          isPrimary: index === 0,
        })),
      };
    }

    if (targeting.selection === "RANDOM") {
      const want = exact ?? max;
      if (pool.length < min && insufficientMode === "DISABLE") {
        return {
          ok: false,
          reason: `Needs ${min} targets.`,
          targetIds: [],
          hits: [],
        };
      }
      const take = Math.min(want, pool.length);
      const picked = targeting.allowRepeatedTargets
        ? Array.from({ length: take }, () => pool[rng.nextInt(0, pool.length - 1)]!)
        : pickRandomUnique(pool, take, rng);
      return {
        ok: true,
        targetIds: [...new Set(picked.map((entry) => entry.id))],
        hits: picked.map((entry, index) => ({
          targetId: entry.id,
          damageMult: baseMult,
          isPrimary: index === 0,
        })),
      };
    }

    // MANUAL
    const uniqueSelected = [...new Set(selectedIds)].filter((id) =>
      pool.some((entry) => entry.id === id),
    );
    if (exact != null) {
      if (uniqueSelected.length !== exact) {
        if (uniqueSelected.length < exact && insufficientMode === "REDUCE" && uniqueSelected.length >= min) {
          // allow reduced
        } else if (pool.length < exact && insufficientMode === "DISABLE") {
          return { ok: false, reason: `Needs ${exact} targets.`, targetIds: [], hits: [] };
        } else if (uniqueSelected.length !== exact) {
          return {
            ok: false,
            reason: `Select ${exact} target${exact === 1 ? "" : "s"}.`,
            targetIds: [],
            hits: [],
          };
        }
      }
    } else {
      if (uniqueSelected.length < min || uniqueSelected.length > max) {
        return {
          ok: false,
          reason: `Select ${min}–${max} targets.`,
          targetIds: [],
          hits: [],
        };
      }
    }

    const primaryId = uniqueSelected[0];
    const hits: ResolvedHit[] = uniqueSelected.map((id, index) => ({
      targetId: id,
      damageMult: baseMult,
      isPrimary: index === 0,
    }));

    if (targeting.chainJumps && primaryId) {
      const mults = targeting.chainDamageMult ?? defaultChainMult(targeting.chainJumps);
      const remaining = pool.filter((entry) => entry.id !== primaryId);
      const jumps = pickRandomUnique(remaining, targeting.chainJumps, rng);
      jumps.forEach((entry, index) => {
        hits.push({
          targetId: entry.id,
          damageMult: baseMult * (mults[index + 1] ?? 0.5),
        });
      });
    }

    if (targeting.adjacentSplash && primaryId && actor.side === "PLAYER") {
      for (const neighbor of adjacentEnemies(state, primaryId)) {
        if (hits.some((hit) => hit.targetId === neighbor.id)) {
          continue;
        }
        hits.push({
          targetId: neighbor.id,
          damageMult: baseMult * targeting.adjacentSplash,
        });
      }
    }

    return {
      ok: true,
      targetIds: [...new Set(hits.map((hit) => hit.targetId))],
      hits,
    };
  },

  validManualTargets(
    state: CombatState,
    actor: CombatantState,
    targeting: TargetingSpec,
  ): CombatantState[] {
    return applyConditions(poolForGroup(state, actor, targeting), targeting);
  },
};
