import { useEffect, useState } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
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
  participantIds: string[];
  lockReasons?: EncounterChoiceLockMap;
  isDev?: boolean;
  confirmOnRetap?: boolean;
  onSelect: (choiceId: string) => void;
  onConfirm: (choiceId: string, participantIds?: string[]) => void;
};

export function EncounterChoiceGrid({
  choices,
  encounter,
  timeOfDay,
  player,
  run,
  selectedId,
  participantIds,
  lockReasons,
  isDev = false,
  confirmOnRetap = true,
  onSelect,
  onConfirm,
}: EncounterChoiceGridProps) {
  const isMobile = useIsMobile();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const multi = choices.length > 1;

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const index = choices.findIndex((choice) => choice.id === selectedId);
    if (index >= 0) {
      setCarouselIndex(index);
    }
  }, [selectedId, choices]);

  useEffect(() => {
    setCarouselIndex((current) => Math.min(current, Math.max(0, choices.length - 1)));
  }, [choices.length]);

  const go = (delta: number) => {
    if (!multi) {
      return;
    }
    setCarouselIndex((current) => {
      const next = (current + delta + choices.length) % choices.length;
      return next;
    });
  };

  if (!isMobile) {
    return (
      <div className={`${choiceCountClass(choices.length)}${selectedId ? " has-selection" : ""}`}>
        {choices.map((choice) => {
          const lockReason = lockReasons?.[choice.id];
          return (
            <EncounterChoiceCard
              choice={choice}
              confirmOnRetap={confirmOnRetap}
              dimmed={Boolean(selectedId) && selectedId !== choice.id}
              encounter={encounter}
              isDev={isDev}
              key={choice.id}
              locked={Boolean(lockReason)}
              lockReason={lockReason}
              onConfirm={onConfirm}
              onSelect={onSelect}
              participantIds={selectedId === choice.id ? participantIds : []}
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

  const active = choices[carouselIndex] ?? choices[0];
  if (!active) {
    return null;
  }
  const lockReason = lockReasons?.[active.id];

  return (
    <div
      aria-roledescription="carousel"
      className={`choice-carousel${selectedId ? " has-selection" : ""}`}
    >
      <div className="choice-carousel-row">
        {multi ? (
          <button
            aria-label="Previous choice"
            className="choice-carousel-arrow"
            onClick={() => go(-1)}
            type="button"
          >
            ‹
          </button>
        ) : (
          <span aria-hidden="true" className="choice-carousel-arrow-spacer" />
        )}

        <div className="choice-carousel-stage">
          <EncounterChoiceCard
            choice={active}
            confirmOnRetap={confirmOnRetap}
            dimmed={false}
            encounter={encounter}
            isDev={isDev}
            locked={Boolean(lockReason)}
            lockReason={lockReason}
            onConfirm={onConfirm}
            onSelect={onSelect}
            participantIds={selectedId === active.id ? participantIds : []}
            player={player}
            run={run}
            selected={selectedId === active.id}
            timeOfDay={timeOfDay}
          />
        </div>

        {multi ? (
          <button
            aria-label="Next choice"
            className="choice-carousel-arrow"
            onClick={() => go(1)}
            type="button"
          >
            ›
          </button>
        ) : (
          <span aria-hidden="true" className="choice-carousel-arrow-spacer" />
        )}
      </div>

      {multi ? (
        <p className="choice-carousel-index" aria-live="polite">
          {carouselIndex + 1} / {choices.length}
        </p>
      ) : null}
    </div>
  );
}
