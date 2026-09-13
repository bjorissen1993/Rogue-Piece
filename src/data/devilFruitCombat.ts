import type { Ability, FruitType, PlayerStats, StatName, WeaponType, ZoanFormId } from "../models/types";

export type ZoanFormProfile = {
  id: ZoanFormId;
  label: string;
  description: string;
  /** Additive mods on top of base (human + fruit passive) stats. */
  statMods: Partial<Record<StatName, number>>;
};

export type DevilFruitCombatTechniqueDef = {
  id: string;
  name: string;
  description: string;
  /** Unlocked from the start when the fruit is eaten. */
  starter?: boolean;
  /** How many uses of any DF skill (or this fruit's skills) needed after starter to unlock. */
  unlockAfterUses?: number;
  /** Prefer unlocking after this specific technique id has been used enough. */
  unlockAfterTechniqueId?: string;
  unlockAfterTechniqueUses?: number;
  power: number;
  powerLevel: number;
  scalingStat: StatName;
  accuracyMod: number;
  mpCost?: number;
  tags?: Ability["tags"];
  applyEffect?: Ability["applyEffect"];
  targeting?: Ability["targeting"];
  /** Zoan-only: usable only in these forms (empty = any / human ok). */
  requiredForms?: ZoanFormId[];
};

export type DevilFruitCombatDef = {
  fruitId: string;
  type: FruitType;
  techniques: DevilFruitCombatTechniqueDef[];
  zoanForms?: ZoanFormProfile[];
};

function withDfMeta(ability: Ability): Ability {
  return {
    ...ability,
    devilFruitSkill: true,
    // Leave badges unset so targeting/effect badges still derive; DEVIL_FRUIT comes from devilFruitSkill.
  };
}

export const DEVIL_FRUIT_COMBAT: DevilFruitCombatDef[] = [
  {
    fruitId: "bara_bara",
    type: "PARAMECIA",
    techniques: [
      {
        id: "df_bara_split",
        name: "Bara Split",
        description: "Come apart at the joints — blades find nothing solid to cut.",
        starter: true,
        power: 8,
        powerLevel: 4,
        scalingStat: "defense",
        accuracyMod: 4,
        mpCost: 4,
        tags: ["MELEE", "SINGLE", "DEFENSIVE"],
        applyEffect: {
          id: "bara_split_guard",
          name: "Scattered",
          kind: "BUFF",
          turns: 1,
          target: "SELF",
          dodgeBonus: 12,
          damageTakenMod: -0.15,
        },
      },
      {
        id: "df_bara_cannon",
        name: "Bara Cannon",
        description: "Launch a fist like shot, then reel it back on an invisible string.",
        unlockAfterUses: 3,
        power: 18,
        powerLevel: 8,
        scalingStat: "strength",
        accuracyMod: 0,
        mpCost: 7,
        tags: ["RANGED", "SINGLE"],
      },
      {
        id: "df_bara_festival",
        name: "Bara Festival",
        description: "Scatter and strike from every angle at once.",
        unlockAfterUses: 8,
        unlockAfterTechniqueId: "df_bara_cannon",
        unlockAfterTechniqueUses: 2,
        power: 14,
        powerLevel: 10,
        scalingStat: "willpower",
        accuracyMod: -2,
        mpCost: 12,
        tags: ["MELEE", "AOE", "MULTI_HIT"],
        targeting: {
          group: "ENEMY",
          selection: "RANDOM",
          hitCount: 3,
          allowRepeatedTargets: true,
          retargetEachHit: true,
        },
      },
    ],
  },
  {
    fruitId: "bomu_bomu",
    type: "PARAMECIA",
    techniques: [
      {
        id: "df_bomu_kick",
        name: "Explosive Kick",
        description: "A kick that detonates on contact.",
        starter: true,
        power: 20,
        powerLevel: 9,
        scalingStat: "strength",
        accuracyMod: -2,
        mpCost: 6,
        tags: ["MELEE", "SINGLE"],
      },
      {
        id: "df_bomu_nose",
        name: "Nose Fancy Cannon",
        description: "A mucus-charged blast. Undignified. Effective.",
        unlockAfterUses: 4,
        power: 16,
        powerLevel: 8,
        scalingStat: "willpower",
        accuracyMod: 2,
        mpCost: 8,
        tags: ["RANGED", "SINGLE"],
      },
      {
        id: "df_bomu_sparking",
        name: "Sparking Bullet",
        description: "Nail-tip detonations — small, mean, and hard to dodge.",
        unlockAfterUses: 9,
        power: 12,
        powerLevel: 11,
        scalingStat: "speed",
        accuracyMod: 4,
        mpCost: 10,
        tags: ["RANGED", "MULTI_HIT", "RANDOM"],
        targeting: {
          group: "ENEMY",
          selection: "RANDOM",
          hitCount: 4,
          allowRepeatedTargets: true,
          retargetEachHit: true,
        },
      },
    ],
  },
  {
    fruitId: "bari_bari",
    type: "PARAMECIA",
    techniques: [
      {
        id: "df_bari_barrier",
        name: "Barrier",
        description: "A wall of force that does not negotiate with muskets.",
        starter: true,
        power: 6,
        powerLevel: 5,
        scalingStat: "defense",
        accuracyMod: 8,
        mpCost: 5,
        tags: ["DEFENSIVE", "SINGLE"],
        applyEffect: {
          id: "barrier_wall",
          name: "Barrier",
          kind: "BUFF",
          turns: 2,
          target: "SELF",
          damageTakenMod: -0.35,
        },
      },
      {
        id: "df_bari_crash",
        name: "Barrier Crash",
        description: "The wall becomes a ram.",
        unlockAfterUses: 4,
        power: 22,
        powerLevel: 10,
        scalingStat: "defense",
        accuracyMod: -4,
        mpCost: 9,
        tags: ["MELEE", "SINGLE"],
      },
    ],
  },
  {
    fruitId: "doru_doru",
    type: "PARAMECIA",
    techniques: [
      {
        id: "df_doru_wall",
        name: "Wax Wall",
        description: "A hardening flood that seals a corridor.",
        starter: true,
        power: 10,
        powerLevel: 5,
        scalingStat: "defense",
        accuracyMod: 2,
        mpCost: 5,
        tags: ["DEFENSIVE", "SINGLE"],
        applyEffect: {
          id: "wax_seal",
          name: "Wax Seal",
          kind: "BUFF",
          turns: 2,
          target: "SELF",
          damageTakenMod: -0.2,
        },
      },
      {
        id: "df_doru_armor",
        name: "Candle Armor",
        description: "Wax set as plate — brittle only to those who know fire.",
        unlockAfterUses: 3,
        power: 8,
        powerLevel: 6,
        scalingStat: "willpower",
        accuracyMod: 4,
        mpCost: 6,
        tags: ["BUFF", "SINGLE"],
        applyEffect: {
          id: "candle_armor",
          name: "Candle Armor",
          kind: "BUFF",
          turns: 3,
          target: "SELF",
          damageTakenMod: -0.25,
          damageDealtMod: 0.1,
        },
      },
      {
        id: "df_doru_lance",
        name: "Candle Lance",
        description: "A spear of hardening wax driven straight through a guard.",
        unlockAfterUses: 7,
        power: 19,
        powerLevel: 9,
        scalingStat: "strength",
        accuracyMod: 0,
        mpCost: 8,
        tags: ["MELEE", "SINGLE"],
      },
    ],
  },
  {
    fruitId: "inu_wolf",
    type: "ZOAN",
    zoanForms: [
      {
        id: "HUMAN",
        label: "Human",
        description: "Baseline shape — full control, no beast edge.",
        statMods: {},
      },
      {
        id: "HYBRID",
        label: "Wolf Hybrid",
        description: "Hands and fangs in the same shape — stronger, still clever.",
        statMods: { strength: 4, speed: 1, defense: 1, willpower: 1 },
      },
      {
        id: "HYBRID_POWER",
        label: "Power Hybrid",
        description: "Bulkier hybrid — raw strength over finesse.",
        statMods: { strength: 6, defense: 2, speed: -1 },
      },
      {
        id: "HYBRID_SPEED",
        label: "Speed Hybrid",
        description: "Lean hybrid — claws flash before the eye catches up.",
        statMods: { speed: 5, strength: 2, defense: -1 },
      },
      {
        id: "FULL_BEAST",
        label: "Full Beast",
        description: "Four legs, hunt-scent, and no more conversation — fastest form.",
        statMods: { speed: 7, strength: 2, defense: -1, charisma: -2 },
      },
    ],
    techniques: [
      {
        id: "df_inu_claw",
        name: "Wolf Claw",
        description: "A ripping slash with half-changed hands.",
        starter: true,
        requiredForms: ["HYBRID", "HYBRID_POWER", "HYBRID_SPEED", "FULL_BEAST"],
        power: 16,
        powerLevel: 7,
        scalingStat: "strength",
        accuracyMod: 2,
        mpCost: 5,
        tags: ["MELEE", "SINGLE"],
      },
      {
        id: "df_inu_howl",
        name: "Hunt Howl",
        description: "A howl that freezes prey mid-step.",
        unlockAfterUses: 4,
        requiredForms: ["HYBRID", "HYBRID_POWER", "HYBRID_SPEED", "FULL_BEAST"],
        power: 10,
        powerLevel: 6,
        scalingStat: "willpower",
        accuracyMod: 4,
        mpCost: 6,
        tags: ["DEBUFF", "AOE"],
        targeting: { group: "ENEMY", selection: "ALL" },
        applyEffect: {
          id: "hunt_terror",
          name: "Hunt Terror",
          kind: "DEBUFF",
          turns: 2,
          target: "ALL_ENEMIES",
          accuracyBonus: -10,
          dodgeBonus: -6,
        },
      },
      {
        id: "df_inu_pounce",
        name: "Beast Pounce",
        description: "Full-animal speed ends on the sternum.",
        unlockAfterUses: 8,
        requiredForms: ["FULL_BEAST", "HYBRID_SPEED"],
        power: 22,
        powerLevel: 11,
        scalingStat: "speed",
        accuracyMod: 4,
        mpCost: 9,
        tags: ["MELEE", "SINGLE"],
      },
    ],
  },
  {
    fruitId: "neko_leopard",
    type: "ZOAN",
    zoanForms: [
      {
        id: "HUMAN",
        label: "Human",
        description: "Baseline shape.",
        statMods: {},
      },
      {
        id: "HYBRID",
        label: "Leopard Hybrid",
        description: "A fighter's middle form: claw, reach, and a human mind.",
        statMods: { strength: 5, speed: 3, defense: 1 },
      },
      {
        id: "HYBRID_POWER",
        label: "Muscle Hybrid",
        description: "Heavier leopard hybrid — crushing strength.",
        statMods: { strength: 8, defense: 2, speed: 0 },
      },
      {
        id: "HYBRID_SPEED",
        label: "Sprint Hybrid",
        description: "Wire-taut hybrid — sudden, lethal speed.",
        statMods: { speed: 7, strength: 3, defense: -1 },
      },
      {
        id: "FULL_BEAST",
        label: "Full Beast",
        description: "All muscle and sudden speed — pure predator.",
        statMods: { speed: 8, strength: 4, defense: -1, intelligence: -1 },
      },
    ],
    techniques: [
      {
        id: "df_neko_swipe",
        name: "Leopard Swipe",
        description: "A fighter's claw arc with hybrid reach.",
        starter: true,
        requiredForms: ["HYBRID", "HYBRID_POWER", "HYBRID_SPEED", "FULL_BEAST"],
        power: 17,
        powerLevel: 8,
        scalingStat: "strength",
        accuracyMod: 2,
        mpCost: 5,
        tags: ["MELEE", "SINGLE"],
      },
      {
        id: "df_neko_pounce",
        name: "Pounce",
        description: "A leap that ends on the sternum.",
        unlockAfterUses: 4,
        requiredForms: ["HYBRID", "HYBRID_SPEED", "FULL_BEAST"],
        power: 21,
        powerLevel: 10,
        scalingStat: "speed",
        accuracyMod: 3,
        mpCost: 8,
        tags: ["MELEE", "SINGLE"],
      },
      {
        id: "df_neko_flurry",
        name: "Spotted Flurry",
        description: "A blur of claws from full-beast motion.",
        unlockAfterUses: 9,
        requiredForms: ["FULL_BEAST", "HYBRID_SPEED"],
        power: 11,
        powerLevel: 12,
        scalingStat: "speed",
        accuracyMod: 2,
        mpCost: 11,
        tags: ["MELEE", "MULTI_HIT", "RANDOM"],
        targeting: {
          group: "ENEMY",
          selection: "RANDOM",
          hitCount: 4,
          allowRepeatedTargets: true,
          retargetEachHit: true,
        },
      },
    ],
  },
  {
    fruitId: "mera_mera",
    type: "LOGIA",
    techniques: [
      {
        id: "df_mera_fist",
        name: "Fire Fist",
        description: "A punch thrown as a column of flame.",
        starter: true,
        power: 24,
        powerLevel: 11,
        scalingStat: "strength",
        accuracyMod: -2,
        mpCost: 8,
        tags: ["RANGED", "SINGLE"],
        applyEffect: {
          id: "burned",
          name: "Burned",
          kind: "DEBUFF",
          turns: 2,
          target: "TARGET",
          damageTakenMod: 0.1,
        },
      },
      {
        id: "df_mera_firefly",
        name: "Firefly",
        description: "Small lights that drift, then bloom into fire.",
        unlockAfterUses: 4,
        power: 14,
        powerLevel: 9,
        scalingStat: "willpower",
        accuracyMod: 0,
        mpCost: 10,
        tags: ["RANGED", "AOE"],
        targeting: { group: "ENEMY", selection: "ALL" },
      },
      {
        id: "df_mera_body",
        name: "Flame Body",
        description: "Let a blow pass through as heat and light.",
        unlockAfterUses: 7,
        power: 6,
        powerLevel: 7,
        scalingStat: "willpower",
        accuracyMod: 10,
        mpCost: 6,
        tags: ["DEFENSIVE", "BUFF"],
        applyEffect: {
          id: "flame_body",
          name: "Flame Body",
          kind: "BUFF",
          turns: 2,
          target: "SELF",
          dodgeBonus: 15,
          damageTakenMod: -0.2,
        },
      },
    ],
  },
  {
    fruitId: "suna_suna",
    type: "LOGIA",
    techniques: [
      {
        id: "df_suna_body",
        name: "Sand Body",
        description: "Flesh becomes grit. Blades find nothing to cut.",
        starter: true,
        power: 6,
        powerLevel: 5,
        scalingStat: "speed",
        accuracyMod: 8,
        mpCost: 5,
        tags: ["DEFENSIVE", "BUFF"],
        applyEffect: {
          id: "sand_body",
          name: "Sand Body",
          kind: "BUFF",
          turns: 2,
          target: "SELF",
          dodgeBonus: 18,
        },
      },
      {
        id: "df_suna_desiccate",
        name: "Desiccate",
        description: "Moisture pulled out of wood, fruit, and people.",
        unlockAfterUses: 4,
        power: 20,
        powerLevel: 10,
        scalingStat: "willpower",
        accuracyMod: 0,
        mpCost: 9,
        tags: ["RANGED", "SINGLE", "DEBUFF"],
        applyEffect: {
          id: "desiccated",
          name: "Desiccated",
          kind: "DEBUFF",
          turns: 2,
          target: "TARGET",
          damageDealtMod: -0.15,
          dodgeBonus: -8,
        },
      },
      {
        id: "df_suna_storm",
        name: "Sandstorm",
        description: "A grinding cloud that scours a whole deck.",
        unlockAfterUses: 9,
        power: 15,
        powerLevel: 12,
        scalingStat: "willpower",
        accuracyMod: -2,
        mpCost: 12,
        tags: ["RANGED", "AOE"],
        targeting: { group: "ENEMY", selection: "ALL" },
      },
    ],
  },
];

export function getDevilFruitCombat(fruitId: string): DevilFruitCombatDef | undefined {
  return DEVIL_FRUIT_COMBAT.find((entry) => entry.fruitId === fruitId);
}

export function fruitTechniqueToAbility(def: DevilFruitCombatTechniqueDef): Ability {
  return withDfMeta({
    id: def.id,
    name: def.name,
    description: def.description,
    power: def.power,
    powerLevel: def.powerLevel,
    scalingStat: def.scalingStat,
    accuracyMod: def.accuracyMod,
    mpCost: def.mpCost,
    tags: def.tags,
    applyEffect: def.applyEffect,
    targeting: def.targeting,
    devilFruitSkill: true,
  });
}

export function applyZoanFormMods(base: PlayerStats, mods: Partial<Record<StatName, number>> | undefined): PlayerStats {
  if (!mods) {
    return { ...base };
  }
  const next = { ...base };
  for (const [stat, value] of Object.entries(mods) as Array<[StatName, number]>) {
    next[stat] = Math.max(1, (next[stat] ?? 0) + value);
  }
  return next;
}

/** Dual-weapon combo techniques when both classes are equipped. */
export const DUAL_WIELD_TECHNIQUES: Array<{
  id: string;
  name: string;
  description: string;
  requiredWeaponTypes: [WeaponType, WeaponType];
  power: number;
  powerLevel: number;
  scalingStat: StatName;
  accuracyMod: number;
  mpCost?: number;
  tags?: Ability["tags"];
}> = [
  {
    id: "dual_blade_cross",
    name: "Cross Cut",
    description: "Two blades meet in an X — hard to guard both edges.",
    requiredWeaponTypes: ["SWORD", "SWORD"],
    power: 16,
    powerLevel: 8,
    scalingStat: "speed",
    accuracyMod: 0,
    mpCost: 6,
    tags: ["MELEE", "SINGLE", "MULTI_HIT"],
  },
  {
    id: "sword_and_shot",
    name: "Cut and Shot",
    description: "Close with steel, finish with powder — the classic boarding mix.",
    requiredWeaponTypes: ["SWORD", "GUN"],
    power: 18,
    powerLevel: 9,
    scalingStat: "speed",
    accuracyMod: 2,
    mpCost: 7,
    tags: ["MELEE", "SINGLE"],
  },
];
