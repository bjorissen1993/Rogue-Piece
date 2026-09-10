import type { EncounterChoice, RunState, StatName } from "../../models/types";
import { CharacterScheduleService } from "../../services/CharacterScheduleService";
import { ProgressionService } from "../../services/ProgressionService";
import { STAT_LABELS } from "../../utils/text";
import { CrewPresenceBadge } from "../crew/CrewPresenceBadge";

type ChoiceParticipantPickerProps = {
  run: RunState;
  choice: EncounterChoice;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

function focusStat(choice: EncounterChoice): StatName | undefined {
  return choice.checkStat ?? choice.outcome.skillCheck?.stat ?? choice.outcome.trainStat;
}

export function ChoiceParticipantPicker({
  run,
  choice,
  selectedIds,
  onChange,
}: ChoiceParticipantPickerProps) {
  const min = choice.minParticipants ?? (choice.requiresParticipant ? 1 : 1);
  const max = choice.maxParticipants ?? min;
  const multi = max > 1;
  const candidates = [
    "player",
    ...run.crew.map((member) => member.characterId),
  ];
  const focus = focusStat(choice);
  const difficulty = choice.outcome.skillCheck?.difficulty ?? 8;

  const toggle = (id: string) => {
    if (!CharacterScheduleService.isAvailable(run, id)) {
      return;
    }
    if (!multi) {
      onChange([id]);
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

  const primary = selectedIds[0];
  const assessment =
    primary && focus
      ? CharacterScheduleService.qualitativeChance(
          ProgressionService.getStats(run, primary)[focus],
          difficulty,
        )
      : null;

  return (
    <div className="choice-participant-picker" onClick={(event) => event.stopPropagation()}>
      <p className="choice-participant-label">
        {multi ? `Select ${min}–${max} crew` : "Who attempts this?"}
      </p>
      <div className="crew-presence-row">
        {candidates.map((id) => {
          const available = CharacterScheduleService.isAvailable(run, id);
          return (
            <CrewPresenceBadge
              characterId={id}
              compact
              disabled={!available}
              disableReason={!available ? "Unavailable" : undefined}
              key={id}
              onSelect={toggle}
              run={run}
              selected={selectedIds.includes(id)}
            />
          );
        })}
      </div>
      {primary && focus ? (
        <p className="choice-participant-assessment">
          {ProgressionService.getDisplayName(run, primary)} · {STAT_LABELS[focus]}{" "}
          {ProgressionService.getStats(run, primary)[focus]} · {assessment}
        </p>
      ) : null}
      {multi ? (
        <p className="choice-participant-assessment">
          Selected {selectedIds.length}/{min}
        </p>
      ) : null}
    </div>
  );
}

export function choiceNeedsParticipants(choice: EncounterChoice): boolean {
  return Boolean(
    choice.requiresParticipant ||
      (choice.minParticipants && choice.minParticipants > 0) ||
      choice.outcome.trainStat,
  );
}
