import { useMemo, useState } from "react";
import type { PendingBattleSetup, RunState, SparWager } from "../models/types";
import { SparringService } from "../services/SparringService";
import { battleFormatLabel } from "../services/EncounterCompositionService";
import { FacilityActionCard, FacilityMemberCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type BattleSetupOverlayProps = {
  run: RunState;
  setup: PendingBattleSetup;
  onConfirm: (participantIds: string[], wager: SparWager | null) => void;
  onCancel: () => void;
};

export function BattleSetupOverlay({ run, setup, onConfirm, onCancel }: BattleSetupOverlayProps) {
  const needed = setup.format.maxPlayerFighters;
  const forced = new Set(setup.forcedParticipantIds);
  const eligible = useMemo(() => SparringService.eligibleParticipants(run), [run]);
  const [selected, setSelected] = useState<string[]>(() => {
    if (setup.forcedParticipantIds.length) {
      return [...setup.forcedParticipantIds].slice(0, needed);
    }
    return eligible.filter((entry) => entry.available).slice(0, needed).map((entry) => entry.id);
  });
  const [wager, setWager] = useState<SparWager | null>(setup.wager ?? { type: "NONE", label: "No stakes" });
  const wagers = setup.format.stakesAllowed
    ? SparringService.availableWagers(run)
    : [{ type: "NONE" as const, label: "No stakes" }];

  const toggle = (id: string, available: boolean) => {
    if (!available || forced.has(id)) return;
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      if (current.length >= needed) {
        return [...current.slice(1), id];
      }
      return [...current, id];
    });
  };

  const ready = selected.length === needed && selected.every((id) => {
    const entry = eligible.find((item) => item.id === id);
    return entry?.available || forced.has(id);
  });

  return (
    <OverlayFrame
      elevate
      eyebrow={setup.format.isFriendly ? "Friendly match" : setup.format.label}
      onClose={onCancel}
      title={setup.opponentLabel}
    >
      <p className="encounter-choice-lede">
        {battleFormatLabel(setup.format, needed, setup.format.maxEnemies)}
        {wager && wager.type !== "NONE" ? ` · Stakes: ${wager.label}` : ""}
      </p>

      {setup.format.stakesAllowed ? (
        <div>
          <p className="overlay-eyebrow">Agree stakes</p>
          <div className="facility-action-grid is-two">
            {wagers.map((entry) => (
              <FacilityActionCard
                active={wager?.label === entry.label}
                kicker="Wager"
                key={`${entry.type}-${entry.label}`}
                onClick={() => setWager(entry)}
                title={entry.label}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="facility-crew-split">
        <div>
          <p className="overlay-eyebrow">
            {needed === 1 ? "Who will fight?" : `Select ${needed} fighters`} · {selected.length} / {needed}
          </p>
          <ul className={`facility-roster-grid${selected.length ? " has-selection" : ""}`}>
            {eligible.map((entry) => {
              const isOn = selected.includes(entry.id);
              const locked = forced.has(entry.id);
              return (
                <li key={entry.id}>
                  <FacilityMemberCard
                    characterId={entry.id}
                    disabled={!entry.available && !locked}
                    onClick={() => toggle(entry.id, entry.available || locked)}
                    run={run}
                    selected={isOn}
                  />
                </li>
              );
            })}
          </ul>
        </div>
        <aside className="detail-panel panel facility-detail">
          <p className="facility-detail-copy">
            {needed === 1
              ? "Tap a card to send them in."
              : "Tap cards to fill the row. Required fighters stay locked in."}
          </p>
          <FacilityActionCard
            body={ready ? "Walk into the circle." : "Pick the crew who will stand in."}
            disabled={!ready}
            kicker="Ready"
            onClick={() => onConfirm(selected, wager)}
            title="Confirm"
          />
          <FacilityActionCard body="Leave the challenge unanswered." kicker="Leave" onClick={onCancel} title="Back out" />
        </aside>
      </div>
    </OverlayFrame>
  );
}
