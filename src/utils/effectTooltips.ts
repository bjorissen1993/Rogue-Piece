import { computeHealAmount, computeMpRestoreAmount, getItemDefinition } from "../data/items";
import { getWeapon } from "../data/weapons";
import type {
  Encounter,
  EncounterChoice,
  FactionChangeSpec,
  Player,
  RunState,
  StatName,
  TimeOfDay,
} from "../models/types";
import { MpService } from "../services/MpService";
import { STAT_LABELS } from "./text";
import {
  choiceFocusStat,
  choiceGainStats,
  choiceLoseStats,
  choiceRiskLevel,
  choiceTimeCostId,
  remainingSlotsToday,
  resolveTimeCost,
  type ChoiceCostItem,
} from "./presentation";

function clampHp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function timeEffectTip(
  choice: EncounterChoice,
  encounter: Encounter | null | undefined,
  timeOfDay?: TimeOfDay,
  run?: RunState | null,
): string {
  const costId = choiceTimeCostId(choice, encounter);
  if (costId == null || costId === "BRIEF" || costId === 0) {
    return "This choice costs almost no time.";
  }
  if (costId === "DAY") {
    return "Spends the rest of today. You advance to the next dawn.";
  }
  const slots = resolveTimeCost(costId, 0, timeOfDay);
  const remaining = run ? remainingSlotsToday(run.timeOfDay) : null;
  const after =
    remaining == null ? null : Math.max(0, remaining - slots);
  const base =
    slots === 1
      ? "This activity uses 1 of your remaining time slots today."
      : `This activity uses ${slots} of your remaining time slots today.`;
  if (after == null) {
    return base;
  }
  return `${base} After: ${after} time slot${after === 1 ? "" : "s"} remain.`;
}

export function hpEffectTip(change: number, player?: Player | null): string {
  const abs = Math.abs(change);
  if (change < 0) {
    if (player) {
      const next = clampHp(player.hp + change, player.maxHp);
      return `Lose ${abs} HP. Current ${player.hp} → ${next}.`;
    }
    return `Lose ${abs} HP.`;
  }
  if (change > 0) {
    if (player) {
      const next = clampHp(player.hp + change, player.maxHp);
      return `Recover ${abs} HP. Current ${player.hp} → ${next}.`;
    }
    return `Recover ${abs} HP.`;
  }
  return "No HP change.";
}

function clampMp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function mpEffectTip(change: number, player?: Player | null): string {
  const abs = Math.abs(change);
  if (change < 0) {
    if (player) {
      const maxMp = player.maxMp ?? 0;
      const current = player.mp ?? 0;
      const next = clampMp(current + change, maxMp);
      return `Lose ${abs} MP. Current ${current} → ${next}.`;
    }
    return `Lose ${abs} MP.`;
  }
  if (change > 0) {
    if (player) {
      const maxMp = player.maxMp ?? 0;
      const current = player.mp ?? 0;
      const next = clampMp(current + change, maxMp);
      return `Recover ${abs} MP. Current ${current} → ${next}.`;
    }
    return `Recover ${abs} MP.`;
  }
  return "No MP change.";
}

export function berriesEffectTip(change: number, player?: Player | null): string {
  const abs = Math.abs(change).toLocaleString();
  if (change < 0) {
    if (player) {
      const next = Math.max(0, player.berries + change);
      return `Spend ฿${abs}. Berries ${player.berries.toLocaleString()} → ${next.toLocaleString()}.`;
    }
    return `Spend ฿${abs}.`;
  }
  if (change > 0) {
    if (player) {
      const next = player.berries + change;
      return `Gain ฿${abs}. Berries ${player.berries.toLocaleString()} → ${next.toLocaleString()}.`;
    }
    return `Gain ฿${abs}.`;
  }
  return "No berry change.";
}

export function focusEffectTip(stat: StatName): string {
  return `This option leans on ${STAT_LABELS[stat]}. Higher ${STAT_LABELS[stat]} improves your odds.`;
}

export function riskEffectTip(choice: EncounterChoice, isDev = false): string {
  const level = choiceRiskLevel(choice);
  const difficulty = choice.outcome.skillCheck?.difficulty;
  const base =
    level === "SAFE"
      ? "Low danger — unlikely to backfire hard."
      : level === "FAIR"
        ? "Moderate risk — outcomes can swing either way."
        : level === "RISKY"
          ? "High risk — failure can hurt."
          : level === "DANGEROUS"
            ? "Deadly stakes — expect serious consequences."
            : "Unknown risk.";
  if (isDev && difficulty != null) {
    return `${base} Check difficulty ${difficulty}.`;
  }
  return base;
}

export function bountyEffectTip(change: number, player?: Player | null): string {
  const abs = Math.abs(change).toLocaleString();
  if (change > 0) {
    if (player) {
      return `Bounty rises by ฿${abs}. ${player.bounty.toLocaleString()} → ${(player.bounty + change).toLocaleString()}.`;
    }
    return `Bounty rises by ฿${abs}.`;
  }
  if (change < 0) {
    if (player) {
      const next = Math.max(0, player.bounty + change);
      return `Bounty falls by ฿${abs}. ${player.bounty.toLocaleString()} → ${next.toLocaleString()}.`;
    }
    return `Bounty falls by ฿${abs}.`;
  }
  return "No bounty change.";
}

export function statGainTip(stat: StatName, amount: number, player?: Player | null): string {
  if (player) {
    const current = player.stats[stat];
    return `${STAT_LABELS[stat]} +${amount}. ${current} → ${current + amount}.`;
  }
  return `${STAT_LABELS[stat]} +${amount}.`;
}

export function factionEffectTip(change: FactionChangeSpec, run?: RunState | null): string {
  const rel = run?.world.factions.find((entry) => entry.factionId === change.factionId);
  const label = change.factionId.replaceAll("_", " ");
  if (rel) {
    const next = Math.max(-100, Math.min(100, rel.value + change.amount));
    const dir = change.amount >= 0 ? "improves" : "worsens";
    return `Reputation with ${label} ${dir}: ${rel.value} → ${next}. ${change.reason}`;
  }
  return `Reputation with ${label}: ${change.amount >= 0 ? "+" : ""}${change.amount}. ${change.reason}`;
}

export function costItemTooltip(
  item: ChoiceCostItem,
  choice: EncounterChoice,
  encounter?: Encounter | null,
  timeOfDay?: TimeOfDay,
  player?: Player | null,
  isDev = false,
  run?: RunState | null,
): string {
  switch (item.kind) {
    case "time":
      return timeEffectTip(choice, encounter, timeOfDay, run);
    case "hp":
      return hpEffectTip(choice.outcome.hpChange ?? 0, player);
    case "berries":
      return berriesEffectTip(choice.outcome.berriesChange ?? 0, player);
    case "focus":
      return item.stat ? focusEffectTip(item.stat) : "Focus stat for this choice.";
    case "risk":
      return riskEffectTip(choice, isDev);
    case "bounty":
      return bountyEffectTip(choice.outcome.bountyChange ?? 0, player);
    case "free":
      return "No time, berries, or HP cost.";
    default:
      return `${item.label}: ${item.value}`;
  }
}

/** Tooltip for a granted item (food, medicine, escape tools, etc.). */
export function itemGrantTip(itemId: string, player?: Player | null): string {
  const def = getItemDefinition(itemId);
  if (!def) {
    return "Unknown item.";
  }

  const effectParts: string[] = [];
  for (const effect of def.effects) {
    if (effect.type === "HEAL") {
      const bits: string[] = [];
      if (effect.amount > 0) {
        bits.push(`+${effect.amount}`);
      }
      if (effect.percentMaxHp) {
        bits.push(`+${effect.percentMaxHp}% max HP`);
      }
      if (player) {
        const total = computeHealAmount(effect.amount, effect.percentMaxHp, player.maxHp);
        const after = clampHp(player.hp + total, player.maxHp);
        const label = bits.length
          ? `Restores ${bits.join(" ")} (${total} HP)`
          : `Restores ${total} HP`;
        effectParts.push(`${label}. Current ${player.hp} → ${after}.`);
      } else {
        effectParts.push(
          bits.length ? `Restores ${bits.join(" ")} when used.` : "Restores HP when used.",
        );
      }
    } else if (effect.type === "RESTORE_MP") {
      const bits: string[] = [];
      if (effect.amount > 0) {
        bits.push(`+${effect.amount}`);
      }
      if (effect.percentMaxMp) {
        bits.push(`+${effect.percentMaxMp}% max MP`);
      }
      if (player) {
        const maxMp = player.maxMp ?? 0;
        const current = player.mp ?? 0;
        const total = computeMpRestoreAmount(effect.amount, effect.percentMaxMp, maxMp);
        const after = Math.min(maxMp, current + total);
        const label = bits.length
          ? `Restores ${bits.join(" ")} (${total} MP)`
          : `Restores ${total} MP`;
        effectParts.push(`${label}. Current ${current} → ${after}.`);
      } else {
        effectParts.push(
          bits.length ? `Restores ${bits.join(" ")} when used.` : "Restores MP when used.",
        );
      }
    } else if (effect.type === "GUARANTEE_ESCAPE") {
      effectParts.push("Guarantees escape from combat when used.");
    } else if (effect.type === "REVIVE") {
      const bits: string[] = [];
      if (effect.hpAmount) {
        bits.push(`+${effect.hpAmount}`);
      }
      if (effect.percentMaxHp) {
        bits.push(`+${effect.percentMaxHp}% max HP`);
      }
      const floor = bits.length ? bits.join(" ") : "a spark of life";
      effectParts.push(
        `Revives a knocked-out ally with ${floor}. Useless on anyone still standing.`,
      );
    }
  }

  if (effectParts.length) {
    return effectParts.join(" ");
  }
  return def.description || `${def.name} is added to your inventory.`;
}

function grantItemTips(choice: EncounterChoice, player?: Player | null): string[] {
  const tips: string[] = [];
  for (const itemId of choice.outcome.grantItemIds ?? []) {
    tips.push(itemGrantTip(itemId, player));
  }
  for (const item of choice.outcome.addInventory ?? []) {
    const id = item.itemId ?? item.id;
    if (getItemDefinition(id)) {
      tips.push(itemGrantTip(id, player));
    } else if (item.healAmount && item.healAmount > 0) {
      tips.push(hpEffectTip(item.healAmount, player));
    } else if (item.description) {
      tips.push(item.description);
    } else {
      tips.push(`${item.name} is added to your inventory.`);
    }
  }
  if (choice.outcome.grantWeaponId) {
    const weapon = getWeapon(choice.outcome.grantWeaponId);
    if (weapon) {
      tips.push(`${weapon.name}: ${weapon.damage} dmg, speed ${weapon.speed}.`);
    }
  }
  return tips;
}

export function primaryResultTooltip(
  choice: EncounterChoice,
  player?: Player | null,
  run?: RunState | null,
): string | null {
  const gains = choiceGainStats(choice);
  const losses = choiceLoseStats(choice);
  const parts: string[] = [];
  if (gains.length) {
    for (const stat of gains) {
      const amount = choice.outcome.statChanges?.[stat] ?? (choice.outcome.trainStat === stat ? 1 : 1);
      parts.push(statGainTip(stat, Math.abs(amount), player));
    }
  }
  if (losses.length) {
    for (const stat of losses) {
      const amount = choice.outcome.statChanges?.[stat] ?? -1;
      if (player) {
        const current = player.stats[stat];
        parts.push(`${STAT_LABELS[stat]} ${amount}. ${current} → ${current + amount}.`);
      } else {
        parts.push(`${STAT_LABELS[stat]} ${amount}.`);
      }
    }
  }
  const hp = choice.outcome.hpChange ?? 0;
  if (hp > 0) {
    parts.push(hpEffectTip(hp, player));
  }
  const mp = MpService.effectiveOutcomeMpChange(choice.outcome);
  if (mp > 0) {
    parts.push(mpEffectTip(mp, player));
  }
  const berries = choice.outcome.berriesChange ?? 0;
  if (berries > 0) {
    parts.push(berriesEffectTip(berries, player));
  }
  parts.push(...grantItemTips(choice, player));
  if (choice.outcome.factionChanges?.length) {
    for (const change of choice.outcome.factionChanges) {
      parts.push(factionEffectTip(change, run));
    }
  }
  if (choice.outcome.skillCheck) {
    const focus = choiceFocusStat(choice);
    const diff = choice.outcome.skillCheck.difficulty;
    parts.push(
      `Skill check on ${STAT_LABELS[choice.outcome.skillCheck.stat]} (difficulty ${diff}).${
        focus ? ` Focus: ${STAT_LABELS[focus]}.` : ""
      } Outcome varies.`,
    );
  }
  if (choice.outcome.combat) {
    parts.push(`Starts a fight against ${choice.outcome.combat.enemyName}. Outcome depends on combat.`);
  }
  return parts.length ? parts.join("\n") : null;
}
