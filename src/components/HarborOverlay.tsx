import { useMemo, useState } from "react";
import type { PlayerShip, RunState } from "../models/types";
import { VoyageService } from "../services/VoyageService";
import { IslandService } from "../services/IslandService";
import { IslandPressureService } from "../services/IslandPressureService";
import { AffiliationService } from "../services/AffiliationService";

type HarborOverlayProps = {
  run: RunState;
  onOpenCrew: () => void;
  onOpenInventory: () => void;
  onDepart: (toIslandId: string) => void;
  onLeave: () => void;
};

type Dest = ReturnType<typeof VoyageService.listDestinations>[number];

function mapPosition(id: string, index: number, total: number): { left: string; top: string } {
  // Stable pseudo-random placement from id hash, biased into a ring so nodes don't stack.
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const angle = ((hash % 360) / 360) * Math.PI * 2 + (index / Math.max(1, total)) * 0.7;
  const radius = 28 + (hash % 18);
  const left = 50 + Math.cos(angle) * radius;
  const top = 48 + Math.sin(angle) * (radius * 0.72);
  return {
    left: `${Math.max(8, Math.min(92, left))}%`,
    top: `${Math.max(12, Math.min(88, top))}%`,
  };
}

export function HarborOverlay({
  run,
  onOpenCrew,
  onOpenInventory,
  onDepart,
  onLeave,
}: HarborOverlayProps) {
  const ship = VoyageService.ensureShip(run);
  const island = IslandService.getCurrentIsland(run);
  if (island) {
    IslandPressureService.ensure(island);
  }
  const destinations = VoyageService.listDestinations(run);
  const [selectedId, setSelectedId] = useState<string | null>(destinations[0]?.id ?? null);
  const selected = destinations.find((d) => d.id === selectedId) ?? null;
  const crewLabel = AffiliationService.getCrewLabel(run);
  const availableCrew = run.crew.filter(
    (member) => member.status !== "Unavailable" && member.status !== "Missing",
  ).length;

  const mapNodes = useMemo(() => {
    const nodes: Array<{ id: string; name: string; current?: boolean; dest?: Dest; pos: { left: string; top: string } }> =
      [];
    if (island) {
      nodes.push({
        id: island.id,
        name: island.name,
        current: true,
        pos: { left: "50%", top: "50%" },
      });
    }
    destinations.forEach((dest, index) => {
      nodes.push({
        id: dest.id,
        name: dest.name,
        dest,
        pos: mapPosition(dest.id, index, destinations.length),
      });
    });
    return nodes;
  }, [island, destinations]);

  return (
    <div className="overlay-scrim harbor-scrim">
      <section className="harbor-shell panel">
        <header className="harbor-head">
          <div>
            <p className="hud-kicker">Harbor</p>
            <h2 className="font-display text-3xl text-gold">{island?.name ?? "Docks"}</h2>
            <p className="harbor-sub">
              Ship, crew, cargo, and departure — chart a course on the world map.
            </p>
            {island ? (
              <p className="harbor-pressure">{IslandPressureService.summary(island)}</p>
            ) : null}
          </div>
          <ShipCard ship={ship} />
        </header>

        <div className="harbor-actions">
          <button className="choice-btn" onClick={onOpenCrew} type="button">
            {crewLabel}
            <span className="harbor-action-meta">{availableCrew} ready ashore</span>
          </button>
          <button className="choice-btn" onClick={onOpenInventory} type="button">
            Cargo &amp; Inventory
            <span className="harbor-action-meta">{run.player.inventory.length} stacks</span>
          </button>
        </div>

        <div className="harbor-depart">
          <p className="detail-label">World map</p>
          {destinations.length === 0 ? (
            <p className="harbor-empty">No other islands are charted yet.</p>
          ) : (
            <div className="world-map-layout">
              <div className="world-map" role="list" aria-label="Discovered islands">
                <div className="world-map-sea" aria-hidden="true" />
                {mapNodes.map((node) => (
                  <button
                    aria-current={node.current ? "true" : undefined}
                    aria-pressed={!node.current && node.id === selectedId}
                    className={`world-map-node${node.current ? " is-current" : ""}${
                      !node.current && node.id === selectedId ? " is-selected" : ""
                    }`}
                    disabled={Boolean(node.current)}
                    key={node.id}
                    onClick={() => {
                      if (!node.current) {
                        setSelectedId(node.id);
                      }
                    }}
                    style={{ left: node.pos.left, top: node.pos.top }}
                    type="button"
                  >
                    <span className="world-map-pin" />
                    <span className="world-map-label">{node.name}</span>
                    {!node.current && node.dest ? (
                      <span className="world-map-eta">~{node.dest.etaSlots}w</span>
                    ) : (
                      <span className="world-map-eta">Here</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="world-map-detail">
                {selected ? (
                  <>
                    <h3 className="font-display text-2xl text-gold">{selected.name}</h3>
                    <p className="harbor-action-meta">
                      {selected.region.replace(/_/g, " ")} · {selected.archetype.replace(/_/g, " ")} ·
                      danger {selected.dangerLevel}
                    </p>
                    <p className="harbor-action-meta">
                      Distance {selected.distance} · ~{selected.etaSlots} watch
                      {selected.etaSlots === 1 ? "" : "es"} · trust {selected.trustLevel} · pressure{" "}
                      {selected.pressureLevel}
                    </p>
                    <p className="harbor-action-meta">
                      {selected.facilities.slice(0, 6).join(" · ") || "Sparse docks"}
                      {selected.lastVisitedDay != null
                        ? ` · last visit day ${selected.lastVisitedDay}`
                        : " · unvisited"}
                    </p>
                    <button
                      className="choice-btn"
                      onClick={() => onDepart(selected.id)}
                      type="button"
                    >
                      Sail to {selected.name}
                    </button>
                  </>
                ) : (
                  <p className="harbor-empty">Select an island on the map.</p>
                )}

                <ul className="harbor-dest-list world-map-list">
                  {destinations.map((dest) => (
                    <li key={dest.id}>
                      <button
                        className={`choice-btn harbor-dest-btn${
                          dest.id === selectedId ? " is-selected" : ""
                        }`}
                        onClick={() => setSelectedId(dest.id)}
                        type="button"
                      >
                        <span className="harbor-dest-title">{dest.name}</span>
                        <span className="harbor-action-meta">
                          ~{dest.etaSlots} watch{dest.etaSlots === 1 ? "" : "es"} · danger{" "}
                          {dest.dangerLevel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer className="harbor-foot">
          <button className="ghost-btn" onClick={onLeave} type="button">
            Return to town
          </button>
        </footer>
      </section>
    </div>
  );
}

function ShipCard({ ship }: { ship: PlayerShip }) {
  return (
    <div className="harbor-ship-card">
      <p className="hud-kicker">Vessel</p>
      <strong>{ship.name}</strong>
      <dl className="harbor-ship-stats">
        <div>
          <dt>Speed</dt>
          <dd>{ship.speed.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Hull</dt>
          <dd>{Math.round(ship.condition)}%</dd>
        </div>
      </dl>
    </div>
  );
}

type VoyageProgressBarProps = {
  voyage: import("../models/types").ActiveVoyage;
  shipName: string;
  timeOfDay: string;
  day: number;
};

export function VoyageProgressBar({ voyage, shipName, timeOfDay, day }: VoyageProgressBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, voyage.progress)) * 100);
  const clock = timeOfDay.charAt(0) + timeOfDay.slice(1).toLowerCase();
  return (
    <section className="voyage-bar panel" aria-live="polite">
      <div className="voyage-bar-head">
        <p className="hud-kicker">At sea</p>
        <h2 className="font-display text-2xl text-gold">{shipName}</h2>
        <p className="voyage-bar-dest">
          Bound for <strong>{voyage.toIslandName}</strong>
        </p>
      </div>
      <div
        className="voyage-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Voyage progress ${pct} percent`}
      >
        <div className="voyage-track-fill" style={{ width: `${pct}%` }} />
        <span className="voyage-ship-marker" style={{ left: `${pct}%` }} aria-hidden="true" />
      </div>
      <div className="voyage-bar-meta">
        <span>{pct}% of the crossing</span>
        <span>
          Day {day} · {clock}
        </span>
        <span>
          {voyage.slotsElapsed} watch{voyage.slotsElapsed === 1 ? "" : "es"} elapsed
        </span>
      </div>
      <p className="voyage-bar-hint">The crew holds the course. Sea events pause the voyage.</p>
    </section>
  );
}
