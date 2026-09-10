import type { RunState } from "../models/types";
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
    <OverlayFrame eyebrow="Return" onClose={onDismiss} title="Crew Returns">
      <div className="assignment-result-list">
        {reports.map((report) => (
          <article className="assignment-result-card" key={`${report.characterId}-${report.label}`}>
            <h3 className="font-display text-xl text-gold">{report.summary}</h3>
            {report.rewards?.length ? (
              <ul>
                {report.rewards.map((reward) => (
                  <li key={reward}>{reward}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
      <button className="gold-btn mt-4" onClick={onDismiss} type="button">
        Continue
      </button>
    </OverlayFrame>
  );
}
