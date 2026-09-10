import type { RaceDiscoveryProfile } from "../models/types";

export const RACE_DISCOVERY_PROFILES: RaceDiscoveryProfile[] = [
  {
    raceId: "FISH_MAN",
    culturalThreshold: 3,
    recruitmentLockedUntilCultural: true,
    storyThreadOverride: "fishman_exception",
    rumorOnlyUntilTier: "EARLY",
  },
  {
    raceId: "MINK",
    encounterTierGate: "MID",
    culturalThreshold: 2,
    rumorOnlyUntilTier: "MID",
  },
  {
    raceId: "MERFOLK",
    culturalThreshold: 2,
  },
  {
    raceId: "GIANT",
    encounterTierGate: "LATE",
    culturalThreshold: 3,
  },
  {
    raceId: "SKY_PERSON",
    culturalThreshold: 2,
  },
  {
    raceId: "LUNARIAN",
    encounterTierGate: "LEGENDARY",
    culturalThreshold: 5,
  },
];

export function getRaceDiscoveryProfile(raceId: string): RaceDiscoveryProfile | undefined {
  return RACE_DISCOVERY_PROFILES.find((entry) => entry.raceId === raceId);
}
