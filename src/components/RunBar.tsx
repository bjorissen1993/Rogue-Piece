import { getLocation, getRegionName } from "../data/locations";
import type { RunState } from "../models/types";
import { AffiliationService } from "../services/AffiliationService";
import { IdentityService } from "../services/IdentityService";
import { IslandService } from "../services/IslandService";
import { clockFromTimeOfDay } from "../utils/presentation";
import { formatHudAmount } from "../utils/text";
import { BOUNTY_ART, HudArt, HudIcon, TimeLoopEmblem, TITLE_ART } from "./HudIcons";
import { DevBadge } from "./DevBadge";

type RunBarProps = {
  run: RunState;
  isDev: boolean;
  onMenu: () => void;
  onOpenTime?: () => void;
  onOpenFactions?: () => void;
  /** Compact phone chrome: menu + day/time + location only. */
  compact?: boolean;
  /** Island hub hotspot editor is active — declutter location/standing chrome. */
  hubMapEditing?: boolean;
  /** Show a mount point for IslandHubMap dev tools (Map / Edit / Export…). */
  showHubMapTools?: boolean;
  onHubToolsHost?: (el: HTMLDivElement | null) => void;
};

export function RunBar({
  run,
  isDev,
  onMenu,
  onOpenTime,
  onOpenFactions,
  compact,
  hubMapEditing = false,
  showHubMapTools = false,
  onHubToolsHost,
}: RunBarProps) {
  const location = getLocation(run.currentLocationId);
  const region = location ? getRegionName(location.regionId) : "Unknown seas";
  const island = IslandService.getCurrentIsland(run);
  const place = island?.name ?? location?.name ?? "Unknown waters";
  AffiliationService.ensure(run);
  IdentityService.ensure(run);
  const metric = AffiliationService.getHudMetric(run);
  const identity = IdentityService.hudSummary(run);
  const metricDisplay =
    metric.kind === "BOUNTY" ? formatHudAmount(run.player.bounty) : metric.value;
  const metricArt =
    metric.kind === "BOUNTY" || metric.kind === "NOTORIETY" ? BOUNTY_ART : TITLE_ART;
  const modeLabel = (run.activityMode ?? "ISLAND") === "SAILING" ? "At sea" : "Ashore";
  const declutter = hubMapEditing;

  return (
    <header className={`run-bar ${compact ? "is-compact" : ""}${declutter ? " is-hub-editing" : ""}`}>
      <div className="run-bar-left">
        <div className="run-cluster run-cluster-nav">
          <button aria-label="Menu" className="run-btn" onClick={onMenu} type="button">
            <HudIcon name="menu" size={18} />
            <span>Menu</span>
          </button>
          {!declutter ? (
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
          ) : isDev ? (
            <DevBadge />
          ) : null}
        </div>
        {!declutter ? (
          <p className="run-place run-place-location" title={`${modeLabel} · ${region}`}>
            <HudIcon className="run-glyph" name="pin" size={18} />
            <span>{place}</span>
          </p>
        ) : null}
      </div>

      {compact || declutter ? null : (
        <div className="run-emblem-well" aria-hidden="true">
          <TimeLoopEmblem timeOfDay={run.timeOfDay} />
        </div>
      )}

      {compact ? null : (
        <div className={`run-bar-right${declutter ? " is-hub-tools-only" : ""}`}>
          {!declutter ? (
            <p className="run-place run-place-region">
              <HudIcon className="run-glyph" name="compass" size={18} />
              <span>{region}</span>
            </p>
          ) : null}
          {!declutter && onOpenFactions ? (
            <button
              aria-label="Faction standing"
              className="run-btn run-btn-factions"
              onClick={onOpenFactions}
              type="button"
              title="Faction standing"
            >
              <HudIcon name="anchor" size={16} />
              <span>Standing</span>
            </button>
          ) : null}
          {showHubMapTools ? (
            <div
              className={`run-bar-hub-tools${declutter ? " is-editing" : ""}`}
              ref={onHubToolsHost}
            />
          ) : null}
          {!declutter ? (
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
          ) : null}
        </div>
      )}
    </header>
  );
}
