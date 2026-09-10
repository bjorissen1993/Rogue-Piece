import type { Ability, AbilityTag, Technique } from "../models/types";
import { powerFromLevel, powerLevelFromLegacyPower } from "../game/techniquePower";

export function resolvePowerLevel(tech: Pick<Technique, "power" | "powerLevel">): number {
  return tech.powerLevel ?? powerLevelFromLegacyPower(tech.power);
}

export function defaultTechniqueTags(tech: Technique): AbilityTag[] {
  if (tech.tags?.length) {
    return [...tech.tags];
  }
  if (tech.targeting?.selection === "ALL" || tech.id === "spear_sweep" || tech.id === "sword_crescent") {
    return ["MELEE", "AOE"];
  }
  if (tech.targeting?.hitCount && tech.targeting.hitCount > 1) {
    return ["MELEE", "MULTI_HIT", "RANDOM"];
  }
  if (tech.weaponType === "GUN") {
    return ["RANGED", "SINGLE"];
  }
  return ["MELEE", "SINGLE"];
}

export function techniqueToAbility(tech: Technique): Ability {
  const powerLevel = resolvePowerLevel(tech);
  const tags = defaultTechniqueTags(tech);
  return {
    id: tech.id,
    name: tech.name,
    description: tech.description,
    power: powerFromLevel(powerLevel),
    powerLevel,
    scalingStat: tech.scalingStat,
    accuracyMod: tech.accuracyMod,
    mpCost: tech.mpCost,
    tags,
    targeting: tech.targeting,
    techniqueEffects: tech.techniqueEffects,
    badges: tech.badges,
    effects: tech.effects,
    applyEffect: tech.applyEffect,
    animationType: tags.includes("AOE")
      ? "AOE"
      : tags.includes("HEAL")
        ? "HEAL"
        : tech.applyEffect?.kind === "BUFF"
          ? "BUFF"
          : tech.applyEffect?.kind === "DEBUFF"
            ? "DEBUFF"
            : undefined,
  };
}
