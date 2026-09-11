import {
  CATEGORY_STREAK_PENALTY,
  ENCOUNTER_HISTORY_PENALTY,
  MAX_CATEGORY_STREAK,
} from "../game/constants";
import type { Encounter, EncounterCategory, EncounterHistory, NarrativeArchetype, RunState } from "../models/types";

const ARCHETYPE_COOLDOWN_DAYS = 4;
const THEME_COOLDOWN_DAYS = 3;

function daysSince(day: number, currentDay: number): number {
  return Math.max(0, currentDay - day);
}

function templateRecencyPenalty(history: EncounterHistory[], templateId: string, currentDay: number): number {
  const recent = history
    .filter((entry) => entry.templateId === templateId)
    .sort((a, b) => b.day - a.day)[0];
  if (!recent) {
    return 1;
  }
  const days = daysSince(recent.day, currentDay);
  if (days <= 1) return ENCOUNTER_HISTORY_PENALTY.YESTERDAY;
  if (days <= 5) return ENCOUNTER_HISTORY_PENALTY.DAYS_5;
  if (days <= 15) return ENCOUNTER_HISTORY_PENALTY.DAYS_15;
  if (days <= 30) return ENCOUNTER_HISTORY_PENALTY.DAYS_30;
  return 1;
}

function characterRecencyPenalty(
  history: EncounterHistory[],
  characterIds: string[],
  currentDay: number,
): number {
  if (!characterIds.length) {
    return 1;
  }
  let penalty = 1;
  for (const characterId of characterIds) {
    const recent = history
      .filter((entry) => entry.characterIds.includes(characterId))
      .sort((a, b) => b.day - a.day)[0];
    if (!recent) {
      continue;
    }
    const days = daysSince(recent.day, currentDay);
    if (days <= 2) {
      penalty *= 0.3;
    } else if (days <= 7) {
      penalty *= 0.6;
    }
  }
  return penalty;
}

function categoryStreakPenalty(run: RunState, category: EncounterCategory | string | undefined): number {
  if (!category) {
    return 1;
  }
  const recent = run.encounterHistory.slice(-MAX_CATEGORY_STREAK);
  if (recent.length < MAX_CATEGORY_STREAK) {
    return 1;
  }
  const allSame = recent.every((entry) => entry.encounterType === category);
  if (allSame && category === "COMBAT") {
    return CATEGORY_STREAK_PENALTY;
  }
  if (allSame) {
    return 0.35;
  }
  return 1;
}

function noveltyPenalty(
  history: EncounterHistory[],
  archetypes: NarrativeArchetype[] | undefined,
  themes: string[] | undefined,
  currentDay: number,
): number {
  let penalty = 1;
  for (const archetype of archetypes ?? []) {
    const recent = history
      .filter((entry) => entry.archetypes?.includes(archetype))
      .sort((a, b) => b.day - a.day)[0];
    if (!recent) continue;
    const days = daysSince(recent.day, currentDay);
    if (days <= ARCHETYPE_COOLDOWN_DAYS) {
      penalty *= 0.45;
    } else if (days <= ARCHETYPE_COOLDOWN_DAYS * 2) {
      penalty *= 0.75;
    }
  }
  for (const theme of themes ?? []) {
    const recent = history
      .filter((entry) => entry.themes?.includes(theme))
      .sort((a, b) => b.day - a.day)[0];
    if (!recent) continue;
    const days = daysSince(recent.day, currentDay);
    if (days <= THEME_COOLDOWN_DAYS) {
      penalty *= 0.55;
    }
  }
  return penalty;
}

function encounterCharacterIds(run: RunState, encounter: Encounter): string[] {
  const ids: string[] = [];
  if (run.currentBoundNpcId) {
    ids.push(run.currentBoundNpcId);
  }
  if (encounter.bindCharacterId) {
    ids.push(encounter.bindCharacterId);
  }
  return ids;
}

export const EncounterHistoryService = {
  recordEncounter(
    run: RunState,
    encounter: Encounter,
    result: string,
    storyThreadId: string | null = null,
  ): void {
    const entry: EncounterHistory = {
      encounterType: (encounter.category as string) ?? "UNKNOWN",
      templateId: encounter.id,
      characterIds: encounterCharacterIds(run, encounter),
      islandId: run.currentIslandId ?? run.currentLocationId,
      storyThreadId,
      day: run.day,
      result,
      archetypes: encounter.narrativeArchetypes?.length
        ? [...encounter.narrativeArchetypes]
        : undefined,
      themes: encounter.narrativeThemes?.length ? [...encounter.narrativeThemes] : undefined,
    };
    run.encounterHistory.push(entry);
    if (encounter.category) {
      run.lastEncounterCategory = encounter.category;
    }
  },

  historyWeightMultiplier(run: RunState, encounter: Encounter): number {
    let weight = 1;
    weight *= templateRecencyPenalty(run.encounterHistory, encounter.id, run.day);
    weight *= characterRecencyPenalty(
      run.encounterHistory,
      encounterCharacterIds(run, encounter),
      run.day,
    );
    weight *= categoryStreakPenalty(run, encounter.category);
    weight *= noveltyPenalty(
      run.encounterHistory,
      encounter.narrativeArchetypes,
      encounter.narrativeThemes,
      run.day,
    );
    return weight;
  },

  noveltyPenaltyFor(
    run: RunState,
    archetypes?: NarrativeArchetype[],
    themes?: string[],
  ): number {
    return noveltyPenalty(run.encounterHistory, archetypes, themes, run.day);
  },

  clearCooldowns(run: RunState): void {
    run.encounterHistory = [];
    run.lastEncounterCategory = null;
  },

  formatHistory(run: RunState, limit = 8): string[] {
    return run.encounterHistory.slice(-limit).map((entry) => {
      return `Day ${entry.day}: ${entry.templateId} (${entry.encounterType}) — ${entry.result}`;
    });
  },

  createDebugEntry(run: RunState, templateId: string): EncounterHistory {
    return {
      encounterType: "DEBUG",
      templateId,
      characterIds: [],
      islandId: run.currentLocationId,
      storyThreadId: null,
      day: run.day,
      result: "debug",
    };
  },
};

export function defaultEncounterHistory(): EncounterHistory[] {
  return [];
}
