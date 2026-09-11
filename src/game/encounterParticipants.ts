import type { EncounterChoice } from "../models/types";

export function choiceNeedsParticipants(choice: EncounterChoice): boolean {
  return Boolean(
    choice.requiresParticipant ||
      (choice.minParticipants != null && choice.minParticipants > 0) ||
      choice.outcome.trainStat ||
      choice.checkStat ||
      choice.outcome.skillCheck,
  );
}

export function participantBounds(choice: EncounterChoice): { min: number; max: number } {
  if (!choiceNeedsParticipants(choice)) {
    return { min: 0, max: 0 };
  }
  const min = Math.max(1, choice.minParticipants ?? 1);
  const max = Math.max(min, choice.maxParticipants ?? min);
  return { min, max };
}
