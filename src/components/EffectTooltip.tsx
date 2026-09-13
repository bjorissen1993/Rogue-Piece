import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

type EffectTooltipProps = {
  tip: string;
  children: ReactNode;
  className?: string;
};

/** CSS `content` needs `\A` for line breaks (JSON `\n` is not a CSS newline). */
function tipToCssContent(tip: string): string {
  return JSON.stringify(tip).replace(/\\n/g, "\\A ");
}

/**
 * Hover/focus tooltip on desktop; tap-to-toggle on coarse pointers / touch.
 * Important gameplay info must not be hover-only.
 */
export function EffectTooltip({ tip, children, className = "" }: EffectTooltipProps) {
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!tip) {
    return <>{children}</>;
  }

  return (
    <span
      aria-describedby={open ? tipId : undefined}
      className={["icon-tip", "effect-tooltip", open ? "is-tip-open" : "", className]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => {
        // Toggle on tap; hover still works via CSS on fine pointers.
        if (window.matchMedia("(hover: none), (pointer: coarse)").matches) {
          event.stopPropagation();
          setOpen((current) => !current);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen((current) => !current);
        }
      }}
      ref={rootRef}
      role="button"
      style={{ "--tip": tipToCssContent(tip) } as CSSProperties}
      tabIndex={0}
    >
      {children}
      {open ? (
        <span className="effect-tooltip-live" id={tipId} role="tooltip">
          {tip}
        </span>
      ) : null}
    </span>
  );
}
