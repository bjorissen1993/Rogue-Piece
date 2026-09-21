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
  NpcFaction,
  RelationFactionId,
  RunState,
  StoryChain,
  StoryTriggerEvent,
} from "../models/types";
import type { EncounterChoiceLockMap } from "./encounter/EncounterChoiceGrid";
import { IslandService } from "../services/IslandService";
import {
  StoryChainService,
  STORY_CHAIN_TONES,
  STORY_CHAIN_TRIGGER_OPTIONS,
  storyChainStructureFingerprint,
} from "../services/StoryChainService";
import {
  childActionIconSrc,
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
  createLocationAnchor,
  createStoryChain,
  getMapLayoutAnchors,
  getMapLayoutHotspots,
  getMapLayoutScenes,
  getMapLayoutStoryChains,
  unplacedStoryChainNodes,
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
  isHotspotVisibleInPlay,
  listEditorHandlerCrewOptions,
  listEditorHandlerNpcOptions,
  listEditorQuestOrEventOptions,
  PLACEABLE_PALETTE,
  resolveChildActionsForHotspot,
  resolveFacilityHotspots,
  snapPct,
  supportsQuestConfig,
  supportsConsumeOnUse,
  supportsRevealAuthoring,
  type MapChildActionDef,
  type CatalogChildActionId,
  unlockRuleSummary,
  upsertChildOverride,
} from "../data/islandMaps";

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
  onTalkNpcs?: (parentHotspotId?: string) => string;
  onStoryTrigger?: (event: StoryTriggerEvent) => string | null;
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
/** Play-mode focus zoom when a parent radial menu is open (siblings are hidden). */
export const ISLAND_HUB_FOCUS_ZOOM = 1.22;

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

function radialRadiusForCount(count: number): number {
  return Math.min(78, Math.max(48, 36 + count * 7));
}

/** Even ring around parent; open arc toward map center when a full circle would clip. */
function computeRadialOffsets(
  count: number,
  xPct: number,
  yPct: number,
  mapWidth: number,
  mapHeight: number,
): RadialOffset[] {
  if (count <= 0) {
    return [];
  }
  const radius = radialRadiusForCount(count);
  const cx = (clampPct(xPct) / 100) * mapWidth;
  const cy = (clampPct(yPct) / 100) * mapHeight;
  const pad = radius + 44;
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
  onTalkNpcs,
  onStoryTrigger,
  onChangeMapAsset,
  onRequestListFallback,
  onOpenCrew,
  onOpenInventory,
}: IslandHubMapProps) {
  const mapAssetId = island.mapAssetId;
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [snapStep, setSnapStep] = useState<(typeof SNAP_STEPS)[number]>(1);
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
  const [draftStoryChains, setDraftStoryChains] = useState<StoryChain[]>([]);
  const [activeChainId, setActiveChainId] = useState<string | null>(null);
  const [newChainName, setNewChainName] = useState("");
  const [newAnchorText, setNewAnchorText] = useState("");
  const [nestPickNodeId, setNestPickNodeId] = useState<string | null>(null);
  const [nestChildId, setNestChildId] = useState<string>("");
  const [showChainDetails, setShowChainDetails] = useState(true);
  const enterLocationKey = useRef<string | null>(null);
  const [newSceneName, setNewSceneName] = useState("");
  const [linkPickMode, setLinkPickMode] = useState(false);
  /** When set, map clicks add to this hotspot's `revealsHotspotIds` without changing selection. */
  const [revealPickSourceId, setRevealPickSourceId] = useState<string | null>(null);
  const revealPickMode = revealPickSourceId !== null;
  const [showUnlockPanel, setShowUnlockPanel] = useState(false);
  const [expandedChildId, setExpandedChildId] = useState<CatalogChildActionId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [imgNonce, setImgNonce] = useState(0);
  const [childMenu, setChildMenu] = useState<ChildMenuState | null>(null);
  const [stubNotice, setStubNotice] = useState<string | null>(null);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [hoveredChildLabel, setHoveredChildLabel] = useState<string | null>(null);
  const [sessionConsumedIds, setSessionConsumedIds] = useState<Set<string>>(() => new Set());
  const [sessionRevealedIds, setSessionRevealedIds] = useState<Set<string>>(() => new Set());
  const childMenuCloseTimer = useRef<number | null>(null);
  const statusClearTimer = useRef<number | null>(null);
  const stubClearTimer = useRef<number | null>(null);

  const unlocked = useMemo(() => IslandService.listUnlockedFacilities(island), [island]);
  const facilityIds = useMemo(() => unlocked.map((f) => f.id), [unlocked]);
  const unlockedSet = useMemo(() => new Set(facilityIds), [facilityIds]);

  const layoutHotspots = useMemo(
    () => getMapLayoutHotspots(island, mapAssetId),
    [island, mapAssetId],
  );

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
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewChainName("");
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setShowUnlockPanel(false);
    setStatus(null);
    setImgNonce(0);
    setChildMenu(null);
    setStubNotice(null);
    setHoveredHotspotId(null);
    setHoveredChildLabel(null);
    setSessionConsumedIds(new Set());
    setSessionRevealedIds(new Set());
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

  const dismissChildMenuInstant = useCallback(() => {
    clearChildMenuTimer();
    setChildMenu(null);
  }, [clearChildMenuTimer]);

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
      setChildMenu(null);
      childMenuCloseTimer.current = null;
    }, CHILD_MENU_CLOSE_MS);
  }, [clearChildMenuTimer]);

  const openChildMenu = useCallback(
    (hotspot: IslandFacilityHotspot) => {
      clearChildMenuTimer();
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
    [clearChildMenuTimer],
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
    if (!editing || (!revealPickMode && !linkPickMode && !nestPickNodeId)) {
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
      setStatus(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, revealPickMode, linkPickMode, nestPickNodeId]);

  useEffect(() => () => clearChildMenuTimer(), [clearChildMenuTimer]);

  const activeChain = draftStoryChains.find((c) => c.id === activeChainId) ?? draftStoryChains[0] ?? null;
  const unplacedNodes = activeChain ? unplacedStoryChainNodes(activeChain) : [];
  const structureKey = activeChain ? storyChainStructureFingerprint(activeChain.start) : "";

  useEffect(() => {
    if (!editing || !activeChain) {
      return;
    }
    const start = activeChain.start;
    const hasStructure =
      (start.dialogueBeats ?? 0) > 0 ||
      (start.battlesCount ?? 0) > 0 ||
      Boolean(start.bossBattle) ||
      (start.eventsCount ?? 0) > 0 ||
      (start.investigationsCount ?? 0) > 0 ||
      Boolean(start.mustHappen?.trim());
    if (!hasStructure) {
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
                island,
              })
            : c,
        ),
      );
    }, 400);
    return () => window.clearTimeout(handle);
  }, [editing, activeChain, structureKey, draft, draftAnchors, island]);

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
    setDraftStoryChains(chains);
    setActiveChainId(chains[0]?.id ?? null);
    setNewChainName("");
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
    setShowUnlockPanel(false);
    dismissChildMenuInstant();
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
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewChainName("");
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setShowUnlockPanel(false);
    setStatus(null);
  };

  const layoutExtras = (): IslandMapLayoutExtras => ({
    locationAnchors: draftAnchors,
    storyChains: draftStoryChains,
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
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewChainName("");
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setShowUnlockPanel(false);
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
    onSaveHotspots([], [], { locationAnchors: [], storyChains: [] });
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
    setDraftStoryChains([]);
    setActiveChainId(null);
    setNewChainName("");
    setNewAnchorText("");
    setNestPickNodeId(null);
    setNestChildId("");
    setNewSceneName("");
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setExpandedChildId(null);
    setShowUnlockPanel(false);
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

  const loadAuthoringFromHotspot = (hs: IslandFacilityHotspot) => {
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
    setPendingConsumeOnUse(hs.consumeOnUse === true);
    setPendingNotes(hs.notes ?? "");
    setPendingPurpose(hs.purpose ?? "");
    setPendingSceneId(hs.sceneId ?? null);
    setExpandedChildId(null);
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setShowUnlockPanel(true);
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
        if (!pendingRevealsHotspotIds.includes(instanceId)) {
          const next = [...pendingRevealsHotspotIds, instanceId];
          setPendingRevealsHotspotIds(next);
          setDraft((prev) =>
            prev.map((h) =>
              h.hotspotId === revealPickSourceId
                ? { ...h, revealsHotspotIds: next }
                : h,
            ),
          );
          setStatus(`Added reveal → ${hotspotLabel(hs.facilityId)}.`);
        }
      }
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedInstanceId(instanceId);
    if (hs) {
      loadAuthoringFromHotspot(hs);
    }
    setDrag({ hotspotId: instanceId, pointerId: event.pointerId });
  };

  const onMapPointerMove = (event: ReactPointerEvent) => {
    if (!editing || !drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const { xPct, yPct } = pointerToPct(event.clientX, event.clientY);
    setDraft((prev) =>
      prev.map((h) => (h.hotspotId === drag.hotspotId ? { ...h, xPct, yPct } : h)),
    );
  };

  const endDrag = (event: ReactPointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    setDrag(null);
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
        consumeOnUse: pendingConsumeOnUse || undefined,
      },
    );
    setDraft((prev) => [...prev, placed]);
    setSelectedInstanceId(placed.hotspotId);
    setPendingChildOverrides(placed.childOverrides ? [...placed.childOverrides] : []);
    setPendingQuestConfig(placed.questConfig ?? null);
    setPendingStages(placed.stages ? [...placed.stages] : []);
    setPendingLinks(placed.links ? [...placed.links] : []);
    setPendingRevealsHotspotIds(placed.revealsHotspotIds ? [...placed.revealsHotspotIds] : []);
    setPendingConsumeOnUse(placed.consumeOnUse === true);
    setPendingNotes(placed.notes ?? "");
    setPendingPurpose(placed.purpose ?? "");
    setPendingSceneId(placed.sceneId ?? null);
    setShowUnlockPanel(true);
    setStatus(
      `Placed ${hotspotLabel(paletteId)} (${unlockRuleSummary(unlock)}) — click again to add another.`,
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
    if (!paletteId || drag) {
      return;
    }
    if ((event.target as HTMLElement).closest(".island-hub-hotspot")) {
      return;
    }
    if ((event.target as HTMLElement).closest(".island-hub-unlock-panel")) {
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
    setStatus(
      removed
        ? `Removed ${hotspotLabel(removed.facilityId)} — Save to keep it off this map (re-place from palette to restore).`
        : "Removed hotspot — Save to keep it off this map.",
    );
    setSelectedInstanceId(null);
    setShowUnlockPanel(false);
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

  const applyRevealsToSelectedOrPending = (next: string[]) => {
    const unique = [...new Set(next.filter(Boolean))];
    setPendingRevealsHotspotIds(unique);
    patchSelectedHotspot({ revealsHotspotIds: unique.length > 0 ? unique : undefined });
  };

  const applyConsumeOnUseToSelectedOrPending = (next: boolean) => {
    setPendingConsumeOnUse(next);
    patchSelectedHotspot({ consumeOnUse: next || undefined });
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
    const chain = createStoryChain(newChainName || "New chain", island.id, mapAssetId ?? undefined);
    setDraftStoryChains((prev) => [...prev, chain]);
    setActiveChainId(chain.id);
    setNewChainName("");
    setStatus(`Created story chain “${chain.name}”.`);
  };

  const patchActiveChain = (patch: Partial<StoryChain>) => {
    if (!activeChain) {
      return;
    }
    setDraftStoryChains((prev) => prev.map((c) => (c.id === activeChain.id ? { ...c, ...patch } : c)));
  };

  const replaceActiveChain = (next: StoryChain) => {
    setDraftStoryChains((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  };

  const generateActiveChain = () => {
    if (!activeChain) {
      return;
    }
    const next = StoryChainService.generateStructure(activeChain, {
      hotspots: draft,
      anchors: draftAnchors,
      island,
    });
    replaceActiveChain(next);
    setStatus("Generated numbered nodes into the unplaced tray.");
  };

  const nestNodeOntoHotspot = (nodeId: string, hotspot: IslandFacilityHotspot, childId?: string) => {
    if (!activeChain) {
      return;
    }
    const next = StoryChainService.nestNode(activeChain, nodeId, {
      hotspotId: hotspot.hotspotId,
      childId: childId || undefined,
      islandId: island.id,
      mapAssetId: mapAssetId ?? undefined,
    });
    replaceActiveChain(next);
    setNestPickNodeId(null);
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
    const anchor = createLocationAnchor(
      newAnchorText || "Unnamed place",
      [],
      "suggest",
      selectedInstanceId ?? undefined,
    );
    setDraftAnchors((prev) => [...prev, anchor]);
    setNewAnchorText("");
    setStatus("Added location anchor (not nested onto icons yet).");
  };

  const patchAnchor = (anchorId: string, patch: Partial<LocationAnchor>) => {
    setDraftAnchors((prev) => prev.map((a) => (a.id === anchorId ? { ...a, ...patch } : a)));
  };

  const removeAnchor = (anchorId: string) => {
    setDraftAnchors((prev) => prev.filter((a) => a.id !== anchorId));
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
    const unlock = emptyUnlockDraft(id);
    setPendingUnlock(unlock);
    setPendingChildOverrides([]);
    setPendingQuestConfig(supportsQuestConfig(id) ? defaultQuestConfigFor(id) ?? null : null);
    setPendingStages([]);
    setPendingLinks([]);
    setPendingRevealsHotspotIds([]);
    setPendingConsumeOnUse(false);
    setPendingNotes("");
    setPendingPurpose("");
    setPendingSceneId(null);
    setExpandedChildId(null);
    setLinkPickMode(false);
    setRevealPickSourceId(null);
    setShowUnlockPanel(true);
    const count = placedCounts.get(id) ?? 0;
    setStatus(
      count > 0
        ? `Selected ${hotspotLabel(id)} (${count} placed) — set purpose/unlock/stages, then click map.`
        : `Selected ${hotspotLabel(id)} — set purpose/unlock/stages, then click the map to place.`,
    );
  };

  const applyProbeUseEffects = (hotspot: IslandFacilityHotspot) => {
    if (hotspot.revealsHotspotIds?.length) {
      setSessionRevealedIds((prev) => {
        const next = new Set(prev);
        for (const id of hotspot.revealsHotspotIds!) {
          next.add(id);
        }
        return next;
      });
    }
    if (hotspot.consumeOnUse) {
      setSessionConsumedIds((prev) => {
        const next = new Set(prev);
        next.add(hotspot.hotspotId);
        return next;
      });
    }
  };

  const resolveChildAction = (action: MapChildActionDef) => {
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
    if (resolve.type === "hub_choice") {
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
        if (
          hotspot.hotspotId !== revealPickSourceId &&
          !pendingRevealsHotspotIds.includes(hotspot.hotspotId)
        ) {
          applyRevealsToSelectedOrPending([
            ...pendingRevealsHotspotIds,
            hotspot.hotspotId,
          ]);
          setStatus(`Added reveal → ${hotspotLabel(hotspot.facilityId)}.`);
        }
        return;
      }
      setSelectedInstanceId(hotspot.hotspotId);
      loadAuthoringFromHotspot(hotspot);
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
    if (hasVisibleChildActions(hotspot, island, run)) {
      if (childMenu?.parentHotspotId === hotspot.hotspotId) {
        closeChildMenu();
        return;
      }
      openChildMenu(hotspot);
      return;
    }

    const choiceId = hotspotHubChoiceId(id);
    if (!choiceId) {
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
      return true;
    }
    if (sessionConsumedIds.has(hotspot.hotspotId)) {
      return false;
    }
    if (sessionRevealedIds.has(hotspot.hotspotId)) {
      return true;
    }
    return isHotspotVisibleInPlay(hotspot, island, run, unlockedSet);
  };

  const hoveredHotspot =
    hoveredHotspotId != null
      ? displayHotspots.find((h) => h.hotspotId === hoveredHotspotId)
      : undefined;
  const hoverNameLabel =
    hoveredChildLabel ??
    (hoveredHotspot
      ? hoveredHotspot.purpose?.trim() || hotspotLabel(hoveredHotspot.facilityId)
      : null);

  const unlockPanel =
    editing && showUnlockPanel && (paletteId || selectedMeta) ? (
      <aside className="island-hub-unlock-panel" onClick={(e) => e.stopPropagation()}>
        <div className="island-hub-unlock-head">
          <p className="island-hub-unlock-title">
            {selectedMeta ? "Icon" : "Place"} — {hotspotLabel(activeMarkerId!)}
          </p>
          <button
            className="ghost-btn island-hub-unlock-close"
            onClick={() => {
              setShowUnlockPanel(false);
              setLinkPickMode(false);
              setRevealPickSourceId(null);
            }}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="island-hub-unlock-scroll">
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

          {activeMarkerId && supportsConsumeOnUse(activeMarkerId) ? (
            <div className="island-hub-unlock-section">
              <p className="island-hub-unlock-children-title">One-shot</p>
              <label className="island-hub-unlock-child-toggle">
                <input
                  checked={pendingConsumeOnUse}
                  onChange={(e) => applyConsumeOnUseToSelectedOrPending(e.target.checked)}
                  type="checkbox"
                />
                Disappears after use
              </label>
              <p className="island-hub-unlock-hint">
                Hide this probe from the map after the player uses it once.
              </p>
            </div>
          ) : null}

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
            <label className="island-hub-unlock-field">
              Mode
              <select
                onChange={(e) => {
                  const mode = e.target.value as HotspotUnlockMode;
                  const base = pendingUnlock ?? emptyUnlockDraft(activeMarkerId!);
                  const next: HotspotUnlockRule = { mode };
                  if (mode === "explore_count") {
                    next.exploreCount = base.exploreCount ?? 1;
                  }
                  if (mode === "flag") {
                    next.flag = base.flag ?? "";
                  }
                  if (mode === "quest") {
                    next.questId = base.questId ?? base.flag ?? "";
                  }
                  applyUnlockToSelectedOrPending(next);
                }}
                value={pendingUnlock?.mode ?? "always"}
              >
                <option value="always">Unlocked by default</option>
                <option value="explore_count">After explore count</option>
                <option value="flag">After flag / discovery</option>
                <option value="quest">After quest / event</option>
              </select>
            </label>
            {pendingUnlock?.mode === "explore_count" ? (
              <label className="island-hub-unlock-field">
                Explore count
                <input
                  min={1}
                  onChange={(e) =>
                    applyUnlockToSelectedOrPending({
                      mode: "explore_count",
                      exploreCount: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  type="number"
                  value={pendingUnlock.exploreCount ?? 1}
                />
              </label>
            ) : null}
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
                                    if (mode === "explore_count") {
                                      next.exploreCount = unlock.exploreCount ?? 1;
                                    }
                                    if (mode === "flag") {
                                      next.flag = unlock.flag ?? "";
                                    }
                                    if (mode === "quest") {
                                      next.questId = unlock.questId ?? unlock.flag ?? "";
                                    }
                                    patchChildOverride(slot.childId, { unlock: next });
                                  }}
                                  value={unlock.mode}
                                >
                                  <option value="always">Unlocked by default</option>
                                  <option value="explore_count">After explore count</option>
                                  <option value="flag">After flag / discovery</option>
                                  <option value="quest">After quest / event</option>
                                </select>
                              </label>
                              {unlock.mode === "explore_count" ? (
                                <label className="island-hub-unlock-field">
                                  Explore count
                                  <input
                                    min={1}
                                    onChange={(e) =>
                                      patchChildOverride(slot.childId, {
                                        unlock: {
                                          mode: "explore_count",
                                          exploreCount: Math.max(1, Number(e.target.value) || 1),
                                        },
                                      })
                                    }
                                    type="number"
                                    value={unlock.exploreCount ?? 1}
                                  />
                                </label>
                              ) : null}
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

  const storyBadgeByHotspot = useMemo(() => {
    const source = editing
      ? draftStoryChains
      : mapAssetId
        ? getMapLayoutStoryChains(island, mapAssetId)
        : [];
    const map = new Map<string, number>();
    for (const chain of source) {
      for (const node of chain.nodes) {
        if (node.placedHotspotId) {
          map.set(node.placedHotspotId, (map.get(node.placedHotspotId) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [editing, draftStoryChains, island, mapAssetId]);

  const placedNodes = activeChain?.nodes.filter((n) => n.placedHotspotId) ?? [];

  const storyTray =
    editing ? (
      <aside className="island-hub-story-tray" aria-label="Story chain unplaced tray">
        <p className="island-hub-unlock-children-title">Story chain</p>
        <div className="island-hub-unlock-row">
          <select
            onChange={(e) => setActiveChainId(e.target.value || null)}
            value={activeChain?.id ?? ""}
          >
            <option value="">— none —</option>
            {draftStoryChains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            onChange={(e) => setNewChainName(e.target.value)}
            placeholder="Chain name"
            type="text"
            value={newChainName}
          />
          <button className="ghost-btn" onClick={createChain} type="button">
            + Chain
          </button>
        </div>
        {activeChain ? (
          <>
            <div className="island-hub-unlock-row wrap">
              <button className="ghost-btn" onClick={() => setShowChainDetails((v) => !v)} type="button">
                {showChainDetails ? "Hide Start/End fields" : "Start/End fields"}
              </button>
              <button className="ghost-btn" onClick={generateActiveChain} type="button">
                Generate
              </button>
              <button className="ghost-btn" onClick={addBeatToActiveChain} type="button">
                + Beat
              </button>
            </div>
            {showChainDetails ? (
              <div className="island-hub-story-fields">
                <p className="island-hub-unlock-children-title">Start</p>
                <label className="island-hub-unlock-field">
                  Premise
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
                  Plot twist (optional)
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
                    Dialogue beats
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
                    Battles
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
                    Boss battle
                  </label>
                  <label className="island-hub-unlock-field">
                    Events
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
                    Investigations
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
                    Tone
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
                    Importance
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
                  Restrictions
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
                  Must happen
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
                  Must not happen
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
                  Resolution
                  <textarea
                    onChange={(e) =>
                      patchActiveChain({ end: { ...activeChain.end, resolution: e.target.value } })
                    }
                    rows={2}
                    value={activeChain.end.resolution ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-field">
                  End twist
                  <input
                    onChange={(e) =>
                      patchActiveChain({ end: { ...activeChain.end, twist: e.target.value } })
                    }
                    type="text"
                    value={activeChain.end.twist ?? ""}
                  />
                </label>
                <label className="island-hub-unlock-field">
                  Possible conclusions (one per line)
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
                <p className="island-hub-unlock-hint">Unlocks</p>
                <div className="island-hub-unlock-row wrap">
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
                    <option value="">Unlock island —</option>
                    {(run?.islands ?? []).map((isle) => (
                      <option key={isle.id} value={isle.id}>
                        {isle.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="island-hub-unlock-hint">End effects (apply when End fires)</p>
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
                    {label}
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
                Click a map icon to nest this node
                {nestChildId ? ` (suboption ${nestChildId})` : ""}. Esc cancels.
              </p>
            ) : (
              <p className="island-hub-unlock-hint">
                Unplaced tray — drag onto a map icon, or Nest then click. Suboption = Harbor→Crew etc.
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
                    {node.editState ? ` · ${node.editState}` : ""}
                    {node.suggestedHotspotId ? " · match" : ""}
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
                Nest as suboption
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
          <p className="island-hub-unlock-hint">Create a chain to author Start / End / beats.</p>
        )}
        <p className="island-hub-unlock-children-title">Location anchors</p>
        <div className="island-hub-unlock-row">
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
        {draftAnchors.length === 0 ? (
          <p className="island-hub-unlock-hint">
            Anchors describe places for later AI matching (Never / Suggest / Auto-use).
          </p>
        ) : (
          <ul className="island-hub-story-unplaced">
            {draftAnchors.map((anchor) => (
              <li key={anchor.id}>
                <span>{anchor.description || "Untitled"}</span>
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
                <button className="ghost-btn" onClick={() => removeAnchor(anchor.id)} type="button">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    ) : null;

  const childActions = useMemo(() => {
    if (!childMenu) {
      return [] as MapChildActionDef[];
    }
    const parent = displayHotspots.find((h) => h.hotspotId === childMenu.parentHotspotId);
    if (!parent) {
      return resolveChildActionsForHotspot(
        {
          hotspotId: childMenu.parentHotspotId,
          facilityId: childMenu.facilityId,
          xPct: childMenu.xPct,
          yPct: childMenu.yPct,
        },
        island,
        run,
      );
    }
    return resolveChildActionsForHotspot(parent, island, run);
  }, [childMenu, displayHotspots, island, run]);
  const childRadialOffsets = useMemo(() => {
    if (!childMenu) {
      return [] as RadialOffset[];
    }
    const rect = mapRef.current?.getBoundingClientRect();
    const width = Math.max(1, rect?.width ?? 800);
    const height = Math.max(1, rect?.height ?? 600);
    return computeRadialOffsets(
      childActions.length,
      childMenu.xPct,
      childMenu.yPct,
      width,
      height,
    );
  }, [childMenu, childActions.length]);

  const mapFocus = resolveIslandHubMapFocus(editing, childMenu);
  /** Fade siblings with zoom: hide while focused/open, reappear as zoom reverses on close. */
  const hideSiblingHotspots = Boolean(mapFocus);
  /** Zoom around the active parent in place (siblings fade via CSS, timed to zoom). */
  const mapZoomStyle: CSSProperties | undefined = mapFocus
    ? {
        transformOrigin: `${mapFocus.xPct}% ${mapFocus.yPct}%`,
        transform: `scale(${mapFocus.scale})`,
      }
    : undefined;

  const childMenuPanel =
    !editing && childMenu ? (
      <div
        aria-label={`${hotspotLabel(childMenu.facilityId)} actions`}
        className={`island-hub-child-menu${childMenu.open ? " is-open" : ""}`}
        role="menu"
        style={
          {
            left: `${clampPct(childMenu.xPct)}%`,
            top: `${clampPct(childMenu.yPct)}%`,
            "--stagger-max": `${Math.max(0, childActions.length - 1) * 35}ms`,
          } as CSSProperties
        }
      >
        {childActions.map((action, index) => {
          const offset = childRadialOffsets[index] ?? { x: 0, y: 0 };
          return (
            <button
              aria-label={action.label}
              className="island-hub-child-orbit"
              key={action.id}
              onClick={() => resolveChildAction(action)}
              onMouseEnter={() => setHoveredChildLabel(action.label)}
              onMouseLeave={() => setHoveredChildLabel(null)}
              role="menuitem"
              style={
                {
                  "--ox": `${offset.x}px`,
                  "--oy": `${offset.y}px`,
                  "--stagger": `${index * 35}ms`,
                } as CSSProperties
              }
              title={action.label}
              type="button"
            >
              <img alt="" draggable={false} src={childActionIconSrc(action)} />
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
                  onClick={() => setShowUnlockPanel(true)}
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
        {hoverNameLabel ? (
          <p className="island-hub-hover-name" aria-live="polite">
            {hoverNameLabel}
          </p>
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
              paletteId && editing ? " is-placing" : ""
            }${mapFocus ? " is-focused" : ""}${hideSiblingHotspots ? " is-radial-open" : ""}`}
            onClick={onMapClick}
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
                  : hasVisibleChildActions(hotspot, island, run);
                const locked =
                  !hasKids &&
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
                    aria-label={label}
                    className={`island-hub-hotspot${locked && !editing ? " is-locked" : ""}${
                      selected ? " is-selected" : ""
                    }${isRevealPickSource ? " is-reveal-pick-source" : ""}${
                      editing ? " is-draggable" : ""
                    }${dimmed ? " is-dimmed" : ""}${
                      id === "EXPLORE" ? " is-explore" : ""
                    }${isActiveParent ? " is-menu-open" : ""}${
                      isSibling ? " is-sibling" : ""
                    }${storyBadgeByHotspot.has(hotspot.hotspotId) ? " has-story" : ""}`}
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
                        : label
                    }
                    type="button"
                  >
                    <img alt="" draggable={false} src={hotspotIconSrc(id)} />
                    {storyBadgeByHotspot.has(hotspot.hotspotId) ? (
                      <span className="island-hub-hotspot-story" title="Story chain nested here">
                        !
                      </span>
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
                      <span>Click a map icon to nest the story node</span>
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
        {palettePanel}
        {storyTray}
      </div>
    </section>
  );
}
