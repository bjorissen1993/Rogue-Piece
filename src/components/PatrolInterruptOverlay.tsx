import { FacilityActionCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type PatrolInterruptOverlayProps = {
  label: string;
  highPressure: boolean;
  onAct: (action: "fight" | "escape" | "hide" | "talk") => void;
};

export function PatrolInterruptOverlay({ label, highPressure, onAct }: PatrolInterruptOverlayProps) {
  return (
    <OverlayFrame elevate eyebrow="Island pressure" onClose={() => onAct("escape")} title="Interrupted">
      <div className="encounter-choice">
        <p className="encounter-choice-lede">{label}</p>
        <div className="facility-action-grid is-two">
          <FacilityActionCard
            body="Draw and settle it in the street."
            kicker="Steel"
            onClick={() => onAct("fight")}
            title="Fight"
          />
          <FacilityActionCard
            body={highPressure ? "They are watching closely. Running is a gamble." : "Break contact and vanish into town."}
            kicker="Flight"
            onClick={() => onAct("escape")}
            title={highPressure ? "Attempt escape" : "Escape"}
          />
          {!highPressure ? (
            <>
              <FacilityActionCard
                body="Wait it out in an alley until the patrol moves on."
                kicker="Still"
                onClick={() => onAct("hide")}
                title="Hide"
              />
              <FacilityActionCard
                body="A story, a smile, or a shared drink."
                kicker="Words"
                onClick={() => onAct("talk")}
                title="Talk"
              />
            </>
          ) : null}
        </div>
      </div>
    </OverlayFrame>
  );
}
