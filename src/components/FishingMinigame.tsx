import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  applyFishingRedTimerBonus,
  applyFishingTimerBonus,
  fishingArcContains,
  FISH_CATCH_TIERS,
  FISHING_HITS_TO_CATCH,
  FISHING_TIMER_MS,
  rollFishingZones,
  type FishCatchTier,
  type FishingArc,
  type FishingGaugeZones,
} from "../data/fishing";
import { SEA_KING_HOOK_LINE, type FishingSessionResult } from "../services/FishingService";

type FishingMinigameProps = {
  seaKingHunt?: boolean;
  onClose: () => void;
  onFinish: (result: FishingSessionResult) => string;
};

type SessionPhase = "cast" | "result";
type FinishKind = "fish" | "escape" | "seaKing";

const CX = 140;
const CY = 140;
const TRACK_R = 108;
const TRACK_STROKE = 16;
const PIN_R = 118;
const TIMER_R = TRACK_R - TRACK_STROKE / 2;
const ZONE_OUTER = TRACK_R + TRACK_STROKE / 2 + 3;
const ZONE_INNER = TRACK_R - TRACK_STROKE / 2 - 3;

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeRingSlice(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  widthDeg: number,
): string {
  const outerStart = polar(cx, cy, outerR, startDeg);
  const outerEnd = polar(cx, cy, outerR, startDeg + widthDeg);
  const innerEnd = polar(cx, cy, innerR, startDeg + widthDeg);
  const innerStart = polar(cx, cy, innerR, startDeg);
  const large = widthDeg > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function speedForHit(hitIndex: number): number {
  return 155 + hitIndex * 38;
}

function ZoneArc({
  arc,
  className,
}: {
  arc: FishingArc;
  className: "fishing-green" | "fishing-gold" | "fishing-red";
}) {
  return (
    <path
      className={className}
      d={describeRingSlice(CX, CY, ZONE_INNER, ZONE_OUTER, arc.start, arc.width)}
    />
  );
}

export function FishingMinigame({ seaKingHunt = false, onClose, onFinish }: FishingMinigameProps) {
  const [phase, setPhase] = useState<SessionPhase>("cast");
  const [hits, setHits] = useState(0);
  const [goldMarks, setGoldMarks] = useState<boolean[]>([]);
  const [redHits, setRedHits] = useState(0);
  const [zones, setZones] = useState<FishingGaugeZones>(() =>
    rollFishingZones(0, { includeRed: seaKingHunt }),
  );
  const [pinAngle, setPinAngle] = useState(0);
  const [flash, setFlash] = useState<"hit" | "gold" | "miss" | "red" | null>(null);
  const [resultLine, setResultLine] = useState("");
  const [resultTier, setResultTier] = useState<FishCatchTier | null>(null);
  const [seaKingResult, setSeaKingResult] = useState(false);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(FISHING_TIMER_MS);

  const pinRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(speedForHit(0));
  const zonesRef = useRef(zones);
  const hitsRef = useRef(0);
  const greenRef = useRef(0);
  const goldRef = useRef(0);
  const grayRef = useRef(0);
  const redRef = useRef(0);
  const startedAtRef = useRef(0);
  const attemptedRef = useRef(false);
  const lockedRef = useRef(false);
  const finishedRef = useRef(false);
  const finishSentRef = useRef(false);
  const pendingResultRef = useRef<FishingSessionResult | null>(null);
  const frameRef = useRef(0);
  const lastTsRef = useRef(0);
  const timeLeftRef = useRef(FISHING_TIMER_MS);
  const finishRef = useRef<(kind: FinishKind) => void>(() => undefined);
  const huntRef = useRef(seaKingHunt);
  huntRef.current = seaKingHunt;

  zonesRef.current = zones;

  const buildResult = useCallback((kind: FinishKind): FishingSessionResult => {
    const elapsedMs = attemptedRef.current ? performance.now() - startedAtRef.current : 0;
    return {
      caught: kind === "fish",
      attempted: attemptedRef.current,
      elapsedMs,
      greenHits: greenRef.current,
      goldHits: goldRef.current,
      grayHits: grayRef.current,
      redHits: redRef.current,
      timeLeftMs: timeLeftRef.current,
      seaKingHooked: kind === "seaKing",
    };
  }, []);

  const finishSession = useCallback(
    (kind: FinishKind) => {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      lockedRef.current = true;
      setLocked(true);
      const result = buildResult(kind);
      if (kind === "seaKing") {
        pendingResultRef.current = result;
        setSeaKingResult(true);
        setResultTier(null);
        setResultLine(SEA_KING_HOOK_LINE);
        setPhase("result");
        return;
      }
      finishSentRef.current = true;
      const line = onFinish(result);
      if (kind === "fish") {
        const matched = FISH_CATCH_TIERS.find((entry) => line.includes(entry.name)) ?? null;
        setResultTier(matched);
        setResultLine(line || "You reeled in a catch.");
      } else {
        setResultTier(null);
        setResultLine(line || "The fish slipped the hook.");
      }
      setPhase("result");
    },
    [buildResult, onFinish],
  );
  finishRef.current = finishSession;

  const confirmResult = useCallback(() => {
    if (!finishSentRef.current && pendingResultRef.current) {
      finishSentRef.current = true;
      onFinish(pendingResultRef.current);
    }
    onClose();
  }, [onClose, onFinish]);

  useEffect(() => {
    const tick = (ts: number) => {
      if (!lastTsRef.current) {
        lastTsRef.current = ts;
      }
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      if (!finishedRef.current) {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - dt * 1000);
        setTimeLeft(timeLeftRef.current);
        if (timeLeftRef.current <= 0) {
          if (!attemptedRef.current) {
            attemptedRef.current = true;
            startedAtRef.current = performance.now();
          }
          finishRef.current("escape");
        }
      }
      if (!lockedRef.current && !finishedRef.current) {
        pinRef.current = normalizeDeg(pinRef.current + dirRef.current * speedRef.current * dt);
        setPinAngle(pinRef.current);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const rerollAfterHit = useCallback((nextHits: number) => {
    lockedRef.current = true;
    setLocked(true);
    window.setTimeout(() => {
      const nextZones = rollFishingZones(nextHits, { includeRed: huntRef.current });
      zonesRef.current = nextZones;
      setZones(nextZones);
      dirRef.current *= -1;
      speedRef.current = speedForHit(nextHits);
      setFlash(null);
      lockedRef.current = false;
      setLocked(false);
    }, 420);
  }, []);

  const hook = useCallback(() => {
    if (lockedRef.current || phase !== "cast") {
      return;
    }
    if (!attemptedRef.current) {
      attemptedRef.current = true;
      startedAtRef.current = performance.now();
    }
    const angle = pinRef.current;
    const z = zonesRef.current;
    const onRed = Boolean(z.red && fishingArcContains(angle, z.red));
    const onGreen = z.greens.some((arc) => fishingArcContains(angle, arc));
    const onGold = fishingArcContains(angle, z.gold);
    if (onRed) {
      const nextRed = redRef.current + 1;
      redRef.current = nextRed;
      timeLeftRef.current = applyFishingRedTimerBonus(timeLeftRef.current);
      setTimeLeft(timeLeftRef.current);
      setRedHits(nextRed);
      setFlash("red");
      if (nextRed >= FISHING_HITS_TO_CATCH) {
        finishSession("seaKing");
        return;
      }
      rerollAfterHit(Math.max(hitsRef.current, nextRed));
      return;
    }
    if (!onGreen && !onGold) {
      grayRef.current += 1;
      setFlash("miss");
      window.setTimeout(() => {
        if (!finishedRef.current) {
          setFlash(null);
        }
      }, 280);
      return;
    }
    const nextHits = hitsRef.current + 1;
    hitsRef.current = nextHits;
    timeLeftRef.current = applyFishingTimerBonus(timeLeftRef.current, onGold);
    setTimeLeft(timeLeftRef.current);
    if (onGold) {
      goldRef.current += 1;
      setFlash("gold");
    } else {
      greenRef.current += 1;
      setFlash("hit");
    }
    setGoldMarks((prev) => [...prev, onGold]);
    setHits(nextHits);
    if (nextHits >= FISHING_HITS_TO_CATCH) {
      finishSession("fish");
      return;
    }
    rerollAfterHit(nextHits);
  }, [finishSession, phase, rerollAfterHit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (phase === "result") {
          confirmResult();
        }
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (phase === "cast") {
          hook();
        } else {
          confirmResult();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmResult, hook, phase]);

  const onScreenClick = (event: MouseEvent<HTMLDivElement>) => {
    if (phase !== "cast") {
      return;
    }
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    hook();
  };

  const pinTip = polar(CX, CY, PIN_R, pinAngle);
  const pinInner = polar(CX, CY, 10, pinAngle);
  const timerRadius = TIMER_R * (timeLeft / FISHING_TIMER_MS);
  const timerLow = timeLeft / FISHING_TIMER_MS <= 0.28;
  const flashClass =
    flash === "gold"
      ? " is-gold is-refill"
      : flash === "hit"
        ? " is-hit is-refill"
        : flash === "red"
          ? " is-red is-refill"
          : flash === "miss"
            ? " is-miss"
            : "";

  const node = (
    <div className="overlay-scrim overlay-scrim-elevated fishing-scrim" onClick={onScreenClick}>
      <section className="fishing-panel" aria-label="Fishing">
        <header className="fishing-head">
          <div>
            <p className="overlay-eyebrow">Shallows · 1 time slot</p>
            <h2 className="font-display text-3xl text-gold">Fishing</h2>
          </div>
        </header>

        {phase === "cast" ? (
          <>
            <p className="fishing-copy">
              {seaKingHunt
                ? "Click anywhere to hook. Green or gold still catch fish. Land the red slice three times to hook the Sea King."
                : "Click anywhere to hook. Land green or gold three times. Gray keeps your hits. When the red disk hits the center, the fish is gone."}
            </p>
            <div className="fishing-pips" aria-label={`${hits} of ${FISHING_HITS_TO_CATCH} hits`}>
              {Array.from({ length: FISHING_HITS_TO_CATCH }, (_, i) => (
                <span
                  className={`fishing-pip${i < hits ? (goldMarks[i] ? " is-gold" : " is-on") : ""}`}
                  key={i}
                />
              ))}
            </div>
            {seaKingHunt ? (
              <div
                className="fishing-pips is-sea-king"
                aria-label={`${redHits} of ${FISHING_HITS_TO_CATCH} Sea King hits`}
              >
                {Array.from({ length: FISHING_HITS_TO_CATCH }, (_, i) => (
                  <span className={`fishing-pip${i < redHits ? " is-red" : ""}`} key={i} />
                ))}
              </div>
            ) : null}
            <p className="fishing-flash" aria-live="polite">
              {flash === "gold"
                ? "Gold — time back"
                : flash === "hit"
                  ? "Hit — time back"
                  : flash === "red"
                    ? "Red — Sea King"
                    : flash === "miss"
                      ? "Gray"
                      : "\u00a0"}
            </p>
            <div
              className={`fishing-gauge${flashClass}${locked ? " is-locked" : ""}${timerLow ? " is-low" : ""}`}
            >
              <svg className="fishing-svg" viewBox="0 0 280 280">
                <circle className="fishing-track-outer" cx={CX} cy={CY} r={TRACK_R + 10} />
                <circle className="fishing-track" cx={CX} cy={CY} r={TRACK_R} />
                <circle className="fishing-timer-well" cx={CX} cy={CY} r={TIMER_R} />
                {timerRadius > 0.4 ? (
                  <circle className="fishing-timer" cx={CX} cy={CY} r={timerRadius} />
                ) : null}
                <ZoneArc arc={zones.greens[0]} className="fishing-green" />
                <ZoneArc arc={zones.greens[1]} className="fishing-green" />
                <ZoneArc arc={zones.gold} className="fishing-gold" />
                {zones.red ? <ZoneArc arc={zones.red} className="fishing-red" /> : null}
                <line className="fishing-pin" x1={pinInner.x} y1={pinInner.y} x2={pinTip.x} y2={pinTip.y} />
              </svg>
            </div>
          </>
        ) : (
          <div className="fishing-result">
            {seaKingResult ? (
              <>
                <p className="fishing-result-rarity is-sea-king">Sea King</p>
                <h3 className="font-display text-3xl text-gold">Hooked</h3>
              </>
            ) : resultTier ? (
              <>
                <p className={`fishing-result-rarity is-${resultTier.rarity}`}>{resultTier.rarity}</p>
                <h3 className="font-display text-3xl text-gold">{resultTier.name}</h3>
              </>
            ) : (
              <h3 className="font-display text-3xl text-gold">Got away</h3>
            )}
            <p className="fishing-copy">{resultLine}</p>
            <button className="gold-btn fishing-hook-btn" onClick={confirmResult} type="button">
              {seaKingResult ? "Face it" : "Back to shore"}
            </button>
          </div>
        )}
      </section>
    </div>
  );

  if (typeof document === "undefined") {
    return node;
  }
  return createPortal(node, document.body);
}
