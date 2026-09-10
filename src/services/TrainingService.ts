import { MAX_TRAINING_ACTIONS_PER_DAY, MAX_TRAINING_PER_STAT_PER_DAY } from "../game/constants";
import type { StatName, RunState } from "../models/types";
import { STAT_LABELS } from "../utils/text";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { ProgressionService } from "./ProgressionService";
import type { RandomService } from "./RandomService";

function characterKey(characterId: string, run: RunState): string {
  return characterId === run.player.id ? "player" : characterId;
}

function trainedCountToday(run: RunState, characterId: string): number {
  CharacterScheduleService.ensure(run);
  const key = characterKey(characterId, run);
  const map = run.characterTrainingToday![key] ?? {};
  return Object.values(map).reduce((sum, value) => sum + (value ?? 0), 0);
}

function successChance(current: number): number {
  if (current <= 6) return 1;
  if (current <= 10) return 0.7;
  if (current <= 14) return 0.4;
  return 0.2;
}

export const TrainingService = {
  /** Same-day stat training for any available character. */
  apply(
    run: RunState,
    stat: StatName,
    rng: RandomService,
    characterId: string = "player",
  ): { gained: number; text: string } {
    CharacterScheduleService.ensure(run);
    const id = characterKey(characterId, run);
    if (!CharacterScheduleService.isAvailable(run, id)) {
      return { gained: 0, text: "That character is unavailable for training." };
    }

    const label = STAT_LABELS[stat].toLowerCase();
    const name = ProgressionService.getDisplayName(run, id);
    const today = run.characterTrainingToday![id] ?? {};
    const already = today[stat] ?? 0;
    if (already >= MAX_TRAINING_PER_STAT_PER_DAY) {
      return {
        gained: 0,
        text: `${name} already trained ${label} today.`,
      };
    }
    if (trainedCountToday(run, id) >= MAX_TRAINING_ACTIONS_PER_DAY) {
      return {
        gained: 0,
        text: `${name} has trained enough for one day.`,
      };
    }

    const stats = ProgressionService.getStats(run, id);
    const current = stats[stat];
    if (current >= 20) {
      return { gained: 0, text: `${name}'s ${label} has nowhere left to climb.` };
    }

    const gained = rng.chance(successChance(current)) ? 1 : 0;
    today[stat] = already + 1;
    run.characterTrainingToday![id] = today;
    // Keep legacy field in sync for player so old UI/tools still work.
    if (id === "player") {
      run.trainingToday[stat] = today[stat];
    }

    if (gained) {
      const note = CharacterScheduleService.applyStatGain(run, id, stat);
      return {
        gained,
        text: note ?? `${name}'s ${label} increased.`,
      };
    }
    return {
      gained: 0,
      text: `${name} trains hard, but ${label} stays stubborn. No gain today.`,
    };
  },

  /** Multi-day intensive training that makes the character unavailable. */
  beginLongTraining(
    run: RunState,
    characterId: string,
    options: {
      label: string;
      focus: string;
      durationSlots: number;
      type?: "TRAINING" | "WEAPON_TRAINING" | "STYLE_TRAINING";
      berriesCost?: number;
    },
  ): { ok: boolean; message: string } {
    return CharacterScheduleService.startAssignment(run, {
      characterId,
      type: options.type ?? "TRAINING",
      label: options.label,
      durationSlots: options.durationSlots,
      focus: options.focus,
      berriesCost: options.berriesCost,
      interruptible: true,
    });
  },

  resetDay(run: RunState): void {
    run.trainingToday = {};
    run.characterTrainingToday = {};
  },
};
