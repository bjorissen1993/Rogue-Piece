import { ACHIEVEMENTS } from "../data/achievements";
import { LOCATIONS } from "../data/locations";
import type {
  AchievementCondition,
  AchievementDefinition,
  AchievementProgress,
  ProfileSave,
} from "../models/types";
import { CollectionService } from "./CollectionService";
import { RaceService } from "./RaceService";
import { nowIso } from "../utils/ids";

function conditionMet(profile: ProfileSave, condition: AchievementCondition): boolean {
  switch (condition.type) {
    case "MILESTONE":
      return profile.progression.milestones.includes(condition.id);
    case "STAT_MIN":
      return profile.statistics[condition.stat] >= condition.value;
    case "RACE_KNOWN":
      return Boolean(RaceService.getProgress(profile, condition.raceId)?.known);
    case "RACE_PLAYABLE":
      return RaceService.isPlayable(profile, condition.raceId);
    case "LOCATION_UNLOCKED":
      return profile.progression.unlockedStartingLocations.includes(condition.locationId);
    case "FRUITS_EATEN":
      return profile.statistics.fruitsEaten >= condition.value;
    case "RACE_AND_MILESTONE": {
      const runRace = profile.activeRun?.player.raceId;
      const raceMatch =
        runRace === condition.raceId || profile.progression.milestones.includes(`race_${condition.raceId}`);
      return raceMatch && profile.progression.milestones.includes(condition.milestone);
    }
    default:
      return false;
  }
}

function applyRewards(profile: ProfileSave, def: AchievementDefinition): void {
  for (const reward of def.rewards ?? []) {
    if (reward.type === "UNLOCK_RACE") {
      RaceService.unlockRace(profile, reward.raceId, `achievement:${def.id}`);
    } else if (reward.type === "UNLOCK_LOCATION") {
      if (!profile.progression.unlockedStartingLocations.includes(reward.locationId)) {
        if (LOCATIONS.some((location) => location.id === reward.locationId)) {
          profile.progression.unlockedStartingLocations.push(reward.locationId);
        }
      }
    } else if (reward.type === "DISCOVER_FRUIT") {
      CollectionService.discoverFruit(profile, reward.fruitId);
    }
  }
}

export const AchievementService = {
  getAll(): AchievementDefinition[] {
    return ACHIEVEMENTS;
  },

  getProgress(profile: ProfileSave): AchievementProgress[] {
    return ACHIEVEMENTS.map((def) => {
      const existing = profile.achievements.find((item) => item.id === def.id);
      return existing ?? { id: def.id, unlocked: false };
    });
  },

  evaluate(profile: ProfileSave): string[] {
    const unlocked: string[] = [];
    for (const def of ACHIEVEMENTS) {
      let row = profile.achievements.find((item) => item.id === def.id);
      if (!row) {
        row = { id: def.id, unlocked: false };
        profile.achievements.push(row);
      }
      if (row.unlocked) {
        continue;
      }
      if (def.conditions.every((condition) => conditionMet(profile, condition))) {
        row.unlocked = true;
        row.unlockedAt = nowIso();
        applyRewards(profile, def);
        unlocked.push(def.id);
      }
    }
    return unlocked;
  },
};
