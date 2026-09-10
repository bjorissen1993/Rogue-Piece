import type { Island, IslandArchetype, RegionId, RunState } from "../models/types";
import { createId } from "../utils/ids";
import type { RandomService } from "./RandomService";

const PREFIXES: Record<IslandArchetype, string[]> = {
  TROPICAL: ["Palm", "Coral", "Sun", "Lagoon", "Trade"],
  JUNGLE: ["Moss", "Vine", "Canopy", "Green", "Hidden"],
  DESERT: ["Sand", "Dune", "Dry", "Mirage", "Scorch"],
  PIRATE_HAVEN: ["Rum", "Black", "Cutlass", "Smuggler", "Free"],
  MARINE_FORTRESS: ["Garrison", "Iron", "Watch", "Signal", "Harbor"],
  FISHING: ["Net", "Tide", "Catch", "Salt", "Hook"],
  TRADING: ["Market", "Coin", "Merchant", "Dock", "Exchange"],
};

const SUFFIXES: Record<IslandArchetype, string[]> = {
  TROPICAL: ["Cove", "Atoll", "Bay", "Isle", "Reef"],
  JUNGLE: ["Hollow", "Reach", "Mire", "Canopy", "Deep"],
  DESERT: ["Barrens", "Flats", "Spire", "Waste", "Ring"],
  PIRATE_HAVEN: ["Port", "Den", "Haven", "Hideout", "Anchor"],
  MARINE_FORTRESS: ["Base", "Keep", "Outpost", "Battery", "Station"],
  FISHING: ["Shoals", "Harbor", "Wharf", "Creek", "Sound"],
  TRADING: ["Exchange", "Crossing", "Quay", "Mart", "Terminus"],
};

const ARCHETYPE_BY_BIOME: Record<string, IslandArchetype> = {
  tropical: "TROPICAL",
  jungle: "JUNGLE",
  desert: "DESERT",
  pirate: "PIRATE_HAVEN",
  marine: "MARINE_FORTRESS",
  fishing: "FISHING",
  trading: "TRADING",
};

const INTRO_TEMPLATES: Record<IslandArchetype, string> = {
  TROPICAL: "Warm winds and bright sand greet you at {name}, a {settlement} in {region}.",
  JUNGLE: "Dense green swallows the horizon at {name}. {region} feels wild here.",
  DESERT: "Heat shimmers off {name}. Even {region} has deserts that test the stubborn.",
  PIRATE_HAVEN: "{name} smells of rum and opportunity. A true {settlement} for free souls.",
  MARINE_FORTRESS: "Marine banners fly over {name}. Order is the local currency in {region}.",
  FISHING: "Nets and salt define {name}, a quiet {settlement} where {region} meets the table.",
  TRADING: "Merchants shout over {name}'s docks. {region} trade flows through this {settlement}.",
};

export function generateIslandName(options: {
  biome?: string;
  archetype?: IslandArchetype;
  culture?: string[];
  usedNames: string[];
  rng: RandomService;
}): string {
  const archetype =
    options.archetype ??
    ARCHETYPE_BY_BIOME[options.biome?.toLowerCase() ?? ""] ??
    "TROPICAL";
  const prefixes = PREFIXES[archetype];
  const suffixes = SUFFIXES[archetype];
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const name = `${options.rng.pick(prefixes)} ${options.rng.pick(suffixes)}`;
    if (!options.usedNames.includes(name)) {
      return name;
    }
  }
  return `${options.rng.pick(prefixes)} ${options.rng.pick(suffixes)} ${options.rng.nextInt(2, 9)}`;
}

export const IslandService = {
  defaultIslands(): Island[] {
    return [];
  },

  defaultUsedNames(): string[] {
    return [];
  },

  createIsland(
    run: RunState,
    rng: RandomService,
    options: {
      region: RegionId;
      archetype?: IslandArchetype;
      biome?: string;
      settlementType?: string;
      dangerLevel?: number;
    },
  ): Island {
    const archetype = options.archetype ?? "TROPICAL";
    const name = generateIslandName({
      biome: options.biome,
      archetype,
      usedNames: run.usedIslandNames,
      rng,
    });
    run.usedIslandNames.push(name);
    const island: Island = {
      id: createId("island"),
      name,
      region: options.region,
      biome: options.biome ?? archetype.toLowerCase(),
      climate: archetype === "DESERT" ? "arid" : archetype === "JUNGLE" ? "humid" : "temperate",
      settlementType: options.settlementType ?? "village",
      dangerLevel: options.dangerLevel ?? 2,
      cultureTags: [archetype.toLowerCase()],
      uniqueTraits: [],
      archetype,
      introductionShown: false,
      knownShops: [],
    };
    run.islands.push(island);
    return island;
  },

  seedEastBlueIslands(run: RunState, rng: RandomService): void {
    if (run.islands.length > 0) {
      return;
    }
    const seeds: Array<{
      archetype: IslandArchetype;
      settlementType: string;
      dangerLevel: number;
      cultureTags: string[];
    }> = [
      { archetype: "TRADING", settlementType: "port town", dangerLevel: 2, cultureTags: ["trading", "shops", "forge"] },
      { archetype: "FISHING", settlementType: "fishing village", dangerLevel: 1, cultureTags: ["fishing", "forage", "food"] },
      { archetype: "PIRATE_HAVEN", settlementType: "hidden cove", dangerLevel: 4, cultureTags: ["pirate", "forge"] },
      { archetype: "TROPICAL", settlementType: "beach hamlet", dangerLevel: 2, cultureTags: ["forage", "rest"] },
      { archetype: "MARINE_FORTRESS", settlementType: "outpost", dangerLevel: 3, cultureTags: ["marine", "training"] },
    ];
    for (const seed of seeds) {
      const island = this.createIsland(run, rng, {
        region: "EAST_BLUE",
        archetype: seed.archetype,
        settlementType: seed.settlementType,
        dangerLevel: seed.dangerLevel,
      });
      island.cultureTags = seed.cultureTags;
      island.knownShops = [];
    }
    if (run.islands[0]) {
      run.currentIslandId = run.islands[0].id;
    }
  },

  getCurrentIsland(run: RunState): Island | undefined {
    if (!run.currentIslandId) {
      return run.islands[0];
    }
    return run.islands.find((island) => island.id === run.currentIslandId);
  },

  introductionText(island: Island, regionLabel: string): string {
    const template = INTRO_TEMPLATES[island.archetype];
    return template
      .replaceAll("{name}", island.name)
      .replaceAll("{region}", regionLabel)
      .replaceAll("{settlement}", island.settlementType);
  },

  showIntroduction(run: RunState, islandId: string, regionLabel: string): string | null {
    const island = run.islands.find((entry) => entry.id === islandId);
    if (!island || island.introductionShown) {
      return null;
    }
    island.introductionShown = true;
    run.currentIslandId = island.id;
    return this.introductionText(island, regionLabel);
  },
};

export function defaultUsedIslandNames(): string[] {
  return [];
}
