import { useMemo, useState } from "react";
import type { PendingBattleSetup, RunState, SparWager } from "../models/types";
import { SparringService } from "../services/SparringService";
import { battleFormatLabel } from "../services/EncounterCompositionService";

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
    <section className="battle-setup panel">
      <header className="battle-setup-head">
        <p className="hud-kicker">{setup.format.isFriendly ? "FRIENDLY MATCH" : setup.format.label}</p>
        <h2 className="font-display text-3xl text-gold">{setup.opponentLabel}</h2>
        <p className="battle-setup-format">
          {battleFormatLabel(setup.format, needed, setup.format.maxEnemies)}
        </p>
        {wager && wager.type !== "NONE" ? <p className="battle-setup-stakes">Stakes: {wager.label}</p> : null}
      </header>

      {setup.format.stakesAllowed ? (
        <div className="battle-setup-wagers">
          <p className="detail-label">Agree stakes</p>
          <div className="battle-setup-wager-list">
            {wagers.map((entry) => (
              <button
                className={`choice-btn ${wager?.label === entry.label ? "is-selected" : ""}`}
                key={`${entry.type}-${entry.label}`}
                onClick={() => setWager(entry)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="battle-setup-pick">
        <p className="detail-label">
          {needed === 1 ? "Who will fight?" : `Select ${needed} fighters`} · {selected.length} / {needed}
        </p>
        <ul className="battle-setup-roster">
          {eligible.map((entry) => {
            const isOn = selected.includes(entry.id);
            const locked = forced.has(entry.id);
            return (
              <li key={entry.id}>
                <button
                  className={`battle-setup-fighter ${isOn ? "is-selected" : ""} ${!entry.available ? "is-locked" : ""}`}
                  disabled={!entry.available && !locked}
                  onClick={() => toggle(entry.id, entry.available || locked)}
                  type="button"
                >
                  <strong>{entry.name}</strong>
                  <span>Lv {entry.level}</span>
                  <span>{entry.hpLabel}</span>
                  {locked ? <span className="battle-setup-forced">Required</span> : null}
                  {!entry.available ? <span>{entry.reason}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="battle-setup-actions">
        <button
          className="gold-btn"
          disabled={!ready}
          onClick={() => onConfirm(selected, wager)}
          type="button"
        >
          Confirm
        </button>
        <button className="ghost-btn" onClick={onCancel} type="button">
          Back out
        </button>
      </div>
    </section>
  );
}
