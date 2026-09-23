import type {
  AssignmentCompletionReport,
  Encounter,
  Island,
  IslandFacilityHotspot,
  IslandFacilityId,
  IslandMapHotspotId,
  LocationAnchor,
  MapAnchorRegion,
  PendingStoryTrigger,
  ProfileSave,
  StoryBeatObjective,
  RelationFactionId,
  RunState,
  StoryBeatEnemyRole,
  StoryBeatEnemyStrength,
  StoryBeatPlanItem,
  StoryBeatPlanKind,
  StoryChain,
  StoryChainEnd,
  StoryChainNode,
  StoryChainNodeKind,
  StoryChainProgress,
  StoryChainStart,
  StoryChainStartHub,
  StoryChainTone,
  StoryChainTrigger,
  StoryChainTriggerKind,
  StoryQuestDraft,
  StoryTriggerEvent,
  TimeOfDay,
} from "../models/types";
import {
  createStoryChainNode,
  editorChildSlotsFor,
  hotspotLabel,
  isFacilityHotspotId,
  isLeafHubFacility,
  migrateStoryChain,
  shouldExposeStoryChild,
  STORY_CHILD_PREFIX,
  storyChildActionId,
} from "../data/islandMaps";
import { TIME_OF_DAY_ORDER } from "../game/constants";
import { createId } from "../utils/ids";
import { AffiliationService } from "./AffiliationService";
import { CharacterService } from "./CharacterService";
import { FactionService } from "./FactionService";
import { IslandService } from "./IslandService";
import { ItemService } from "./ItemService";
import { isFishCatchItem, FISH_CATCH_ITEM_IDS } from "../data/fishing";
import { SEA_KING_MEAT_ITEM_ID } from "../data/items";
import { LegacyService } from "./LegacyService";

export const STORY_ENCOUNTER_PREFIX = "story:";
const MERCHANT_NAMES = ["Hama", "Old Riku", "Nori", "Katsu", "Mira", "Den", "Sora", "Piko", "Ume", "Taro"];

export const STORY_CHAIN_TONES: Array<{ value: StoryChainTone; label: string }> = [
  { value: "adventure", label: "Adventure" },
  { value: "mystery", label: "Mystery" },
  { value: "drama", label: "Drama" },
  { value: "comedy", label: "Comedy" },
  { value: "tragedy", label: "Tragedy" },
  { value: "political", label: "Political" },
  { value: "thriller", label: "Thriller" },
];

const TRIGGER_KINDS = new Set<StoryChainTriggerKind>([
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

export const STORY_CHAIN_TRIGGER_OPTIONS: Array<{ value: StoryChainTriggerKind; label: string }> = [
  { value: "map_icon", label: "Map icon click" },
  { value: "suboption", label: "Suboption click" },
  { value: "enter_location", label: "Enter location" },
  { value: "time", label: "Time reached" },
  { value: "activity_completed", label: "Activity completed" },
  { value: "battle_ended", label: "Battle ended" },
  { value: "rest", label: "Rest / Sleep" },
  { value: "sailing_event", label: "Sailing event" },
  { value: "flag", label: "Flag" },
  { value: "screen", label: "Screen" },
];

export const STORY_TITLE_FLAG_PREFIX = "story_title:";
export const STORY_QUEST_FLAG_PREFIX = "story_quest:";
export const STORY_ISLAND_FLAG_PREFIX = "story_island:";

const RELATION_FACTIONS: RelationFactionId[] = [
  "MARINES",
  "PIRATES",
  "WORLD_GOVERNMENT",
  "CIVILIANS",
  "REVOLUTIONARY_ARMY",
];

const KIND_FACILITIES: Record<string, IslandMapHotspotId[]> = {
  start: ["HARBOR", "EXPLORE", "INN"],
  talk: ["INN", "MARKET", "HARBOR", "TALK"],
  explore: ["EXPLORE", "SEARCH", "SCOUT"],
  investigate: ["INVESTIGATE", "LIBRARY", "SEARCH"],
  event: ["MARKET", "INN", "EVENT", "QUEST"],
  battle: ["TRAINING_GROUNDS", "CHALLENGE", "QUEST"],
  boss: ["TRAINING_GROUNDS", "CHALLENGE", "QUEST", "EVENT", "MARINE_BASE"],
  end: ["HARBOR", "INN", "EXPLORE"],
  beat: ["MARKET", "QUEST", "EVENT", "INN"],
};

const HUB_NEST_FACILITIES = new Set<IslandFacilityId>([
  "HARBOR",
  "INN",
  "MARKET",
  "TRAINING_GROUNDS",
  "LIBRARY",
  "WEAPON_SHOP",
  "CLINIC",
  "TASK_BOARD",
]);

const KIND_PRIORITY: Record<StoryChainTriggerKind, number> = {
  enter_location: 10,
  map_icon: 20,
  suboption: 30,
  rest: 32,
  battle_ended: 35,
  activity_completed: 38,
  sailing_event: 40,
  screen: 45,
  time: 50,
  flag: 60,
};

function countOf(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(8, Math.floor(value)));
}

export const STORY_BEAT_PLAN_KIND_OPTIONS: Array<{ value: StoryBeatPlanKind; label: string }> = [
  { value: "talk", label: "Dialogue" },
  { value: "event", label: "Event" },
  { value: "battle", label: "Battle" },
  { value: "investigate", label: "Investigation" },
  { value: "boss", label: "Boss" },
];

export const STORY_CHAIN_START_HUBS: Array<{ value: StoryChainStartHub; label: string }> = [
  { value: "MARKET", label: "Market" },
  { value: "INN", label: "Inn" },
  { value: "HARBOR", label: "Harbor" },
  { value: "TRAINING_GROUNDS", label: "Training Grounds" },
  { value: "LIBRARY", label: "Library" },
];

export function createBeatPlanItem(kind: StoryBeatPlanKind, note?: string): StoryBeatPlanItem {
  return { id: createId("sbeat"), kind, note };
}

export function countsFromBeatPlan(
  plan: StoryBeatPlanItem[],
): Pick<
  StoryChainStart,
  "dialogueBeats" | "eventsCount" | "battlesCount" | "investigationsCount" | "bossBattle"
> {
  return {
    dialogueBeats: plan.filter((item) => item.kind === "talk").length,
    eventsCount: plan.filter((item) => item.kind === "event").length,
    battlesCount: plan.filter((item) => item.kind === "battle").length,
    investigationsCount: plan.filter((item) => item.kind === "investigate").length,
    bossBattle: plan.some((item) => item.kind === "boss"),
  };
}

function beatPlanFromCounts(start: StoryChainStart): StoryBeatPlanItem[] {
  const items: StoryBeatPlanItem[] = [];
  const talks = countOf(start.dialogueBeats);
  const investigates = countOf(start.investigationsCount);
  const events = countOf(start.eventsCount);
  const battles = countOf(start.battlesCount);
  for (let i = 0; i < talks; i += 1) {
    items.push({ id: `talk:${i}`, kind: "talk" });
  }
  for (let i = 0; i < investigates; i += 1) {
    items.push({ id: `investigate:${i}`, kind: "investigate" });
  }
  for (let i = 0; i < events; i += 1) {
    items.push({ id: `event:${i}`, kind: "event" });
  }
  for (let i = 0; i < battles; i += 1) {
    items.push({ id: `battle:${i}`, kind: "battle" });
  }
  if (start.bossBattle) {
    items.push({ id: "boss:0", kind: "boss" });
  }
  return items;
}

export function resolvedBeatPlan(start: StoryChainStart): StoryBeatPlanItem[] {
  if (Array.isArray(start.beatPlan) && start.beatPlan.length > 0) {
    return start.beatPlan;
  }
  return beatPlanFromCounts(start);
}

export function storyChainStructureFingerprint(start: StoryChainStart): string {
  if (start.beatPlan && start.beatPlan.length > 0) {
    return [
      "plan",
      start.beatPlan.map((item) => `${item.kind}:${(item.note ?? "").trim()}`).join(","),
      start.startHub ?? "",
      (start.mustHappen ?? "").trim(),
    ].join("|");
  }
  return [
    countOf(start.dialogueBeats),
    countOf(start.battlesCount),
    start.bossBattle ? 1 : 0,
    countOf(start.eventsCount),
    countOf(start.investigationsCount),
    (start.mustHappen ?? "").trim(),
  ].join("|");
}

function defaultBeatLabel(kind: StoryBeatPlanKind, index: number, total: number): string {
  const option = STORY_BEAT_PLAN_KIND_OPTIONS.find((entry) => entry.value === kind);
  const base = option?.label ?? kind;
  return total <= 1 ? base : `${base} ${index + 1}`;
}

function desiredSlots(
  start: StoryChainStart,
): Array<{ key: string; kind: StoryChainNodeKind; label: string; note?: string }> {
  const plan = resolvedBeatPlan(start);
  const slots = plan.map((item, index) => ({
    key: item.id,
    kind: item.kind as StoryChainNodeKind,
    label: item.note?.trim() || defaultBeatLabel(item.kind, index, plan.filter((row) => row.kind === item.kind).length),
    note: item.note,
  }));
  const must = (start.mustHappen ?? "").trim();
  if (must) {
    slots.push({ key: "must:0", kind: "beat", label: must, note: must });
  }
  return slots;
}

export type LocationMatchContext = {
  hotspots: IslandFacilityHotspot[];
  anchors: LocationAnchor[];
  regions?: MapAnchorRegion[];
  island?: Island | null;
};

export function matchLocationForKind(
  kind: StoryChainNodeKind,
  ctx: LocationMatchContext,
): { hotspotId?: string; locationAnchorId?: string; locationRegionId?: string } {
  const preferred = KIND_FACILITIES[kind] ?? KIND_FACILITIES.beat;
  for (const facilityId of preferred) {
    const hit = ctx.hotspots.find((h) => h.facilityId === facilityId && !h.hidden);
    if (hit) {
      return { hotspotId: hit.hotspotId };
    }
  }
  const tagHint = kind === "talk" ? "talk" : kind === "battle" || kind === "boss" ? "battle" : kind;
  const usable = ctx.anchors.filter((a) => a.aiPermission !== "never");
  const autoTagged = usable.find((a) => a.aiPermission === "auto" && a.tags.some((t) => t.includes(tagHint)));
  if (autoTagged) {
    return { locationAnchorId: autoTagged.id, hotspotId: autoTagged.hotspotId };
  }
  const auto = usable.find((a) => a.aiPermission === "auto");
  if (auto) {
    return { locationAnchorId: auto.id, hotspotId: auto.hotspotId };
  }
  const suggest = usable.find((a) => a.aiPermission === "suggest");
  if (suggest) {
    return { locationAnchorId: suggest.id, hotspotId: suggest.hotspotId };
  }
  const regions = (ctx.regions ?? []).filter(
    (r) => r.aiPermission !== "never" && r.points.length >= 3,
  );
  const autoRegion = regions.find((r) => r.aiPermission === "auto");
  if (autoRegion) {
    return { locationRegionId: autoRegion.id };
  }
  const suggestRegion = regions.find((r) => r.aiPermission === "suggest");
  if (suggestRegion) {
    return { locationRegionId: suggestRegion.id };
  }
  return {};
}

function keepNode(node: StoryChainNode): boolean {
  return node.editState === "locked" || node.editState === "edited" || Boolean(node.placedHotspotId);
}

function applyToneLabel(label: string, start: StoryChainStart): string {
  const tone = typeof start.tone === "string" && start.tone.trim() ? start.tone.trim() : "";
  if (!tone || label.toLowerCase().includes(tone.toLowerCase())) {
    return label;
  }
  return label;
}

function textOf(value: string | undefined): string {
  return (value ?? "").trim();
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function pickStoryNpcName(seed: string): string {
  return MERCHANT_NAMES[hashSeed(seed) % MERCHANT_NAMES.length];
}

export function storyTextLooksLikeFishing(text: string): boolean {
  return /\bfish(?:ing|es)?\b|sea king|cast (?:a )?line|\bnets?\b/i.test(text);
}

export function storyTextLooksLikeSeaKing(text: string): boolean {
  return /sea[\s-]?king/i.test(text);
}

export function storyTextLooksLikeNotEnough(text: string): boolean {
  return /not enough|isn'?t enough|need(?:s)? (?:something )?bigger|more of it|still not enough/i.test(
    text,
  );
}

export type SeaKingHookTarget = {
  chainId: string;
  battleNodeId: string;
};

function storyNodeBlob(node: StoryChainNode): string {
  const draft = node.questDraft;
  return [
    node.label,
    node.notes,
    draft?.adaptedText,
    draft?.encounterTitle,
    draft?.encounterDescription,
    draft?.battleSuggestion,
    ...(draft?.dialogueLines ?? []),
    ...(draft?.options ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function storyChainBlob(chain: StoryChain): string {
  return [
    chain.name,
    chain.start.premise,
    chain.end.resolution,
    ...(chain.start.beatPlan ?? []).map((item) => `${item.kind} ${item.note ?? ""}`),
    ...chain.nodes.map((node) => storyNodeBlob(node)),
  ]
    .filter(Boolean)
    .join(" ");
}

function chainLooksLikeSeaKingHunt(chain: StoryChain): boolean {
  const blob = storyChainBlob(chain);
  if (!storyTextLooksLikeFishing(blob) || !storyTextLooksLikeSeaKing(blob)) {
    return false;
  }
  return playableStoryNodes(chain).some((node) => node.kind === "battle" || node.kind === "boss");
}

const SEA_KING_MEAT_OBJECTIVE: StoryBeatObjective = {
  type: "collect_item",
  itemId: SEA_KING_MEAT_ITEM_ID,
  count: 1,
  label: "Bring Sea King meat to the merchant",
};

function consumeStoryTurnIn(run: RunState, node: StoryChainNode): void {
  const objective = node.questDraft?.objective;
  if (!objective || objective.type !== "collect_item") {
    return;
  }
  ItemService.remove(run, objective.itemId, objective.count);
}

export function ensureSeaKingTurnIn(chain: StoryChain): StoryChain {
  if (!chainLooksLikeSeaKingHunt(chain)) {
    return chain;
  }
  const start = chain.nodes.find((node) => node.kind === "start");
  const end = chain.nodes.find((node) => node.kind === "end");
  if (!end) {
    return chain;
  }
  const npcName =
    end.questDraft?.npcName || start?.questDraft?.npcName || pickStoryNpcName(`${chain.id}:end`);
  end.questDraft = {
    ...end.questDraft,
    npcName,
    objective: end.questDraft?.objective ?? SEA_KING_MEAT_OBJECTIVE,
    encounterTitle: end.questDraft?.encounterTitle || `${npcName} at the stall`,
    encounterDescription:
      end.questDraft?.encounterDescription ||
      "Bring Sea King meat to the stall. That is the only catch that finishes this.",
    dialogueLines:
      end.questDraft?.dialogueLines?.length
        ? end.questDraft.dialogueLines
        : writeStoryDialogue("end", chain.start, chain.end, npcName, end.notes),
  };
  if (start?.placedHotspotId && !end.placedHotspotId) {
    const childId = storyChildActionId(end);
    end.placedHotspotId = start.placedHotspotId;
    end.trigger = {
      kind: "suboption",
      ref: `${start.placedHotspotId}:${childId}`,
      childId,
      islandId: start.trigger?.islandId ?? chain.islandId,
      mapAssetId: start.trigger?.mapAssetId ?? chain.mapAssetId,
    };
    if (!end.label || end.label === "End") {
      end.label = "Deliver Sea King meat";
    }
  }
  return chain;
}

function isFishCollectNode(node: StoryChainNode): boolean {
  const objective = node.questDraft?.objective;
  return Boolean(objective && objective.type === "collect_item" && isFishCatchItem(objective.itemId));
}

export function findSeaKingHook(run: RunState | null | undefined): SeaKingHookTarget | null {
  if (!run) {
    return null;
  }
  for (const chain of StoryChainService.allChains(run)) {
    if (!chainLooksLikeSeaKingHunt(chain)) {
      continue;
    }
    const fired = firedSet(progressFor(chain.id, run));
    const playable = playableStoryNodes(chain);
    const start = playable.find((node) => node.kind === "start");
    if (start && !fired.has(start.id)) {
      continue;
    }
    const collectNodes = playable.filter(isFishCollectNode);
    if (
      collectNodes.length > 0 &&
      !collectNodes.every(
        (node) => fired.has(node.id) || storyObjectiveMet(run, node.questDraft?.objective),
      )
    ) {
      continue;
    }
    const talks = playable.filter((node) => node.kind === "talk");
    const notEnoughTalks = talks.filter((node) => storyTextLooksLikeNotEnough(storyNodeBlob(node)));
    const requiredTalks = notEnoughTalks.length > 0 ? notEnoughTalks : talks;
    if (requiredTalks.length === 0 || !requiredTalks.some((node) => fired.has(node.id))) {
      continue;
    }
    const battles = playable.filter((node) => node.kind === "battle" || node.kind === "boss");
    const battle =
      battles.find((node) => storyTextLooksLikeSeaKing(storyNodeBlob(node))) ??
      battles[battles.length - 1];
    if (!battle || fired.has(battle.id)) {
      continue;
    }
    return { chainId: chain.id, battleNodeId: battle.id };
  }
  return null;
}

function progressFor(chainId: string, run?: RunState | null): StoryChainProgress | undefined {
  return run?.storyChainProgress?.find((entry) => entry.chainId === chainId);
}

function firedSet(progress?: StoryChainProgress): Set<string> {
  return new Set(progress?.firedNodeIds ?? []);
}

export function storyObjectiveMet(run: RunState | null | undefined, objective?: StoryBeatObjective | null): boolean {
  if (!run || !objective || objective.type !== "collect_item") {
    return false;
  }
  const owned = isFishCatchItem(objective.itemId)
    ? FISH_CATCH_ITEM_IDS.reduce((sum, id) => sum + ItemService.countOwned(run, id), 0)
    : ItemService.countOwned(run, objective.itemId);
  return owned >= objective.count;
}

export function playableStoryNodes(chain: StoryChain): StoryChainNode[] {
  return chain.nodes.filter((node) => node.kind !== "end").sort((a, b) => a.order - b.order);
}

export function isStoryNodeAvailable(
  chain: StoryChain,
  node: StoryChainNode,
  run?: RunState | null,
): boolean {
  const fired = firedSet(progressFor(chain.id, run));
  if (fired.has(node.id)) {
    return false;
  }
  const prior = playableStoryNodes(chain).filter((entry) => entry.order < node.order);
  const seaKingHunt = chainLooksLikeSeaKingHunt(chain);
  return prior.every((entry) => {
    if (fired.has(entry.id) || storyObjectiveMet(run, entry.questDraft?.objective)) {
      return true;
    }
    if (seaKingHunt && (entry.kind === "battle" || entry.kind === "boss")) {
      return false;
    }
    return !entry.placedHotspotId;
  });
}

function writeStoryDialogue(
  kind: StoryChainNodeKind,
  start: StoryChainStart,
  end: StoryChainEnd,
  npcName: string,
  note?: string,
): string[] {
  const premise = textOf(start.premise);
  const hint = textOf(note);
  const resolution = textOf(end.resolution);
  if (kind === "start") {
    const fishing = storyTextLooksLikeFishing(`${premise} ${hint}`);
    return [
      premise ||
        (fishing
          ? "The stall is empty. I haven't a scrap of fish left to sell."
          : "I need a crew that can keep a secret."),
      hint ||
        (fishing
          ? "Bring me five fish and I can open again. I'll make it worth your while."
          : "Help me, and I'll make it worth your while."),
    ];
  }
  if (kind === "talk") {
    return [hint || "That catch isn't enough. I need something bigger — or more of it."];
  }
  if (kind === "end") {
    const seaKing = storyTextLooksLikeSeaKing(`${premise} ${resolution} ${hint}`);
    if (seaKing) {
      return [
        hint ||
          resolution ||
          "Sea King meat. That's the only thing that fills this stall now. Bring it here.",
      ];
    }
    return [resolution || `You brought what ${npcName} asked. The stall can breathe again.`];
  }
  if (kind === "event" && storyTextLooksLikeFishing(`${premise} ${hint}`)) {
    return [hint || "The shallows are restless. Five fish should do — unless something larger takes the hook."];
  }
  if (hint) {
    return [hint];
  }
  return [premise || "The island answers, if you press."];
}

function fillStoryPlayDraft(
  node: StoryChainNode,
  chain: StoryChain,
  slotNote?: string,
): StoryChainNode {
  const seed = `${chain.id}:${node.id}:${node.kind}`;
  const npcName = node.questDraft?.npcName || pickStoryNpcName(seed);
  const note = slotNote || node.notes || node.questDraft?.adaptedText;
  const fishing = storyTextLooksLikeFishing(
    `${chain.start.premise ?? ""} ${chain.name} ${note ?? ""} ${node.label ?? ""}`,
  );
  const seaKing = storyTextLooksLikeSeaKing(
    `${chain.start.premise ?? ""} ${chain.end.resolution ?? ""} ${chain.name} ${note ?? ""} ${node.label ?? ""}`,
  );
  const objective =
    node.questDraft?.objective ??
    (node.kind === "event" && fishing
      ? { type: "collect_item" as const, itemId: "fish", count: 5, label: "Catch 5 fish" }
      : node.kind === "end" && fishing && seaKing
        ? SEA_KING_MEAT_OBJECTIVE
        : undefined);
  const dialogueLines =
    node.questDraft?.dialogueLines?.length
      ? node.questDraft.dialogueLines
      : writeStoryDialogue(node.kind, chain.start, chain.end, npcName, note);
  return {
    ...node,
    questDraft: {
      ...node.questDraft,
      npcName,
      dialogueLines,
      encounterTitle:
        node.questDraft?.encounterTitle ||
        (node.kind === "start" || node.kind === "talk"
          ? `${npcName} at the stall`
          : node.label || chain.name),
      encounterDescription:
        node.questDraft?.encounterDescription ||
        (objective?.itemId === SEA_KING_MEAT_ITEM_ID
          ? `${npcName} will only close this when you bring Sea King meat.`
          : objective
            ? `${npcName} needs ${objective.count} fish. The fishing grounds can supply them.`
            : dialogueLines[0]),
      objective,
    },
  };
}

export function buildStoryEncounter(chain: StoryChain, node: StoryChainNode): Encounter {
  const draft = node.questDraft;
  const npcName = draft?.npcName || "A local";
  const lines = draft?.dialogueLines?.length ? draft.dialogueLines : writeStoryDialogue(node.kind, chain.start, chain.end, npcName, node.notes);
  const objective = draft?.objective;
  const fishing = Boolean(objective) || storyTextLooksLikeFishing(`${node.notes ?? ""} ${node.label ?? ""}`);
  const id = `${STORY_ENCOUNTER_PREFIX}${chain.id}:${node.id}`;
  if (fishing && node.kind !== "start" && node.kind !== "talk" && node.kind !== "end") {
    const have = 0;
    return {
      id,
      title: draft?.encounterTitle || "Fishing grounds",
      description:
        draft?.encounterDescription ||
        `Catch ${objective?.count ?? 5} fish for ${npcName}. You can turn them in once the crate is full.`,
      category: "SEA",
      weight: 0,
      timeCost: "SLOT",
      dialogueBeats: [
        {
          speakerId: "story_npc",
          speakerName: npcName,
          line: lines[0] ?? `I need ${objective?.count ?? 5} fish.`,
        },
      ],
      choices: [
        {
          id: "cast",
          text: "Cast a line",
          timeCost: "SLOT",
          outcome: {
            text: "A fish hits the bucket.",
            grantItemIds: ["fish"],
          },
        },
        {
          id: "leave",
          text: "Leave the shallows",
          timeCost: "BRIEF",
          outcome: { text: have >= (objective?.count ?? 5) ? "The crate is ready." : "The water can wait." },
        },
      ],
    };
  }
  return {
    id,
    title: draft?.encounterTitle || chain.name || "A request",
    description: draft?.encounterDescription || lines.slice(1).join(" ") || lines[0] || chain.start.premise || "",
    category: "SOCIAL",
    weight: 0,
    timeCost: "BRIEF",
    dialogueBeats: lines.map((line, index) => ({
      speakerId: `story_npc_${index}`,
      speakerName: npcName,
      line,
    })),
    choices: [
      {
        id: "accept",
        text:
          node.kind === "end" && objective?.itemId === SEA_KING_MEAT_ITEM_ID
            ? "Hand over the Sea King meat"
            : node.kind === "end"
              ? "Finish the request"
              : "I'll take care of it",
        timeCost: "BRIEF",
        outcome: {
          text:
            node.kind === "end" && objective?.itemId === SEA_KING_MEAT_ITEM_ID
              ? `${npcName} takes the slab with both hands. The stall can open again.`
              : node.kind === "end"
                ? `${npcName} nods, satisfied.`
                : `${npcName} watches you go.`,
        },
      },
    ],
  };
}

export function nestChildForStoryNode(
  facilityId: IslandMapHotspotId,
  node: Pick<StoryChainNode, "id" | "kind" | "trigger">,
): string | undefined {
  if (isLeafHubFacility(facilityId) || facilityId === "MARKET" || facilityId === "WEAPON_SHOP") {
    return storyChildActionId(node);
  }
  return nestChildForFacility(facilityId, node.kind);
}

export function nestChildForFacility(
  facilityId: IslandMapHotspotId,
  kind: StoryChainNodeKind,
): string | undefined {
  if (facilityId === "TRAINING_GROUNDS") {
    return kind === "battle" || kind === "boss" ? "TRAIN_SPAR" : "TRAIN_VIEW";
  }
  if (facilityId === "INN") {
    return kind === "talk" ? "TALK_NPCS" : "INN_EAT_DRINK";
  }
  if (facilityId === "MARKET" || facilityId === "WEAPON_SHOP") {
    return undefined;
  }
  if (facilityId === "HARBOR") {
    return kind === "talk" ? "HARBOR_CREW" : "HARBOR_SHIP";
  }
  if (facilityId === "LIBRARY") {
    return "LIB_RESEARCH";
  }
  if (facilityId === "CLINIC") {
    return "CLINIC_HEAL";
  }
  if (facilityId === "TASK_BOARD") {
    return "TASK_JOBS";
  }
  return undefined;
}

export function proposeBeatOptions(
  kind: StoryChainNodeKind,
  start: StoryChainStart,
  placeName?: string,
  beatHint?: string,
): string[] {
  const premise = textOf(start.premise) || "the trouble on this island";
  const twist = textOf(start.twist);
  const tone = textOf(String(start.tone ?? "adventure"));
  const where = placeName?.trim() || "this place";
  const hook = premise.length > 90 ? `${premise.slice(0, 87)}…` : premise;
  const variants: Record<string, [string, string, string]> = {
    talk: [
      `Ask around ${where}: someone overheard a clue about ${hook}.`,
      `A regular at ${where} will only talk if you match the ${tone} mood of the room.`,
      twist
        ? `The friendly face at ${where} is lying — ${twist}`
        : `A child at ${where} repeats a rumor that doesn't match ${hook}.`,
    ],
    investigate: [
      `Search ${where} for traces left after ${hook}.`,
      `Something at ${where} was moved on purpose — follow the scuff marks.`,
      twist
        ? `The obvious clue at ${where} is bait. ${twist}`
        : `A locked box at ${where} holds a scrap that names the next stop.`,
    ],
    event: [
      `A sudden scene at ${where} forces a choice about ${hook}.`,
      `Locals at ${where} demand you pick a side before the ${tone} story moves on.`,
      twist
        ? `What looks like help at ${where} flips: ${twist}`
        : `A timed chance at ${where} — act now or the lead about ${hook} vanishes.`,
    ],
    explore: [
      `Push deeper through ${where}; the path answers ${hook}.`,
      `A hidden turn at ${where} only opens if you trust the ${tone} instinct.`,
      twist
        ? `The safe route at ${where} is the trap. ${twist}`
        : `Tracks at ${where} split — one set matches ${hook}.`,
    ],
    battle: [
      `A fight breaks at ${where} over ${hook}.`,
      `Rivals block ${where} until you prove you belong in this ${tone} tale.`,
      twist
        ? `The first swing at ${where} is a setup. ${twist}`
        : `Spare or finish — the crowd at ${where} is watching.`,
    ],
    boss: [
      `The named threat waits at ${where}, tied to ${hook}.`,
      `This ${tone} clash at ${where} is personal — they already know your crew.`,
      twist
        ? `The boss at ${where} is not who the premise named. ${twist}`
        : `Win at ${where} and the island will not stay quiet about ${hook}.`,
    ],
    beat: [
      `At ${where}, the story must land this beat: ${hook}.`,
      `Use ${where} to make the ${tone} turn feel earned.`,
      twist
        ? `Hold the twist until ${where}: ${twist}`
        : `A quiet moment at ${where} changes how ${hook} reads.`,
    ],
  };
  const base = variants[kind] ?? variants.event;
  const hint = beatHint?.trim();
  if (!hint) {
    return base;
  }
  return [hint, base[0], base[1]];
}

export function adaptCustomPrompt(
  prompt: string,
  start: StoryChainStart,
  kind: StoryChainNodeKind,
  placeName?: string,
): string {
  const raw = prompt.trim();
  if (!raw) {
    return "";
  }
  const tone = textOf(String(start.tone ?? "adventure"));
  const where = placeName?.trim();
  const hook = textOf(start.premise);
  const placeBit = where ? ` at ${where}` : "";
  const hookBit = hook ? ` It still has to serve “${hook}”.` : "";
  return `${kind} (${tone})${placeBit}: ${raw}.${hookBit}`;
}

export function proposeBattleDraft(
  kind: StoryChainNodeKind,
  start: StoryChainStart,
  placeName?: string,
): Pick<StoryQuestDraft, "battleSuggestion" | "enemyCount" | "enemyStrength" | "enemyRole"> {
  const boss = kind === "boss" || Boolean(start.bossBattle && kind === "battle");
  const where = placeName?.trim() || "the marked ground";
  const hook = textOf(start.premise) || "the island's trouble";
  return {
    battleSuggestion: boss
      ? `Suggested boss stand at ${where} — one named threat tied to ${hook}.`
      : `Suggested scrap at ${where} — a few bodies, not a war, over ${hook}.`,
    enemyCount: boss ? 1 : 3,
    enemyStrength: boss ? "strong" : "normal",
    enemyRole: boss ? "boss" : "normal",
  };
}

function placeNameFromMatch(
  match: { hotspotId?: string; locationAnchorId?: string; locationRegionId?: string },
  ctx: LocationMatchContext,
): string | undefined {
  if (match.locationRegionId) {
    const region = ctx.regions?.find((r) => r.id === match.locationRegionId);
    if (region?.name.trim()) {
      return region.name.trim();
    }
  }
  if (match.locationAnchorId) {
    const anchor = ctx.anchors.find((a) => a.id === match.locationAnchorId);
    if (anchor?.text.trim()) {
      return anchor.text.trim();
    }
  }
  if (match.hotspotId) {
    const hotspot = ctx.hotspots.find((h) => h.hotspotId === match.hotspotId);
    if (hotspot) {
      return hotspot.purpose?.trim() || hotspotLabel(hotspot.facilityId);
    }
  }
  return undefined;
}

function autoPlaceGenerated(node: StoryChainNode, ctx: LocationMatchContext): StoryChainNode {
  if (node.placedHotspotId || !node.suggestedHotspotId) {
    return node;
  }
  const hotspot = ctx.hotspots.find((entry) => entry.hotspotId === node.suggestedHotspotId);
  if (hotspot?.facilityId === "FISHING") {
    return {
      ...node,
      placedHotspotId: hotspot.hotspotId,
      trigger: {
        kind: "map_icon",
        ref: hotspot.hotspotId,
        islandId: ctx.island?.id,
        mapAssetId: ctx.island?.mapAssetId ?? undefined,
      },
    };
  }
  return node;
}

function autoNestIfFacility(node: StoryChainNode, ctx: LocationMatchContext): StoryChainNode {
  if (node.placedHotspotId || !node.suggestedHotspotId) {
    return node;
  }
  const hotspot = ctx.hotspots.find((h) => h.hotspotId === node.suggestedHotspotId);
  if (!hotspot || !isFacilityHotspotId(hotspot.facilityId)) {
    return node;
  }
  if (!HUB_NEST_FACILITIES.has(hotspot.facilityId)) {
    return node;
  }
  const childId = nestChildForStoryNode(hotspot.facilityId, node);
  return {
    ...node,
    placedHotspotId: hotspot.hotspotId,
    trigger: childId
      ? {
          kind: "suboption",
          ref: `${hotspot.hotspotId}:${childId}`,
          childId,
          islandId: ctx.island?.id,
          mapAssetId: ctx.island?.mapAssetId ?? undefined,
        }
      : {
          kind: "map_icon",
          ref: hotspot.hotspotId,
          islandId: ctx.island?.id,
          mapAssetId: ctx.island?.mapAssetId ?? undefined,
        },
  };
}

function buildGeneratedNode(
  slot: { key: string; kind: StoryChainNodeKind; label: string; note?: string },
  order: number,
  start: StoryChainStart,
  end: StoryChainEnd,
  ctx: LocationMatchContext,
): StoryChainNode {
  let match = matchLocationForKind(slot.kind, ctx);
  if (storyTextLooksLikeFishing(`${slot.label} ${slot.note ?? ""}`)) {
    const fishing = ctx.hotspots.find((hotspot) => hotspot.facilityId === "FISHING" && !hotspot.hidden);
    if (fishing) {
      match = { hotspotId: fishing.hotspotId };
    }
  }
  const node = createStoryChainNode(order, slot.kind, applyToneLabel(slot.label, start));
  node.generationKey = slot.key;
  node.editState = slot.key === "must:0" ? "locked" : "generated";
  node.suggestedHotspotId = match.hotspotId;
  node.locationAnchorId = match.locationAnchorId;
  node.locationRegionId = match.locationRegionId;
  const premise = textOf(start.premise);
  const twist = textOf(start.twist);
  const restrictions = textOf(start.restrictions);
  const resolution = textOf(end.resolution);
  if (slot.kind === "start") {
    node.trigger = {
      kind: "enter_location",
      islandId: ctx.island?.id,
      mapAssetId: ctx.island?.mapAssetId ?? undefined,
    };
    node.notes = premise || undefined;
  } else if (slot.kind === "end") {
    node.notes = resolution || undefined;
    if (end.unlocks?.islandId) {
      node.toIslandId = end.unlocks.islandId;
    }
    if (end.unlocks?.hotspotId) {
      node.suggestedHotspotId = end.unlocks.hotspotId;
    }
  } else if (slot.kind === "talk") {
    node.notes = restrictions || (premise ? `Ask around: ${premise}` : undefined);
  } else if (slot.kind === "investigate") {
    node.notes = restrictions || (premise ? `Follow the trail: ${premise}` : undefined);
  } else if (slot.kind === "event") {
    node.notes = twist ? `Twist: ${twist}` : premise || undefined;
  } else if (slot.kind === "battle") {
    node.trigger = { kind: "battle_ended" };
    node.notes = restrictions || (premise ? `Fight over: ${premise}` : undefined);
  } else if (slot.kind === "boss") {
    node.trigger = { kind: "battle_ended" };
    node.notes = twist ? `Twist: ${twist}` : restrictions || premise || undefined;
  } else if (slot.kind === "beat") {
    node.notes = slot.label;
  } else {
    node.notes = restrictions || premise || undefined;
  }
  if (slot.note?.trim() && slot.kind !== "start" && slot.kind !== "end") {
    node.notes = slot.note.trim();
  }
  const placeName = placeNameFromMatch(match, ctx);
  const options = proposeBeatOptions(slot.kind, start, placeName, slot.note);
  const battle =
    slot.kind === "battle" || slot.kind === "boss"
      ? proposeBattleDraft(slot.kind, start, placeName)
      : {};
  node.questDraft = {
    options,
    ...battle,
  };
  return node;
}

function addNews(run: RunState, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  run.world.history.push({
    id: createId("news"),
    day: run.day,
    text: trimmed,
  });
}

function addFlag(list: string[] | undefined, flag: string): string[] {
  const next = [...(list ?? [])];
  if (!next.includes(flag)) {
    next.push(flag);
  }
  return next;
}

function parseSignedAmount(raw: string, fallback: number): { token: string; amount: number } {
  const text = raw.trim();
  const match = text.match(/^([A-Za-z0-9_:-]+)\s*[: ]\s*([+-]?\d+)\s*$/);
  if (match?.[1] && match[2]) {
    return { token: match[1], amount: Number(match[2]) };
  }
  const onlyNum = text.match(/^([+-]?\d+)\s*$/);
  if (onlyNum?.[1]) {
    return { token: "", amount: Number(onlyNum[1]) };
  }
  return { token: text, amount: fallback };
}

function parseFactionId(token: string): RelationFactionId | null {
  const key = token.trim().toUpperCase().replace(/\s+/g, "_");
  if (RELATION_FACTIONS.includes(key as RelationFactionId)) {
    return key as RelationFactionId;
  }
  if (key === "MARINE" || key === "NAVY") {
    return "MARINES";
  }
  if (key === "PIRATE") {
    return "PIRATES";
  }
  if (key === "WG" || key === "GOVERNMENT") {
    return "WORLD_GOVERNMENT";
  }
  if (key === "CIVILIAN") {
    return "CIVILIANS";
  }
  if (key === "REVOLUTIONARY" || key === "RA") {
    return "REVOLUTIONARY_ARMY";
  }
  return null;
}

function parseTimeRef(trigger: StoryChainTrigger): { day?: number; timeOfDay?: TimeOfDay } {
  if (trigger.day != null || trigger.timeOfDay) {
    return { day: trigger.day, timeOfDay: trigger.timeOfDay };
  }
  const ref = (trigger.ref ?? "").trim();
  if (!ref) {
    return {};
  }
  const asTime = ref.toUpperCase() as TimeOfDay;
  if ((TIME_OF_DAY_ORDER as readonly string[]).includes(asTime)) {
    return { timeOfDay: asTime };
  }
  const dayMatch = ref.match(/^(?:day:)?(\d+)$/i);
  if (dayMatch?.[1]) {
    return { day: Number(dayMatch[1]) };
  }
  return {};
}

function triggerKindMatches(trigger: StoryChainTrigger, event: StoryTriggerEvent): boolean {
  if (trigger.kind === event.kind) {
    return true;
  }
  if (event.kind === "rest" && trigger.kind === "suboption" && trigger.childId === "INN_REST") {
    return true;
  }
  return false;
}

function matchesTime(trigger: StoryChainTrigger, event: StoryTriggerEvent): boolean {
  const parsed = parseTimeRef(trigger);
  if (parsed.day != null && (event.day ?? 0) < parsed.day) {
    return false;
  }
  if (parsed.timeOfDay && event.timeOfDay && parsed.timeOfDay !== event.timeOfDay) {
    return false;
  }
  return true;
}

function matchesActivity(trigger: StoryChainTrigger, event: StoryTriggerEvent): boolean {
  const expected = (trigger.activityType || trigger.ref || "").trim().toUpperCase();
  if (!expected) {
    return true;
  }
  return (event.activityType ?? "").trim().toUpperCase() === expected;
}

function matchesBattle(trigger: StoryChainTrigger, event: StoryTriggerEvent): boolean {
  const expected = (trigger.ref ?? "").trim().toUpperCase();
  if (expected === "WIN") {
    return event.won === true;
  }
  if (expected === "LOSE") {
    return event.won === false;
  }
  return true;
}

export function storyTitleFromFlags(run: RunState): string | undefined {
  const flag = run.player.flags.find((f) => f.startsWith(STORY_TITLE_FLAG_PREFIX));
  const extra = flag?.slice(STORY_TITLE_FLAG_PREFIX.length).trim();
  return extra || undefined;
}

export function withStoryTitle(run: RunState, base: string): string {
  const extra = storyTitleFromFlags(run);
  if (!extra || base.includes(extra)) {
    return base;
  }
  return `${base} · ${extra}`;
}

export const StoryChainService = {
  validateForGenerate(chain: StoryChain): string | null {
    if (!chain.start.premise?.trim()) {
      return "Fill Premise first — how the quest starts at the quest icon.";
    }
    if (!chain.end.resolution?.trim()) {
      return "Fill Resolution (End) first — how this story lands.";
    }
    return null;
  },

  generateStructure(chain: StoryChain, ctx: LocationMatchContext): StoryChain {
    const fingerprint = storyChainStructureFingerprint(chain.start);
    const existing = chain.nodes.map((n) => ({ ...n }));
    const startNode =
      existing.find((n) => n.kind === "start") ?? createStoryChainNode(1, "start", "Start");
    startNode.kind = "start";
    startNode.generationKey = "start";
    startNode.label = startNode.label || "Start";
    startNode.notes = chain.start.premise?.trim() || startNode.notes;
    if (startNode.editState !== "edited" && startNode.editState !== "locked") {
      startNode.editState = "generated";
    }
    if (!startNode.trigger) {
      startNode.trigger = {
        kind: "enter_location",
        islandId: ctx.island?.id ?? chain.islandId,
        mapAssetId: ctx.island?.mapAssetId ?? chain.mapAssetId,
      };
    }
    const startMatch = matchLocationForKind("start", ctx);
    if (chain.start.startHub) {
      const hub = ctx.hotspots.find((h) => h.facilityId === chain.start.startHub && !h.hidden);
      if (hub) {
        startNode.suggestedHotspotId = hub.hotspotId;
      }
    } else if (!startNode.placedHotspotId && startMatch.hotspotId) {
      startNode.suggestedHotspotId = startMatch.hotspotId;
    }
    if (chain.start.startHub && !startNode.placedHotspotId && startNode.suggestedHotspotId) {
      const nestedStart = autoNestIfFacility(startNode, ctx);
      startNode.placedHotspotId = nestedStart.placedHotspotId;
      if (nestedStart.trigger) {
        startNode.trigger = nestedStart.trigger;
      }
    }
    Object.assign(startNode, fillStoryPlayDraft(startNode, chain, chain.start.premise));
    if (!startNode.locationAnchorId && startMatch.locationAnchorId) {
      startNode.locationAnchorId = startMatch.locationAnchorId;
    }
    if (!startNode.locationRegionId && startMatch.locationRegionId) {
      startNode.locationRegionId = startMatch.locationRegionId;
    }

    const endNode = existing.find((n) => n.kind === "end") ?? createStoryChainNode(99, "end", "End");
    endNode.kind = "end";
    endNode.generationKey = "end";
    endNode.label = endNode.label || "End";
    endNode.notes = chain.end.resolution?.trim() || endNode.notes;
    if (endNode.editState !== "edited" && endNode.editState !== "locked") {
      endNode.editState = "generated";
    }
    if (chain.end.unlocks?.islandId) {
      endNode.toIslandId = chain.end.unlocks.islandId;
    }
    const endMatch = matchLocationForKind("end", ctx);
    if (!endNode.placedHotspotId && (chain.end.unlocks?.hotspotId || endMatch.hotspotId)) {
      endNode.suggestedHotspotId = chain.end.unlocks?.hotspotId || endMatch.hotspotId;
    }

    const keptByKey = new Map<string, StoryChainNode>();
    for (const node of existing) {
      if (node.kind === "start" || node.kind === "end") {
        continue;
      }
      if (keepNode(node) && node.generationKey) {
        keptByKey.set(node.generationKey, node);
      } else if (keepNode(node) && !node.generationKey) {
        keptByKey.set(`kept:${node.id}`, node);
      }
    }

    const middles: StoryChainNode[] = [];
    // Template fiches go in the Thread queue immediately. Never auto-place them on the map.
    for (const slot of desiredSlots(chain.start)) {
      const kept = keptByKey.get(slot.key);
      if (kept) {
        middles.push(kept);
        keptByKey.delete(slot.key);
      } else {
        const generated = autoPlaceGenerated(
          fillStoryPlayDraft(
            autoNestIfFacility(buildGeneratedNode(slot, 0, chain.start, chain.end, ctx), ctx),
            chain,
            slot.note,
          ),
          ctx,
        );
        middles.push(generated);
      }
    }
    for (const leftover of keptByKey.values()) {
      middles.push(leftover);
    }
    if (
      storyTextLooksLikeFishing(`${chain.start.premise ?? ""} ${chain.name}`) &&
      !middles.some((node) => node.questDraft?.objective)
    ) {
      const event = middles.find((node) => node.kind === "event");
      if (event) {
        event.questDraft = {
          ...event.questDraft,
          objective: { type: "collect_item", itemId: "fish", count: 5, label: "Catch 5 fish" },
        };
      }
    }

    const nodes = [startNode, ...middles, endNode].map((n, i) => ({ ...n, order: i + 1 }));
    return ensureSeaKingTurnIn({
      ...chain,
      nodes,
      generationFingerprint: fingerprint,
    });
  },

  applyBeatChoice(
    chain: StoryChain,
    nodeId: string,
    choice: { index?: number; customPrompt?: string },
    placeName?: string,
  ): StoryChain {
    return {
      ...chain,
      nodes: chain.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }
        const options = node.questDraft?.options?.length
          ? node.questDraft.options
          : proposeBeatOptions(node.kind, chain.start, placeName);
        const custom = (choice.customPrompt ?? "").trim();
        const index = custom ? 3 : Math.max(0, Math.min(2, choice.index ?? 0));
        const adapted = custom
          ? adaptCustomPrompt(custom, chain.start, node.kind, placeName)
          : (options[index] ?? options[0]);
        return {
          ...node,
          notes: adapted,
          editState: node.editState === "locked" ? "locked" : "edited",
          questDraft: {
            ...node.questDraft,
            options,
            chosenIndex: index,
            customPrompt: custom || undefined,
            adaptedText: adapted,
          },
        };
      }),
    };
  },

  applyBattleDraft(
    chain: StoryChain,
    nodeId: string,
    patch: {
      enemyCount?: number;
      enemyStrength?: StoryBeatEnemyStrength;
      enemyRole?: StoryBeatEnemyRole;
    },
  ): StoryChain {
    return {
      ...chain,
      nodes: chain.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }
        const enemyCount = Math.max(
          1,
          Math.min(8, patch.enemyCount ?? node.questDraft?.enemyCount ?? 3),
        );
        const enemyStrength = patch.enemyStrength ?? node.questDraft?.enemyStrength ?? "normal";
        const enemyRole = patch.enemyRole ?? node.questDraft?.enemyRole ?? "normal";
        const suggestion =
          node.questDraft?.battleSuggestion ??
          `${enemyCount} ${enemyStrength} ${enemyRole === "boss" ? "boss" : "normal"} at this stand.`;
        return {
          ...node,
          kind: enemyRole === "boss" ? "boss" : node.kind === "boss" ? "battle" : node.kind,
          notes: `${suggestion} (${enemyCount} ${enemyStrength}, ${enemyRole})`,
          editState: node.editState === "locked" ? "locked" : "edited",
          questDraft: {
            ...node.questDraft,
            battleSuggestion: suggestion,
            enemyCount,
            enemyStrength,
            enemyRole,
          },
        };
      }),
    };
  },

  nestNode(
    chain: StoryChain,
    nodeId: string,
    target: {
      hotspotId: string;
      childId?: string;
      islandId?: string;
      mapAssetId?: string;
    },
  ): StoryChain {
    const nodes = chain.nodes.map((n) => {
      if (n.id !== nodeId) {
        return n;
      }
      const trigger: StoryChainTrigger = target.childId
        ? {
            kind: "suboption",
            ref: `${target.hotspotId}:${target.childId}`,
            childId: target.childId,
            islandId: target.islandId,
            mapAssetId: target.mapAssetId,
          }
        : {
            kind: "map_icon",
            ref: target.hotspotId,
            islandId: target.islandId,
            mapAssetId: target.mapAssetId,
          };
      return {
        ...n,
        placedHotspotId: target.hotspotId,
        toIslandId: target.islandId,
        toMapAssetId: target.mapAssetId,
        trigger,
        editState: n.editState === "generated" ? "edited" : n.editState ?? "edited",
      };
    });
    return { ...chain, nodes };
  },

  unnestNode(chain: StoryChain, nodeId: string): StoryChain {
    const nodes: StoryChainNode[] = chain.nodes.map((n) => {
      if (n.id !== nodeId) {
        return n;
      }
      const next: StoryChainNode = {
        ...n,
        placedHotspotId: undefined,
        trigger:
          n.kind === "start"
            ? { kind: "enter_location", islandId: chain.islandId, mapAssetId: chain.mapAssetId }
            : n.kind === "battle" || n.kind === "boss"
              ? { kind: "battle_ended" }
              : undefined,
      };
      return next;
    });
    return { ...chain, nodes };
  },

  setNodeEditState(chain: StoryChain, nodeId: string, editState: StoryChainNode["editState"]): StoryChain {
    return {
      ...chain,
      nodes: chain.nodes.map((n) => (n.id === nodeId ? { ...n, editState } : n)),
    };
  },

  setNodeTrigger(
    chain: StoryChain,
    nodeId: string,
    patch: Partial<StoryChainTrigger> & { kind: StoryChainTriggerKind },
  ): StoryChain {
    return {
      ...chain,
      nodes: chain.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              trigger: { ...(n.trigger ?? { kind: patch.kind }), ...patch },
              editState: n.editState === "generated" ? "edited" : n.editState ?? "edited",
            }
          : n,
      ),
    };
  },

  nodesOnHotspot(chains: StoryChain[], hotspotId: string): StoryChainNode[] {
    return chains.flatMap((c) => c.nodes.filter((n) => n.placedHotspotId === hotspotId));
  },

  collectTriggers(
    chains: StoryChain[],
    event: StoryTriggerEvent,
    progress: StoryChainProgress[] | undefined,
    run?: RunState | null,
  ): PendingStoryTrigger[] {
    const fired = new Set(
      (progress ?? []).flatMap((p) => p.firedNodeIds.map((id) => `${p.chainId}:${id}`)),
    );
    const pending: PendingStoryTrigger[] = [];
    for (const chain of chains) {
      for (const node of chain.nodes) {
        if (fired.has(`${chain.id}:${node.id}`)) {
          continue;
        }
        if (run && !isStoryNodeAvailable(chain, node, run)) {
          continue;
        }
        const trigger = node.trigger;
        if (!trigger || !TRIGGER_KINDS.has(trigger.kind)) {
          continue;
        }
        if (!triggerKindMatches(trigger, event)) {
          continue;
        }
        if (event.kind === "map_icon") {
          const ref = trigger.ref || node.placedHotspotId;
          if (!event.hotspotId || ref !== event.hotspotId) {
            continue;
          }
          if (trigger.islandId && event.islandId && trigger.islandId !== event.islandId) {
            continue;
          }
        } else if (event.kind === "suboption" || (event.kind === "rest" && trigger.kind === "suboption")) {
          if (event.kind === "suboption" && event.childId?.startsWith(STORY_CHILD_PREFIX)) {
            const nodeId = event.childId.slice(STORY_CHILD_PREFIX.length);
            if (node.id !== nodeId) {
              continue;
            }
            if (event.hotspotId && node.placedHotspotId && node.placedHotspotId !== event.hotspotId) {
              continue;
            }
          } else {
            if (event.kind === "suboption" && event.childId === "HUB_VISIT" && shouldExposeStoryChild(node)) {
              continue;
            }
            const expected = event.hotspotId && event.childId ? `${event.hotspotId}:${event.childId}` : event.childId;
            const matches =
              (trigger.ref && expected && trigger.ref === expected) ||
              (trigger.childId && event.childId && trigger.childId === event.childId &&
                (!trigger.ref || !event.hotspotId || trigger.ref.startsWith(`${event.hotspotId}:`)));
            if (event.kind === "suboption" && !matches) {
              continue;
            }
          }
        } else if (event.kind === "enter_location") {
          const targetIsland = trigger.islandId || node.toIslandId || chain.islandId;
          if (targetIsland && event.islandId && targetIsland !== event.islandId) {
            continue;
          }
          const targetMap = trigger.mapAssetId || node.toMapAssetId || chain.mapAssetId;
          if (targetMap && event.mapAssetId && targetMap !== event.mapAssetId) {
            continue;
          }
        } else if (event.kind === "time") {
          if (!matchesTime(trigger, event)) {
            continue;
          }
        } else if (event.kind === "activity_completed") {
          if (!matchesActivity(trigger, event)) {
            continue;
          }
        } else if (event.kind === "battle_ended") {
          if (!matchesBattle(trigger, event)) {
            continue;
          }
        } else if (event.kind === "flag") {
          if (trigger.ref && event.ref && trigger.ref !== event.ref) {
            continue;
          }
        }
        pending.push({
          chainId: chain.id,
          nodeId: node.id,
          kind: trigger.kind,
          priority: (KIND_PRIORITY[trigger.kind] ?? 80) * 1000 + node.order,
          islandId: event.islandId,
        });
      }
    }
    pending.sort((a, b) => a.priority - b.priority);
    return pending;
  },

  enqueue(run: RunState, incoming: PendingStoryTrigger[]): PendingStoryTrigger[] {
    const queue = [...(run.pendingStoryTriggers ?? [])];
    const seen = new Set(queue.map((t) => `${t.chainId}:${t.nodeId}`));
    for (const item of incoming) {
      const key = `${item.chainId}:${item.nodeId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      queue.push(item);
    }
    queue.sort((a, b) => a.priority - b.priority);
    run.pendingStoryTriggers = queue;
    return queue;
  },

  dequeueNext(
    run: RunState,
    profile?: ProfileSave | null,
  ): { line: string; trigger: PendingStoryTrigger; node: StoryChainNode; chain: StoryChain } | null {
    const queue = [...(run.pendingStoryTriggers ?? [])];
    const next = queue.shift();
    if (!next) {
      return null;
    }
    run.pendingStoryTriggers = queue;
    const chain = this.findChain(run, next.chainId);
    if (!chain) {
      return null;
    }
    const node = chain.nodes.find((n) => n.id === next.nodeId);
    if (!node) {
      return null;
    }
    const objectiveOpen =
      Boolean(node.questDraft?.objective) && !storyObjectiveMet(run, node.questDraft?.objective);
    if (!objectiveOpen) {
      this.markFired(run, next.chainId, next.nodeId);
    }
    this.beginStoryEncounter(run, chain, node);
    let line = this.renderTriggerLine(chain, node);
    if (node.kind === "end" && !objectiveOpen) {
      consumeStoryTurnIn(run, node);
      const extras = this.applyEndEffects(run, chain, profile);
      if (extras.length) {
        line = `${line} ${extras.join(" ")}`;
      }
    }
    const travel = this.beginCrossMapTravel(run, chain, node);
    if (travel) {
      line = `${line} ${travel}`;
    }
    return { line, trigger: next, node, chain };
  },

  fireEvent(run: RunState, event: StoryTriggerEvent, profile?: ProfileSave | null): string | null {
    return this.fireEvents(run, [event], profile);
  },

  fireEvents(run: RunState, events: StoryTriggerEvent[], profile?: ProfileSave | null): string | null {
    this.syncObjectives(run);
    const chains = this.allChains(run);
    const incoming = events.flatMap((event) =>
      this.collectTriggers(chains, event, run.storyChainProgress, run),
    );
    this.enqueue(run, incoming);
    const fired = this.dequeueNext(run, profile);
    return fired?.line ?? null;
  },

  beginStoryEncounter(run: RunState, chain: StoryChain, node: StoryChainNode): void {
    if (node.kind === "battle" || node.kind === "boss") {
      return;
    }
    const encounter = buildStoryEncounter(chain, node);
    run.dynamicEncounter = encounter;
    run.currentEncounterId = encounter.id;
    run.awaitingAdvance = false;
    run.lastResultText = null;
    run.combat = null;
  },

  seaKingHookAvailable(run: RunState | null | undefined): SeaKingHookTarget | null {
    return findSeaKingHook(run);
  },

  ensureSeaKingTurnIn(chain: StoryChain): StoryChain {
    return ensureSeaKingTurnIn(chain);
  },

  markSeaKingHooked(run: RunState, target?: SeaKingHookTarget | null): SeaKingHookTarget | null {
    const hook = target ?? findSeaKingHook(run);
    if (!hook) {
      return null;
    }
    this.markFired(run, hook.chainId, hook.battleNodeId);
    return hook;
  },

  syncObjectives(run: RunState): void {
    for (const chain of this.allChains(run)) {
      for (const node of playableStoryNodes(chain)) {
        const fired = firedSet(progressFor(chain.id, run));
        if (fired.has(node.id)) {
          continue;
        }
        if (storyObjectiveMet(run, node.questDraft?.objective)) {
          this.markFired(run, chain.id, node.id);
          continue;
        }
        break;
      }
    }
  },

  isPlayableStoryAction(run: RunState | null | undefined, chains: StoryChain[], actionId: string): boolean {
    if (!actionId.startsWith(STORY_CHILD_PREFIX)) {
      return true;
    }
    const nodeId = actionId.slice(STORY_CHILD_PREFIX.length);
    for (const chain of chains) {
      const node = chain.nodes.find((entry) => entry.id === nodeId);
      if (node) {
        return isStoryNodeAvailable(chain, node, run);
      }
    }
    return false;
  },

  hidesHotspotUntilReady(
    run: RunState | null | undefined,
    chains: StoryChain[],
    hotspot: { hotspotId: string; facilityId: string },
  ): boolean {
    if (!["QUEST", "EVENT", "TALK", "CHALLENGE", "INVESTIGATE"].includes(hotspot.facilityId)) {
      return false;
    }
    const nodes = this.nodesOnHotspot(chains, hotspot.hotspotId);
    if (nodes.length === 0) {
      return false;
    }
    return !nodes.some((node) => {
      const chain = chains.find((entry) => entry.nodes.some((entryNode) => entryNode.id === node.id));
      return Boolean(chain && isStoryNodeAvailable(chain, node, run));
    });
  },

  notifyTimeAndActivities(
    run: RunState,
    completed: AssignmentCompletionReport[] | undefined,
    profile?: ProfileSave | null,
  ): string | null {
    const events: StoryTriggerEvent[] = [
      {
        kind: "time",
        day: run.day,
        timeOfDay: run.timeOfDay,
        islandId: run.currentIslandId ?? undefined,
      },
    ];
    for (const report of completed ?? []) {
      events.push({
        kind: "activity_completed",
        activityType: report.type,
        islandId: run.currentIslandId ?? undefined,
      });
      if (report.type === "RESTING") {
        events.push({
          kind: "rest",
          activityType: report.type,
          islandId: run.currentIslandId ?? undefined,
        });
      }
    }
    return this.fireEvents(run, events, profile);
  },

  beginCrossMapTravel(run: RunState, chain: StoryChain, node: StoryChainNode): string | null {
    const destId = node.toIslandId;
    if (!destId || destId === run.currentIslandId) {
      return null;
    }
    const dest = (run.islands ?? []).find((island) => island.id === destId);
    run.pendingStoryTravel = {
      chainId: chain.id,
      nodeId: node.id,
      toIslandId: destId,
      toMapAssetId: node.toMapAssetId,
    };
    const name = dest?.name ?? destId;
    return `The trail continues at ${name}. Sail there to go on.`;
  },

  enqueueCrossMapArrival(run: RunState): void {
    const travel = run.pendingStoryTravel;
    const dest = run.currentIslandId;
    if (!travel || !dest || travel.toIslandId !== dest) {
      return;
    }
    const chain = this.findChain(run, travel.chainId);
    run.pendingStoryTravel = null;
    if (!chain) {
      return;
    }
    if (travel.toMapAssetId) {
      const island = (run.islands ?? []).find((entry) => entry.id === dest);
      if (island && island.mapAssetId !== travel.toMapAssetId) {
        island.mapAssetId = travel.toMapAssetId;
        const layout = island.mapLayouts?.[travel.toMapAssetId];
        if (layout?.hotspots) {
          island.facilityHotspots = [...layout.hotspots];
        }
      }
    }
    const progress = run.storyChainProgress?.find((p) => p.chainId === chain.id);
    const fired = new Set(progress?.firedNodeIds ?? []);
    const travelOrder = chain.nodes.find((n) => n.id === travel.nodeId)?.order ?? 0;
    const remaining = chain.nodes
      .filter((n) => n.id !== travel.nodeId && !fired.has(n.id) && n.order > travelOrder)
      .sort((a, b) => a.order - b.order);
    const next =
      remaining.find(
        (n) =>
          n.toIslandId === dest ||
          n.trigger?.islandId === dest ||
          n.kind === "end",
      ) ?? remaining[0];
    if (!next) {
      return;
    }
    this.enqueue(run, [
      {
        chainId: chain.id,
        nodeId: next.id,
        kind: next.trigger?.kind ?? "enter_location",
        priority: 5 * 1000 + next.order,
        islandId: dest,
      },
    ]);
  },

  applyEndEffects(run: RunState, chain: StoryChain, profile?: ProfileSave | null): string[] {
    const progress = (run.storyChainProgress ?? []).find((p) => p.chainId === chain.id);
    if (progress?.effectsApplied) {
      return [];
    }
    const extras: string[] = [];
    const effects = chain.end.effects ?? {};
    const unlocks = chain.end.unlocks ?? {};

    if (effects.worldNews?.trim()) {
      addNews(run, effects.worldNews);
      extras.push("News spreads.");
    }
    if (effects.world?.trim()) {
      addNews(run, effects.world);
      run.world.flags = addFlag(run.world.flags, `story_world:${chain.id}`);
      extras.push("The world shifts.");
    }
    if (effects.faction?.trim()) {
      const parsed = parseSignedAmount(effects.faction, 8);
      const factionId = parseFactionId(parsed.token) ?? parseFactionId(effects.faction);
      if (factionId) {
        FactionService.modifyRelationship(
          run,
          factionId,
          parsed.amount,
          `Story: ${chain.name || chain.id}`,
        );
        const aff = AffiliationService.ensure(run);
        if (aff.primaryFactionId === factionId || (factionId === "CIVILIANS" && aff.primaryFactionId === "CIVILIAN")) {
          AffiliationService.adjustInternalReputation(run, Math.max(1, Math.abs(parsed.amount)));
        }
        extras.push(`${factionId} standing ${parsed.amount >= 0 ? "+" : ""}${parsed.amount}.`);
      }
    }
    if (effects.relationship?.trim() || unlocks.npcId) {
      const parsed = parseSignedAmount(effects.relationship ?? "+2", 2);
      const npcId = parsed.token && CharacterService.getCharacter(run, parsed.token) ? parsed.token : unlocks.npcId;
      if (npcId) {
        const npc = CharacterService.getCharacter(run, npcId);
        if (npc) {
          npc.relationshipWithPlayer += parsed.amount;
          if (!npc.tags.includes("known_to_player")) {
            npc.tags.push("known_to_player");
          }
          CharacterService.addMemory(
            run,
            npcId,
            parsed.amount >= 0 ? "HELPED" : "BETRAYED",
            2,
            chain.name || "Story chain",
          );
          extras.push(`${npc.name} ${parsed.amount >= 0 ? "warms" : "cools"}.`);
        }
      }
    }
    if (effects.title?.trim()) {
      run.player.flags = addFlag(
        run.player.flags.filter((f) => !f.startsWith(STORY_TITLE_FLAG_PREFIX)),
        `${STORY_TITLE_FLAG_PREFIX}${effects.title.trim()}`,
      );
      AffiliationService.syncTitle(run);
      extras.push(`Known as ${effects.title.trim()}.`);
    }
    if (effects.legacy?.trim() && profile) {
      LegacyService.recordEvent(profile, {
        eventType: "STORY_CHAIN",
        summary: effects.legacy.trim(),
        runId: run.id,
        locationId: run.currentIslandId ?? run.currentLocationId,
        importance: chain.start.importance ?? 2,
        storyThreadIds: [chain.id],
        consequences: [effects.legacy.trim()],
      });
      extras.push("It enters the ledger.");
    }

    if (unlocks.questId?.trim()) {
      run.runFlags = addFlag(run.runFlags, unlocks.questId.trim());
      run.runFlags = addFlag(run.runFlags, `${STORY_QUEST_FLAG_PREFIX}${unlocks.questId.trim()}`);
      extras.push("A quest mark is noted.");
    }
    if (unlocks.npcId?.trim()) {
      const npc = CharacterService.getCharacter(run, unlocks.npcId.trim());
      if (npc && !npc.tags.includes("known_to_player")) {
        npc.tags.push("known_to_player");
        CharacterService.recordFirstMeeting(run, npc.id);
      }
    }
    if (unlocks.islandId?.trim()) {
      const island = (run.islands ?? []).find((entry) => entry.id === unlocks.islandId);
      run.runFlags = addFlag(run.runFlags, `${STORY_ISLAND_FLAG_PREFIX}${unlocks.islandId}`);
      if (island) {
        IslandService.addDiscoveryFlags(island, ["story_unlocked", `story_${chain.id}`]);
        extras.push(`${island.name} is marked on the charts.`);
      }
    }
    if (unlocks.hotspotId?.trim()) {
      const island =
        (unlocks.islandId
          ? (run.islands ?? []).find((entry) => entry.id === unlocks.islandId)
          : null) ?? IslandService.getCurrentIsland(run);
      if (island) {
        IslandService.unlockMapHotspot(island, unlocks.hotspotId.trim());
        extras.push("A map mark is revealed.");
      }
    }

    const list = [...(run.storyChainProgress ?? [])];
    const existing = list.find((p) => p.chainId === chain.id);
    if (existing) {
      existing.effectsApplied = true;
    } else {
      list.push({ chainId: chain.id, firedNodeIds: [], completedNodeIds: [], effectsApplied: true });
    }
    run.storyChainProgress = list;
    return extras;
  },

  allChains(run: RunState): StoryChain[] {
    const chains: StoryChain[] = [];
    for (const island of run.islands ?? []) {
      for (const layout of Object.values(island.mapLayouts ?? {})) {
        for (const chain of layout.storyChains ?? []) {
          const migrated = migrateStoryChain(chain);
          if (migrated) {
            chains.push(ensureSeaKingTurnIn(migrated));
          }
        }
      }
    }
    return chains;
  },

  findChain(run: RunState, chainId: string): StoryChain | undefined {
    return this.allChains(run).find((c) => c.id === chainId);
  },

  markFired(run: RunState, chainId: string, nodeId: string): void {
    const list = [...(run.storyChainProgress ?? [])];
    const existing = list.find((p) => p.chainId === chainId);
    if (existing) {
      if (!existing.firedNodeIds.includes(nodeId)) {
        existing.firedNodeIds = [...existing.firedNodeIds, nodeId];
      }
      if (!existing.completedNodeIds.includes(nodeId)) {
        existing.completedNodeIds = [...existing.completedNodeIds, nodeId];
      }
    } else {
      list.push({ chainId, firedNodeIds: [nodeId], completedNodeIds: [nodeId] });
    }
    run.storyChainProgress = list;
  },

  resetChain(run: RunState, chainId: string): void {
    run.storyChainProgress = (run.storyChainProgress ?? []).filter((entry) => entry.chainId !== chainId);
    run.pendingStoryTriggers = (run.pendingStoryTriggers ?? []).filter((entry) => entry.chainId !== chainId);
    if (run.pendingStoryTravel?.chainId === chainId) {
      run.pendingStoryTravel = null;
    }
    if (
      run.dynamicEncounter &&
      run.currentEncounterId === run.dynamicEncounter.id &&
      run.currentEncounterId.startsWith(`${STORY_ENCOUNTER_PREFIX}${chainId}`)
    ) {
      run.dynamicEncounter = null;
    }
  },

  renderTriggerLine(chain: StoryChain, node: StoryChainNode): string {
    const title = chain.name || "Story";
    const label = node.label || node.kind;
    const body =
      node.notes?.trim() ||
      (node.kind === "start" ? chain.start.premise : node.kind === "end" ? chain.end.resolution : "") ||
      "The story shifts.";
    return `[${title}] #${node.order} ${label} — ${body}`;
  },

  suboptionSlots(hotspot: IslandFacilityHotspot): Array<{ childId: string; label: string }> {
    return editorChildSlotsFor(hotspot.facilityId).map((s) => ({
      childId: s.childId,
      label: s.label,
    }));
  },

  hotspotOptionLabel(hotspot: IslandFacilityHotspot): string {
    return `${hotspotLabel(hotspot.facilityId)} (${hotspot.xPct.toFixed(0)}%, ${hotspot.yPct.toFixed(0)}%)`;
  },
};
