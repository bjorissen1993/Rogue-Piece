import { getLocation } from "../../data/locations";
import type { RunState } from "../../models/types";
import { MpService } from "../../services/MpService";
import { ProgressionService } from "../../services/ProgressionService";
import { clockFromTimeOfDay } from "../../utils/presentation";
import { DevBadge } from "../DevBadge";
import { HudIcon } from "../HudIcons";

type MobileTopChromeProps = {
  run: RunState;
  isDev: boolean;
  onOpenTime?: () => void;
  onOpenCharacter: () => void;
};

type StatChipProps = {
  label: string;
  current: number;
  max: number;
  kind: "hp" | "mp" | "xp";
};

function MobileStatChip({ label, current, max, kind }: StatChipProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className={`mobile-stat-chip mobile-stat-chip-${kind}`}>
      <div className="mobile-stat-chip-head">
        <span className="mobile-stat-chip-label">{label}</span>
        <span className="mobile-stat-chip-value">
          {current}/{max}
        </span>
      </div>
      <div className="mobile-stat-chip-track">
        <div className="mobile-stat-chip-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Compact mobile chrome: day/time + location + name/level + HP/MP/XP.
 * Menu lives in the bottom MORE tab — no duplicate hamburger here.
 */
export function MobileTopChrome({
  run,
  isDev,
  onOpenTime,
  onOpenCharacter,
}: MobileTopChromeProps) {
  const location = getLocation(run.currentLocationId);
  const place = location?.name ?? "Unknown waters";
  const { player } = run;
  const progression = ProgressionService.getProgression(run, "player");
  const xp = ProgressionService.xpProgress(progression);
  const mpMax = player.maxMp ?? MpService.maxMpFor(player);
  const mpCurrent = player.mp ?? mpMax;

  return (
    <header className="mobile-top-chrome">
      <div className="mobile-top-chrome-head">
        <button
          className="mobile-top-chrome-time"
          onClick={onOpenTime}
          type="button"
          title="Day and crew schedule"
        >
          <HudIcon className="mobile-top-chrome-time-icon" name="hourglass" size={14} />
          <span className="mobile-top-chrome-time-line">
            Day {run.day} · {clockFromTimeOfDay(run.timeOfDay)}
          </span>
        </button>

        <p className="mobile-top-chrome-place" title={place}>
          {place}
        </p>

        <button
          className="mobile-top-chrome-identity"
          onClick={onOpenCharacter}
          type="button"
          title="Character sheet"
        >
          <strong className="font-display">{player.name}</strong>
          <span>Lv {progression.level}</span>
        </button>

        {isDev ? <DevBadge /> : null}
      </div>

      <button className="mobile-top-chrome-stats" onClick={onOpenCharacter} type="button">
        <MobileStatChip current={player.hp} kind="hp" label="HP" max={player.maxHp} />
        <MobileStatChip current={mpCurrent} kind="mp" label="MP" max={mpMax} />
        <MobileStatChip current={xp.current} kind="xp" label="XP" max={xp.needed} />
      </button>
    </header>
  );
}
