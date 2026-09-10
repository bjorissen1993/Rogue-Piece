import type { Ability, Player, RunState } from "../models/types";
import { WeaponService } from "../services/WeaponService";
import { getRace } from "./races";

export const ABILITIES: Ability[] = [
  {
    id: "focused_strike",
    name: "Focused Strike",
    description: "Put your weight behind one clean hit.",
    power: 8,
    scalingStat: "strength",
    accuracyMod: -5,
  },
  {
    id: "fishman_karate",
    name: "Fish-Man Karate",
    description: "A short-range blast that treats air like water.",
    power: 10,
    scalingStat: "strength",
    accuracyMod: 0,
  },
  {
    id: "electro",
    name: "Electro",
    description: "Discharge living current through a strike.",
    power: 9,
    scalingStat: "speed",
    accuracyMod: 4,
  },
  {
    id: "fruit_burst",
    name: "Devil Fruit Burst",
    description: "Spend a breath of stolen power on a messy, loud attack.",
    power: 12,
    scalingStat: "willpower",
    accuracyMod: -4,
    mpCost: 8,
  },
];

export function getAbility(id: string): Ability | undefined {
  return ABILITIES.find((ability) => ability.id === id);
}

export function getAbilitiesForPlayer(player: Player): Ability[] {
  const list: Ability[] = [];
  const focused = getAbility("focused_strike");
  if (focused) {
    list.push(focused);
  }
  for (const weaponAbility of WeaponService.techniquesForPlayer(player)) {
    if (!list.some((entry) => entry.id === weaponAbility.id)) {
      list.push(weaponAbility);
    }
  }
  const race = getRace(player.raceId);
  for (const abilityId of race?.abilities ?? []) {
    const ability = getAbility(abilityId);
    if (ability) {
      list.push(ability);
    }
  }
  if (player.devilFruitId) {
    const burst = getAbility("fruit_burst");
    if (burst) {
      list.push(burst);
    }
  }
  return list;
}

export function getAbilitiesForCrewmember(run: RunState, characterId: string): Ability[] {
  const list: Ability[] = [];
  const focused = getAbility("focused_strike");
  if (focused) {
    list.push(focused);
  }
  for (const weaponAbility of WeaponService.techniquesForCharacter(run, characterId)) {
    if (!list.some((entry) => entry.id === weaponAbility.id)) {
      list.push(weaponAbility);
    }
  }
  return list;
}
