import { useMemo, useState } from "react";
import type { RunState } from "../models/types";
import { AfflictionService } from "../services/AfflictionService";
import { CharacterScheduleService } from "../services/CharacterScheduleService";
import {
  CLINIC_BED_COST,
  CLINIC_TREAT_COST,
  ClinicCareService,
} from "../services/ClinicCareService";
import { IslandService } from "../services/IslandService";
import { ProgressionService } from "../services/ProgressionService";
import { FacilityActionCard, FacilityMemberCard, facilityMemberIds } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type ClinicCareFocus = "treat" | "ward";

type ClinicCareOverlayProps = {
  run: RunState;
  focus?: ClinicCareFocus;
  onTreat: (characterId: string) => string;
  onHospitalize: (characterId: string) => string;
  onFundWing: () => string;
  onClose: () => void;
};

export function ClinicCareOverlay({
  run,
  focus = "treat",
  onTreat,
  onHospitalize,
  onFundWing,
  onClose,
}: ClinicCareOverlayProps) {
  const roster = useMemo(() => facilityMemberIds(run), [run]);
  const [selectedId, setSelectedId] = useState(roster[0] ?? run.player.id);
  const [tab, setTab] = useState<ClinicCareFocus>(focus);
  const [flash, setFlash] = useState("");

  const name = ProgressionService.getDisplayName(run, selectedId);
  const vitals = ClinicCareService.vitals(run, selectedId);
  const affliction = AfflictionService.badgeTip(run, selectedId);
  const hospitalized = ClinicCareService.isHospitalized(run, selectedId);
  const busy = CharacterScheduleService.busySummary(run, selectedId);
  const island = IslandService.getCurrentIsland(run);
  const wingFunded = Boolean(island?.fundedProjects?.includes("clinic_wing"));
  const patients = ClinicCareService.patients(run);

  return (
    <OverlayFrame elevate eyebrow="Clinic" onClose={onClose} title={tab === "ward" ? "Ward" : "Heal / Treat"}>
      <div className="crew-tabs" role="tablist">
        <button
          className={tab === "treat" ? "crew-tab is-active" : "crew-tab"}
          onClick={() => setTab("treat")}
          type="button"
        >
          Heal / Treat
        </button>
        <button
          className={tab === "ward" ? "crew-tab is-active" : "crew-tab"}
          onClick={() => setTab("ward")}
          type="button"
        >
          Ward
        </button>
      </div>

      <div className="facility-crew-split">
        <ul className={`facility-roster-grid${selectedId ? " has-selection" : ""}`}>
          {roster.map((id) => (
            <li key={id}>
              <FacilityMemberCard
                characterId={id}
                onClick={() => setSelectedId(id)}
                run={run}
                selected={selectedId === id}
              />
            </li>
          ))}
        </ul>

        <aside className="detail-panel panel facility-detail">
          <div>
            <p className="overlay-eyebrow">{tab === "ward" ? "Recovery bed" : "Nurse's table"}</p>
            <h3 className="font-display text-2xl text-gold">{name}</h3>
            <p className="facility-detail-copy">
              {vitals.hp}/{vitals.maxHp} HP
              {affliction ? ` · ${affliction.split("\n")[0]}` : " · no toxins"}
            </p>
            {busy ? <p className="facility-detail-copy">{busy}</p> : null}
          </div>

          {tab === "treat" ? (
            <div className="facility-action-grid">
              <FacilityActionCard
                body="The nurse wraps, cleans, and sends them out upright."
                disabled={run.player.berries < CLINIC_TREAT_COST}
                kicker={`฿${CLINIC_TREAT_COST} · wounds & toxins`}
                onClick={() => setFlash(onTreat(selectedId))}
                title="Pay for treatment"
              />
              <FacilityActionCard
                body={
                  wingFunded
                    ? "Clean linen and a second cot already stand in the back room."
                    : "Coin becomes extra beds and a quieter ward."
                }
                disabled={wingFunded || run.player.berries < 180}
                kicker={wingFunded ? "Already funded" : "฿180 · island project"}
                onClick={() => setFlash(onFundWing())}
                title="Fund a clinic wing"
              />
            </div>
          ) : (
            <div className="facility-action-grid">
              <p className="facility-detail-copy">
                {patients.length
                  ? `In beds: ${patients.map((id) => ProgressionService.getDisplayName(run, id)).join(", ")}`
                  : "No crewmates in a clinic bed. Book a cot for anyone who cannot walk it off."}
              </p>
              <FacilityActionCard
                body="They rest under a stern nurse. World time still moves."
                disabled={hospitalized || run.player.berries < CLINIC_BED_COST}
                kicker={hospitalized ? "Already recovering" : `฿${CLINIC_BED_COST} · proper care`}
                onClick={() => setFlash(onHospitalize(selectedId))}
                title={hospitalized ? `${name} is already here` : "Book a recovery bed"}
              />
            </div>
          )}

          <p className="facility-flash" aria-live="polite">
            {flash || "\u00a0"}
          </p>
          <p className="facility-purse">Your berries · ฿{run.player.berries}</p>
        </aside>
      </div>
    </OverlayFrame>
  );
}
