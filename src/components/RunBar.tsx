import { getLocation, getRegionName } from "../data/locations";
import type { RunState } from "../models/types";
import { AffiliationService } from "../services/AffiliationService";
import { IdentityService } from "../services/IdentityService";
import { clockFromTimeOfDay } from "../utils/presentation";
import { formatHudAmount } from "../utils/text";
import { BOUNTY_ART, CrestEmblem, HudArt, HudIcon, TITLE_ART } from "./HudIcons";
import { DevBadge } from "./DevBadge";

type RunBarProps = {
  run: RunState;
  isDev: boolean;
  onMenu: () => void;
  onOpenTime?: () => void;
};

export function RunBar({ run, isDev, onMenu, onOpenTime }: RunBarProps) {
  const location = getLocation(run.currentLocationId);
  const region = location ? getRegionName(location.regionId) : "Unknown seas";
  const place = location?.name ?? "Unknown waters";
  AffiliationService.ensure(run);
  IdentityService.ensure(run);
  const metric = AffiliationService.getHudMetric(run);
  const identity = IdentityService.hudSummary(run);
  const metricDisplay =
    metric.kind === "BOUNTY" ? formatHudAmount(run.player.bounty) : metric.value;
  const metricArt =
    metric.kind === "BOUNTY" || metric.kind === "NOTORIETY" ? BOUNTY_ART : TITLE_ART;

  return (
    <header className="run-bar">
      <div className="run-bar-left">
        <div className="run-cluster run-cluster-nav">
          <button className="run-btn" onClick={onMenu} type="button">
            <HudIcon name="menu" size={18} />
            <span>Menu</span>
          </button>
          <div className="run-cluster run-cluster-time">
            <HudIcon className="run-glyph" name="hourglass" size={22} />
            <button
              className="run-time-btn"
              onClick={onOpenTime}
              type="button"
              title="Day and crew schedule"
            >
              <p className="run-day">Day {run.day}</p>
              <p className="run-clock">{clockFromTimeOfDay(run.timeOfDay)}</p>
            </button>
            {isDev ? <DevBadge /> : null}
          </div>
        </div>
        <p className="run-place run-place-location">
          <HudIcon className="run-glyph" name="pin" size={18} />
          <span>{place}</span>
        </p>
      </div>

      <div className="run-emblem-well" aria-hidden="true">
        <CrestEmblem size={112} />
      </div>

      <div className="run-bar-right">
        <p className="run-place run-place-region">
          <HudIcon className="run-glyph" name="compass" size={18} />
          <span>{region}</span>
        </p>
        <div className="run-cluster run-cluster-wealth">
          <p className="run-wealth">
            <HudArt className="run-glyph" size={18} src={metricArt} />
            <span className="run-wealth-label">{metric.label}</span>
            <strong>{metricDisplay}</strong>
          </p>
          <p
            className="run-wealth run-identity"
            title={`${identity.faction} · ${identity.role} · ${identity.legal}`}
          >
            <HudArt className="run-glyph" size={18} src={TITLE_ART} />
            <span className="run-wealth-label">Identity</span>
            <strong>
              {identity.faction} · {identity.role}
            </strong>
            <span className="run-identity-legal">{identity.legal}</span>
          </p>
        </div>
      </div>
    </header>
  );
}
