import type { ReactNode } from "react";

type OverlayFrameProps = {
  title?: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
};

export function OverlayFrame({ title, eyebrow, onClose, children }: OverlayFrameProps) {
  return (
    <div className="overlay-scrim">
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
}
