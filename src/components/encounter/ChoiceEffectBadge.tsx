import type { CSSProperties, ReactNode } from "react";
import type { Encounter, EncounterChoice, Player, RunState, TimeOfDay } from "../../models/types";
import { costItemTooltip } from "../../utils/effectTooltips";
import { STAT_ACCENT, type ChoiceCostItem } from "../../utils/presentation";
import { BOUNTY_ART, HudArt, HudIcon } from "../HudIcons";
import { EffectTooltip } from "../EffectTooltip";
import { StatIcon } from "../StatIcon";
import { ChoiceRiskIndicator } from "./ChoiceRiskIndicator";

function CostGlyph({ item }: { item: ChoiceCostItem }) {
  if (item.kind === "time") {
    return <HudIcon name="hourglass" size={20} />;
  }
  if (item.kind === "berries") {
    return <HudIcon name="coin" size={20} />;
  }
  if (item.kind === "hp") {
    return <HudIcon name="heart" size={20} />;
  }
  if (item.kind === "focus" && item.stat) {
    return <StatIcon showTooltip={false} size={20} stat={item.stat} />;
  }
  if (item.kind === "focus") {
    return <HudIcon name="crosshair" size={20} />;
  }
  if (item.kind === "bounty") {
    return <HudArt size={20} src={BOUNTY_ART} />;
  }
  return null;
}

type ChoiceEffectBadgeProps = {
  item: ChoiceCostItem;
  choice: EncounterChoice;
  encounter?: Encounter | null;
  timeOfDay?: TimeOfDay;
  player?: Player | null;
  run?: RunState | null;
  isDev?: boolean;
};

export function ChoiceEffectBadge({
  item,
  choice,
  encounter,
  timeOfDay,
  player,
  run,
  isDev = false,
}: ChoiceEffectBadgeProps) {
  if (item.kind === "risk") {
    const tip = costItemTooltip(item, choice, encounter, timeOfDay, player, isDev, run);
    return (
      <EffectTooltip tip={tip}>
        <ChoiceRiskIndicator item={item} />
      </EffectTooltip>
    );
  }

  const tip = costItemTooltip(item, choice, encounter, timeOfDay, player, isDev, run);
  const accent = item.stat ? STAT_ACCENT[item.stat] : undefined;
  const timeProminent = item.kind === "time";

  return (
    <EffectTooltip tip={tip}>
      <span
        className={`choice-cost-item choice-effect-badge tone-${item.tone} is-${item.kind}${
          timeProminent ? " is-time-prominent" : ""
        }`}
        style={accent ? ({ "--choice-accent": accent } as CSSProperties) : undefined}
      >
        <CostGlyph item={item} />
        <span className="choice-cost-label">{timeProminent ? "⧖" : item.label}</span>
        <span className="choice-cost-value">{item.value}</span>
      </span>
    </EffectTooltip>
  );
}

export function ChoiceEffectBadgeRow({ children }: { children: ReactNode }) {
  return <div className="choice-footer choice-cost-bar">{children}</div>;
}
