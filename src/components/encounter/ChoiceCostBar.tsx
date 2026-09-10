import type { Encounter, EncounterChoice, Player, TimeOfDay } from "../../models/types";
import type { ChoiceCostItem } from "../../utils/presentation";
import { ChoiceEffectBadge } from "./ChoiceEffectBadge";

type ChoiceCostBarProps = {
  items: ChoiceCostItem[];
  choice: EncounterChoice;
  encounter?: Encounter | null;
  timeOfDay?: TimeOfDay;
  player?: Player | null;
  isDev?: boolean;
};

export function ChoiceCostBar({
  items,
  choice,
  encounter,
  timeOfDay,
  player,
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
          timeOfDay={timeOfDay}
        />
      ))}
    </div>
  );
}
