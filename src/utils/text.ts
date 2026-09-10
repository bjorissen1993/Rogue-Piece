import type { RunState, StatName } from "../models/types";
import { getDevilFruit } from "../data/devilFruits";
import { getLocation, getRegionName } from "../data/locations";
import { ORIGIN_LABELS } from "../data/origins";
import { getRace } from "../data/races";

export function interpolate(template: string, state: RunState): string {
  const fruitId = state.currentBoundFruitId ?? state.player.devilFruitId;
  const fruit = fruitId ? getDevilFruit(fruitId) : undefined;
  const npc = state.currentBoundNpcId
    ? state.world.characters.find((character) => character.id === state.currentBoundNpcId)
    : undefined;
  const location = getLocation(state.currentLocationId);
  const race = getRace(state.player.raceId);

  return template
    .replaceAll("{playerName}", state.player.name)
    .replaceAll("{origin}", ORIGIN_LABELS[state.player.origin] ?? state.player.origin)
    .replaceAll("{race}", race?.name ?? "Human")
    .replaceAll("{fruitName}", fruit?.name ?? "a strange fruit")
    .replaceAll("{npcName}", npc?.epithet ? `${npc.name} "${npc.epithet}"` : (npc?.name ?? "a stranger"))
    .replaceAll("{day}", String(state.day))
    .replaceAll("{bounty}", String(state.player.bounty))
    .replaceAll("{location}", location?.name ?? "unknown waters")
    .replaceAll("{region}", location ? getRegionName(location.regionId) : "the Blues");
}

export function formatBerries(amount: number): string {
  return `${amount.toLocaleString()} berries`;
}

export function formatBounty(amount: number): string {
  return amount > 0 ? `฿${amount.toLocaleString()}` : "—";
}

export function formatHudAmount(amount: number): string {
  return amount.toLocaleString();
}

export const STAT_LABELS: Record<StatName, string> = {
  strength: "Strength",
  defense: "Defense",
  speed: "Speed",
  willpower: "Willpower",
  charisma: "Charisma",
};

export function highestStat(stats: RunState["player"]["stats"]): { name: string; value: number } {
  const entries = Object.entries(stats) as [StatName, number][];
  const [name, value] = entries.reduce((best, current) => (current[1] > best[1] ? current : best));
  return { name: STAT_LABELS[name], value };
}
