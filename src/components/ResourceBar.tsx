export type ResourceBarKind = "hp" | "mp" | "xp";

type ResourceBarProps = {
  kind: ResourceBarKind;
  current: number;
  max: number;
  flash?: boolean;
  heal?: boolean;
  /** Overrides the left label (e.g. `Lv 2` for XP). */
  label?: string;
  /** @deprecated Use `label` instead. */
  sublabel?: string;
};

const LABELS: Record<ResourceBarKind, string> = {
  hp: "HP",
  mp: "MP",
  xp: "XP",
};

export function ResourceBar({
  kind,
  current,
  max,
  flash = false,
  heal = false,
  label,
  sublabel,
}: ResourceBarProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (current / max) * 100));
  const leftLabel = label ?? sublabel ?? LABELS[kind];

  return (
    <div
      className={[
        "resource-bar",
        kind === "hp" ? "hp-bar" : "",
        `resource-bar-${kind}`,
        flash ? "is-flash" : "",
        heal ? "is-heal" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="tracking-wide text-gold">{leftLabel}</span>
        <span>
          {current} / {max}
        </span>
      </div>
      <div className={`resource-bar-track resource-bar-track-${kind}`}>
        <div className={`resource-bar-fill resource-bar-fill-${kind}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
