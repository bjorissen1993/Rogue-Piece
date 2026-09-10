import type { Encounter, EncounterChoice, Player, RunState, TimeOfDay } from "../../models/types";
import { choiceCountClass } from "../../utils/presentation";
import { EncounterChoiceCard } from "./EncounterChoiceCard";

export type EncounterChoiceLockMap = Record<string, string>;

type EncounterChoiceGridProps = {
  choices: EncounterChoice[];
  encounter?: Encounter | null;
  timeOfDay?: TimeOfDay;
  player?: Player | null;
  run?: RunState | null;
  selectedId: string | null;
  lockReasons?: EncounterChoiceLockMap;
  isDev?: boolean;
  onSelect: (choiceId: string) => void;
  onConfirm: (choiceId: string) => void;
};

export function EncounterChoiceGrid({
  choices,
  encounter,
  timeOfDay,
  player,
  run,
  selectedId,
  lockReasons,
  isDev = false,
  onSelect,
  onConfirm,
}: EncounterChoiceGridProps) {
  return (
    <div className={`${choiceCountClass(choices.length)}${selectedId ? " has-selection" : ""}`}>
      {choices.map((choice) => {
        const lockReason = lockReasons?.[choice.id];
        return (
          <EncounterChoiceCard
            choice={choice}
            dimmed={Boolean(selectedId) && selectedId !== choice.id}
            encounter={encounter}
            isDev={isDev}
            key={choice.id}
            locked={Boolean(lockReason)}
            lockReason={lockReason}
            onConfirm={onConfirm}
            onSelect={onSelect}
            player={player}
            run={run}
            selected={selectedId === choice.id}
            timeOfDay={timeOfDay}
          />
        );
      })}
    </div>
  );
}
