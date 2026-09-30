import type { LocationOccupation, RelationFactionId } from "../models/types";
import { FacilityActionCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type OccupationOverlayProps = {
  occupation: LocationOccupation;
  label: string;
  onAct: (action: "fight" | "scout" | "sneak" | "negotiate" | "leave") => void;
};

function factionName(id?: RelationFactionId): string {
  return id ? id.replaceAll("_", " ").toLowerCase() : "an enemy faction";
}

export function OccupationOverlay({ occupation, label, onAct }: OccupationOverlayProps) {
  return (
    <OverlayFrame elevate eyebrow={occupation.state.replaceAll("_", " ")} onClose={() => onAct("leave")} title={label}>
      <div className="encounter-choice">
        <p className="encounter-choice-lede">
          Held by {factionName(occupation.factionId)}. Combat is only one way through.
        </p>
        <div className="facility-action-grid is-two">
          <FacilityActionCard
            body="Draw steel and take the place back."
            kicker="Direct"
            onClick={() => onAct("fight")}
            title="Fight"
          />
          <FacilityActionCard
            body="Count numbers, watch rotations, learn the gap."
            kicker="Quiet"
            onClick={() => onAct("scout")}
            title="Scout"
          />
          <FacilityActionCard
            body="Slip past the watch and work from inside."
            kicker="Risk"
            onClick={() => onAct("sneak")}
            title="Sneak / Infiltrate"
          />
          <FacilityActionCard
            body="Talk first. Coin, threat, or a shared enemy."
            kicker="Words"
            onClick={() => onAct("negotiate")}
            title="Negotiate"
          />
          <FacilityActionCard body="Walk away. The occupation stays." kicker="Leave" onClick={() => onAct("leave")} title="Not today" />
        </div>
      </div>
    </OverlayFrame>
  );
}
