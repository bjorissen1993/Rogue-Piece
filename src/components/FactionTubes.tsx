import { useState } from "react";
import { FACTIONS, getFaction } from "../data/factions";
import type { CareerFactionId, RelationFactionId, RunState } from "../models/types";
import { FactionService, relationshipStatus } from "../services/FactionService";
import { AffiliationService } from "../services/AffiliationService";
import { FACTION_ART, HudArt, HudIcon } from "./HudIcons";
import { FactionOverview } from "./faction/FactionOverview";

const RELATION_TO_CAREER: Partial<Record<RelationFactionId, CareerFactionId>> = {
  MARINES: "MARINES",
  PIRATES: "PIRATES",
  WORLD_GOVERNMENT: "WORLD_GOVERNMENT",
  REVOLUTIONARY_ARMY: "REVOLUTIONARY_ARMY",
  CIVILIANS: "CIVILIAN",
};

type FactionTubesProps = {
  run: RunState;
};

const TUBE_CLASS: Record<RelationFactionId, string> = {
  MARINES: "tube-marines",
  PIRATES: "tube-pirates",
  WORLD_GOVERNMENT: "tube-wg",
  CIVILIANS: "tube-civilians",
  REVOLUTIONARY_ARMY: "tube-rev",
};

const TUBE_LABEL: Record<RelationFactionId, string> = {
  MARINES: "Marines",
  PIRATES: "Pirates",
  WORLD_GOVERNMENT: "World Gov.",
  CIVILIANS: "Civilians",
  REVOLUTIONARY_ARMY: "Revolution",
};

function fillPercent(value: number): number {
  return ((value + 100) / 200) * 100;
}

function signedValue(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function statusTone(value: number): string {
  if (value >= 8) return "is-good";
  if (value > -8) return "is-neutral";
  if (value > -25) return "is-warn";
  return "is-bad";
}

function FactionMark({ id }: { id: RelationFactionId }) {
  return <HudArt className="tube-art faction-icon-img" size={58} src={FACTION_ART[id]} />;
}

export function FactionTubes({ run }: FactionTubesProps) {
  const [openId, setOpenId] = useState<RelationFactionId | null>(null);
  const visible = FACTIONS.filter((faction) =>
    FactionService.isFactionDiscovered(run, faction.id),
  );
  const revRevealed =
    FactionService.isFactionDiscovered(run, "REVOLUTIONARY_ARMY") ||
    run.world.flags.includes("revolutionary_revealed") ||
    run.runFlags.includes("revolutionary_revealed");
  const lore = revRevealed
    ? "A hidden army has stepped from rumor into daylight."
    : "The winds of change have not yet stirred...";

  const openFaction = openId ? getFaction(openId) : null;

  return (
    <>
      <aside className="faction-hud">
        <p className="hud-kicker">Factions</p>
        <div className={`tube-row ${visible.length > 3 ? "tube-row-four" : ""}`}>
          {visible.map((faction) => {
            const rel = FactionService.getRelationship(run, faction.id);
            const fill = fillPercent(rel.value);
            const status = relationshipStatus(rel.value);
            const careerId = RELATION_TO_CAREER[faction.id];
            const isMember =
              faction.id !== "CIVILIANS" &&
              Boolean(careerId && AffiliationService.belongsToFaction(run, careerId));
            return (
              <button
                aria-label={`${faction.name}: ${signedValue(rel.value)} ${status}${isMember ? ", member" : ""}. Open faction overview.`}
                className={`tube-wrap ${TUBE_CLASS[faction.id]} ${openId === faction.id ? "open" : ""} ${isMember ? "is-member" : ""}`}
                key={faction.id}
                onClick={() => setOpenId(faction.id)}
                type="button"
              >
                <span className="tube-label">
                  {TUBE_LABEL[faction.id]}
                  {isMember ? " ★" : ""}
                </span>
                <div className="tube-instrument">
                  <div className="tube-column">
                    <span className="tube-icon" aria-hidden>
                      <FactionMark id={faction.id} />
                    </span>
                    <div className="tube-frame">
                      <span className="tube-cap tube-cap-top" />
                      <div className="tube-glass">
                        <div className="tube-neutral" />
                        <div className="tube-liquid" style={{ height: `${fill}%` }}>
                          <span className="tube-meniscus" />
                        </div>
                      </div>
                      <span className="tube-cap tube-cap-bottom" />
                    </div>
                  </div>
                </div>
                <span className={`tube-readout ${statusTone(rel.value)}`}>
                  <span className="tube-value">{signedValue(rel.value)}</span>
                  <span className="tube-status">{isMember ? "Member" : status}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className={`faction-lore ${revRevealed ? "is-open" : "is-locked"}`}>
          <p>{lore}</p>
          {revRevealed ? null : <HudIcon className="faction-lock" name="lock" size={13} />}
        </div>
      </aside>

      {openFaction && openId ? (
        <FactionOverview factionId={openId} onClose={() => setOpenId(null)} run={run} />
      ) : null}
    </>
  );
}
