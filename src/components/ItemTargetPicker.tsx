import { CrewService } from "../services/CrewService";
import type { RunState } from "../models/types";

export type ItemTargetOption = {
  id: string;
  name: string;
  detail?: string;
};

type ItemTargetPickerProps = {
  run?: RunState;
  itemLabel: string;
  prompt?: string;
  /** When set, only these ids are offered (e.g. living combat allies). */
  options?: ItemTargetOption[];
  onPick: (characterId: string) => void;
  onCancel: () => void;
};

export function buildCrewTargetOptions(run: RunState): ItemTargetOption[] {
  const captainVitals = `HP ${run.player.hp}/${run.player.maxHp}`;
  const crew = CrewService.list(run).map((entry) => {
    const vitals = CrewService.ensureMemberVitals(run, entry.member.characterId);
    return {
      id: entry.member.characterId,
      name: entry.character.name,
      detail: vitals ? `HP ${vitals.hp}/${vitals.maxHp}` : undefined,
    };
  });
  return [
    { id: run.player.id, name: run.player.name, detail: captainVitals },
    ...crew,
  ];
}

export function ItemTargetPicker({
  run,
  itemLabel,
  prompt,
  options,
  onPick,
  onCancel,
}: ItemTargetPickerProps) {
  const roster = options ?? (run ? buildCrewTargetOptions(run) : []);

  return (
    <div className="overlay-scrim item-target-scrim" onClick={onCancel} role="presentation">
      <section
        aria-label="Choose target"
        className="overlay-panel overlay-panel-narrow item-target-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="overlay-head">
          <div>
            <p className="overlay-eyebrow">USE ITEM</p>
            <h2 className="font-display text-3xl text-gold">{itemLabel}</h2>
          </div>
          <button className="ghost-btn py-2" onClick={onCancel} type="button">
            Cancel
          </button>
        </header>
        <div className="overlay-body">
          <p className="text-parchment-dim">
            {prompt ?? "Who should receive this?"}
          </p>
          <ul className="item-target-roster">
            {roster.map((member) => (
              <li key={member.id}>
                <button className="choice-btn w-full" onClick={() => onPick(member.id)} type="button">
                  <span>{member.name}</span>
                  {member.detail ? <span className="item-target-detail">{member.detail}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
