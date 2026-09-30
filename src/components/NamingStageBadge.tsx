import { namingStageBlurb, namingStageRoman, namingStageTitle } from "../data/namingStage";
import type { InventoryItem } from "../models/types";
import { WeaponProgressionService } from "../services/WeaponProgressionService";

type NamingStageBadgeProps = {
  item: InventoryItem;
  className?: string;
};

function effectLines(item: InventoryItem): string[] {
  const buffs = WeaponProgressionService.ensure(item).naming.buffs;
  const lines: string[] = [];
  if (buffs.speed) {
    lines.push(`+${buffs.speed} Speed`);
  }
  if (buffs.accuracy) {
    lines.push(`+${buffs.accuracy} Accuracy`);
  }
  if (buffs.damage) {
    lines.push(`+${buffs.damage} Power`);
  }
  if (buffs.critBonus) {
    lines.push(`+${buffs.critBonus} Precision`);
  }
  if (buffs.initiative) {
    lines.push(`+${buffs.initiative} Initiative`);
  }
  return lines;
}

export function NamingStageBadge({ item, className = "" }: NamingStageBadgeProps) {
  const stage = WeaponProgressionService.namingStage(item);
  const progress = WeaponProgressionService.ensure(item);
  const history = progress.naming.stages.map((entry) => entry.adjective);
  const roman = namingStageRoman(stage);
  const title = namingStageTitle(stage);
  const effects = effectLines(item);
  const evolution = history.length ? history.join(" → ") : "None yet";

  return (
    <span
      className={`naming-stage-badge naming-stage-${stage}${className ? ` ${className}` : ""}`}
      tabIndex={0}
    >
      <span className="naming-stage-badge-mark" aria-hidden="true">
        {roman || "·"}
      </span>
      <span className="naming-stage-badge-sr">
        Naming stage {stage || 0}: {title}
      </span>
      <span className="naming-stage-badge-tip" role="tooltip">
        <strong>
          NAMING STAGE {roman || "0"}
        </strong>
        <span className="naming-stage-badge-title">{title}</span>
        <span>{namingStageBlurb(stage)}</span>
        <span>Evolution: {evolution}</span>
        {effects.length ? <span>Effects: {effects.join(", ")}</span> : null}
      </span>
    </span>
  );
}
