import { useState } from "react";
import { getTechnique } from "../data/weapons";
import { getStyleTechnique } from "../data/fightingStyles";
import type { PendingTechniqueChoice, RunState } from "../models/types";
import { ProgressionService } from "../services/ProgressionService";

type TechniqueOpportunityOverlayProps = {
  run: RunState;
  pending: PendingTechniqueChoice;
  onSelect: (techniqueId: string) => void;
};

function techniqueLabel(id: string): { name: string; description: string } {
  const tech = getTechnique(id) ?? getStyleTechnique(id);
  return tech ?? { name: id, description: "A fighting technique." };
}

export function TechniqueOpportunityOverlay({ run, pending, onSelect }: TechniqueOpportunityOverlayProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const name = ProgressionService.getDisplayName(run, pending.characterId);

  return (
    <section className="level-up-overlay panel">
      <h2 className="level-up-title font-display">Level Up!</h2>

      <div className="level-up-body">
        <div className="level-up-stage">
          <div className="level-up-choose-block">
            <p className="level-up-prompt">
              {name} has reached a milestone. Choose one technique to learn.
            </p>

            <ul className={`technique-offer-grid${selected ? " has-selection" : ""}`}>
              {pending.techniqueIds.map((id) => {
                const tech = techniqueLabel(id);
                return (
                  <li key={id}>
                    <button
                      className={`technique-offer-btn ${selected === id ? "is-selected" : ""}`}
                      onClick={() => setSelected(id)}
                      type="button"
                    >
                      <span className="technique-offer-name font-display text-gold">{tech.name}</span>
                      <span className="technique-offer-desc">{tech.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              className="gold-btn level-up-confirm"
              disabled={!selected}
              onClick={() => selected && onSelect(selected)}
              type="button"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
