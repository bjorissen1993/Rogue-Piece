import type {
  Island,
  IslandArchetype,
  IslandFacility,
  IslandFacilityHotspot,
  IslandFacilityId,
  IslandMapHotspotId,
  IslandMapLayoutExtras,
  IslandMapScene,
  RegionId,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { getLocation } from "../data/locations";
import {
  allHotspotsOnIsland,
  findHotspotOnIsland,
  revealIdsForProbe,
  getMapLayoutHotspots,
  isHotspotVisibleInPlay,
  isKnownIslandMapAssetId,
  migrateConsumedHotspotIds,
  migrateHotspotList,
  migrateIslandMapLayouts,
  pickIslandMapAssetId,
  resolveFacilityHotspots,
  setMapLayoutHotspots,
} from "../data/islandMaps";
import type { RandomService } from "./RandomService";

/** Always present on settled / town islands. */
export const BASIC_FACILITY_IDS: readonly IslandFacilityId[] = [
  "HARBOR",
  "INN",
  "MARKET",
  "TRAINING_GROUNDS",
  "TASK_BOARD",
] as const;

const FACILITY_DEFS: Record<
  IslandFacilityId,
  { kind: IslandFacility["kind"]; encounterId: string; name: string }
> = {
  HARBOR: { kind: "BASIC", encounterId: "island_harbor", name: "Harbor" },
  INN: { kind: "BASIC", encounterId: "island_inn", name: "Inn" },
  MARKET: { kind: "BASIC", encounterId: "general_store", name: "Market" },
  TRAINING_GROUNDS: { kind: "BASIC", encounterId: "island_shore_train", name: "Training Grounds" },
  TASK_BOARD: { kind: "BASIC", encounterId: "island_task_board", name: "Task Board" },
  WEAPON_SHOP: { kind: "SPECIAL", encounterId: "weapon_smith", name: "Weapon Shop" },
  CLINIC: { kind: "SPECIAL", encounterId: "clinic_shop", name: "Clinic" },
  SHIPYARD: { kind: "SPECIAL", encounterId: "island_shipyard", name: "Shipyard" },
  BLACK_MARKET: { kind: "SPECIAL", encounterId: "island_black_market", name: "Black Market" },
  LIBRARY: { kind: "SPECIAL", encounterId: "island_library", name: "Library" },
  MARINE_BASE: { kind: "SPECIAL", encounterId: "island_marine_base", name: "Marine Base" },
  AUCTION_HOUSE: { kind: "SPECIAL", encounterId: "island_auction_house", name: "Auction House" },
};

/** Encounter ids that count as facility visits (return to hub without random pick). */
export const FACILITY_ENCOUNTER_IDS: ReadonlySet<string> = new Set(
  Object.values(FACILITY_DEFS).map((def) => def.encounterId),
);

type SpecialRoll = { id: IslandFacilityId; chance: number };

/** Archetype-weighted special facility rolls (generated once per island). */
const SPECIAL_ROLLS_BY_ARCHETYPE: Record<IslandArchetype, SpecialRoll[]> = {
  TRADING: [
    { id: "WEAPON_SHOP", chance: 0.7 },
    { id: "CLINIC", chance: 0.45 },
    { id: "AUCTION_HOUSE", chance: 0.35 },
    { id: "LIBRARY", chance: 0.3 },
    { id: "SHIPYARD", chance: 0.4 },
  ],
  FISHING: [
    { id: "SHIPYARD", chance: 0.55 },
    { id: "CLINIC", chance: 0.35 },
    { id: "WEAPON_SHOP", chance: 0.2 },
  ],
  PIRATE_HAVEN: [
    { id: "WEAPON_SHOP", chance: 0.75 },
    { id: "BLACK_MARKET", chance: 0.65 },
    { id: "CLINIC", chance: 0.25 },
    { id: "SHIPYARD", chance: 0.35 },
  ],
  MARINE_FORTRESS: [
    { id: "MARINE_BASE", chance: 0.95 },
    { id: "CLINIC", chance: 0.7 },
    { id: "WEAPON_SHOP", chance: 0.5 },
    { id: "LIBRARY", chance: 0.25 },
  ],
  TROPICAL: [
    { id: "CLINIC", chance: 0.4 },
    { id: "WEAPON_SHOP", chance: 0.25 },
    { id: "LIBRARY", chance: 0.15 },
  ],
  JUNGLE: [
    { id: "CLINIC", chance: 0.3 },
    { id: "BLACK_MARKET", chance: 0.2 },
    { id: "WEAPON_SHOP", chance: 0.15 },
  ],
  DESERT: [
    { id: "CLINIC", chance: 0.35 },
    { id: "BLACK_MARKET", chance: 0.3 },
    { id: "WEAPON_SHOP", chance: 0.2 },
    { id: "AUCTION_HOUSE", chance: 0.15 },
  ],
};

function makeFacility(id: IslandFacilityId, unlocked = true): IslandFacility {
  const def = FACILITY_DEFS[id];
  return {
    id,
    kind: def.kind,
    encounterId: def.encounterId,
    name: def.name,
    unlocked,
  };
}

function syncKnownShops(island: Island): void {
  const fromFacilities = (island.facilities ?? [])
    .filter((facility) => facility.unlocked)
    .map((facility) => facility.encounterId);
  const prior = island.knownShops ?? [];
  island.knownShops = [...new Set([...prior, ...fromFacilities])];
}

function rollSpecialFacilities(archetype: IslandArchetype, rng: RandomService): IslandFacilityId[] {
  const rolls = SPECIAL_ROLLS_BY_ARCHETYPE[archetype] ?? [];
  const picked: IslandFacilityId[] = [];
  for (const roll of rolls) {
    if (rng.next() < roll.chance) {
      picked.push(roll.id);
    }
  }
  return picked;
}

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

  facilityDefinition(id: IslandFacilityId): (typeof FACILITY_DEFS)[IslandFacilityId] {
    return FACILITY_DEFS[id];
  },

  /** Town islands always get the five basic facilities; specials roll once. */
  generateFacilities(archetype: IslandArchetype, rng: RandomService): IslandFacility[] {
    const basics = BASIC_FACILITY_IDS.map((id) => makeFacility(id, true));
    const specialIds = rollSpecialFacilities(archetype, rng);
    const specials = specialIds.map((id) => makeFacility(id, true));
    return [...basics, ...specials];
  },

  /** Ensure an island has facilities (new runs + save migration). */
  ensureFacilities(island: Island, rng: RandomService): IslandFacility[] {
    if (island.facilities && island.facilities.length > 0) {
      const have = new Set(island.facilities.map((facility) => facility.id));
      for (const id of BASIC_FACILITY_IDS) {
        if (!have.has(id)) {
          island.facilities.push(makeFacility(id, true));
        }
      }
      syncKnownShops(island);
      this.ensureMapAsset(island, rng);
      return island.facilities;
    }
    island.facilities = this.generateFacilities(island.archetype, rng);
    island.developmentLevel = island.developmentLevel ?? 0;
    island.protectionLevel = island.protectionLevel ?? 0;
    island.trustLevel = island.trustLevel ?? 0;
    island.pressureLevel = island.pressureLevel ?? 0;
    island.daysAshore = island.daysAshore ?? 0;
    island.visitCount = island.visitCount ?? 0;
    island.lastVisitedDay = island.lastVisitedDay ?? null;
    island.fundedProjects = island.fundedProjects ?? [];
    island.protectionOffered = island.protectionOffered ?? false;
    syncKnownShops(island);
    this.ensureMapAsset(island, rng);
    return island.facilities;
  },

  /** Assign a map art key when missing (creation + migration). */
  ensureMapAsset(island: Island, rng: RandomService): string | null {
    if (island.mapAssetId && isKnownIslandMapAssetId(island.mapAssetId)) {
      migrateIslandMapLayouts(island);
      island.discoveryFlags = island.discoveryFlags ?? [];
      return island.mapAssetId;
    }
    island.mapAssetId = pickIslandMapAssetId(
      island.archetype,
      (items) => rng.pick(items),
      () => rng.next(),
    );
    migrateIslandMapLayouts(island);
    island.discoveryFlags = island.discoveryFlags ?? [];
    return island.mapAssetId;
  },

  /** Resolved hotspot list for play (visibility filtered) or editor. */
  resolveHotspots(island: Island, run?: RunState | null, forEditor = false): IslandFacilityHotspot[] {
    migrateIslandMapLayouts(island);
    const ids = this.listUnlockedFacilities(island).map((f) => f.id);
    const layoutHotspots = getMapLayoutHotspots(island, island.mapAssetId);
    return resolveFacilityHotspots(island.mapAssetId, ids, layoutHotspots, {
      forEditor,
      island,
      run,
    });
  },

  /** Persist hotspots for the island's current map asset only. */
  setFacilityHotspots(
    island: Island,
    hotspots: IslandFacilityHotspot[],
    scenes?: IslandMapScene[] | null,
    extras?: IslandMapLayoutExtras,
  ): void {
    migrateIslandMapLayouts(island);
    setMapLayoutHotspots(island, island.mapAssetId, hotspots, scenes, extras);
  },

  /** Persist a one-shot probe so it stays gone after leaving the hub. */
  consumeHotspot(island: Island, hotspotId: string): void {
    const id = String(hotspotId ?? "").trim();
    if (!id) {
      return;
    }
    const next = migrateConsumedHotspotIds([...(island.consumedHotspotIds ?? []), id]);
    island.consumedHotspotIds = next.length > 0 ? next : undefined;
  },

  /** Persist icons revealed by a probe so they stay visible after leaving the hub. */
  revealHotspots(island: Island, hotspotIds: string[]): void {
    if (!hotspotIds.length) {
      return;
    }
    const next = migrateConsumedHotspotIds([...(island.revealedHotspotIds ?? []), ...hotspotIds]);
    island.revealedHotspotIds = next.length > 0 ? next : undefined;
  },

  /** Put a one-shot probe back in play and hide icons that only it had revealed. */
  restoreProbe(island: Island, hotspotId: string): void {
    const id = String(hotspotId ?? "").trim();
    if (!id) {
      return;
    }
    migrateIslandMapLayouts(island);
    const probe = findHotspotOnIsland(island, id);
    const consumed = new Set(migrateConsumedHotspotIds(island.consumedHotspotIds));
    const layout = allHotspotsOnIsland(island);
    const exclusive = (probe ? revealIdsForProbe(probe, layout) : []).filter((revealId) => {
      return !layout.some(
        (other) =>
          other.hotspotId !== id &&
          consumed.has(other.hotspotId) &&
          revealIdsForProbe(other, layout).includes(revealId),
      );
    });
    consumed.delete(id);
    const nextConsumed = migrateConsumedHotspotIds(Array.from(consumed));
    island.consumedHotspotIds = nextConsumed.length > 0 ? nextConsumed : undefined;
    if (exclusive.length) {
      const drop = new Set(exclusive);
      const nextRevealed = migrateConsumedHotspotIds(island.revealedHotspotIds).filter(
        (revealId) => !drop.has(revealId),
      );
      island.revealedHotspotIds = nextRevealed.length > 0 ? nextRevealed : undefined;
    }
  },

  /** Persist hotspots for an explicit map asset (editor / multi-map). */
  setMapHotspots(
    island: Island,
    mapAssetId: string,
    hotspots: IslandFacilityHotspot[],
    scenes?: IslandMapScene[] | null,
    extras?: IslandMapLayoutExtras,
  ): void {
    migrateIslandMapLayouts(island);
    setMapLayoutHotspots(island, mapAssetId, hotspots, scenes, extras);
  },

  hasDiscoveryFlag(island: Island | undefined, flag: string): boolean {
    return Boolean(island?.discoveryFlags?.includes(flag));
  },

  addDiscoveryFlags(island: Island, flags: string[]): string[] {
    if (!flags.length) {
      return [];
    }
    const current = new Set(island.discoveryFlags ?? []);
    const added: string[] = [];
    for (const flag of flags) {
      if (!current.has(flag)) {
        current.add(flag);
        added.push(flag);
      }
    }
    island.discoveryFlags = Array.from(current);
    return added;
  },

  /** Record one Explore action on the current island (gates explore_count unlocks). */
  recordExplore(island: Island): number {
    island.exploreCount = (island.exploreCount ?? 0) + 1;
    return island.exploreCount;
  },

  /** Force a placed hotspot unlocked, or ensure a discovery flag for its default unlock. */
  unlockMapHotspot(
    island: Island,
    hotspotKey: IslandMapHotspotId | string,
    unlockFlag?: string,
  ): void {
    migrateIslandMapLayouts(island);
    const mapKey = island.mapAssetId;
    const list = migrateHotspotList(getMapLayoutHotspots(island, mapKey));
    const existing =
      list.find((h) => h.hotspotId === hotspotKey) ??
      list.find((h) => h.facilityId === hotspotKey);
    if (existing) {
      existing.unlocked = true;
      existing.hidden = false;
      existing.unlock = { mode: "always" };
      if (unlockFlag) {
        existing.unlockFlag = unlockFlag;
      }
      setMapLayoutHotspots(island, mapKey, list);
    }
    const flag = unlockFlag ?? existing?.unlockFlag;
    if (flag) {
      this.addDiscoveryFlags(island, [flag]);
    } else if (!existing) {
      this.addDiscoveryFlags(island, [`map_${String(hotspotKey).toLowerCase()}`]);
    }
  },

  isHotspotVisible(island: Island, hotspot: IslandFacilityHotspot, run?: RunState | null): boolean {
    const unlocked = new Set(this.listUnlockedFacilities(island).map((f) => f.id));
    return isHotspotVisibleInPlay(hotspot, island, run, unlocked);
  },

  ensureAllIslandFacilities(run: RunState, rng: RandomService): void {
    for (const island of run.islands) {
      this.ensureFacilities(island, rng);
    }
  },

  hasFacility(island: Island | undefined, facilityId: IslandFacilityId): boolean {
    if (!island?.facilities) {
      return BASIC_FACILITY_IDS.includes(facilityId);
    }
    return island.facilities.some((facility) => facility.id === facilityId && facility.unlocked);
  },

  getFacility(island: Island | undefined, facilityId: IslandFacilityId): IslandFacility | undefined {
    return island?.facilities?.find((facility) => facility.id === facilityId);
  },

  listUnlockedFacilities(island: Island | undefined): IslandFacility[] {
    if (!island?.facilities?.length) {
      return BASIC_FACILITY_IDS.map((id) => makeFacility(id, true));
    }
    return island.facilities.filter((facility) => facility.unlocked);
  },

  isFacilityEncounter(encounterId: string | null | undefined): boolean {
    return Boolean(encounterId && FACILITY_ENCOUNTER_IDS.has(encounterId));
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
      facilities: this.generateFacilities(archetype, rng),
      mapAssetId: pickIslandMapAssetId(archetype, (items) => rng.pick(items), () => rng.next()),
      mapLayouts: {},
      facilityHotspots: [],
      discoveryFlags: [],
      exploreCount: 0,
      developmentLevel: 0,
      protectionLevel: 0,
      trustLevel: 0,
    };
    syncKnownShops(island);
    run.islands.push(island);
    return island;
  },

  seedEastBlueIslands(run: RunState, rng: RandomService): void {
    if (run.islands.length > 0) {
      this.ensureAllIslandFacilities(run, rng);
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
    }
    if (run.islands[0]) {
      run.currentIslandId = run.islands[0].id;
    }
  },

  getCurrentIsland(run: RunState): Island | undefined {
    if (!run.currentIslandId) {
      return run.islands[0];
    }
    return run.islands.find((island) => island.id === run.currentIslandId) ?? run.islands[0];
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
