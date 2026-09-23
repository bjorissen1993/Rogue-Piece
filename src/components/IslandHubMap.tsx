import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { FishingMinigame } from "./FishingMinigame";
import {
  nearestRadialChildLabel,
  radialOrbitAuraRadius,
  radialOrbitWaveScale,
} from "./islandHubRadialWave";
import { ClinicShopOverlay } from "./ClinicShopOverlay";
import { MarketShopOverlay } from "./MarketShopOverlay";
import { ShipOverlay } from "./ShipOverlay";
import { WeaponTradeShopOverlay } from "./WeaponTradeShopOverlay";
import type {
  EncounterChoice,
  HotspotChildOverride,
  HotspotHandlerType,
  HotspotLink,
  HotspotQuestConfig,
  HotspotQuestKind,
  HotspotStage,
  HotspotStageKind,
  HotspotUnlockMode,
  HotspotUnlockRule,
  Island,
  IslandFacilityHotspot,
  IslandMapHotspotId,
  IslandMapLayoutExtras,
  IslandMapScene,
  LocationAnchor,
  LocationAnchorAiPermission,
  MapAnchorRegion,
  NpcFaction,
  RelationFactionId,
  RunState,
  StoryBeatPlanItem,
  StoryBeatPlanKind,
  StoryChain,
  StoryChainStartHub,
  StoryTriggerEvent,
} from "../models/types";
import type { EncounterChoiceLockMap } from "./encounter/EncounterChoiceGrid";
import { IslandService } from "../services/IslandService";
import { WeaponShopService } from "../services/WeaponShopService";
import {
  StoryChainService,
  STORY_BEAT_PLAN_KIND_OPTIONS,
  STORY_CHAIN_START_HUBS,
  STORY_CHAIN_TONES,
  STORY_CHAIN_TRIGGER_OPTIONS,
  countsFromBeatPlan,
  createBeatPlanItem,
  nestChildForStoryNode,
  proposeBeatOptions,
  resolvedBeatPlan,
  storyChainStructureFingerprint,
} from "../services/StoryChainService";
import {
  childActionIconSrc,
  FACILITY_CHILD_ACTIONS,
  childUnlockRule,
  clampPct,
  createHotspotLink,
  createHotspotStage,
  createMapScene,
  createPalettePlacement,
  defaultQuestConfigFor,
  defaultUnlockRuleFor,
  editorChildSlotsFor,
  exportHotspotsJson,
  addStoryChainBeat,
  clampIconScale,
  createLocationAnchor,
  createMapAnchorRegion,
  createStoryChain,
  createStoryChainNode,
  DEFAULT_MAP_ICON_SCALE,
  facilityIdForStoryChainNode,
  getMapLayoutAnchorRegions,
  getMapLayoutAnchors,
  getMapLayoutHotspots,
  getMapLayoutIconScale,
  getMapLayoutScenes,
  getMapLayoutStoryChains,
  hotspotListKind,
  isThreadBeginMarker,
  hotspotIdsOwnedByStoryChain,
  omitHotspotsAndRefs,
  storyChainEndIsPlaced,
  storyChainStartIsPlaced,
  unplacedStoryChainQueue,
  hasChildActions,
  hasVisibleChildActions,
  HOTSPOT_HANDLER_FACTION_OPTIONS,
  HOTSPOT_HANDLER_TYPE_OPTIONS,
  HOTSPOT_QUEST_KIND_OPTIONS,
  HOTSPOT_STAGE_KIND_OPTIONS,
  hotspotHasBattleStage,
  hotspotHubChoiceId,
  hotspotIconSrc,
  hotspotLabel,
  ISLAND_MAP_ASSET_IDS,
  islandMapSrc,
  isChildIncluded,
  isFacilityHotspotId,
  isBrokenConsumedProbe,
  isHotspotVisibleInPlay,
  playHotspotUsesHubChoice,
  listEditorHandlerCrewOptions,
  listEditorHandlerNpcOptions,
  listEditorQuestOrEventOptions,
  PLACEABLE_PALETTE,
  resolveChildActionsForHotspot,
  resolveFacilityHotspots,
  regionCentroid,
  hotspotAuthorName,
  revealIdsForProbe,
  revealSourcesForHotspot,
  snapPct,
  storyChainNodeOriginLabel,
  supportsQuestConfig,
  supportsConsumeOnUse,
  supportsRevealAuthoring,
  type MapChildActionDef,
  type CatalogChildActionId,
  type HotspotListKind,
  unlockRuleSummary,
  upsertChildOverride,
} from "../data/islandMaps";
import { shipOverlayOpensHold } from "../data/ships";

type IslandHubMapProps = {
  island: Island;
  run?: RunState | null;
  choices: EncounterChoice[];
  lockReasons?: EncounterChoiceLockMap;
  isDev?: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** Host node in the top RunBar for map editor chrome. */
  toolsHost?: HTMLElement | null;
  onChoose: (choiceId: string) => void;
  onSaveHotspots: (
    hotspots: IslandFacilityHotspot[],
    scenes?: IslandMapScene[] | null,
    extras?: IslandMapLayoutExtras,
  ) => void;
  onConsumeHotspot?: (hotspotId: string, revealIds?: string[]) => void;
  onRestoreHotspot?: (hotspotId: string) => void;
  onTalkNpcs?: (parentHotspotId?: string) => string;
  onStoryTrigger?: (event: StoryTriggerEvent) => string | null;
  onResetStoryChain?: (chainId: string) => void;
  onFinishFishing?: (result: import("../services/FishingService").FishingSessionResult) => string;
  onBuyMarketItem?: (itemId: string, quantity?: number) => string;
  onSellMarketItem?: (itemId: string, quantity?: number) => string;
  onBuyClinicItem?: (itemId: string, quantity?: number) => string;
  onSellClinicItem?: (itemId: string, quantity?: number) => string;
  onEnsureWeaponShop?: () => void;
  onBuyWeaponShopItem?: (listingId: string) => string;
  onSellWeaponShopItem?: (instanceId: string) => string;
  onChangeMapAsset?: (mapAssetId: string) => void;
  /** Optional escape hatch to the parchment choice list (manual only). */
  onRequestListFallback?: () => void;
  onOpenCrew?: () => void;
  onOpenInventory?: () => void;
};

type DragState = {
  hotspotId: string;
  pointerId: number;
};

type ChildMenuState = {
  parentHotspotId: string;
  facilityId: IslandMapHotspotId;
  xPct: number;
  yPct: number;
  open: boolean;
};

type RadialOffset = { x: number; y: number };

const SNAP_STEPS = [0, 1, 5] as const;
const CHILD_MENU_CLOSE_MS = 320;

const THREAD_FIELD_EXAMPLES: Record<string, string> = {
  name: "The Missing Tide Chart",
  premise: "A dock clerk vanished after the night watch, leaving a soggy chart marked with an X.",
  twist: "The clerk hid the chart so a Navy patrol would miss a smuggler route.",
  dialogue: "2 — two talk scenes (inn rumor, then a witness on the pier).",
  battles: "1 — a street scrap before you reach the caves.",
  boss: "Check this if the finale is a named brawl, not a small scrap.",
  events: "1 — a sudden storm, a wanted-poster drop, or a festival riot.",
  investigate: "1 — search the clerk's locker or the east cliff caves.",
  tone: "Mystery — rumors first, steel later.",
  importance: "3 is island-sized; 5 is a saga hook that follows you to sea.",
  restrictions: "No killing civilians; keep the Navy from seeing the chart.",
  mustHappen: "Someone admits they moved the clerk's chart.",
  mustNot: "The crew does not sink the patrol cutter.",
  resolution: "The chart is returned, sold, or burned — play picks one.",
  endTwist: "The X is a decoy; the real cache sits under the lighthouse.",
  conclusions: "Return the chart\nSell it to a fixer\nBurn it on the beach",
  unlockHotspot: "Leave blank, or paste a hidden cave icon’s hotspot id.",
  unlockQuest: "tide_chart_debt",
  unlockNpc: "An id from the world-character list, e.g. the clerk’s sister.",
  unlockIsland: "Pick another island only if the trail continues there.",
  world: "The harbor starts checking night watches.",
  relationship: "dock_clerk_sister +2",
  faction: "PIRATES +4",
  legacy: "They once hid a chart from a patrol.",
  worldNews: "A tide chart goes missing on a backwater isle.",
  title: "Chart Thief",
  nestChild: "Leave as Map icon click, or nest this beat on Inn → Talk to NPCs.",
};

function ThreadFieldHelp({
  fieldKey,
  openKey,
  onToggle,
}: {
  fieldKey: string;
  openKey: string | null;
  onToggle: (key: string | null) => void;
}) {
  const example = THREAD_FIELD_EXAMPLES[fieldKey];
  if (!example) {
    return null;
  }
  const open = openKey === fieldKey;
  return (
    <span className="island-hub-field-help">
      <button
        aria-expanded={open}
        aria-label={`Example for ${fieldKey}`}
        className={`island-hub-field-help-btn${open ? " is-open" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle(open ? null : fieldKey);
        }}
        type="button"
      >
        ?
      </button>
      {open ? (
        <span className="island-hub-field-help-pop" role="tooltip">
          <strong>Example</strong>
          {example}
        </span>
      ) : null}
    </span>
  );
}

function ThreadFieldLabel({
  text,
  fieldKey,
  openKey,
  onToggle,
}: {
  text: string;
  fieldKey: string;
  openKey: string | null;
  onToggle: (key: string | null) => void;
}) {
  return (
    <span className="island-hub-field-label-row">
      {text}
      <ThreadFieldHelp fieldKey={fieldKey} onToggle={onToggle} openKey={openKey} />
    </span>
  );
}
/** Play-mode focus zoom when a parent radial menu is open (siblings are hidden). */
export const ISLAND_HUB_FOCUS_ZOOM = 1.22;

const ICON_SPARKLES: Array<{ x: string; y: string; delay: string; dur: string; size: string }> = [
  { x: "-8px", y: "-68px", delay: "0ms", dur: "1100ms", size: "9px" },
  { x: "10px", y: "-62px", delay: "120ms", dur: "980ms", size: "8px" },
  { x: "-14px", y: "-56px", delay: "260ms", dur: "1180ms", size: "7px" },
  { x: "16px", y: "-54px", delay: "60ms", dur: "1040ms", size: "8px" },
  { x: "2px", y: "-76px", delay: "200ms", dur: "1220ms", size: "10px" },
  { x: "-6px", y: "-60px", delay: "380ms", dur: "960ms", size: "7px" },
  { x: "12px", y: "-70px", delay: "160ms", dur: "1080ms", size: "8px" },
  { x: "-12px", y: "-48px", delay: "440ms", dur: "1140ms", size: "7px" },
  { x: "6px", y: "-50px", delay: "320ms", dur: "1000ms", size: "8px" },
];

function HubIconSparkles() {
  return (
    <span aria-hidden className="island-hub-sparkles">
      {ICON_SPARKLES.map((sparkle, index) => (
        <i
          key={index}
          style={
            {
              "--sx": sparkle.x,
              "--sy": sparkle.y,
              "--sdelay": sparkle.delay,
              "--sdur": sparkle.dur,
              "--ssize": sparkle.size,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

type AuthorTab = "explore" | "thread" | "list" | "anchors";
type ListKindFilter = "all" | HotspotListKind;

const AUTHOR_TABS: Array<{ id: AuthorTab; label: string }> = [
  { id: "list", label: "List" },
  { id: "thread", label: "Thread" },
  { id: "explore", label: "Explore" },
  { id: "anchors", label: "Anchors" },
];

const LIST_KIND_FILTERS: Array<{ id: ListKindFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "location", label: "Location" },
  { id: "battle", label: "Battle" },
  { id: "event", label: "Events" },
  { id: "quest", label: "Quest" },
  { id: "explore", label: "Explore" },
  { id: "talk", label: "Talk" },
  { id: "other", label: "Other" },
];

function authorTabForHotspot(id: IslandMapHotspotId): AuthorTab {
  if (id === "LOCATION_ANCHOR") {
    return "anchors";
  }
  if (isThreadBeginMarker(id)) {
    return "thread";
  }
  return "list";
}

type MapPctPoint = { xPct: number; yPct: number };

function closedPolygonAttr(points: MapPctPoint[]): string {
  if (points.length === 0) {
    return "";
  }
  const loop = points.length >= 2 ? [...points, points[0]!] : points;
  return loop.map((p) => `${p.xPct},${p.yPct}`).join(" ");
}

function insertPointOnClosestEdge(
  points: MapPctPoint[],
  xPct: number,
  yPct: number,
): MapPctPoint[] {
  if (points.length < 2) {
    return [...points, { xPct, yPct }];
  }
  let bestIndex = points.length;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b.xPct - a.xPct;
    const dy = b.yPct - a.yPct;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((xPct - a.xPct) * dx + (yPct - a.yPct) * dy) / len2));
    const hx = a.xPct + t * dx;
    const hy = a.yPct + t * dy;
    const dist = Math.hypot(xPct - hx, yPct - hy);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i + 1;
    }
  }
  const next = [...points];
  next.splice(bestIndex, 0, { xPct, yPct });
  return next;
}

function threadTypeLabel(facilityId: IslandMapHotspotId | undefined): string {
  if (!facilityId) {
    return "unplaced";
  }
  const kind = hotspotListKind(facilityId);
  if (kind === "quest" || kind === "event" || kind === "talk") {
    return kind;
  }
  return hotspotLabel(facilityId).toLowerCase();
}

function storyChainStartFacility(
  chain: StoryChain,
  hotspots: IslandFacilityHotspot[],
): IslandMapHotspotId | undefined {
  const start = chain.nodes.find((n) => n.kind === "start");
  if (!start?.placedHotspotId) {
    return undefined;
  }
  return hotspots.find((h) => h.hotspotId === start.placedHotspotId)?.facilityId;
}

type MapFocusPoint = { xPct: number; yPct: number; scale: number };

/**
 * Focus zoom + sibling fade only while a parent radial is open in play mode.
 * Must stay null on fresh hub enter (no menu) so map art + hotspots remain visible.
 */
export function resolveIslandHubMapFocus(
  editing: boolean,
  childMenu: { open: boolean; xPct: number; yPct: number } | null,
): MapFocusPoint | null {
  if (editing || !childMenu?.open) {
    return null;
  }
  return {
    xPct: clampPct(childMenu.xPct),
    yPct: clampPct(childMenu.yPct),
    scale: ISLAND_HUB_FOCUS_ZOOM,
  };
}

function radialRadiusForCount(count: number, iconScale = 1): number {
  return Math.min(70, Math.max(46, 38 + count * 5)) * iconScale;
}

/** Even ring around parent; open arc toward map center when a full circle would clip. */
function computeRadialOffsets(
  count: number,
  xPct: number,
  yPct: number,
  mapWidth: number,
  mapHeight: number,
  iconScale = 1,
  radiusCount = count,
): RadialOffset[] {
  if (count <= 0) {
    return [];
  }
  const radius = radialRadiusForCount(radiusCount, iconScale);
  const cx = (clampPct(xPct) / 100) * mapWidth;
  const cy = (clampPct(yPct) / 100) * mapHeight;
  const pad = radius + 32;
  const fits =
    cx - pad >= 0 && cx + pad <= mapWidth && cy - pad >= 0 && cy + pad <= mapHeight;

  if (fits) {
    return Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }

  const towardCenter = Math.atan2(mapHeight / 2 - cy, mapWidth / 2 - cx);
  const arcSpan = Math.min(Math.PI * 1.55, Math.PI * 0.55 + count * 0.28);
  const start = towardCenter - arcSpan / 2;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = start + t * arcSpan;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

function emptyUnlockDraft(id: IslandMapHotspotId): HotspotUnlockRule {
  return { ...defaultUnlockRuleFor(id) };
}

export function IslandHubMap({
  island,
  run = null,
  choices,
  lockReasons,
  isDev = false,
  editing,
  onEditingChange,
  toolsHost,
  onChoose,
  onSaveHotspots,
  onConsumeHotspot,
  onRestoreHotspot,
  onTalkNpcs,
  onStoryTrigger,
  onResetStoryChain,
  onFinishFishing,
  onBuyMarketItem,
  onSellMarketItem,
  onBuyClinicItem,
  onSellClinicItem,
  onEnsureWeaponShop,
  onBuyWeaponShopItem,
  onSellWeaponShopItem,
  onChangeMapAsset,
  onRequestListFallback,
  onOpenCrew,
  onOpenInventory,
}: IslandHubMapProps) {
  const mapAssetId = island.mapAssetId;
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [snapStep, setSnapStep] = useState<(typeof SNAP_STEPS)[number]>(0);
  const [draftIconScale, setDraftIconScale] = useState(DEFAULT_MAP_ICON_SCALE);
  const [pendingAnchorPlaceId, setPendingAnchorPlaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<IslandFacilityHotspot[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<IslandMapHotspotId | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<HotspotUnlockRule | null>(null);
  const [pendingChildOverrides, setPendingChildOverrides] = useState<HotspotChildOverride[]>([]);
  const [pendingQuestConfig, setPendingQuestConfig] = useState<HotspotQuestConfig | null>(null);
  const [pendingStages, setPendingStages] = useState<HotspotStage[]>([]);
  const [pendingLinks, setPendingLinks] = useState<HotspotLink[]>([]);
  const [pendingRevealsHotspotIds, setPendingRevealsHotspotIds] = useState<string[]>([]);
  const [pendingConsumeOnUse, setPendingConsumeOnUse] = useState(false);
  const [pendingNotes, setPendingNotes] = useState("");
  const [pendingPurpose, setPendingPurpose] = useState("");
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const [draftScenes, setDraftScenes] = useState<IslandMapScene[]>([]);
  const [draftAnchors, setDraftAnchors] = useState<LocationAnchor[]>([]);
  const [draftRegions, setDraftRegions] = useState<MapAnchorRegion[]>([]);
  const [regionDrawMode, setRegionDrawMode] = useState(false);
  const [regionDraftPoints, setRegionDraftPoints] = useState<Array<{ xPct: number; yPct: number }>>(
    [],
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [hideOtherIcons, setHideOtherIcons] = useState(false);
  const [regionPointDrag, setRegionPointDrag] = useState<{
    regionId: string;
    index: number;
    pointerId: number;
  } | null>(null);
  const skipRegionClickRef = useRef(false);
  const [newRegionName, setNewRegionName] = useState("");
  const [draftStoryChains, setDraftStoryChains] = useState<StoryChain[]>([]);
  const [activeChainId, setActiveChainId] = useState<string | null>(null);
  const [newAnchorText, setNewAnchorText] = useState("");
  const [nestPickNodeId, setNestPickNodeId] = useState<string | null>(null);
  const [nestChildId, setNestChildId] = useState<string>("");
  const [showChainDetails, setShowChainDetails] = useState(true);
  const [threadHelpKey, setThreadHelpKey] = useState<string | null>(null);
  const [workshopIndex, setWorkshopIndex] = useState(0);
  const [customPromptDraft, setCustomPromptDraft] = useState("");
  const [threadComposer, setThreadComposer] = useState<"setup" | "workshop" | null>(null);
  const [confirmRemoveChainId, setConfirmRemoveChainId] = useState<string | null>(null);
  const [authorTab, setAuthorTab] = useState<AuthorTab>("list");
  const [listDetailOpen, setListDetailOpen] = useState(false);
  const [threadDetailOpen, setThreadDetailOpen] = useState(false);
  const [expandedExploreId, setExpandedExploreId] = useState<string | null>(null);
  const [listKindFilter, setListKindFilter] = useState<ListKindFilter>("all");
  const enterLocationKey = useRef<string | null>(null);
  const [newSceneName, setNewSceneName] = useState("");
  const [linkPickMode, setLinkPickMode] = useState(false);
  /** When set, map clicks add to this hotspot's `revealsHotspotIds` without changing selection. */
  const [revealPickSourceId, setRevealPickSourceId] = useState<string | null>(null);
  const revealPickMode = revealPickSourceId !== null;
  const [expandedChildId, setExpandedChildId] = useState<CatalogChildActionId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [imgNonce, setImgNonce] = useState(0);
  const [childMenu, setChildMenu] = useState<ChildMenuState | null>(null);
  const [stubNotice, setStubNotice] = useState<string | null>(null);
  const [fishingOpen, setFishingOpen] = useState(false);
  const [marketShopOpen, setMarketShopOpen] = useState(false);
  const [clinicShopOpen, setClinicShopOpen] = useState(false);
  const [weaponShopOpen, setWeaponShopOpen] = useState(false);
  const [shipOverlayOpen, setShipOverlayOpen] = useState(false);
  const [shipOverlayTab, setShipOverlayTab] = useState<"vessel" | "cargo">("vessel");
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [hoveredChildLabel, setHoveredChildLabel] = useState<string | null>(null);
  const [sessionConsumedIds, setSessionConsumedIds] = useState<Set<string>>(() => new Set());
  const [sessionRevealedIds, setSessionRevealedIds] = useState<Set<string>>(() => new Set());
  const childMenuRef = useRef<HTMLDivElement | null>(null);
  const childOrbitRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const radialLabelRef = useRef<string | null>(null);
  const childMenuCloseTimer = useRef<number | null>(null);
  const statusClearTimer = useRef<number | null>(null);
  const stubClearTimer = useRef<number | null>(null);

  const unlocked = useMemo(() => IslandService.listUnlockedFacilities(island), [island]);
  const facilityIds = useMemo(() => unlocked.map((f) => f.id), [unlocked]);
  const unlockedSet = useMemo(() => new Set(facilityIds), [facilityIds]);
  const weaponShopStock = useMemo(() => {
    if (!run) {
      return null;
    }
    const theme = island.weaponShopTheme;
    if (theme) {
      return WeaponShopService.getStock(run, WeaponShopService.shopKey(island.id, theme));
    }
    const shops = Object.values(run.weaponShops ?? {});
    return shops.find((entry) => run.day < entry.refreshOnDay) ?? shops[0] ?? null;
  }, [island.id, island.weaponShopTheme, run]);

  const layoutHotspots = useMemo(
    () => getMapLayoutHotspots(island, mapAssetId),
    [island, mapAssetId],
  );
  const iconScale = editing ? draftIconScale : getMapLayoutIconScale(island, mapAssetId);

  const displayHotspots = useMemo(() => {
    if (editing) {
      return draft;
    }
    return resolveFacilityHotspots(mapAssetId, facilityIds, layoutHotspots, {
      island,
      run,
    });
  }, [editing, draft, mapAssetId, facilityIds, layoutHotspots, island, run]);

  const placedCounts = useMemo(() => {
    const counts = new Map<IslandMapHotspotId, number>();
    for (const h of displayHotspots) {
      counts.set(h.facilityId, (counts.get(h.facilityId) ?? 0) + 1);
    }
    return counts;
  }, [displayHotspots]);

  const choiceById = useMemo(() => {
    const map = new Map<string, EncounterChoice>();
    for (const choice of choices) {
      map.set(choice.id, choice);
    }
    return map;
  }, [choices]);

  useEffect(() => {
    setMapFailed(false);
    onEditingChange(false);
    setDraft([]);
    setSelectedInstanceId(null);
    setPaletteId(null);
    setPendingUnlock(null);
    setPendingChildOverrides([]);
    setPendingQuestConfig(null);
    setPendingStages([]);
    setPendingLinks([]);
    setPendingRevealsHotspotIds([]);
    setPendingConsumeOnUse(false);
    setPendingNotes("");
    setPendingPurpose("");
    setPendingSceneId(null);
    setDraftScenes([]);
    setDraftAnchors([]);
    setDraftRegions([]);
    setRegionDrawMode(false);
    setRegionDraftPoints([]);
    setSelectedRegionId(null);
    setSelectedAnchorId(null);
    setHideOtherIcons(false);
    setRegionPointDrag(null);
    setNewRegionName("");
    setPendingAnchorPlaceId(null);
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setAuthorTab("list");
    setListDetailOpen(false);
    setThreadDetailOpen(false);
    setExpandedExploreId(null);
    setStatus(null);
    setImgNonce(0);
    setChildMenu(null);
    setStubNotice(null);
    setHoveredHotspotId(null);
    setHoveredChildLabel(null);
    setSessionConsumedIds(new Set(island.consumedHotspotIds ?? []));
    setSessionRevealedIds(new Set(island.revealedHotspotIds ?? []));
  }, [island.id, mapAssetId, onEditingChange]);

  useEffect(() => {
    if (!status) {
      return;
    }
    if (statusClearTimer.current != null) {
      window.clearTimeout(statusClearTimer.current);
    }
    statusClearTimer.current = window.setTimeout(() => {
      setStatus(null);
      statusClearTimer.current = null;
    }, 2500);
    return () => {
      if (statusClearTimer.current != null) {
        window.clearTimeout(statusClearTimer.current);
        statusClearTimer.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    if (!stubNotice) {
      return;
    }
    if (stubClearTimer.current != null) {
      window.clearTimeout(stubClearTimer.current);
    }
    stubClearTimer.current = window.setTimeout(() => {
      setStubNotice(null);
      stubClearTimer.current = null;
    }, 6500);
    return () => {
      if (stubClearTimer.current != null) {
        window.clearTimeout(stubClearTimer.current);
        stubClearTimer.current = null;
      }
    };
  }, [stubNotice]);

  const clearChildMenuTimer = useCallback(() => {
    if (childMenuCloseTimer.current != null) {
      window.clearTimeout(childMenuCloseTimer.current);
      childMenuCloseTimer.current = null;
    }
  }, []);

  const resetRadialOrbitWave = useCallback(() => {
    radialLabelRef.current = null;
    for (const node of Object.values(childOrbitRefs.current)) {
      if (!node) {
        continue;
      }
      node.style.setProperty("--orbit-scale", "1");
      node.classList.remove("is-nearest");
    }
    setHoveredChildLabel(null);
  }, []);

  const dismissChildMenuInstant = useCallback(() => {
    clearChildMenuTimer();
    resetRadialOrbitWave();
    setChildMenu(null);
  }, [clearChildMenuTimer, resetRadialOrbitWave]);

  const closeChildMenu = useCallback(() => {
    setChildMenu((prev) => {
      if (!prev) {
        return null;
      }
      if (!prev.open) {
        return prev;
      }
      return { ...prev, open: false };
    });
    clearChildMenuTimer();
    childMenuCloseTimer.current = window.setTimeout(() => {
      resetRadialOrbitWave();
      setChildMenu(null);
      childMenuCloseTimer.current = null;
    }, CHILD_MENU_CLOSE_MS);
  }, [clearChildMenuTimer, resetRadialOrbitWave]);

  const openChildMenu = useCallback(
    (hotspot: IslandFacilityHotspot) => {
      clearChildMenuTimer();
      resetRadialOrbitWave();
      setChildMenu({
        parentHotspotId: hotspot.hotspotId,
        facilityId: hotspot.facilityId,
        xPct: hotspot.xPct,
        yPct: hotspot.yPct,
        open: false,
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setChildMenu((prev) =>
            prev && prev.parentHotspotId === hotspot.hotspotId ? { ...prev, open: true } : prev,
          );
        });
      });
    },
    [clearChildMenuTimer, resetRadialOrbitWave],
  );

  useEffect(() => {
    if (!childMenu || editing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeChildMenu();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [childMenu, editing, closeChildMenu]);

  useEffect(() => {
    if (!editing || (!revealPickMode && !linkPickMode && !nestPickNodeId && !regionDrawMode)) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setRevealPickSourceId(null);
      setLinkPickMode(false);
      setNestPickNodeId(null);
      setRegionDrawMode(false);
      setRegionDraftPoints([]);
      setStatus(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, revealPickMode, linkPickMode, nestPickNodeId, regionDrawMode]);

  useEffect(() => () => clearChildMenuTimer(), [clearChildMenuTimer]);

  const activeChain = draftStoryChains.find((c) => c.id === activeChainId) ?? draftStoryChains[0] ?? null;
  const unplacedNodes = activeChain ? unplacedStoryChainQueue(activeChain) : [];
  const structureKey = activeChain ? storyChainStructureFingerprint(activeChain.start) : "";

  useEffect(() => {
    if (!editing || !activeChain) {
      return;
    }
    if (!activeChain.generationFingerprint) {
      return;
    }
    if (activeChain.generationFingerprint === structureKey) {
      return;
    }
    const handle = window.setTimeout(() => {
      setDraftStoryChains((prev) =>
        prev.map((c) =>
          c.id === activeChain.id
            ? StoryChainService.generateStructure(c, {
                hotspots: draft,
                anchors: draftAnchors,
                regions: draftRegions,
                island,
              })
            : c,
        ),
      );
    }, 400);
    return () => window.clearTimeout(handle);
  }, [editing, activeChain, structureKey, draft, draftAnchors, draftRegions, island]);

  useEffect(() => {
    if (editing || !onStoryTrigger || !island.id) {
      return;
    }
    const key = `${island.id}:${mapAssetId ?? ""}`;
    if (enterLocationKey.current === key) {
      return;
    }
    enterLocationKey.current = key;
    const line = onStoryTrigger({
      kind: "enter_location",
      islandId: island.id,
      mapAssetId: mapAssetId ?? undefined,
    });
    if (line) {
      setStubNotice(line);
    }
  }, [editing, island.id, mapAssetId, onStoryTrigger]);

  const beginEdit = () => {
    setDraft(
      resolveFacilityHotspots(mapAssetId, facilityIds, layoutHotspots, {
        forEditor: true,
        island,
        run,
      }),
    );
    setDraftScenes(getMapLayoutScenes(island, mapAssetId));
    const chains = getMapLayoutStoryChains(island, mapAssetId);
    setDraftAnchors(getMapLayoutAnchors(island, mapAssetId));
    setDraftRegions(getMapLayoutAnchorRegions(island, mapAssetId));
    setDraftIconScale(getMapLayoutIconScale(island, mapAssetId));
    setHideOtherIcons(false);
    setSelectedAnchorId(null);
    setSelectedRegionId(null);
    setRegionDrawMode(false);
    setRegionDraftPoints([]);
    setPendingAnchorPlaceId(null);
    setDraftStoryChains(chains);
    setActiveChainId(chains[0]?.id ?? null);
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    onEditingChange(true);
    setPaletteId(null);
    setPendingUnlock(null);
    setPendingChildOverrides([]);
    setPendingQuestConfig(null);
    setPendingStages([]);
    setPendingLinks([]);
    setPendingRevealsHotspotIds([]);
    setPendingConsumeOnUse(false);
    setPendingNotes("");
    setPendingPurpose("");
    setPendingSceneId(null);
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    dismissChildMenuInstant();
    setAuthorTab("list");
    setListDetailOpen(false);
    setThreadDetailOpen(false);
    setExpandedExploreId(null);
    setStatus("Select an icon, set unlock / stages / links, then click the map to place.");
  };

  const cancelEdit = () => {
    onEditingChange(false);
    setDraft([]);
    setDrag(null);
    setPaletteId(null);
    setPendingUnlock(null);
    setPendingChildOverrides([]);
    setPendingQuestConfig(null);
    setPendingStages([]);
    setPendingLinks([]);
    setPendingRevealsHotspotIds([]);
    setPendingConsumeOnUse(false);
    setPendingNotes("");
    setPendingPurpose("");
    setPendingSceneId(null);
    setDraftScenes([]);
    setDraftAnchors([]);
    setDraftRegions([]);
    setRegionDrawMode(false);
    setRegionDraftPoints([]);
    setSelectedRegionId(null);
    setSelectedAnchorId(null);
    setHideOtherIcons(false);
    setRegionPointDrag(null);
    setNewRegionName("");
    setPendingAnchorPlaceId(null);
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setListDetailOpen(false);
    setThreadDetailOpen(false);
    setExpandedExploreId(null);
    setStatus(null);
  };

  const layoutExtras = (): IslandMapLayoutExtras => ({
    locationAnchors: draftAnchors,
    storyChains: draftStoryChains,
    iconScale: draftIconScale,
    anchorRegions: draftRegions,
  });

  const saveEdit = () => {
    onSaveHotspots(draft, draftScenes, layoutExtras());
    onEditingChange(false);
    setPaletteId(null);
    setPendingUnlock(null);
    setPendingChildOverrides([]);
    setPendingQuestConfig(null);
    setPendingStages([]);
    setPendingLinks([]);
    setPendingRevealsHotspotIds([]);
    setPendingConsumeOnUse(false);
    setPendingNotes("");
    setPendingPurpose("");
    setPendingSceneId(null);
    setDraftScenes([]);
    setDraftAnchors([]);
    setDraftRegions([]);
    setRegionDrawMode(false);
    setRegionDraftPoints([]);
    setSelectedRegionId(null);
    setSelectedAnchorId(null);
    setHideOtherIcons(false);
    setRegionPointDrag(null);
    setNewRegionName("");
    setPendingAnchorPlaceId(null);
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setListDetailOpen(false);
    setThreadDetailOpen(false);
    setExpandedExploreId(null);
    setStatus("Hotspots + scenes saved for this map only.");
  };

  const resetLayout = () => {
    const next = resolveFacilityHotspots(mapAssetId, facilityIds, null, {
      forEditor: true,
      island,
      run,
    });
    setDraft(next);
    setStatus("Reset to map defaults / auto-layout (not saved yet).");
  };

  const clearIslandOverrides = () => {
    onSaveHotspots([], [], { locationAnchors: [], storyChains: [], anchorRegions: [] });
    onEditingChange(false);
    setDraft([]);
    setPaletteId(null);
    setPendingUnlock(null);
    setPendingChildOverrides([]);
    setPendingQuestConfig(null);
    setPendingStages([]);
    setPendingLinks([]);
    setPendingRevealsHotspotIds([]);
    setPendingConsumeOnUse(false);
    setPendingNotes("");
    setPendingPurpose("");
    setPendingSceneId(null);
    setDraftScenes([]);
    setDraftAnchors([]);
    setDraftRegions([]);
    setRegionDrawMode(false);
    setRegionDraftPoints([]);
    setSelectedRegionId(null);
    setSelectedAnchorId(null);
    setHideOtherIcons(false);
    setRegionPointDrag(null);
    setNewRegionName("");
    setPendingAnchorPlaceId(null);
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setListDetailOpen(false);
    setThreadDetailOpen(false);
    setStatus("Cleared overrides for this map — using map defaults.");
  };

  const exportJson = async () => {
    if (!mapAssetId) {
      return;
    }
    const payload = exportHotspotsJson(
      mapAssetId,
      editing ? draft : displayHotspots,
      island.mapLayouts,
      editing ? draftScenes : getMapLayoutScenes(island, mapAssetId),
      editing
        ? layoutExtras()
        : {
            locationAnchors: getMapLayoutAnchors(island, mapAssetId),
            storyChains: getMapLayoutStoryChains(island, mapAssetId),
            anchorRegions: getMapLayoutAnchorRegions(island, mapAssetId),
          },
    );
    try {
      await navigator.clipboard.writeText(payload);
      setStatus("Copied per-map hotspot JSON to clipboard (paste into islandMaps.ts defaults).");
    } catch {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mapAssetId}-hotspots.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Downloaded hotspot JSON.");
    }
  };

  const pointerToPct = useCallback(
    (clientX: number, clientY: number) => {
      const el = mapRef.current;
      if (!el) {
        return { xPct: 50, yPct: 50 };
      }
      const rect = el.getBoundingClientRect();
      const xPct = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const yPct = ((clientY - rect.top) / Math.max(1, rect.height)) * 100;
      return {
        xPct: snapPct(xPct, snapStep),
        yPct: snapPct(yPct, snapStep),
      };
    },
    [snapStep],
  );

  const loadAuthoringFromHotspot = (hs: IslandFacilityHotspot, opts?: { keepTab?: boolean }) => {
    setPaletteId(hs.facilityId);
    setPendingUnlock(hs.unlock ?? emptyUnlockDraft(hs.facilityId));
    setPendingChildOverrides(hs.childOverrides ? [...hs.childOverrides] : []);
    setPendingQuestConfig(
      hs.questConfig ??
        (supportsQuestConfig(hs.facilityId) ? defaultQuestConfigFor(hs.facilityId) ?? null : null),
    );
    setPendingStages(hs.stages ? [...hs.stages] : []);
    setPendingLinks(hs.links ? [...hs.links] : []);
    setPendingRevealsHotspotIds(hs.revealsHotspotIds ? [...hs.revealsHotspotIds] : []);
    setPendingConsumeOnUse(supportsConsumeOnUse(hs.facilityId) || hs.consumeOnUse === true);
    setPendingNotes(hs.notes ?? "");
    setPendingPurpose(hs.purpose ?? "");
    setPendingSceneId(hs.sceneId ?? null);
    setExpandedChildId(null);
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    if (!opts?.keepTab) {
      const nextTab = authorTabForHotspot(hs.facilityId);
      setAuthorTab(nextTab);
      if (nextTab === "list") {
        setListDetailOpen(true);
      }
      if (nextTab === "thread") {
        setThreadDetailOpen(false);
        setThreadComposer(null);
      }
    }
    const owning = draftStoryChains.find((c) => c.nodes.some((n) => n.placedHotspotId === hs.hotspotId));
    if (owning) {
      setActiveChainId(owning.id);
      if (!opts?.keepTab && isThreadBeginMarker(hs.facilityId)) {
        setAuthorTab("thread");
        setThreadDetailOpen(false);
        setThreadComposer(
          owning.generationFingerprint &&
            owning.nodes.some((n) => n.kind !== "start" && n.kind !== "end")
            ? "workshop"
            : "setup",
        );
        setWorkshopIndex(0);
        setCustomPromptDraft("");
      }
    }
  };

  const patchSelectedHotspot = (patch: Partial<IslandFacilityHotspot>) => {
    if (!selectedInstanceId) {
      return;
    }
    setDraft((prev) =>
      prev.map((h) => (h.hotspotId === selectedInstanceId ? { ...h, ...patch } : h)),
    );
  };

  const onHotspotPointerDown = (instanceId: string, event: ReactPointerEvent) => {
    if (!editing) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const hs = draft.find((h) => h.hotspotId === instanceId);
    if (linkPickMode && selectedInstanceId && selectedInstanceId !== instanceId && hs) {
      const link = createHotspotLink({ toHotspotId: instanceId });
      const nextLinks = [...pendingLinks, link];
      setPendingLinks(nextLinks);
      patchSelectedHotspot({ links: nextLinks });
      setLinkPickMode(false);
      setStatus(`Linked → ${hotspotLabel(hs.facilityId)}.`);
      return;
    }
    if (revealPickSourceId) {
      // Stay on the source icon panel; map clicks only add reveal targets.
      // (Add here — pointerdown preventDefault may suppress the click handler.)
      if (instanceId !== revealPickSourceId && hs) {
        const source = draft.find((x) => x.hotspotId === revealPickSourceId);
        const current = source?.revealsHotspotIds ?? pendingRevealsHotspotIds;
        if (!current.includes(instanceId)) {
          const next = [...current, instanceId];
          setDraft((prev) =>
            prev.map((h) =>
              h.hotspotId === revealPickSourceId
                ? { ...h, revealsHotspotIds: next }
                : h,
            ),
          );
          if (selectedInstanceId === revealPickSourceId) {
            setPendingRevealsHotspotIds(next);
          }
          setStatus(`Added reveal → ${hotspotLabel(hs.facilityId)}.`);
        }
      }
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedInstanceId(instanceId);
    if (hs) {
      const keepTab = authorTab === "explore" || authorTab === "thread" || authorTab === "anchors";
      loadAuthoringFromHotspot(hs, { keepTab });
      if (authorTab === "list") {
        setListDetailOpen(true);
      }
      if (hs.facilityId === "LOCATION_ANCHOR") {
        const match = draftAnchors.find((a) => a.hotspotId === hs.hotspotId);
        if (match) {
          setSelectedAnchorId(match.id);
        }
        setAuthorTab("anchors");
        setSelectedRegionId(null);
      }
    }
    setDrag({ hotspotId: instanceId, pointerId: event.pointerId });
  };

  const onMapPointerMove = (event: ReactPointerEvent) => {
    if (!editing) {
      return;
    }
    if (regionPointDrag && event.pointerId === regionPointDrag.pointerId) {
      const { xPct, yPct } = pointerToPct(event.clientX, event.clientY);
      setDraftRegions((prev) =>
        prev.map((r) => {
          if (r.id !== regionPointDrag.regionId) {
            return r;
          }
          return {
            ...r,
            points: r.points.map((p, i) => (i === regionPointDrag.index ? { xPct, yPct } : p)),
          };
        }),
      );
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const { xPct, yPct } = pointerToPct(event.clientX, event.clientY);
    setDraft((prev) =>
      prev.map((h) => (h.hotspotId === drag.hotspotId ? { ...h, xPct, yPct } : h)),
    );
  };

  const endDrag = (event: ReactPointerEvent) => {
    if (regionPointDrag && event.pointerId === regionPointDrag.pointerId) {
      setRegionPointDrag(null);
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    setDrag(null);
  };

  const storyLocationCtx = () => ({
    hotspots: draft,
    anchors: draftAnchors,
    regions: draftRegions,
    island,
  });

  const bindThreadStartToHotspot = (hotspot: IslandFacilityHotspot) => {
    setDraftStoryChains((prev) => {
      let chains = prev;
      let chain = chains.find((c) => c.id === activeChainId) ?? chains[0];
      if (!chain) {
        chain = createStoryChain(
          hotspot.purpose?.trim() || hotspotLabel(hotspot.facilityId),
          island.id,
          mapAssetId ?? undefined,
        );
        chains = [...chains, chain];
      }
      const start = chain.nodes.find((n) => n.kind === "start");
      if (!start || start.placedHotspotId) {
        return chains;
      }
      let next = StoryChainService.nestNode(chain, start.id, {
        hotspotId: hotspot.hotspotId,
        islandId: island.id,
        mapAssetId: mapAssetId ?? undefined,
      });
      next = StoryChainService.generateStructure(next, {
        hotspots: [...draft, hotspot],
        anchors: draftAnchors,
        regions: draftRegions,
        island,
      });
      setActiveChainId(next.id);
      setAuthorTab("thread");
      setThreadDetailOpen(false);
      setThreadComposer("workshop");
      setWorkshopIndex(0);
      setCustomPromptDraft("");
      return chains.some((c) => c.id === next.id)
        ? chains.map((c) => (c.id === next.id ? next : c))
        : [...chains.filter((c) => c.id !== chain.id), next];
    });
    setStatus(`Thread start nested on ${hotspotLabel(hotspot.facilityId)}. Fill Start fields to generate End.`);
  };

  const placeStoryFicheOnMap = (nodeId: string, clientX: number, clientY: number) => {
    if (!activeChain) {
      return;
    }
    const node = activeChain.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }
    const { xPct, yPct } = pointerToPct(clientX, clientY);
    const facilityId = facilityIdForStoryChainNode(activeChain, node);
    const placed = createPalettePlacement(
      facilityId,
      xPct,
      yPct,
      emptyUnlockDraft(facilityId),
      undefined,
      supportsQuestConfig(facilityId) ? defaultQuestConfigFor(facilityId) : undefined,
      { purpose: node.label || node.kind },
    );
    setDraft((prev) => [...prev, placed]);
    setSelectedInstanceId(placed.hotspotId);
    loadAuthoringFromHotspot(placed);
    nestNodeOntoHotspot(nodeId, placed, nestChildId || undefined);
    setNestPickNodeId(null);
    setStatus(`Placed ${hotspotLabel(facilityId)} for ${node.label || node.kind}.`);
  };

  const placeFromPalette = (clientX: number, clientY: number) => {
    if (!editing || !paletteId || drag) {
      return;
    }
    const { xPct, yPct } = pointerToPct(clientX, clientY);
    const unlock = pendingUnlock ?? emptyUnlockDraft(paletteId);
    const quest =
      pendingQuestConfig ??
      (supportsQuestConfig(paletteId) ? defaultQuestConfigFor(paletteId) : undefined);
    const placed = createPalettePlacement(
      paletteId,
      xPct,
      yPct,
      unlock,
      pendingChildOverrides.length > 0 ? pendingChildOverrides : undefined,
      quest,
      {
        sceneId: pendingSceneId ?? undefined,
        links: pendingLinks.length > 0 ? pendingLinks : undefined,
        stages: pendingStages.length > 0 ? pendingStages : undefined,
        notes: pendingNotes || undefined,
        purpose: pendingPurpose || undefined,
        revealsHotspotIds:
          pendingRevealsHotspotIds.length > 0 ? pendingRevealsHotspotIds : undefined,
        consumeOnUse: supportsConsumeOnUse(paletteId) || pendingConsumeOnUse || undefined,
      },
    );
    setDraft((prev) => [...prev, placed]);
    setSelectedInstanceId(placed.hotspotId);
    setPendingChildOverrides(placed.childOverrides ? [...placed.childOverrides] : []);
    setPendingQuestConfig(placed.questConfig ?? null);
    setPendingStages(placed.stages ? [...placed.stages] : []);
    setPendingLinks(placed.links ? [...placed.links] : []);
    setPendingRevealsHotspotIds(placed.revealsHotspotIds ? [...placed.revealsHotspotIds] : []);
    setPendingConsumeOnUse(supportsConsumeOnUse(placed.facilityId) || placed.consumeOnUse === true);
    setPendingNotes(placed.notes ?? "");
    setPendingPurpose(placed.purpose ?? "");
    setPendingSceneId(placed.sceneId ?? null);
    const nextTab = authorTabForHotspot(paletteId);
    setAuthorTab(nextTab);
    if (nextTab === "list") {
      setListDetailOpen(true);
    }
    if (paletteId === "LOCATION_ANCHOR") {
      const anchorId = pendingAnchorPlaceId;
      if (anchorId) {
        setDraftAnchors((prev) =>
          prev.map((a) => (a.id === anchorId ? { ...a, hotspotId: placed.hotspotId } : a)),
        );
        setPendingAnchorPlaceId(null);
      } else {
        const auto = createLocationAnchor(
          placed.purpose || "Unnamed place",
          [],
          "suggest",
          placed.hotspotId,
        );
        setDraftAnchors((prev) => [...prev, auto]);
      }
      setAuthorTab("anchors");
    }
    if (isThreadBeginMarker(paletteId)) {
      bindThreadStartToHotspot(placed);
    }
    setStatus(
      paletteId === "LOCATION_ANCHOR"
        ? `Placed location anchor — drag to reposition, then Save.`
        : `Placed ${hotspotLabel(paletteId)} (${unlockRuleSummary(unlock)}) — click again to add another.`,
    );
  };

  const onMapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!editing) {
      const target = event.target as HTMLElement;
      if (
        childMenu &&
        !target.closest(".island-hub-child-menu") &&
        !target.closest(".island-hub-hotspot")
      ) {
        closeChildMenu();
      }
      return;
    }
    if ((event.target as HTMLElement).closest(".island-hub-hotspot")) {
      return;
    }
    if ((event.target as HTMLElement).closest(".island-hub-unlock-panel")) {
      return;
    }
    if (nestPickNodeId && !drag) {
      placeStoryFicheOnMap(nestPickNodeId, event.clientX, event.clientY);
      return;
    }
    if (regionDrawMode && !drag) {
      const { xPct, yPct } = pointerToPct(event.clientX, event.clientY);
      setRegionDraftPoints((prev) => [...prev, { xPct, yPct }]);
      setStatus(`Area point ${regionDraftPoints.length + 1} — add at least 3, then Finish. First and last stay connected.`);
      return;
    }
    if (skipRegionClickRef.current) {
      skipRegionClickRef.current = false;
      return;
    }
    if (selectedRegionId && !paletteId && !drag && authorTab === "anchors") {
      const { xPct, yPct } = pointerToPct(event.clientX, event.clientY);
      setDraftRegions((prev) =>
        prev.map((r) =>
          r.id === selectedRegionId
            ? { ...r, points: insertPointOnClosestEdge(r.points, xPct, yPct) }
            : r,
        ),
      );
      setStatus("Added a point on the nearest edge. Drag points to reshape.");
      return;
    }
    if (!paletteId || drag) {
      return;
    }
    placeFromPalette(event.clientX, event.clientY);
  };

  const removeSelected = () => {
    if (!selectedInstanceId) {
      return;
    }
    const removed = draft.find((h) => h.hotspotId === selectedInstanceId);
    setDraft((prev) => prev.filter((h) => h.hotspotId !== selectedInstanceId));
    if (removed) {
      setDraftAnchors((prev) =>
        prev.map((a) => (a.hotspotId === removed.hotspotId ? { ...a, hotspotId: undefined } : a)),
      );
    }
    setStatus(
      removed
        ? `Removed ${hotspotLabel(removed.facilityId)} — Save to keep it off this map (re-place from palette to restore).`
        : "Removed hotspot — Save to keep it off this map.",
    );
    setSelectedInstanceId(null);
    setListDetailOpen(false);
    setThreadDetailOpen(false);
    setExpandedExploreId((id) => (id === selectedInstanceId ? null : id));
  };

  const toggleHideSelected = () => {
    if (!selectedInstanceId) {
      return;
    }
    let nowHidden = false;
    setDraft((prev) =>
      prev.map((h) => {
        if (h.hotspotId !== selectedInstanceId) {
          return h;
        }
        nowHidden = !h.hidden;
        return { ...h, hidden: nowHidden };
      }),
    );
    setStatus(
      nowHidden
        ? "Hidden in play (marker kept on layout — use Remove to delete permanently)."
        : "Visible in play when unlocked.",
    );
  };

  const applyUnlockToSelectedOrPending = (next: HotspotUnlockRule) => {
    setPendingUnlock(next);
    if (selectedInstanceId) {
      setDraft((prev) =>
        prev.map((h) => {
          if (h.hotspotId !== selectedInstanceId) {
            return h;
          }
          return {
            ...h,
            unlock: next,
            alwaysVisible: next.mode === "always" ? true : undefined,
            unlockFlag: next.mode === "flag" ? next.flag : h.unlockFlag,
            unlocked: next.mode === "always" ? true : undefined,
          };
        }),
      );
    }
  };

  const applyChildOverridesToSelectedOrPending = (next: HotspotChildOverride[]) => {
    setPendingChildOverrides(next);
    if (selectedInstanceId) {
      setDraft((prev) =>
        prev.map((h) => {
          if (h.hotspotId !== selectedInstanceId) {
            return h;
          }
          return {
            ...h,
            childOverrides: next.length > 0 ? next : undefined,
          };
        }),
      );
    }
  };

  const applyQuestConfigToSelectedOrPending = (next: HotspotQuestConfig | null) => {
    setPendingQuestConfig(next);
    if (selectedInstanceId) {
      setDraft((prev) =>
        prev.map((h) => {
          if (h.hotspotId !== selectedInstanceId) {
            return h;
          }
          return {
            ...h,
            questConfig: next ?? undefined,
          };
        }),
      );
    }
  };

  const applyStagesToSelectedOrPending = (next: HotspotStage[]) => {
    setPendingStages(next);
    patchSelectedHotspot({ stages: next.length > 0 ? next : undefined });
  };

  const applyLinksToSelectedOrPending = (next: HotspotLink[]) => {
    setPendingLinks(next);
    patchSelectedHotspot({ links: next.length > 0 ? next : undefined });
  };

  const applyNotesToSelectedOrPending = (next: string) => {
    setPendingNotes(next);
    patchSelectedHotspot({ notes: next || undefined });
  };

  const applyPurposeToSelectedOrPending = (next: string) => {
    setPendingPurpose(next);
    patchSelectedHotspot({ purpose: next.trim() || undefined });
  };

  const applyRevealsForHotspot = (hotspotId: string, next: string[]) => {
    const unique = [...new Set(next.filter(Boolean))];
    setDraft((prev) =>
      prev.map((h) =>
        h.hotspotId === hotspotId
          ? { ...h, revealsHotspotIds: unique.length > 0 ? unique : undefined }
          : h,
      ),
    );
    if (selectedInstanceId === hotspotId) {
      setPendingRevealsHotspotIds(unique);
    }
  };

  const applyRevealsToSelectedOrPending = (next: string[]) => {
    const unique = [...new Set(next.filter(Boolean))];
    setPendingRevealsHotspotIds(unique);
    if (selectedInstanceId) {
      applyRevealsForHotspot(selectedInstanceId, unique);
    }
  };

  const applySceneIdToSelectedOrPending = (next: string | null) => {
    setPendingSceneId(next);
    patchSelectedHotspot({ sceneId: next || undefined });
  };

  const addStage = (kind: HotspotStageKind = "CUSTOM") => {
    const order = pendingStages.length + 1;
    applyStagesToSelectedOrPending([...pendingStages, createHotspotStage(order, kind)]);
  };

  const updateStage = (stageId: string, patch: Partial<HotspotStage>) => {
    applyStagesToSelectedOrPending(
      pendingStages.map((s) => {
        if (s.id !== stageId) {
          return s;
        }
        const next = { ...s, ...patch };
        if (patch.kind === "BATTLE" && patch.battle === undefined) {
          next.battle = true;
        }
        return next;
      }),
    );
  };

  const removeStage = (stageId: string) => {
    applyStagesToSelectedOrPending(
      pendingStages
        .filter((s) => s.id !== stageId)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
  };

  const addLinkToHotspot = (toHotspotId: string) => {
    if (!toHotspotId || pendingLinks.some((l) => l.toHotspotId === toHotspotId)) {
      return;
    }
    applyLinksToSelectedOrPending([...pendingLinks, createHotspotLink({ toHotspotId })]);
  };

  const addCrossIslandLink = (toIslandId: string, toMapAssetId?: string) => {
    if (!toIslandId) {
      return;
    }
    applyLinksToSelectedOrPending([
      ...pendingLinks,
      createHotspotLink({ toIslandId, toMapAssetId: toMapAssetId || undefined }),
    ]);
  };

  const updateLink = (linkId: string, patch: Partial<HotspotLink>) => {
    applyLinksToSelectedOrPending(
      pendingLinks.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    );
  };

  const removeLink = (linkId: string) => {
    applyLinksToSelectedOrPending(pendingLinks.filter((l) => l.id !== linkId));
  };

  const createSceneAndAssign = () => {
    const scene = createMapScene(newSceneName || "New scene", island.id);
    setDraftScenes((prev) => [...prev, scene]);
    setNewSceneName("");
    applySceneIdToSelectedOrPending(scene.id);
    setStatus(`Created scene “${scene.name}” and assigned to selection.`);
  };

  const createChain = () => {
    const chain = createStoryChain("Untitled thread", island.id, mapAssetId ?? undefined);
    setDraftStoryChains((prev) => [...prev, chain]);
    setActiveChainId(chain.id);
    setThreadDetailOpen(false);
    setThreadComposer("setup");
    setWorkshopIndex(0);
    setCustomPromptDraft("");
    setShowChainDetails(true);
    setStatus("New thread — fill the basics, then generate.");
  };

  const openThreadDetail = (chainId: string) => {
    const chain = draftStoryChains.find((c) => c.id === chainId);
    setActiveChainId(chainId);
    setThreadDetailOpen(false);
    const middles = chain?.nodes.filter((n) => n.kind !== "start" && n.kind !== "end") ?? [];
    setThreadComposer(chain?.generationFingerprint && middles.length > 0 ? "workshop" : "setup");
    setWorkshopIndex(0);
    setCustomPromptDraft("");
    const start = chain?.nodes.find((n) => n.kind === "start");
    if (start?.placedHotspotId) {
      const hs = draft.find((h) => h.hotspotId === start.placedHotspotId);
      if (hs) {
        setSelectedInstanceId(hs.hotspotId);
        loadAuthoringFromHotspot(hs, { keepTab: true });
      }
    }
  };

  const removeChain = (chainId: string) => {
    const chain = draftStoryChains.find((entry) => entry.id === chainId);
    const leftoverIds = chain
      ? hotspotIdsOwnedByStoryChain(
          chain,
          draft,
          draftStoryChains.filter((entry) => entry.id !== chainId),
        )
      : [];
    if (leftoverIds.length > 0) {
      setDraft((prev) => omitHotspotsAndRefs(prev, leftoverIds));
    }
    if (selectedInstanceId && leftoverIds.includes(selectedInstanceId)) {
      setSelectedInstanceId(null);
    }
    setDraftStoryChains((prev) => prev.filter((c) => c.id !== chainId));
    if (activeChainId === chainId) {
      setActiveChainId(null);
      setThreadComposer(null);
    }
    setConfirmRemoveChainId(null);
    setStatus(
      leftoverIds.length > 0
        ? `Thread removed, including ${leftoverIds.length} placed fiche${leftoverIds.length === 1 ? "" : "s"}.`
        : "Thread removed.",
    );
  };

  const adoptBeginHotspotAsThread = (hotspot: IslandFacilityHotspot) => {
    const owning = draftStoryChains.find((c) =>
      c.nodes.some((n) => n.placedHotspotId === hotspot.hotspotId),
    );
    if (owning) {
      openThreadDetail(owning.id);
      return;
    }
    let chain = createStoryChain(
      hotspot.purpose?.trim() || hotspotLabel(hotspot.facilityId),
      island.id,
      mapAssetId ?? undefined,
    );
    const start = chain.nodes.find((n) => n.kind === "start");
    if (start) {
      chain = StoryChainService.nestNode(chain, start.id, {
        hotspotId: hotspot.hotspotId,
        islandId: island.id,
        mapAssetId: mapAssetId ?? undefined,
      });
      chain = StoryChainService.generateStructure(chain, storyLocationCtx());
    }
    setDraftStoryChains((prev) => [...prev, chain]);
    setActiveChainId(chain.id);
    setSelectedInstanceId(hotspot.hotspotId);
    loadAuthoringFromHotspot(hotspot, { keepTab: true });
    setThreadDetailOpen(false);
    setThreadComposer("setup");
    setWorkshopIndex(0);
    setCustomPromptDraft("");
    setShowChainDetails(true);
    setStatus(`Started thread “${chain.name}” on ${hotspotLabel(hotspot.facilityId)}.`);
  };

  const patchActiveChain = (patch: Partial<StoryChain>) => {
    if (!activeChain) {
      return;
    }
    setDraftStoryChains((prev) => prev.map((c) => (c.id === activeChain.id ? { ...c, ...patch } : c)));
  };

  const patchBeatPlan = (plan: StoryBeatPlanItem[]) => {
    if (!activeChain) {
      return;
    }
    patchActiveChain({
      start: {
        ...activeChain.start,
        beatPlan: plan,
        ...countsFromBeatPlan(plan),
      },
    });
  };

  const replaceActiveChain = (next: StoryChain) => {
    setDraftStoryChains((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  };

  const generateActiveChain = () => {
    if (!activeChain) {
      return;
    }
    const error = StoryChainService.validateForGenerate(activeChain);
    if (error) {
      setShowChainDetails(true);
      setStatus(error);
      return;
    }
    const next = StoryChainService.generateStructure(activeChain, storyLocationCtx());
    replaceActiveChain(next);
    setShowChainDetails(false);
    setThreadHelpKey(null);
    const middles = next.nodes.filter((n) => n.kind !== "start" && n.kind !== "end").length;
    setWorkshopIndex(0);
    setCustomPromptDraft("");
    setThreadComposer("workshop");
    setStatus(
      middles > 0
        ? `Story workshop ready — ${middles} beat${middles === 1 ? "" : "s"} to pick. Facility icons like Market nest automatically.`
        : "Generated Start and End. Add dialogue / events / battles, then Generate story again.",
    );
  };

  const resetGeneratedChain = () => {
    if (!activeChain) {
      return;
    }
    const start = activeChain.nodes.find((n) => n.kind === "start") ?? createStoryChainNode(1, "start", "Start");
    const end = activeChain.nodes.find((n) => n.kind === "end") ?? createStoryChainNode(2, "end", "End");
    const kept = activeChain.nodes.filter(
      (n) => n.kind !== "start" && n.kind !== "end" && (n.editState === "edited" || n.editState === "locked"),
    );
    const nodes = [start, ...kept, end].map((n, i) => ({ ...n, order: i + 1 }));
    replaceActiveChain({ ...activeChain, nodes, generationFingerprint: undefined });
    setShowChainDetails(true);
    setStatus("Cleared generated fiches. Form fields kept — Generate story when ready.");
  };

  const nestNodeOntoHotspot = (nodeId: string, hotspot: IslandFacilityHotspot, childId?: string) => {
    if (!activeChain) {
      return;
    }
    let next = StoryChainService.nestNode(activeChain, nodeId, {
      hotspotId: hotspot.hotspotId,
      childId: childId || undefined,
      islandId: island.id,
      mapAssetId: mapAssetId ?? undefined,
    });
    const nested = next.nodes.find((n) => n.id === nodeId);
    if (nested?.kind === "start" || nested?.kind === "end") {
      next = StoryChainService.generateStructure(next, storyLocationCtx());
    }
    replaceActiveChain(next);
    setNestPickNodeId(null);
    if (nested?.kind === "end") {
      setAuthorTab("thread");
      setThreadDetailOpen(false);
      setThreadComposer("workshop");
      setShowChainDetails(false);
      setWorkshopIndex(0);
      setCustomPromptDraft("");
      setStatus(
        `End placed. Pick what happens in each beat — Market / Training Grounds nest under those icons.`,
      );
      return;
    }
    setStatus(
      childId
        ? `Nested onto ${hotspotLabel(hotspot.facilityId)} → ${childId}.`
        : `Nested onto ${hotspotLabel(hotspot.facilityId)}.`,
    );
  };

  const nestNodeCrossIsland = (nodeId: string, toIslandId: string, toMapAssetId?: string) => {
    if (!activeChain) {
      return;
    }
    replaceActiveChain({
      ...activeChain,
      nodes: activeChain.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              toIslandId,
              toMapAssetId: toMapAssetId || undefined,
              editState: n.editState === "generated" ? "edited" : n.editState ?? "edited",
            }
          : n,
      ),
    });
  };

  const workshopPlaceName = (node: { locationAnchorId?: string; locationRegionId?: string; placedHotspotId?: string; suggestedHotspotId?: string }) => {
    if (node.locationRegionId) {
      const region = draftRegions.find((r) => r.id === node.locationRegionId);
      if (region?.name.trim()) {
        return region.name.trim();
      }
    }
    if (node.locationAnchorId) {
      const pin = draftAnchors.find((a) => a.id === node.locationAnchorId);
      if (pin?.text.trim()) {
        return pin.text.trim();
      }
    }
    const hotspotId = node.placedHotspotId || node.suggestedHotspotId;
    const hotspot = hotspotId ? draft.find((h) => h.hotspotId === hotspotId) : undefined;
    return hotspot ? hotspot.purpose?.trim() || hotspotLabel(hotspot.facilityId) : undefined;
  };

  const placeWorkshopNode = (nodeId: string) => {
    if (!activeChain) {
      return;
    }
    const node = activeChain.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }
    const suggested = node.suggestedHotspotId
      ? draft.find((h) => h.hotspotId === node.suggestedHotspotId)
      : undefined;
    if (suggested) {
      nestNodeOntoHotspot(
        node.id,
        suggested,
        nestChildForStoryNode(suggested.facilityId, node),
      );
      return;
    }
    const pin = node.locationAnchorId
      ? draftAnchors.find((a) => a.id === node.locationAnchorId)
      : undefined;
    if (pin?.hotspotId) {
      const pinHotspot = draft.find((h) => h.hotspotId === pin.hotspotId);
      if (pinHotspot) {
        nestNodeOntoHotspot(node.id, pinHotspot);
        return;
      }
    }
    const region = node.locationRegionId
      ? draftRegions.find((r) => r.id === node.locationRegionId)
      : undefined;
    if (region && region.points.length >= 3) {
      const center = regionCentroid(region.points);
      const placed = createPalettePlacement(
        facilityIdForStoryChainNode(activeChain, node),
        center.xPct,
        center.yPct,
        undefined,
        undefined,
        undefined,
        { purpose: region.name || node.label },
      );
      setDraft((prev) => [...prev, placed]);
      nestNodeOntoHotspot(node.id, placed);
    }
  };

  const addBeatToActiveChain = () => {
    if (!activeChain) {
      return;
    }
    const next = addStoryChainBeat(activeChain);
    setDraftStoryChains((prev) => prev.map((c) => (c.id === activeChain.id ? next : c)));
  };

  const removeChainNode = (nodeId: string) => {
    if (!activeChain) {
      return;
    }
    const nodes = activeChain.nodes
      .filter((n) => n.id !== nodeId || n.kind === "start" || n.kind === "end")
      .map((n, i) => ({ ...n, order: i + 1 }));
    patchActiveChain({ nodes });
  };

  const addAnchor = () => {
    const anchor = createLocationAnchor(newAnchorText || "Unnamed place", [], "suggest");
    setDraftAnchors((prev) => [...prev, anchor]);
    setNewAnchorText("");
    setPendingAnchorPlaceId(anchor.id);
    setPaletteId("LOCATION_ANCHOR");
    setSelectedInstanceId(null);
    setPendingUnlock(emptyUnlockDraft("LOCATION_ANCHOR"));
    setPendingQuestConfig(null);
    setPendingChildOverrides([]);
    setPendingPurpose(anchor.description);
    setSelectedAnchorId(anchor.id);
    setAuthorTab("anchors");
    setStatus("Click the map to place this location-anchor icon.");
  };

  const patchAnchor = (anchorId: string, patch: Partial<LocationAnchor>) => {
    const current = draftAnchors.find((a) => a.id === anchorId);
    setDraftAnchors((prev) => prev.map((a) => (a.id === anchorId ? { ...a, ...patch } : a)));
    if (current?.hotspotId && patch.description !== undefined) {
      setDraft((prev) =>
        prev.map((h) =>
          h.hotspotId === current.hotspotId ? { ...h, purpose: patch.description } : h,
        ),
      );
    }
  };

  const focusAnchor = (anchor: LocationAnchor) => {
    setSelectedAnchorId(anchor.id);
    setSelectedRegionId(null);
    if (anchor.hotspotId) {
      setSelectedInstanceId(anchor.hotspotId);
      const hs = draft.find((h) => h.hotspotId === anchor.hotspotId);
      if (hs) {
        loadAuthoringFromHotspot(hs, { keepTab: true });
      }
    } else {
      setSelectedInstanceId(null);
    }
  };

  const finishRegionDraw = () => {
    if (regionDraftPoints.length < 3) {
      setStatus("Draw at least 3 points before finishing an area.");
      return;
    }
    const region = createMapAnchorRegion(newRegionName, regionDraftPoints, "suggest");
    setDraftRegions((prev) => [...prev, region]);
    setSelectedRegionId(region.id);
    setRegionDrawMode(false);
    setRegionDraftPoints([]);
    setNewRegionName("");
    setStatus(`Named area “${region.name}” — Save to keep it for AI placement.`);
  };

  const patchRegion = (regionId: string, patch: Partial<MapAnchorRegion>) => {
    setDraftRegions((prev) => prev.map((r) => (r.id === regionId ? { ...r, ...patch } : r)));
  };

  const removeRegion = (regionId: string) => {
    setDraftRegions((prev) => prev.filter((r) => r.id !== regionId));
    if (selectedRegionId === regionId) {
      setSelectedRegionId(null);
    }
  };

  const removeRegionPoint = (regionId: string, index: number) => {
    setDraftRegions((prev) =>
      prev.map((r) => {
        if (r.id !== regionId || r.points.length <= 3) {
          return r;
        }
        return { ...r, points: r.points.filter((_, i) => i !== index) };
      }),
    );
  };

  const removeAnchor = (anchorId: string) => {
    const removed = draftAnchors.find((a) => a.id === anchorId);
    setDraftAnchors((prev) => prev.filter((a) => a.id !== anchorId));
    if (removed?.hotspotId) {
      setDraft((prev) => prev.filter((h) => h.hotspotId !== removed.hotspotId));
      if (selectedInstanceId === removed.hotspotId) {
        setSelectedInstanceId(null);
      }
    }
    if (pendingAnchorPlaceId === anchorId) {
      setPendingAnchorPlaceId(null);
      if (paletteId === "LOCATION_ANCHOR") {
        setPaletteId(null);
      }
    }
  };

  const patchChildOverride = (
    childId: CatalogChildActionId,
    patch: Partial<HotspotChildOverride>,
  ) => {
    const facilityId =
      (selectedInstanceId
        ? draft.find((h) => h.hotspotId === selectedInstanceId)?.facilityId
        : null) ?? paletteId;
    if (!facilityId) {
      return;
    }
    const draftHotspot: IslandFacilityHotspot = {
      hotspotId: selectedInstanceId ?? "pending",
      facilityId,
      xPct: 50,
      yPct: 50,
      childOverrides: pendingChildOverrides,
    };
    const currentIncluded = isChildIncluded(facilityId, childId, draftHotspot);
    const currentUnlock = childUnlockRule(childId, draftHotspot);
    const nextEntry: HotspotChildOverride = {
      childId,
      included: patch.included ?? currentIncluded,
      unlock: patch.unlock ?? currentUnlock,
    };
    applyChildOverridesToSelectedOrPending(upsertChildOverride(pendingChildOverrides, nextEntry));
  };

  const selectPaletteEntry = (id: IslandMapHotspotId) => {
    setPaletteId(id);
    setSelectedInstanceId(null);
    if (id !== "LOCATION_ANCHOR") {
      setPendingAnchorPlaceId(null);
    }
    const unlock = emptyUnlockDraft(id);
    setPendingUnlock(unlock);
    setPendingChildOverrides([]);
    setPendingQuestConfig(supportsQuestConfig(id) ? defaultQuestConfigFor(id) ?? null : null);
    setPendingStages([]);
    setPendingLinks([]);
    setPendingRevealsHotspotIds([]);
    setPendingConsumeOnUse(supportsConsumeOnUse(id));
    setPendingNotes("");
    setPendingPurpose("");
    setPendingSceneId(null);
    setExpandedChildId(null);
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    const nextTab = authorTabForHotspot(id);
    setAuthorTab(nextTab);
    if (nextTab === "list") {
      setListDetailOpen(true);
    }
    const count = placedCounts.get(id) ?? 0;
    setStatus(
      count > 0
        ? `Selected ${hotspotLabel(id)} (${count} placed) — set purpose/unlock/stages, then click map.`
        : `Selected ${hotspotLabel(id)} — set purpose/unlock/stages, then click the map to place.`,
    );
  };

  const applyProbeUseEffects = (hotspot: IslandFacilityHotspot) => {
    const revealIds = revealIdsForProbe(hotspot, layoutHotspots);
    if (revealIds.length) {
      setSessionRevealedIds((prev) => {
        const next = new Set(prev);
        for (const id of revealIds) {
          next.add(id);
        }
        return next;
      });
    }
    if (supportsConsumeOnUse(hotspot.facilityId) || hotspot.consumeOnUse) {
      setSessionConsumedIds((prev) => {
        const next = new Set(prev);
        next.add(hotspot.hotspotId);
        return next;
      });
      onConsumeHotspot?.(hotspot.hotspotId, revealIds);
    }
  };

  const resolveChildAction = (action: MapChildActionDef) => {
    const parent = childMenu
      ? displayHotspots.find((h) => h.hotspotId === childMenu.parentHotspotId)
      : undefined;
    if (parent && (supportsConsumeOnUse(parent.facilityId) || parent.consumeOnUse)) {
      applyProbeUseEffects(parent);
    }
    dismissChildMenuInstant();
    const { resolve } = action;
    if (action.id === "TALK_NPCS") {
      const parentId = childMenu?.parentHotspotId;
      const story = onStoryTrigger?.({
        kind: "suboption",
        hotspotId: parentId,
        childId: action.id,
        islandId: island.id,
        mapAssetId: mapAssetId ?? undefined,
      });
      const line = story ?? onTalkNpcs?.(parentId) ?? "Talk to NPCs — coming soon.";
      setStubNotice(line);
      return;
    }
    if (action.id === "INN_REST") {
      const restStory = onStoryTrigger?.({
        kind: "rest",
        hotspotId: childMenu?.parentHotspotId,
        childId: action.id,
        islandId: island.id,
        mapAssetId: mapAssetId ?? undefined,
      });
      if (restStory) {
        setStubNotice(restStory);
      }
    }
    const nestedStory =
      action.id === "INN_REST"
        ? null
        : onStoryTrigger?.({
            kind: "suboption",
            hotspotId: childMenu?.parentHotspotId,
            childId: action.id,
            islandId: island.id,
            mapAssetId: mapAssetId ?? undefined,
          });
    if (nestedStory) {
      setStubNotice(nestedStory);
    }
    if (resolve.type === "story") {
      if (!nestedStory) {
        setStubNotice(`${action.label} — the thread is quiet for now.`);
      }
      return;
    }
    if (resolve.type === "hub_choice") {
      if (resolve.choiceId === "market") {
        setMarketShopOpen(true);
        return;
      }
      if (resolve.choiceId === "weapon_shop") {
        onEnsureWeaponShop?.();
        setWeaponShopOpen(true);
        return;
      }
      if (lockReasons?.[resolve.choiceId]) {
        setStubNotice(lockReasons[resolve.choiceId] ?? "That action is locked.");
        return;
      }
      if (!choiceById.has(resolve.choiceId)) {
        setStubNotice(`${action.label} is not available here.`);
        return;
      }
      onChoose(resolve.choiceId);
      return;
    }
    if (resolve.type === "overlay") {
      if (resolve.overlay === "crew") {
        onOpenCrew?.();
        return;
      }
      if (resolve.overlay === "inventory") {
        onOpenInventory?.();
        return;
      }
      if (resolve.overlay === "harbor") {
        onChoose("harbor");
        return;
      }
      if (resolve.overlay === "ship") {
        setShipOverlayTab(shipOverlayOpensHold(resolve.focus));
        setShipOverlayOpen(true);
        return;
      }
      if (resolve.overlay === "market") {
        setMarketShopOpen(true);
        return;
      }
      if (resolve.overlay === "clinic") {
        setClinicShopOpen(true);
        return;
      }
      if (resolve.overlay === "weapon") {
        onEnsureWeaponShop?.();
        setWeaponShopOpen(true);
        return;
      }
    }
    setStubNotice(resolve.type === "stub" ? resolve.message : `${action.label} — coming soon.`);
  };

  const activateHotspot = (hotspot: IslandFacilityHotspot) => {
    if (editing) {
      if (nestPickNodeId) {
        nestNodeOntoHotspot(nestPickNodeId, hotspot, nestChildId || undefined);
        return;
      }
      if (linkPickMode && selectedInstanceId && selectedInstanceId !== hotspot.hotspotId) {
        const link = createHotspotLink({ toHotspotId: hotspot.hotspotId });
        const nextLinks = [...pendingLinks, link];
        setPendingLinks(nextLinks);
        patchSelectedHotspot({ links: nextLinks });
        setLinkPickMode(false);
        setStatus(`Linked → ${hotspotLabel(hotspot.facilityId)}.`);
        return;
      }
      if (revealPickSourceId) {
        if (hotspot.hotspotId !== revealPickSourceId) {
          const source = draft.find((x) => x.hotspotId === revealPickSourceId);
          const current =
            revealPickSourceId === selectedInstanceId
              ? pendingRevealsHotspotIds
              : source?.revealsHotspotIds ?? [];
          if (!current.includes(hotspot.hotspotId)) {
            applyRevealsForHotspot(revealPickSourceId, [...current, hotspot.hotspotId]);
            setStatus(`Added reveal → ${hotspotLabel(hotspot.facilityId)}.`);
          }
        }
        return;
      }
      setSelectedInstanceId(hotspot.hotspotId);
      const keepTab = authorTab === "explore" || authorTab === "thread" || authorTab === "anchors";
      loadAuthoringFromHotspot(hotspot, { keepTab });
      if (authorTab === "list") {
        setListDetailOpen(true);
      }
      if (hotspot.facilityId === "LOCATION_ANCHOR") {
        const match = draftAnchors.find((a) => a.hotspotId === hotspot.hotspotId);
        if (match) {
          setSelectedAnchorId(match.id);
        }
        setAuthorTab("anchors");
        setSelectedRegionId(null);
      }
      return;
    }

    if (hotspot.facilityId === "FISHING") {
      setFishingOpen(true);
      return;
    }

    const story = onStoryTrigger?.({
      kind: "map_icon",
      hotspotId: hotspot.hotspotId,
      islandId: island.id,
      mapAssetId: mapAssetId ?? undefined,
    });
    if (story) {
      setStubNotice(story);
    }

    const id = hotspot.facilityId;
    const chainsForPlay = playStoryChains;
    const hasNestedStory = chainsForPlay.some((c) =>
      c.nodes.some((n) => n.placedHotspotId === hotspot.hotspotId),
    );
    const openHub = playHotspotUsesHubChoice(hotspot, {
      hasNestedStory,
      storyFired: Boolean(story),
    });

    if (id === "LOCATION_ANCHOR") {
      if (!story) {
        setStubNotice(hotspot.purpose?.trim() || "A marked place.");
      }
      return;
    }

    if (!openHub && (id === "QUEST" || hasNestedStory)) {
      if (!story) {
        setStubNotice(`${hotspotLabel(id)} — the thread is quiet for now.`);
      }
      return;
    }

    if (hasVisibleChildActions(hotspot, island, run, chainsForPlay)) {
      if (childMenu?.parentHotspotId === hotspot.hotspotId) {
        closeChildMenu();
        return;
      }
      openChildMenu(hotspot);
      return;
    }

    const choiceId = hotspotHubChoiceId(id);
    if (!openHub || !choiceId) {
      if (id === "TALK") {
        setStubNotice(story ?? onTalkNpcs?.(hotspot.hotspotId) ?? "Talk to NPCs — coming soon.");
      } else if (supportsRevealAuthoring(id)) {
        applyProbeUseEffects(hotspot);
        const revealed = hotspot.revealsHotspotIds?.length ?? 0;
        setStubNotice(
          revealed > 0
            ? `${hotspotLabel(id)} — revealed ${revealed} marker(s).`
            : `${hotspotLabel(id)} — coming soon.`,
        );
      }
      return;
    }
    if (lockReasons?.[choiceId]) {
      return;
    }
    if (!choiceById.has(choiceId)) {
      return;
    }
    if (id === "MARKET" || choiceId === "market") {
      dismissChildMenuInstant();
      setMarketShopOpen(true);
      return;
    }
    if (id === "WEAPON_SHOP" || choiceId === "weapon_shop") {
      dismissChildMenuInstant();
      onEnsureWeaponShop?.();
      setWeaponShopOpen(true);
      return;
    }
    dismissChildMenuInstant();
    applyProbeUseEffects(hotspot);
    onChoose(choiceId);
  };

  const retryMap = () => {
    setMapFailed(false);
    setImgNonce((n) => n + 1);
    setStatus("Retrying map image…");
  };

  const selectedMeta =
    selectedInstanceId && editing ? draft.find((h) => h.hotspotId === selectedInstanceId) : undefined;

  const activeMarkerId = selectedMeta?.facilityId ?? paletteId;
  const activeScene = draftScenes.find((s) => s.id === pendingSceneId) ?? null;
  const otherIslands = (run?.islands ?? []).filter((i) => i.id !== island.id);
  const linkTargetsOnMap = draft.filter((h) => h.hotspotId !== selectedInstanceId);
  const hasBattle = hotspotHasBattleStage(pendingStages);

  const editorLinkEdges = useMemo(() => {
    if (!editing) {
      return [] as Array<{
        key: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        crossIsland: boolean;
        label?: string;
      }>;
    }
    const byId = new Map(draft.map((h) => [h.hotspotId, h]));
    const edges: Array<{
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      crossIsland: boolean;
      label?: string;
    }> = [];
    for (const from of draft) {
      for (const link of from.links ?? []) {
        if (link.toHotspotId) {
          const to = byId.get(link.toHotspotId);
          if (to) {
            edges.push({
              key: `${from.hotspotId}-${link.id}`,
              x1: clampPct(from.xPct),
              y1: clampPct(from.yPct),
              x2: clampPct(to.xPct),
              y2: clampPct(to.yPct),
              crossIsland: false,
              label: link.label,
            });
            continue;
          }
        }
        if (link.toIslandId || link.toMapAssetId) {
          edges.push({
            key: `${from.hotspotId}-${link.id}-ext`,
            x1: clampPct(from.xPct),
            y1: clampPct(from.yPct),
            x2: Math.min(98, clampPct(from.xPct) + 8),
            y2: Math.max(2, clampPct(from.yPct) - 6),
            crossIsland: true,
            label: link.label || link.toIslandId || link.toMapAssetId,
          });
        }
      }
    }
    return edges;
  }, [editing, draft]);

  const hotspotPlayVisible = (hotspot: IslandFacilityHotspot) => {
    if (editing) {
      if (hotspot.facilityId === "LOCATION_ANCHOR") {
        return authorTab === "anchors";
      }
      if (authorTab === "anchors" && hideOtherIcons) {
        return false;
      }
      return true;
    }
    if (
      sessionConsumedIds.has(hotspot.hotspotId) &&
      !isBrokenConsumedProbe(hotspot, island, sessionRevealedIds)
    ) {
      return false;
    }
    if (sessionRevealedIds.has(hotspot.hotspotId)) {
      return true;
    }
    if (StoryChainService.hidesHotspotUntilReady(run, playStoryChains, hotspot)) {
      return false;
    }
    return isHotspotVisibleInPlay(hotspot, island, run, unlockedSet);
  };

  const hoveredHotspot =
    hoveredHotspotId != null
      ? displayHotspots.find((h) => h.hotspotId === hoveredHotspotId)
      : undefined;
  const isReturnHover = Boolean(
    childMenu?.open &&
      hoveredHotspotId === childMenu.parentHotspotId &&
      !hoveredChildLabel,
  );
  const centerOverlayLabel = hoveredChildLabel ?? (isReturnHover ? "Return" : null);
  const hoverNameLabel = hoveredHotspot
    ? hoveredHotspot.purpose?.trim() || hotspotLabel(hoveredHotspot.facilityId)
    : null;
  const showMainIconTooltip = Boolean(
    hoverNameLabel && hoveredHotspot && !childMenu?.open && !hoveredChildLabel,
  );

  const authorTabs = (
    <div className="island-hub-author-tabs" role="tablist">
      {AUTHOR_TABS.map((tab) => (
        <button
          aria-selected={authorTab === tab.id}
          className={`island-hub-author-tab${authorTab === tab.id ? " is-active" : ""}`}
          key={tab.id}
          onClick={() => {
            setAuthorTab(tab.id);
            if (tab.id === "list") {
              setListDetailOpen(false);
            }
            if (tab.id === "thread") {
              setThreadDetailOpen(false);
              setThreadComposer(null);
              setConfirmRemoveChainId(null);
            } else {
              setThreadComposer(null);
            }
            if (tab.id !== "explore") {
              setRevealPickSourceId(null);
            }
            if (tab.id !== "anchors") {
              setRegionDrawMode(false);
              setRegionDraftPoints([]);
              setPendingAnchorPlaceId(null);
            }
          }}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const showListDetail = Boolean(editing && authorTab === "list" && listDetailOpen && activeMarkerId);

  const unlockPanel =
    showListDetail ? (
      <aside className="island-hub-unlock-panel" onClick={(e) => e.stopPropagation()}>
        <div className="island-hub-unlock-head">
          <p className="island-hub-unlock-title">
            {selectedMeta ? "Icon" : "Place"} — {hotspotLabel(activeMarkerId!)}
          </p>
          <button
            className="ghost-btn island-hub-unlock-close"
            onClick={() => setListDetailOpen(false)}
            type="button"
          >
            Back to list
          </button>
        </div>
        {authorTabs}
        <div className="island-hub-unlock-scroll">
          {activeMarkerId ? (
          <>
          <div className="island-hub-unlock-section">
            <p className="island-hub-unlock-children-title">Preview</p>
            <div className="island-hub-unlock-preview">
              <img alt="" draggable={false} src={hotspotIconSrc(activeMarkerId!)} />
              <div>
                <strong>{hotspotLabel(activeMarkerId!)}</strong>
                <span className="island-hub-unlock-preview-meta">
                  {activeMarkerId}
                  {hasBattle ? " · includes battle" : ""}
                  {selectedMeta?.hidden ? " · hidden" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="island-hub-unlock-section">
            <p className="island-hub-unlock-children-title">Purpose</p>
            <label className="island-hub-unlock-field">
              What this icon is for
              <input
                onChange={(e) => applyPurposeToSelectedOrPending(e.target.value)}
                placeholder={hotspotLabel(activeMarkerId!)}
                type="text"
                value={pendingPurpose}
              />
            </label>
          </div>

          {activeMarkerId && supportsRevealAuthoring(activeMarkerId) ? (
            <div className="island-hub-unlock-section">
              <div className="island-hub-unlock-section-head">
                <p className="island-hub-unlock-children-title">Reveals icons</p>
                <div className="island-hub-unlock-section-actions">
                  <button
                    className={`ghost-btn${revealPickMode ? " is-active" : ""}`}
                    disabled={!selectedInstanceId}
                    onClick={() => {
                      if (revealPickSourceId) {
                        setRevealPickSourceId(null);
                        setStatus(null);
                        return;
                      }
                      if (!selectedInstanceId) {
                        return;
                      }
                      setRevealPickSourceId(selectedInstanceId);
                      setLinkPickMode(false);
                      setStatus("Picking reveals — click map icons.");
                    }}
                    title="Click map icons to add as reveal targets (Esc or Done to finish)"
                    type="button"
                  >
                    {revealPickMode ? "Picking…" : "Pick on map"}
                  </button>
                  {revealPickMode ? (
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        setRevealPickSourceId(null);
                        setStatus(null);
                      }}
                      type="button"
                    >
                      Done
                    </button>
                  ) : null}
                </div>
              </div>
              {revealPickMode ? (
                <p className="island-hub-unlock-hint">
                  Picking reveals — click map icons. Esc or Done to finish.
                </p>
              ) : (
                <p className="island-hub-unlock-hint">
                  Icons that become visible after using this Explore / Investigate / Search /
                  Scout.
                </p>
              )}
              {pendingRevealsHotspotIds.length === 0 ? (
                <p className="island-hub-unlock-hint">No reveal targets yet.</p>
              ) : (
                pendingRevealsHotspotIds.map((targetId) => {
                  const target = draft.find((h) => h.hotspotId === targetId);
                  return (
                    <div className="island-hub-unlock-row" key={targetId}>
                      <span className="island-hub-unlock-preview-meta">
                        {target
                          ? hotspotLabel(target.facilityId)
                          : targetId.slice(0, 10)}
                        {target ? ` · ${target.facilityId}` : ""}
                      </span>
                      <button
                        aria-label="Remove"
                        className="ghost-btn island-hub-unlock-remove"
                        onClick={() =>
                          applyRevealsToSelectedOrPending(
                            pendingRevealsHotspotIds.filter((id) => id !== targetId),
                          )
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
              <label className="island-hub-unlock-field">
                Add from placed icons
                <select
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      return;
                    }
                    if (!pendingRevealsHotspotIds.includes(id)) {
                      applyRevealsToSelectedOrPending([...pendingRevealsHotspotIds, id]);
                    }
                    e.target.value = "";
                  }}
                  value=""
                >
                  <option value="">Select hotspot…</option>
                  {linkTargetsOnMap.map((h) => (
                    <option key={h.hotspotId} value={h.hotspotId}>
                      {hotspotLabel(h.facilityId)} ({h.xPct.toFixed(0)}%, {h.yPct.toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="island-hub-unlock-section">
            <p className="island-hub-unlock-children-title">Unlock</p>
            {selectedInstanceId
              ? (() => {
                  const sources = revealSourcesForHotspot(selectedInstanceId, draft);
                  if (sources.length === 0) {
                    return null;
                  }
                  return (
                    <p className="island-hub-unlock-badge">
                      Unlocked by exploration of{" "}
                      {sources.map((s) => hotspotAuthorName(s)).join(", ")}
                    </p>
                  );
                })()
              : null}
            <label className="island-hub-unlock-field">
              Mode
              <select
                onChange={(e) => {
                  const mode = e.target.value as HotspotUnlockMode;
                  const base = pendingUnlock ?? emptyUnlockDraft(activeMarkerId!);
                  const next: HotspotUnlockRule = { mode };
                  if (mode === "flag") {
                    next.flag = base.flag ?? "";
                  }
                  if (mode === "quest") {
                    next.questId = base.questId ?? base.flag ?? "";
                  }
                  applyUnlockToSelectedOrPending(next);
                }}
                value={pendingUnlock?.mode === "explore_count" ? "always" : pendingUnlock?.mode ?? "always"}
              >
                <option value="always">Unlocked by default</option>
                <option value="flag">After flag / discovery</option>
                <option value="quest">After quest / event</option>
              </select>
            </label>
            {pendingUnlock?.mode === "flag" ? (
              <label className="island-hub-unlock-field">
                Flag id
                <input
                  onChange={(e) =>
                    applyUnlockToSelectedOrPending({ mode: "flag", flag: e.target.value.trim() })
                  }
                  placeholder="map_quest"
                  type="text"
                  value={pendingUnlock.flag ?? ""}
                />
              </label>
            ) : null}
            {pendingUnlock?.mode === "quest" ? (
              <label className="island-hub-unlock-field">
                Quest / event id
                <input
                  onChange={(e) =>
                    applyUnlockToSelectedOrPending({
                      mode: "quest",
                      questId: e.target.value.trim(),
                    })
                  }
                  placeholder="quest_id"
                  type="text"
                  value={pendingUnlock.questId ?? ""}
                />
              </label>
            ) : null}
          </div>

          <div className="island-hub-unlock-section">
            <p className="island-hub-unlock-children-title">Scene</p>
            <label className="island-hub-unlock-field">
              Assign to scene
              <select
                onChange={(e) => applySceneIdToSelectedOrPending(e.target.value || null)}
                value={pendingSceneId ?? ""}
              >
                <option value="">— none —</option>
                {draftScenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {activeScene ? (
              <p className="island-hub-unlock-hint">
                Scene: {activeScene.name}
                {activeScene.notes ? ` — ${activeScene.notes}` : ""}
              </p>
            ) : null}
            <div className="island-hub-unlock-row">
              <input
                onChange={(e) => setNewSceneName(e.target.value)}
                placeholder="New scene name"
                type="text"
                value={newSceneName}
              />
              <button className="ghost-btn" onClick={createSceneAndAssign} type="button">
                Create
              </button>
            </div>
            {activeScene ? (
              <label className="island-hub-unlock-field">
                Scene notes
                <textarea
                  onChange={(e) => {
                    const notes = e.target.value;
                    setDraftScenes((prev) =>
                      prev.map((s) => (s.id === activeScene.id ? { ...s, notes } : s)),
                    );
                  }}
                  placeholder="Design notes for this quest/event chain…"
                  rows={2}
                  value={activeScene.notes ?? ""}
                />
              </label>
            ) : null}
          </div>

          <div className="island-hub-unlock-section">
            <div className="island-hub-unlock-section-head">
              <p className="island-hub-unlock-children-title">Stages</p>
              <button className="ghost-btn" onClick={() => addStage("CUSTOM")} type="button">
                + Stage
              </button>
            </div>
            {hasBattle ? (
              <p className="island-hub-unlock-badge">Includes battle stage</p>
            ) : (
              <p className="island-hub-unlock-hint">No battle stage yet.</p>
            )}
            {pendingStages.length === 0 ? (
              <p className="island-hub-unlock-hint">
                Add sequential outcomes (find item → battle → join…).
              </p>
            ) : null}
            {pendingStages.map((stage) => (
              <div className="island-hub-unlock-stage" key={stage.id}>
                <div className="island-hub-unlock-row">
                  <span className="island-hub-unlock-stage-order">#{stage.order}</span>
                  <select
                    onChange={(e) =>
                      updateStage(stage.id, { kind: e.target.value as HotspotStageKind })
                    }
                    value={stage.kind}
                  >
                    {HOTSPOT_STAGE_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button className="ghost-btn" onClick={() => removeStage(stage.id)} type="button">
                    ×
                  </button>
                </div>
                <label className="island-hub-unlock-field">
                  Label
                  <input
                    onChange={(e) => updateStage(stage.id, { label: e.target.value || undefined })}
                    placeholder="Short stage title"
                    type="text"
                    value={stage.label ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-child-toggle">
                  <input
                    checked={Boolean(stage.battle || stage.kind === "BATTLE")}
                    onChange={(e) => updateStage(stage.id, { battle: e.target.checked })}
                    type="checkbox"
                  />
                  <span>Battle</span>
                </label>
                <label className="island-hub-unlock-field">
                  Notes
                  <textarea
                    onChange={(e) => updateStage(stage.id, { notes: e.target.value || undefined })}
                    placeholder="Design notes for this stage…"
                    rows={2}
                    value={stage.notes ?? ""}
                  />
                </label>
              </div>
            ))}
            <div className="island-hub-unlock-row wrap">
              {(["FIND_ITEM", "TALK", "BATTLE", "JOIN_OFFER"] as HotspotStageKind[]).map((kind) => (
                <button className="ghost-btn" key={kind} onClick={() => addStage(kind)} type="button">
                  + {HOTSPOT_STAGE_KIND_OPTIONS.find((o) => o.value === kind)?.label}
                </button>
              ))}
            </div>
          </div>

          <div className="island-hub-unlock-section">
            <div className="island-hub-unlock-section-head">
              <p className="island-hub-unlock-children-title">Links</p>
              <button
                className={`ghost-btn${linkPickMode ? " is-active" : ""}`}
                disabled={!selectedInstanceId}
                onClick={() => {
                  setLinkPickMode((v) => !v);
                  setRevealPickSourceId(null);
                }}
                title="Click another hotspot on this map to link"
                type="button"
              >
                {linkPickMode ? "Click target…" : "Link on map"}
              </button>
            </div>
            {linkPickMode ? (
              <p className="island-hub-unlock-hint">Click another icon on the map to create a link.</p>
            ) : null}
            <label className="island-hub-unlock-field">
              Link to hotspot (this map)
              <select
                disabled={!selectedInstanceId}
                onChange={(e) => {
                  if (e.target.value) {
                    addLinkToHotspot(e.target.value);
                    e.target.value = "";
                  }
                }}
                value=""
              >
                <option value="">— choose —</option>
                {linkTargetsOnMap.map((h) => (
                  <option key={h.hotspotId} value={h.hotspotId}>
                    {hotspotLabel(h.facilityId)} ({h.xPct.toFixed(0)}%, {h.yPct.toFixed(0)}%)
                  </option>
                ))}
              </select>
            </label>
            <label className="island-hub-unlock-field">
              Link to other island
              <select
                disabled={!selectedInstanceId}
                onChange={(e) => {
                  if (e.target.value) {
                    const target = otherIslands.find((i) => i.id === e.target.value);
                    addCrossIslandLink(e.target.value, target?.mapAssetId ?? undefined);
                    e.target.value = "";
                  }
                }}
                value=""
              >
                <option value="">— choose island —</option>
                {otherIslands.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.mapAssetId ? ` (${i.mapAssetId.replace(/^Island_/, "")})` : ""}
                  </option>
                ))}
              </select>
            </label>
            {pendingLinks.length === 0 ? (
              <p className="island-hub-unlock-hint">No outgoing links.</p>
            ) : null}
            {pendingLinks.map((link) => {
              const local = link.toHotspotId
                ? draft.find((h) => h.hotspotId === link.toHotspotId)
                : undefined;
              const destIsland = link.toIslandId
                ? (run?.islands ?? []).find((i) => i.id === link.toIslandId)
                : undefined;
              return (
                <div className="island-hub-unlock-link" key={link.id}>
                  <div className="island-hub-unlock-row">
                    <strong>
                      {local
                        ? `→ ${hotspotLabel(local.facilityId)}`
                        : destIsland
                          ? `→ Island: ${destIsland.name}`
                          : link.toIslandId
                            ? `→ Island: ${link.toIslandId}`
                            : link.toMapAssetId
                              ? `→ Map: ${link.toMapAssetId}`
                              : "→ (set target)"}
                    </strong>
                    <button className="ghost-btn" onClick={() => removeLink(link.id)} type="button">
                      ×
                    </button>
                  </div>
                  {destIsland || link.toIslandId || link.toMapAssetId ? (
                    <p className="island-hub-unlock-badge is-island">
                      Other island
                      {destIsland ? `: ${destIsland.name}` : ""}
                      {link.toMapAssetId ? ` · ${link.toMapAssetId}` : ""}
                    </p>
                  ) : null}
                  <label className="island-hub-unlock-field">
                    Label
                    <input
                      onChange={(e) => updateLink(link.id, { label: e.target.value || undefined })}
                      placeholder="Optional link label"
                      type="text"
                      value={link.label ?? ""}
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    Notes
                    <textarea
                      onChange={(e) => updateLink(link.id, { notes: e.target.value || undefined })}
                      placeholder="Why this continues here / on another map…"
                      rows={2}
                      value={link.notes ?? ""}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="island-hub-unlock-section">
            <p className="island-hub-unlock-children-title">Notes</p>
            <label className="island-hub-unlock-field">
              Design notes (icon)
              <textarea
                onChange={(e) => applyNotesToSelectedOrPending(e.target.value)}
                placeholder="Notes for future AI/dev quest flesh-out…"
                rows={3}
                value={pendingNotes}
              />
            </label>
          </div>

          {(() => {
            const markerId = activeMarkerId;
            if (!markerId || !supportsQuestConfig(markerId)) {
              return null;
            }
            const config =
              pendingQuestConfig ?? defaultQuestConfigFor(markerId) ?? {
                kind: "CUSTOM" as HotspotQuestKind,
                handlerType: "ANY" as HotspotHandlerType,
              };
            const questOptions = listEditorQuestOrEventOptions(config.kind, run);
            const npcOptions = listEditorHandlerNpcOptions(run);
            const crewOptions = listEditorHandlerCrewOptions(run);
            return (
              <div className="island-hub-unlock-section">
                <p className="island-hub-unlock-children-title">Quest / event binding</p>
                <label className="island-hub-unlock-field">
                  Kind
                  <select
                    onChange={(e) => {
                      const kind = e.target.value as HotspotQuestKind;
                      applyQuestConfigToSelectedOrPending({
                        ...config,
                        kind,
                        questOrEventId: undefined,
                      });
                    }}
                    value={config.kind}
                  >
                    {HOTSPOT_QUEST_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {config.kind === "CUSTOM" || questOptions.length === 0 ? (
                  <label className="island-hub-unlock-field">
                    Quest / event id
                    <input
                      onChange={(e) =>
                        applyQuestConfigToSelectedOrPending({
                          ...config,
                          questOrEventId: e.target.value.trim() || undefined,
                        })
                      }
                      placeholder="custom_id"
                      type="text"
                      value={config.questOrEventId ?? ""}
                    />
                  </label>
                ) : (
                  <label className="island-hub-unlock-field">
                    Select
                    <select
                      onChange={(e) =>
                        applyQuestConfigToSelectedOrPending({
                          ...config,
                          questOrEventId: e.target.value || undefined,
                        })
                      }
                      value={config.questOrEventId ?? ""}
                    >
                      <option value="">— choose —</option>
                      {questOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="island-hub-unlock-children-title">Handler</p>
                <label className="island-hub-unlock-field">
                  Who can handle
                  <select
                    onChange={(e) => {
                      const handlerType = e.target.value as HotspotHandlerType;
                      applyQuestConfigToSelectedOrPending({
                        ...config,
                        handlerType,
                        handlerId:
                          handlerType === "NPC" || handlerType === "CREW"
                            ? config.handlerId
                            : undefined,
                        handlerFaction:
                          handlerType === "FACTION" || handlerType === "NPC"
                            ? config.handlerFaction
                            : undefined,
                      });
                    }}
                    value={config.handlerType}
                  >
                    {HOTSPOT_HANDLER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                {config.handlerType === "NPC" ? (
                  <label className="island-hub-unlock-field">
                    NPC
                    <select
                      onChange={(e) =>
                        applyQuestConfigToSelectedOrPending({
                          ...config,
                          handlerId: e.target.value || undefined,
                        })
                      }
                      value={config.handlerId ?? ""}
                    >
                      <option value="">— any / later —</option>
                      {npcOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {config.handlerType === "CREW" ? (
                  <label className="island-hub-unlock-field">
                    Crewmate
                    <select
                      onChange={(e) =>
                        applyQuestConfigToSelectedOrPending({
                          ...config,
                          handlerId: e.target.value || undefined,
                        })
                      }
                      value={config.handlerId ?? ""}
                    >
                      <option value="">— any crew —</option>
                      {crewOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {config.handlerType === "FACTION" || config.handlerType === "NPC" ? (
                  <label className="island-hub-unlock-field">
                    Faction filter
                    <select
                      onChange={(e) =>
                        applyQuestConfigToSelectedOrPending({
                          ...config,
                          handlerFaction: (e.target.value || undefined) as
                            | RelationFactionId
                            | NpcFaction
                            | undefined,
                        })
                      }
                      value={config.handlerFaction ?? ""}
                    >
                      <option value="">— none —</option>
                      {HOTSPOT_HANDLER_FACTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            );
          })()}

          {(() => {
            const parentId = activeMarkerId;
            if (!parentId) {
              return null;
            }
            const slots = editorChildSlotsFor(parentId);
            if (slots.length === 0) {
              return null;
            }
            const draftHotspot: IslandFacilityHotspot = {
              hotspotId: selectedInstanceId ?? "pending",
              facilityId: parentId,
              xPct: 50,
              yPct: 50,
              childOverrides: pendingChildOverrides,
            };
            return (
              <div className="island-hub-unlock-section island-hub-unlock-children">
                <p className="island-hub-unlock-children-title">Sub-icons</p>
                {slots.map((slot) => {
                  const included = isChildIncluded(parentId, slot.childId, draftHotspot);
                  const unlock = childUnlockRule(slot.childId, draftHotspot);
                  const expanded = expandedChildId === slot.childId;
                  return (
                    <div
                      className={`island-hub-unlock-child${included ? " is-included" : ""}`}
                      key={slot.childId}
                    >
                      <label className="island-hub-unlock-child-toggle">
                        <input
                          checked={included}
                          onChange={(e) =>
                            patchChildOverride(slot.childId, { included: e.target.checked })
                          }
                          type="checkbox"
                        />
                        <span>
                          {slot.label}
                          {slot.optional ? " (optional)" : ""}
                        </span>
                      </label>
                      {included ? (
                        <>
                          <button
                            className="ghost-btn island-hub-unlock-child-expand"
                            onClick={() => setExpandedChildId(expanded ? null : slot.childId)}
                            type="button"
                          >
                            {expanded ? "Hide unlock" : unlockRuleSummary(unlock)}
                          </button>
                          {expanded ? (
                            <div className="island-hub-unlock-child-fields">
                              <label className="island-hub-unlock-field">
                                When visible
                                <select
                                  onChange={(e) => {
                                    const mode = e.target.value as HotspotUnlockMode;
                                    const next: HotspotUnlockRule = { mode };
                                    if (mode === "flag") {
                                      next.flag = unlock.flag ?? "";
                                    }
                                    if (mode === "quest") {
                                      next.questId = unlock.questId ?? unlock.flag ?? "";
                                    }
                                    patchChildOverride(slot.childId, { unlock: next });
                                  }}
                                  value={unlock.mode === "explore_count" ? "always" : unlock.mode}
                                >
                                  <option value="always">Unlocked by default</option>
                                  <option value="flag">After flag / discovery</option>
                                  <option value="quest">After quest / event</option>
                                </select>
                              </label>
                              {unlock.mode === "flag" ? (
                                <label className="island-hub-unlock-field">
                                  Flag id
                                  <input
                                    onChange={(e) =>
                                      patchChildOverride(slot.childId, {
                                        unlock: { mode: "flag", flag: e.target.value.trim() },
                                      })
                                    }
                                    placeholder="map_talk"
                                    type="text"
                                    value={unlock.flag ?? ""}
                                  />
                                </label>
                              ) : null}
                              {unlock.mode === "quest" ? (
                                <label className="island-hub-unlock-field">
                                  Quest / event id
                                  <input
                                    onChange={(e) =>
                                      patchChildOverride(slot.childId, {
                                        unlock: {
                                          mode: "quest",
                                          questId: e.target.value.trim(),
                                        },
                                      })
                                    }
                                    placeholder="quest_id"
                                    type="text"
                                    value={unlock.questId ?? ""}
                                  />
                                </label>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <p className="island-hub-unlock-hint">
            {selectedMeta
              ? "Edits apply to the selected placement. Save positions to persist scenes, stages, and links."
              : "Click the map to place with these settings (multiple copies allowed)."}
          </p>
          </>
          ) : (
            <p className="island-hub-unlock-hint">
              Select an icon from the list or map to edit purpose, unlock, scene, stages, and notes.
            </p>
          )}
        </div>
      </aside>
    ) : null;

  const palettePanel =
    editing ? (
      <aside className="island-hub-palette is-overlay" aria-label="Place icons">
        <p className="island-hub-palette-title">Place icons</p>
        <div className="island-hub-palette-grid">
          {PLACEABLE_PALETTE.map((entry) => {
            const count = placedCounts.get(entry.id) ?? 0;
            const selected = paletteId === entry.id && !selectedInstanceId;
            return (
              <button
                className={`island-hub-palette-item${count > 0 ? " is-placed" : ""}${
                  selected ? " is-selected" : ""
                }`}
                key={entry.id}
                onClick={() => selectPaletteEntry(entry.id)}
                title={`${entry.label}${count > 0 ? ` (${count} placed)` : ""}`}
                type="button"
              >
                <img alt="" draggable={false} src={entry.iconSrc} />
                <span>
                  {entry.label}
                  {count > 1 ? ` ×${count}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    ) : null;

  const playStoryChains = useMemo(
    () =>
      mapAssetId
        ? getMapLayoutStoryChains(island, mapAssetId).map((chain) =>
            StoryChainService.ensureSeaKingTurnIn(chain),
          )
        : [],
    [island, mapAssetId],
  );

  const storyBadgeByHotspot = useMemo(() => {
    const source = editing
      ? draftStoryChains
      : playStoryChains;
    const map = new Map<string, number>();
    for (const chain of source) {
      for (const node of chain.nodes) {
        if (node.placedHotspotId) {
          map.set(node.placedHotspotId, (map.get(node.placedHotspotId) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [editing, draftStoryChains, playStoryChains]);

  const placedNodes = activeChain?.nodes.filter((n) => n.placedHotspotId) ?? [];
  const listHotspots = (
    listKindFilter === "all"
      ? draft
      : draft.filter((h) => hotspotListKind(h.facilityId) === listKindFilter)
  ).filter((h) => h.facilityId !== "LOCATION_ANCHOR");
  const anchorHotspots = draft.filter((h) => h.facilityId === "LOCATION_ANCHOR");
  const exploreHotspots = draft.filter((h) => supportsRevealAuthoring(h.facilityId));
  const chainedHotspotIds = new Set<string>();
  for (const chain of draftStoryChains) {
    for (const node of chain.nodes) {
      if (node.placedHotspotId) {
        chainedHotspotIds.add(node.placedHotspotId);
      }
    }
  }
  const unboundBeginHotspots = draft.filter(
    (h) => isThreadBeginMarker(h.facilityId) && !chainedHotspotIds.has(h.hotspotId),
  );
  const showThreadDetail = Boolean(authorTab === "thread" && threadDetailOpen && activeChain);
  const workshopBeats = activeChain
    ? activeChain.nodes.filter((n) => n.kind !== "start" && n.kind !== "end")
    : [];
  const showWorkshop = Boolean(threadComposer === "workshop" && activeChain && workshopBeats.length > 0);
  const workshopNode =
    workshopBeats[Math.min(workshopIndex, Math.max(0, workshopBeats.length - 1))] ?? null;
  const editorBeatPlan = activeChain ? resolvedBeatPlan(activeChain.start) : [];

  const storyTray =
    editing && authorTab === "thread" && !threadComposer ? (
      <aside className="island-hub-unlock-panel" aria-label="Story thread" onClick={(e) => e.stopPropagation()}>
        <div className="island-hub-unlock-head">
          <p className="island-hub-unlock-title">Thread</p>
        </div>
        {authorTabs}
        <div className="island-hub-unlock-scroll">
        {false && showThreadDetail && activeChain ? (
          <>
            <div className="island-hub-story-cta">
              <button className="run-btn run-btn-accent" onClick={generateActiveChain} type="button">
                Generate story
              </button>
              <button className="ghost-btn" onClick={resetGeneratedChain} type="button">
                Reset
              </button>
              <button className="ghost-btn" onClick={addBeatToActiveChain} type="button">
                + Beat
              </button>
              <button className="ghost-btn" onClick={() => setShowChainDetails((v) => !v)} type="button">
                {showChainDetails ? "Hide fields" : "Edit fields"}
              </button>
            </div>
            <p className="island-hub-unlock-hint">
              Place Start and End, then this panel walks each beat: 3 choices or your own prompt.
              Market / Training Grounds / other hubs get the beat under that main icon. Pins and
              named regions are used when no hub fits.
            </p>
            {activeChain.nodes.length > 2 || activeChain.generationFingerprint ? (
              <ol className="island-hub-story-loop">
                {activeChain.nodes.map((node) => (
                  <li key={node.id}>
                    #{node.order} {node.label || node.kind}
                    {node.placedHotspotId ? " · placed" : " · unplaced"}
                    {storyChainNodeOriginLabel(node.editState)
                      ? ` · ${storyChainNodeOriginLabel(node.editState)}`
                      : ""}
                    {node.notes ? ` — ${node.notes}` : ""}
                  </li>
                ))}
              </ol>
            ) : null}
            <label className="island-hub-unlock-field">
              <ThreadFieldLabel
                fieldKey="name"
                onToggle={setThreadHelpKey}
                openKey={threadHelpKey}
                text="Name"
              />
              <input
                onChange={(e) => patchActiveChain({ name: e.target.value })}
                type="text"
                value={activeChain.name}
              />
            </label>
            {showWorkshop && workshopNode ? (
              <div className="island-hub-workshop">
                <p className="island-hub-unlock-children-title">
                  Beat {Math.min(workshopIndex, workshopBeats.length - 1) + 1} of {workshopBeats.length}
                </p>
                <p className="island-hub-workshop-kicker">
                  {workshopNode.label || workshopNode.kind}
                  {workshopPlaceName(workshopNode)
                    ? ` · ${workshopPlaceName(workshopNode)}`
                    : ""}
                  {workshopNode.placedHotspotId ? " · on map" : ""}
                </p>
                {workshopNode.kind === "battle" || workshopNode.kind === "boss" ? (
                  <>
                    <p className="island-hub-unlock-hint">
                      {workshopNode.questDraft?.battleSuggestion ||
                        "A fight is suggested here. Tune the pack, then keep or change it."}
                    </p>
                    <label className="island-hub-unlock-field">
                      Enemies
                      <input
                        max={8}
                        min={1}
                        onChange={(e) =>
                          replaceActiveChain(
                            StoryChainService.applyBattleDraft(activeChain, workshopNode.id, {
                              enemyCount: Number(e.target.value),
                            }),
                          )
                        }
                        type="number"
                        value={workshopNode.questDraft?.enemyCount ?? 3}
                      />
                    </label>
                    <label className="island-hub-unlock-field">
                      Strength
                      <select
                        onChange={(e) =>
                          replaceActiveChain(
                            StoryChainService.applyBattleDraft(activeChain, workshopNode.id, {
                              enemyStrength: e.target.value as "weak" | "normal" | "strong",
                            }),
                          )
                        }
                        value={workshopNode.questDraft?.enemyStrength ?? "normal"}
                      >
                        <option value="weak">Weak</option>
                        <option value="normal">Normal</option>
                        <option value="strong">Strong</option>
                      </select>
                    </label>
                    <label className="island-hub-unlock-field">
                      Type
                      <select
                        onChange={(e) =>
                          replaceActiveChain(
                            StoryChainService.applyBattleDraft(activeChain, workshopNode.id, {
                              enemyRole: e.target.value as "normal" | "boss",
                            }),
                          )
                        }
                        value={workshopNode.questDraft?.enemyRole ?? "normal"}
                      >
                        <option value="normal">Normal</option>
                        <option value="boss">Boss</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <p className="island-hub-unlock-hint">
                      Pick one of three beats, or write your own prompt — it gets folded into the
                      premise.
                    </p>
                    <div className="island-hub-workshop-options">
                      {(
                        workshopNode.questDraft?.options ??
                        proposeBeatOptions(
                          workshopNode.kind,
                          activeChain.start,
                          workshopPlaceName(workshopNode),
                        )
                      ).map((option, index) => (
                        <button
                          className={`island-hub-workshop-option${
                            workshopNode.questDraft?.chosenIndex === index ? " is-picked" : ""
                          }`}
                          key={`${workshopNode.id}-${index}`}
                          onClick={() => {
                            replaceActiveChain(
                              StoryChainService.applyBeatChoice(
                                activeChain,
                                workshopNode.id,
                                { index },
                                workshopPlaceName(workshopNode),
                              ),
                            );
                            if (workshopIndex < workshopBeats.length - 1) {
                              setWorkshopIndex((i) => i + 1);
                              setCustomPromptDraft("");
                            }
                          }}
                          type="button"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <label className="island-hub-unlock-field">
                      Your prompt
                      <textarea
                        onChange={(e) => setCustomPromptDraft(e.target.value)}
                        placeholder="Write what you want — it will be adapted to this story."
                        rows={2}
                        value={customPromptDraft}
                      />
                    </label>
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        if (!customPromptDraft.trim()) {
                          return;
                        }
                        replaceActiveChain(
                          StoryChainService.applyBeatChoice(
                            activeChain,
                            workshopNode.id,
                            { customPrompt: customPromptDraft },
                            workshopPlaceName(workshopNode),
                          ),
                        );
                      }}
                      type="button"
                    >
                      Use my prompt
                    </button>
                  </>
                )}
                <div className="island-hub-workshop-nav">
                  <button
                    className="ghost-btn"
                    disabled={workshopIndex <= 0}
                    onClick={() => {
                      setWorkshopIndex((i) => Math.max(0, i - 1));
                      setCustomPromptDraft("");
                    }}
                    type="button"
                  >
                    Prev
                  </button>
                  <button
                    className="ghost-btn"
                    disabled={workshopIndex >= workshopBeats.length - 1}
                    onClick={() => {
                      setWorkshopIndex((i) => Math.min(workshopBeats.length - 1, i + 1));
                      setCustomPromptDraft("");
                    }}
                    type="button"
                  >
                    Next
                  </button>
                  {!workshopNode.placedHotspotId ? (
                    <button
                      className="run-btn"
                      onClick={() => placeWorkshopNode(workshopNode.id)}
                      type="button"
                    >
                      Place on map
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {showChainDetails ? (
              <div className="island-hub-story-fields">
                <p className="island-hub-unlock-children-title">Start</p>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="premise"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="Premise"
                  />
                  <textarea
                    onChange={(e) =>
                      patchActiveChain({ start: { ...activeChain.start, premise: e.target.value } })
                    }
                    placeholder="What kicks this off…"
                    rows={2}
                    value={activeChain.start.premise ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="twist"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="Plot twist (optional)"
                  />
                  <input
                    onChange={(e) =>
                      patchActiveChain({ start: { ...activeChain.start, twist: e.target.value } })
                    }
                    type="text"
                    value={activeChain.start.twist ?? ""}
                  />
                </label>
                <div className="island-hub-unlock-row wrap">
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="dialogue"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Dialogue beats"
                    />
                    <input
                      min={0}
                      max={8}
                      onChange={(e) =>
                        patchActiveChain({
                          start: { ...activeChain.start, dialogueBeats: Number(e.target.value) },
                        })
                      }
                      type="number"
                      value={activeChain.start.dialogueBeats ?? 0}
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="battles"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Battles"
                    />
                    <input
                      min={0}
                      max={8}
                      onChange={(e) =>
                        patchActiveChain({
                          start: { ...activeChain.start, battlesCount: Number(e.target.value) },
                        })
                      }
                      type="number"
                      value={activeChain.start.battlesCount ?? 0}
                    />
                  </label>
                  <label className="island-hub-unlock-child-toggle">
                    <input
                      checked={Boolean(activeChain.start.bossBattle)}
                      onChange={(e) =>
                        patchActiveChain({
                          start: { ...activeChain.start, bossBattle: e.target.checked },
                        })
                      }
                      type="checkbox"
                    />
                    <ThreadFieldLabel
                      fieldKey="boss"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Boss battle"
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="events"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Events"
                    />
                    <input
                      min={0}
                      max={8}
                      onChange={(e) =>
                        patchActiveChain({
                          start: { ...activeChain.start, eventsCount: Number(e.target.value) },
                        })
                      }
                      type="number"
                      value={activeChain.start.eventsCount ?? 0}
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="investigate"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Investigations"
                    />
                    <input
                      min={0}
                      max={8}
                      onChange={(e) =>
                        patchActiveChain({
                          start: {
                            ...activeChain.start,
                            investigationsCount: Number(e.target.value),
                          },
                        })
                      }
                      type="number"
                      value={activeChain.start.investigationsCount ?? 0}
                    />
                  </label>
                </div>
                <div className="island-hub-unlock-row wrap">
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="tone"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Tone"
                    />
                    <select
                      onChange={(e) =>
                        patchActiveChain({
                          start: { ...activeChain.start, tone: e.target.value || undefined },
                        })
                      }
                      value={activeChain.start.tone ?? ""}
                    >
                      <option value="">—</option>
                      {STORY_CHAIN_TONES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="importance"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Importance"
                    />
                    <input
                      max={5}
                      min={1}
                      onChange={(e) =>
                        patchActiveChain({
                          start: { ...activeChain.start, importance: Number(e.target.value) },
                        })
                      }
                      type="number"
                      value={activeChain.start.importance ?? 3}
                    />
                  </label>
                </div>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="restrictions"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="Restrictions"
                  />
                  <input
                    onChange={(e) =>
                      patchActiveChain({
                        start: { ...activeChain.start, restrictions: e.target.value },
                      })
                    }
                    type="text"
                    value={activeChain.start.restrictions ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="mustHappen"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="Must happen"
                  />
                  <input
                    onChange={(e) =>
                      patchActiveChain({
                        start: { ...activeChain.start, mustHappen: e.target.value },
                      })
                    }
                    type="text"
                    value={activeChain.start.mustHappen ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="mustNot"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="Must not happen"
                  />
                  <input
                    onChange={(e) =>
                      patchActiveChain({
                        start: { ...activeChain.start, mustNotHappen: e.target.value },
                      })
                    }
                    type="text"
                    value={activeChain.start.mustNotHappen ?? ""}
                  />
                </label>
                <p className="island-hub-unlock-children-title">End</p>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="resolution"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="Resolution"
                  />
                  <textarea
                    onChange={(e) =>
                      patchActiveChain({ end: { ...activeChain.end, resolution: e.target.value } })
                    }
                    rows={2}
                    value={activeChain.end.resolution ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="endTwist"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="End twist"
                  />
                  <input
                    onChange={(e) =>
                      patchActiveChain({ end: { ...activeChain.end, twist: e.target.value } })
                    }
                    type="text"
                    value={activeChain.end.twist ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-field">
                  <ThreadFieldLabel
                    fieldKey="conclusions"
                    onToggle={setThreadHelpKey}
                    openKey={threadHelpKey}
                    text="Possible conclusions (one per line)"
                  />
                  <textarea
                    onChange={(e) =>
                      patchActiveChain({
                        end: {
                          ...activeChain.end,
                          possibleConclusions: e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    rows={2}
                    value={(activeChain.end.possibleConclusions ?? []).join("\n")}
                  />
                </label>
                <p className="island-hub-unlock-children-title">Unlocks</p>
                <div className="island-hub-unlock-row wrap">
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="unlockHotspot"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Unlock icon"
                    />
                    <input
                      onChange={(e) =>
                        patchActiveChain({
                          end: {
                            ...activeChain.end,
                            unlocks: { ...activeChain.end.unlocks, hotspotId: e.target.value || undefined },
                          },
                        })
                      }
                      placeholder="Icon / hotspot id"
                      type="text"
                      value={activeChain.end.unlocks?.hotspotId ?? ""}
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="unlockQuest"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Quest id"
                    />
                    <input
                      onChange={(e) =>
                        patchActiveChain({
                          end: {
                            ...activeChain.end,
                            unlocks: { ...activeChain.end.unlocks, questId: e.target.value || undefined },
                          },
                        })
                      }
                      placeholder="Quest id"
                      type="text"
                      value={activeChain.end.unlocks?.questId ?? ""}
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="unlockNpc"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="NPC"
                    />
                    <input
                      onChange={(e) =>
                        patchActiveChain({
                          end: {
                            ...activeChain.end,
                            unlocks: { ...activeChain.end.unlocks, npcId: e.target.value || undefined },
                          },
                        })
                      }
                      placeholder="NPC id"
                      type="text"
                      value={activeChain.end.unlocks?.npcId ?? ""}
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    <ThreadFieldLabel
                      fieldKey="unlockIsland"
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text="Unlock island"
                    />
                    <select
                      onChange={(e) =>
                        patchActiveChain({
                          end: {
                            ...activeChain.end,
                            unlocks: { ...activeChain.end.unlocks, islandId: e.target.value || undefined },
                          },
                        })
                      }
                      value={activeChain.end.unlocks?.islandId ?? ""}
                    >
                      <option value="">This island —</option>
                      {(run?.islands ?? []).map((isle) => (
                        <option key={isle.id} value={isle.id}>
                          {isle.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="island-hub-unlock-children-title">End effects (when End fires)</p>
                {(
                  [
                    ["world", "World"],
                    ["relationship", "Relationship"],
                    ["faction", "Faction"],
                    ["legacy", "Legacy"],
                    ["worldNews", "World news"],
                    ["title", "Title"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="island-hub-unlock-field" key={key}>
                    <ThreadFieldLabel
                      fieldKey={key}
                      onToggle={setThreadHelpKey}
                      openKey={threadHelpKey}
                      text={label}
                    />
                    <input
                      onChange={(e) =>
                        patchActiveChain({
                          end: {
                            ...activeChain.end,
                            effects: { ...activeChain.end.effects, [key]: e.target.value },
                          },
                        })
                      }
                      type="text"
                      value={activeChain.end.effects?.[key] ?? ""}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            {nestPickNodeId ? (
              <p className="island-hub-unlock-hint">
                Click the map to place a new icon, or click an existing icon to nest
                {nestChildId ? ` (suboption ${nestChildId})` : ""}. Esc cancels.
              </p>
            ) : (
              <p className="island-hub-unlock-hint">
                Generated fiches (template, not live AI). Nest a row, then click the map — they stay in
                this queue until you place them.
              </p>
            )}
            <ul className="island-hub-story-unplaced">
              {unplacedNodes.map((node) => (
                <li
                  draggable
                  key={node.id}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/story-node", node.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <span>
                    #{node.order} {node.label || node.kind}
                    {storyChainNodeOriginLabel(node.editState)
                      ? ` · ${storyChainNodeOriginLabel(node.editState)}`
                      : ""}
                    {node.suggestedHotspotId ? " · match" : ""}
                    {node.notes ? ` — ${node.notes}` : ""}
                  </span>
                  <select
                    onChange={(e) => {
                      const kind = e.target.value as (typeof STORY_CHAIN_TRIGGER_OPTIONS)[number]["value"] | "";
                      if (!kind || !activeChain) {
                        return;
                      }
                      replaceActiveChain(StoryChainService.setNodeTrigger(activeChain, node.id, { kind }));
                    }}
                    value={node.trigger?.kind ?? ""}
                  >
                    <option value="">Trigger…</option>
                    {STORY_CHAIN_TRIGGER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    onChange={(e) => {
                      const hotspot = draft.find((h) => h.hotspotId === e.target.value);
                      if (hotspot) {
                        nestNodeOntoHotspot(node.id, hotspot, nestChildId || undefined);
                      }
                    }}
                    value=""
                  >
                    <option value="">Assign…</option>
                    {draft.map((h) => (
                      <option key={h.hotspotId} value={h.hotspotId}>
                        {StoryChainService.hotspotOptionLabel(h)}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`ghost-btn${nestPickNodeId === node.id ? " is-active" : ""}`}
                    onClick={() => {
                      setNestPickNodeId((id) => (id === node.id ? null : node.id));
                      setLinkPickMode(false);
                      setRevealPickSourceId(null);
                    }}
                    type="button"
                  >
                    Nest
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() =>
                      replaceActiveChain(
                        StoryChainService.setNodeEditState(
                          activeChain,
                          node.id,
                          node.editState === "locked" ? "edited" : "locked",
                        ),
                      )
                    }
                    type="button"
                  >
                    {node.editState === "locked" ? "Unlock" : "Lock"}
                  </button>
                  {node.kind !== "start" && node.kind !== "end" ? (
                    <button className="ghost-btn" onClick={() => removeChainNode(node.id)} type="button">
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="island-hub-unlock-row">
              <label className="island-hub-unlock-field">
                <ThreadFieldLabel
                  fieldKey="nestChild"
                  onToggle={setThreadHelpKey}
                  openKey={threadHelpKey}
                  text="Nest as suboption"
                />
                <select onChange={(e) => setNestChildId(e.target.value)} value={nestChildId}>
                  <option value="">Map icon click</option>
                  {Array.from(
                    new Set(
                      draft.flatMap((h) =>
                        editorChildSlotsFor(h.facilityId).map((s) => s.childId),
                      ),
                    ),
                  ).map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {placedNodes.length > 0 ? (
              <>
                <p className="island-hub-unlock-hint">Nested on map</p>
                <ul className="island-hub-story-unplaced">
                  {placedNodes.map((node) => (
                    <li key={node.id}>
                      <span>
                        #{node.order} {node.label || node.kind} → {node.trigger?.kind}
                        {node.toIslandId ? " · other island" : ""}
                      </span>
                      {otherIslands.length > 0 ? (
                        <select
                          onChange={(e) =>
                            nestNodeCrossIsland(
                              node.id,
                              e.target.value,
                              otherIslands.find((i) => i.id === e.target.value)?.mapAssetId ?? undefined,
                            )
                          }
                          value={node.toIslandId ?? ""}
                        >
                          <option value="">This island</option>
                          {otherIslands.map((isle) => (
                            <option key={isle.id} value={isle.id}>
                              {isle.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <button
                        className="ghost-btn"
                        onClick={() => replaceActiveChain(StoryChainService.unnestNode(activeChain, node.id))}
                        type="button"
                      >
                        Unplace
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : (
          <>
            <button className="run-btn run-btn-accent island-hub-thread-create" onClick={createChain} type="button">
              + Thread
            </button>
            <p className="island-hub-unlock-hint">
              Open a thread to edit it, or remove one after confirm.
            </p>
            {draftStoryChains.length === 0 && unboundBeginHotspots.length === 0 ? (
              <p className="island-hub-unlock-hint">
                No threads on this map yet. Use + Thread, or place Quest / Event / Talk.
              </p>
            ) : (
              <ul className="island-hub-icon-list">
                {draftStoryChains.map((chain) => {
                  const startFacility = storyChainStartFacility(chain, draft);
                  const startPlaced = storyChainStartIsPlaced(chain);
                  const endPlaced = storyChainEndIsPlaced(chain);
                  const unplaced = unplacedStoryChainQueue(chain).length;
                  const selected = Boolean(
                    selectedInstanceId &&
                      chain.nodes.some((n) => n.placedHotspotId === selectedInstanceId),
                  );
                  const confirming = confirmRemoveChainId === chain.id;
                  return (
                    <li className="island-hub-thread-list-item" key={chain.id}>
                      <div className="island-hub-thread-list-main">
                        <button
                          className={`island-hub-icon-list-row${selected ? " is-selected" : ""}`}
                          onClick={() => openThreadDetail(chain.id)}
                          type="button"
                        >
                          <img alt="" draggable={false} src={hotspotIconSrc(startFacility ?? "QUEST")} />
                          <span>
                            <strong>{chain.name}</strong>
                            <span className="island-hub-unlock-preview-meta">
                              {threadTypeLabel(startFacility)} · start{" "}
                              {startPlaced ? "placed" : "unplaced"} · end{" "}
                              {endPlaced ? "placed" : "unplaced"} · {unplaced} unplaced fiche
                              {unplaced === 1 ? "" : "s"}
                            </span>
                          </span>
                        </button>
                        {onResetStoryChain ? (
                          <button
                            className="ghost-btn"
                            onClick={() => {
                              onResetStoryChain(chain.id);
                              setStatus(`Reset “${chain.name}” — start it again from the quest icon.`);
                            }}
                            type="button"
                          >
                            Reset
                          </button>
                        ) : null}
                        <button
                          className="ghost-btn"
                          onClick={() => setConfirmRemoveChainId(chain.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      {confirming ? (
                        <div className="island-hub-thread-confirm">
                          <p>Remove “{chain.name}”? This cannot be undone.</p>
                          <div className="island-hub-unlock-row">
                            <button className="run-btn" onClick={() => removeChain(chain.id)} type="button">
                              Yes, remove
                            </button>
                            <button
                              className="ghost-btn"
                              onClick={() => setConfirmRemoveChainId(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
                {unboundBeginHotspots.map((h) => (
                  <li key={h.hotspotId}>
                    <button
                      className={`island-hub-icon-list-row${
                        selectedInstanceId === h.hotspotId ? " is-selected" : ""
                      }`}
                      onClick={() => adoptBeginHotspotAsThread(h)}
                      type="button"
                    >
                      <img alt="" draggable={false} src={hotspotIconSrc(h.facilityId)} />
                      <span>
                        <strong>{h.purpose?.trim() || hotspotLabel(h.facilityId)}</strong>
                        <span className="island-hub-unlock-preview-meta">
                          {threadTypeLabel(h.facilityId)} · no chain yet
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        </div>
      </aside>
    ) : null;

  const threadComposerPanel =
    editing && authorTab === "thread" && threadComposer && activeChain ? (
      <aside
        aria-label="Thread composer"
        className="island-hub-thread-composer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="island-hub-unlock-head">
          <p className="island-hub-unlock-title">{activeChain.name || "Thread"}</p>
          <div className="island-hub-unlock-row">
            {onResetStoryChain ? (
              <button
                className="ghost-btn"
                onClick={() => {
                  onResetStoryChain(activeChain.id);
                  setStatus(`Reset “${activeChain.name}” — start it again from the quest icon.`);
                }}
                type="button"
              >
                Reset
              </button>
            ) : null}
            <button
              className="ghost-btn island-hub-unlock-close"
              onClick={() => {
                setThreadComposer(null);
                setConfirmRemoveChainId(null);
              }}
              type="button"
            >
              Back to threads
            </button>
          </div>
        </div>
        {authorTabs}
        <div className="island-hub-unlock-scroll island-hub-thread-composer-body">
          {threadComposer === "setup" ? (
            <>
              <p className="island-hub-unlock-hint">
                The premise is the opening at the quest icon — often nested under Market. Then set
                the order of what happens next. Generate walks those beats one by one.
              </p>
              <label className="island-hub-unlock-field">
                Name
                <input
                  onChange={(e) => patchActiveChain({ name: e.target.value })}
                  placeholder="Thread name"
                  type="text"
                  value={activeChain.name}
                />
              </label>
              <label className="island-hub-unlock-field">
                Quest icon lives under
                <select
                  onChange={(e) =>
                    patchActiveChain({
                      start: {
                        ...activeChain.start,
                        startHub: (e.target.value || undefined) as StoryChainStartHub | undefined,
                      },
                    })
                  }
                  value={activeChain.start.startHub ?? ""}
                >
                  <option value="">Place later</option>
                  {STORY_CHAIN_START_HUBS.map((hub) => (
                    <option key={hub.value} value={hub.value}>
                      {hub.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="island-hub-unlock-field">
                How it starts
                <textarea
                  onChange={(e) =>
                    patchActiveChain({ start: { ...activeChain.start, premise: e.target.value } })
                  }
                  placeholder="The player taps the quest icon. What do they hear first? e.g. the merchant is out of fish."
                  rows={3}
                  value={activeChain.start.premise ?? ""}
                />
              </label>
              <label className="island-hub-unlock-field">
                How it ends
                <textarea
                  onChange={(e) =>
                    patchActiveChain({ end: { ...activeChain.end, resolution: e.target.value } })
                  }
                  placeholder="How the quest wraps. e.g. they bring the sea king back to the merchant."
                  rows={2}
                  value={activeChain.end.resolution ?? ""}
                />
              </label>
              <p className="island-hub-unlock-children-title">What happens next — in order</p>
              <p className="island-hub-unlock-hint">
                Dialogue, event, battle, investigation. Example: Dialogue (not enough fish) → Event
                (fishing choices) → Battle (sea king).
              </p>
              {editorBeatPlan.length === 0 ? (
                <p className="island-hub-unlock-hint">No beats yet. Add the first one below.</p>
              ) : (
                <ol className="island-hub-beat-plan">
                  {editorBeatPlan.map((item, index) => (
                    <li className="island-hub-beat-plan-row" key={item.id}>
                      <span className="island-hub-beat-plan-index">{index + 1}</span>
                      <strong>
                        {STORY_BEAT_PLAN_KIND_OPTIONS.find((opt) => opt.value === item.kind)?.label ??
                          item.kind}
                      </strong>
                      <input
                        onChange={(e) =>
                          patchBeatPlan(
                            editorBeatPlan.map((row) =>
                              row.id === item.id ? { ...row, note: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="What this beat is about…"
                        type="text"
                        value={item.note ?? ""}
                      />
                      <button
                        className="ghost-btn"
                        disabled={index === 0}
                        onClick={() => {
                          const next = editorBeatPlan.slice();
                          const swap = next[index - 1];
                          next[index - 1] = next[index];
                          next[index] = swap;
                          patchBeatPlan(next);
                        }}
                        type="button"
                      >
                        Up
                      </button>
                      <button
                        className="ghost-btn"
                        disabled={index === editorBeatPlan.length - 1}
                        onClick={() => {
                          const next = editorBeatPlan.slice();
                          const swap = next[index + 1];
                          next[index + 1] = next[index];
                          next[index] = swap;
                          patchBeatPlan(next);
                        }}
                        type="button"
                      >
                        Down
                      </button>
                      <button
                        className="ghost-btn"
                        onClick={() => patchBeatPlan(editorBeatPlan.filter((row) => row.id !== item.id))}
                        type="button"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="island-hub-beat-plan-add">
                {STORY_BEAT_PLAN_KIND_OPTIONS.map((opt) => (
                  <button
                    className="ghost-btn"
                    disabled={editorBeatPlan.length >= 16}
                    key={opt.value}
                    onClick={() =>
                      patchBeatPlan([...editorBeatPlan, createBeatPlanItem(opt.value as StoryBeatPlanKind)])
                    }
                    type="button"
                  >
                    + {opt.label}
                  </button>
                ))}
              </div>
              <label className="island-hub-unlock-field">
                Tone
                <select
                  onChange={(e) =>
                    patchActiveChain({
                      start: { ...activeChain.start, tone: e.target.value || undefined },
                    })
                  }
                  value={activeChain.start.tone ?? ""}
                >
                  <option value="">Any</option>
                  {STORY_CHAIN_TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="island-hub-unlock-field">
                Plot twist (optional)
                <input
                  onChange={(e) =>
                    patchActiveChain({ start: { ...activeChain.start, twist: e.target.value } })
                  }
                  type="text"
                  value={activeChain.start.twist ?? ""}
                />
              </label>
              <div className="island-hub-story-cta">
                <button className="run-btn run-btn-accent island-hub-thread-create" onClick={generateActiveChain} type="button">
                  Generate story
                </button>
                {activeChain.generationFingerprint ? (
                  <button className="ghost-btn" onClick={() => setThreadComposer("workshop")} type="button">
                    Continue beats
                  </button>
                ) : null}
              </div>
            </>
          ) : showWorkshop && workshopNode ? (
            <div className="island-hub-workshop">
              <p className="island-hub-unlock-children-title">
                Beat {Math.min(workshopIndex, workshopBeats.length - 1) + 1} of {workshopBeats.length}
              </p>
              <p className="island-hub-workshop-kicker">
                {workshopNode.label || workshopNode.kind}
                {workshopNode.questDraft?.npcName ? ` · ${workshopNode.questDraft.npcName}` : ""}
                {workshopPlaceName(workshopNode)
                  ? ` · ${workshopPlaceName(workshopNode)}`
                  : ""}
                {workshopNode.placedHotspotId ? " · on map" : ""}
              </p>
              {workshopNode.questDraft?.dialogueLines?.length ? (
                <p className="island-hub-unlock-hint">
                  {workshopNode.questDraft.dialogueLines.join(" ")}
                </p>
              ) : null}
              {workshopNode.kind === "battle" || workshopNode.kind === "boss" ? (
                <>
                  <p className="island-hub-unlock-hint">
                    {workshopNode.questDraft?.battleSuggestion ||
                      "A fight is suggested here. Tune the pack, then keep or change it."}
                  </p>
                  <label className="island-hub-unlock-field">
                    Enemies
                    <input
                      max={8}
                      min={1}
                      onChange={(e) =>
                        replaceActiveChain(
                          StoryChainService.applyBattleDraft(activeChain, workshopNode.id, {
                            enemyCount: Number(e.target.value),
                          }),
                        )
                      }
                      type="number"
                      value={workshopNode.questDraft?.enemyCount ?? 3}
                    />
                  </label>
                  <label className="island-hub-unlock-field">
                    Strength
                    <select
                      onChange={(e) =>
                        replaceActiveChain(
                          StoryChainService.applyBattleDraft(activeChain, workshopNode.id, {
                            enemyStrength: e.target.value as "weak" | "normal" | "strong",
                          }),
                        )
                      }
                      value={workshopNode.questDraft?.enemyStrength ?? "normal"}
                    >
                      <option value="weak">Weak</option>
                      <option value="normal">Normal</option>
                      <option value="strong">Strong</option>
                    </select>
                  </label>
                  <label className="island-hub-unlock-field">
                    Type
                    <select
                      onChange={(e) =>
                        replaceActiveChain(
                          StoryChainService.applyBattleDraft(activeChain, workshopNode.id, {
                            enemyRole: e.target.value as "normal" | "boss",
                          }),
                        )
                      }
                      value={workshopNode.questDraft?.enemyRole ?? "normal"}
                    >
                      <option value="normal">Normal</option>
                      <option value="boss">Boss</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <p className="island-hub-unlock-hint">
                    Pick one of three beats, or write your own prompt — it gets folded into the
                    premise.
                  </p>
                  <div className="island-hub-workshop-options">
                    {(
                      workshopNode.questDraft?.options ??
                      proposeBeatOptions(
                        workshopNode.kind,
                        activeChain.start,
                        workshopPlaceName(workshopNode),
                      )
                    ).map((option, index) => (
                      <button
                        className={`island-hub-workshop-option${
                          workshopNode.questDraft?.chosenIndex === index ? " is-picked" : ""
                        }`}
                        key={`${workshopNode.id}-${index}`}
                        onClick={() => {
                          replaceActiveChain(
                            StoryChainService.applyBeatChoice(
                              activeChain,
                              workshopNode.id,
                              { index },
                              workshopPlaceName(workshopNode),
                            ),
                          );
                          if (workshopIndex < workshopBeats.length - 1) {
                            setWorkshopIndex((i) => i + 1);
                            setCustomPromptDraft("");
                          }
                        }}
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <label className="island-hub-unlock-field">
                    Your prompt
                    <textarea
                      onChange={(e) => setCustomPromptDraft(e.target.value)}
                      placeholder="Write what you want — it will be adapted to this story."
                      rows={3}
                      value={customPromptDraft}
                    />
                  </label>
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      if (!customPromptDraft.trim()) {
                        return;
                      }
                      replaceActiveChain(
                        StoryChainService.applyBeatChoice(
                          activeChain,
                          workshopNode.id,
                          { customPrompt: customPromptDraft },
                          workshopPlaceName(workshopNode),
                        ),
                      );
                      if (workshopIndex < workshopBeats.length - 1) {
                        setWorkshopIndex((i) => i + 1);
                        setCustomPromptDraft("");
                      }
                    }}
                    type="button"
                  >
                    Use my prompt
                  </button>
                </>
              )}
              <div className="island-hub-workshop-nav">
                <button
                  className="ghost-btn"
                  disabled={workshopIndex <= 0}
                  onClick={() => {
                    setWorkshopIndex((i) => Math.max(0, i - 1));
                    setCustomPromptDraft("");
                  }}
                  type="button"
                >
                  Prev
                </button>
                {workshopIndex >= workshopBeats.length - 1 ? (
                  <button
                    className="run-btn run-btn-accent"
                    onClick={() => setThreadComposer(null)}
                    type="button"
                  >
                    Done
                  </button>
                ) : (
                  <button
                    className="run-btn run-btn-accent"
                    onClick={() => {
                      setWorkshopIndex((i) => Math.min(workshopBeats.length - 1, i + 1));
                      setCustomPromptDraft("");
                    }}
                    type="button"
                  >
                    Next
                  </button>
                )}
                {!workshopNode.placedHotspotId ? (
                  <button
                    className="run-btn"
                    onClick={() => placeWorkshopNode(workshopNode.id)}
                    type="button"
                  >
                    Place on map
                  </button>
                ) : null}
                <button className="ghost-btn" onClick={() => setThreadComposer("setup")} type="button">
                  Edit basics
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="island-hub-unlock-hint">
                No dialogue, event, battle or investigation beats yet. Add counts in the basics and
                generate again.
              </p>
              <button className="run-btn run-btn-accent" onClick={() => setThreadComposer("setup")} type="button">
                Edit basics
              </button>
            </>
          )}
        </div>
      </aside>
    ) : null;

  const listPanel =
    editing && authorTab === "list" && !showListDetail ? (
      <aside className="island-hub-unlock-panel" aria-label="Map icon list" onClick={(e) => e.stopPropagation()}>
        <div className="island-hub-unlock-head">
          <p className="island-hub-unlock-title">List</p>
        </div>
        {authorTabs}
        <div className="island-hub-unlock-scroll">
          <div className="island-hub-list-filters">
            {LIST_KIND_FILTERS.map((entry) => (
              <button
                className={`ghost-btn${listKindFilter === entry.id ? " is-active" : ""}`}
                key={entry.id}
                onClick={() => setListKindFilter(entry.id)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
          {listHotspots.length === 0 ? (
            <p className="island-hub-unlock-hint">No icons on this map match the filter.</p>
          ) : (
            <ul className="island-hub-icon-list">
              {listHotspots.map((h) => (
                <li key={h.hotspotId}>
                  <button
                    className={`island-hub-icon-list-row${
                      selectedInstanceId === h.hotspotId ? " is-selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedInstanceId(h.hotspotId);
                      loadAuthoringFromHotspot(h, { keepTab: true });
                      setListDetailOpen(true);
                    }}
                    type="button"
                  >
                    <img alt="" draggable={false} src={hotspotIconSrc(h.facilityId)} />
                    <span>
                      <strong>{h.purpose?.trim() || hotspotLabel(h.facilityId)}</strong>
                      <span className="island-hub-unlock-preview-meta">
                        {hotspotListKind(h.facilityId)} · {h.facilityId} · {h.xPct.toFixed(0)}%,{" "}
                        {h.yPct.toFixed(0)}%{h.hidden ? " · hidden" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    ) : null;

  const explorePanel =
    editing && authorTab === "explore" ? (
      <aside className="island-hub-unlock-panel" aria-label="Explore icons" onClick={(e) => e.stopPropagation()}>
        <div className="island-hub-unlock-head">
          <p className="island-hub-unlock-title">Explore</p>
        </div>
        {authorTabs}
        <div className="island-hub-unlock-scroll">
          <p className="island-hub-unlock-hint">
            Explore / Investigate / Search / Scout on this map. Expand a row to assign icons it
            reveals. Each probe is one-shot in play.
          </p>
          {exploreHotspots.length === 0 ? (
            <p className="island-hub-unlock-hint">
              No Explore icons on this map. Place Explore from the palette, then return here to set
              reveals.
            </p>
          ) : (
            <ul className="island-hub-icon-list">
              {exploreHotspots.map((h) => {
                const expanded = expandedExploreId === h.hotspotId;
                const revealIds =
                  h.hotspotId === selectedInstanceId
                    ? pendingRevealsHotspotIds
                    : h.revealsHotspotIds ?? [];
                const pickingThis = revealPickSourceId === h.hotspotId;
                return (
                  <li className="island-hub-explore-item" key={h.hotspotId}>
                    <button
                      className={`island-hub-icon-list-row${
                        selectedInstanceId === h.hotspotId ? " is-selected" : ""
                      }${expanded ? " is-expanded" : ""}`}
                      onClick={() => {
                        if (expanded) {
                          setExpandedExploreId(null);
                          setRevealPickSourceId(null);
                          return;
                        }
                        setExpandedExploreId(h.hotspotId);
                        setSelectedInstanceId(h.hotspotId);
                        loadAuthoringFromHotspot(h, { keepTab: true });
                      }}
                      type="button"
                    >
                      <img alt="" draggable={false} src={hotspotIconSrc(h.facilityId)} />
                      <span>
                        <strong>{h.purpose?.trim() || hotspotLabel(h.facilityId)}</strong>
                        <span className="island-hub-unlock-preview-meta">
                          {h.facilityId} · {revealIds.length} reveal
                          {revealIds.length === 1 ? "" : "s"} · {h.xPct.toFixed(0)}%,{" "}
                          {h.yPct.toFixed(0)}%
                          {sessionConsumedIds.has(h.hotspotId) ||
                          island.consumedHotspotIds?.includes(h.hotspotId)
                            ? isBrokenConsumedProbe(h, island, sessionRevealedIds)
                              ? " · stuck (restore)"
                              : " · used in play"
                            : ""}
                        </span>
                      </span>
                    </button>
                    {expanded ? (
                      <div className="island-hub-explore-reveals">
                        <div className="island-hub-unlock-section-head">
                          <p className="island-hub-unlock-children-title">Reveals after explore</p>
                          <div className="island-hub-unlock-section-actions">
                            <button
                              className={`ghost-btn${pickingThis ? " is-active" : ""}`}
                              onClick={() => {
                                if (pickingThis) {
                                  setRevealPickSourceId(null);
                                  setStatus(null);
                                  return;
                                }
                                setSelectedInstanceId(h.hotspotId);
                                loadAuthoringFromHotspot(h, { keepTab: true });
                                setRevealPickSourceId(h.hotspotId);
                                setLinkPickMode(false);
                                setStatus("Picking reveals — click map icons.");
                              }}
                              type="button"
                            >
                              {pickingThis ? "Picking…" : "Pick on map"}
                            </button>
                            {pickingThis ? (
                              <button
                                className="ghost-btn"
                                onClick={() => {
                                  setRevealPickSourceId(null);
                                  setStatus(null);
                                }}
                                type="button"
                              >
                                Done
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {pickingThis ? (
                          <p className="island-hub-unlock-hint">
                            Picking reveals — click map icons. Esc or Done to finish.
                          </p>
                        ) : (
                          <p className="island-hub-unlock-hint">
                            Icons that become visible after using this probe once.
                          </p>
                        )}
                        {sessionConsumedIds.has(h.hotspotId) ||
                        island.consumedHotspotIds?.includes(h.hotspotId) ? (
                          <div className="island-hub-unlock-row wrap">
                            <p className="island-hub-unlock-hint">
                              {isBrokenConsumedProbe(h, island, sessionRevealedIds)
                                ? "Used in play, but its reveal icons never unlocked. Restore to use it again."
                                : "Used in play — hidden until restored."}
                            </p>
                            <button
                              className="ghost-btn"
                              onClick={() => {
                                const exclusive = revealIds.filter((id) => {
                                  return !draft.some(
                                    (other) =>
                                      other.hotspotId !== h.hotspotId &&
                                      (sessionConsumedIds.has(other.hotspotId) ||
                                        island.consumedHotspotIds?.includes(other.hotspotId)) &&
                                      other.revealsHotspotIds?.includes(id),
                                  );
                                });
                                setSessionConsumedIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(h.hotspotId);
                                  return next;
                                });
                                if (exclusive.length) {
                                  setSessionRevealedIds((prev) => {
                                    const next = new Set(prev);
                                    for (const id of exclusive) {
                                      next.delete(id);
                                    }
                                    return next;
                                  });
                                }
                                onRestoreHotspot?.(h.hotspotId);
                                setStatus(
                                  `Restored ${hotspotAuthorName(h)} — usable in play again.`,
                                );
                              }}
                              type="button"
                            >
                              Restore
                            </button>
                          </div>
                        ) : null}
                        {revealIds.length === 0 ? (
                          <p className="island-hub-unlock-hint">No reveal targets yet.</p>
                        ) : (
                          revealIds.map((targetId) => {
                            const target = draft.find((x) => x.hotspotId === targetId);
                            return (
                              <div className="island-hub-unlock-row" key={targetId}>
                                <span className="island-hub-unlock-preview-meta">
                                  {target
                                    ? target.purpose?.trim() || hotspotLabel(target.facilityId)
                                    : targetId.slice(0, 10)}
                                  {target ? ` · ${target.facilityId}` : ""}
                                </span>
                                <button
                                  aria-label="Remove"
                                  className="ghost-btn island-hub-unlock-remove"
                                  onClick={() =>
                                    applyRevealsForHotspot(
                                      h.hotspotId,
                                      revealIds.filter((id) => id !== targetId),
                                    )
                                  }
                                  type="button"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })
                        )}
                        <label className="island-hub-unlock-field">
                          Add from placed icons
                          <select
                            onChange={(e) => {
                              const id = e.target.value;
                              if (!id) {
                                return;
                              }
                              if (!revealIds.includes(id)) {
                                applyRevealsForHotspot(h.hotspotId, [...revealIds, id]);
                              }
                              e.target.value = "";
                            }}
                            value=""
                          >
                            <option value="">Select hotspot…</option>
                            {draft
                              .filter((x) => x.hotspotId !== h.hotspotId)
                              .map((x) => (
                                <option key={x.hotspotId} value={x.hotspotId}>
                                  {x.purpose?.trim() || hotspotLabel(x.facilityId)} (
                                  {x.xPct.toFixed(0)}%, {x.yPct.toFixed(0)}%)
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    ) : null;

  const anchorsPanel =
    editing && authorTab === "anchors" ? (
      <aside className="island-hub-unlock-panel" aria-label="Location anchors" onClick={(e) => e.stopPropagation()}>
        <div className="island-hub-unlock-head">
          <p className="island-hub-unlock-title">Anchors</p>
        </div>
        {authorTabs}
        <div className="island-hub-unlock-scroll">
          <div className="island-hub-unlock-row wrap">
            <button
              className={`ghost-btn${hideOtherIcons ? " is-active" : ""}`}
              onClick={() => setHideOtherIcons((v) => !v)}
              type="button"
            >
              {hideOtherIcons ? "Show map icons" : "Hide map icons"}
            </button>
          </div>
          <p className="island-hub-unlock-hint">
            Pins and named areas only show on this tab. Hide map icons to see your anchors clearly.
          </p>
          <p className="island-hub-unlock-children-title">Location pins</p>
          <div className="island-hub-unlock-row wrap">
            <input
              onChange={(e) => setNewAnchorText(e.target.value)}
              placeholder="Place description"
              type="text"
              value={newAnchorText}
            />
            <button className="ghost-btn" onClick={addAnchor} type="button">
              + Anchor
            </button>
          </div>
          {draftAnchors.length === 0 && anchorHotspots.length === 0 ? (
            <p className="island-hub-unlock-hint">
              + Anchor creates a pin. You can edit name, tags, and AI use after placing.
            </p>
          ) : (
            <ul className="island-hub-anchor-list">
              {draftAnchors.map((anchor) => {
                const selected = selectedAnchorId === anchor.id;
                const placeState = anchor.hotspotId
                  ? "on map"
                  : pendingAnchorPlaceId === anchor.id
                    ? "placing"
                    : "unplaced";
                return (
                  <li
                    className={`island-hub-anchor-card${selected ? " is-selected" : ""}`}
                    key={anchor.id}
                  >
                    <button
                      className="island-hub-icon-list-row"
                      onClick={() => focusAnchor(anchor)}
                      type="button"
                    >
                      <span>
                        <strong>{anchor.description || "Untitled"}</strong>
                        <span className="island-hub-unlock-preview-meta">
                          {placeState} · {anchor.aiPermission}
                          {anchor.tags.length > 0 ? ` · ${anchor.tags.join(", ")}` : ""}
                        </span>
                      </span>
                    </button>
                    {selected ? (
                      <div className="island-hub-explore-reveals">
                        <input
                          onChange={(e) => patchAnchor(anchor.id, { description: e.target.value })}
                          placeholder="Name / description"
                          type="text"
                          value={anchor.description}
                        />
                        <input
                          onChange={(e) =>
                            patchAnchor(anchor.id, {
                              tags: e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="tags"
                          type="text"
                          value={anchor.tags.join(", ")}
                        />
                        <div className="island-hub-unlock-row wrap">
                          <select
                            onChange={(e) =>
                              patchAnchor(anchor.id, {
                                aiPermission: e.target.value as LocationAnchorAiPermission,
                              })
                            }
                            value={anchor.aiPermission}
                          >
                            <option value="never">Never</option>
                            <option value="suggest">Suggest</option>
                            <option value="auto">Auto-use</option>
                          </select>
                          {!anchor.hotspotId ? (
                            <button
                              className={`ghost-btn${pendingAnchorPlaceId === anchor.id ? " is-active" : ""}`}
                              onClick={() => {
                                setPendingAnchorPlaceId(anchor.id);
                                setSelectedAnchorId(anchor.id);
                                setPaletteId("LOCATION_ANCHOR");
                                setSelectedInstanceId(null);
                                setPendingUnlock(emptyUnlockDraft("LOCATION_ANCHOR"));
                                setPendingPurpose(anchor.description);
                                setRegionDrawMode(false);
                                setStatus("Click the map to place this location-anchor icon.");
                              }}
                              type="button"
                            >
                              Place
                            </button>
                          ) : null}
                          <button
                            className="ghost-btn"
                            onClick={() => removeAnchor(anchor.id)}
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="island-hub-unlock-children-title">Named areas</p>
          <div className="island-hub-unlock-row wrap">
            <input
              onChange={(e) => setNewRegionName(e.target.value)}
              placeholder="Area name"
              type="text"
              value={newRegionName}
            />
            <button
              className={`ghost-btn${regionDrawMode ? " is-active" : ""}`}
              onClick={() => {
                if (regionDrawMode) {
                  finishRegionDraw();
                  return;
                }
                setPaletteId(null);
                setPendingAnchorPlaceId(null);
                setRegionDrawMode(true);
                setRegionDraftPoints([]);
                setSelectedRegionId(null);
                setStatus("Click the map to outline an area. First and last point stay connected.");
              }}
              type="button"
            >
              {regionDrawMode ? "Finish" : "Draw area"}
            </button>
            {regionDrawMode ? (
              <button
                className="ghost-btn"
                onClick={() => {
                  setRegionDrawMode(false);
                  setRegionDraftPoints([]);
                  setStatus(null);
                }}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {regionDrawMode ? (
            <p className="island-hub-unlock-hint">
              Drawing — {regionDraftPoints.length} point{regionDraftPoints.length === 1 ? "" : "s"}
              {regionDraftPoints.length < 3 ? " (need 3+)" : ""}. Loop stays closed. Esc cancels.
            </p>
          ) : (
            <p className="island-hub-unlock-hint">
              Select an area, then drag points, click the map to add a point, right-click a point
              to remove it. First and last always connect.
            </p>
          )}
          {draftRegions.length === 0 ? (
            <p className="island-hub-unlock-hint">No named areas yet.</p>
          ) : (
            <ul className="island-hub-anchor-list">
              {draftRegions.map((region) => (
                <li
                  className={`island-hub-anchor-card${
                    selectedRegionId === region.id ? " is-selected" : ""
                  }`}
                  key={region.id}
                >
                  <button
                    className="island-hub-icon-list-row"
                    onClick={() => {
                      setSelectedRegionId(region.id);
                      setSelectedAnchorId(null);
                      setPaletteId(null);
                      setRegionDrawMode(false);
                    }}
                    type="button"
                  >
                    <span>
                      <strong>{region.name}</strong>
                      <span className="island-hub-unlock-preview-meta">
                        {region.points.length} pts · {region.aiPermission} · closed loop
                      </span>
                    </span>
                  </button>
                  {selectedRegionId === region.id ? (
                    <div className="island-hub-explore-reveals">
                      <div className="island-hub-unlock-row wrap">
                        <input
                          onChange={(e) => patchRegion(region.id, { name: e.target.value })}
                          placeholder="Area name"
                          type="text"
                          value={region.name}
                        />
                        <select
                          onChange={(e) =>
                            patchRegion(region.id, {
                              aiPermission: e.target.value as LocationAnchorAiPermission,
                            })
                          }
                          value={region.aiPermission}
                        >
                          <option value="never">Never</option>
                          <option value="suggest">Suggest</option>
                          <option value="auto">Auto-use</option>
                        </select>
                        <button className="ghost-btn" onClick={() => removeRegion(region.id)} type="button">
                          ×
                        </button>
                      </div>
                      <input
                        onChange={(e) => patchRegion(region.id, { notes: e.target.value || undefined })}
                        placeholder="Notes for AI"
                        type="text"
                        value={region.notes ?? ""}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    ) : null;

  const storyStrip =
    editing && unplacedNodes.length > 0 ? (
      <div className="island-hub-story-strip" aria-label="Unplaced story fiches">
        {unplacedNodes.map((node) => (
          <button
            className={`island-hub-story-fiche${nestPickNodeId === node.id ? " is-active" : ""}`}
            draggable
            key={node.id}
            onClick={() => {
              setAuthorTab("thread");
              setThreadDetailOpen(false);
              setThreadComposer("workshop");
              setNestPickNodeId((id) => (id === node.id ? null : node.id));
              setLinkPickMode(false);
              setRevealPickSourceId(null);
            }}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/story-node", node.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            title={`${node.label || node.kind} — click then click map to place`}
            type="button"
          >
            #{node.order} {node.label || node.kind}
          </button>
        ))}
      </div>
    ) : null;

  const childActions = useMemo(() => {
    if (!childMenu) {
      return [] as MapChildActionDef[];
    }
    const storyOptions = { storyChains: playStoryChains };
    const parent = displayHotspots.find((h) => h.hotspotId === childMenu.parentHotspotId);
    const actions = resolveChildActionsForHotspot(
      parent ?? {
        hotspotId: childMenu.parentHotspotId,
        facilityId: childMenu.facilityId,
        xPct: childMenu.xPct,
        yPct: childMenu.yPct,
      },
      island,
      run,
      storyOptions,
    );
    return actions.filter((action) =>
      StoryChainService.isPlayableStoryAction(run, playStoryChains, action.id),
    );
  }, [childMenu, displayHotspots, island, playStoryChains, run]);
  const childRadialOffsets = useMemo(() => {
    if (!childMenu) {
      return [] as RadialOffset[];
    }
    const rect = mapRef.current?.getBoundingClientRect();
    const width = Math.max(1, rect?.width ?? 800);
    const height = Math.max(1, rect?.height ?? 600);
    const harborCount = FACILITY_CHILD_ACTIONS.HARBOR?.length ?? 6;
    const radiusCount =
      childMenu.facilityId === "MARKET" ? Math.max(childActions.length, harborCount) : childActions.length;
    return computeRadialOffsets(
      childActions.length,
      childMenu.xPct,
      childMenu.yPct,
      width,
      height,
      iconScale,
      radiusCount,
    );
  }, [childMenu, childActions.length, iconScale]);
  const childOrbitRadius = useMemo(() => {
    if (!childMenu) {
      return 0;
    }
    const harborCount = FACILITY_CHILD_ACTIONS.HARBOR?.length ?? 6;
    const radiusCount =
      childMenu.facilityId === "MARKET" ? Math.max(childActions.length, harborCount) : childActions.length;
    return radialRadiusForCount(radiusCount, iconScale);
  }, [childMenu, childActions.length, iconScale]);

  const syncRadialOrbitWave = useCallback(
    (clientX: number, clientY: number) => {
      if (!childMenu?.open) {
        return;
      }
      const origin = childMenuRef.current?.getBoundingClientRect();
      if (!origin) {
        return;
      }
      const px = origin.left;
      const py = origin.top;
      const distFromParent = Math.hypot(clientX - px, clientY - py);
      const measured: { id: string; label: string; dist: number }[] = [];
      let measuredOrbit = 0;
      for (const action of childActions) {
        const node = childOrbitRefs.current[action.id];
        if (!node) {
          continue;
        }
        const box = node.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const dist = Math.hypot(clientX - cx, clientY - cy);
        measuredOrbit = Math.max(measuredOrbit, Math.hypot(cx - px, cy - py));
        measured.push({ id: action.id, label: action.label, dist });
        node.style.setProperty("--orbit-scale", radialOrbitWaveScale(dist).toFixed(3));
      }
      const orbitRadius =
        measuredOrbit > 0
          ? measuredOrbit
          : childOrbitRadius * (resolveIslandHubMapFocus(editing, childMenu) ? ISLAND_HUB_FOCUS_ZOOM : 1);
      const nearest = nearestRadialChildLabel(
        distFromParent,
        radialOrbitAuraRadius(orbitRadius),
        measured,
      );
      for (const action of childActions) {
        childOrbitRefs.current[action.id]?.classList.toggle("is-nearest", nearest?.id === action.id);
      }
      const nextLabel = nearest?.label ?? null;
      if (radialLabelRef.current !== nextLabel) {
        radialLabelRef.current = nextLabel;
        setHoveredChildLabel(nextLabel);
      }
    },
    [childActions, childMenu, childOrbitRadius, editing],
  );

  const mapFocus = resolveIslandHubMapFocus(editing, childMenu);
  /** Fade siblings with zoom: hide while focused/open, reappear as zoom reverses on close. */
  const hideSiblingHotspots = Boolean(mapFocus);
  /** Zoom around the active parent in place (siblings fade via CSS, timed to zoom). */
  const mapZoomStyle: CSSProperties | undefined = mapFocus
    ? {
        transformOrigin: `${mapFocus.xPct}% ${mapFocus.yPct}%`,
        transform: `translateZ(0) scale(${mapFocus.scale})`,
      }
    : undefined;

  const childMenuPanel =
    !editing && childMenu ? (
      <div
        aria-label={`${hotspotLabel(childMenu.facilityId)} actions`}
        className={`island-hub-child-menu${childMenu.open ? " is-open" : ""}`}
        ref={childMenuRef}
        role="menu"
        style={
          {
            left: `${clampPct(childMenu.xPct)}%`,
            top: `${clampPct(childMenu.yPct)}%`,
            "--stagger-max": `${Math.max(0, childActions.length - 1) * 35}ms`,
          } as CSSProperties
        }
      >
        {centerOverlayLabel ? (
          <div className="island-hub-child-center-label" aria-live="polite">
            {centerOverlayLabel}
          </div>
        ) : null}
        {childActions.map((action, index) => {
          const offset = childRadialOffsets[index] ?? { x: 0, y: 0 };
          return (
            <button
              aria-label={action.label}
              className="island-hub-child-orbit"
              key={action.id}
              onBlur={() => {
                if (radialLabelRef.current === action.label) {
                  radialLabelRef.current = null;
                  setHoveredChildLabel(null);
                }
                childOrbitRefs.current[action.id]?.classList.remove("is-nearest");
              }}
              onClick={() => resolveChildAction(action)}
              onFocus={() => {
                radialLabelRef.current = action.label;
                setHoveredChildLabel(action.label);
                for (const [id, node] of Object.entries(childOrbitRefs.current)) {
                  node?.classList.toggle("is-nearest", id === action.id);
                }
              }}
              ref={(node) => {
                childOrbitRefs.current[action.id] = node;
              }}
              role="menuitem"
              style={
                {
                  "--ox": `${offset.x}px`,
                  "--oy": `${offset.y}px`,
                  "--stagger": `${index * 35}ms`,
                } as CSSProperties
              }
              type="button"
            >
              <span className="island-hub-child-orbit-visual">
                <span aria-hidden className="island-hub-icon-glow" />
                <HubIconSparkles />
                <img alt="" draggable={false} src={childActionIconSrc(action)} />
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  const devTools =
    isDev && mapAssetId ? (
      <div className="island-hub-map-dev">
        {!editing ? (
          <button className="run-btn" onClick={beginEdit} type="button">
            Edit hotspots
          </button>
        ) : (
          <>
            {onChangeMapAsset ? (
              <label className="island-hub-snap">
                Map
                <select
                  onChange={(e) => {
                    onChangeMapAsset(e.target.value);
                    setMapFailed(false);
                  }}
                  value={mapAssetId}
                >
                  {ISLAND_MAP_ASSET_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id.replace(/^Island_/, "")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="island-hub-snap">
              Snap
              <select
                onChange={(e) => setSnapStep(Number(e.target.value) as (typeof SNAP_STEPS)[number])}
                value={snapStep}
              >
                <option value={0}>Off</option>
                <option value={1}>1%</option>
                <option value={5}>5%</option>
              </select>
            </label>
            <label className="island-hub-snap island-hub-icon-scale">
              Icons
              <input
                aria-label="Map icon size"
                max={180}
                min={60}
                onChange={(e) => setDraftIconScale(clampIconScale(Number(e.target.value) / 100))}
                step={5}
                type="range"
                value={Math.round(draftIconScale * 100)}
              />
              <span>{Math.round(draftIconScale * 100)}%</span>
            </label>
            <button className="run-btn" onClick={resetLayout} type="button">
              Reset layout
            </button>
            {selectedInstanceId ? (
              <>
                <button
                  className="run-btn"
                  onClick={removeSelected}
                  title="Delete this marker from the map. After Save it stays gone until you place it again from the palette."
                  type="button"
                >
                  Remove
                </button>
                <button
                  className="run-btn"
                  onClick={toggleHideSelected}
                  title="Hide keeps the marker in the layout but omits it in play. Unhide restores play visibility."
                  type="button"
                >
                  {selectedMeta?.hidden ? "Unhide" : "Hide"}
                </button>
                <button
                  className="run-btn"
                  onClick={() => {
                    setAuthorTab("list");
                    setListDetailOpen(true);
                  }}
                  type="button"
                >
                  Unlock / edit…
                </button>
              </>
            ) : null}
            <button className="run-btn run-btn-accent" onClick={saveEdit} type="button">
              Save positions
            </button>
            <button className="run-btn" onClick={cancelEdit} type="button">
              Cancel
            </button>
            <button className="run-btn" onClick={exportJson} type="button">
              Export JSON
            </button>
            <button className="run-btn" onClick={clearIslandOverrides} type="button">
              Clear overrides
            </button>
            {selectedMeta ? (
              <span className="island-hub-map-meta-inline">
                {selectedMeta.facilityId} @ {selectedMeta.xPct.toFixed(1)}%,{" "}
                {selectedMeta.yPct.toFixed(1)}% · {unlockRuleSummary(selectedMeta.unlock)}
                {selectedMeta.hidden ? " · hidden" : ""}
              </span>
            ) : (
              <span className="island-hub-map-meta-inline">
                Map: <code>{mapAssetId}</code>
                {paletteId ? ` · placing ${hotspotLabel(paletteId)}` : ""}
              </span>
            )}
          </>
        )}
      </div>
    ) : null;

  const toolsPortal = toolsHost && devTools ? createPortal(devTools, toolsHost) : null;
  const toolsFallback = !toolsHost && devTools ? (
    <div className="island-hub-map-dev-fallback">{devTools}</div>
  ) : null;

  if (!mapAssetId) {
    return (
      <section className="island-hub-map encounter-stage">
        <p className="island-hub-map-sub">Preparing island map…</p>
      </section>
    );
  }

  return (
    <section className={`island-hub-map encounter-stage${editing ? " is-editing-hub" : ""}`}>
      {toolsPortal}
      {toolsFallback}

      <div className="island-hub-map-body">
        {status ? (
          <p className="island-hub-map-status is-toast" role="status">
            {status}
          </p>
        ) : null}
        {stubNotice ? (
          <p className="island-hub-map-status is-stub is-toast" role="status">
            {stubNotice}
          </p>
        ) : null}
        {fishingOpen ? (
          <FishingMinigame
            seaKingHunt={Boolean(run && StoryChainService.seaKingHookAvailable(run))}
            onClose={() => setFishingOpen(false)}
            onFinish={(result) => onFinishFishing?.(result) ?? ""}
          />
        ) : null}
        {marketShopOpen && run ? (
          <MarketShopOverlay
            onBuy={(itemId, quantity) => onBuyMarketItem?.(itemId, quantity) ?? ""}
            onClose={() => setMarketShopOpen(false)}
            onSell={(itemId, quantity) => onSellMarketItem?.(itemId, quantity) ?? ""}
            run={run}
          />
        ) : null}
        {clinicShopOpen && run ? (
          <ClinicShopOverlay
            onBuy={(itemId, quantity) => onBuyClinicItem?.(itemId, quantity) ?? ""}
            onClose={() => setClinicShopOpen(false)}
            onSell={(itemId, quantity) => onSellClinicItem?.(itemId, quantity) ?? ""}
            run={run}
          />
        ) : null}
        {weaponShopOpen && run ? (
          <WeaponTradeShopOverlay
            onBuy={(listingId) => onBuyWeaponShopItem?.(listingId) ?? ""}
            onClose={() => setWeaponShopOpen(false)}
            onSell={(instanceId) => onSellWeaponShopItem?.(instanceId) ?? ""}
            run={run}
            stock={weaponShopStock}
          />
        ) : null}
        {shipOverlayOpen && run ? (
          <ShipOverlay
            initialTab={shipOverlayTab}
            onClose={() => setShipOverlayOpen(false)}
            run={run}
          />
        ) : null}
        {mapFailed ? (
          <div className="island-hub-map-missing">
            <p>
              Map art failed to load (<code>{islandMapSrc(mapAssetId)}</code>).
            </p>
            <div className="island-hub-map-missing-actions">
              <button className="choice-btn" onClick={retryMap} type="button">
                Retry map
              </button>
              {onRequestListFallback ? (
                <button className="ghost-btn" onClick={onRequestListFallback} type="button">
                  Use list view
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            className={`island-hub-map-stage${editing ? " is-editing" : ""}${
              paletteId && editing && !regionDrawMode ? " is-placing" : ""
            }${regionDrawMode ? " is-drawing-region" : ""}${mapFocus ? " is-focused" : ""}${hideSiblingHotspots ? " is-radial-open" : ""}`}
            style={{ "--island-hub-icon-scale": iconScale } as CSSProperties}
            onClick={onMapClick}
            onMouseLeave={() => {
              if (childMenu?.open) {
                resetRadialOrbitWave();
              }
            }}
            onMouseMove={(event) => {
              if (childMenu?.open) {
                syncRadialOrbitWave(event.clientX, event.clientY);
              }
            }}
            onPointerCancel={endDrag}
            onPointerMove={onMapPointerMove}
            onPointerUp={endDrag}
            ref={mapRef}
          >
            <div
              className={`island-hub-map-zoom${mapFocus ? " is-focused" : ""}`}
              style={mapZoomStyle}
            >
              <img
                alt=""
                className="island-hub-map-art"
                draggable={false}
                key={`${mapAssetId}-${imgNonce}`}
                onError={() => setMapFailed(true)}
                src={`${islandMapSrc(mapAssetId)}${imgNonce ? `?r=${imgNonce}` : ""}`}
              />
              {editing && authorTab === "anchors" ? (
                <svg
                  aria-hidden
                  className={`island-hub-region-layer${
                    regionDrawMode || paletteId ? " is-drawing" : ""
                  }`}
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  {draftRegions.map((region) => {
                    const center = regionCentroid(region.points);
                    const selected = selectedRegionId === region.id;
                    return (
                      <g key={region.id}>
                        <polygon
                          className={`island-hub-region${selected ? " is-selected" : ""}`}
                          onClick={(event) => {
                            if (regionDrawMode || paletteId) {
                              return;
                            }
                            event.stopPropagation();
                            if (selected) {
                              const { xPct, yPct } = pointerToPct(event.clientX, event.clientY);
                              patchRegion(region.id, {
                                points: insertPointOnClosestEdge(region.points, xPct, yPct),
                              });
                              setStatus("Added a point on the nearest edge.");
                              return;
                            }
                            setSelectedRegionId(region.id);
                            setSelectedAnchorId(null);
                            setPaletteId(null);
                          }}
                          points={region.points.map((p) => `${p.xPct},${p.yPct}`).join(" ")}
                        />
                        {center ? (
                          <text className="island-hub-region-label" x={center.xPct} y={center.yPct}>
                            {region.name}
                          </text>
                        ) : null}
                        {selected
                          ? region.points.map((p, index) => (
                              <circle
                                className={`island-hub-region-vertex${
                                  regionPointDrag?.regionId === region.id &&
                                  regionPointDrag.index === index
                                    ? " is-dragging"
                                    : ""
                                }`}
                                cx={p.xPct}
                                cy={p.yPct}
                                key={`${region.id}-pt-${index}`}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (region.points.length <= 3) {
                                    setStatus("A zone needs at least 3 points.");
                                    return;
                                  }
                                  removeRegionPoint(region.id, index);
                                }}
                                onPointerCancel={endDrag}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  event.preventDefault();
                                  skipRegionClickRef.current = true;
                                  if (event.button === 2) {
                                    return;
                                  }
                                  event.currentTarget.setPointerCapture(event.pointerId);
                                  setRegionPointDrag({
                                    regionId: region.id,
                                    index,
                                    pointerId: event.pointerId,
                                  });
                                }}
                                onPointerMove={onMapPointerMove}
                                onPointerUp={endDrag}
                                r={1.15}
                              />
                            ))
                          : null}
                      </g>
                    );
                  })}
                  {regionDraftPoints.length > 0 ? (
                    <polyline
                      className="island-hub-region-draft"
                      points={closedPolygonAttr(regionDraftPoints)}
                    />
                  ) : null}
                  {regionDraftPoints.map((p, index) => (
                    <circle
                      className="island-hub-region-draft-point"
                      cx={p.xPct}
                      cy={p.yPct}
                      key={`draft-${index}`}
                      r={0.9}
                    />
                  ))}
                </svg>
              ) : null}
              {editing && editorLinkEdges.length > 0 ? (
                <svg
                  aria-hidden
                  className="island-hub-link-layer"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  <defs>
                    <marker
                      id="island-hub-link-arrow"
                      markerHeight="5"
                      markerWidth="5"
                      orient="auto"
                      refX="4"
                      refY="2.5"
                      viewBox="0 0 5 5"
                    >
                      <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
                    </marker>
                    <marker
                      id="island-hub-link-arrow-ext"
                      markerHeight="5"
                      markerWidth="5"
                      orient="auto"
                      refX="4"
                      refY="2.5"
                      viewBox="0 0 5 5"
                    >
                      <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
                    </marker>
                  </defs>
                  {editorLinkEdges.map((edge) => (
                    <g
                      className={`island-hub-link-edge${edge.crossIsland ? " is-cross-island" : ""}`}
                      key={edge.key}
                    >
                      <line
                        markerEnd={
                          edge.crossIsland
                            ? "url(#island-hub-link-arrow-ext)"
                            : "url(#island-hub-link-arrow)"
                        }
                        strokeDasharray={edge.crossIsland ? "2 1.5" : undefined}
                        x1={edge.x1}
                        x2={edge.x2}
                        y1={edge.y1}
                        y2={edge.y2}
                      />
                      {edge.label ? (
                        <text
                          className="island-hub-link-label"
                          x={(edge.x1 + edge.x2) / 2}
                          y={(edge.y1 + edge.y2) / 2 - 1.2}
                        >
                          {edge.label}
                        </text>
                      ) : null}
                    </g>
                  ))}
                </svg>
              ) : null}
              {displayHotspots.map((hotspot) => {
                if (!hotspotPlayVisible(hotspot)) {
                  return null;
                }
                const id = hotspot.facilityId;
                const label = hotspotLabel(id);
                const choiceId = hotspotHubChoiceId(id);
                const facilityOk = !isFacilityHotspotId(id) || unlockedSet.has(id);
                const hasKids = editing
                  ? hasChildActions(id)
                  : hasVisibleChildActions(hotspot, island, run, playStoryChains);
                const isProbe = supportsRevealAuthoring(id) || Boolean(hotspot.consumeOnUse);
                const locked =
                  !hasKids &&
                  !isProbe &&
                  (Boolean(choiceId && lockReasons?.[choiceId]) ||
                    Boolean(choiceId && !choiceById.has(choiceId)) ||
                    (isFacilityHotspotId(id) && !facilityOk));
                const selected = selectedInstanceId === hotspot.hotspotId;
                const isRevealPickSource =
                  revealPickMode && revealPickSourceId === hotspot.hotspotId;
                const dimmed =
                  editing &&
                  (hotspot.hidden ||
                    !isHotspotVisibleInPlay(hotspot, island, run, unlockedSet));
                const isActiveParent = childMenu?.parentHotspotId === hotspot.hotspotId;
                const isSibling = Boolean(hideSiblingHotspots && !isActiveParent);
                return (
                  <button
                    aria-expanded={
                      hasKids ? isActiveParent && childMenu.open : undefined
                    }
                    aria-haspopup={hasKids ? "menu" : undefined}
                    aria-label={isActiveParent && childMenu.open ? "Return" : label}
                    className={`island-hub-hotspot${locked && !editing ? " is-locked" : ""}${
                      selected ? " is-selected" : ""
                    }${isRevealPickSource ? " is-reveal-pick-source" : ""}${
                      editing ? " is-draggable" : ""
                    }${dimmed ? " is-dimmed" : ""}${
                      id === "EXPLORE" ? " is-explore" : ""
                    }${isActiveParent ? " is-menu-open" : ""}${
                      isActiveParent && hoveredChildLabel ? " is-child-hovered" : ""
                    }${isActiveParent && isReturnHover ? " is-return-hover" : ""}${
                      hoveredHotspotId === hotspot.hotspotId && !isActiveParent
                        ? " is-icon-hovered"
                        : ""
                    }${isSibling ? " is-sibling" : ""}${
                      storyBadgeByHotspot.has(hotspot.hotspotId) ? " has-story" : ""
                    }`}
                    disabled={locked && !editing}
                    key={hotspot.hotspotId}
                    onClick={() => activateHotspot(hotspot)}
                    onDragOver={
                      editing
                        ? (event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "copy";
                          }
                        : undefined
                    }
                    onDrop={
                      editing
                        ? (event) => {
                            event.preventDefault();
                            const nodeId = event.dataTransfer.getData("text/story-node");
                            if (nodeId) {
                              nestNodeOntoHotspot(nodeId, hotspot, nestChildId || undefined);
                            }
                          }
                        : undefined
                    }
                    onMouseEnter={() => setHoveredHotspotId(hotspot.hotspotId)}
                    onMouseLeave={() =>
                      setHoveredHotspotId((prev) =>
                        prev === hotspot.hotspotId ? null : prev,
                      )
                    }
                    onPointerDown={(event) => onHotspotPointerDown(hotspot.hotspotId, event)}
                    style={{ left: `${clampPct(hotspot.xPct)}%`, top: `${clampPct(hotspot.yPct)}%` }}
                    title={
                      editing
                        ? `${label} (${hotspot.xPct.toFixed(1)}%, ${hotspot.yPct.toFixed(1)}%) · ${unlockRuleSummary(hotspot.unlock)}`
                        : undefined
                    }
                    type="button"
                  >
                    <span aria-hidden className="island-hub-icon-glow" />
                    <HubIconSparkles />
                    <img alt="" draggable={false} src={hotspotIconSrc(id)} />
                    {storyBadgeByHotspot.has(hotspot.hotspotId) ? (
                      <span className="island-hub-hotspot-story" title="Story chain nested here">
                        !
                      </span>
                    ) : null}
                    {showMainIconTooltip && hoveredHotspot.hotspotId === hotspot.hotspotId ? (
                      <div
                        aria-live="polite"
                        className={`island-hub-icon-tooltip${hotspot.yPct < 16 ? " is-below" : ""}`}
                        role="tooltip"
                      >
                        {hoverNameLabel}
                      </div>
                    ) : null}
                  </button>
                );
              })}
              {childMenuPanel}
              {editing ? (
                <div
                  className={`island-hub-edit-banner${
                    revealPickMode || nestPickNodeId ? " is-interactive" : ""
                  }`}
                >
                  {nestPickNodeId ? (
                    <>
                      <span>Click the map or an icon to place this story fiche</span>
                      <button
                        className="ghost-btn"
                        onClick={() => setNestPickNodeId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : revealPickMode ? (
                    <>
                      <span>Picking reveals — click map icons</span>
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          setRevealPickSourceId(null);
                          setStatus(null);
                        }}
                        type="button"
                      >
                        Done
                      </button>
                    </>
                  ) : linkPickMode ? (
                    "Link mode — click a target icon"
                  ) : paletteId ? (
                    `Placing ${hotspotLabel(paletteId)} — click map (multi-place OK)`
                  ) : (
                    "Select an icon from the palette"
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
        {unlockPanel}
        {storyTray}
        {threadComposerPanel}
        {listPanel}
        {explorePanel}
        {anchorsPanel}
        {palettePanel}
        {storyStrip}
      </div>
    </section>
  );
}
