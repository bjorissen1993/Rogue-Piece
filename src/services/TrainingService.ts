import { MAX_TRAINING_ACTIONS_PER_DAY, MAX_TRAINING_PER_STAT_PER_DAY } from "../game/constants";
import type { StatName, RunState } from "../models/types";
import { STAT_LABELS } from "../utils/text";
import { clampStat } from "../utils/stats";
import type { RandomService } from "./RandomService";

function trainedCountToday(run: RunState): number {
  return Object.values(run.trainingToday).reduce((sum, value) => sum + (value ?? 0), 0);
}

function successChance(current: number): number {
  if (current <= 6) return 1;
  if (current <= 10) return 0.7;
  if (current <= 14) return 0.4;
  return 0.2;
}

export const TrainingService = {
  apply(run: RunState, stat: StatName, rng: RandomService): { gained: number; text: string } {
    const label = STAT_LABELS[stat].toLowerCase();
    const already = run.trainingToday[stat] ?? 0;
    if (already >= MAX_TRAINING_PER_STAT_PER_DAY) {
      return {
        gained: 0,
        text: `You already trained your ${label} today. The body needs a night.`,
      };
    }
    if (trainedCountToday(run) >= MAX_TRAINING_ACTIONS_PER_DAY) {
      return {
        gained: 0,
        text: "Enough for one day. Rest, or the gains will rot.",
      };
    }

    const current = run.player.stats[stat];
    if (current >= 20) {
      return { gained: 0, text: `Your ${label} has nowhere left to climb.` };
    }

    const gained = rng.chance(successChance(current)) ? 1 : 0;
    run.trainingToday[stat] = already + 1;
    if (gained) {
      run.player.stats[stat] = clampStat(current + gained);
      return { gained, text: `Your ${label} increased.` };
    }
    return {
      gained: 0,
      text: `You train hard, but your ${label} is already stubborn. No gain today.`,
    };
  },

  resetDay(run: RunState): void {
    run.trainingToday = {};
  },
};
