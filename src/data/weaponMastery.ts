import type {
  Ability,
  FruitType,
  MasteryTrackId,
  StatName,
  WeaponType,
} from "../models/types";
import { MASTERY_COMBO_LEVEL, MASTERY_SOLO_UNLOCK_LEVELS } from "../game/constants";

export type MasterySoloUnlockDef = {
  id: string;
  track: MasteryTrackId;
  /** Mastery level required (must be in MASTERY_SOLO_UNLOCK_LEVELS spirit). */
  level: number;
  name: string;
  description: string;
  power: number;
  powerLevel: number;
  scalingStat: StatName;
  accuracyMod: number;
  mpCost?: number;
  tags?: Ability["tags"];
  applyEffect?: Ability["applyEffect"];
  targeting?: Ability["targeting"];
  /** Combat gate — which equipped class(es) show this skill. */
  weaponType?: WeaponType;
  requiredWeaponTypes?: WeaponType[];
  /** UNARMED skills appear when no weapon is equipped (or fists/kicks style). */
  unarmedOnly?: boolean;
};

export type MasteryComboUnlockDef = {
  id: string;
  tracks: [MasteryTrackId, MasteryTrackId];
  /** Both tracks must reach this level (default MASTERY_COMBO_LEVEL). */
  level?: number;
  name: string;
  description: string;
  power: number;
  powerLevel: number;
  scalingStat: StatName;
  accuracyMod: number;
  mpCost?: number;
  tags?: Ability["tags"];
  applyEffect?: Ability["applyEffect"];
  targeting?: Ability["targeting"];
  weaponType?: WeaponType;
  requiredWeaponTypes?: WeaponType[];
  /** Needs a devil fruit equipped (eaten) to use. */
  requiresDevilFruit?: boolean;
  unarmedOnly?: boolean;
  /**
   * When set, name/description are built from fruit category templates.
   * `name` / `description` above are fallbacks when no fruit is eaten yet (still unlocked in list).
   */
  fruitTemplates?: Partial<
    Record<
      FruitType,
      {
        name: string;
        description: string;
      }
    >
  >;
  /** Optional per-fruit overrides (fruit id → name/desc). */
  fruitOverrides?: Record<string, { name: string; description: string }>;
};

/** Solo mastery techniques unlocked by raising a single track. */
export const MASTERY_SOLO_UNLOCKS: MasterySoloUnlockDef[] = [
  // —— SWORD ——
  {
    id: "mstry_sword_edge_sense",
    track: "SWORD",
    level: 1,
    name: "Edge Sense",
    description: "Feel the line of the cut before steel meets flesh.",
    power: 5,
    powerLevel: 3,
    scalingStat: "speed",
    accuracyMod: 4,
    mpCost: 3,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SWORD",
  },
  {
    id: "mstry_sword_flowing_cut",
    track: "SWORD",
    level: 3,
    name: "Flowing Cut",
    description: "One smooth draw that refuses to stop halfway.",
    power: 9,
    powerLevel: 6,
    scalingStat: "strength",
    accuracyMod: 0,
    mpCost: 5,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SWORD",
  },
  {
    id: "mstry_sword_pressure_line",
    track: "SWORD",
    level: 5,
    name: "Pressure Line",
    description: "Carve a line they cannot safely cross.",
    power: 12,
    powerLevel: 8,
    scalingStat: "strength",
    accuracyMod: -2,
    mpCost: 7,
    tags: ["MELEE", "SINGLE", "DEBUFF"],
    weaponType: "SWORD",
    applyEffect: {
      id: "pressure_line",
      name: "Pressured",
      kind: "DEBUFF",
      turns: 2,
      target: "TARGET",
      dodgeBonus: -8,
    },
  },
  {
    id: "mstry_sword_master_draw",
    track: "SWORD",
    level: 8,
    name: "Master Draw",
    description: "A single decisive stroke — nothing wasted.",
    power: 18,
    powerLevel: 11,
    scalingStat: "strength",
    accuracyMod: 2,
    mpCost: 10,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SWORD",
  },
  {
    id: "mstry_sword_legend_arc",
    track: "SWORD",
    level: 12,
    name: "Legend Arc",
    description: "A sweeping legend-cut that clears the deck.",
    power: 14,
    powerLevel: 13,
    scalingStat: "strength",
    accuracyMod: -4,
    mpCost: 14,
    tags: ["MELEE", "AOE"],
    weaponType: "SWORD",
    targeting: { group: "ENEMY", selection: "ALL", whenInsufficient: "REDUCE" },
  },

  // —— GUN ——
  {
    id: "mstry_gun_steady_aim",
    track: "GUN",
    level: 1,
    name: "Steady Aim",
    description: "Breathe out. Squeeze. Don't flinch at the kick.",
    power: 8,
    powerLevel: 4,
    scalingStat: "intelligence",
    accuracyMod: 6,
    mpCost: 3,
    tags: ["RANGED", "SINGLE"],
    weaponType: "GUN",
  },
  {
    id: "mstry_gun_double_tap",
    track: "GUN",
    level: 3,
    name: "Double Tap",
    description: "Two shots before the smoke clears.",
    power: 7,
    powerLevel: 6,
    scalingStat: "speed",
    accuracyMod: -2,
    mpCost: 6,
    tags: ["RANGED", "SINGLE", "MULTI_HIT"],
    weaponType: "GUN",
  },
  {
    id: "mstry_gun_marked_shot",
    track: "GUN",
    level: 5,
    name: "Marked Shot",
    description: "Put a hole where they least expect to need armor.",
    power: 14,
    powerLevel: 8,
    scalingStat: "intelligence",
    accuracyMod: 2,
    mpCost: 7,
    tags: ["RANGED", "SINGLE", "DEBUFF"],
    weaponType: "GUN",
    applyEffect: {
      id: "marked_shot",
      name: "Marked",
      kind: "DEBUFF",
      turns: 2,
      target: "TARGET",
      damageTakenMod: 0.12,
    },
  },
  {
    id: "mstry_gun_suppressing_fire",
    track: "GUN",
    level: 8,
    name: "Suppressing Fire",
    description: "Keep heads down across the whole line.",
    power: 8,
    powerLevel: 10,
    scalingStat: "intelligence",
    accuracyMod: -4,
    mpCost: 11,
    tags: ["RANGED", "AOE"],
    weaponType: "GUN",
    targeting: { group: "ENEMY", selection: "ALL", whenInsufficient: "REDUCE" },
  },
  {
    id: "mstry_gun_deadeye",
    track: "GUN",
    level: 12,
    name: "Deadeye",
    description: "One shot that ends arguments.",
    power: 24,
    powerLevel: 14,
    scalingStat: "intelligence",
    accuracyMod: 4,
    mpCost: 14,
    tags: ["RANGED", "SINGLE"],
    weaponType: "GUN",
  },

  // —— SPEAR (polearm) ——
  {
    id: "mstry_spear_measure",
    track: "SPEAR",
    level: 1,
    name: "Measure Distance",
    description: "Keep them at the tip — never closer than you allow.",
    power: 6,
    powerLevel: 3,
    scalingStat: "strength",
    accuracyMod: 4,
    mpCost: 3,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SPEAR",
  },
  {
    id: "mstry_spear_spiral",
    track: "SPEAR",
    level: 3,
    name: "Spiral Thrust",
    description: "Twist on the drive so the point bores past a guard.",
    power: 10,
    powerLevel: 6,
    scalingStat: "strength",
    accuracyMod: 0,
    mpCost: 5,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SPEAR",
  },
  {
    id: "mstry_spear_wall",
    track: "SPEAR",
    level: 5,
    name: "Spear Wall",
    description: "A fan of points that punishes a rush.",
    power: 8,
    powerLevel: 8,
    scalingStat: "strength",
    accuracyMod: -2,
    mpCost: 8,
    tags: ["MELEE", "AOE"],
    weaponType: "SPEAR",
    targeting: { group: "ENEMY", selection: "ALL", whenInsufficient: "REDUCE" },
  },
  {
    id: "mstry_spear_skewer",
    track: "SPEAR",
    level: 8,
    name: "Skewer Line",
    description: "Commit the full length — pin them where they stand.",
    power: 17,
    powerLevel: 11,
    scalingStat: "strength",
    accuracyMod: -4,
    mpCost: 10,
    tags: ["MELEE", "SINGLE", "DEBUFF"],
    weaponType: "SPEAR",
    applyEffect: {
      id: "skewered",
      name: "Skewered",
      kind: "DEBUFF",
      turns: 2,
      target: "TARGET",
      dodgeBonus: -10,
      accuracyBonus: -4,
    },
  },
  {
    id: "mstry_spear_phalanx",
    track: "SPEAR",
    level: 12,
    name: "Phalanx Drive",
    description: "Advance as if a whole formation were behind the tip.",
    power: 16,
    powerLevel: 13,
    scalingStat: "strength",
    accuracyMod: 0,
    mpCost: 14,
    tags: ["MELEE", "AOE"],
    weaponType: "SPEAR",
    targeting: { group: "ENEMY", selection: "ALL", whenInsufficient: "REDUCE" },
  },

  // —— CLUB (includes staves) ——
  {
    id: "mstry_club_tempo",
    track: "CLUB",
    level: 1,
    name: "Heavy Tempo",
    description: "Let the weight do the talking.",
    power: 6,
    powerLevel: 3,
    scalingStat: "strength",
    accuracyMod: 2,
    mpCost: 3,
    tags: ["MELEE", "SINGLE"],
    weaponType: "CLUB",
  },
  {
    id: "mstry_club_crack",
    track: "CLUB",
    level: 3,
    name: "Guard Crack",
    description: "Smash the shield-arm, not the face — yet.",
    power: 9,
    powerLevel: 6,
    scalingStat: "strength",
    accuracyMod: -2,
    mpCost: 5,
    tags: ["MELEE", "SINGLE", "DEBUFF"],
    weaponType: "CLUB",
    applyEffect: {
      id: "guard_cracked",
      name: "Guard Cracked",
      kind: "DEBUFF",
      turns: 2,
      target: "TARGET",
      damageTakenMod: 0.1,
    },
  },
  {
    id: "mstry_club_whirl",
    track: "CLUB",
    level: 5,
    name: "Staff Whirl",
    description: "A spinning staff / club arc that clears space.",
    power: 8,
    powerLevel: 8,
    scalingStat: "speed",
    accuracyMod: -2,
    mpCost: 7,
    tags: ["MELEE", "AOE"],
    weaponType: "CLUB",
    targeting: { group: "ENEMY", selection: "ALL", whenInsufficient: "REDUCE" },
  },
  {
    id: "mstry_club_earthquake",
    track: "CLUB",
    level: 8,
    name: "Earthshock",
    description: "Drive the weapon into the deck — shock travels.",
    power: 15,
    powerLevel: 11,
    scalingStat: "strength",
    accuracyMod: -4,
    mpCost: 11,
    tags: ["MELEE", "AOE", "DEBUFF"],
    weaponType: "CLUB",
    targeting: { group: "ENEMY", selection: "ALL", whenInsufficient: "REDUCE" },
  },
  {
    id: "mstry_club_finisher",
    track: "CLUB",
    level: 12,
    name: "Bonebreaker",
    description: "All weight, one target, no mercy.",
    power: 22,
    powerLevel: 14,
    scalingStat: "strength",
    accuracyMod: -2,
    mpCost: 14,
    tags: ["MELEE", "SINGLE"],
    weaponType: "CLUB",
  },

  // —— UNARMED ——
  {
    id: "mstry_unarmed_guard_break",
    track: "UNARMED",
    level: 1,
    name: "Palm Check",
    description: "A sharp open-hand stop that opens their next beat.",
    power: 4,
    powerLevel: 2,
    scalingStat: "speed",
    accuracyMod: 6,
    mpCost: 2,
    tags: ["MELEE", "SINGLE"],
    unarmedOnly: true,
  },
  {
    id: "mstry_unarmed_iron_fist",
    track: "UNARMED",
    level: 3,
    name: "Iron Fist",
    description: "Tighten the fist until the knuckles feel like iron.",
    power: 8,
    powerLevel: 5,
    scalingStat: "strength",
    accuracyMod: 0,
    mpCost: 4,
    tags: ["MELEE", "SINGLE"],
    unarmedOnly: true,
  },
  {
    id: "mstry_unarmed_body_check",
    track: "UNARMED",
    level: 5,
    name: "Body Check",
    description: "Shoulder, hip, and willpower — knock them off-line.",
    power: 11,
    powerLevel: 7,
    scalingStat: "strength",
    accuracyMod: -2,
    mpCost: 6,
    tags: ["MELEE", "SINGLE", "DEBUFF"],
    unarmedOnly: true,
    applyEffect: {
      id: "off_balance_body",
      name: "Off-Balance",
      kind: "DEBUFF",
      turns: 2,
      target: "TARGET",
      accuracyBonus: -6,
      dodgeBonus: -6,
    },
  },
  {
    id: "mstry_unarmed_flurry",
    track: "UNARMED",
    level: 8,
    name: "Storm Flurry",
    description: "Hands and feet in a storm of short, hard hits.",
    power: 6,
    powerLevel: 10,
    scalingStat: "speed",
    accuracyMod: 0,
    mpCost: 9,
    tags: ["MELEE", "SINGLE", "MULTI_HIT"],
    unarmedOnly: true,
  },
  {
    id: "mstry_unarmed_finisher",
    track: "UNARMED",
    level: 12,
    name: "Empty-Hand Verdict",
    description: "No steel needed — one finishing strike ends it.",
    power: 20,
    powerLevel: 13,
    scalingStat: "strength",
    accuracyMod: 2,
    mpCost: 12,
    tags: ["MELEE", "SINGLE"],
    unarmedOnly: true,
  },

  // —— FISTS (knuckle weapons) ——
  {
    id: "mstry_fists_hook",
    track: "FISTS",
    level: 1,
    name: "Heavy Hook",
    description: "Knuckles lead — the body follows.",
    power: 5,
    powerLevel: 3,
    scalingStat: "strength",
    accuracyMod: 2,
    mpCost: 3,
    tags: ["MELEE", "SINGLE"],
    weaponType: "FISTS",
  },
  {
    id: "mstry_fists_liver",
    track: "FISTS",
    level: 5,
    name: "Liver Shot",
    description: "A short punch that folds them sideways.",
    power: 12,
    powerLevel: 8,
    scalingStat: "strength",
    accuracyMod: -2,
    mpCost: 6,
    tags: ["MELEE", "SINGLE", "DEBUFF"],
    weaponType: "FISTS",
    applyEffect: {
      id: "winded",
      name: "Winded",
      kind: "DEBUFF",
      turns: 2,
      target: "TARGET",
      damageDealtMod: -0.15,
    },
  },
  {
    id: "mstry_fists_haymaker",
    track: "FISTS",
    level: 8,
    name: "Haymaker",
    description: "Telegraphed, brutal, and hard to ignore.",
    power: 18,
    powerLevel: 11,
    scalingStat: "strength",
    accuracyMod: -4,
    mpCost: 9,
    tags: ["MELEE", "SINGLE"],
    weaponType: "FISTS",
  },

  // —— KICKS ——
  {
    id: "mstry_kicks_snap",
    track: "KICKS",
    level: 1,
    name: "Snap Kick",
    description: "A quick kick that keeps the rhythm yours.",
    power: 5,
    powerLevel: 3,
    scalingStat: "speed",
    accuracyMod: 4,
    mpCost: 3,
    tags: ["MELEE", "SINGLE"],
    weaponType: "KICKS",
  },
  {
    id: "mstry_kicks_axe",
    track: "KICKS",
    level: 5,
    name: "Axe Kick",
    description: "Drop the heel like a falling mast.",
    power: 13,
    powerLevel: 8,
    scalingStat: "strength",
    accuracyMod: -2,
    mpCost: 6,
    tags: ["MELEE", "SINGLE"],
    weaponType: "KICKS",
  },
  {
    id: "mstry_kicks_storm",
    track: "KICKS",
    level: 8,
    name: "Kick Storm",
    description: "A blur of legs that forces everyone back.",
    power: 7,
    powerLevel: 10,
    scalingStat: "speed",
    accuracyMod: -2,
    mpCost: 10,
    tags: ["MELEE", "AOE"],
    weaponType: "KICKS",
    targeting: { group: "ENEMY", selection: "ALL", whenInsufficient: "REDUCE" },
  },
];

/** Hybrid techniques unlocked when both tracks reach the combo level. */
export const MASTERY_COMBO_UNLOCKS: MasteryComboUnlockDef[] = [
  {
    id: "mstry_combo_df_sword",
    tracks: ["DEVIL_FRUIT", "SWORD"],
    level: MASTERY_COMBO_LEVEL,
    name: "Fruit-Edge",
    description: "Blade and stolen power share the same stroke.",
    power: 20,
    powerLevel: 12,
    scalingStat: "willpower",
    accuracyMod: 0,
    mpCost: 10,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SWORD",
    requiresDevilFruit: true,
    fruitTemplates: {
      PARAMECIA: {
        name: "Warped Edge",
        description: "Bend the cut around their guard with Paramecia trickery.",
      },
      LOGIA: {
        name: "Elemental Edge",
        description: "Coat the blade in living element and carve through resistance.",
      },
      ZOAN: {
        name: "Beast Blade",
        description: "Strike with animal ferocity behind a steel edge.",
      },
    },
    fruitOverrides: {
      bara_bara: {
        name: "Scattered Blade",
        description: "Split mid-cut — the edge arrives from impossible angles.",
      },
      mera_mera: {
        name: "Flame Edge",
        description: "A burning cut that leaves smoke in the wound.",
      },
      suna_suna: {
        name: "Sand Razor",
        description: "Dry their guard with a blade of grinding sand.",
      },
      inu_wolf: {
        name: "Wolf Fang Cut",
        description: "Bite and blade in one savage motion.",
      },
    },
  },
  {
    id: "mstry_combo_df_unarmed",
    tracks: ["DEVIL_FRUIT", "UNARMED"],
    level: MASTERY_COMBO_LEVEL,
    name: "Fruit Fist",
    description: "Empty hands charged with devil power.",
    power: 18,
    powerLevel: 11,
    scalingStat: "willpower",
    accuracyMod: 2,
    mpCost: 9,
    tags: ["MELEE", "SINGLE"],
    unarmedOnly: true,
    requiresDevilFruit: true,
    fruitTemplates: {
      PARAMECIA: {
        name: "Body Burst Fist",
        description: "Paramecia force detonates through an open-hand strike.",
      },
      LOGIA: {
        name: "Elemental Palm",
        description: "Your palm becomes the element itself.",
      },
      ZOAN: {
        name: "Beast Clutch",
        description: "Hybrid instincts guide a crushing empty-hand finish.",
      },
    },
    fruitOverrides: {
      bomu_bomu: {
        name: "Point-Blank Blast",
        description: "A fist that explodes on contact.",
      },
      bari_bari: {
        name: "Barrier Punch",
        description: "Hit them with a wall you throw like a fist.",
      },
    },
  },
  {
    id: "mstry_combo_df_gun",
    tracks: ["DEVIL_FRUIT", "GUN"],
    level: MASTERY_COMBO_LEVEL,
    name: "Fruit Shot",
    description: "Powder and devil power share the same barrel.",
    power: 22,
    powerLevel: 12,
    scalingStat: "willpower",
    accuracyMod: 0,
    mpCost: 10,
    tags: ["RANGED", "SINGLE"],
    weaponType: "GUN",
    requiresDevilFruit: true,
    fruitTemplates: {
      PARAMECIA: {
        name: "Warped Round",
        description: "A bullet that arrives where physics said it shouldn't.",
      },
      LOGIA: {
        name: "Element Round",
        description: "Load the shot with living element.",
      },
      ZOAN: {
        name: "Predator Shot",
        description: "Aim with beast focus — the shot hunts.",
      },
    },
    fruitOverrides: {
      bomu_bomu: {
        name: "Blast Round",
        description: "The shot detonates on impact.",
      },
      mera_mera: {
        name: "Incendiary Breath",
        description: "Fire rides the bullet like a fuse.",
      },
    },
  },
  {
    id: "mstry_combo_sword_gun",
    tracks: ["SWORD", "GUN"],
    level: MASTERY_COMBO_LEVEL,
    name: "Gunblade Flourish",
    description: "Cut to open the line, then finish with powder — trained dual style.",
    power: 19,
    powerLevel: 11,
    scalingStat: "speed",
    accuracyMod: 2,
    mpCost: 9,
    tags: ["MELEE", "SINGLE"],
    requiredWeaponTypes: ["SWORD", "GUN"],
  },
  {
    id: "mstry_combo_unarmed_sword",
    tracks: ["UNARMED", "SWORD"],
    level: MASTERY_COMBO_LEVEL,
    name: "Hand-and-Blade",
    description: "Free hand checks, blade finishes — street and steel together.",
    power: 17,
    powerLevel: 10,
    scalingStat: "speed",
    accuracyMod: 2,
    mpCost: 8,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SWORD",
  },
  {
    id: "mstry_combo_df_spear",
    tracks: ["DEVIL_FRUIT", "SPEAR"],
    level: MASTERY_COMBO_LEVEL,
    name: "Fruit Lance",
    description: "Reach and devil power on the same point.",
    power: 21,
    powerLevel: 12,
    scalingStat: "willpower",
    accuracyMod: 0,
    mpCost: 10,
    tags: ["MELEE", "SINGLE"],
    weaponType: "SPEAR",
    requiresDevilFruit: true,
    fruitTemplates: {
      PARAMECIA: {
        name: "Warped Lance",
        description: "The tip bends space on the thrust.",
      },
      LOGIA: {
        name: "Elemental Pike",
        description: "Element races down the shaft into the point.",
      },
      ZOAN: {
        name: "Beast Impale",
        description: "Animal drive behind a full-length thrust.",
      },
    },
  },
  {
    id: "mstry_combo_df_club",
    tracks: ["DEVIL_FRUIT", "CLUB"],
    level: MASTERY_COMBO_LEVEL,
    name: "Fruit Staff",
    description: "Staff or club swings heavy with stolen power.",
    power: 19,
    powerLevel: 11,
    scalingStat: "willpower",
    accuracyMod: -2,
    mpCost: 9,
    tags: ["MELEE", "SINGLE"],
    weaponType: "CLUB",
    requiresDevilFruit: true,
    fruitTemplates: {
      PARAMECIA: {
        name: "Warped Crush",
        description: "Paramecia force rides a blunt swing.",
      },
      LOGIA: {
        name: "Elemental Staff",
        description: "The shaft becomes living element on impact.",
      },
      ZOAN: {
        name: "Beast Kanabo",
        description: "Hit like a beast swinging a tree.",
      },
    },
  },
];

export function masterySoloToAbility(def: MasterySoloUnlockDef): Ability {
  return {
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
    requiredWeaponTypes: def.requiredWeaponTypes ?? (def.weaponType ? [def.weaponType] : undefined),
  };
}

export function masteryComboToAbility(
  def: MasteryComboUnlockDef,
  fruitId: string | null | undefined,
  fruitType: FruitType | null | undefined,
): Ability {
  let name = def.name;
  let description = def.description;
  if (fruitId && def.fruitOverrides?.[fruitId]) {
    name = def.fruitOverrides[fruitId]!.name;
    description = def.fruitOverrides[fruitId]!.description;
  } else if (fruitType && def.fruitTemplates?.[fruitType]) {
    name = def.fruitTemplates[fruitType]!.name;
    description = def.fruitTemplates[fruitType]!.description;
  }
  return {
    id: def.id,
    name,
    description,
    power: def.power,
    powerLevel: def.powerLevel,
    scalingStat: def.scalingStat,
    accuracyMod: def.accuracyMod,
    mpCost: def.mpCost,
    tags: def.tags,
    applyEffect: def.applyEffect,
    targeting: def.targeting,
    requiredWeaponTypes: def.requiredWeaponTypes ?? (def.weaponType ? [def.weaponType] : undefined),
    devilFruitSkill: def.requiresDevilFruit ? true : undefined,
  };
}

export function getMasterySoloUnlock(id: string): MasterySoloUnlockDef | undefined {
  return MASTERY_SOLO_UNLOCKS.find((entry) => entry.id === id);
}

export function getMasteryComboUnlock(id: string): MasteryComboUnlockDef | undefined {
  return MASTERY_COMBO_UNLOCKS.find((entry) => entry.id === id);
}

/** Validate data thresholds align with design constants (dev sanity). */
export function expectedSoloLevels(): readonly number[] {
  return MASTERY_SOLO_UNLOCK_LEVELS;
}
