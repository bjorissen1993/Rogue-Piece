import { TIME_OF_DAY_ORDER } from "../game/constants";
import type { RunState, TimeOfDay } from "../models/types";
import { CharacterScheduleService } from "../services/CharacterScheduleService";
import { remainingSlotsToday } from "../utils/presentation";
import { OverlayFrame } from "./OverlayFrame";

type TimeDetailOverlayProps = {
  run: RunState;
  onClose: () => void;
};

function slotLabel(slot: TimeOfDay): string {
  return slot.charAt(0) + slot.slice(1).toLowerCase();
}

export function TimeDetailOverlay({ run, onClose }: TimeDetailOverlayProps) {
  CharacterScheduleService.ensure(run);
  const currentIndex = Math.max(0, TIME_OF_DAY_ORDER.indexOf(run.timeOfDay));
  const remaining = remainingSlotsToday(run.timeOfDay);
  const schedule = CharacterScheduleService.scheduleEntries(run);
  const upcoming = CharacterScheduleService.upcomingCompletions(run);

  return (
    <OverlayFrame eyebrow="Schedule" onClose={onClose} title={`Day ${run.day}`}>
      <div className="time-detail-panel">
        <section>
          <p className="time-detail-current">
            Current: <strong>{slotLabel(run.timeOfDay)}</strong>
          </p>
          <p className="time-detail-remaining">
            <strong>{remaining}</strong> time slot{remaining === 1 ? "" : "s"} remaining today
          </p>
          <ul className="time-slot-list">
            {TIME_OF_DAY_ORDER.map((slot, index) => {
              let mark = "○";
              let state = "available";
              if (index < currentIndex) {
                mark = "✓";
                state = "used";
              } else if (index === currentIndex) {
                mark = "●";
                state = "current";
              }
              return (
                <li className={`time-slot-item is-${state}`} key={slot}>
                  <span aria-hidden="true">{mark}</span>
                  <span>{slotLabel(slot)}</span>
                </li>
              );
            })}
          </ul>
          <p className="time-detail-hint">
            Most activities consume time slots. When daytime slots are used up, the day progresses.
          </p>
        </section>

        <section>
          <h3 className="font-display text-xl text-gold">Crew Schedule</h3>
          <ul className="crew-schedule-list">
            {schedule.map((entry) => (
              <li key={entry.characterId}>
                <strong>{entry.name}</strong>
                <span>{entry.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        {upcoming.length ? (
          <section>
            <h3 className="font-display text-xl text-gold">Upcoming</h3>
            <ul className="crew-schedule-list">
              {upcoming.map((entry) => (
                <li key={`${entry.name}-${entry.label}`}>
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.label} · {entry.when}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </OverlayFrame>
  );
}
