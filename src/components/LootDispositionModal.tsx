import { CrewService } from "../services/CrewService";
import { LootDispositionService } from "../services/LootDispositionService";
import type { PendingLootDisposition, RunState } from "../models/types";

type LootDispositionModalProps = {
  run: RunState;
  pending: PendingLootDisposition;
  onBackpack: () => void;
  onAssign: (characterId: string) => void;
};

export function LootDispositionModal({ run, pending, onBackpack, onAssign }: LootDispositionModalProps) {
  const crew = CrewService.list(run);
  const roster = [
    { id: run.player.id, name: run.player.name },
    ...crew.map((entry) => ({ id: entry.member.characterId, name: entry.character.name })),
  ];

  return (
    <div className="overlay-scrim">
      <section className="overlay-panel overlay-panel-narrow loot-disposition-modal">
        <header className="overlay-head">
          <div>
            <p className="overlay-eyebrow">NEW GEAR</p>
            <h2 className="font-display text-3xl text-gold">{pending.label}</h2>
          </div>
        </header>
        <div className="overlay-body">
          <p className="text-parchment-dim">
            {pending.kind === "weapon"
              ? "Who should carry this weapon? Only one person can wield it at a time."
              : "Who should receive this Devil Fruit? This choice is permanent."}
          </p>
          <div className="loot-disposition-actions mt-4">
            <button className="ghost-btn w-full" onClick={onBackpack} type="button">
              Store in Backpack
            </button>
            <p className="text-sm text-parchment-dim mt-3 mb-2">Or assign now:</p>
            <ul className="loot-disposition-roster">
              {roster.map((member) => (
                <li key={member.id}>
                  <button className="choice-btn w-full" onClick={() => onAssign(member.id)} type="button">
                    Give to {member.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export function peekLootDisposition(run: RunState) {
  return LootDispositionService.peek(run);
}
