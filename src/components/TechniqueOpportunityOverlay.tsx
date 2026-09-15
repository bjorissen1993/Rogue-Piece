import { useState } from "react";
import { getTechnique } from "../data/weapons";
import { getStyleTechnique } from "../data/fightingStyles";
import { resolvePowerLevel, techniqueToAbility } from "../game/techniqueAbility";
import { techniqueHitChancePercent } from "../game/techniquePower";
import { resolveSkillBadges } from "../game/skillBadges";
import { useIsMobile } from "../hooks/useMediaQuery";
import type { PendingTechniqueChoice, PlayerStats, RunState, Technique } from "../models/types";
import {
  estimateTechniqueDamageRange,
  techniqueHealAmount,
} from "../services/CombatCalculationService";
import { abilityTechniqueEffects } from "../services/TargetResolutionService";
import { ProgressionService } from "../services/ProgressionService";
import { STAT_LABELS } from "../utils/text";
import { EffectTooltip } from "./EffectTooltip";
import { SkillBadgeLegend } from "./SkillBadgeLegend";
import { SkillBadgeRow } from "./SkillBadgeRow";
import { StatIcon } from "./StatIcon";

type TechniqueOpportunityOverlayProps = {
  run: RunState;
  pending: PendingTechniqueChoice;
  onSelect: (techniqueId: string) => void;
};

function resolveTechnique(id: string): Technique | null {
  return getTechnique(id) ?? getStyleTechnique(id) ?? null;
}

type OfferPotency =
  | { kind: "DAMAGE"; min: number; max: number }
  | { kind: "HEAL"; amount: number }
  | null;

function resolveOfferPotency(tech: Technique, stats: PlayerStats): OfferPotency {
  const effects = abilityTechniqueEffects(techniqueToAbility(tech));
  const heal = effects.find((effect) => effect.kind === "HEAL");
  if (heal) {
    return {
      kind: "HEAL",
      amount: techniqueHealAmount(heal.healAmount, stats, tech.scalingStat),
    };
  }
  const damage = effects.find((effect) => effect.kind === "DAMAGE");
  if (!damage) {
    return null;
  }
  const range = estimateTechniqueDamageRange(
    stats,
    tech.scalingStat,
    damage.damageMult ?? 1,
  );
  return { kind: "DAMAGE", min: range.minDamage, max: range.maxDamage };
}

export function TechniqueOpportunityOverlay({
  run,
  pending,
  onSelect,
}: TechniqueOpportunityOverlayProps) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const name = ProgressionService.getDisplayName(run, pending.characterId);
  const stats = ProgressionService.getStats(run, pending.characterId);
  const characterLevel = ProgressionService.getProgression(run, pending.characterId).level;

  return (
    <div className={`level-up-shell is-technique-offer${isMobile ? " is-mobile-technique" : ""}`}>
      <section className="level-up-overlay panel">
        <header className="level-up-header">
          <div className="level-up-header-top">
            <h2 className="level-up-title font-display">Level Up!</h2>
            <button
              aria-label="What do skill badges mean?"
              className="skill-badge-help-btn"
              onClick={() => setLegendOpen(true)}
              type="button"
            >
              ?
            </button>
          </div>
          <p className="level-up-character font-display">{name}</p>
          <p className="level-up-prompt">
            {name} has reached a milestone. Choose one technique to learn.
          </p>
        </header>

        <ul className={`technique-offer-grid${selected ? " has-selection" : ""}`}>
          {pending.techniqueIds.map((id) => {
            const tech = resolveTechnique(id);
            const powerLevel = tech ? resolvePowerLevel(tech) : 1;
            const hitPct = techniqueHitChancePercent(
              powerLevel,
              characterLevel,
              tech?.accuracyMod ?? 0,
            );
            const scalingStat = tech?.scalingStat;
            const scalingValue = scalingStat ? stats[scalingStat] : null;
            const badges = tech ? resolveSkillBadges(tech) : [];
            const potency = tech ? resolveOfferPotency(tech, stats) : null;
            const hasSide = Boolean(scalingStat) || badges.length > 0;
            const scaleTip = scalingStat
              ? potency?.kind === "HEAL"
                ? `Heal amount scales with ${STAT_LABELS[scalingStat]}${
                    scalingValue != null ? ` (${scalingValue})` : ""
                  }.`
                : potency?.kind === "DAMAGE"
                  ? `Damage scales with ${STAT_LABELS[scalingStat]}${
                      scalingValue != null ? ` (${scalingValue})` : ""
                    }.`
                  : `Linked to ${STAT_LABELS[scalingStat]}${
                      scalingValue != null ? ` (${scalingValue})` : ""
                    }.`
              : "";
            return (
              <li key={id}>
                <button
                  className={`technique-offer-btn${hasSide ? " has-side" : ""} ${selected === id ? "is-selected" : ""}`}
                  onClick={() => setSelected(id)}
                  type="button"
                >
                  <span className="technique-offer-main">
                    <span className="technique-offer-name font-display text-gold">
                      {tech?.name ?? id}
                    </span>
                    <span className="technique-offer-desc">
                      {tech?.description ?? "A fighting technique."}
                    </span>
                    <span className="technique-offer-meta">
                      <span>Power Lv {powerLevel}</span>
                      {potency?.kind === "DAMAGE" ? (
                        <span>
                          Damage ~{potency.min}–{potency.max}
                        </span>
                      ) : null}
                      {potency?.kind === "HEAL" ? <span>Heal ~{potency.amount}</span> : null}
                      <span>
                        Current Acc ~{hitPct}%
                        <span className="technique-offer-meta-note">
                          {" "}
                          (rises as you level)
                        </span>
                      </span>
                    </span>
                  </span>
                  {hasSide ? (
                    <span className="technique-offer-badges">
                      {scalingStat ? (
                        <EffectTooltip tip={scaleTip}>
                          <span className="technique-offer-scale-icon">
                            <StatIcon showTooltip={false} size={64} stat={scalingStat} />
                          </span>
                        </EffectTooltip>
                      ) : null}
                      {badges.length ? (
                        <SkillBadgeRow badges={badges} layout="column" size={64} />
                      ) : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          className="gold-btn level-up-confirm"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          type="button"
        >
          Confirm
        </button>
      </section>

      {isMobile ? null : (
        <aside className="level-up-stats-panel panel" aria-label={`${name} current stats`}>
          <p className="level-up-stats-kicker">Current stats</p>
          <h3 className="level-up-stats-name font-display">{name}</h3>
          <p className="level-up-stats-level text-parchment-dim">LV {characterLevel}</p>
          <ul className="level-up-stats-list">
            {(Object.keys(STAT_LABELS) as Array<keyof typeof STAT_LABELS>).map((stat) => {
              const value = stats[stat];
              const isRelevant = pending.techniqueIds.some(
                (id) => resolveTechnique(id)?.scalingStat === stat,
              );
              const isSelectedScale =
                selected != null && resolveTechnique(selected)?.scalingStat === stat;
              return (
                <li
                  className={`level-up-stats-row${isSelectedScale ? " is-selected" : ""}${isRelevant ? " is-relevant" : ""}`}
                  key={stat}
                >
                  <span className="level-up-stats-icon">
                    <StatIcon showTooltip={false} size={40} stat={stat} />
                  </span>
                  <span className="level-up-stats-label">{STAT_LABELS[stat]}</span>
                  <span className="level-up-stats-value">{value}</span>
                </li>
              );
            })}
          </ul>
        </aside>
      )}

      <SkillBadgeLegend onClose={() => setLegendOpen(false)} open={legendOpen} />
    </div>
  );
}
