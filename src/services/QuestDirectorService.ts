import { DEFAULT_GENERATED_QUEST_CAPACITY, QUEST_ARCHETYPES } from "../data/questArchetypes";
import { outcomeRewardLabels, QUEST_EXPIRE_DAYS, QUEST_OUTCOMES } from "../data/questOutcomes";
import {
  createStoryChain,
  createStoryChainNode,
  getMapLayoutAnchors,
  getMapLayoutHotspots,
  getMapLayoutStoryChains,
  setMapLayoutHotspots,
} from "../data/islandMaps";
import type { GeneratedQuestResult, QuestArchetype, QuestArchetypeId, QuestRefreshState, RunState, StoryChain, StoryThread } from "../models/types";
import { createId } from "../utils/ids";
import { IslandService } from "./IslandService";
import { createRng } from "./RandomService";
import { LocationSemanticsService } from "./LocationSemanticsService";
import { QuestPlacementService, type QuestPlacement } from "./QuestPlacementService";
import { GeneratedLocationService } from "./GeneratedLocationService";
import { NpcResidencyService } from "./NpcResidencyService";
import { QuestOutcomeService } from "./QuestOutcomeService";
import { StoryChainService, nestChildForStoryNode } from "./StoryChainService";

function defaultState(): QuestRefreshState {
  return {
    capacity: DEFAULT_GENERATED_QUEST_CAPACITY,
    activeGeneratedQuestIds: [],
    lastGenerationDay: 0,
    recentArchetypes: [],
  };
}

/**
 * Generated quests compile into StoryThread + a StoryChain on the island map.
 * Each node is placed against the current layout before the next beat is written.
 */
export const QuestDirectorService = {
  ensure(run: RunState): QuestRefreshState {
    if (!run.world.generatedQuestState) {
      run.world.generatedQuestState = defaultState();
    }
    return run.world.generatedQuestState;
  },

  activeGenerated(run: RunState): StoryThread[] {
    const ids = new Set(this.ensure(run).activeGeneratedQuestIds);
    return (run.storyThreads ?? []).filter((thread) => ids.has(thread.id));
  },

  chooseArchetype(run: RunState): QuestArchetype | null {
    const state = this.ensure(run);
    const island = IslandService.getCurrentIsland(run);
    const tags = island ? LocationSemanticsService.allIslandTags(island) : ["public"];
    const recent = new Set(state.recentArchetypes.slice(-4));
    const scored = QUEST_ARCHETYPES.map((archetype) => {
      const overlap = archetype.tags.filter((tag) => tags.includes(tag)).length;
      const impossible = archetype.tags.includes("volcanic") && !tags.includes("volcanic");
      const penalty = recent.has(archetype.id) ? 3 : 0;
      return { archetype, score: impossible ? -99 : overlap - penalty };
    }).sort((a, b) => b.score - a.score);
    return scored[0] && scored[0].score >= 0 ? scored[0].archetype : QUEST_ARCHETYPES[0] ?? null;
  },

  maybeGenerate(run: RunState): StoryThread | null {
    const state = this.ensure(run);
    this.pruneResolved(run);
    if (state.activeGeneratedQuestIds.length >= state.capacity) {
      return null;
    }
    if (run.day - state.lastGenerationDay < 2 && state.activeGeneratedQuestIds.length > 0) {
      return null;
    }
    const archetype = this.chooseArchetype(run);
    if (!archetype) {
      return null;
    }
    return this.spawn(run, archetype);
  },

  spawn(run: RunState, archetype: QuestArchetype): StoryThread {
    const state = this.ensure(run);
    const island = IslandService.getCurrentIsland(run);
    if (island) {
      IslandService.ensureFacilities(island, createRng(`${run.seed}:quest-map`));
    }
    const npc = island ? NpcResidencyService.ensureForQuest(run, island, archetype.tags) : null;
    const threadId = createId("gq");
    const outcome = QUEST_OUTCOMES[archetype.id].success;
    const chain = island ? this.placeChain(run, island, archetype, threadId, npc?.id) : null;
    const thread: StoryThread = {
      id: threadId,
      type: archetype.size === "chain" ? "MAJOR" : "MINOR",
      templateId: `generated:${archetype.id}`,
      title: archetype.label,
      state: "ACTIVE",
      stage: 1,
      startedDay: run.day,
      lastUpdatedDay: run.day,
      involvedCharacterIds: npc ? [npc.id] : [],
      involvedFactionIds: outcome.factionId ? [outcome.factionId] : [],
      involvedIslandIds: island ? [island.id] : [],
      tags: [...archetype.tags, "generated"],
      history: [{ day: run.day, stage: 1, text: `A ${archetype.label.toLowerCase()} situation takes shape.` }],
      metadata: {
        source: "GENERATED",
        archetypeId: archetype.id,
        chainId: chain?.id,
        rewards: outcomeRewardLabels(outcome),
        outcome,
      },
    };
    run.storyThreads = [...(run.storyThreads ?? []), thread];
    state.activeGeneratedQuestIds.push(thread.id);
    state.lastGenerationDay = run.day;
    state.recentArchetypes = [...state.recentArchetypes, archetype.id].slice(-12);
    return thread;
  },

  placeChain(run: RunState, island: ReturnType<typeof IslandService.getCurrentIsland>, archetype: QuestArchetype, questId: string, npcId?: string): StoryChain | null {
    if (!island?.mapAssetId) {
      return null;
    }
    LocationSemanticsService.refreshIsland(island);
    const chain = createStoryChain(archetype.label, island.id, island.mapAssetId);
    chain.start = {
      startHub: archetype.tags.includes("coastal") ? "HARBOR" : "MARKET",
      premise: `A ${archetype.label.toLowerCase()} unfolds on ${island.name}.`,
    };
    const startPlace = QuestPlacementService.resolveStart(island, archetype.id, archetype.tags);
    const startNode = chain.nodes.find((node) => node.kind === "start") ?? createStoryChainNode(1, "start", "Start");
    this.applyPlacement(island, chain, startNode.id, startPlace, `${archetype.label} start`, questId);

    const midCount = archetype.size === "small" ? 1 : 2;
    for (let index = 0; index < midCount; index += 1) {
      const beat = createStoryChainNode(2 + index, index === 0 ? "investigate" : "event", index === 0 ? "Investigate" : "Confrontation");
      chain.nodes.splice(chain.nodes.length - 1, 0, beat);
      const place = QuestPlacementService.resolveBeat(island, archetype.tags);
      if (place.kind === "adapt") {
        continue;
      }
      this.applyPlacement(island, chain, beat.id, place, `${archetype.label} beat`, questId);
    }

    const endNode = chain.nodes.find((node) => node.kind === "end");
    if (endNode) {
      const endPlace = QuestPlacementService.resolveBeat(island, archetype.tags);
      this.applyPlacement(island, chain, endNode.id, endPlace, `${archetype.label} end`, questId);
    }
    const success = QUEST_OUTCOMES[archetype.id].success;
    chain.end = {
      resolution: success.news ?? `The ${archetype.label.toLowerCase()} is settled.`,
      effects: {
        worldNews: success.news,
        faction:
          success.factionId && success.factionDelta
            ? `${success.factionId} ${success.factionDelta >= 0 ? "+" : ""}${success.factionDelta}`
            : undefined,
        relationship:
          npcId && success.relationship
            ? `${npcId} ${success.relationship >= 0 ? "+" : ""}${success.relationship}`
            : undefined,
      },
      unlocks: npcId ? { npcId } : undefined,
    };

    const chains = [...getMapLayoutStoryChains(island, island.mapAssetId).filter((row) => row.id !== chain.id), chain];
    setMapLayoutHotspots(island, island.mapAssetId, getMapLayoutHotspots(island, island.mapAssetId), undefined, {
      storyChains: chains,
      locationAnchors: getMapLayoutAnchors(island, island.mapAssetId),
    });
    return chain;
  },

  applyPlacement(
    island: NonNullable<ReturnType<typeof IslandService.getCurrentIsland>>,
    chain: StoryChain,
    nodeId: string,
    place: QuestPlacement,
    label: string,
    questId: string,
  ): void {
    if (place.kind === "adapt") {
      return;
    }
    if (place.kind === "anchor") {
      const bound = place.hotspot;
      const location = GeneratedLocationService.placeTemporary(island, {
        name: label,
        xPct: bound ? Math.min(92, bound.xPct + 4) : 52,
        yPct: bound ? Math.min(92, bound.yPct + 4) : 58,
        anchorId: place.anchor.id,
        questId,
        chainId: chain.id,
      });
      const next = StoryChainService.nestNode(chain, nodeId, {
        hotspotId: location.hotspotId,
        islandId: island.id,
        mapAssetId: island.mapAssetId ?? undefined,
      });
      chain.nodes = next.nodes;
      return;
    }
    const hotspot = place.hotspot;
    const childId = nestChildForStoryNode(hotspot.facilityId, chain.nodes.find((node) => node.id === nodeId)!);
    const next = StoryChainService.nestNode(chain, nodeId, {
      hotspotId: hotspot.hotspotId,
      childId,
      islandId: island.id,
      mapAssetId: island.mapAssetId ?? undefined,
    });
    chain.nodes = next.nodes;
  },

  onWorldEvent(run: RunState, hint?: QuestArchetypeId): StoryThread | null {
    const state = this.ensure(run);
    this.pruneResolved(run);
    if (state.activeGeneratedQuestIds.length >= state.capacity) {
      return null;
    }
    state.lastGenerationDay = Math.max(0, run.day - 2);
    if (hint) {
      const forced = QUEST_ARCHETYPES.find((row) => row.id === hint);
      if (forced) {
        return this.spawn(run, forced);
      }
    }
    return this.maybeGenerate(run);
  },

  resolve(run: RunState, generatedId: string, result: GeneratedQuestResult = "success"): void {
    const thread = run.storyThreads?.find((entry) => entry.id === generatedId);
    if (!thread) {
      return;
    }
    QuestOutcomeService.apply(run, thread, result);
    this.pruneResolved(run);
    const followUp = thread.metadata?.followUp;
    if (result === "success" && typeof followUp === "string") {
      this.onWorldEvent(run, followUp as QuestArchetypeId);
    }
  },

  tickExpiry(run: RunState): void {
    const state = this.ensure(run);
    for (const id of [...state.activeGeneratedQuestIds]) {
      const thread = run.storyThreads?.find((entry) => entry.id === id);
      if (!thread || thread.metadata?.source !== "GENERATED") {
        continue;
      }
      if (run.day - thread.startedDay < QUEST_EXPIRE_DAYS) {
        continue;
      }
      QuestOutcomeService.apply(run, thread, "expire");
    }
    this.pruneResolved(run);
  },

  pruneResolved(run: RunState): void {
    const state = this.ensure(run);
    const living = new Set(
      (run.storyThreads ?? [])
        .filter((thread) => thread.state === "ACTIVE" || thread.state === "ESCALATING" || thread.state === "CLIMAX_READY" || thread.state === "DISCOVERED")
        .map((thread) => thread.id),
    );
    state.activeGeneratedQuestIds = state.activeGeneratedQuestIds.filter((id) => living.has(id));
  },

  promoteToThread(run: RunState, generatedId: string): StoryThread | null {
    const thread = run.storyThreads?.find((entry) => entry.id === generatedId);
    if (!thread || thread.metadata?.source !== "GENERATED") {
      return null;
    }
    thread.metadata = { ...thread.metadata, source: "THREAD", promotedFromGenerated: true };
    const state = this.ensure(run);
    state.activeGeneratedQuestIds = state.activeGeneratedQuestIds.filter((id) => id !== generatedId);
    return thread;
  },
};
