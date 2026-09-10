import { HudArt } from "../HudIcons";
import { choiceDiamondSrc } from "../../utils/presentation";
import type { EncounterChoice } from "../../models/types";

type ChoiceDiamondIconProps = {
  choice: EncounterChoice;
};

/** Large heraldic identifier above the card — size driven by CSS clamp(). */
export function ChoiceDiamondIcon({ choice }: ChoiceDiamondIconProps) {
  return (
    <span className="choice-diamond" aria-hidden="true">
      <HudArt className="choice-diamond-art" size={120} src={choiceDiamondSrc(choice)} />
    </span>
  );
}

export { ChoiceDiamondIcon as ChoiceIcon };
