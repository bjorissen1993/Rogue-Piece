import type { Island, IslandArchetype, RegionId, RunState } from "../models/types";
import { createId } from "../utils/ids";
import { getLocation } from "../data/locations";
import type { RandomService } from "./RandomService";

/** Word banks for procedural East Blue–flavoured island names. */
const PREFIXES: Record<IslandArchetype, string[]> = {
  TROPICAL: [
    "Palm",
    "Coral",
    "Sun",
    "Lagoon",
    "Trade",
    "Coco",
    "Pearl",
    "Amber",
    "Saffron",
    "Mango",
    "Azure",
    "Shell",
    "Breeze",
    "Lantern",
    "Honey",
  ],
  JUNGLE: [
    "Moss",
    "Vine",
    "Canopy",
    "Green",
    "Hidden",
    "Fern",
    "Orchid",
    "Mist",
    "Thorn",
    "Cedar",
    "Wild",
    "Rain",
    "Emerald",
    "Root",
    "Shade",
  ],
  DESERT: [
    "Sand",
    "Dune",
    "Dry",
    "Mirage",
    "Scorch",
    "Copper",
    "Dust",
    "Sunbake",
    "Ochre",
    "Saltflat",
    "Bone",
    "Glass",
    "Cinder",
    "Hollow",
    "Bleach",
  ],
  PIRATE_HAVEN: [
    "Rum",
    "Black",
    "Cutlass",
    "Smuggler",
    "Free",
    "Rogue",
    "Skull",
    "Grog",
    "Jolly",
    "Noose",
    "Corsair",
    "Mutiny",
    "Redflag",
    "Night",
    "Broken",
  ],
  MARINE_FORTRESS: [
    "Garrison",
    "Iron",
    "Watch",
    "Signal",
    "Harbor",
    "Justice",
    "Anchor",
    "Banner",
    "White",
    "Order",
    "Fort",
    "Beacon",
    "Duty",
    "Canon",
    "Law",
  ],
  FISHING: [
    "Net",
    "Tide",
    "Catch",
    "Salt",
    "Hook",
    "Kelp",
    "Herring",
    "Foam",
    "Pier",
    "Current",
    "Cod",
    "Spray",
    "Buoy",
    "Drift",
    "Barnacle",
  ],
  TRADING: [
    "Market",
    "Coin",
    "Merchant",
    "Dock",
    "Exchange",
    "Silk",
    "Ledger",
    "Spice",
    "Caravan",
    "Scale",
    "Bargain",
    "Quill",
    "Cargo",
    "Fairwind",
    "Guild",
  ],
};

const SUFFIXES: Record<IslandArchetype, string[]> = {
  TROPICAL: ["Cove", "Atoll", "Bay", "Isle", "Reef", "Keys", "Shores", "Haven", "Point", "Strand"],
  JUNGLE: ["Hollow", "Reach", "Mire", "Canopy", "Deep", "Grove", "Wilds", "Thicket", "Falls", "Glade"],
  DESERT: ["Barrens", "Flats", "Spire", "Waste", "Ring", "Dunes", "Expanse", "Mesa", "Wastes", "Crown"],
  PIRATE_HAVEN: ["Port", "Den", "Haven", "Hideout", "Anchor", "Roost", "Wharf", "Berth", "Hole", "Rest"],
  MARINE_FORTRESS: ["Base", "Keep", "Outpost", "Battery", "Station", "Yard", "Watch", "Quay", "Dock", "Post"],
  FISHING: ["Shoals", "Harbor", "Wharf", "Creek", "Sound", "Banks", "Landing", "Jetty", "Inlet", "Pool"],
  TRADING: ["Exchange", "Crossing", "Quay", "Mart", "Terminus", "Bazaar", "Yard", "Pier", "Gate", "Plaza"],
};

/**
 * Full handcrafted island names (used occasionally so places feel less formulaic).
 * Keep East Blue–adjacent: coastal, quirky, nautical — not major canon locations.
 */
export const CURATED_ISLAND_NAMES: readonly string[] = [
  "Saffron Quay",
  "Twin Lantern Isle",
  "Broken Compass Bay",
  "Kelpwhisper Atoll",
  "Red Hook Landing",
  "Mirage Salt Flats",
  "Cinder Reef",
  "Gullcry Point",
  "Orchid Mist Reach",
  "Noose & Net Port",
  "White Banner Watch",
  "Honeycomb Cove",
  "Driftwood Sound",
  "Copper Mirage Isle",
  "Stormglass Keys",
  "Barnacle Bend",
  "Silk Ledger Crossing",
  "Thorncanopy Deep",
  "Rumrunner's Roost",
  "Quiet Buoy Harbor",
  "Ashen Dune Spire",
  "Pearl Basket Bay",
  "Iron Signal Keep",
  "Foghook Creek",
  "Jolly Anchor Den",
  "Saffron Bazaar Quay",
  "Mossfall Hollow",
  "Cutlass Rest",
  "Tidepurse Shoals",
  "Lawbinder Outpost",
  "Mango Wind Strand",
  "Boneglass Barrens",
  "Free Flag Hideout",
  "Cedar Rain Grove",
  "Fairwind Cargo Yard",
];

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
  const curatedForPick = CURATED_ISLAND_NAMES.filter((name) => !options.usedNames.includes(name));

  for (let attempt = 0; attempt < 32; attempt += 1) {
    // ~25% chance to use a curated full name when any remain.
    if (curatedForPick.length > 0 && options.rng.next() < 0.25) {
      const name = options.rng.pick([...curatedForPick]);
      if (!options.usedNames.includes(name)) {
        return name;
      }
    }
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

  /** Resolve a stored island/location id to a player-facing place name. */
  displayName(run: RunState, islandOrLocationId?: string | null): string {
    if (!islandOrLocationId) {
      const current = this.getCurrentIsland(run);
      if (current?.name) {
        return current.name;
      }
      const loc = getLocation(run.currentLocationId);
      return loc?.name ?? "unknown shores";
    }
    const byIsland = run.islands.find((island) => island.id === islandOrLocationId);
    if (byIsland?.name) {
      return byIsland.name;
    }
    const loc = getLocation(islandOrLocationId);
    if (loc?.name) {
      return loc.name;
    }
    // Never surface raw procedural ids like island_d2699ca1.
    if (/^island[_-]/i.test(islandOrLocationId)) {
      return this.getCurrentIsland(run)?.name ?? "a nearby island clinic";
    }
    return islandOrLocationId;
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
