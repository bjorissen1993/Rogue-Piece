import { useEffect, useMemo, useState } from "react";
import type { BackgroundContext, DialogueBeat, Encounter, EncounterChoice, Player, RunState, TimeOfDay } from "../models/types";
import { CharacterService } from "../services/CharacterService";
import { encounterBackground, encounterMood, encounterOverlay } from "../utils/presentation";
import { EncounterChoiceGrid, type EncounterChoiceLockMap } from "./encounter/EncounterChoiceGrid";
import {
  ChoiceParticipantPicker,
  choiceNeedsParticipants,
  participantBounds,
} from "./encounter/ChoiceParticipantPicker";

type EncounterViewProps = {
  encounter: Encounter | null;
  description: string;
  choices: EncounterChoice[];
  resultText: string | null;
  gameOver: boolean;
  timeOfDay?: TimeOfDay;
  backgroundContext?: BackgroundContext;
  lockReasons?: EncounterChoiceLockMap;
  player?: Player | null;
  run?: RunState | null;
  isDev?: boolean;
  onChoose: (choiceId: string, participantIds?: string[]) => void;
  onContinue: () => void;
};

function visibleDialogueBeats(run: RunState | null | undefined, beats: DialogueBeat[] | undefined): DialogueBeat[] {
  if (!run || !beats?.length) return [];
  return beats.filter((beat) => {
    if (beat.requireCrewId) {
      const member = run.crew.find((entry) => entry.characterId === beat.requireCrewId);
      if (!member) return false;
      if (member.status === "Unavailable" || member.status === "Missing" || member.currentAssignment) return false;
    }
    if (beat.memoryGate && beat.speakerId) {
      if (!CharacterService.hasMemory(run, beat.speakerId, beat.memoryGate)) {
        return false;
      }
    }
    return true;
  });
}

export function EncounterView({
  encounter,
  description,
  choices,
  resultText,
  gameOver,
  timeOfDay,
  backgroundContext,
  lockReasons,
  player,
  run,
  isDev = false,
  onChoose,
  onContinue,
}: EncounterViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const overlay = encounter ? encounterOverlay(encounter) : "default";
  const mood = encounterMood(encounter, Boolean(resultText));
  const selected = choices.find((choice) => choice.id === selectedId && !lockReasons?.[choice.id]);
  const needsParticipants = selected ? choiceNeedsParticipants(selected) : false;
  const pickingParticipants = Boolean(selected && needsParticipants && run);
  const { min: minParticipants } = selected ? participantBounds(selected) : { min: 0 };
  const canConfirm =
    Boolean(selected) && (!needsParticipants || participantIds.length >= minParticipants);
  const background = encounterBackground(encounter, {
    timeOfDay,
    weather: backgroundContext?.weather ?? "CLEAR",
    encounterType: (encounter?.category as BackgroundContext["encounterType"]) ?? backgroundContext?.encounterType,
    islandType: backgroundContext?.islandType,
    biome: backgroundContext?.biome,
    dangerLevel: backgroundContext?.dangerLevel,
  });
  const dialogueBeats = useMemo(
    () => visibleDialogueBeats(run, encounter?.dialogueBeats),
    [run, encounter?.dialogueBeats, encounter?.id],
  );

  useEffect(() => {
    setSelectedId(null);
    setParticipantIds([]);
  }, [encounter?.id, resultText]);

  const showingResult = Boolean(resultText);

  const clearParticipantPick = () => {
    setSelectedId(null);
    setParticipantIds([]);
  };

  return (
    <section className="encounter-stage">
      <div
        className={`encounter-frame overlay-${overlay} mood-${mood}${showingResult ? " is-showing-result" : ""}${
          pickingParticipants ? " is-picking-participant" : ""
        }`}
        style={{ ["--encounter-bg" as string]: background ? `url(${background})` : "none" }}
      >
        <div className="encounter-header">
          <div
            className={`encounter-text-plate ${showingResult ? "is-result" : "is-intro"}`}
          >
            <div className="encounter-text-plate-face">
              <h2 className="encounter-title font-display">{encounter?.title ?? "Open Water"}</h2>
              {!showingResult && dialogueBeats.length ? (
                <ul className="encounter-dialogue" aria-label="Dialogue">
                  {dialogueBeats.map((beat, index) => (
                    <li key={`${beat.speakerId}-${index}`}>
                      <span className="encounter-dialogue-speaker">
                        {beat.speakerName ??
                          (run ? CharacterService.getCharacter(run, beat.speakerId)?.name : undefined) ??
                          beat.speakerId}
                      </span>
                      <span className="encounter-dialogue-line">{beat.line}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {showingResult ? (
                <p className="encounter-result-copy whitespace-pre-wrap">{resultText}</p>
              ) : (
                <p className="encounter-copy whitespace-pre-wrap">{description}</p>
              )}
            </div>
          </div>
        </div>

        {resultText ? (
          <div className="encounter-result">
            <button className="gold-btn min-w-48" onClick={onContinue} type="button">
              {gameOver ? "Face your fate" : "Continue"}
            </button>
          </div>
        ) : (
          <div className="encounter-choice-stack">
            <EncounterChoiceGrid
              choices={choices}
              encounter={encounter}
              isDev={isDev}
              lockReasons={lockReasons}
              onConfirm={onChoose}
              onSelect={(choiceId) => {
                setSelectedId(choiceId);
                setParticipantIds([]);
              }}
              participantIds={participantIds}
              player={player}
              run={run}
              selectedId={selectedId}
              timeOfDay={timeOfDay}
            />

            <div className={`encounter-choice-rail ${pickingParticipants ? "is-open" : ""}`}>
              {pickingParticipants && selected && run ? (
                <ChoiceParticipantPicker
                  choice={selected}
                  onBack={clearParticipantPick}
                  onChange={setParticipantIds}
                  onReady={(ids) => {
                    onChoose(selected.id, ids);
                  }}
                  run={run}
                  selectedIds={participantIds}
                />
              ) : null}
            </div>

            {!pickingParticipants ? (
              <div className="encounter-confirm">
                <button
                  className="gold-btn min-w-48"
                  disabled={!canConfirm}
                  onClick={() =>
                    selected && onChoose(selected.id, needsParticipants ? participantIds : undefined)
                  }
                  type="button"
                >
                  Continue
                </button>
              </div>
            ) : canConfirm && participantBounds(selected!).max > 1 ? (
              <div className="encounter-confirm">
                <button
                  className="gold-btn min-w-48"
                  onClick={() => onChoose(selected!.id, participantIds)}
                  type="button"
                >
                  Continue
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
