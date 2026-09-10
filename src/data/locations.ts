import type { LocationDefinition, RegionId } from "../models/types";

export const EAST_BLUE_PORT_ID = "east_blue_port";

export const REGIONS: { id: RegionId; name: string }[] = [
  { id: "EAST_BLUE", name: "East Blue" },
  { id: "SOUTH_BLUE", name: "South Blue" },
  { id: "WEST_BLUE", name: "West Blue" },
  { id: "NORTH_BLUE", name: "North Blue" },
  { id: "GRAND_LINE", name: "Grand Line" },
];

export const LOCATIONS: LocationDefinition[] = [
  {
    id: EAST_BLUE_PORT_ID,
    name: "East Blue Port",
    regionId: "EAST_BLUE",
    description: "A modest harbor in the weakest sea. Small pirates, Marine patrols, and merchants.",
    startingUnlocked: true,
  },
  {
    id: "east_blue_island",
    name: "Nameless East Island",
    regionId: "EAST_BLUE",
    description: "Villages, beaches, and trouble that still thinks itself local.",
    startingUnlocked: false,
  },
  {
    id: "south_blue_port",
    name: "South Blue Port",
    regionId: "SOUTH_BLUE",
    description: "Warmer currents, denser jungles, and crews that do not stay small for long.",
    startingUnlocked: false,
  },
  {
    id: "west_blue_port",
    name: "West Blue Port",
    regionId: "WEST_BLUE",
    description: "Music, crime families, and rumors older than the docks.",
    startingUnlocked: false,
  },
  {
    id: "north_blue_port",
    name: "North Blue Port",
    regionId: "NORTH_BLUE",
    description: "Cold water and colder ambition. Geniuses and monsters both come from here.",
    startingUnlocked: false,
  },
  {
    id: "grand_line_entrance",
    name: "Reverse Mountain",
    regionId: "GRAND_LINE",
    description: "The entrance to the Grand Line. Paradise begins where the compass dies.",
    startingUnlocked: false,
  },
];

export function getLocation(id: string): LocationDefinition | undefined {
  return LOCATIONS.find((location) => location.id === id);
}

export function requireLocation(id: string): LocationDefinition {
  const location = getLocation(id);
  if (!location) {
    throw new Error(`Unknown location: ${id}`);
  }
  return location;
}

export function getRegionName(regionId: RegionId): string {
  return REGIONS.find((region) => region.id === regionId)?.name ?? regionId;
}

export function startingLocationIds(): string[] {
  return LOCATIONS.filter((location) => location.startingUnlocked).map((location) => location.id);
}
