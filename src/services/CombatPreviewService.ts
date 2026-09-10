import type { Ability, CombatantState, CombatState, StatusEffect } from "../models/types";
import { STAT_LABELS } from "../utils/text";
import { clamp } from "../utils/stats";
import {
  computeDamageRange,
  computeHitChance,
  resolveAbilityPower,
  resolveAbilityPowerLevel,
} from "./CombatCalculationService";
import { MpService } from "./MpService";
import { PartyCombatService } from "./PartyCombatService";

export type CombatPreview = {
  hitChance: number;
  critChance: number;
  damageMin: number;
  damageMax: number;
  expectedDamage: number;
  powerBonus: number;
  powerLevel?: number;
  scalingStat?: string;
  scalingValue?: number;
  accuracyMod: number;
  costLabel: string;
  tags: string[];
  effects: string[];
  cooldown?: number;
  hitBreakdown: string[];
  damageBreakdown: string[];
};

export const CombatPreviewService = {
  previewAttack(
    combat: CombatState,
    ability?: Ability | null,
    combatantId?: string | null,
    targetId?: string | null,
  ): CombatPreview | null {
    const attacker =
      (combatantId ? PartyCombatService.getCombatant(combat, combatantId) : null) ??
      PartyCombatService.getActiveCombatant(combat) ??
      combat.playerCombatant;
    const enemy =
      (targetId ? PartyCombatService.getCombatant(combat, targetId) : null) ??
      combat.enemies.find((entry) => entry.hp > 0);
    if (!enemy || enemy.side !== "ENEMY") {
      return null;
    }
    const powerLevel = ability ? resolveAbilityPowerLevel(ability) : undefined;
    const powerBonus = ability ? attacker.stats[ability.scalingStat] + resolveAbilityPower(ability) : 0;
    const accuracyMod = ability?.accuracyMod ?? 0;
    const hit = computeHitChance(attacker, enemy, accuracyMod, powerLevel);
    const dmg = computeDamageRange({
      attacker,
      defender: enemy,
      powerBonus,
      isHeavy: false,
    });
    const critChance = clamp(0.06 + attacker.stats.speed * 0.008, 0.02, 0.35);
    const expected = (dmg.minDamage + dmg.maxDamage) / 2;
    const effectLabel = ability?.applyEffect
      ? `${ability.applyEffect.kind === "BUFF" ? "Buff" : "Debuff"}: ${ability.applyEffect.name} (${ability.applyEffect.turns}t)`
      : null;

    return {
      hitChance: Math.round(hit.combined * 100),
      critChance: Math.round(critChance * 100),
      damageMin: dmg.minDamage,
      damageMax: dmg.maxDamage,
      expectedDamage: Math.round(expected * 10) / 10,
      powerBonus,
      powerLevel,
      scalingStat: ability ? STAT_LABELS[ability.scalingStat] : undefined,
      scalingValue: ability ? attacker.stats[ability.scalingStat] : undefined,
      accuracyMod,
      costLabel: ability ? `${MpService.abilityMpCost(ability)} MP` : "1 action",
      tags: ability?.tags ?? ["MELEE", "SINGLE"],
      effects: [
        ...(ability?.effects ?? []),
        ...(effectLabel ? [effectLabel] : []),
      ],
      cooldown: ability?.cooldown,
      hitBreakdown: hit.parts,
      damageBreakdown: dmg.parts,
    };
  },

  defendPreview(): { title: string; body: string; tip: string } {
    return {
      title: "Defend",
      body: "Brace — next hit deals ~half damage. Slight dodge boost.",
      tip: "Sets defending flag (×0.5 incoming) and +6 dodge bonus until your next turn resolves.",
    };
  },

  observePreview(enemy: CombatantState | undefined, willpower = 5): { title: string; body: string; tip: string } {
    const scale = 1 + willpower * 0.04;
    return {
      title: "Observe",
      body: enemy?.revealed
        ? "Refine your read — accuracy and dodge rise; chance to spot a weak point."
        : "Reveal enemy HP and intent. Gain accuracy/dodge; chance to find a weak point.",
      tip: `Willpower scaling · +${Math.round(12 * scale)} accuracy, +${Math.round(8 * scale)} dodge. Weak point chance scales with willpower.`,
    };
  },

  enemyInspect(enemy: CombatantState, knowledgeGated = false): {
    hp: string;
    stats: string;
    intent: string;
    weapon: string;
    style: string;
    mastery: string;
    techniques: string[];
  } {
    const stats = knowledgeGated
      ? "Stats hidden — observe further."
      : `Str ${enemy.stats.strength} · Def ${enemy.stats.defense} · Spd ${enemy.stats.speed}`;
    return {
      hp: `${enemy.hp}/${enemy.maxHp}`,
      stats,
      intent: enemy.nextActionHint ?? "Intent unclear.",
      weapon: knowledgeGated ? "Unknown weapon" : "Standard armament",
      style: knowledgeGated ? "Unknown style" : enemy.intendedAction === "HEAVY" ? "Heavy striker" : "Balanced",
      mastery: knowledgeGated ? "—" : "Trained",
      techniques: enemy.abilities.map((ability) => ability.name),
    };
  },

  statusTip(effect: StatusEffect): string {
    const bits = [`${effect.name} — ${effect.remainingTurns} turn${effect.remainingTurns === 1 ? "" : "s"} remaining`];
    if (effect.kind) {
      bits.push(effect.kind === "BUFF" ? "Buff" : "Debuff");
    }
    if (effect.accuracyBonus) {
      bits.push(`Acc ${effect.accuracyBonus > 0 ? "+" : ""}${effect.accuracyBonus}%`);
    }
    if (effect.dodgeBonus) {
      bits.push(`Dodge ${effect.dodgeBonus > 0 ? "+" : ""}${effect.dodgeBonus}%`);
    }
    if (effect.damageDealtMod) {
      bits.push(`Damage dealt ${effect.damageDealtMod > 0 ? "+" : ""}${Math.round(effect.damageDealtMod * 100)}%`);
    }
    if (effect.damageTakenMod) {
      bits.push(`Damage taken ${effect.damageTakenMod > 0 ? "+" : ""}${Math.round(effect.damageTakenMod * 100)}%`);
    }
    return bits.join(" · ");
  },
};
