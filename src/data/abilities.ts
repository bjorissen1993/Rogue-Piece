import type { Ability, Player, RunState } from "../models/types";
import { DevilFruitCombatService } from "../services/DevilFruitCombatService";
import { WeaponMasteryService } from "../services/WeaponMasteryService";
import { WeaponService } from "../services/WeaponService";
import { getRace } from "./races";

export const ABILITIES: Ability[] = [
  {
    id: "focused_strike",
    name: "Focused Strike",
    description: "Put your weight behind one clean hit.",
    power: 13,
    powerLevel: 6,
    scalingStat: "strength",
    accuracyMod: -2,
    tags: ["MELEE", "SINGLE"],
    requiredWeaponTypes: ["SWORD", "SPEAR", "CLUB", "FISTS", "KICKS"],
  },
  {
    id: "fishman_karate",
    name: "Fish-Man Karate",
    description: "A short-range blast that treats air like water.",
    power: 18,
    powerLevel: 8,
    scalingStat: "strength",
    accuracyMod: 0,
    tags: ["MELEE", "SINGLE"],
  },
  {
    id: "electro",
    name: "Electro",
    description: "Discharge living current through a strike.",
    power: 15,
    powerLevel: 7,
    scalingStat: "speed",
    accuracyMod: 2,
    tags: ["MELEE", "SINGLE", "DEBUFF"],
    applyEffect: {
      id: "shocked",
      name: "Shocked",
      kind: "DEBUFF",
      turns: 2,
      target: "TARGET",
      accuracyBonus: -8,
      dodgeBonus: -4,
    },
  },
  {
    id: "fruit_burst",
    name: "Devil Fruit Burst",
    description: "Spend a breath of stolen power on a messy, loud attack.",
    power: 26,
    powerLevel: 12,
    scalingStat: "willpower",
    accuracyMod: -4,
    mpCost: 8,
    tags: ["MELEE", "AOE"],
    devilFruitSkill: true,
    badges: [{ id: "DEVIL_FRUIT", tip: "Devil Fruit technique." }],
  },
];

export function getAbility(id: string): Ability | undefined {
  return ABILITIES.find((ability) => ability.id === id);
}

export function getAbilitiesForPlayer(player: Player): Ability[] {
  const list: Ability[] = [];
  if (WeaponService.canUseBasicMelee(player)) {
    const focused = getAbility("focused_strike");
    if (focused) {
      list.push(focused);
    }
  }
  for (const weaponAbility of WeaponService.techniquesForPlayer(player)) {
    if (!list.some((entry) => entry.id === weaponAbility.id)) {
      list.push(weaponAbility);
    }
  }
  for (const masteryAbility of WeaponMasteryService.abilitiesForPlayer(player)) {
    if (!list.some((entry) => entry.id === masteryAbility.id)) {
      list.push(masteryAbility);
    }
  }
  const race = getRace(player.raceId);
  for (const abilityId of race?.abilities ?? []) {
    const ability = getAbility(abilityId);
    if (ability) {
      list.push(ability);
    }
  }
  for (const fruitAbility of DevilFruitCombatService.abilitiesForPlayer(player)) {
    if (!list.some((entry) => entry.id === fruitAbility.id)) {
      list.push(fruitAbility);
    }
  }
  // Keep a generic burst as a last-resort DF option once the fruit is eaten.
  if (player.devilFruitId) {
    const burst = getAbility("fruit_burst");
    if (burst && !list.some((entry) => entry.id === burst.id)) {
      list.push(burst);
    }
  }
  return list;
}

export function getAbilitiesForCrewmember(run: RunState, characterId: string): Ability[] {
  const list: Ability[] = [];
  if (WeaponService.canUseBasicMeleeForCharacter(run, characterId)) {
    const focused = getAbility("focused_strike");
    if (focused) {
      list.push(focused);
    }
  }
  for (const weaponAbility of WeaponService.techniquesForCharacter(run, characterId)) {
    if (!list.some((entry) => entry.id === weaponAbility.id)) {
      list.push(weaponAbility);
    }
  }
  return list;
}
