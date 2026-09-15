import { useMemo, useState } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
import type { EncounterChoice, RunState, StatName } from "../../models/types";
import { participantBounds } from "../../game/encounterParticipants";
import { CharacterScheduleService } from "../../services/CharacterScheduleService";
import { ProgressionService } from "../../services/ProgressionService";
import { STAT_LABELS } from "../../utils/text";
import { ChoiceWheel, CHOICE_WHEEL_ICON_SIZE, type ChoiceWheelOption } from "../ChoiceWheel";
import { HudArt } from "../HudIcons";

export { choiceNeedsParticipants, participantBounds } from "../../game/encounterParticipants";

const LEADER_ART = "/icons/Leader.png";
const CREWMATE_ART = "/icons/Crewmate.png";
const STAT_ORDER: StatName[] = [
  "strength",
  "defense",
  "speed",
  "willpower",
  "charisma",
  "intelligence",
];

type ChoiceParticipantPickerProps = {
  run: RunState;
  choice: EncounterChoice;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onBack: () => void;
  /** Fired when a single-select pick is confirmed (ready to resolve the encounter choice). */
  onReady?: (ids: string[]) => void;
};

function focusStat(choice: EncounterChoice): StatName | undefined {
  return choice.checkStat ?? choice.outcome.skillCheck?.stat ?? choice.outcome.trainStat;
}

export function ChoiceParticipantPicker({
  run,
  choice,
  selectedIds,
  onChange,
  onBack,
  onReady,
}: ChoiceParticipantPickerProps) {
  const isMobile = useIsMobile();
  const [focused, setFocused] = useState<ChoiceWheelOption | null>(null);
  const { min, max } = participantBounds(choice);
  const multi = max > 1;
  const focus = focusStat(choice);
  const artSize = isMobile ? Math.round(CHOICE_WHEEL_ICON_SIZE * 0.85) : CHOICE_WHEEL_ICON_SIZE * 2;

  const candidates = useMemo(
    () => ["player", ...run.crew.map((member) => member.characterId)],
    [run.crew, run.player.id],
  );

  const toggle = (id: string) => {
    if (!CharacterScheduleService.isAvailable(run, id)) {
      return;
    }
    if (!multi) {
      onChange([id]);
      onReady?.([id]);
      return;
    }
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((entry) => entry !== id));
      return;
    }
    if (selectedIds.length >= max) {
      onChange([...selectedIds.slice(1), id]);
      return;
    }
    onChange([...selectedIds, id]);
  };

  const options: ChoiceWheelOption[] = candidates.map((id) => {
    const isLeader = id === "player";
    const available = CharacterScheduleService.isAvailable(run, id);
    const name = ProgressionService.getDisplayName(run, id);
    const stats = ProgressionService.getStats(run, id);
    const picked = selectedIds.includes(id);
    const costLabel = !available
      ? "Busy"
      : focus
        ? `${STAT_LABELS[focus]} ${stats[focus]}`
        : isLeader
          ? "Leader"
          : "Crew";

    return {
      id,
      title: name,
      costLabel,
      hint: name,
      disabled: !available,
      selected: picked,
      icon: <HudArt size={artSize} src={isLeader ? LEADER_ART : CREWMATE_ART} />,
      onConfirm: () => toggle(id),
    };
  });

  const previewId = focused?.id ?? selectedIds[0] ?? null;
  const previewStats = previewId ? ProgressionService.getStats(run, previewId) : null;

  return (
    <div
      aria-label="Choose who acts"
      className={`choice-participant-overlay is-pulling-out${isMobile ? " is-mobile-compact" : ""}`}
      role="dialog"
    >
      <p className="choice-participant-kicker">
        {multi
          ? `Select ${min === max ? min : `${min}–${max}`} crew`
          : "Who attempts this?"}
      </p>

      <div className="choice-participant-wheel-panel">
        <ChoiceWheel
          alignFocus={isMobile ? "center" : "bottom"}
          className={`choice-participant-wheel${isMobile ? " is-mobile-solo" : ""}`}
          onFocusChange={setFocused}
          onHoverHint={() => undefined}
          options={options}
          showBadges={false}
          showConfirmButton={false}
          soloFocus={isMobile}
          stepRem={isMobile ? 9 : 14}
        />
      </div>

      <div className="choice-participant-panel">
        {previewStats ? (
          <ul className="choice-participant-stat-list" aria-label="Stats">
            {STAT_ORDER.map((stat) => (
              <li
                className={`choice-participant-stat${focus === stat ? " is-focus" : ""}`}
                key={stat}
              >
                <span>{STAT_LABELS[stat]}</span>
                <strong>{previewStats[stat]}</strong>
              </li>
            ))}
          </ul>
        ) : null}

        {multi && selectedIds.length ? (
          <p className="choice-participant-selected-count">
            Selected {selectedIds.length}/{min}
          </p>
        ) : null}

        <div className="choice-participant-actions">
          <button className="ghost-btn" onClick={onBack} type="button">
            Back
          </button>
          <button
            className="gold-btn combat-wheel-confirm"
            disabled={!focused || focused.disabled}
            onClick={() => {
              if (focused && !focused.disabled) {
                focused.onConfirm();
              }
            }}
            type="button"
          >
            {multi ? (focused?.selected ? "Remove" : "Select") : "Choose"}
          </button>
        </div>
      </div>
    </div>
  );
}
