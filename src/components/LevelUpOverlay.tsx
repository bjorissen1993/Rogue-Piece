import { useEffect, useState, type CSSProperties } from "react";
import type { PendingLevelUp, RunState, StatName } from "../models/types";
import { ProgressionService } from "../services/ProgressionService";
import { STAT_LABELS } from "../utils/text";
import { StatIcon } from "./StatIcon";

const STATS: StatName[] = ["strength", "defense", "speed", "willpower", "charisma"];
const TOP_STATS = STATS.slice(0, 3);
const BOTTOM_STATS = STATS.slice(3);

type LevelUpPhase = "hold" | "swap" | "swapped" | "choose";

type LevelUpOverlayProps = {
  run: RunState;
  pending: PendingLevelUp;
  onConfirm: (stat: StatName) => void;
};

function StatChoiceButton({
  stat,
  selected,
  onSelect,
}: {
  stat: StatName;
  selected: StatName | null;
  onSelect: (stat: StatName) => void;
}) {
  return (
    <li>
      <button
        className={`level-up-stat-btn ${selected === stat ? "is-selected" : ""}`}
        onClick={() => onSelect(stat)}
        type="button"
      >
        <span className="level-up-stat-icon-wrap">
          <StatIcon showTooltip={false} size={144} stat={stat} />
        </span>
        <span className="level-up-stat-label">{STAT_LABELS[stat]}</span>
      </button>
    </li>
  );
}

export function LevelUpOverlay({ run, pending, onConfirm }: LevelUpOverlayProps) {
  const [phase, setPhase] = useState<LevelUpPhase>("hold");
  const [selected, setSelected] = useState<StatName | null>(null);
  const name = ProgressionService.getDisplayName(run, pending.characterId);

  useEffect(() => {
    const swapTimer = window.setTimeout(() => setPhase("swap"), 1600);
    const swappedTimer = window.setTimeout(() => setPhase("swapped"), 2400);
    const chooseTimer = window.setTimeout(() => setPhase("choose"), 3600);
    return () => {
      window.clearTimeout(swapTimer);
      window.clearTimeout(swappedTimer);
      window.clearTimeout(chooseTimer);
    };
  }, []);

  const showChoose = phase === "choose";

  return (
    <section className="level-up-overlay panel">
      <h2 className="level-up-title font-display">Level Up!</h2>

      <div className="level-up-body">
        <div className="level-up-stage">
          <div className={`level-up-celebrate-block${showChoose ? " is-exiting" : ""}`}>
            <div className="level-up-character-wrap">
              <p
                className="level-up-character font-display"
                style={{ "--name-len": name.length } as CSSProperties}
              >
                {name}
              </p>
            </div>
            <p className="level-up-level-line font-display" aria-live="polite">
              <span className="level-up-lv-prefix">LV</span>
              <span className="level-up-digit-wrap">
                <span className={`level-up-digit ${phase === "hold" ? "is-current" : "is-out"}`}>
                  {pending.fromLevel}
                </span>
                <span
                  className={`level-up-digit is-next ${phase === "swap" || phase === "swapped" || showChoose ? "is-in" : ""}`}
                >
                  {pending.toLevel}
                </span>
              </span>
            </p>
          </div>

          <div className={`level-up-choose-block${showChoose ? " is-visible" : ""}`}>
            <p className="level-up-prompt">Choose one stat to increase by +1.</p>
            <div className={`level-up-stat-layout${selected ? " has-selection" : ""}`}>
              <ul className="level-up-stat-row level-up-stat-row-top">
                {TOP_STATS.map((stat) => (
                  <StatChoiceButton key={stat} onSelect={setSelected} selected={selected} stat={stat} />
                ))}
              </ul>
              <ul className="level-up-stat-row level-up-stat-row-bottom">
                {BOTTOM_STATS.map((stat) => (
                  <StatChoiceButton key={stat} onSelect={setSelected} selected={selected} stat={stat} />
                ))}
              </ul>
            </div>
            <button
              className="gold-btn level-up-confirm"
              disabled={!selected}
              onClick={() => selected && onConfirm(selected)}
              type="button"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
