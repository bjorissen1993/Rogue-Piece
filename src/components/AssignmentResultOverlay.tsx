import type { RunState } from "../models/types";
import { FacilityActionCard, FacilityMemberCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type AssignmentResultOverlayProps = {
  run: RunState;
  onDismiss: () => void;
};

export function AssignmentResultOverlay({ run, onDismiss }: AssignmentResultOverlayProps) {
  const reports = run.pendingAssignmentResults ?? [];
  if (!reports.length) {
    return null;
  }

  return (
    <OverlayFrame elevate eyebrow="Return" onClose={onDismiss} title="Crew Returns">
      <p className="encounter-choice-lede">They are back from the job. Read the report, then send them on.</p>
      <ul className="facility-roster-grid assignment-result-grid">
        {reports.map((report) => (
          <li key={`${report.characterId}-${report.label}`}>
            <article className="assignment-result-card">
              <FacilityMemberCard characterId={report.characterId} run={run} />
              <h3 className="font-display text-xl text-gold">{report.summary}</h3>
              {report.rewards?.length ? (
                <ul>
                  {report.rewards.map((reward) => (
                    <li key={reward}>{reward}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
      <div className="facility-action-grid">
        <FacilityActionCard body="Back to town." kicker="Continue" onClick={onDismiss} title="Hear them out" />
      </div>
    </OverlayFrame>
  );
}
