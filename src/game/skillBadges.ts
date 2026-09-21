import type {
  Ability,
  AbilityEffectSpec,
  SkillBadgeId,
  SkillBadgeRef,
  TargetingSpec,
  Technique,
  TechniqueEffect,
  TechniqueSource,
} from "../models/types";
import { techniqueToAbility } from "./techniqueAbility";
import { abilityTechniqueEffects, targetingSummary } from "../services/TargetResolutionService";

const TECHNIQUE_SOURCES: TechniqueSource[] = [
  "WEAPON",
  "FIGHTING_STYLE",
  "DEVIL_FRUIT",
  "RACE",
  "HAKI",
];

function isTechniqueSource(
  source: Ability | Technique | (Partial<Ability> & { name?: string }),
): source is Technique {
  return (
    typeof (source as Technique).source === "string" &&
    TECHNIQUE_SOURCES.includes((source as Technique).source)
  );
}

export type SkillBadgeDefinition = {
  id: SkillBadgeId;
  label: string;
  shortLabel: string;
  defaultTip: string;
  /** Public icon path under /icons. */
  art: string;
};

/** Catalog of reusable grouped badges. */
export const SKILL_BADGE_CATALOG: Record<SkillBadgeId, SkillBadgeDefinition> = {
  SINGLE_TARGET: {
    id: "SINGLE_TARGET",
    label: "Single Target",
    shortLabel: "1",
    defaultTip: "Affects one chosen target. Hover the skill for ally vs enemy details.",
    art: "/icons/Skill_Badge/Badge_Single_Target.png",
  },
  MULTI_TARGET: {
    id: "MULTI_TARGET",
    label: "Multi Target",
    shortLabel: "M",
    defaultTip: "Affects multiple manually selected targets.",
    art: "/icons/Skill_Badge/Badge_Multi_Target.png",
  },
  ALL_TARGETS: {
    id: "ALL_TARGETS",
    label: "All Targets",
    shortLabel: "A",
    defaultTip: "Affects all valid targets in the chosen group.",
    art: "/icons/Skill_Badge/Badge_All_Targets-AOE.png",
  },
  RANDOM_TARGET: {
    id: "RANDOM_TARGET",
    label: "Random Target",
    shortLabel: "R",
    defaultTip: "Targets are chosen at random among valid combatants.",
    art: "/icons/Skill_Badge/Badge_Random_Target.png",
  },
  CHAIN: {
    id: "CHAIN",
    label: "Chain",
    shortLabel: "C",
    defaultTip: "Jumps from the primary target to additional foes.",
    art: "/icons/Skill_Badge/Badge_Chain.png",
  },
  SPLASH: {
    id: "SPLASH",
    label: "Splash",
    shortLabel: "S",
    defaultTip: "Hits a primary target and nearby adjacent targets.",
    art: "/icons/Skill_Badge/Badge_Splash.png",
  },
  SELF: {
    id: "SELF",
    label: "Self",
    shortLabel: "Me",
    defaultTip: "Affects the user.",
    art: "/icons/Skill_Badge/Badge_Self.png",
  },
  ROW_TARGET: {
    id: "ROW_TARGET",
    label: "Row Target",
    shortLabel: "Row",
    defaultTip: "Limited to a formation row (frontline or backline).",
    art: "/icons/Skill_Badge/Badge_Row_Target.png",
  },
  MULTI_HIT: {
    id: "MULTI_HIT",
    label: "Multi-Hit",
    shortLabel: "Hit",
    defaultTip: "Resolves multiple hits. Check the tip for hit count and repeats.",
    art: "/icons/Skill_Badge/Badge_Multi_Hit-Repeat.png",
  },
  HEAL: {
    id: "HEAL",
    label: "Heal",
    shortLabel: "+",
    defaultTip: "Restores HP.",
    art: "/icons/Skill_Badge/Badge_Heal-Recovery.png",
  },
  CLEANSE: {
    id: "CLEANSE",
    label: "Cleanse",
    shortLabel: "Cl",
    defaultTip: "Removes harmful status effects.",
    art: "/icons/Skill_Badge/Badge_Cleanse-Purify.png",
  },
  MP_RESTORE: {
    id: "MP_RESTORE",
    label: "MP Restore",
    shortLabel: "MP",
    defaultTip: "Restores MP or combat focus.",
    art: "/icons/Skill_Badge/Badge_MP_Restore-Energy.png",
  },
  GUARD: {
    id: "GUARD",
    label: "Guard",
    shortLabel: "Gd",
    defaultTip: "Applies a defensive guard, shield, or protect effect.",
    art: "/icons/Skill_Badge/Badge_Guard-Protect-Shield.png",
  },
  COUNTER: {
    id: "COUNTER",
    label: "Counter",
    shortLabel: "Rx",
    defaultTip: "Counter, reaction, or priority timing effect.",
    art: "/icons/Skill_Badge/Badge_Counter-Reaction-Priority.png",
  },
  FOCUS: {
    id: "FOCUS",
    label: "Focus",
    shortLabel: "Fc",
    defaultTip: "Focus, inspire, haste, or accuracy/momentum buff.",
    art: "/icons/Skill_Badge/Badge_Focus-Inspire-Haste.png",
  },
  CONTROL_BREAK: {
    id: "CONTROL_BREAK",
    label: "Control Break",
    shortLabel: "Br",
    defaultTip: "Unbalances, staggers, or otherwise disrupts control.",
    art: "/icons/Skill_Badge/Badge_Control_Break-Unbalanced-Stagger.png",
  },
  AFFLICTION: {
    id: "AFFLICTION",
    label: "Affliction",
    shortLabel: "DoT",
    defaultTip: "Applies an ongoing harmful affliction.",
    art: "/icons/Skill_Badge/Badge_Damage_Over_Time-Affliction.png",
  },
  VULNERABILITY: {
    id: "VULNERABILITY",
    label: "Vulnerability",
    shortLabel: "Ex",
    defaultTip: "Exposes or weakens defenses.",
    art: "/icons/Skill_Badge/Badge_Vulnerability-Exposed-Weakened.png",
  },
  DEVIL_FRUIT: {
    id: "DEVIL_FRUIT",
    label: "Devil Fruit",
    shortLabel: "DF",
    defaultTip: "Power drawn from a Devil Fruit.",
    art: "/icons/Skill_Badge/Badge_Devil_Fruit.png",
  },
};

const BADGE_PRIORITY: SkillBadgeId[] = [
  "DEVIL_FRUIT",
  "SELF",
  "SINGLE_TARGET",
  "MULTI_TARGET",
  "ALL_TARGETS",
  "RANDOM_TARGET",
  "ROW_TARGET",
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

const MAX_VISIBLE_BADGES = 4;

function groupLabel(targeting: TargetingSpec): string {
  if (targeting.group === "SELF") return "self";
  if (targeting.group === "ENEMY") return "enemy";
  if (targeting.group === "OTHER_ALLY") return "other ally";
  return "ally";
}

function targetingBadgeTips(targeting: TargetingSpec): Partial<Record<SkillBadgeId, string>> {
  const tips: Partial<Record<SkillBadgeId, string>> = {};
  const summary = targetingSummary(targeting);
  tips.SINGLE_TARGET = summary;
  tips.MULTI_TARGET = summary;
  tips.ALL_TARGETS = summary;
  tips.RANDOM_TARGET = summary;
  tips.SELF = "Target: Self";
  tips.ROW_TARGET =
    targeting.formation === "FRONT"
      ? "Targets the frontline row."
      : targeting.formation === "BACK"
        ? "Targets the backline row."
        : "Targets a formation row.";
  if (targeting.chainJumps) {
    tips.CHAIN = `Chains to up to ${targeting.chainJumps} additional ${groupLabel(targeting)} target(s).`;
  }
  if (targeting.adjacentSplash) {
    tips.SPLASH = `Primary target plus adjacent foes for ${Math.round(targeting.adjacentSplash * 100)}% splash.`;
  }
  if (targeting.hitCount && targeting.hitCount > 1) {
    const repeats = targeting.allowRepeatedTargets
      ? "The same target may be hit multiple times."
      : "Repeated targets are not allowed.";
    tips.MULTI_HIT = `${targeting.hitCount} hits. ${repeats}`;
    tips.RANDOM_TARGET = tips.MULTI_HIT;
  }
  return tips;
}

function classifyStatus(spec: AbilityEffectSpec | undefined): SkillBadgeId | null {
  if (!spec) return null;
  if (spec.kind === "BUFF") {
    if ((spec.dodgeBonus ?? 0) > 0 || (spec.damageTakenMod ?? 0) < 0) {
      return "GUARD";
    }
    if ((spec.accuracyBonus ?? 0) > 0 || (spec.damageDealtMod ?? 0) > 0) {
      return "FOCUS";
    }
    return "FOCUS";
  }
  // DEBUFF
  if ((spec.damageTakenMod ?? 0) > 0 || (spec.damageDealtMod ?? 0) < 0) {
    if ((spec.damageTakenMod ?? 0) > 0) return "VULNERABILITY";
    return "CONTROL_BREAK";
  }
  if ((spec.dodgeBonus ?? 0) < 0 || (spec.accuracyBonus ?? 0) < 0) {
    return "CONTROL_BREAK";
  }
  return "CONTROL_BREAK";
}

function pushBadge(
  map: Map<SkillBadgeId, SkillBadgeRef>,
  id: SkillBadgeId,
  partial?: Partial<SkillBadgeRef>,
): void {
  const existing = map.get(id);
  if (existing) {
    map.set(id, {
      id,
      count: partial?.count ?? existing.count,
      tip: partial?.tip ?? existing.tip,
    });
    return;
  }
  map.set(id, { id, count: partial?.count, tip: partial?.tip });
}

function deriveFromTargeting(
  map: Map<SkillBadgeId, SkillBadgeRef>,
  targeting: TargetingSpec,
): void {
  const tips = targetingBadgeTips(targeting);

  if (targeting.group === "SELF" || targeting.selection === "SELF") {
    pushBadge(map, "SELF", { tip: tips.SELF });
  } else if (targeting.selection === "ALL") {
    pushBadge(map, "ALL_TARGETS", { tip: tips.ALL_TARGETS });
  } else if (targeting.selection === "RANDOM" || targeting.retargetEachHit) {
    const count = targeting.hitCount ?? targeting.exactCount ?? targeting.maxCount;
    pushBadge(map, "RANDOM_TARGET", { count, tip: tips.RANDOM_TARGET });
  } else if (targeting.selection === "MANUAL" || targeting.selection === "AUTO") {
    const count = targeting.exactCount ?? targeting.maxCount ?? 1;
    if (count <= 1) {
      pushBadge(map, "SINGLE_TARGET", { tip: tips.SINGLE_TARGET });
    } else {
      pushBadge(map, "MULTI_TARGET", { count, tip: tips.MULTI_TARGET });
    }
  }

  if (targeting.formation && targeting.formation !== "ANY") {
    pushBadge(map, "ROW_TARGET", { tip: tips.ROW_TARGET });
  }
  if (targeting.chainJumps && targeting.chainJumps > 0) {
    pushBadge(map, "CHAIN", { count: targeting.chainJumps, tip: tips.CHAIN });
  }
  if (targeting.adjacentSplash && targeting.adjacentSplash > 0) {
    pushBadge(map, "SPLASH", { tip: tips.SPLASH });
  }
  if (targeting.hitCount && targeting.hitCount > 1) {
    pushBadge(map, "MULTI_HIT", { count: targeting.hitCount, tip: tips.MULTI_HIT });
  }
}

function deriveFromEffect(map: Map<SkillBadgeId, SkillBadgeRef>, effect: TechniqueEffect): void {
  deriveFromTargeting(map, effect.targeting);
  if (effect.kind === "HEAL") {
    const amount = effect.healAmount;
    pushBadge(map, "HEAL", {
      tip: amount
        ? `Restores about ${amount} HP to each affected ally.`
        : "Restores HP to affected allies.",
    });
  }
  const statusId = classifyStatus(effect.applyEffect ?? effect.statusEffect);
  if (statusId) {
    const spec = effect.applyEffect ?? effect.statusEffect;
    pushBadge(map, statusId, {
      tip: spec ? `${spec.name} (${spec.turns} turns).` : undefined,
    });
  }
}

function deriveFromTagsAndEffects(
  map: Map<SkillBadgeId, SkillBadgeRef>,
  source: Pick<Ability, "tags" | "effects" | "applyEffect" | "animationType" | "devilFruitSkill">,
): void {
  const tags = source.tags ?? [];
  const effectText = (source.effects ?? []).join(" ").toLowerCase();
  if (source.devilFruitSkill) {
    pushBadge(map, "DEVIL_FRUIT");
  }
  if (tags.includes("HEAL") || source.animationType === "HEAL") {
    pushBadge(map, "HEAL");
  }
  if (tags.includes("MULTI_HIT")) {
    pushBadge(map, "MULTI_HIT");
  }
  if (tags.includes("RANDOM")) {
    pushBadge(map, "RANDOM_TARGET");
  }
  if (tags.includes("AOE")) {
    pushBadge(map, "ALL_TARGETS");
  }
  if (tags.includes("SINGLE") && !map.has("MULTI_TARGET") && !map.has("ALL_TARGETS")) {
    pushBadge(map, "SINGLE_TARGET");
  }
  if (tags.includes("DEFENSIVE")) {
    pushBadge(map, "GUARD");
  }

  if (/cleanse|purif|remov/.test(effectText)) {
    pushBadge(map, "CLEANSE");
  }
  if (/\bmp\b|energy|focus restore/.test(effectText)) {
    pushBadge(map, "MP_RESTORE");
  }
  if (/counter|reaction|priority|initiative/.test(effectText)) {
    pushBadge(map, "COUNTER");
  }
  if (/bleed|burn|poison|dot|afflict/.test(effectText)) {
    pushBadge(map, "AFFLICTION");
  }
  if (/expos|vulnerab|weaken|defense down|armour gap/.test(effectText)) {
    pushBadge(map, "VULNERABILITY");
  }
  if (/unbalanc|stagger|disrupt|slow|interrupt/.test(effectText)) {
    pushBadge(map, "CONTROL_BREAK");
  }

  const statusId = classifyStatus(source.applyEffect);
  if (statusId) {
    pushBadge(map, statusId, {
      tip: source.applyEffect
        ? `${source.applyEffect.name} (${source.applyEffect.turns} turns).`
        : undefined,
    });
  }
}

function finalize(map: Map<SkillBadgeId, SkillBadgeRef>): SkillBadgeRef[] {
  const ordered = BADGE_PRIORITY.filter((id) => map.has(id)).map((id) => map.get(id)!);
  // Prefer not showing SINGLE_TARGET together with stronger targeting badges.
  const filtered = ordered.filter((badge, _index, list) => {
    if (badge.id === "SINGLE_TARGET") {
      return !list.some((other) =>
        ["MULTI_TARGET", "ALL_TARGETS", "RANDOM_TARGET", "SELF"].includes(other.id),
      );
    }
    return true;
  });
  return filtered.slice(0, MAX_VISIBLE_BADGES);
}

export function resolveSkillBadges(
  source: Ability | Technique | (Partial<Ability> & { name?: string }),
): SkillBadgeRef[] {
  if (source.badges?.length) {
    return source.badges.slice(0, MAX_VISIBLE_BADGES);
  }

  // Raw Technique defs often omit tags/targeting; normalize like combat does.
  const normalized = isTechniqueSource(source) ? techniqueToAbility(source) : source;

  const map = new Map<SkillBadgeId, SkillBadgeRef>();
  const asAbility = normalized as Ability;
  if (asAbility.techniqueEffects?.length || asAbility.targeting || asAbility.tags) {
    for (const effect of abilityTechniqueEffects(asAbility)) {
      deriveFromEffect(map, effect);
    }
  } else if (normalized.targeting) {
    deriveFromTargeting(map, normalized.targeting);
  }

  deriveFromTagsAndEffects(map, {
    tags: normalized.tags,
    effects: normalized.effects,
    applyEffect: normalized.applyEffect,
    animationType: "animationType" in normalized ? normalized.animationType : undefined,
    devilFruitSkill: "devilFruitSkill" in normalized ? normalized.devilFruitSkill : undefined,
  });

  return finalize(map);
}

export function skillBadgeTip(badge: SkillBadgeRef): string {
  const def = SKILL_BADGE_CATALOG[badge.id];
  if (badge.tip) {
    return badge.tip;
  }
  if (badge.count != null) {
    return `${def.label} ×${badge.count}. ${def.defaultTip}`;
  }
  return `${def.label}. ${def.defaultTip}`;
}

export function skillBadgeLabel(badge: SkillBadgeRef): string {
  const def = SKILL_BADGE_CATALOG[badge.id];
  if (badge.count != null) {
    return `${def.shortLabel}×${badge.count}`;
  }
  return def.shortLabel;
}
