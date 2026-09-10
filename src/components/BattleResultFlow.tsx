import { useCallback, useEffect, useRef, useState } from "react";
import { LevelUpOverlay } from "./LevelUpOverlay";
import type { BattleResultReport, BattleXpSnapshot, PendingLevelUp, RunState, StatName } from "../models/types";

type BattleResultFlowProps = {
  report: BattleResultReport;
  run: RunState;
  pendingLevelUp: PendingLevelUp | null;
  onConfirmLevelUp: (stat: StatName) => void;
  onComplete: () => void;
};

function xpPercent(current: number, needed: number): number {
  if (needed <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (current / needed) * 100));
}

const GAIN_POP_MS = 520;
const GAIN_HOLD_MS = 1000;
const XP_FILL_MS = 980;
const XP_PLING_MS = 280;
const SCREEN_TO_GAIN_MS = 1000;

type XpAnimPhase =
  | "idle"
  | "gain"
  | "fill-cap"
  | "pling-at-cap"
  | "snap-reset"
  | "fill-rest"
  | "fill-single"
  | "done";

function AnimatedXpGain({
  entry,
  delayMs,
  onAnimationComplete,
}: {
  entry: BattleXpSnapshot;
  delayMs: number;
  onAnimationComplete: (characterId: string) => void;
}) {
  const [phase, setPhase] = useState<XpAnimPhase>("idle");
  const [displayLevel, setDisplayLevel] = useState(entry.levelBefore);
  const [displayXp, setDisplayXp] = useState(entry.xpBefore);
  const [displayNeeded, setDisplayNeeded] = useState(entry.xpNeededBefore);
  const [barTransition, setBarTransition] = useState(true);
  const [pling, setPling] = useState(false);
  const reportedDone = useRef(false);

  useEffect(() => {
    const startTimer = window.setTimeout(() => setPhase("gain"), delayMs);
    return () => window.clearTimeout(startTimer);
  }, [delayMs]);

  useEffect(() => {
    if (phase === "gain") {
      const timer = window.setTimeout(() => {
        setPhase(entry.leveledUp ? "fill-cap" : "fill-single");
      }, GAIN_POP_MS + GAIN_HOLD_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === "fill-cap") {
      const raf = window.requestAnimationFrame(() => {
        setDisplayXp(entry.xpNeededBefore);
      });
      const capTimer = window.setTimeout(() => setPhase("pling-at-cap"), XP_FILL_MS);
      return () => {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(capTimer);
      };
    }

    if (phase === "pling-at-cap") {
      setPling(true);
      const plingTimer = window.setTimeout(() => {
        setPling(false);
        setPhase("snap-reset");
      }, XP_PLING_MS);
      return () => window.clearTimeout(plingTimer);
    }

    if (phase === "snap-reset") {
      setBarTransition(false);
      setDisplayLevel(entry.levelAfter);
      setDisplayXp(0);
      setDisplayNeeded(entry.xpNeededAfter);

      const snapRaf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setBarTransition(true);
          setDisplayXp(entry.xpAfter);
          setPhase("fill-rest");
        });
      });

      return () => window.cancelAnimationFrame(snapRaf);
    }

    if (phase === "fill-rest") {
      const restTimer = window.setTimeout(() => setPhase("done"), XP_FILL_MS);
      return () => window.clearTimeout(restTimer);
    }

    if (phase === "fill-single") {
      const raf = window.requestAnimationFrame(() => {
        setDisplayLevel(entry.levelAfter);
        setDisplayXp(entry.xpAfter);
        setDisplayNeeded(entry.xpNeededAfter);
      });
      const singleTimer = window.setTimeout(() => setPhase("done"), XP_FILL_MS);
      return () => {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(singleTimer);
      };
    }

    return undefined;
  }, [entry, phase]);

  useEffect(() => {
    if (phase !== "done" || reportedDone.current) {
      return;
    }
    reportedDone.current = true;
    onAnimationComplete(entry.characterId);
  }, [entry.characterId, onAnimationComplete, phase]);

  const pct = xpPercent(displayXp, displayNeeded);
  const showGain = phase !== "idle";

  return (
    <article className="battle-xp-card panel">
      <div className="battle-xp-card-head">
        <h3 className="font-display text-xl">{entry.name}</h3>
        <span className={`battle-xp-gain ${showGain ? "is-visible" : ""}`}>+{entry.xpEarned} XP</span>
      </div>
      <div className="resource-bar resource-bar-xp">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="tracking-wide text-gold">Lv {displayLevel}</span>
          <span>
            {displayXp} / {displayNeeded}
          </span>
        </div>
        <div className={`resource-bar-track resource-bar-track-xp battle-xp-track${pling ? " is-pling" : ""}`}>
          <div
            className={`resource-bar-fill resource-bar-fill-xp battle-xp-fill${barTransition ? "" : " battle-xp-fill--instant"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="battle-level-up font-display" aria-hidden={!(entry.leveledUp && phase === "done")}>
        {entry.leveledUp && phase === "done" ? "Level Up!" : "\u00a0"}
      </p>
    </article>
  );
}

function participationLabel(participation: string): string {
  switch (participation) {
    case "ACTIVE":
      return "Active fighter";
    case "SUPPORT":
      return "Support";
    case "CORE":
      return "Core crew";
    default:
      return participation.toLowerCase();
  }
}

export function BattleResultFlow({
  report,
  run,
  pendingLevelUp,
  onConfirmLevelUp,
  onComplete,
}: BattleResultFlowProps) {
  const [step, setStep] = useState<"victory" | "stats">("victory");
  const [completedCount, setCompletedCount] = useState(0);
  const [victoryAcknowledged, setVictoryAcknowledged] = useState(false);
  const completedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.documentElement.classList.add("battle-result-open");
    return () => document.documentElement.classList.remove("battle-result-open");
  }, []);

  const handleAnimationComplete = useCallback((characterId: string) => {
    if (completedIds.current.has(characterId)) {
      return;
    }
    completedIds.current.add(characterId);
    setCompletedCount(completedIds.current.size);
  }, []);

  const allAnimationsDone = completedCount >= report.xpSnapshots.length;
  const showLevelUp =
    victoryAcknowledged && step === "victory" && pendingLevelUp != null && allAnimationsDone;

  const levelUpOverlayKey = pendingLevelUp
    ? `${pendingLevelUp.characterId}-${pendingLevelUp.fromLevel}-${pendingLevelUp.toLevel}`
    : null;

  const handleVictoryContinue = () => {
    if (!allAnimationsDone) {
      return;
    }
    setVictoryAcknowledged(true);
    if (!pendingLevelUp) {
      setStep("stats");
    }
  };

  useEffect(() => {
    if (victoryAcknowledged && allAnimationsDone && !pendingLevelUp && step === "victory") {
      setStep("stats");
    }
  }, [allAnimationsDone, pendingLevelUp, step, victoryAcknowledged]);

  const fighters = report.contributions.filter(
    (entry) =>
      entry.participation === "ACTIVE" ||
      entry.participation === "SUPPORT" ||
      entry.damageDealt > 0 ||
      entry.damageTaken > 0 ||
      entry.healingDone > 0 ||
      entry.xpEarned > 0,
  );

  const totalDamage = fighters.reduce((sum, entry) => sum + entry.damageDealt, 0);
  const mvp = fighters.reduce<(typeof fighters)[number] | null>((best, entry) => {
    if (!best || entry.damageDealt > best.damageDealt) {
      return entry;
    }
    return best;
  }, null);

  const enemyLabel = report.enemyNames.length ? report.enemyNames.join(", ") : "the enemy";

  if (step === "victory") {
    return (
      <div className="battle-result-scrim">
        {showLevelUp && pendingLevelUp && levelUpOverlayKey ? (
          <div className="battle-result-levelup-scrim">
            <LevelUpOverlay
              key={levelUpOverlayKey}
              onConfirm={onConfirmLevelUp}
              pending={pendingLevelUp}
              run={run}
            />
          </div>
        ) : null}

        <section className={`battle-result-panel battle-result-panel-victory panel${showLevelUp ? " is-backgrounded" : ""}`}>
          <p className="hud-kicker">Battle Complete</p>
          <h2 className="battle-result-title font-display">Victory</h2>
          <p className="battle-result-subtitle text-parchment-dim">
            Round {report.round} · vs {enemyLabel}
            {report.threatLevel ? ` · ${report.threatLevel.toLowerCase()}` : ""}
          </p>

          <div className="battle-xp-grid">
            {report.xpSnapshots.map((entry, index) => (
              <AnimatedXpGain
                delayMs={SCREEN_TO_GAIN_MS + index * 80}
                entry={entry}
                key={entry.characterId}
                onAnimationComplete={handleAnimationComplete}
              />
            ))}
          </div>

          <button
            className="gold-btn min-w-48 battle-result-btn"
            disabled={!allAnimationsDone}
            onClick={handleVictoryContinue}
            type="button"
          >
            Continue
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="battle-result-scrim">
      <section className="battle-result-panel panel battle-result-panel-wide">
        <p className="hud-kicker">Battle Report</p>
        <h2 className="battle-result-title font-display">Aftermath</h2>
        <p className="battle-result-subtitle text-parchment-dim">
          {totalDamage} total damage dealt{mvp ? ` · MVP: ${mvp.name}` : ""}
        </p>

        <div className="battle-stats-table-wrap">
          <table className="battle-stats-table">
            <thead>
              <tr>
                <th>Character</th>
                <th>Role</th>
                <th>Damage</th>
                <th>Taken</th>
                <th>Healing</th>
                <th>MP</th>
                <th>XP</th>
              </tr>
            </thead>
            <tbody>
              {fighters.map((entry) => (
                <tr key={entry.combatantId}>
                  <td className="battle-stats-name">{entry.name}</td>
                  <td>{participationLabel(entry.participation)}</td>
                  <td>{entry.damageDealt}</td>
                  <td>{entry.damageTaken}</td>
                  <td>{entry.healingDone || "—"}</td>
                  <td>{entry.mpSpent ? entry.mpSpent : "—"}</td>
                  <td className="text-gold">+{entry.xpEarned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="battle-stats-summary">
          <div>
            <span className="detail-label">Rounds</span>
            <p>{report.round}</p>
          </div>
          <div>
            <span className="detail-label">Opponents</span>
            <p>{enemyLabel}</p>
          </div>
          <div>
            <span className="detail-label">Threat</span>
            <p>{report.threatLevel ?? "—"}</p>
          </div>
          <div>
            <span className="detail-label">Type</span>
            <p>{report.combatKind ?? "NORMAL"}</p>
          </div>
        </div>

        <button className="gold-btn min-w-48 battle-result-btn" onClick={onComplete} type="button">
          Continue
        </button>
      </section>
    </div>
  );
}
