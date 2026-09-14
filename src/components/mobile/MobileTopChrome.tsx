import { getLocation } from "../../data/locations";
import type { RunState } from "../../models/types";
import { MpService } from "../../services/MpService";
import { ProgressionService } from "../../services/ProgressionService";
import { clockFromTimeOfDay } from "../../utils/presentation";
import { DevBadge } from "../DevBadge";
import { HpBar } from "../HpBar";
import { HudIcon } from "../HudIcons";
import { ResourceBar } from "../ResourceBar";

type MobileTopChromeProps = {
  run: RunState;
  isDev: boolean;
  onMenu: () => void;
  onOpenTime?: () => void;
  onOpenCharacter: () => void;
};

/**
 * Single mobile chrome strip: menu / day-time / location + name/level / HP-MP-XP.
 * Replaces the separate RunBar + MobileVitalsStrip to free encounter space.
 */
export function MobileTopChrome({
  run,
  isDev,
  onMenu,
  onOpenTime,
  onOpenCharacter,
}: MobileTopChromeProps) {
  const location = getLocation(run.currentLocationId);
  const place = location?.name ?? "Unknown waters";
  const { player } = run;
  const progression = ProgressionService.getProgression(run, "player");
  const xp = ProgressionService.xpProgress(progression);

  return (
    <header className="mobile-top-chrome">
      <div className="mobile-top-chrome-meta">
        <div className="mobile-top-chrome-nav">
          <button aria-label="Menu" className="run-btn" onClick={onMenu} type="button">
            <HudIcon name="menu" size={18} />
          </button>
          <button
            className="run-time-btn mobile-top-chrome-time"
            onClick={onOpenTime}
            type="button"
            title="Day and crew schedule"
          >
            <HudIcon className="run-glyph" name="hourglass" size={18} />
            <span className="mobile-top-chrome-time-text">
              <span className="run-day">Day {run.day}</span>
              <span className="run-clock">{clockFromTimeOfDay(run.timeOfDay)}</span>
            </span>
          </button>
          {isDev ? <DevBadge /> : null}
        </div>
        <p className="mobile-top-chrome-place">
          <span>{place}</span>
        </p>
      </div>

      <button className="mobile-top-chrome-vitals" onClick={onOpenCharacter} type="button">
        <div className="mobile-vitals-identity">
          <strong className="font-display">{player.name}</strong>
          <span>LV {progression.level}</span>
        </div>
        <div className="mobile-vitals-bars">
          <HpBar hp={player.hp} maxHp={player.maxHp} />
          <ResourceBar
            current={player.mp ?? MpService.maxMpFor(player)}
            kind="mp"
            max={player.maxMp ?? MpService.maxMpFor(player)}
          />
          <ResourceBar current={xp.current} kind="xp" label="XP" max={xp.needed} />
        </div>
      </button>
    </header>
  );
}
