import { useEffect, useRef, useState, type ReactNode, type WheelEvent } from "react";
import type { SkillBadgeRef } from "../models/types";
import { SkillBadgeRow } from "./SkillBadgeRow";

export const CHOICE_WHEEL_ICON_SIZE = 200;
const WHEEL_STEP_REM = 8.5;
const WHEEL_SIDE_SCALE = 0.74;
const WHEEL_ANIM_MS = 240;

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

function bridgeOffsets(count: number): number[] {
  if (count <= 1) {
    return [0];
  }
  return [-2, -1, 0, 1, 2];
}

type ChoiceWheelProps = {
  options: ChoiceWheelOption[];
  onHoverHint: (hint: string | null) => void;
  onFocusChange: (option: ChoiceWheelOption | null) => void;
  disabled?: boolean;
  className?: string;
  /** Horizontal spacing between wheel slots (rem). */
  stepRem?: number;
};

export function ChoiceWheel({
  options,
  onHoverHint,
  onFocusChange,
  disabled,
  className = "",
  stepRem = WHEEL_STEP_REM,
}: ChoiceWheelProps) {
  const [focus, setFocus] = useState(0);
  const [motion, setMotion] = useState(0);
  const [instant, setInstant] = useState(false);
  const locked = useRef(false);
  const wheelLock = useRef(0);
  const multi = options.length > 1;

  useEffect(() => {
    setFocus(0);
    setMotion(0);
    locked.current = false;
  }, [options.length, options[0]?.id]);

  useEffect(() => {
    const current = options[wrapIndex(focus, options.length)] ?? null;
    onHoverHint(current?.hint ?? null);
    onFocusChange(current);
    return () => {
      onHoverHint(null);
      onFocusChange(null);
    };
  }, [focus, options.length, options[0]?.id, options[focus]?.id, onHoverHint, onFocusChange]);

  if (!options.length) {
    return <p className="combat-wheel-empty">No options available.</p>;
  }

  const rotate = (delta: number) => {
    if (disabled || locked.current || !multi || delta === 0) {
      return;
    }
    locked.current = true;
    setInstant(false);
    const dir = delta > 0 ? 1 : -1;
    setMotion(dir);
    window.setTimeout(() => {
      setInstant(true);
      setFocus((current) => wrapIndex(current + dir, options.length));
      setMotion(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setInstant(false);
          locked.current = false;
        });
      });
    }, WHEEL_ANIM_MS);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!multi || Math.abs(event.deltaY) < 2) {
      return;
    }
    const now = Date.now();
    if (now - wheelLock.current < WHEEL_ANIM_MS) {
      return;
    }
    wheelLock.current = now;
    rotate(event.deltaY > 0 ? 1 : -1);
  };

  const offsets = bridgeOffsets(options.length);

  return (
    <div
      className={`combat-choice-wheel-wrap ${multi ? "has-arrows" : "is-single"} ${className}`.trim()}
    >
      <div className="combat-choice-wheel-row">
        {multi ? (
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
          {offsets.map((offset) => {
            const option = options[wrapIndex(focus + offset, options.length)];
            const visual = offset - motion;
            const isFocus = Math.abs(visual) < 0.01;
            const absVisual = Math.abs(visual);
            const scale = isFocus ? 1 : absVisual >= 1.5 ? 0.62 : WHEEL_SIDE_SCALE;
            const opacity = isFocus ? 1 : absVisual >= 1.5 ? 0.4 : 0.78;
            const y = isFocus ? 0.45 : 0.95;
            return (
              <button
                className={`combat-wheel-option ${isFocus ? "is-focus" : ""} ${instant ? "is-instant" : ""} ${option.disabled ? "is-disabled" : ""} ${option.selected ? "is-picked" : ""}`}
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
                style={{
                  transform: `translateX(${visual * stepRem}rem) translateY(${y}rem) scale(${scale})`,
                  opacity,
                  zIndex: isFocus ? 12 : Math.max(1, 8 - Math.round(absVisual)),
                  cursor: "pointer",
                }}
                tabIndex={isFocus ? 0 : -1}
                type="button"
              >
                <span className="combat-wheel-icon">
                  {option.icon}
                </span>
                <span className="combat-wheel-label">{option.title}</span>
                {isFocus ? <span className="combat-wheel-cost">{option.costLabel}</span> : null}
                {isFocus && option.badges?.length ? (
                  <SkillBadgeRow
                    badges={option.badges}
                    className="combat-wheel-badges"
                    layout="column"
                    size={60}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        {multi ? (
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
