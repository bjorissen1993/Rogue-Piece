import type { AchievementDefinition } from "../models/types";

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first_voyage",
    name: "First Voyage",
    description: "Begin a journey on the Grand Line's doorstep — or at least the East Blue.",
    conditions: [{ type: "STAT_MIN", stat: "runsStarted", value: 1 }],
  },
  {
    id: "first_taste",
    name: "First Taste",
    description: "Eat a Devil Fruit.",
    conditions: [{ type: "FRUITS_EATEN", value: 1 }],
  },
  {
    id: "monster_of_the_sea",
    name: "Monster of the Sea",
    description: "Defeat a Sea King.",
    conditions: [{ type: "MILESTONE", id: "defeated_sea_king" }],
  },
  {
    id: "worst_generation",
    name: "Worst Generation",
    description: "Reach a bounty of 100,000,000 berries.",
    conditions: [{ type: "STAT_MIN", stat: "highestBounty", value: 100_000_000 }],
  },
  {
    id: "into_the_grand_line",
    name: "Into the Grand Line",
    description: "Reach the Grand Line.",
    conditions: [{ type: "MILESTONE", id: "reached_grand_line" }],
    rewards: [{ type: "UNLOCK_LOCATION", locationId: "grand_line_entrance" }],
  },
  {
    id: "east_blue_chart",
    name: "Chart of the Four Blues",
    description: "Survive fifteen days in a single run. The other seas start to feel possible.",
    conditions: [{ type: "STAT_MIN", stat: "longestRunDays", value: 15 }],
    rewards: [{ type: "UNLOCK_LOCATION", locationId: "south_blue_port" }],
  },
  {
    id: "west_current",
    name: "Westbound",
    description: "Unlock a route into the West Blue.",
    conditions: [{ type: "LOCATION_UNLOCKED", locationId: "west_blue_port" }],
  },
  {
    id: "fishman_contact",
    name: "People of the Sea",
    description: "Discover the Fish-Man race.",
    conditions: [{ type: "RACE_KNOWN", raceId: "FISH_MAN" }],
  },
  {
    id: "mink_moon",
    name: "Electro and Moonlight",
    description: "Discover the Mink race. Sulong is their gift — not a people of its own.",
    conditions: [{ type: "RACE_KNOWN", raceId: "MINK" }],
  },
  {
    id: "forbidden_knowledge",
    name: "Forbidden Knowledge",
    description: "Uncover records of the Lunarians.",
    conditions: [{ type: "RACE_KNOWN", raceId: "LUNARIAN" }],
  },
  {
    id: "sky_fallen",
    name: "Fallen from the Sky",
    description: "Learn that Sky People are one race, with many islands.",
    conditions: [{ type: "RACE_KNOWN", raceId: "SKY_PERSON" }],
  },
  {
    id: "playable_fishman",
    name: "Born of the Tide",
    description: "Make Fish-Man a playable origin for future runs.",
    conditions: [{ type: "RACE_PLAYABLE", raceId: "FISH_MAN" }],
  },
  {
    id: "grand_line_giant",
    name: "Giant of the Grand Line",
    description: "Reach the Grand Line as a Giant.",
    hidden: true,
    hiddenUntilUnlocked: true,
    conditions: [{ type: "RACE_AND_MILESTONE", raceId: "GIANT", milestone: "reached_grand_line" }],
  },
  {
    id: "blood_in_the_water",
    name: "Blood in the Water",
    description: "Fall once. The sea keeps the ledger.",
    conditions: [{ type: "STAT_MIN", stat: "deaths", value: 1 }],
  },
];

export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((item) => item.id === id);
}
