import type { CSSProperties, ReactNode } from "react";

type EffectTooltipProps = {
  tip: string;
  children: ReactNode;
  className?: string;
};

/** Reusable hover/focus tooltip using the project's icon-tip pattern (not native title). */
export function EffectTooltip({ tip, children, className = "" }: EffectTooltipProps) {
  if (!tip) {
    return <>{children}</>;
  }
  return (
    <span
      className={["icon-tip", "effect-tooltip", className].filter(Boolean).join(" ")}
      style={{ "--tip": JSON.stringify(tip) } as CSSProperties}
    >
      {children}
    </span>
  );
}
