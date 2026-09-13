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
import { choiceNeedsParticipants, participantBounds } from "./ChoiceParticipantPicker";

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
  participantIds?: string[];
  onSelect: (choiceId: string) => void;
  onConfirm: (choiceId: string, participantIds?: string[]) => void;
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
  participantIds = [],
  onSelect,
  onConfirm,
}: EncounterChoiceCardProps) {
  const variant = choiceVariant(choice);
  const accent = choiceAccentColor(choice);
  const accentStat = choiceAccentStat(choice);
  const primary = choicePrimaryResult(choice);
  const primaryTip = primaryResultTooltip(choice, player, run);
  const costs = choiceCostItems(choice, encounter, timeOfDay, isDev);
  const needsParticipants = Boolean(run && choiceNeedsParticipants(choice));
  const { min } = participantBounds(choice);
  const participantsReady = !needsParticipants || participantIds.length >= min;

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
            if (needsParticipants && !participantsReady) {
              return;
            }
            onConfirm(choice.id, needsParticipants ? participantIds : undefined);
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
          {primary ? (
            <EffectTooltip className="choice-primary-tip" tip={primaryTip ?? ""}>
              <div className="choice-primary-wrap">
                <ChoicePrimaryResult result={primary} />
              </div>
            </EffectTooltip>
          ) : null}
          {choice.flavour ? <p className="choice-flavour">{choice.flavour}</p> : null}
          {selected && needsParticipants && !participantsReady ? (
            <p className="choice-participant-card-hint">Pick who acts below</p>
          ) : null}
        </div>
        <ChoiceCostBar
          choice={choice}
          encounter={encounter}
          isDev={isDev}
          items={costs}
          player={player}
          run={run}
          timeOfDay={timeOfDay}
        />
        <ChoiceRequirement reason={lockReason} />
      </button>
    </div>
  );
}
