import type {
  AssignmentCompletionReport,
  Island,
  IslandFacilityHotspot,
  IslandMapHotspotId,
  LocationAnchor,
  PendingStoryTrigger,
  ProfileSave,
  RelationFactionId,
  RunState,
  StoryChain,
  StoryChainEnd,
  StoryChainNode,
  StoryChainNodeKind,
  StoryChainProgress,
  StoryChainStart,
  StoryChainTone,
  StoryChainTrigger,
  StoryChainTriggerKind,
  StoryTriggerEvent,
  TimeOfDay,
} from "../models/types";
import {
  createStoryChainNode,
  editorChildSlotsFor,
  hotspotLabel,
  migrateStoryChain,
} from "../data/islandMaps";
import { TIME_OF_DAY_ORDER } from "../game/constants";
import { createId } from "../utils/ids";
import { AffiliationService } from "./AffiliationService";
import { CharacterService } from "./CharacterService";
import { FactionService } from "./FactionService";
import { IslandService } from "./IslandService";
import { LegacyService } from "./LegacyService";

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
  talk: ["INN", "TALK", "HARBOR", "MARKET"],
  explore: ["EXPLORE", "SEARCH", "SCOUT"],
  investigate: ["INVESTIGATE", "LIBRARY", "SEARCH"],
  event: ["EVENT", "QUEST", "MARKET"],
  battle: ["TRAINING_GROUNDS", "CHALLENGE", "QUEST"],
  boss: ["CHALLENGE", "QUEST", "EVENT", "MARINE_BASE"],
  end: ["HARBOR", "INN", "EXPLORE"],
  beat: ["QUEST", "EVENT", "INN"],
};

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

export function storyChainStructureFingerprint(start: StoryChainStart): string {
  return [
    countOf(start.dialogueBeats),
    countOf(start.battlesCount),
    start.bossBattle ? 1 : 0,
    countOf(start.eventsCount),
    countOf(start.investigationsCount),
    (start.mustHappen ?? "").trim(),
  ].join("|");
}

function desiredSlots(start: StoryChainStart): Array<{ key: string; kind: StoryChainNodeKind; label: string }> {
  const slots: Array<{ key: string; kind: StoryChainNodeKind; label: string }> = [];
  const talks = countOf(start.dialogueBeats);
  const investigates = countOf(start.investigationsCount);
  const events = countOf(start.eventsCount);
  const battles = countOf(start.battlesCount);
  for (let i = 0; i < talks; i += 1) {
    slots.push({ key: `talk:${i}`, kind: "talk", label: talks === 1 ? "Dialogue beat" : `Dialogue beat ${i + 1}` });
  }
  for (let i = 0; i < investigates; i += 1) {
    slots.push({
      key: `investigate:${i}`,
      kind: "investigate",
      label: investigates === 1 ? "Investigation" : `Investigation ${i + 1}`,
    });
  }
  for (let i = 0; i < events; i += 1) {
    slots.push({ key: `event:${i}`, kind: "event", label: events === 1 ? "Event" : `Event ${i + 1}` });
  }
  for (let i = 0; i < battles; i += 1) {
    slots.push({ key: `battle:${i}`, kind: "battle", label: battles === 1 ? "Battle" : `Battle ${i + 1}` });
  }
  if (start.bossBattle) {
    slots.push({ key: "boss:0", kind: "boss", label: "Boss battle" });
  }
  const must = (start.mustHappen ?? "").trim();
  if (must) {
    slots.push({ key: "must:0", kind: "beat", label: must });
  }
  return slots;
}

export type LocationMatchContext = {
  hotspots: IslandFacilityHotspot[];
  anchors: LocationAnchor[];
  island?: Island | null;
};

export function matchLocationForKind(
  kind: StoryChainNodeKind,
  ctx: LocationMatchContext,
): { hotspotId?: string; locationAnchorId?: string } {
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

function buildGeneratedNode(
  slot: { key: string; kind: StoryChainNodeKind; label: string },
  order: number,
  start: StoryChainStart,
  end: StoryChainEnd,
  ctx: LocationMatchContext,
): StoryChainNode {
  const match = matchLocationForKind(slot.kind, ctx);
  const node = createStoryChainNode(order, slot.kind, applyToneLabel(slot.label, start));
  node.generationKey = slot.key;
  node.editState = slot.key === "must:0" ? "locked" : "generated";
  node.suggestedHotspotId = match.hotspotId;
  node.locationAnchorId = match.locationAnchorId;
  if (slot.kind === "start") {
    node.trigger = {
      kind: "enter_location",
      islandId: ctx.island?.id,
      mapAssetId: ctx.island?.mapAssetId ?? undefined,
    };
    node.notes = start.premise;
  } else if (slot.kind === "end") {
    node.notes = end.resolution;
    if (end.unlocks?.islandId) {
      node.toIslandId = end.unlocks.islandId;
    }
    if (end.unlocks?.hotspotId) {
      node.suggestedHotspotId = end.unlocks.hotspotId;
    }
  } else if (slot.kind === "battle" || slot.kind === "boss") {
    node.trigger = { kind: "battle_ended" };
    node.notes = start.twist && slot.kind === "boss" ? `Twist: ${start.twist}` : start.restrictions;
  } else {
    node.notes = start.twist && slot.kind === "event" ? `Twist: ${start.twist}` : start.restrictions;
  }
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
  generateStructure(chain: StoryChain, ctx: LocationMatchContext): StoryChain {
    const fingerprint = storyChainStructureFingerprint(chain.start);
    const existing = chain.nodes.map((n) => ({ ...n }));
    const startNode =
      existing.find((n) => n.kind === "start") ?? createStoryChainNode(1, "start", "Start");
    startNode.kind = "start";
    startNode.generationKey = "start";
    startNode.label = chain.start.premise?.trim() ? "Start" : startNode.label || "Start";
    startNode.notes = chain.start.premise || startNode.notes;
    if (!startNode.trigger) {
      startNode.trigger = {
        kind: "enter_location",
        islandId: ctx.island?.id ?? chain.islandId,
        mapAssetId: ctx.island?.mapAssetId ?? chain.mapAssetId,
      };
    }
    const startMatch = matchLocationForKind("start", ctx);
    if (!startNode.placedHotspotId && startMatch.hotspotId) {
      startNode.suggestedHotspotId = startMatch.hotspotId;
    }
    if (!startNode.locationAnchorId && startMatch.locationAnchorId) {
      startNode.locationAnchorId = startMatch.locationAnchorId;
    }

    const endNode = existing.find((n) => n.kind === "end") ?? createStoryChainNode(99, "end", "End");
    endNode.kind = "end";
    endNode.generationKey = "end";
    endNode.label = endNode.label || "End";
    endNode.notes = chain.end.resolution || endNode.notes;
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
    for (const slot of desiredSlots(chain.start)) {
      const kept = keptByKey.get(slot.key);
      if (kept) {
        middles.push(kept);
        keptByKey.delete(slot.key);
      } else {
        middles.push(buildGeneratedNode(slot, 0, chain.start, chain.end, ctx));
      }
    }
    for (const leftover of keptByKey.values()) {
      middles.push(leftover);
    }

    const nodes = [startNode, ...middles, endNode].map((n, i) => ({ ...n, order: i + 1 }));
    return {
      ...chain,
      nodes,
      generationFingerprint: fingerprint,
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
          const expected = event.hotspotId && event.childId ? `${event.hotspotId}:${event.childId}` : event.childId;
          const matches =
            (trigger.ref && expected && trigger.ref === expected) ||
            (trigger.childId && event.childId && trigger.childId === event.childId &&
              (!trigger.ref || !event.hotspotId || trigger.ref.startsWith(`${event.hotspotId}:`)));
          if (event.kind === "suboption" && !matches) {
            continue;
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
    this.markFired(run, next.chainId, next.nodeId);
    let line = this.renderTriggerLine(chain, node);
    if (node.kind === "end") {
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
    const chains = this.allChains(run);
    const incoming = events.flatMap((event) => this.collectTriggers(chains, event, run.storyChainProgress));
    this.enqueue(run, incoming);
    const fired = this.dequeueNext(run, profile);
    return fired?.line ?? null;
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
            chains.push(migrated);
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
