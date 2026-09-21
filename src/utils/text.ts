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

/** Split a crew card display into primary name + optional title/epithet line. */
export function splitCharacterDisplayName(
  fullName: string,
  epithet?: string | null,
): { name: string; title?: string } {
  const trimmed = fullName.trim();
  const epithetTrimmed = epithet?.trim();
  if (epithetTrimmed) {
    return { name: trimmed, title: epithetTrimmed };
  }
  if (!trimmed) {
    return { name: fullName };
  }

  const quoted = trimmed.match(/^(.+?)\s+[“”"']([^“”"']+)[“”"']$/);
  if (quoted?.[1] && quoted[2]) {
    return { name: quoted[1].trim(), title: quoted[2].trim() };
  }

  const ofThe = trimmed.match(/^(.+?)\s+(of\s+the\s+.+)$/i);
  if (ofThe?.[1] && ofThe[2]) {
    return { name: ofThe[1].trim(), title: ofThe[2].trim() };
  }

  const ofRest = trimmed.match(/^(.+?)\s+(of\s+.+)$/i);
  if (ofRest?.[1] && ofRest[2]) {
    return { name: ofRest[1].trim(), title: ofRest[2].trim() };
  }

  const theRest = trimmed.match(/^(\S+)\s+(the\s+.+)$/i);
  if (theRest?.[1] && theRest[2]) {
    return { name: theRest[1].trim(), title: theRest[2].trim() };
  }

  return { name: trimmed };
}

export const STAT_LABELS: Record<StatName, string> = {
  strength: "Strength",
  defense: "Defense",
  speed: "Speed",
  willpower: "Willpower",
  charisma: "Charisma",
  intelligence: "Intelligence",
};

export function highestStat(stats: RunState["player"]["stats"]): { name: string; value: number } {
  const entries = Object.entries(stats) as [StatName, number][];
  const [name, value] = entries.reduce((best, current) => (current[1] > best[1] ? current : best));
  return { name: STAT_LABELS[name], value };
}
