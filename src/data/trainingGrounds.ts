import type { TrainingExpType } from "../models/types";

export const TRAINING_CATEGORIES: Array<{ id: TrainingExpType; label: string; focus: string }> = [
  { id: "strength", label: "Strength", focus: "strength" },
  { id: "defense", label: "Defense", focus: "defense" },
  { id: "speed", label: "Speed", focus: "speed" },
  { id: "willpower", label: "Willpower", focus: "willpower" },
  { id: "charisma", label: "Charisma", focus: "charisma" },
  { id: "intelligence", label: "Intelligence", focus: "intelligence" },
  { id: "weapon_mastery", label: "Weapon Mastery", focus: "weapon" },
  { id: "technique_mastery", label: "Technique Mastery", focus: "technique" },
  { id: "sparring", label: "Sparring", focus: "sparring" },
];

/** Base EXP granted for one uninterrupted slot before multipliers. */
export const TRAINING_BASE_EXP_PER_SLOT = 2;

/** Continuity bands — longer streak is more efficient, then caps. */
export const TRAINING_CONTINUITY_BANDS: Array<{ maxSlot: number; multiplier: number }> = [
  { maxSlot: 2, multiplier: 1 },
  { maxSlot: 4, multiplier: 1.5 },
  { maxSlot: 6, multiplier: 2.5 },
  { maxSlot: 8, multiplier: 3 },
  { maxSlot: Number.POSITIVE_INFINITY, multiplier: 3.5 },
];

export const TRAINING_EXP_PER_STAT_POINT = 100;

export const TRAINING_EQUIPMENT: Array<{
  itemId: string;
  name: string;
  bonus: number;
  categories: TrainingExpType[];
}> = [
  { itemId: "practice_sword", name: "Practice Sword", bonus: 0.2, categories: ["weapon_mastery", "sparring"] },
  { itemId: "wooden_staff", name: "Wooden Staff", bonus: 0.2, categories: ["weapon_mastery", "technique_mastery"] },
  { itemId: "training_weights", name: "Training Weights", bonus: 0.2, categories: ["strength"] },
  { itemId: "weighted_bracers", name: "Weighted Bracers", bonus: 0.15, categories: ["strength", "defense"] },
  { itemId: "training_dummy", name: "Training Dummy", bonus: 0.2, categories: ["weapon_mastery", "technique_mastery"] },
  { itemId: "marksmanship_targets", name: "Marksmanship Targets", bonus: 0.2, categories: ["weapon_mastery"] },
  { itemId: "resistance_gear", name: "Resistance Equipment", bonus: 0.15, categories: ["defense", "willpower"] },
];

export function continuityMultiplier(elapsedSlots: number): number {
  const slot = Math.max(1, elapsedSlots);
  return TRAINING_CONTINUITY_BANDS.find((band) => slot <= band.maxSlot)?.multiplier ?? 3.5;
}

export function trainingEquipmentBonus(itemIds: string[], category: TrainingExpType): number {
  return itemIds.reduce((sum, itemId) => {
    const def = TRAINING_EQUIPMENT.find((entry) => entry.itemId === itemId);
    if (!def || !def.categories.includes(category)) {
      return sum;
    }
    return sum + def.bonus;
  }, 0);
}
