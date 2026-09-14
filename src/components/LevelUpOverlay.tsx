import { useEffect, useState } from "react";
import { useIsMobile } from "../hooks/useMediaQuery";
import type { PendingLevelUp, RunState, StatName } from "../models/types";
import { ProgressionService } from "../services/ProgressionService";
import { STAT_LABELS } from "../utils/text";
import { StatIcon } from "./StatIcon";

const STATS: StatName[] = ["strength", "defense", "speed", "willpower", "charisma", "intelligence"];

type LevelUpOverlayProps = {
  run: RunState;
  pending: PendingLevelUp;
  onConfirm: (stat: StatName) => void;
  queueIndex?: number;
  queueTotal?: number;
  submitting?: boolean;
};

export function LevelUpOverlay({
  run,
  pending,
  onConfirm,
  queueIndex,
  queueTotal,
  submitting = false,
}: LevelUpOverlayProps) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<StatName | null>(null);
  const [ready, setReady] = useState(false);
  const name = ProgressionService.getDisplayName(run, pending.characterId);
  const stats = ProgressionService.getStats(run, pending.characterId);
  const pendingKey = `${pending.characterId}-${pending.fromLevel}-${pending.toLevel}`;
  const showQueue = Boolean(queueTotal && queueTotal > 1 && queueIndex);

  useEffect(() => {
    setSelected(null);
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [pendingKey]);

  return (
    <div className={`level-up-shell${isMobile ? " is-mobile-merged" : ""}`}>
      <section className="level-up-overlay panel">
        <header className="level-up-header">
          <h2 className="level-up-title font-display">Level Up!</h2>
          {showQueue ? (
            <p className="level-up-queue text-parchment-dim">
              {queueIndex} of {queueTotal}
            </p>
          ) : null}
          <p className="level-up-character font-display">{name}</p>
          <p className="level-up-level-line font-display" aria-live="polite">
            <span className="level-up-lv-prefix">LV</span>
            <span className="level-up-level-from">{pending.fromLevel}</span>
            <span className="level-up-level-arrow" aria-hidden="true">
              →
            </span>
            <span className="level-up-level-to">{pending.toLevel}</span>
          </p>
        </header>

        <div className={`level-up-choose${ready ? " is-ready" : ""}`}>
          <p className="level-up-prompt">
            {isMobile
              ? "Tap a current stat to raise it by +1, then Confirm."
              : "Choose one stat to increase by +1."}
          </p>

          {isMobile ? (
            <ul
              aria-label={`${name} current stats`}
              className={`level-up-stats-list is-selectable${selected ? " has-selection" : ""}`}
            >
              {STATS.map((stat) => {
                const value = stats[stat];
                const isSelected = selected === stat;
                return (
                  <li key={stat}>
                    <button
                      className={`level-up-stats-row${isSelected ? " is-selected" : ""}`}
                      disabled={!ready || submitting}
                      onClick={() => setSelected(stat)}
                      type="button"
                    >
                      <span className="level-up-stats-icon">
                        <StatIcon showTooltip={false} size={40} stat={stat} />
                      </span>
                      <span className="level-up-stats-label">{STAT_LABELS[stat]}</span>
                      <span className="level-up-stats-value">
                        {value}
                        {isSelected ? (
                          <span className="level-up-stats-delta"> → {value + 1}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className={`level-up-stat-grid${selected ? " has-selection" : ""}`}>
              {STATS.map((stat) => (
                <li key={stat}>
                  <button
                    className={`level-up-stat-btn ${selected === stat ? "is-selected" : ""}`}
                    disabled={!ready || submitting}
                    onClick={() => setSelected(stat)}
                    type="button"
                  >
                    <span className="level-up-stat-icon-wrap">
                      <StatIcon showTooltip={false} size={120} stat={stat} />
                    </span>
                    <span className="level-up-stat-label">{STAT_LABELS[stat]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            className="gold-btn level-up-confirm"
            disabled={!ready || !selected || submitting}
            onClick={() => selected && onConfirm(selected)}
            type="button"
          >
            Confirm
          </button>
        </div>
      </section>

      {!isMobile ? (
        <aside className="level-up-stats-panel panel" aria-label={`${name} current stats`}>
          <p className="level-up-stats-kicker">Current stats</p>
          <h3 className="level-up-stats-name font-display">{name}</h3>
          <p className="level-up-stats-level text-parchment-dim">
            LV {pending.fromLevel}
            <span aria-hidden="true"> → </span>
            <span className="text-gold">LV {pending.toLevel}</span>
          </p>
          <ul className="level-up-stats-list">
            {STATS.map((stat) => {
              const value = stats[stat];
              const isSelected = selected === stat;
              return (
                <li className={`level-up-stats-row${isSelected ? " is-selected" : ""}`} key={stat}>
                  <span className="level-up-stats-icon">
                    <StatIcon showTooltip={false} size={40} stat={stat} />
                  </span>
                  <span className="level-up-stats-label">{STAT_LABELS[stat]}</span>
                  <span className="level-up-stats-value">
                    {value}
                    {isSelected ? <span className="level-up-stats-delta"> → {value + 1}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
