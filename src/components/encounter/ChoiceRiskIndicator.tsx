import type { ChoiceCostItem } from "../../utils/presentation";
import { HudIcon } from "../HudIcons";

export function ChoiceRiskIndicator({ item }: { item: ChoiceCostItem }) {
  const deadly = /DANGEROUS|RISKY/.test(item.value);
  return (
    <span className={`choice-cost-item choice-risk tone-${item.tone} risk-${item.value.split(" ")[0]?.toLowerCase()}`}>
      {deadly ? <HudIcon name="skull" size={18} /> : null}
      <span className="choice-cost-label">{item.label}</span>
      <span className="choice-cost-value">{item.value}</span>
    </span>
  );
}
