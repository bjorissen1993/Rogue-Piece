import type { RunState } from "../models/types";
import { FacilityActionCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type NavalEscapeOverlayProps = {
  run: RunState;
  onAct: (action: "sail" | "evade" | "cannon" | "bribe" | "sneak") => void;
};

export function NavalEscapeOverlay({ run, onAct }: NavalEscapeOverlayProps) {
  const chase = run.pendingNavalEscape;
  if (!chase) {
    return null;
  }
  return (
    <OverlayFrame elevate eyebrow="Harbor blockade" onClose={() => onAct("evade")} title="Naval Escape">
      <div className="encounter-choice">
        <p className="encounter-choice-lede">
          {chase.factionId.replaceAll("_", " ")} pursuit: {chase.ships} ship
          {chase.ships === 1 ? "" : "s"} on your stern.
        </p>
        <p className="encounter-choice-meta">Distance {chase.distance}/5. Open water is the only way out.</p>
        <div className="facility-action-grid is-two">
          <FacilityActionCard
            body="Pile on canvas and run the channel."
            kicker="Speed"
            onClick={() => onAct("sail")}
            title="Full sail"
          />
          <FacilityActionCard
            body="Cut close, change heading, make them miss."
            kicker="Finesse"
            onClick={() => onAct("evade")}
            title="Evasive maneuver"
          />
          <FacilityActionCard
            body="A broadside to buy distance — or start a fight."
            kicker="Iron"
            onClick={() => onAct("cannon")}
            title="Cannon fire"
          />
          <FacilityActionCard
            body="Hug the rocks and slip the watch."
            kicker="Quiet"
            onClick={() => onAct("sneak")}
            title="Sneak out"
          />
          <FacilityActionCard
            body="A purse on the right desk can open the boom."
            kicker="Coin"
            onClick={() => onAct("bribe")}
            title="Bribe official"
          />
        </div>
      </div>
    </OverlayFrame>
  );
}
