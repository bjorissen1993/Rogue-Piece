import { DEVIL_FRUITS } from "../data/devilFruits";
import type { ProfileSave } from "../models/types";
import { formatBounty } from "../utils/text";
import { OverlayFrame } from "./OverlayFrame";

type StatisticsOverlayProps = {
  profile: ProfileSave;
  onClose: () => void;
};

export function StatisticsOverlay({ profile, onClose }: StatisticsOverlayProps) {
  const stats = profile.statistics;
  const fights = stats.combatWins + stats.combatLosses;
  const winPct = fights > 0 ? (stats.combatWins / fights) * 100 : 0;
  const fruitTotal = DEVIL_FRUITS.length;
  const fruitPct = fruitTotal > 0 ? (stats.fruitsDiscovered / fruitTotal) * 100 : 0;
  const averageRun = stats.deaths > 0 ? stats.daysSurvivedTotal / stats.deaths : stats.longestRunDays;
  const longest = Math.max(1, stats.longestRunDays);
  const avgPct = Math.min(100, (averageRun / longest) * 100);

  return (
    <OverlayFrame eyebrow="LEDGER" title="Statistics" onClose={onClose}>
      <div className="overlay-scroll">
        <div className="hero-stats">
          <article className="hero-stat panel">
            <p className="hud-kicker">Runs</p>
            <p className="font-display value text-gold">{stats.runsStarted}</p>
          </article>
          <article className="hero-stat panel">
            <p className="hud-kicker">Longest Run</p>
            <p className="font-display value text-gold">{stats.longestRunDays}</p>
            <p className="mt-1 text-sm text-parchment-dim">days at sea</p>
          </article>
          <article className="hero-stat panel">
            <p className="hud-kicker">Highest Bounty</p>
            <p className="font-display value text-gold">{formatBounty(stats.highestBounty)}</p>
          </article>
        </div>

        <div className="stat-viz">
          <article className="panel p-5">
            <p className="hud-kicker">Combat Record</p>
            <p className="font-display mt-2 text-3xl">
              {stats.combatWins} – {stats.combatLosses}
            </p>
            <div className="bar-track mt-4">
              <div className="bar-win h-full" style={{ width: `${fights ? winPct : 50}%` }} />
              <div className="bar-loss h-full" style={{ width: `${fights ? 100 - winPct : 50}%` }} />
            </div>
            <p className="mt-3 text-sm text-parchment-dim">
              {fights ? `${Math.round(winPct)}% victories` : "No clashes recorded"}
            </p>
          </article>
          <article className="panel flex items-center gap-5 p-5">
            <div className="progress-ring" style={{ ["--pct" as string]: `${fruitPct * 3.6}deg` }}>
              <div className="progress-ring-value">
                <span className="progress-ring-found">{stats.fruitsDiscovered}</span>
                <span className="progress-ring-total">/ {fruitTotal}</span>
              </div>
            </div>
            <div>
              <p className="hud-kicker">Devil Fruits</p>
              <p className="font-display mt-2 text-3xl">Discovered</p>
              <p className="mt-1 text-parchment-dim">{stats.fruitsEaten} eaten</p>
            </div>
          </article>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="panel p-5">
            <p className="hud-kicker">Survival</p>
            <div className="compare-bars mt-4">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Average run</span>
                  <span>{averageRun ? averageRun.toFixed(1) : "—"} days</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
                  <div className="compare-fill h-full" style={{ width: `${avgPct}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Longest run</span>
                  <span>{stats.longestRunDays} days</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
                  <div className="compare-fill h-full" style={{ width: "100%" }} />
                </div>
              </div>
            </div>
          </article>
          <article className="panel grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="hud-kicker">Deaths</p>
              <p className="font-display mt-1 text-3xl">{stats.deaths}</p>
            </div>
            <div>
              <p className="hud-kicker">Encounters</p>
              <p className="font-display mt-1 text-3xl">{stats.encountersCompleted}</p>
            </div>
          </article>
        </div>
      </div>
    </OverlayFrame>
  );
}
