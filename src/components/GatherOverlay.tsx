import { useState } from "react";
import { createPortal } from "react-dom";
import { itemIconSrc } from "../data/itemArt";
import { getItemDefinition } from "../data/items";
import type { GatherRoster, GatherSlot, RunState } from "../models/types";

type GatherOverlayProps = {
  run: RunState;
  roster: GatherRoster;
  onPick: (slotId: string) => string;
  onFinish: () => void;
};

const PATCH_SHAPES = ["mound", "rock", "tuft", "mound", "rock", "tuft", "rock", "mound"] as const;

function richnessLabel(value: GatherRoster["richness"]): string {
  if (value === "RICH") {
    return "Rich ground";
  }
  if (value === "SPARSE") {
    return "Picked over";
  }
  if (value === "DEPLETED") {
    return "Depleted";
  }
  return "Normal ground";
}

function slotLabel(slot: GatherSlot): string {
  return getItemDefinition(slot.itemId)?.name ?? slot.itemId;
}

export function GatherOverlay({ roster, onPick, onFinish }: GatherOverlayProps) {
  const [diggingId, setDiggingId] = useState<string | null>(null);

  const handlePick = (slot: GatherSlot) => {
    if (slot.taken || roster.remaining <= 0 || diggingId) {
      return;
    }
    setDiggingId(slot.id);
    window.setTimeout(() => {
      onPick(slot.id);
      setDiggingId(null);
    }, 240);
  };

  const node = (
    <div className="overlay-scrim overlay-scrim-elevated gather-scrim">
      <section className="gather-panel" aria-label="Gather">
        <header className="fishing-head">
          <div>
            <p className="overlay-eyebrow">
              {roster.zoneName} · {richnessLabel(roster.richness)}
            </p>
            <h2 className="font-display text-3xl text-gold">Gather</h2>
          </div>
        </header>
        <p className="fishing-copy">
          Tap a mound. Kits peek at matching finds. Three pulls, then the rest stay in the dirt.
        </p>
        <div className="fishing-pips" aria-label={`${roster.attempts - roster.remaining} of ${roster.attempts} pulls`}>
          {Array.from({ length: roster.attempts }, (_, index) => (
            <span
              className={`fishing-pip${index < roster.attempts - roster.remaining ? " is-on" : ""}`}
              key={index}
            />
          ))}
        </div>
        <p className="gather-flash" aria-live="polite">
          {roster.lastMessage || "\u00a0"}
        </p>
        <div className={`gather-ground${roster.richness === "DEPLETED" ? " is-depleted" : ""}`}>
          {roster.slots.map((slot, index) => {
            const shape = PATCH_SHAPES[index] ?? "mound";
            const shown = !slot.hidden;
            const name = slotLabel(slot);
            return (
              <button
                aria-label={shown ? name : "Hidden find"}
                className={`gather-patch is-${shape}${slot.taken ? " is-taken" : ""}${shown ? " is-revealed" : ""}${slot.container ? " is-container" : ""}${diggingId === slot.id ? " is-digging" : ""}`}
                disabled={slot.taken || roster.remaining <= 0 || Boolean(diggingId)}
                key={slot.id}
                onClick={() => handlePick(slot)}
                type="button"
              >
                <span className="gather-patch-body">
                  {shown ? (
                    <span className="gather-patch-find">
                      <img alt="" className="gather-patch-art" src={itemIconSrc(slot.itemId)} />
                      <strong>{name}</strong>
                      <em>{slot.container ? "open" : `×${slot.quantity + (slot.extractionBonus ?? 0)}`}</em>
                    </span>
                  ) : (
                    <span className="gather-patch-hint">?</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <button className="gold-btn fishing-hook-btn" onClick={onFinish} type="button">
          Leave the area
        </button>
      </section>
    </div>
  );

  if (typeof document === "undefined") {
    return node;
  }
  return createPortal(node, document.body);
}
