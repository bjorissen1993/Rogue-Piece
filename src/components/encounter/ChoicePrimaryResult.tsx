import type { CSSProperties } from "react";
import type { StatName } from "../../models/types";
import { STAT_ACCENT, type ChoicePrimaryDisplay } from "../../utils/presentation";
import { STAT_LABELS } from "../../utils/text";
import { StatIcon } from "../StatIcon";

function StatResult({ stat, size }: { stat: StatName; size: number }) {
  return (
    <span className={`choice-gain-stat is-${stat}`} style={{ "--choice-accent": STAT_ACCENT[stat] } as CSSProperties}>
      <StatIcon showTooltip={false} size={size} stat={stat} />
      {STAT_LABELS[stat]}
    </span>
  );
}

export function ChoicePrimaryResult({ result }: { result: ChoicePrimaryDisplay | null }) {
  if (!result) {
    return null;
  }

  if (result.kind === "gain-stat" || result.kind === "lose-stat") {
    const tone = result.kind === "gain-stat" ? "gain" : "loss";
    const accent = result.stats[0] ? STAT_ACCENT[result.stats[0]] : undefined;
    return (
      <div
        className={`choice-effect choice-primary tone-${tone} ${result.stats[0] ? `is-${result.stats[0]}` : ""}`}
        style={accent ? ({ "--choice-accent": accent } as CSSProperties) : undefined}
      >
        <span className="choice-primary-verb">{result.verb}</span>
        {result.stats.map((stat) => (
          <StatResult key={stat} size={26} stat={stat} />
        ))}
      </div>
    );
  }

  const accent = result.stats?.[0] ? STAT_ACCENT[result.stats[0]] : undefined;
  return (
    <div
      className={`choice-effect choice-primary tone-${result.tone} ${result.stats?.[0] ? `is-${result.stats[0]}` : ""}`}
      style={accent ? ({ "--choice-accent": accent } as CSSProperties) : undefined}
    >
      {result.stats?.length ? (
        <>
          <span className="choice-primary-verb">{result.text}</span>
          {result.stats.map((stat) => (
            <StatResult key={stat} size={26} stat={stat} />
          ))}
        </>
      ) : (
        result.text
      )}
    </div>
  );
}
