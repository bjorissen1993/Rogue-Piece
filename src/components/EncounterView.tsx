import { useEffect, useState } from "react";
import type { BackgroundContext, Encounter, EncounterChoice, Player, RunState, TimeOfDay } from "../models/types";
import { encounterBackground, encounterMood, encounterOverlay } from "../utils/presentation";
import { EncounterChoiceGrid, type EncounterChoiceLockMap } from "./encounter/EncounterChoiceGrid";

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
  onChoose: (choiceId: string) => void;
  onContinue: () => void;
};

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
  const overlay = encounter ? encounterOverlay(encounter) : "default";
  const mood = encounterMood(encounter, Boolean(resultText));
  const selected = choices.find((choice) => choice.id === selectedId && !lockReasons?.[choice.id]);
  const background = encounterBackground(encounter, {
    timeOfDay,
    weather: backgroundContext?.weather ?? "CLEAR",
    encounterType: (encounter?.category as BackgroundContext["encounterType"]) ?? backgroundContext?.encounterType,
    islandType: backgroundContext?.islandType,
    biome: backgroundContext?.biome,
    dangerLevel: backgroundContext?.dangerLevel,
  });

  useEffect(() => {
    setSelectedId(null);
  }, [encounter?.id, resultText]);

  const showingResult = Boolean(resultText);

  return (
    <section className="encounter-stage">
      <div
        className={`encounter-frame overlay-${overlay} mood-${mood}${showingResult ? " is-showing-result" : ""}`}
        style={{ ["--encounter-bg" as string]: background ? `url(${background})` : "none" }}
      >
        <div className="encounter-header">
          <div
            className={`encounter-text-plate ${showingResult ? "is-result" : "is-intro"}`}
          >
            <div className="encounter-text-plate-face">
              <h2 className="encounter-title font-display">{encounter?.title ?? "Open Water"}</h2>
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
          <>
            <EncounterChoiceGrid
              choices={choices}
              encounter={encounter}
              isDev={isDev}
              lockReasons={lockReasons}
              onConfirm={onChoose}
              onSelect={setSelectedId}
              player={player}
              run={run}
              selectedId={selectedId}
              timeOfDay={timeOfDay}
            />
            <div className="encounter-confirm">
              <button
                className="gold-btn min-w-48"
                disabled={!selected}
                onClick={() => selected && onChoose(selected.id)}
                type="button"
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
