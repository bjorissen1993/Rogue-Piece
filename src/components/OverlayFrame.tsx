import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type OverlayFrameProps = {
  title?: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Render above mobile sheets / bottom nav by portaling to document.body
   * with an elevated z-index (e.g. faction dossier over the Factions tab).
   */
  elevate?: boolean;
};

export function OverlayFrame({ title, eyebrow, onClose, children, elevate = false }: OverlayFrameProps) {
  const node = (
    <div className={`overlay-scrim${elevate ? " overlay-scrim-elevated" : ""}`}>
      <section className="overlay-panel">
        <header className="overlay-head">
          <div>
            {eyebrow ? <p className="overlay-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="font-display text-3xl text-gold">{title}</h2> : null}
          </div>
          <button className="ghost-btn py-2" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="overlay-body">{children}</div>
      </section>
    </div>
  );

  if (elevate && typeof document !== "undefined") {
    return createPortal(node, document.body);
  }
  return node;
}
