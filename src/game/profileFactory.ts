import { ACHIEVEMENTS } from "../data/achievements";
import { DEVIL_FRUITS } from "../data/devilFruits";
import { ITEMS } from "../data/items";
import { startingLocationIds } from "../data/locations";
import { RACES } from "../data/races";
import { SAVE_VERSION } from "./constants";
import type {
  CollectionKnowledge,
  ProfileCollection,
  ProfileSave,
  ProfileStatistics,
  ProfileType,
  RaceOfferPity,
  RaceProgress,
} from "../models/types";
import { nowIso } from "../utils/ids";

export function emptyStatistics(): ProfileStatistics {
  return {
    runsStarted: 0,
    deaths: 0,
    daysSurvivedTotal: 0,
    fruitsDiscovered: 0,
    highestBounty: 0,
    encountersCompleted: 0,
    longestRunDays: 0,
    combatWins: 0,
    combatLosses: 0,
    fruitsEaten: 0,
  };
}

export function defaultRaceProgress(): RaceProgress[] {
  return RACES.map((race) => ({
    raceId: race.id,
    known: race.defaultKnown,
    playable: race.defaultPlayable,
    discoveryProgress: 0,
    requiredDiscoveryProgress: race.requiredDiscoveryProgress,
    discoverySources: [],
    knowledgeLevel: race.defaultKnown ? 1 : 0,
    unlockedEntries: race.defaultKnown ? ["intro"] : [],
  }));
}

export function emptyCollection(): ProfileCollection {
  const devilFruits: CollectionKnowledge[] = DEVIL_FRUITS.map((fruit) => ({
    id: fruit.id,
    discovered: false,
    knowledgeLevel: 0,
    unlockedEntries: [],
    discoveredTechniques: [],
  }));
  const items: CollectionKnowledge[] = ITEMS.map((item) => ({
    id: item.id,
    discovered: false,
    knowledgeLevel: 0,
    unlockedEntries: [],
    discoveredTechniques: [],
  }));
  return { devilFruits, items };
}

export function emptyPity(): RaceOfferPity[] {
  return RACES.filter((race) => race.id !== "HUMAN").map((race) => ({
    raceId: race.id,
    missedOffers: 0,
    pityBonus: 0,
  }));
}

export function emptyAchievements(): ProfileSave["achievements"] {
  return ACHIEVEMENTS.map((achievement) => ({ id: achievement.id, unlocked: false }));
}

export function createEmptyProfile(id: string, profileType: ProfileType): ProfileSave {
  const timestamp = nowIso();
  return {
    version: SAVE_VERSION,
    id,
    profileType,
    createdAt: timestamp,
    updatedAt: timestamp,
    progression: {
      races: defaultRaceProgress(),
      unlockedStartingLocations: startingLocationIds(),
      milestones: [],
    },
    statistics: emptyStatistics(),
    collection: emptyCollection(),
    achievements: emptyAchievements(),
    raceOfferPity: emptyPity(),
    activeRun: null,
    legacy: undefined,
  };
}
