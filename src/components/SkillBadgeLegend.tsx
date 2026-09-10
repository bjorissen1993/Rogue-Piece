import { SKILL_BADGE_CATALOG } from "../game/skillBadges";
import type { SkillBadgeId } from "../models/types";
import { SkillBadgeIcon } from "./SkillBadgeRow";

const LEGEND_ORDER: SkillBadgeId[] = [
  "SINGLE_TARGET",
  "MULTI_TARGET",
  "ALL_TARGETS",
  "RANDOM_TARGET",
  "ROW_TARGET",
  "SELF",
  "CHAIN",
  "SPLASH",
  "MULTI_HIT",
  "HEAL",
  "CLEANSE",
  "MP_RESTORE",
  "GUARD",
  "COUNTER",
  "FOCUS",
  "CONTROL_BREAK",
  "AFFLICTION",
  "VULNERABILITY",
];

type SkillBadgeLegendProps = {
  open: boolean;
  onClose: () => void;
};

export function SkillBadgeLegend({ open, onClose }: SkillBadgeLegendProps) {
  if (!open) return null;
  return (
    <div
      aria-modal="true"
      className="skill-badge-legend-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="skill-badge-legend panel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="skill-badge-legend-head">
          <h3 className="font-display text-gold">Skill badges</h3>
          <button className="combat-log-close" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <p className="skill-badge-legend-intro">
          Compact icons on techniques. Hover a badge in combat for the exact tip; this board shows
          what each category means.
        </p>
        <ul className="skill-badge-legend-list">
          {LEGEND_ORDER.map((id) => {
            const def = SKILL_BADGE_CATALOG[id];
            return (
              <li className="skill-badge-legend-card" key={id}>
                <SkillBadgeIcon badge={{ id }} size={72} />
                <div className="skill-badge-legend-copy">
                  <strong>{def.label}</strong>
                  <span>{def.defaultTip}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
