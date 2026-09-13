import type { CSSProperties } from "react";
import type { Ability, SkillBadgeRef, Technique } from "../models/types";
import {
  SKILL_BADGE_CATALOG,
  resolveSkillBadges,
  skillBadgeLabel,
  skillBadgeTip,
} from "../game/skillBadges";
import { EffectTooltip } from "./EffectTooltip";
import { HudArt } from "./HudIcons";

type SkillBadgeIconProps = {
  badge: SkillBadgeRef;
  size?: number;
};

export function SkillBadgeIcon({ badge, size = 28 }: SkillBadgeIconProps) {
  const def = SKILL_BADGE_CATALOG[badge.id];
  return (
    <span
      aria-hidden="true"
      className={`skill-badge skill-badge--${badge.id.toLowerCase()}`}
      style={{ "--badge-size": `${size}px` } as CSSProperties}
    >
      <HudArt
        className="skill-badge-art"
        fallbackSrc={badge.id === "DEVIL_FRUIT" ? "/icons/Devil_Fruit.png" : undefined}
        size={size}
        src={def.art}
      />
      {badge.count != null ? <span className="skill-badge-count">×{badge.count}</span> : null}
      <span className="skill-badge-sr">{skillBadgeLabel(badge)}</span>
    </span>
  );
}

type SkillBadgeRowProps = {
  badges?: SkillBadgeRef[];
  source?: Ability | Technique | (Partial<Ability> & { name?: string });
  size?: number;
  className?: string;
  /** Show text labels under icons (detail panels). */
  showLabels?: boolean;
  /** Stack badges vertically (default horizontal). */
  layout?: "row" | "column";
};

export function SkillBadgeRow({
  badges,
  source,
  size = 28,
  className = "",
  showLabels = false,
  layout = "row",
}: SkillBadgeRowProps) {
  const resolved = badges ?? (source ? resolveSkillBadges(source) : []);
  if (!resolved.length) {
    return null;
  }
  return (
    <div
      className={`skill-badge-row skill-badge-row--${layout} ${className}`.trim()}
      role="list"
    >
      {resolved.map((badge) => (
        <EffectTooltip key={`${badge.id}-${badge.count ?? 0}-${badge.tip ?? ""}`} tip={skillBadgeTip(badge)}>
          <span className="skill-badge-item" role="listitem">
            <SkillBadgeIcon badge={badge} size={size} />
            {showLabels ? (
              <span className="skill-badge-caption">{SKILL_BADGE_CATALOG[badge.id].label}</span>
            ) : null}
          </span>
        </EffectTooltip>
      ))}
    </div>
  );
}
