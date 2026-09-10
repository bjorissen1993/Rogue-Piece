import { TIME_COST } from "../game/constants";
import type { Encounter, EncounterChoice, EncounterOutcome, TimeCostId } from "../models/types";
import { resolveTimeCost } from "../utils/presentation";

export type ChoiceEstimate = {
  time: number;
  hp: number;
  reward: number;
};

function timeValue(cost: TimeCostId | number | undefined, fallback?: TimeCostId | number): number {
  const resolved = resolveTimeCost(cost ?? fallback, 1, "MORNING");
  if (typeof resolved === "number") {
    return resolved;
  }
  return TIME_COST[resolved as TimeCostId] ?? 1;
}

function estimateOutcome(outcome: EncounterOutcome, fallbackTime?: TimeCostId | number): ChoiceEstimate {
  let time = 0;
  let hp = outcome.hpChange ?? 0;
  let reward = (outcome.berriesChange ?? 0) + (outcome.bountyChange ?? 0) * 0.5;

  if (outcome.grantItemIds?.length) {
    reward += outcome.grantItemIds.length * 40;
  }
  if (outcome.addInventory?.length) {
    reward += outcome.addInventory.length * 30;
  }
  if (outcome.grantWeaponId) {
    reward += 60;
  }
  if (outcome.grantExperience) {
    reward += outcome.grantExperience * 0.5;
  }
  if (outcome.combat) {
    time += 2;
    hp -= 8;
    reward += 25;
  }
  if (outcome.skillCheck) {
    const success = estimateOutcome(outcome.skillCheck.success, fallbackTime);
    const failure = estimateOutcome(outcome.skillCheck.failure, fallbackTime);
    hp += (success.hp + failure.hp) / 2;
    reward += (success.reward + failure.reward) / 2;
    time += (success.time + failure.time) / 2;
  }
  if (outcome.randomTable?.length) {
    const totalWeight = outcome.randomTable.reduce((sum, entry) => sum + entry.weight, 0);
    for (const entry of outcome.randomTable) {
      const weight = entry.weight / totalWeight;
      const branch = estimateOutcome(entry.outcome, fallbackTime);
      hp += branch.hp * weight;
      reward += branch.reward * weight;
      time += branch.time * weight;
    }
  }
  return { time, hp, reward };
}

export function estimateChoice(choice: EncounterChoice, encounter?: Encounter): ChoiceEstimate {
  const base = estimateOutcome(choice.outcome, choice.timeCost ?? encounter?.timeCost);
  base.time += timeValue(choice.timeCost, encounter?.timeCost);
  return base;
}

/** True when `dominator` is strictly better or equal on time, hp, and reward, and strictly better on at least one. */
export function isDominatedBy(candidate: ChoiceEstimate, dominator: ChoiceEstimate): boolean {
  const timeOk = dominator.time <= candidate.time;
  const hpOk = dominator.hp >= candidate.hp;
  const rewardOk = dominator.reward >= candidate.reward;
  const strict = dominator.time < candidate.time || dominator.hp > candidate.hp || dominator.reward > candidate.reward;
  return timeOk && hpOk && rewardOk && strict;
}

export function findDominatedChoices(encounter: Encounter): Array<{ choiceId: string; dominatedBy: string }> {
  const estimates = encounter.choices.map((choice) => ({
    choice,
    estimate: estimateChoice(choice, encounter),
  }));
  const dominated: Array<{ choiceId: string; dominatedBy: string }> = [];
  for (const a of estimates) {
    for (const b of estimates) {
      if (a.choice.id === b.choice.id) {
        continue;
      }
      if (isDominatedBy(a.estimate, b.estimate)) {
        dominated.push({ choiceId: a.choice.id, dominatedBy: b.choice.id });
        break;
      }
    }
  }
  return dominated;
}

export function validateEncounter(encounter: Encounter): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const viable = encounter.choices.filter((choice) => !choice.conditions?.length);
  if (encounter.choices.length < 2) {
    issues.push(`${encounter.id}: fewer than 2 choices`);
  }
  const dominated = findDominatedChoices(encounter);
  for (const entry of dominated) {
    issues.push(`${encounter.id}: "${entry.choiceId}" dominated by "${entry.dominatedBy}"`);
  }
  const nonDominatedIds = new Set(encounter.choices.map((choice) => choice.id));
  for (const entry of dominated) {
    nonDominatedIds.delete(entry.choiceId);
  }
  if (nonDominatedIds.size < 2 && viable.length >= 2 && dominated.length > 0) {
    issues.push(`${encounter.id}: fewer than 2 viable non-dominated choices`);
  }
  return { ok: issues.length === 0, issues };
}

export const EncounterValidationService = {
  estimateChoice,
  isDominatedBy,
  findDominatedChoices,
  validateEncounter,
};
