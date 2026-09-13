import { useEffect, type ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  /** Larger sheet for character / inventory-like content. */
  size?: "default" | "tall" | "full";
};

export function BottomSheet({
  open,
  title,
  eyebrow,
  onClose,
  children,
  size = "default",
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="mobile-sheet-scrim" onClick={onClose} role="presentation">
      <section
        aria-label={title}
        aria-modal="true"
        className={`mobile-sheet mobile-sheet-${size}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="mobile-sheet-handle" aria-hidden="true" />
        <header className="mobile-sheet-head">
          <div>
            {eyebrow ? <p className="mobile-sheet-eyebrow">{eyebrow}</p> : null}
            <h2 className="font-display mobile-sheet-title">{title}</h2>
          </div>
          <button className="mobile-sheet-close" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="mobile-sheet-body">{children}</div>
      </section>
    </div>
  );
}
