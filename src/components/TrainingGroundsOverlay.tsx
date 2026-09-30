import { useMemo, useState } from "react";
import { TRAINING_CATEGORIES, TRAINING_EQUIPMENT } from "../data/trainingGrounds";
import type { RunState, TrainingExpType } from "../models/types";
import { CharacterScheduleService } from "../services/CharacterScheduleService";
import { ProgressionService } from "../services/ProgressionService";
import {
  TrainingGroundsService,
  trainingEfficiencyBreakdown,
  trainingEfficiencyPercent,
} from "../services/TrainingGroundsService";
import { FacilityActionCard, FacilityMemberCard, facilityMemberIds } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type TrainingGroundsOverlayProps = {
  run: RunState;
  initialCategory?: TrainingExpType;
  onClose: () => void;
  onSpar?: () => void;
};

export function TrainingGroundsOverlay({ run, initialCategory, onClose, onSpar }: TrainingGroundsOverlayProps) {
  const roster = useMemo(() => facilityMemberIds(run), [run]);
  const [selectedId, setSelectedId] = useState(roster[0] ?? run.player.id);
  const [category, setCategory] = useState<TrainingExpType>(initialCategory ?? "strength");
  const [flash, setFlash] = useState("");

  const session = TrainingGroundsService.getSession(run, selectedId);
  const busy = CharacterScheduleService.busySummary(run, selectedId);
  const name = ProgressionService.getDisplayName(run, selectedId);
  const owners = TrainingGroundsService.assignedEquipmentOwners(run);
  const available = CharacterScheduleService.isAvailable(run, selectedId);
  const pending =
    session?.category === "sparring"
      ? Object.values(session.pendingExp).reduce((sum, value) => sum + (value ?? 0), 0)
      : session?.pendingExp[session.category] ?? 0;
  const categoryLabel =
    TRAINING_CATEGORIES.find((entry) => entry.id === (session?.category ?? category))?.label ?? category;

  return (
    <OverlayFrame elevate eyebrow="Training Grounds" onClose={onClose} title="Training">
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
            <p className="overlay-eyebrow">{session ? "In session" : "Pick a drill"}</p>
            <h3 className="font-display text-2xl text-gold">{name}</h3>
            {busy ? <p className="facility-detail-copy">{busy}</p> : null}
          </div>

          {session ? (
            <>
              <p className="facility-detail-copy">
                {categoryLabel} · {session.elapsedSlots} slot{session.elapsedSlots === 1 ? "" : "s"} ·{" "}
                {Math.floor(pending)} EXP waiting
              </p>
              <p className="facility-detail-copy">
                Efficiency {trainingEfficiencyPercent(session)}% · continuity x
                {session.continuityMultiplier.toFixed(1)}
                <span className="training-grounds-tip">{trainingEfficiencyBreakdown(session).join(" · ")}</span>
              </p>
              <div className="facility-action-grid is-two">
                {TRAINING_EQUIPMENT.map((gear) => {
                  const taken = owners.get(gear.itemId);
                  const mine = session.equipmentItemIds.includes(gear.itemId);
                  return (
                    <FacilityActionCard
                      active={mine}
                      body={taken && !mine ? `In use by ${ProgressionService.getDisplayName(run, taken)}` : `${Math.round(gear.bonus * 100)}% extra on matching drills`}
                      disabled={Boolean(taken) && !mine}
                      kicker={mine ? "Equipped" : "Gear"}
                      key={gear.itemId}
                      onClick={() => {
                        if (mine) {
                          TrainingGroundsService.clearEquipment(run, selectedId, gear.itemId);
                          setFlash(`${gear.name} removed.`);
                          return;
                        }
                        const result = TrainingGroundsService.assignEquipment(run, selectedId, gear.itemId);
                        setFlash(result.message);
                      }}
                      title={gear.name}
                    />
                  );
                })}
              </div>
              <FacilityActionCard
                body="You keep earned EXP. The streak resets."
                kicker="Stop anytime"
                onClick={() => setFlash(TrainingGroundsService.stop(run, selectedId))}
                title="Stop training"
              />
            </>
          ) : (
            <>
              <div className="facility-action-grid is-two">
                {TRAINING_CATEGORIES.map((entry) => (
                  <FacilityActionCard
                    active={category === entry.id}
                    body={
                      entry.id === "sparring"
                        ? "A real fight with no hospital stay."
                        : "World time still moves. Stop whenever you want."
                    }
                    kicker={entry.focus}
                    key={entry.id}
                    onClick={() => setCategory(entry.id)}
                    title={entry.label}
                  />
                ))}
              </div>
              <FacilityActionCard
                body={
                  category === "sparring"
                    ? "Pick a partner and step into the ring."
                    : `Start an open ${categoryLabel.toLowerCase()} session.`
                }
                disabled={!available && category !== "sparring"}
                kicker={available || category === "sparring" ? "Ready" : "Busy"}
                onClick={() => {
                  if (category === "sparring" && onSpar) {
                    onSpar();
                    return;
                  }
                  const result = TrainingGroundsService.start(run, selectedId, category);
                  setFlash(result.message);
                }}
                title={
                  category === "sparring" && onSpar
                    ? "Start sparring match"
                    : `Start ${categoryLabel} training`
                }
              />
            </>
          )}
          <p className="facility-flash" aria-live="polite">
            {flash || "\u00a0"}
          </p>
        </aside>
      </div>
    </OverlayFrame>
  );
}
