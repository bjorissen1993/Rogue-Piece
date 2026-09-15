import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type WheelEvent } from "react";
import type { SkillBadgeRef } from "../models/types";
import { SkillBadgeRow } from "./SkillBadgeRow";

export const CHOICE_WHEEL_ICON_SIZE = 200;
const WHEEL_STEP_REM = 8.5;
const WHEEL_SIDE_SCALE = 0.74;
/** Arc radius for the combat side wheel (rem). */
const WHEEL_ARC_RADIUS_REM = 7.6;
/** Radians between focus and a side slot on the arc. */
const WHEEL_ARC_SPREAD = 1.18;
/** Shift the whole arc toward the right wall (rem). */
const WHEEL_ARC_WALL_NUDGE = 4.6;
const WHEEL_VERTICAL_SIDE_SCALE = 0.7;
const WHEEL_ANIM_MS = 280;

export type ChoiceWheelOption = {
  id: string;
  title: string;
  costLabel: string;
  hint: string;
  disabled?: boolean;
  selected?: boolean;
  icon?: ReactNode;
  badges?: SkillBadgeRef[];
  onConfirm: () => void;
};

function wrapIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

function bridgeOffsets(
  count: number,
  vertical: boolean,
  soloFocus: boolean,
  tripleFocus: boolean,
  motion: number,
): number[] {
  if (count <= 1 || soloFocus) {
    return [0];
  }
  // Vertical / mobile triple: 3 visible slots; during slide, mount the incoming neighbor
  // so it enters from the opposite side (right-swipe ← new from left, and vice versa).
  if (vertical || tripleFocus) {
    if (motion > 0) {
      return [-1, 0, 1, 2];
    }
    if (motion < 0) {
      return [-2, -1, 0, 1];
    }
    return [-1, 0, 1];
  }
  return [-2, -1, 0, 1, 2];
}

function arcPoint(visual: number): { x: number; y: number } {
  const angle = Math.PI + visual * WHEEL_ARC_SPREAD;
  return {
    x: Math.cos(angle) * WHEEL_ARC_RADIUS_REM + WHEEL_ARC_WALL_NUDGE,
    y: -Math.sin(angle) * WHEEL_ARC_RADIUS_REM,
  };
}

type ChoiceWheelProps = {
  options: ChoiceWheelOption[];
  onHoverHint: (hint: string | null) => void;
  onFocusChange: (option: ChoiceWheelOption | null) => void;
  disabled?: boolean;
  className?: string;
  /** Spacing between wheel slots (rem). */
  stepRem?: number;
  /** Horizontal = left/right carousel. Vertical = top/bottom (combat side rail). */
  orientation?: "horizontal" | "vertical";
  /** When false, badges are rendered by the parent (e.g. above skill text). */
  showBadges?: boolean;
  /** Mobile: only render the focused option; keep L/R arrows to cycle. */
  soloFocus?: boolean;
  /** Mobile combat: show prev / focus / next with slide-in neighbors. */
  tripleFocus?: boolean;
  /** Solo-focus Confirm chip above the wheel (combat). Off when a separate Choose/Select exists. */
  showConfirmButton?: boolean;
  /** Horizontal focus badge alignment inside the wheel slot. */
  alignFocus?: "bottom" | "center";
  /** When solo-focus, still show the focused option title (crewmate name under the badge). */
  showFocusLabel?: boolean;
};

export function ChoiceWheel({
  options,
  onHoverHint,
  onFocusChange,
  disabled,
  className = "",
  stepRem,
  orientation = "horizontal",
  showBadges = true,
  soloFocus = false,
  tripleFocus = false,
  showConfirmButton,
  alignFocus = "bottom",
  showFocusLabel = false,
}: ChoiceWheelProps) {
  const [focus, setFocus] = useState(0);
  const [motion, setMotion] = useState(0);
  const [instant, setInstant] = useState(false);
  const locked = useRef(false);
  const wheelLock = useRef(0);
  const multi = options.length > 1;
  const vertical = orientation === "vertical";
  const slotStep = stepRem ?? WHEEL_STEP_REM;
  const optionsKey = `${options.length}:${options[0]?.id ?? ""}`;
  const [syncedOptionsKey, setSyncedOptionsKey] = useState(optionsKey);
  // Reset focus during render when the option list identity changes (avoids one stale frame).
  if (optionsKey !== syncedOptionsKey) {
    setSyncedOptionsKey(optionsKey);
    setFocus(0);
    setMotion(0);
    locked.current = false;
  }

  // Sync parent readout before paint so mobile combat never shows icon/Confirm without text.
  useLayoutEffect(() => {
    const current = options[wrapIndex(focus, options.length)] ?? null;
    onHoverHint(current?.hint ?? null);
    onFocusChange(current);
  }, [focus, options.length, optionsKey, options[focus]?.id, options[focus]?.hint, onHoverHint, onFocusChange]);

  useEffect(() => {
    return () => {
      onHoverHint(null);
      onFocusChange(null);
    };
  }, [onHoverHint, onFocusChange]);

  if (!options.length) {
    return <p className="combat-wheel-empty">No options available.</p>;
  }

  const rotate = (delta: number) => {
    if (disabled || locked.current || !multi || delta === 0) {
      return;
    }
    const dir = delta > 0 ? 1 : -1;
    // Solo-focus (mobile): only one icon is mounted inside a clipped viewport.
    // Sliding it away leaves a description with no usable Confirm/icon underneath.
    if (soloFocus) {
      setFocus((current) => wrapIndex(current + dir, options.length));
      setMotion(0);
      setInstant(false);
      locked.current = false;
      return;
    }
    locked.current = true;
    setInstant(false);
    setMotion(dir);
    window.setTimeout(() => {
      // Snap without transition so the focus slot does not animate back to center.
      setInstant(true);
      setFocus((current) => wrapIndex(current + dir, options.length));
      setMotion(0);
      window.setTimeout(() => {
        setInstant(false);
        locked.current = false;
      }, 40);
    }, WHEEL_ANIM_MS);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!multi || Math.abs(event.deltaY) < 2) {
      return;
    }
    const now = Date.now();
    if (now - wheelLock.current < WHEEL_ANIM_MS + 40) {
      return;
    }
    wheelLock.current = now;
    rotate(event.deltaY > 0 ? 1 : -1);
  };

  const offsets = bridgeOffsets(options.length, vertical, soloFocus, tripleFocus, motion);
  const focusedOption = options[wrapIndex(focus, options.length)];
  const pocket = arcPoint(0);
  // Fixed pocket: confirm stays left of the active slot and does not travel with the arc.
  const selectPos = { x: pocket.x - 5.85, y: pocket.y };
  const renderTopConfirm = showConfirmButton ?? (!vertical && (soloFocus || tripleFocus));

  return (
    <div
      className={`combat-choice-wheel-wrap ${multi ? "has-arrows" : "is-single"} ${vertical ? "is-vertical" : "is-horizontal"} ${soloFocus ? "is-solo-focus" : ""} ${tripleFocus ? "is-triple-focus" : ""} ${className}`.trim()}
    >
      {showBadges ? (
        focusedOption?.badges?.length ? (
          <SkillBadgeRow
            badges={focusedOption.badges}
            className="combat-wheel-badges"
            layout="row"
            size={52}
          />
        ) : (
          <div aria-hidden="true" className="combat-wheel-badges is-spacer" />
        )
      ) : null}
      {renderTopConfirm && focusedOption ? (
        <button
          aria-label={`Confirm ${focusedOption.title}`}
          className="combat-wheel-confirm-btn"
          disabled={disabled || focusedOption.disabled || motion !== 0}
          onClick={() => {
            if (!focusedOption.disabled) {
              focusedOption.onConfirm();
            }
          }}
          type="button"
        >
          Confirm
        </button>
      ) : null}
      <div className="combat-choice-wheel-row">
        {multi && !vertical ? (
          <button
            aria-label="Previous choice"
            className="combat-wheel-arrow"
            disabled={disabled || locked.current}
            onClick={() => rotate(-1)}
            type="button"
          >
            ‹
          </button>
        ) : null}
        <div className="combat-choice-wheel" onWheel={onWheel}>
          {vertical && multi ? (
            <button
              aria-label="Previous choice"
              className="combat-wheel-arrow combat-wheel-arrow-prev"
              disabled={disabled || locked.current}
              onClick={() => rotate(-1)}
              type="button"
            >
              ▴
            </button>
          ) : null}
          {vertical ? (
            <button
              aria-label="Confirm choice"
              className={`combat-wheel-select-btn ${instant || motion !== 0 ? "is-busy" : ""}`}
              disabled={disabled || !focusedOption || focusedOption.disabled || motion !== 0}
              onClick={() => {
                if (focusedOption && !focusedOption.disabled) {
                  focusedOption.onConfirm();
                }
              }}
              style={{
                transform: `translate(${selectPos.x}rem, ${selectPos.y}rem) translate(-50%, -50%)`,
              }}
              type="button"
            >
              ‹
            </button>
          ) : null}
          {offsets.map((offset) => {
            const option = options[wrapIndex(focus + offset, options.length)];
            const visual = offset - motion;
            const isFocus = Math.abs(visual) < 0.01;
            const absVisual = Math.abs(visual);
            const scale = vertical
              ? isFocus
                ? 1
                : WHEEL_VERTICAL_SIDE_SCALE
              : tripleFocus
                ? isFocus
                  ? 1
                  : absVisual >= 1.5
                    ? 0.58
                    : 0.78
                : isFocus
                  ? 1
                  : absVisual >= 1.5
                    ? 0.62
                    : WHEEL_SIDE_SCALE;
            const opacity = vertical
              ? absVisual >= 1.35
                ? 0
                : Math.max(0.28, 1 - absVisual * 0.32)
              : tripleFocus
                ? absVisual >= 2.05
                  ? 0
                  : isFocus
                    ? 1
                    : Math.max(0.35, 1 - absVisual * 0.38)
                : isFocus
                  ? 1
                  : absVisual >= 1.5
                    ? 0.4
                    : 0.78;
            // Solo/triple (mobile): keep badges vertically centered in the slot.
            const compactHorizontal = soloFocus || tripleFocus;
            const drift = vertical || compactHorizontal ? 0 : isFocus ? 0.45 : 0.95;
            const point = arcPoint(visual);
            const transform = vertical
              ? `translate(${point.x}rem, ${point.y}rem) translate(-50%, -50%) scale(${scale})`
              : compactHorizontal
                ? alignFocus === "center"
                  ? `translateX(${visual * slotStep}rem) translateY(-50%) scale(${scale})`
                  : `translateX(${visual * slotStep}rem) scale(${scale})`
                : `translateX(${visual * slotStep}rem) translateY(${drift}rem) scale(${scale})`;
            const optionClass = `combat-wheel-option ${isFocus ? "is-focus" : ""} ${instant ? "is-instant" : ""} ${option.disabled ? "is-disabled" : ""} ${option.selected ? "is-picked" : ""} ${vertical && !isFocus ? "is-side-only" : ""}`;
            const optionStyle = {
              transform,
              opacity,
              zIndex: isFocus ? 12 : Math.max(1, 8 - Math.round(absVisual)),
              cursor: "pointer" as const,
            };

            if (vertical) {
              return (
                <div className={optionClass} key={`slot-${offset}`} style={optionStyle}>
                  <button
                    className="combat-wheel-hit"
                    disabled={disabled}
                    onClick={() => {
                      if (!isFocus) {
                        rotate(visual < 0 ? -1 : 1);
                        return;
                      }
                      if (!option.disabled) {
                        option.onConfirm();
                      }
                    }}
                    tabIndex={isFocus ? 0 : -1}
                    type="button"
                  >
                    <span className="combat-wheel-icon">{option.icon}</span>
                    {isFocus ? (
                      <span className="combat-wheel-meta">
                        <span className="combat-wheel-label">{option.title}</span>
                        <span className="combat-wheel-cost">{option.costLabel}</span>
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            }

            return (
              <button
                className={optionClass}
                disabled={disabled}
                key={`slot-${offset}`}
                onClick={() => {
                  if (!isFocus) {
                    rotate(visual < 0 ? -1 : 1);
                    return;
                  }
                  if (!option.disabled) {
                    option.onConfirm();
                  }
                }}
                style={optionStyle}
                tabIndex={isFocus ? 0 : -1}
                type="button"
              >
                <span className="combat-wheel-icon">{option.icon}</span>
                {compactHorizontal && !showFocusLabel ? null : (
                  <span className="combat-wheel-label">{option.title}</span>
                )}
                {isFocus && !compactHorizontal ? <span className="combat-wheel-cost">{option.costLabel}</span> : null}
              </button>
            );
          })}
          {vertical && multi ? (
            <button
              aria-label="Next choice"
              className="combat-wheel-arrow combat-wheel-arrow-next"
              disabled={disabled || locked.current}
              onClick={() => rotate(1)}
              type="button"
            >
              ▾
            </button>
          ) : null}
        </div>
        {multi && !vertical ? (
          <button
            aria-label="Next choice"
            className="combat-wheel-arrow"
            disabled={disabled || locked.current}
            onClick={() => rotate(1)}
            type="button"
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  );
}
