import type {
  HotspotChildOverride,
  HotspotHandlerType,
  HotspotLink,
  HotspotQuestConfig,
  HotspotQuestKind,
  HotspotStage,
  HotspotStageKind,
  HotspotUnlockRule,
  Island,
  IslandArchetype,
  IslandFacilityHotspot,
  IslandFacilityId,
  IslandMapHotspotId,
  IslandMapLayout,
  IslandMapLayoutExtras,
  IslandMapScene,
  IslandSpecialMarkerId,
  LocationAnchor,
  LocationAnchorAiPermission,
  NpcFaction,
  RelationFactionId,
  RunState,
  StoryChain,
  StoryChainEnd,
  StoryChainNode,
  StoryChainNodeKind,
  StoryChainStart,
  StoryChainTriggerKind,
  TimeOfDay,
} from "../models/types";
import { createId } from "../utils/ids";
import { STORY_THREAD_TEMPLATES } from "./storyThreads";
import { ENCOUNTERS } from "./encounters";

/** Public path prefix for island map artwork (no labels on the art). */
export const ISLAND_MAP_DIR = "/icons/Islands";

/** Public path prefix for facility / location map icons. */
export const MAP_ICON_DIR = "/icons/UI/New";

/**
 * Island map asset keys (filename without extension under `public/icons/Islands`).
 * Assign one per island instance; hotspots are authored per map key.
 */
export const ISLAND_MAP_ASSET_IDS = [
  "Island_Begin",
  "Island_Castle",
  "Island_Circus",
  "Island_Colosseum",
  "Island_Cooking",
  "Island_Desert",
  "Island_Gambling",
  "Island_Giant_Battle",
  "Island_Giants",
  "Island_Horror",
  "Island_Illusion",
  "Island_Jungle",
  "Island_Lava",
  "Island_Library",
  "Island_Lighthouse",
  "Island_MarineBase",
  "Island_Medical",
  "Island_Meteorite",
  "Island_Museum",
  "Island_Music",
  "Island_Outlaws",
  "Island_Peaceful",
  "Island_Random1",
  "Island_Random2",
  "Island_Random3",
  "Island_Random4",
  "Island_Random5",
  "Island_Random6",
  "Island_Random7",
  "Island_Resort",
  "Island_Sky",
  "Island_Snow",
  "Island_Steampunk",
  "Island_Stronghold",
  "Island_Swamp",
  "Island_Treehouse",
  "Island_Turtleback",
  "Island_Underwater",
  "Island_Venice",
  "Island_WildWest",
  "Island_Zoo",
] as const;

export type IslandMapAssetId = (typeof ISLAND_MAP_ASSET_IDS)[number];

/** Hub encounter choice ids for each facility. */
export const FACILITY_HUB_CHOICE_ID: Record<IslandFacilityId, string> = {
  HARBOR: "harbor",
  INN: "inn",
  MARKET: "market",
  TRAINING_GROUNDS: "training",
  TASK_BOARD: "tasks",
  WEAPON_SHOP: "weapon_shop",
  CLINIC: "clinic",
  SHIPYARD: "shipyard",
  BLACK_MARKET: "black_market",
  LIBRARY: "library",
  MARINE_BASE: "marine_base",
  AUCTION_HOUSE: "auction",
};

/** Map icon filenames under `public/icons/UI/New` for each facility. */
export const FACILITY_MAP_ICON: Record<IslandFacilityId, string> = {
  HARBOR: "Map_Harbor.png",
  INN: "Map_Inn.png",
  MARKET: "Map_Market.png",
  TRAINING_GROUNDS: "Map_TrainingGrounds.png",
  TASK_BOARD: "Map_Taskboard.png",
  WEAPON_SHOP: "Map_WeaponShop.png",
  CLINIC: "Map_Clinic.png",
  SHIPYARD: "Map_Shipyard.png",
  BLACK_MARKET: "Map_BlackMarketBuy-Sell.png",
  LIBRARY: "Map_Research-Knowledge.png",
  MARINE_BASE: "Map_MarineBase.png",
  AUCTION_HOUSE: "Map_AuctionHouse.png",
};

export const ALL_FACILITY_IDS = Object.keys(FACILITY_MAP_ICON) as IslandFacilityId[];

export type SpecialMarkerDef = {
  id: IslandSpecialMarkerId;
  label: string;
  icon: string;
  /** Hub choice id when clicking in play mode (optional). */
  hubChoiceId?: string;
  /** Show as soon as the island is known. */
  alwaysVisible?: boolean;
  /** Default unlock flag written when placing this marker. */
  defaultUnlockFlag?: string;
};

/** Special (non-facility) placeable map markers. */
export const SPECIAL_MARKER_DEFS: Record<IslandSpecialMarkerId, SpecialMarkerDef> = {
  EXPLORE: {
    id: "EXPLORE",
    label: "Explore",
    icon: "Map_Explore.png",
    hubChoiceId: "explore",
    alwaysVisible: true,
  },
  QUEST: {
    id: "QUEST",
    label: "Quest",
    icon: "Map_Quest.png",
    hubChoiceId: "map_quest",
    defaultUnlockFlag: "map_quest",
  },
  EVENT: {
    id: "EVENT",
    label: "Event",
    icon: "Map_Event.png",
    hubChoiceId: "map_event",
    defaultUnlockFlag: "map_event",
  },
  GATHER: {
    id: "GATHER",
    label: "Gather",
    icon: "Map_Gather.png",
    defaultUnlockFlag: "map_gather",
  },
  FISHING: {
    id: "FISHING",
    label: "Fishing",
    icon: "Map_Fishing.png",
    defaultUnlockFlag: "map_fishing",
  },
  HUNTS: {
    id: "HUNTS",
    label: "Hunts",
    icon: "Map_Hunts.png",
    defaultUnlockFlag: "map_hunts",
  },
  INVESTIGATE: {
    id: "INVESTIGATE",
    label: "Investigate",
    icon: "Map_Investigate.png",
    defaultUnlockFlag: "map_investigate",
  },
  TALK: {
    id: "TALK",
    label: "Talk",
    icon: "Map_Talk.png",
    defaultUnlockFlag: "map_talk",
  },
  SCOUT: {
    id: "SCOUT",
    label: "Scout",
    icon: "Map_Scout.png",
    defaultUnlockFlag: "map_scout",
  },
  SEARCH: {
    id: "SEARCH",
    label: "Search",
    icon: "Map_Search.png",
    defaultUnlockFlag: "map_search",
  },
  CHALLENGE: {
    id: "CHALLENGE",
    label: "Challenge",
    icon: "Map_Challenge.png",
    defaultUnlockFlag: "map_challenge",
  },
  MUSEUM: {
    id: "MUSEUM",
    label: "Museum",
    icon: "Map_Museum.png",
    defaultUnlockFlag: "map_museum",
  },
  BOUNTIES: {
    id: "BOUNTIES",
    label: "Bounties",
    icon: "Map_Bounties.png",
    defaultUnlockFlag: "map_bounties",
  },
  DELIVERIES: {
    id: "DELIVERIES",
    label: "Deliveries",
    icon: "Map_Deliveries.png",
    defaultUnlockFlag: "map_deliveries",
  },
  ESCORT: {
    id: "ESCORT",
    label: "Escort",
    icon: "Map_EscortMissions.png",
    defaultUnlockFlag: "map_escort",
  },
  JOBS: {
    id: "JOBS",
    label: "Jobs",
    icon: "Map_Jobs.png",
    defaultUnlockFlag: "map_jobs",
  },
  MISSING_PERSONS: {
    id: "MISSING_PERSONS",
    label: "Missing persons",
    icon: "Map_MissingPersons.png",
    defaultUnlockFlag: "map_missing_persons",
  },
};

export const ALL_SPECIAL_MARKER_IDS = Object.keys(SPECIAL_MARKER_DEFS) as IslandSpecialMarkerId[];

/** Extra hub actions that are not IslandFacility entries (legacy helper). */
export const HUB_EXTRA_MAP_ICONS = {
  explore: "Map_Explore.png",
  depart: "Map_Depart-WorldMap.png",
} as const;

export type PlaceablePaletteEntry = {
  id: IslandMapHotspotId;
  label: string;
  iconSrc: string;
  kind: "facility" | "special";
};

const FACILITY_LABELS: Record<IslandFacilityId, string> = {
  HARBOR: "Harbor",
  INN: "Inn",
  MARKET: "Market",
  TRAINING_GROUNDS: "Training Grounds",
  TASK_BOARD: "Task Board",
  WEAPON_SHOP: "Weapon Shop",
  CLINIC: "Clinic",
  SHIPYARD: "Shipyard",
  BLACK_MARKET: "Black Market",
  LIBRARY: "Library",
  MARINE_BASE: "Marine Base",
  AUCTION_HOUSE: "Auction House",
};

/** Prefer thematic maps when rolling a new island. */
const MAPS_BY_ARCHETYPE: Record<IslandArchetype, IslandMapAssetId[]> = {
  TROPICAL: ["Island_Begin", "Island_Peaceful", "Island_Resort", "Island_Music", "Island_Zoo"],
  JUNGLE: ["Island_Jungle", "Island_Treehouse", "Island_Swamp", "Island_Horror"],
  DESERT: ["Island_Desert", "Island_WildWest", "Island_Lava", "Island_Meteorite"],
  PIRATE_HAVEN: ["Island_Outlaws", "Island_Gambling", "Island_Circus", "Island_Stronghold"],
  MARINE_FORTRESS: ["Island_MarineBase", "Island_Castle", "Island_Stronghold", "Island_Colosseum"],
  FISHING: ["Island_Lighthouse", "Island_Venice", "Island_Turtleback", "Island_Underwater"],
  TRADING: ["Island_Venice", "Island_Steampunk", "Island_Museum", "Island_Library", "Island_Cooking"],
};

const FALLBACK_MAPS: IslandMapAssetId[] = [
  "Island_Random1",
  "Island_Random2",
  "Island_Random3",
  "Island_Random4",
  "Island_Random5",
  "Island_Random6",
  "Island_Random7",
  "Island_Sky",
  "Island_Snow",
  "Island_Illusion",
  "Island_Giants",
  "Island_Giant_Battle",
  "Island_Medical",
];

/**
 * Authored default hotspot layouts keyed by map asset id.
 * Empty until placed in Dev Mode and exported / pasted here.
 * Per-island overrides live on `Island.mapLayouts[mapAssetId]` (legacy: `facilityHotspots`).
 */
export const DEFAULT_MAP_HOTSPOTS: Partial<Record<IslandMapAssetId, IslandFacilityHotspot[]>> = {
  // Seed a usable default for the starter-style map; other maps use auto-layout until authored.
  Island_Begin: [
    { hotspotId: "default_harbor", facilityId: "HARBOR", xPct: 18, yPct: 72, unlock: { mode: "always" } },
    { hotspotId: "default_inn", facilityId: "INN", xPct: 42, yPct: 48, unlock: { mode: "always" } },
    { hotspotId: "default_market", facilityId: "MARKET", xPct: 58, yPct: 55, unlock: { mode: "always" } },
    { hotspotId: "default_training", facilityId: "TRAINING_GROUNDS", xPct: 72, yPct: 40, unlock: { mode: "always" } },
    { hotspotId: "default_tasks", facilityId: "TASK_BOARD", xPct: 50, yPct: 32, unlock: { mode: "always" } },
    { hotspotId: "default_weapons", facilityId: "WEAPON_SHOP", xPct: 34, yPct: 60, unlock: { mode: "always" } },
    { hotspotId: "default_clinic", facilityId: "CLINIC", xPct: 66, yPct: 68, unlock: { mode: "always" } },
    { hotspotId: "default_shipyard", facilityId: "SHIPYARD", xPct: 22, yPct: 58, unlock: { mode: "always" } },
    { hotspotId: "default_black_market", facilityId: "BLACK_MARKET", xPct: 78, yPct: 62, unlock: { mode: "always" } },
    { hotspotId: "default_library", facilityId: "LIBRARY", xPct: 48, yPct: 22, unlock: { mode: "always" } },
    { hotspotId: "default_marine", facilityId: "MARINE_BASE", xPct: 82, yPct: 28, unlock: { mode: "always" } },
    { hotspotId: "default_auction", facilityId: "AUCTION_HOUSE", xPct: 30, yPct: 38, unlock: { mode: "always" } },
    { hotspotId: "default_explore", facilityId: "EXPLORE", xPct: 50, yPct: 78, unlock: { mode: "always" }, alwaysVisible: true },
    {
      hotspotId: "default_quest",
      facilityId: "QUEST",
      xPct: 62,
      yPct: 26,
      unlock: { mode: "flag", flag: "map_quest" },
      unlockFlag: "map_quest",
    },
    {
      hotspotId: "default_event",
      facilityId: "EVENT",
      xPct: 24,
      yPct: 34,
      unlock: { mode: "flag", flag: "map_event" },
      unlockFlag: "map_event",
    },
  ],
};

export function islandMapSrc(mapAssetId: string): string {
  return `${ISLAND_MAP_DIR}/${mapAssetId}.png`;
}

export function facilityMapIconSrc(facilityId: IslandFacilityId): string {
  return `${MAP_ICON_DIR}/${FACILITY_MAP_ICON[facilityId]}`;
}

export function specialMarkerIconSrc(markerId: IslandSpecialMarkerId): string {
  return `${MAP_ICON_DIR}/${SPECIAL_MARKER_DEFS[markerId].icon}`;
}

export function hubExtraMapIconSrc(key: keyof typeof HUB_EXTRA_MAP_ICONS): string {
  return `${MAP_ICON_DIR}/${HUB_EXTRA_MAP_ICONS[key]}`;
}

export function isFacilityHotspotId(id: IslandMapHotspotId): id is IslandFacilityId {
  return id in FACILITY_MAP_ICON;
}

export function isSpecialMarkerId(id: IslandMapHotspotId): id is IslandSpecialMarkerId {
  return id in SPECIAL_MARKER_DEFS;
}

export function hotspotIconSrc(id: IslandMapHotspotId): string {
  if (isFacilityHotspotId(id)) {
    return facilityMapIconSrc(id);
  }
  return specialMarkerIconSrc(id);
}

export function hotspotLabel(id: IslandMapHotspotId): string {
  if (isFacilityHotspotId(id)) {
    return FACILITY_LABELS[id];
  }
  return SPECIAL_MARKER_DEFS[id].label;
}

export function hotspotHubChoiceId(id: IslandMapHotspotId): string | undefined {
  if (isFacilityHotspotId(id)) {
    return FACILITY_HUB_CHOICE_ID[id];
  }
  return SPECIAL_MARKER_DEFS[id].hubChoiceId;
}

/** Full editor palette: facilities + special markers. */
export const PLACEABLE_PALETTE: PlaceablePaletteEntry[] = [
  ...ALL_FACILITY_IDS.map((id) => ({
    id,
    label: FACILITY_LABELS[id],
    iconSrc: facilityMapIconSrc(id),
    kind: "facility" as const,
  })),
  ...ALL_SPECIAL_MARKER_IDS.map((id) => ({
    id,
    label: SPECIAL_MARKER_DEFS[id].label,
    iconSrc: specialMarkerIconSrc(id),
    kind: "special" as const,
  })),
];

export function isKnownIslandMapAssetId(id: string | null | undefined): id is IslandMapAssetId {
  return Boolean(id && (ISLAND_MAP_ASSET_IDS as readonly string[]).includes(id));
}

export function pickIslandMapAssetId(
  archetype: IslandArchetype,
  pick: <T>(items: T[]) => T,
  nextFloat: () => number = () => 0.5,
): IslandMapAssetId {
  const themed = MAPS_BY_ARCHETYPE[archetype] ?? [];
  const useThemed = themed.length > 0 && nextFloat() < 0.85;
  const pool = useThemed ? themed : [...themed, ...FALLBACK_MAPS];
  return pick(pool.length > 0 ? pool : [...ISLAND_MAP_ASSET_IDS]);
}

/** Spread facilities in a gentle arc when no authored layout exists. */
export function autoLayoutHotspots(facilityIds: IslandMapHotspotId[]): IslandFacilityHotspot[] {
  const n = facilityIds.length;
  if (n === 0) {
    return [];
  }
  return facilityIds.map((facilityId, index) => {
    const t = n === 1 ? 0.5 : index / (n - 1);
    const angle = Math.PI * (0.15 + t * 0.7);
    const radius = 28 + (index % 3) * 4;
    const xPct = clampPct(50 + Math.cos(angle) * radius);
    const yPct = clampPct(52 + Math.sin(angle) * (radius * 0.78) - 8);
    return withMarkerDefaults({ facilityId, xPct, yPct, hotspotId: createId("hs") });
  });
}

export function clampPct(value: number): number {
  return Math.round(Math.max(4, Math.min(96, value)) * 10) / 10;
}

export function snapPct(value: number, step: number): number {
  if (step <= 0) {
    return clampPct(value);
  }
  return clampPct(Math.round(value / step) * step);
}

export function defaultUnlockRuleFor(id: IslandMapHotspotId): HotspotUnlockRule {
  if (isSpecialMarkerId(id)) {
    const def = SPECIAL_MARKER_DEFS[id];
    if (def.alwaysVisible) {
      return { mode: "always" };
    }
    if (def.defaultUnlockFlag) {
      return { mode: "flag", flag: def.defaultUnlockFlag };
    }
  }
  return { mode: "always" };
}

/** Markers that support quest/event + handler configuration in the map editor. */
const QUEST_CONFIG_MARKER_IDS = new Set<IslandMapHotspotId>([
  "QUEST",
  "EVENT",
  "INVESTIGATE",
  "CHALLENGE",
  "BOUNTIES",
  "DELIVERIES",
  "ESCORT",
  "JOBS",
  "MISSING_PERSONS",
  "HUNTS",
  "SEARCH",
]);

export function supportsQuestConfig(id: IslandMapHotspotId): boolean {
  return QUEST_CONFIG_MARKER_IDS.has(id);
}

export function defaultQuestConfigFor(id: IslandMapHotspotId): HotspotQuestConfig | undefined {
  if (!supportsQuestConfig(id)) {
    return undefined;
  }
  const kind: HotspotQuestKind =
    id === "EVENT" ? "EVENT" : id === "QUEST" ? "STORY_THREAD" : "ENCOUNTER";
  return { kind, handlerType: "ANY" };
}

export const HOTSPOT_QUEST_KIND_OPTIONS: Array<{ value: HotspotQuestKind; label: string }> = [
  { value: "STORY_THREAD", label: "Story thread" },
  { value: "FACTION_MISSION", label: "Faction mission" },
  { value: "ENCOUNTER", label: "Encounter" },
  { value: "EVENT", label: "Island event" },
  { value: "CUSTOM", label: "Custom id" },
];

export const HOTSPOT_STAGE_KIND_OPTIONS: Array<{ value: HotspotStageKind; label: string }> = [
  { value: "FIND_ITEM", label: "Find item" },
  { value: "DELIVER", label: "Deliver" },
  { value: "TALK", label: "Talk" },
  { value: "BATTLE", label: "Battle" },
  { value: "JOIN_OFFER", label: "Join offer" },
  { value: "EXPLORE", label: "Explore" },
  { value: "CUSTOM", label: "Custom" },
];

export function createHotspotStage(
  order: number,
  kind: HotspotStageKind = "CUSTOM",
  patch?: Partial<Omit<HotspotStage, "id" | "order" | "kind">>,
): HotspotStage {
  return {
    id: createId("stg"),
    order,
    kind,
    battle: kind === "BATTLE" ? true : patch?.battle,
    label: patch?.label,
    notes: patch?.notes,
    payload: patch?.payload,
  };
}

export function createHotspotLink(patch?: Partial<Omit<HotspotLink, "id">>): HotspotLink {
  return {
    id: createId("lnk"),
    toHotspotId: patch?.toHotspotId,
    toIslandId: patch?.toIslandId,
    toMapAssetId: patch?.toMapAssetId,
    label: patch?.label,
    notes: patch?.notes,
    kind: patch?.kind,
  };
}

export function createMapScene(
  name: string,
  islandId?: string,
  notes?: string,
): IslandMapScene {
  return {
    id: createId("scn"),
    name: name.trim() || "Untitled scene",
    islandId,
    notes,
  };
}

export function migrateHotspotStage(raw: Partial<HotspotStage> | null | undefined): HotspotStage | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const kind = (typeof raw.kind === "string" ? raw.kind : "CUSTOM") as HotspotStageKind;
  const validKinds = new Set(HOTSPOT_STAGE_KIND_OPTIONS.map((o) => o.value));
  const safeKind = validKinds.has(kind) ? kind : "CUSTOM";
  const order =
    typeof raw.order === "number" && Number.isFinite(raw.order) ? Math.max(1, Math.floor(raw.order)) : 1;
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : createId("stg"),
    order,
    kind: safeKind,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : undefined,
    battle: typeof raw.battle === "boolean" ? raw.battle : safeKind === "BATTLE" ? true : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    payload:
      raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
        ? { ...(raw.payload as Record<string, unknown>) }
        : undefined,
  };
}

export function migrateHotspotStages(
  raw: Array<Partial<HotspotStage>> | null | undefined,
): HotspotStage[] {
  if (!raw?.length) {
    return [];
  }
  const seen = new Set<string>();
  const stages: HotspotStage[] = [];
  for (const entry of raw) {
    const next = migrateHotspotStage(entry);
    if (!next) {
      continue;
    }
    if (seen.has(next.id)) {
      next.id = createId("stg");
    }
    seen.add(next.id);
    stages.push(next);
  }
  stages.sort((a, b) => a.order - b.order);
  return stages.map((s, i) => ({ ...s, order: i + 1 }));
}

export function migrateHotspotLink(raw: Partial<HotspotLink> | null | undefined): HotspotLink | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const toHotspotId =
    typeof raw.toHotspotId === "string" && raw.toHotspotId.trim()
      ? raw.toHotspotId.trim()
      : undefined;
  const toIslandId =
    typeof raw.toIslandId === "string" && raw.toIslandId.trim() ? raw.toIslandId.trim() : undefined;
  const toMapAssetId =
    typeof raw.toMapAssetId === "string" && raw.toMapAssetId.trim()
      ? raw.toMapAssetId.trim()
      : undefined;
  if (!toHotspotId && !toIslandId && !toMapAssetId && !raw.label && !raw.notes) {
    return null;
  }
  const kindRaw = typeof raw.kind === "string" ? raw.kind.toUpperCase() : "";
  const kind =
    kindRaw === "REVEAL" || kindRaw === "CHAIN" || kindRaw === "TRAVEL"
      ? (kindRaw as HotspotLink["kind"])
      : undefined;
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : createId("lnk"),
    toHotspotId,
    toIslandId,
    toMapAssetId,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    kind,
  };
}

export function migrateHotspotLinks(
  raw: Array<Partial<HotspotLink>> | null | undefined,
): HotspotLink[] {
  if (!raw?.length) {
    return [];
  }
  const seen = new Set<string>();
  const links: HotspotLink[] = [];
  for (const entry of raw) {
    const next = migrateHotspotLink(entry);
    if (!next) {
      continue;
    }
    if (seen.has(next.id)) {
      next.id = createId("lnk");
    }
    seen.add(next.id);
    links.push(next);
  }
  return links;
}

/** Info-gather / probe markers that can reveal other icons and optionally consume on use. */
const INFO_PROBE_MARKER_IDS = new Set<IslandSpecialMarkerId>([
  "EXPLORE",
  "INVESTIGATE",
  "SEARCH",
  "SCOUT",
]);

export function supportsRevealAuthoring(id: IslandMapHotspotId): boolean {
  return isSpecialMarkerId(id) && INFO_PROBE_MARKER_IDS.has(id);
}

export function supportsConsumeOnUse(id: IslandMapHotspotId): boolean {
  return supportsRevealAuthoring(id);
}

function migrateRevealsHotspotIds(
  raw: Partial<IslandFacilityHotspot> & { disappearAfterUse?: boolean },
  links: HotspotLink[],
): string[] | undefined {
  const ids = new Set<string>();
  if (Array.isArray(raw.revealsHotspotIds)) {
    for (const entry of raw.revealsHotspotIds) {
      if (typeof entry === "string" && entry.trim()) {
        ids.add(entry.trim());
      }
    }
  }
  for (const link of links) {
    if (link.kind === "REVEAL" && link.toHotspotId) {
      ids.add(link.toHotspotId);
    }
  }
  return ids.size > 0 ? [...ids] : undefined;
}

function migrateConsumeOnUse(
  raw: Partial<IslandFacilityHotspot> & { disappearAfterUse?: boolean },
): boolean | undefined {
  if (raw.consumeOnUse === true || raw.disappearAfterUse === true) {
    return true;
  }
  if (raw.consumeOnUse === false || raw.disappearAfterUse === false) {
    return false;
  }
  return undefined;
}

export function migrateMapScene(raw: Partial<IslandMapScene> | null | undefined): IslandMapScene | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Untitled scene";
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : createId("scn"),
    name,
    islandId:
      typeof raw.islandId === "string" && raw.islandId.trim() ? raw.islandId.trim() : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  };
}

export function migrateMapScenes(
  raw: Array<Partial<IslandMapScene>> | null | undefined,
): IslandMapScene[] {
  if (!raw?.length) {
    return [];
  }
  const seen = new Set<string>();
  const scenes: IslandMapScene[] = [];
  for (const entry of raw) {
    const next = migrateMapScene(entry);
    if (!next) {
      continue;
    }
    if (seen.has(next.id)) {
      next.id = createId("scn");
    }
    seen.add(next.id);
    scenes.push(next);
  }
  return scenes;
}

const ANCHOR_PERMISSIONS = new Set<LocationAnchorAiPermission>(["never", "suggest", "auto"]);

export function createLocationAnchor(
  description = "",
  tags: string[] = [],
  aiPermission: LocationAnchorAiPermission = "suggest",
  hotspotId?: string,
): LocationAnchor {
  return {
    id: createId("anc"),
    description: description.trim(),
    tags: tags.map((t) => t.trim()).filter(Boolean),
    aiPermission,
    hotspotId,
  };
}

export function migrateLocationAnchor(
  raw: Partial<LocationAnchor> | null | undefined,
): LocationAnchor | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const permission = (typeof raw.aiPermission === "string" ? raw.aiPermission : "suggest") as LocationAnchorAiPermission;
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : createId("anc"),
    description: typeof raw.description === "string" ? raw.description : "",
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
      : [],
    aiPermission: ANCHOR_PERMISSIONS.has(permission) ? permission : "suggest",
    hotspotId:
      typeof raw.hotspotId === "string" && raw.hotspotId.trim() ? raw.hotspotId.trim() : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  };
}

export function migrateLocationAnchors(
  raw: Array<Partial<LocationAnchor>> | null | undefined,
): LocationAnchor[] {
  if (!raw?.length) {
    return [];
  }
  const seen = new Set<string>();
  const anchors: LocationAnchor[] = [];
  for (const entry of raw) {
    const next = migrateLocationAnchor(entry);
    if (!next) {
      continue;
    }
    if (seen.has(next.id)) {
      next.id = createId("anc");
    }
    seen.add(next.id);
    anchors.push(next);
  }
  return anchors;
}

const STORY_NODE_KINDS = new Set<StoryChainNodeKind>([
  "start",
  "end",
  "beat",
  "talk",
  "explore",
  "battle",
  "boss",
  "event",
  "investigate",
  "custom",
]);

export function createStoryChainNode(
  order: number,
  kind: StoryChainNodeKind,
  label?: string,
): StoryChainNode {
  return {
    id: createId("scnnode"),
    order,
    kind,
    label,
  };
}

export function createStoryChain(name: string, islandId?: string, mapAssetId?: string): StoryChain {
  return {
    id: createId("schain"),
    name: name.trim() || "Untitled chain",
    islandId,
    mapAssetId,
    start: {},
    end: {},
    nodes: [
      createStoryChainNode(1, "start", "Start"),
      createStoryChainNode(2, "end", "End"),
    ],
  };
}

export function unplacedStoryChainNodes(chain: StoryChain): StoryChainNode[] {
  return chain.nodes.filter((n) => !n.placedHotspotId).sort((a, b) => a.order - b.order);
}

export function addStoryChainBeat(chain: StoryChain, label?: string): StoryChain {
  const nodes = chain.nodes.map((n) => ({ ...n }));
  const end = nodes.find((n) => n.kind === "end");
  const insertOrder = end ? end.order : nodes.length + 1;
  for (const node of nodes) {
    if (node.order >= insertOrder) {
      node.order += 1;
    }
  }
  nodes.push(createStoryChainNode(insertOrder, "beat", label || `Beat ${insertOrder}`));
  nodes.sort((a, b) => a.order - b.order);
  return { ...chain, nodes };
}

export function migrateStoryChainNode(
  raw: Partial<StoryChainNode> | null | undefined,
  fallbackOrder = 1,
): StoryChainNode | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const kind = (typeof raw.kind === "string" ? raw.kind : "beat") as StoryChainNodeKind;
  const order =
    typeof raw.order === "number" && Number.isFinite(raw.order)
      ? Math.max(1, Math.floor(raw.order))
      : fallbackOrder;
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : createId("scnnode"),
    order,
    kind: STORY_NODE_KINDS.has(kind) ? kind : "custom",
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    placedHotspotId:
      typeof raw.placedHotspotId === "string" && raw.placedHotspotId.trim()
        ? raw.placedHotspotId.trim()
        : undefined,
    locationAnchorId:
      typeof raw.locationAnchorId === "string" && raw.locationAnchorId.trim()
        ? raw.locationAnchorId.trim()
        : undefined,
    editState:
      raw.editState === "generated" || raw.editState === "edited" || raw.editState === "locked"
        ? raw.editState
        : undefined,
    trigger: migrateStoryChainTrigger(raw.trigger),
    generationKey:
      typeof raw.generationKey === "string" && raw.generationKey.trim()
        ? raw.generationKey.trim()
        : undefined,
    suggestedHotspotId:
      typeof raw.suggestedHotspotId === "string" && raw.suggestedHotspotId.trim()
        ? raw.suggestedHotspotId.trim()
        : undefined,
    toIslandId:
      typeof raw.toIslandId === "string" && raw.toIslandId.trim() ? raw.toIslandId.trim() : undefined,
    toMapAssetId:
      typeof raw.toMapAssetId === "string" && raw.toMapAssetId.trim()
        ? raw.toMapAssetId.trim()
        : undefined,
  };
}

const STORY_TRIGGER_KINDS = new Set<StoryChainTriggerKind>([
  "map_icon",
  "suboption",
  "enter_location",
  "screen",
  "time",
  "flag",
  "activity_completed",
  "battle_ended",
  "rest",
  "sailing_event",
]);

const STORY_TRIGGER_TIMES = new Set<TimeOfDay>(["DAWN", "MORNING", "AFTERNOON", "EVENING", "NIGHT"]);

function migrateStoryChainTrigger(
  raw: StoryChainNode["trigger"] | null | undefined,
): StoryChainNode["trigger"] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const kind = (typeof raw.kind === "string" ? raw.kind : "map_icon") as StoryChainTriggerKind;
  const timeOfDay =
    typeof raw.timeOfDay === "string" && STORY_TRIGGER_TIMES.has(raw.timeOfDay as TimeOfDay)
      ? (raw.timeOfDay as TimeOfDay)
      : undefined;
  const day =
    typeof raw.day === "number" && Number.isFinite(raw.day) ? Math.max(0, Math.floor(raw.day)) : undefined;
  return {
    kind: STORY_TRIGGER_KINDS.has(kind) ? kind : "map_icon",
    ref: typeof raw.ref === "string" && raw.ref.trim() ? raw.ref.trim() : undefined,
    childId: typeof raw.childId === "string" && raw.childId.trim() ? raw.childId.trim() : undefined,
    islandId: typeof raw.islandId === "string" && raw.islandId.trim() ? raw.islandId.trim() : undefined,
    mapAssetId:
      typeof raw.mapAssetId === "string" && raw.mapAssetId.trim() ? raw.mapAssetId.trim() : undefined,
    day,
    timeOfDay,
    activityType:
      typeof raw.activityType === "string" && raw.activityType.trim()
        ? raw.activityType.trim()
        : undefined,
  };
}

function migrateStoryChainPayloadStart(raw: Partial<StoryChainStart> | null | undefined): StoryChainStart {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const num = (value: unknown): number | undefined => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(0, Math.floor(value));
  };
  return {
    premise: typeof raw.premise === "string" ? raw.premise : undefined,
    twist: typeof raw.twist === "string" ? raw.twist : undefined,
    dialogueBeats: num(raw.dialogueBeats),
    battlesCount: num(raw.battlesCount),
    bossBattle: typeof raw.bossBattle === "boolean" ? raw.bossBattle : undefined,
    eventsCount: num(raw.eventsCount),
    investigationsCount: num(raw.investigationsCount),
    tone: typeof raw.tone === "string" && raw.tone.trim() ? raw.tone.trim() : undefined,
    importance:
      typeof raw.importance === "number" && Number.isFinite(raw.importance)
        ? Math.max(1, Math.min(5, Math.floor(raw.importance)))
        : undefined,
    restrictions: typeof raw.restrictions === "string" ? raw.restrictions : undefined,
    mustHappen: typeof raw.mustHappen === "string" ? raw.mustHappen : undefined,
    mustNotHappen: typeof raw.mustNotHappen === "string" ? raw.mustNotHappen : undefined,
  };
}

function migrateStoryChainPayloadEnd(raw: Partial<StoryChainEnd> | null | undefined): StoryChainEnd {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const conclusions = Array.isArray(raw.possibleConclusions)
    ? raw.possibleConclusions.map((c) => String(c).trim()).filter(Boolean)
    : undefined;
  const unlocks = raw.unlocks && typeof raw.unlocks === "object" ? raw.unlocks : undefined;
  const effects = raw.effects && typeof raw.effects === "object" ? raw.effects : undefined;
  return {
    resolution: typeof raw.resolution === "string" ? raw.resolution : undefined,
    twist: typeof raw.twist === "string" ? raw.twist : undefined,
    possibleConclusions: conclusions && conclusions.length > 0 ? conclusions : undefined,
    unlocks: unlocks
      ? {
          hotspotId: typeof unlocks.hotspotId === "string" ? unlocks.hotspotId : undefined,
          islandId: typeof unlocks.islandId === "string" ? unlocks.islandId : undefined,
          questId: typeof unlocks.questId === "string" ? unlocks.questId : undefined,
          npcId: typeof unlocks.npcId === "string" ? unlocks.npcId : undefined,
        }
      : undefined,
    effects: effects
      ? {
          world: typeof effects.world === "string" ? effects.world : undefined,
          relationship: typeof effects.relationship === "string" ? effects.relationship : undefined,
          faction: typeof effects.faction === "string" ? effects.faction : undefined,
          legacy: typeof effects.legacy === "string" ? effects.legacy : undefined,
          worldNews: typeof effects.worldNews === "string" ? effects.worldNews : undefined,
          title: typeof effects.title === "string" ? effects.title : undefined,
        }
      : undefined,
  };
}

export function migrateStoryChain(raw: Partial<StoryChain> | null | undefined): StoryChain | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const nodes = (raw.nodes ?? [])
    .map((entry, index) => migrateStoryChainNode(entry, index + 1))
    .filter((n): n is StoryChainNode => Boolean(n));
  nodes.sort((a, b) => a.order - b.order);
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.id)) {
      node.id = createId("scnnode");
    }
    seen.add(node.id);
  }
  if (!nodes.some((n) => n.kind === "start")) {
    nodes.unshift(createStoryChainNode(1, "start", "Start"));
    for (let i = 1; i < nodes.length; i += 1) {
      nodes[i].order = i + 1;
    }
  }
  if (!nodes.some((n) => n.kind === "end")) {
    nodes.push(createStoryChainNode(nodes.length + 1, "end", "End"));
  }
  nodes.forEach((n, i) => {
    n.order = i + 1;
  });
  return {
    id: raw.id && String(raw.id).trim() ? String(raw.id) : createId("schain"),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Untitled chain",
    islandId:
      typeof raw.islandId === "string" && raw.islandId.trim() ? raw.islandId.trim() : undefined,
    mapAssetId:
      typeof raw.mapAssetId === "string" && raw.mapAssetId.trim() ? raw.mapAssetId.trim() : undefined,
    start: migrateStoryChainPayloadStart(raw.start),
    end: migrateStoryChainPayloadEnd(raw.end),
    nodes,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    generationFingerprint:
      typeof raw.generationFingerprint === "string" && raw.generationFingerprint.trim()
        ? raw.generationFingerprint.trim()
        : undefined,
  };
}

export function migrateStoryChains(
  raw: Array<Partial<StoryChain>> | null | undefined,
): StoryChain[] {
  if (!raw?.length) {
    return [];
  }
  const seen = new Set<string>();
  const chains: StoryChain[] = [];
  for (const entry of raw) {
    const next = migrateStoryChain(entry);
    if (!next) {
      continue;
    }
    if (seen.has(next.id)) {
      next.id = createId("schain");
    }
    seen.add(next.id);
    chains.push(next);
  }
  return chains;
}

/** Summarize whether any stage is a battle for editor panel badges. */
export function hotspotHasBattleStage(stages?: HotspotStage[] | null): boolean {
  return Boolean(stages?.some((s) => s.battle || s.kind === "BATTLE"));
}

export const HOTSPOT_HANDLER_TYPE_OPTIONS: Array<{ value: HotspotHandlerType; label: string }> = [
  { value: "ANY", label: "Anyone" },
  { value: "NPC", label: "NPC / world character" },
  { value: "CREW", label: "Crewmate" },
  { value: "FACTION", label: "Faction" },
];

export const HOTSPOT_HANDLER_FACTION_OPTIONS: Array<{
  value: RelationFactionId | NpcFaction;
  label: string;
}> = [
  { value: "MARINES", label: "Marines" },
  { value: "PIRATES", label: "Pirates" },
  { value: "WORLD_GOVERNMENT", label: "World Government" },
  { value: "CIVILIANS", label: "Civilians" },
  { value: "REVOLUTIONARY_ARMY", label: "Revolutionary Army" },
  { value: "PIRATE", label: "Pirate (NPC)" },
  { value: "MARINE", label: "Marine (NPC)" },
  { value: "CIVILIAN", label: "Civilian (NPC)" },
  { value: "UNDERWORLD", label: "Underworld (NPC)" },
];

/** Curated / catalog picker entries for questOrEventId by kind. */
export function listEditorQuestOrEventOptions(
  kind: HotspotQuestKind,
  run?: RunState | null,
): Array<{ id: string; label: string }> {
  if (kind === "STORY_THREAD") {
    return STORY_THREAD_TEMPLATES.map((t) => ({ id: t.id, label: `${t.title} (${t.id})` }));
  }
  if (kind === "FACTION_MISSION") {
    const live = (run?.factionMissions ?? []).map((m) => ({
      id: m.id,
      label: `${m.title} (${m.id})`,
    }));
    const curated = [
      { id: "board_patrol", label: "Board patrol (template)" },
      { id: "escort_cargo", label: "Escort cargo (template)" },
      { id: "investigate_rumor", label: "Investigate rumor (template)" },
      { id: "bounty_lead", label: "Bounty lead (template)" },
    ];
    const seen = new Set(live.map((e) => e.id));
    return [...live, ...curated.filter((c) => !seen.has(c.id))];
  }
  if (kind === "ENCOUNTER" || kind === "EVENT") {
    return ENCOUNTERS.slice(0, 80).map((e) => ({
      id: e.id,
      label: `${e.title ?? e.id} (${e.id})`,
    }));
  }
  return [];
}

export function listEditorHandlerNpcOptions(
  run?: RunState | null,
): Array<{ id: string; label: string }> {
  return (run?.world?.characters ?? [])
    .filter((c) => c.alive !== false)
    .slice(0, 60)
    .map((c) => ({
      id: c.id,
      label: `${c.name}${c.epithet ? ` — ${c.epithet}` : ""} (${c.id})`,
    }));
}

export function listEditorHandlerCrewOptions(
  run?: RunState | null,
): Array<{ id: string; label: string }> {
  const chars = new Map((run?.world?.characters ?? []).map((c) => [c.id, c]));
  return (run?.crew ?? []).map((member) => {
    const character = chars.get(member.characterId);
    const name = character?.name ?? member.characterId;
    return {
      id: member.characterId,
      label: `${name} [${member.role}]`,
    };
  });
}

function migrateQuestConfig(
  raw: HotspotQuestConfig | null | undefined,
  facilityId: IslandMapHotspotId,
): HotspotQuestConfig | undefined {
  if (!supportsQuestConfig(facilityId)) {
    return undefined;
  }
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const kind = (raw.kind ?? "CUSTOM") as HotspotQuestKind;
  const handlerType = (raw.handlerType ?? "ANY") as HotspotHandlerType;
  const next: HotspotQuestConfig = { kind, handlerType };
  if (typeof raw.questOrEventId === "string" && raw.questOrEventId.trim()) {
    next.questOrEventId = raw.questOrEventId.trim();
  }
  if (typeof raw.handlerId === "string" && raw.handlerId.trim()) {
    next.handlerId = raw.handlerId.trim();
  }
  if (typeof raw.handlerFaction === "string" && raw.handlerFaction.trim()) {
    next.handlerFaction = raw.handlerFaction as RelationFactionId | NpcFaction;
  }
  return next;
}

/** Normalize legacy hotspot fields into the instance + unlock shape. */
export function migrateHotspot(raw: Partial<IslandFacilityHotspot> & { facilityId: IslandMapHotspotId }): IslandFacilityHotspot {
  const hotspotId = raw.hotspotId && String(raw.hotspotId).trim() ? String(raw.hotspotId) : createId("hs");
  let unlock = raw.unlock ? { ...raw.unlock } : undefined;

  if (!unlock) {
    if (raw.alwaysVisible || raw.unlocked === true) {
      unlock = { mode: "always" };
    } else if (raw.unlockFlag) {
      unlock = { mode: "flag", flag: raw.unlockFlag };
    } else if (raw.visibleWhen?.startsWith("flag:")) {
      unlock = { mode: "flag", flag: raw.visibleWhen.slice(5) };
    } else if (raw.visibleWhen?.startsWith("quest:")) {
      unlock = { mode: "quest", questId: raw.visibleWhen.slice(6) };
    } else if (raw.visibleWhen?.startsWith("explore:")) {
      const n = Number(raw.visibleWhen.slice(8));
      unlock = { mode: "explore_count", exploreCount: Number.isFinite(n) ? n : 1 };
    } else {
      unlock = defaultUnlockRuleFor(raw.facilityId);
    }
  }

  if (unlock.mode === "flag" && !unlock.flag && raw.unlockFlag) {
    unlock.flag = raw.unlockFlag;
  }

  const childOverrides = migrateChildOverrides(raw.childOverrides);
  const questConfig = migrateQuestConfig(raw.questConfig, raw.facilityId);
  const stages = migrateHotspotStages(raw.stages);
  const links = migrateHotspotLinks(raw.links);
  const revealsHotspotIds = migrateRevealsHotspotIds(raw, links);
  const consumeOnUse = migrateConsumeOnUse(raw);
  const sceneId =
    typeof raw.sceneId === "string" && raw.sceneId.trim() ? raw.sceneId.trim() : undefined;
  const notes = typeof raw.notes === "string" ? raw.notes : undefined;
  const purpose =
    typeof raw.purpose === "string" && raw.purpose.trim() ? raw.purpose.trim() : undefined;

  return withMarkerDefaults({
    hotspotId,
    facilityId: raw.facilityId,
    xPct: raw.xPct ?? 50,
    yPct: raw.yPct ?? 50,
    unlock,
    childOverrides: childOverrides.length > 0 ? childOverrides : undefined,
    questConfig,
    sceneId,
    links: links.length > 0 ? links : undefined,
    stages: stages.length > 0 ? stages : undefined,
    revealsHotspotIds,
    consumeOnUse: consumeOnUse === true ? true : undefined,
    notes,
    purpose,
    alwaysVisible: raw.alwaysVisible,
    unlocked: raw.unlocked,
    unlockFlag: raw.unlockFlag ?? (unlock.mode === "flag" ? unlock.flag : undefined),
    visibleWhen: raw.visibleWhen,
    hidden: raw.hidden,
  });
}

function migrateChildOverrides(
  raw: HotspotChildOverride[] | null | undefined,
): HotspotChildOverride[] {
  if (!raw?.length) {
    return [];
  }
  const seen = new Set<string>();
  const next: HotspotChildOverride[] = [];
  for (const entry of raw) {
    const childId = typeof entry?.childId === "string" ? entry.childId.trim() : "";
    if (!childId || seen.has(childId)) {
      continue;
    }
    seen.add(childId);
    const override: HotspotChildOverride = { childId };
    if (typeof entry.included === "boolean") {
      override.included = entry.included;
    }
    if (entry.unlock && typeof entry.unlock === "object" && entry.unlock.mode) {
      override.unlock = { ...entry.unlock };
    }
    next.push(override);
  }
  return next;
}

export function migrateHotspotList(
  hotspots: Array<Partial<IslandFacilityHotspot> & { facilityId: IslandMapHotspotId }> | null | undefined,
): IslandFacilityHotspot[] {
  if (!hotspots?.length) {
    return [];
  }
  const seen = new Set<string>();
  return hotspots.map((h) => {
    let next = migrateHotspot(h);
    if (seen.has(next.hotspotId)) {
      next = { ...next, hotspotId: createId("hs") };
    }
    seen.add(next.hotspotId);
    return next;
  });
}

/**
 * Ensure `island.mapLayouts` exists and migrate legacy `facilityHotspots`
 * into the slot for the current `mapAssetId` (SAVE_VERSION 28+).
 * Preserves scenes on each layout (SAVE_VERSION 29).
 * Preserves location anchors and story chains (SAVE_VERSION 31+ / 32 / 33).
 */
export function migrateIslandMapLayouts(island: Island): Island {
  island.mapLayouts = island.mapLayouts ?? {};
  const layouts = island.mapLayouts;

  for (const [key, layout] of Object.entries(layouts)) {
    if (!layout || typeof layout !== "object") {
      delete layouts[key];
      continue;
    }
    const scenes = migrateMapScenes(layout.scenes);
    const locationAnchors = migrateLocationAnchors(layout.locationAnchors);
    const storyChains = migrateStoryChains(layout.storyChains);
    layouts[key] = {
      hotspots: migrateHotspotList(layout.hotspots ?? []),
      scenes: scenes.length > 0 ? scenes : undefined,
      locationAnchors: locationAnchors.length > 0 ? locationAnchors : undefined,
      storyChains: storyChains.length > 0 ? storyChains : undefined,
    };
  }

  const legacy = migrateHotspotList(island.facilityHotspots ?? []);
  const mapKey = island.mapAssetId && String(island.mapAssetId).trim() ? String(island.mapAssetId) : null;

  if (legacy.length > 0 && mapKey && !(mapKey in layouts)) {
    // First-time migration only: do not revive layouts that were explicitly cleared.
    layouts[mapKey] = { hotspots: legacy };
  }

  if (mapKey) {
    island.facilityHotspots = layouts[mapKey]?.hotspots ?? [];
  } else if (legacy.length > 0) {
    island.facilityHotspots = legacy;
  } else {
    island.facilityHotspots = island.facilityHotspots ?? [];
  }

  return island;
}

/** Read scenes for a specific map asset. */
export function getMapLayoutScenes(
  island: Island | null | undefined,
  mapAssetId: string | null | undefined,
): IslandMapScene[] {
  if (!island || !mapAssetId) {
    return [];
  }
  return migrateMapScenes(island.mapLayouts?.[mapAssetId]?.scenes);
}

export function getMapLayoutAnchors(
  island: Island | null | undefined,
  mapAssetId: string | null | undefined,
): LocationAnchor[] {
  if (!island || !mapAssetId) {
    return [];
  }
  return migrateLocationAnchors(island.mapLayouts?.[mapAssetId]?.locationAnchors);
}

export function getMapLayoutStoryChains(
  island: Island | null | undefined,
  mapAssetId: string | null | undefined,
): StoryChain[] {
  if (!island || !mapAssetId) {
    return [];
  }
  return migrateStoryChains(island.mapLayouts?.[mapAssetId]?.storyChains);
}

/** Read hotspots for a specific map asset (island override → empty). */
export function getMapLayoutHotspots(
  island: Island | null | undefined,
  mapAssetId: string | null | undefined,
): IslandFacilityHotspot[] {
  if (!island || !mapAssetId) {
    return [];
  }
  const fromLayout = island.mapLayouts?.[mapAssetId]?.hotspots;
  if (fromLayout) {
    return migrateHotspotList(fromLayout);
  }
  // Legacy saves: facilityHotspots only apply to the map they were authored for.
  // After SAVE_VERSION 28 migration they live in mapLayouts; do not invent cross-map reuse.
  if (
    island.mapAssetId === mapAssetId &&
    island.facilityHotspots?.length &&
    (!island.mapLayouts || Object.keys(island.mapLayouts).length === 0)
  ) {
    return migrateHotspotList(island.facilityHotspots);
  }
  return [];
}

/** Write hotspots into one map's layout slot; mirrors onto facilityHotspots when current. */
export function setMapLayoutHotspots(
  island: Island,
  mapAssetId: string | null | undefined,
  hotspots: IslandFacilityHotspot[],
  scenes?: IslandMapScene[] | null,
  extras?: IslandMapLayoutExtras,
): void {
  const migrated = migrateHotspotList(hotspots);
  island.mapLayouts = island.mapLayouts ?? {};
  if (!mapAssetId) {
    island.facilityHotspots = migrated;
    return;
  }
  const prev = island.mapLayouts[mapAssetId];
  const nextScenes =
    scenes !== undefined && scenes !== null
      ? migrateMapScenes(scenes)
      : migrateMapScenes(prev?.scenes);
  const nextAnchors =
    extras && extras.locationAnchors !== undefined
      ? migrateLocationAnchors(extras.locationAnchors)
      : migrateLocationAnchors(prev?.locationAnchors);
  const nextChains =
    extras && extras.storyChains !== undefined
      ? migrateStoryChains(extras.storyChains)
      : migrateStoryChains(prev?.storyChains);
  island.mapLayouts[mapAssetId] = {
    hotspots: migrated,
    scenes: nextScenes.length > 0 ? nextScenes : undefined,
    locationAnchors: nextAnchors.length > 0 ? nextAnchors : undefined,
    storyChains: nextChains.length > 0 ? nextChains : undefined,
  };
  if (island.mapAssetId === mapAssetId || !island.mapAssetId) {
    island.facilityHotspots = migrated;
  }
}

/** Apply default alwaysVisible / unlockFlag / hotspotId from special marker defs. */
export function withMarkerDefaults(hotspot: IslandFacilityHotspot): IslandFacilityHotspot {
  const hotspotId = hotspot.hotspotId && String(hotspot.hotspotId).trim() ? hotspot.hotspotId : createId("hs");
  const unlock = hotspot.unlock ?? defaultUnlockRuleFor(hotspot.facilityId);
  const stages = hotspot.stages?.length ? migrateHotspotStages(hotspot.stages) : undefined;
  const links = hotspot.links?.length ? migrateHotspotLinks(hotspot.links) : undefined;
  const revealsHotspotIds =
    hotspot.revealsHotspotIds?.length
      ? [...new Set(hotspot.revealsHotspotIds.map((id) => String(id).trim()).filter(Boolean))]
      : undefined;
  const consumeOnUse = hotspot.consumeOnUse === true ? true : undefined;
  if (!isSpecialMarkerId(hotspot.facilityId)) {
    return {
      ...hotspot,
      hotspotId,
      unlock,
      questConfig: hotspot.questConfig,
      sceneId: hotspot.sceneId,
      links,
      stages,
      revealsHotspotIds,
      consumeOnUse,
      notes: hotspot.notes,
      purpose: hotspot.purpose,
      xPct: clampPct(hotspot.xPct),
      yPct: clampPct(hotspot.yPct),
      alwaysVisible: unlock.mode === "always" ? true : hotspot.alwaysVisible,
    };
  }
  const def = SPECIAL_MARKER_DEFS[hotspot.facilityId];
  return {
    ...hotspot,
    hotspotId,
    unlock,
    questConfig: hotspot.questConfig,
    sceneId: hotspot.sceneId,
    links,
    stages,
    revealsHotspotIds,
    consumeOnUse,
    notes: hotspot.notes,
    purpose: hotspot.purpose,
    xPct: clampPct(hotspot.xPct),
    yPct: clampPct(hotspot.yPct),
    alwaysVisible: hotspot.alwaysVisible ?? def.alwaysVisible ?? unlock.mode === "always",
    unlockFlag:
      hotspot.unlockFlag ??
      (unlock.mode === "flag" ? unlock.flag : undefined) ??
      def.defaultUnlockFlag,
  };
}

function flagPresent(run: RunState | null | undefined, island: Island | null | undefined, flag: string): boolean {
  if (!flag) {
    return false;
  }
  if (island?.discoveryFlags?.includes(flag)) {
    return true;
  }
  if (run?.runFlags?.includes(flag)) {
    return true;
  }
  if (run?.world?.flags?.includes(flag)) {
    return true;
  }
  if (run?.player?.flags?.includes(flag)) {
    return true;
  }
  return false;
}

function questPresent(run: RunState | null | undefined, questId: string): boolean {
  if (!questId) {
    return false;
  }
  if (flagPresent(run, undefined, questId)) {
    return true;
  }
  if (
    run?.storyThreads?.some(
      (t) => t.id === questId || t.templateId === questId || t.title === questId,
    )
  ) {
    return true;
  }
  return false;
}

export function unlockRuleSatisfied(
  unlock: HotspotUnlockRule,
  island: Island,
  run?: RunState | null,
): boolean {
  switch (unlock.mode) {
    case "always":
      return true;
    case "explore_count": {
      const need = Math.max(1, unlock.exploreCount ?? 1);
      return (island.exploreCount ?? 0) >= need;
    }
    case "flag":
      return flagPresent(run, island, unlock.flag ?? "");
    case "quest": {
      const id = unlock.questId ?? unlock.flag ?? "";
      return questPresent(run, id) || flagPresent(run, island, id);
    }
    default:
      return false;
  }
}

/**
 * Whether a hotspot should appear in play mode.
 * Editor mode should ignore this and show all placed icons.
 */
export function isHotspotVisibleInPlay(
  hotspot: IslandFacilityHotspot,
  island: Island,
  run?: RunState | null,
  unlockedFacilityIds?: ReadonlySet<IslandFacilityId>,
): boolean {
  if (hotspot.hidden) {
    return false;
  }

  const id = hotspot.facilityId;
  const unlock = hotspot.unlock ?? defaultUnlockRuleFor(id);

  if (isFacilityHotspotId(id)) {
    const unlocked =
      unlockedFacilityIds ??
      new Set((island.facilities ?? []).filter((f) => f.unlocked).map((f) => f.id));
    if (!unlocked.has(id)) {
      return false;
    }
  }

  // Prefer structured unlock rule.
  if (hotspot.unlock) {
    return unlockRuleSatisfied(hotspot.unlock, island, run);
  }

  if (hotspot.alwaysVisible || (isSpecialMarkerId(id) && SPECIAL_MARKER_DEFS[id].alwaysVisible)) {
    return true;
  }

  if (hotspot.unlocked === true) {
    return true;
  }

  if (hotspot.unlockFlag && flagPresent(run, island, hotspot.unlockFlag)) {
    return true;
  }

  if (hotspot.visibleWhen) {
    if (hotspot.visibleWhen.startsWith("flag:")) {
      return flagPresent(run, island, hotspot.visibleWhen.slice(5));
    }
    if (hotspot.visibleWhen.startsWith("quest:")) {
      return questPresent(run, hotspot.visibleWhen.slice(6));
    }
    if (hotspot.visibleWhen.startsWith("explore:")) {
      const n = Number(hotspot.visibleWhen.slice(8));
      return (island.exploreCount ?? 0) >= (Number.isFinite(n) ? n : 1);
    }
    if (hotspot.visibleWhen.startsWith("facility:")) {
      const facilityId = hotspot.visibleWhen.slice(9) as IslandFacilityId;
      const unlocked =
        unlockedFacilityIds ??
        new Set((island.facilities ?? []).filter((f) => f.unlocked).map((f) => f.id));
      return unlocked.has(facilityId);
    }
  }

  if (isSpecialMarkerId(id)) {
    const def = SPECIAL_MARKER_DEFS[id];
    if (def.alwaysVisible) {
      return true;
    }
    const flag = hotspot.unlockFlag ?? def.defaultUnlockFlag;
    if (flag) {
      return flagPresent(run, island, flag);
    }
    return Boolean(hotspot.unlocked);
  }

  return unlockRuleSatisfied(unlock, island, run);
}

/**
 * Resolve hotspots for display: island overrides → authored map defaults → auto-layout.
 * Includes EXPLORE by default. Pass `forEditor: true` to keep locked/hidden placements.
 * Multiple instances of the same facilityId are preserved.
 *
 * **Authored layouts are sticky:** when the island has a non-empty saved layout for this
 * map, missing unlocked facilities are NOT auto-recreated (Remove + Save must stick).
 * Auto-layout of missing facilities only runs when bootstrapping (no island layout yet:
 * empty overrides → map defaults / full auto-layout). Re-place from the editor palette
 * to put a removed facility back on the map.
 */
export function resolveFacilityHotspots(
  mapAssetId: string | null | undefined,
  facilityIds: IslandFacilityId[],
  islandHotspots?: IslandFacilityHotspot[] | null,
  options?: {
    forEditor?: boolean;
    island?: Island;
    run?: RunState | null;
  },
): IslandFacilityHotspot[] {
  const wantedFacilities = new Set(facilityIds);
  const forEditor = Boolean(options?.forEditor);

  const takeSource = (source: IslandFacilityHotspot[]): IslandFacilityHotspot[] => {
    return migrateHotspotList(source).filter((h) => {
      if (isFacilityHotspotId(h.facilityId)) {
        return forEditor || wantedFacilities.has(h.facilityId);
      }
      return true;
    });
  };

  let resolved: IslandFacilityHotspot[] = [];
  const fromIsland = takeSource(islandHotspots ?? []);
  /** Non-empty island layout = user (or prior save) authored placements; respect omissions. */
  const hasAuthoredLayout = fromIsland.length > 0;
  if (hasAuthoredLayout) {
    resolved = fromIsland;
  } else {
    const defaults =
      mapAssetId && isKnownIslandMapAssetId(mapAssetId) ? DEFAULT_MAP_HOTSPOTS[mapAssetId] : undefined;
    if (defaults?.length) {
      resolved = takeSource(defaults);
    }
  }

  // Only fill gaps when there is no saved layout yet (first paint / cleared overrides).
  // Never re-add facilities the editor explicitly Removed from an authored layout.
  if (!hasAuthoredLayout) {
    const haveFacility = new Set(
      resolved.filter((h) => isFacilityHotspotId(h.facilityId)).map((h) => h.facilityId),
    );
    const missingFacilities = facilityIds.filter((id) => !haveFacility.has(id));
    if (missingFacilities.length > 0) {
      const extras =
        resolved.length === 0
          ? autoLayoutHotspots(missingFacilities)
          : autoLayoutHotspots(missingFacilities).map((h, i) => ({
              ...h,
              xPct: clampPct(12 + (i % 4) * 8),
              yPct: clampPct(14 + Math.floor(i / 4) * 10),
            }));
      resolved = [...resolved, ...extras];
    }
  }

  if (!resolved.some((h) => h.facilityId === "EXPLORE")) {
    resolved = [
      ...resolved,
      withMarkerDefaults({
        hotspotId: createId("hs"),
        facilityId: "EXPLORE",
        xPct: 50,
        yPct: 82,
        unlock: { mode: "always" },
        alwaysVisible: true,
      }),
    ];
  }

  if (forEditor || !options?.island) {
    return resolved;
  }

  const unlockedSet = new Set(facilityIds);
  return resolved.filter((h) => isHotspotVisibleInPlay(h, options.island!, options.run, unlockedSet));
}

export function exportHotspotsJson(
  mapAssetId: string,
  hotspots: IslandFacilityHotspot[],
  allLayouts?: Record<string, IslandMapLayout> | null,
  draftScenes?: IslandMapScene[] | null,
  extras?: IslandMapLayoutExtras,
): string {
  const serializeHotspot = (h: IslandFacilityHotspot): IslandFacilityHotspot => {
    const normalized = withMarkerDefaults(h);
    const base: IslandFacilityHotspot = {
      hotspotId: normalized.hotspotId,
      facilityId: normalized.facilityId,
      xPct: clampPct(normalized.xPct),
      yPct: clampPct(normalized.yPct),
    };
    if (normalized.unlock) {
      base.unlock = { ...normalized.unlock };
    }
    if (normalized.alwaysVisible) {
      base.alwaysVisible = true;
    }
    if (normalized.unlocked != null) {
      base.unlocked = normalized.unlocked;
    }
    if (normalized.unlockFlag) {
      base.unlockFlag = normalized.unlockFlag;
    }
    if (normalized.visibleWhen) {
      base.visibleWhen = normalized.visibleWhen;
    }
    if (normalized.hidden) {
      base.hidden = true;
    }
    if (normalized.childOverrides?.length) {
      base.childOverrides = normalized.childOverrides.map((o) => ({
        ...o,
        unlock: o.unlock ? { ...o.unlock } : undefined,
      }));
    }
    if (normalized.questConfig) {
      base.questConfig = { ...normalized.questConfig };
    }
    if (normalized.sceneId) {
      base.sceneId = normalized.sceneId;
    }
    if (normalized.links?.length) {
      base.links = normalized.links.map((l) => ({ ...l }));
    }
    if (normalized.stages?.length) {
      base.stages = normalized.stages.map((s) => ({
        ...s,
        payload: s.payload ? { ...s.payload } : undefined,
      }));
    }
    if (normalized.revealsHotspotIds?.length) {
      base.revealsHotspotIds = [...normalized.revealsHotspotIds];
    }
    if (normalized.consumeOnUse) {
      base.consumeOnUse = true;
    }
    if (normalized.notes != null && normalized.notes !== "") {
      base.notes = normalized.notes;
    }
    if (normalized.purpose) {
      base.purpose = normalized.purpose;
    }
    return base;
  };

  const mapLayouts: Record<string, IslandMapLayout> = {};
  if (allLayouts) {
    for (const [key, layout] of Object.entries(allLayouts)) {
      const scenes = migrateMapScenes(layout.scenes);
      const locationAnchors = migrateLocationAnchors(layout.locationAnchors);
      const storyChains = migrateStoryChains(layout.storyChains);
      mapLayouts[key] = {
        hotspots: migrateHotspotList(layout.hotspots ?? []).map(serializeHotspot),
        scenes: scenes.length > 0 ? scenes : undefined,
        locationAnchors: locationAnchors.length > 0 ? locationAnchors : undefined,
        storyChains: storyChains.length > 0 ? storyChains : undefined,
      };
    }
  }
  const currentScenes = migrateMapScenes(
    draftScenes ?? mapLayouts[mapAssetId]?.scenes ?? allLayouts?.[mapAssetId]?.scenes,
  );
  const currentAnchors = migrateLocationAnchors(
    extras?.locationAnchors ?? mapLayouts[mapAssetId]?.locationAnchors ?? allLayouts?.[mapAssetId]?.locationAnchors,
  );
  const currentChains = migrateStoryChains(
    extras?.storyChains ?? mapLayouts[mapAssetId]?.storyChains ?? allLayouts?.[mapAssetId]?.storyChains,
  );
  mapLayouts[mapAssetId] = {
    hotspots: hotspots.map(serializeHotspot),
    scenes: currentScenes.length > 0 ? currentScenes : undefined,
    locationAnchors: currentAnchors.length > 0 ? currentAnchors : undefined,
    storyChains: currentChains.length > 0 ? currentChains : undefined,
  };

  return JSON.stringify(
    {
      mapAssetId,
      mapLayouts,
      /** @deprecated Prefer mapLayouts[mapAssetId].hotspots for DEFAULT_MAP_HOTSPOTS paste. */
      facilityHotspots: mapLayouts[mapAssetId].hotspots,
    },
    null,
    2,
  );
}

/** Build a new placement for the editor palette (always a fresh instance id). */
export function createPalettePlacement(
  id: IslandMapHotspotId,
  xPct = 50,
  yPct = 50,
  unlock?: HotspotUnlockRule,
  childOverrides?: HotspotChildOverride[],
  questConfig?: HotspotQuestConfig,
  extras?: {
    sceneId?: string;
    links?: HotspotLink[];
    stages?: HotspotStage[];
    notes?: string;
    purpose?: string;
    revealsHotspotIds?: string[];
    consumeOnUse?: boolean;
  },
): IslandFacilityHotspot {
  const rule = unlock ?? defaultUnlockRuleFor(id);
  const overrides = migrateChildOverrides(childOverrides);
  const quest =
    questConfig ??
    (supportsQuestConfig(id) ? defaultQuestConfigFor(id) : undefined);
  const stages = extras?.stages?.length ? migrateHotspotStages(extras.stages) : undefined;
  const links = extras?.links?.length ? migrateHotspotLinks(extras.links) : undefined;
  const revealsHotspotIds =
    extras?.revealsHotspotIds?.length
      ? [...new Set(extras.revealsHotspotIds.map((x) => String(x).trim()).filter(Boolean))]
      : undefined;
  return withMarkerDefaults({
    hotspotId: createId("hs"),
    facilityId: id,
    xPct,
    yPct,
    unlock: rule,
    childOverrides: overrides.length > 0 ? overrides : undefined,
    questConfig: quest,
    sceneId: extras?.sceneId,
    links,
    stages,
    revealsHotspotIds,
    consumeOnUse: extras?.consumeOnUse === true ? true : undefined,
    notes: extras?.notes,
    purpose: extras?.purpose,
    alwaysVisible: rule.mode === "always" ? true : undefined,
    unlockFlag: rule.mode === "flag" ? rule.flag : undefined,
  });
}

export function unlockRuleSummary(unlock?: HotspotUnlockRule): string {
  if (!unlock || unlock.mode === "always") {
    return "Always unlocked";
  }
  if (unlock.mode === "explore_count") {
    return `After ${unlock.exploreCount ?? 1} explore(s)`;
  }
  if (unlock.mode === "flag") {
    return `Flag: ${unlock.flag || "—"}`;
  }
  return `Quest: ${unlock.questId || unlock.flag || "—"}`;
}

// --- Parent facility → child action hierarchy ---------------------------------

export type MapChildActionResolve =
  | { type: "hub_choice"; choiceId: string }
  | { type: "overlay"; overlay: "crew" | "inventory" | "harbor" }
  | { type: "stub"; message: string };

export type CatalogChildActionId =
  | "HARBOR_CREW"
  | "HARBOR_SHIP"
  | "HARBOR_INVENTORY"
  | "HARBOR_CARGO"
  | "HARBOR_FLEET"
  | "HARBOR_DEPART"
  | "INN_EAT_DRINK"
  | "INN_REST"
  | "TALK_NPCS"
  | "TRAIN_ASSIGN"
  | "TRAIN_VIEW"
  | "TRAIN_SPAR"
  | "TRAIN_SPECIAL"
  | "TASK_BOUNTIES"
  | "TASK_JOBS"
  | "TASK_DELIVERIES"
  | "TASK_ESCORT"
  | "TASK_MISSING"
  | "TASK_HUNTS"
  | "WEAPON_BUY"
  | "WEAPON_SELL"
  | "CLINIC_MEDICINE"
  | "CLINIC_HEAL"
  | "CLINIC_HOSPITAL"
  | "SHIP_BUY"
  | "SHIP_REPAIR"
  | "SHIP_UPGRADE"
  | "SHIP_SUPPLIES"
  | "SHIP_CUSTOMIZE"
  | "BM_RARE"
  | "BM_CONTRABAND"
  | "BM_INFO"
  | "LIB_BOOKS"
  | "LIB_ASSIGN_READER"
  | "LIB_PROGRESS"
  | "LIB_RESEARCH"
  | "MARINE_MISSIONS"
  | "MARINE_RECRUITS"
  | "MARINE_TURN_IN"
  | "MARINE_SERVICES"
  | "MARINE_INFILTRATE"
  | "AUCTION_VIEW"
  | "AUCTION_INSPECT"
  | "AUCTION_BID"
  | "AUCTION_CURRENT"
  | "AUCTION_SPECIAL";

/** Includes synthetic `HUB_VISIT` for leaf facilities that only expose optional Talk. */
export type MapChildActionId = CatalogChildActionId | "HUB_VISIT";

export type MapChildActionDef = {
  id: MapChildActionId;
  label: string;
  icon: string;
  resolve: MapChildActionResolve;
};

/** Reusable / parent-scoped child actions (icons under `/icons/UI/New`). */
export const MAP_CHILD_ACTIONS: Record<CatalogChildActionId, MapChildActionDef> = {
  HARBOR_CREW: {
    id: "HARBOR_CREW",
    label: "Crew",
    icon: "Map_Crew.png",
    resolve: { type: "overlay", overlay: "crew" },
  },
  HARBOR_SHIP: {
    id: "HARBOR_SHIP",
    label: "Ship",
    icon: "Map_Ship.png",
    resolve: { type: "overlay", overlay: "harbor" },
  },
  HARBOR_INVENTORY: {
    id: "HARBOR_INVENTORY",
    label: "Inventory",
    icon: "Map_Inventory.png",
    resolve: { type: "overlay", overlay: "inventory" },
  },
  HARBOR_CARGO: {
    id: "HARBOR_CARGO",
    label: "Cargo",
    icon: "Map_Cargo.png",
    resolve: { type: "overlay", overlay: "inventory" },
  },
  HARBOR_FLEET: {
    id: "HARBOR_FLEET",
    label: "Fleet",
    icon: "Map_Fleet.png",
    resolve: { type: "stub", message: "Fleet management is not available yet." },
  },
  HARBOR_DEPART: {
    id: "HARBOR_DEPART",
    label: "Depart / World Map",
    icon: "Map_Depart-WorldMap.png",
    resolve: { type: "hub_choice", choiceId: "harbor" },
  },
  INN_EAT_DRINK: {
    id: "INN_EAT_DRINK",
    label: "Eat / Drink",
    icon: "Map_Eat-Drink.png",
    resolve: { type: "hub_choice", choiceId: "inn" },
  },
  INN_REST: {
    id: "INN_REST",
    label: "Rest / Sleep",
    icon: "Map_Rest-Sleep.png",
    resolve: { type: "hub_choice", choiceId: "inn" },
  },
  /** Global reusable Talk action — Inn and other parents can share this id. */
  TALK_NPCS: {
    id: "TALK_NPCS",
    label: "Talk to NPCs",
    icon: "Map_Talk.png",
    resolve: { type: "stub", message: "No one nearby wants to talk." },
  },
  TRAIN_ASSIGN: {
    id: "TRAIN_ASSIGN",
    label: "Assign Training",
    icon: "Map_Training.png",
    resolve: { type: "hub_choice", choiceId: "training" },
  },
  TRAIN_VIEW: {
    id: "TRAIN_VIEW",
    label: "View Training",
    icon: "Map_TrainingGrounds.png",
    resolve: { type: "stub", message: "View Training — coming soon." },
  },
  TRAIN_SPAR: {
    id: "TRAIN_SPAR",
    label: "Spar",
    icon: "Map_Spar.png",
    resolve: { type: "stub", message: "Sparring — coming soon." },
  },
  TRAIN_SPECIAL: {
    id: "TRAIN_SPECIAL",
    label: "Special Training",
    icon: "Map_SpecialTraining.png",
    resolve: { type: "stub", message: "Special Training — coming soon." },
  },
  TASK_BOUNTIES: {
    id: "TASK_BOUNTIES",
    label: "Bounties",
    icon: "Map_Bounties.png",
    resolve: { type: "hub_choice", choiceId: "tasks" },
  },
  TASK_JOBS: {
    id: "TASK_JOBS",
    label: "Jobs",
    icon: "Map_Jobs.png",
    resolve: { type: "hub_choice", choiceId: "tasks" },
  },
  TASK_DELIVERIES: {
    id: "TASK_DELIVERIES",
    label: "Deliveries",
    icon: "Map_Deliveries.png",
    resolve: { type: "hub_choice", choiceId: "tasks" },
  },
  TASK_ESCORT: {
    id: "TASK_ESCORT",
    label: "Escort Missions",
    icon: "Map_EscortMissions.png",
    resolve: { type: "hub_choice", choiceId: "tasks" },
  },
  TASK_MISSING: {
    id: "TASK_MISSING",
    label: "Missing Persons",
    icon: "Map_MissingPersons.png",
    resolve: { type: "stub", message: "Missing Persons — coming soon." },
  },
  TASK_HUNTS: {
    id: "TASK_HUNTS",
    label: "Hunts",
    icon: "Map_Hunts.png",
    resolve: { type: "stub", message: "Hunts — coming soon." },
  },
  WEAPON_BUY: {
    id: "WEAPON_BUY",
    label: "Buy Weapons",
    icon: "Map_WeaponsBuy-Sell.png",
    resolve: { type: "hub_choice", choiceId: "weapon_shop" },
  },
  WEAPON_SELL: {
    id: "WEAPON_SELL",
    label: "Sell Weapons",
    icon: "Map_WeaponsBuy-Sell.png",
    resolve: { type: "hub_choice", choiceId: "weapon_shop" },
  },
  CLINIC_MEDICINE: {
    id: "CLINIC_MEDICINE",
    label: "Buy Medicine",
    icon: "Map_MedicineBuy-Sell.png",
    resolve: { type: "hub_choice", choiceId: "clinic" },
  },
  CLINIC_HEAL: {
    id: "CLINIC_HEAL",
    label: "Heal / Treat Debuffs",
    icon: "Map_Heal-TreatDebuffs.png",
    resolve: { type: "hub_choice", choiceId: "clinic" },
  },
  CLINIC_HOSPITAL: {
    id: "CLINIC_HOSPITAL",
    label: "Hospitalized Crewmates",
    icon: "Map_HospitalizedCrewmates.png",
    resolve: { type: "stub", message: "Hospitalized Crewmates — coming soon." },
  },
  SHIP_BUY: {
    id: "SHIP_BUY",
    label: "Buy Ship",
    icon: "Map_BuySHip.png",
    resolve: { type: "hub_choice", choiceId: "shipyard" },
  },
  SHIP_REPAIR: {
    id: "SHIP_REPAIR",
    label: "Repair Ship",
    icon: "Map_RepairShip.png",
    resolve: { type: "hub_choice", choiceId: "shipyard" },
  },
  SHIP_UPGRADE: {
    id: "SHIP_UPGRADE",
    label: "Ship Upgrades",
    icon: "Map_UpgradeShip.png",
    resolve: { type: "stub", message: "Ship Upgrades — coming soon." },
  },
  SHIP_SUPPLIES: {
    id: "SHIP_SUPPLIES",
    label: "Buy Ship Supplies",
    icon: "Map_SupplyShip.png",
    resolve: { type: "stub", message: "Ship Supplies — coming soon." },
  },
  SHIP_CUSTOMIZE: {
    id: "SHIP_CUSTOMIZE",
    label: "Ship Customization",
    icon: "Map_CustomizeShip.png",
    resolve: { type: "stub", message: "Ship Customization — coming soon." },
  },
  BM_RARE: {
    id: "BM_RARE",
    label: "Rare Goods",
    icon: "Map_BlackMarketBuy-Sell.png",
    resolve: { type: "hub_choice", choiceId: "black_market" },
  },
  BM_CONTRABAND: {
    id: "BM_CONTRABAND",
    label: "Contraband",
    icon: "Map_BlackMarketContraband.png",
    resolve: { type: "hub_choice", choiceId: "black_market" },
  },
  BM_INFO: {
    id: "BM_INFO",
    label: "Information",
    icon: "Map_BlackMarketInformation.png",
    resolve: { type: "stub", message: "Black Market Information — coming soon." },
  },
  LIB_BOOKS: {
    id: "LIB_BOOKS",
    label: "Buy Books",
    icon: "Map_BooksBuy-Sell.png",
    resolve: { type: "hub_choice", choiceId: "library" },
  },
  LIB_ASSIGN_READER: {
    id: "LIB_ASSIGN_READER",
    label: "Assign Reader",
    icon: "Map_AssignReader-Progress.png",
    resolve: { type: "hub_choice", choiceId: "library" },
  },
  LIB_PROGRESS: {
    id: "LIB_PROGRESS",
    label: "Reading Progress",
    icon: "Map_AssignReader-Progress.png",
    resolve: { type: "stub", message: "Reading Progress — coming soon." },
  },
  LIB_RESEARCH: {
    id: "LIB_RESEARCH",
    label: "Research / Knowledge",
    icon: "Map_Research-Knowledge.png",
    resolve: { type: "hub_choice", choiceId: "library" },
  },
  MARINE_MISSIONS: {
    id: "MARINE_MISSIONS",
    label: "Marine Missions",
    icon: "Map_MarineMissions.png",
    resolve: { type: "hub_choice", choiceId: "marine_base" },
  },
  MARINE_RECRUITS: {
    id: "MARINE_RECRUITS",
    label: "Marine Recruits",
    icon: "Map_MarineRecruits.png",
    resolve: { type: "stub", message: "Marine Recruits — coming soon." },
  },
  MARINE_TURN_IN: {
    id: "MARINE_TURN_IN",
    label: "Turn In Bounties",
    icon: "Map_MarineTurnInBounty.png",
    resolve: { type: "stub", message: "Turn In Bounties — coming soon." },
  },
  MARINE_SERVICES: {
    id: "MARINE_SERVICES",
    label: "Faction Services",
    icon: "Map_MarineFactionServices.png",
    resolve: { type: "hub_choice", choiceId: "marine_base" },
  },
  MARINE_INFILTRATE: {
    id: "MARINE_INFILTRATE",
    label: "Infiltration",
    icon: "Map_MarineInfiltration-SpecialInteraction.png",
    resolve: { type: "stub", message: "Infiltration — coming soon." },
  },
  AUCTION_VIEW: {
    id: "AUCTION_VIEW",
    label: "View Auction",
    icon: "Map_AuctionView.png",
    resolve: { type: "hub_choice", choiceId: "auction" },
  },
  AUCTION_INSPECT: {
    id: "AUCTION_INSPECT",
    label: "Inspect Items",
    icon: "Map_AuctionInspect.png",
    resolve: { type: "hub_choice", choiceId: "auction" },
  },
  AUCTION_BID: {
    id: "AUCTION_BID",
    label: "Place Bid",
    icon: "Map_AuctionBid.png",
    resolve: { type: "hub_choice", choiceId: "auction" },
  },
  AUCTION_CURRENT: {
    id: "AUCTION_CURRENT",
    label: "Current Bids",
    icon: "Map_AuctionView.png",
    resolve: { type: "stub", message: "View Current Bids — coming soon." },
  },
  AUCTION_SPECIAL: {
    id: "AUCTION_SPECIAL",
    label: "Special Auction",
    icon: "Map_AuctionSpecial.png",
    resolve: { type: "stub", message: "Special Auction Events — coming soon." },
  },
};

/** Parent facility → child action ids shown when the parent hotspot is clicked. */
export const FACILITY_CHILD_ACTIONS: Partial<Record<IslandFacilityId, CatalogChildActionId[]>> = {
  HARBOR: ["HARBOR_CREW", "HARBOR_SHIP", "HARBOR_INVENTORY", "HARBOR_CARGO", "HARBOR_FLEET", "HARBOR_DEPART"],
  INN: ["INN_EAT_DRINK", "INN_REST", "TALK_NPCS"],
  TRAINING_GROUNDS: ["TRAIN_ASSIGN", "TRAIN_VIEW", "TRAIN_SPAR", "TRAIN_SPECIAL"],
  TASK_BOARD: ["TASK_BOUNTIES", "TASK_JOBS", "TASK_DELIVERIES", "TASK_ESCORT", "TASK_MISSING", "TASK_HUNTS"],
  WEAPON_SHOP: ["WEAPON_BUY", "WEAPON_SELL"],
  CLINIC: ["CLINIC_MEDICINE", "CLINIC_HEAL", "CLINIC_HOSPITAL"],
  SHIPYARD: ["SHIP_BUY", "SHIP_REPAIR", "SHIP_UPGRADE", "SHIP_SUPPLIES", "SHIP_CUSTOMIZE"],
  BLACK_MARKET: ["BM_RARE", "BM_CONTRABAND", "BM_INFO"],
  LIBRARY: ["LIB_BOOKS", "LIB_ASSIGN_READER", "LIB_PROGRESS", "LIB_RESEARCH"],
  MARINE_BASE: ["MARINE_MISSIONS", "MARINE_RECRUITS", "MARINE_TURN_IN", "MARINE_SERVICES", "MARINE_INFILTRATE"],
  AUCTION_HOUSE: ["AUCTION_VIEW", "AUCTION_INSPECT", "AUCTION_BID", "AUCTION_CURRENT", "AUCTION_SPECIAL"],
};

/**
 * Facilities that may optionally include Talk to NPCs as a child (via childOverrides.included).
 * Inn already lists TALK_NPCS in the default catalog.
 */
export const TALK_OPTIONAL_PARENTS: readonly IslandFacilityId[] = [
  "HARBOR",
  "INN",
  "MARKET",
  "TRAINING_GROUNDS",
  "TASK_BOARD",
  "WEAPON_SHOP",
  "CLINIC",
  "SHIPYARD",
  "BLACK_MARKET",
  "LIBRARY",
  "MARINE_BASE",
  "AUCTION_HOUSE",
];

/** Synthetic enter action when a leaf facility (e.g. Market) only has optional Talk children. */
export const HUB_VISIT_CHILD_ID: MapChildActionId = "HUB_VISIT";

export type EditorChildSlot = {
  childId: CatalogChildActionId;
  label: string;
  /** True when this child is not in the default catalog (must be toggled on). */
  optional: boolean;
  /** Catalog default for inclusion when no override is set. */
  defaultIncluded: boolean;
};

function childOverrideFor(
  hotspot: IslandFacilityHotspot | null | undefined,
  childId: string,
): HotspotChildOverride | undefined {
  return hotspot?.childOverrides?.find((o) => o.childId === childId);
}

/** Default inclusion when no override is present. */
export function defaultChildIncluded(
  facilityId: IslandMapHotspotId,
  childId: CatalogChildActionId,
): boolean {
  if (!isFacilityHotspotId(facilityId)) {
    return false;
  }
  const catalog = FACILITY_CHILD_ACTIONS[facilityId] ?? [];
  if (catalog.includes(childId)) {
    return true;
  }
  // Optional Talk (and any other add-on) defaults off.
  return false;
}

export function isTalkOptionalParent(facilityId: IslandMapHotspotId): boolean {
  return isFacilityHotspotId(facilityId) && TALK_OPTIONAL_PARENTS.includes(facilityId);
}

/** Catalog + optional Talk slots editable in the unlock panel. */
export function editorChildSlotsFor(facilityId: IslandMapHotspotId): EditorChildSlot[] {
  if (!isFacilityHotspotId(facilityId)) {
    return [];
  }
  const catalog = FACILITY_CHILD_ACTIONS[facilityId] ?? [];
  const slots: EditorChildSlot[] = catalog.map((childId) => ({
    childId,
    label: MAP_CHILD_ACTIONS[childId].label,
    optional: false,
    defaultIncluded: true,
  }));
  if (isTalkOptionalParent(facilityId) && !catalog.includes("TALK_NPCS")) {
    slots.push({
      childId: "TALK_NPCS",
      label: MAP_CHILD_ACTIONS.TALK_NPCS.label,
      optional: true,
      defaultIncluded: false,
    });
  }
  return slots;
}

export function isChildIncluded(
  facilityId: IslandMapHotspotId,
  childId: CatalogChildActionId,
  hotspot?: IslandFacilityHotspot | null,
): boolean {
  const override = childOverrideFor(hotspot, childId);
  if (typeof override?.included === "boolean") {
    return override.included;
  }
  return defaultChildIncluded(facilityId, childId);
}

export function childUnlockRule(
  childId: string,
  hotspot?: IslandFacilityHotspot | null,
): HotspotUnlockRule {
  const override = childOverrideFor(hotspot, childId);
  return override?.unlock ?? { mode: "always" };
}

function buildHubVisitAction(facilityId: IslandFacilityId): MapChildActionDef {
  return {
    id: HUB_VISIT_CHILD_ID,
    label: FACILITY_LABELS[facilityId],
    icon: FACILITY_MAP_ICON[facilityId],
    resolve: { type: "hub_choice", choiceId: FACILITY_HUB_CHOICE_ID[facilityId] },
  };
}

/**
 * Resolve radial children for a parent hotspot.
 * Filters by inclusion overrides and unlock rules; injects hub visit when only optionals remain.
 */
export function resolveChildActionsForHotspot(
  hotspot: IslandFacilityHotspot,
  island?: Island | null,
  run?: RunState | null,
  options?: { forEditor?: boolean },
): MapChildActionDef[] {
  const facilityId = hotspot.facilityId;
  if (!isFacilityHotspotId(facilityId)) {
    return [];
  }

  const catalog = FACILITY_CHILD_ACTIONS[facilityId] ?? [];
  const candidateIds: CatalogChildActionId[] = [...catalog];
  if (isTalkOptionalParent(facilityId) && !candidateIds.includes("TALK_NPCS")) {
    candidateIds.push("TALK_NPCS");
  }

  const forEditor = Boolean(options?.forEditor);
  const resolved: MapChildActionDef[] = [];
  for (const childId of candidateIds) {
    if (!isChildIncluded(facilityId, childId, hotspot)) {
      continue;
    }
    if (!forEditor && island) {
      const unlock = childUnlockRule(childId, hotspot);
      if (!unlockRuleSatisfied(unlock, island, run)) {
        continue;
      }
    }
    resolved.push(MAP_CHILD_ACTIONS[childId]);
  }

  const catalogNonTalkIncluded = catalog
    .filter((id) => id !== "TALK_NPCS")
    .some((id) => isChildIncluded(facilityId, id, hotspot));
  const needsHubVisit =
    resolved.length > 0 &&
    !catalogNonTalkIncluded &&
    Boolean(FACILITY_HUB_CHOICE_ID[facilityId]);
  if (needsHubVisit && !resolved.some((a) => a.resolve.type === "hub_choice")) {
    resolved.unshift(buildHubVisitAction(facilityId));
  }

  return resolved;
}

/** Upsert a child override on a list (returns a new array). */
export function upsertChildOverride(
  overrides: HotspotChildOverride[] | undefined,
  next: HotspotChildOverride,
): HotspotChildOverride[] {
  const list = [...(overrides ?? [])];
  const idx = list.findIndex((o) => o.childId === next.childId);
  const compact: HotspotChildOverride = { childId: next.childId };
  if (typeof next.included === "boolean") {
    compact.included = next.included;
  }
  if (next.unlock) {
    compact.unlock = { ...next.unlock };
  }
  // Drop no-op overrides that match defaults (caller may still want explicit unlock).
  if (idx >= 0) {
    list[idx] = compact;
  } else {
    list.push(compact);
  }
  return list;
}

export function childActionsForFacility(facilityId: IslandMapHotspotId): MapChildActionDef[] {
  if (!isFacilityHotspotId(facilityId)) {
    return [];
  }
  const ids = FACILITY_CHILD_ACTIONS[facilityId] ?? [];
  return ids.map((id) => MAP_CHILD_ACTIONS[id]);
}

export function childActionIconSrc(action: MapChildActionDef): string {
  return `${MAP_ICON_DIR}/${action.icon}`;
}

export function hasChildActions(facilityId: IslandMapHotspotId): boolean {
  if (editorChildSlotsFor(facilityId).length > 0) {
    return true;
  }
  return childActionsForFacility(facilityId).length > 0;
}

/** Play-mode: parent opens a radial menu when at least one child is currently visible. */
export function hasVisibleChildActions(
  hotspot: IslandFacilityHotspot,
  island?: Island | null,
  run?: RunState | null,
): boolean {
  return resolveChildActionsForHotspot(hotspot, island, run).length > 0;
}
