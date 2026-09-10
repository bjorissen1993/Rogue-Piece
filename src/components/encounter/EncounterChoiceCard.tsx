import type { CSSProperties } from "react";
import type { Encounter, EncounterChoice, Player, RunState, TimeOfDay } from "../../models/types";
import { primaryResultTooltip } from "../../utils/effectTooltips";
import {
  choiceAccentColor,
  choiceAccentStat,
  choiceCostItems,
  choiceLabel,
  choicePrimaryResult,
  choiceVariant,
} from "../../utils/presentation";
import { EffectTooltip } from "../EffectTooltip";
import { ChoiceCostBar } from "./ChoiceCostBar";
import { ChoiceDiamondIcon } from "./ChoiceDiamondIcon";
import { ChoicePrimaryResult } from "./ChoicePrimaryResult";
import { ChoiceRequirement } from "./ChoiceRequirement";

type EncounterChoiceCardProps = {
  choice: EncounterChoice;
  encounter?: Encounter | null;
  timeOfDay?: TimeOfDay;
  player?: Player | null;
  run?: RunState | null;
  selected?: boolean;
  dimmed?: boolean;
  locked?: boolean;
  lockReason?: string;
  isDev?: boolean;
  onSelect: (choiceId: string) => void;
  onConfirm: (choiceId: string) => void;
};

export function EncounterChoiceCard({
  choice,
  encounter,
  timeOfDay,
  player,
  run,
  selected = false,
  dimmed = false,
  locked = false,
  lockReason,
  isDev = false,
  onSelect,
  onConfirm,
}: EncounterChoiceCardProps) {
  const variant = choiceVariant(choice);
  const accent = choiceAccentColor(choice);
  const accentStat = choiceAccentStat(choice);
  const primary = choicePrimaryResult(choice);
  const costs = choiceCostItems(choice, encounter, timeOfDay, isDev);
  const primaryTip = primaryResultTooltip(choice, player, run);

  return (
    <div
      className={[
        "choice-card-shell",
        selected ? "is-selected" : "",
        dimmed ? "is-dimmed" : "",
        locked ? "is-disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ChoiceDiamondIcon choice={choice} />
      <button
        className={[
          "select-card",
          "choice-card",
          `choice-card--${variant}`,
          accentStat ? `choice-card--stat-${accentStat}` : "",
          selected ? "is-selected" : "",
          dimmed ? "is-dimmed" : "",
          locked ? "is-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={locked}
        onClick={() => {
          if (locked) {
            return;
          }
          if (selected) {
            onConfirm(choice.id);
            return;
          }
          onSelect(choice.id);
        }}
        style={
          {
            ["--choice-accent" as string]: accent ?? "rgba(197, 160, 89, 0.85)",
          } as CSSProperties
        }
        type="button"
      >
        <h3 className="choice-title font-display">{choiceLabel(choice)}</h3>
        <div className="choice-body">
          {primaryTip ? (
            <EffectTooltip tip={primaryTip}>
              <div className="choice-primary-wrap">
                <ChoicePrimaryResult result={primary} />
              </div>
            </EffectTooltip>
          ) : (
            <div className="choice-primary-wrap">
              <ChoicePrimaryResult result={primary} />
            </div>
          )}
          {choice.flavour ? <p className="choice-flavour">{choice.flavour}</p> : null}
        </div>
        <ChoiceCostBar
          choice={choice}
          encounter={encounter}
          isDev={isDev}
          items={costs}
          player={player}
          timeOfDay={timeOfDay}
        />
        <ChoiceRequirement reason={lockReason} />
      </button>
    </div>
  );
}
