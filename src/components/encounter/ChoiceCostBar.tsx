import type { Encounter, EncounterChoice, Player, RunState, TimeOfDay } from "../../models/types";
import type { ChoiceCostItem } from "../../utils/presentation";
import { ChoiceEffectBadge } from "./ChoiceEffectBadge";

type ChoiceCostBarProps = {
  items: ChoiceCostItem[];
  choice: EncounterChoice;
  encounter?: Encounter | null;
  timeOfDay?: TimeOfDay;
  player?: Player | null;
  run?: RunState | null;
  isDev?: boolean;
};

export function ChoiceCostBar({
  items,
  choice,
  encounter,
  timeOfDay,
  player,
  run,
  isDev = false,
}: ChoiceCostBarProps) {
  return (
    <div className="choice-footer choice-cost-bar">
      {items.map((item, index) => (
        <ChoiceEffectBadge
          choice={choice}
          encounter={encounter}
          isDev={isDev}
          item={item}
          key={`${item.kind}-${item.value}-${index}`}
          player={player}
          run={run}
          timeOfDay={timeOfDay}
        />
      ))}
    </div>
  );
}
