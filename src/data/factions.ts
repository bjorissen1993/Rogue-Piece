import type { FactionKind, RelationFactionId } from "../models/types";

export interface FactionDefinition {
  id: RelationFactionId;
  name: string;
  kind: FactionKind;
  hiddenUntilDiscovered: boolean;
  startingDiscovered: boolean;
  startingValue: number;
  startingInfluence: number;
}

export const FACTIONS: FactionDefinition[] = [
  {
    id: "MARINES",
    name: "Marines",
    kind: "MILITARY",
    hiddenUntilDiscovered: false,
    startingDiscovered: true,
    startingValue: 0,
    startingInfluence: 62,
  },
  {
    id: "PIRATES",
    name: "Pirates",
    kind: "CRIMINAL",
    hiddenUntilDiscovered: false,
    startingDiscovered: true,
    startingValue: 0,
    startingInfluence: 48,
  },
  {
    id: "WORLD_GOVERNMENT",
    name: "World Government",
    kind: "GOVERNMENT",
    hiddenUntilDiscovered: false,
    startingDiscovered: true,
    startingValue: 0,
    startingInfluence: 78,
  },
  {
    id: "CIVILIANS",
    name: "Civilians",
    kind: "CIVILIAN",
    hiddenUntilDiscovered: false,
    startingDiscovered: true,
    startingValue: 0,
    startingInfluence: 55,
  },
  {
    id: "REVOLUTIONARY_ARMY",
    name: "Revolutionary Army",
    kind: "REVOLUTIONARY",
    hiddenUntilDiscovered: true,
    startingDiscovered: false,
    startingValue: 0,
    startingInfluence: 22,
  },
];

export function getFaction(id: RelationFactionId): FactionDefinition {
  const faction = FACTIONS.find((item) => item.id === id);
  if (!faction) {
    throw new Error(`Unknown faction: ${id}`);
  }
  return faction;
}

export const VISIBLE_FACTION_ORDER: RelationFactionId[] = [
  "MARINES",
  "PIRATES",
  "WORLD_GOVERNMENT",
  "CIVILIANS",
  "REVOLUTIONARY_ARMY",
];
