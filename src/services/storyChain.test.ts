import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { SAVE_VERSION } from "../game/constants";
import { IslandService } from "./IslandService";
import { FactionService } from "./FactionService";
import { CharacterService } from "./CharacterService";
import {
  StoryChainService,
  matchLocationForKind,
  storyChainStructureFingerprint,
} from "./StoryChainService";
import {
  createLocationAnchor,
  createStoryChain,
  migrateStoryChain,
  unplacedStoryChainNodes,
} from "../data/islandMaps";
import type { IslandFacilityHotspot, RunState, StoryChain } from "../models/types";

function freshRun(seed = "story-chain-p2"): RunState {
  const profile = createEmptyProfile("story_chain_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  return run;
}

function innHotspot(): IslandFacilityHotspot {
  return { hotspotId: "hs_inn", facilityId: "INN", xPct: 40, yPct: 40 };
}

describe("Story chain Phase 2", () => {
  it("uses SAVE_VERSION 33", () => {
    expect(SAVE_VERSION).toBe(33);
  });

  it("generates numbered talk/battle/event/investigate/boss nodes between Start and End", () => {
    const chain = createStoryChain("Relic hunt");
    chain.start = {
      premise: "A relic went missing from the inn.",
      dialogueBeats: 2,
      battlesCount: 1,
      eventsCount: 1,
      investigationsCount: 1,
      bossBattle: true,
      mustHappen: "The cook admits the theft",
    };
    chain.end = { resolution: "The relic is returned or sold." };
    const next = StoryChainService.generateStructure(chain, { hotspots: [innHotspot()], anchors: [] });
    expect(next.id).toBe(chain.id);
    expect(next.nodes[0]?.kind).toBe("start");
    expect(next.nodes[next.nodes.length - 1]?.kind).toBe("end");
    expect(next.nodes.filter((n) => n.kind === "talk")).toHaveLength(2);
    expect(next.nodes.filter((n) => n.kind === "battle")).toHaveLength(1);
    expect(next.nodes.filter((n) => n.kind === "event")).toHaveLength(1);
    expect(next.nodes.filter((n) => n.kind === "investigate")).toHaveLength(1);
    expect(next.nodes.filter((n) => n.kind === "boss")).toHaveLength(1);
    expect(next.nodes.find((n) => n.kind === "battle")?.trigger?.kind).toBe("battle_ended");
    expect(next.nodes.some((n) => n.label === "The cook admits the theft" && n.editState === "locked")).toBe(
      true,
    );
    expect(unplacedStoryChainNodes(next).length).toBe(next.nodes.length);
    expect(next.generationFingerprint).toBe(storyChainStructureFingerprint(chain.start));
  });

  it("keeps locked and edited nodes when regenerating a section", () => {
    const chain = createStoryChain("Keep edited");
    chain.start = { dialogueBeats: 2, battlesCount: 0 };
    let next = StoryChainService.generateStructure(chain, { hotspots: [], anchors: [] });
    const firstTalk = next.nodes.find((n) => n.generationKey === "talk:0")!;
    firstTalk.editState = "edited";
    firstTalk.label = "Custom dock rumor";
    next.start = { ...next.start, dialogueBeats: 3 };
    const regenerated = StoryChainService.generateStructure(next, { hotspots: [], anchors: [] });
    expect(regenerated.nodes.filter((n) => n.kind === "talk")).toHaveLength(3);
    const kept = regenerated.nodes.find((n) => n.generationKey === "talk:0");
    expect(kept?.label).toBe("Custom dock rumor");
    expect(kept?.editState).toBe("edited");
  });

  it("matches facilities first, then auto anchors, and skips never", () => {
    const facility = matchLocationForKind("talk", {
      hotspots: [innHotspot()],
      anchors: [createLocationAnchor("Secret well", ["well"], "auto")],
    });
    expect(facility.hotspotId).toBe("hs_inn");

    const auto = matchLocationForKind("explore", {
      hotspots: [innHotspot()],
      anchors: [
        createLocationAnchor("Sealed well", ["well"], "never"),
        createLocationAnchor("Tide caves", ["caves", "explore"], "auto"),
      ],
    });
    expect(auto.locationAnchorId).toBeTruthy();
    const neverOnly = matchLocationForKind("explore", {
      hotspots: [],
      anchors: [createLocationAnchor("Sealed well", ["well"], "never")],
    });
    expect(neverOnly.locationAnchorId).toBeUndefined();
  });

  it("nests a node onto a hotspot and suboption trigger", () => {
    const chain = createStoryChain("Nest me");
    chain.start = { dialogueBeats: 1 };
    const generated = StoryChainService.generateStructure(chain, { hotspots: [innHotspot()], anchors: [] });
    const talk = generated.nodes.find((n) => n.kind === "talk")!;
    const nested = StoryChainService.nestNode(generated, talk.id, {
      hotspotId: "hs_inn",
      childId: "TALK_NPCS",
      islandId: "isle_a",
    });
    const node = nested.nodes.find((n) => n.id === talk.id)!;
    expect(node.placedHotspotId).toBe("hs_inn");
    expect(node.trigger?.kind).toBe("suboption");
    expect(node.trigger?.ref).toBe("hs_inn:TALK_NPCS");
    expect(unplacedStoryChainNodes(nested).some((n) => n.id === talk.id)).toBe(false);
    expect(StoryChainService.nodesOnHotspot([nested], "hs_inn").map((n) => n.id)).toContain(talk.id);
  });

  it("supports cross-island fields on nodes and persist through migrate", () => {
    const chain = createStoryChain("Cross", "isle_a", "Island_Begin");
    chain.end = { unlocks: { islandId: "isle_b" }, possibleConclusions: ["Peace", "War"] };
    chain.start = { dialogueBeats: 0, battlesCount: 0 };
    const generated = StoryChainService.generateStructure(chain, { hotspots: [], anchors: [] });
    const end = generated.nodes.find((n) => n.kind === "end")!;
    expect(end.toIslandId).toBe("isle_b");
    const migrated = migrateStoryChain({
      ...generated,
      nodes: generated.nodes.map((n) =>
        n.kind === "talk" || n.id === end.id ? { ...n, toIslandId: "isle_b", toMapAssetId: "Island_Desert" } : n,
      ),
    }) as StoryChain;
    expect(migrated.end.possibleConclusions).toEqual(["Peace", "War"]);
    expect(migrated.nodes.find((n) => n.kind === "end")?.toIslandId).toBe("isle_b");
  });

  it("queues triggers and fires one at a time by priority", () => {
    const run = freshRun();
    const island = IslandService.getCurrentIsland(run)!;
    const chain = createStoryChain("Queued", island.id, island.mapAssetId ?? undefined);
    chain.start = { dialogueBeats: 1, premise: "Meet at the inn" };
    const generated = StoryChainService.generateStructure(chain, {
      hotspots: island.facilityHotspots ?? [],
      anchors: [],
      island,
    });
    const talk = generated.nodes.find((n) => n.kind === "talk")!;
    const nested = StoryChainService.nestNode(generated, talk.id, { hotspotId: "hs_inn" });
    IslandService.setFacilityHotspots(island, island.facilityHotspots ?? [], [], {
      storyChains: [nested],
      locationAnchors: [],
    });

    const first = StoryChainService.fireEvent(run, {
      kind: "enter_location",
      islandId: island.id,
    });
    expect(first).toMatch(/Start|Meet at the inn|Queued/);
    expect(run.pendingStoryTriggers?.length ?? 0).toBe(0);

    const second = StoryChainService.fireEvent(run, { kind: "map_icon", hotspotId: "hs_inn" });
    expect(second).toMatch(/Dialogue beat|Queued/);
    const third = StoryChainService.fireEvent(run, { kind: "map_icon", hotspotId: "hs_inn" });
    expect(third).toBeNull();
  });

  it("applies End effects to news, faction, title, and unlocks", () => {
    const profile = createEmptyProfile("story_chain_effects", "NORMAL");
    const run = createRunState(profile, {
      name: "Test Sailor",
      raceId: "HUMAN",
      originId: "SAILOR",
      locationId: "east_blue_port",
    });
    profile.activeRun = run;
    FactionService.ensureFactionWorld(run);
    const island = IslandService.getCurrentIsland(run)!;
    const npc = run.world.characters[0] ?? {
      id: "npc_story",
      name: "Dock Clerk",
      faction: "CIVILIAN" as const,
      strength: 3,
      bounty: 0,
      devilFruitId: null,
      alive: true,
      relationshipWithPlayer: 0,
      tags: [],
    };
    if (!run.world.characters.some((c) => c.id === npc.id)) {
      run.world.characters.push(npc);
    }
    const chain = createStoryChain("Relic return", island.id, island.mapAssetId ?? undefined);
    chain.end = {
      resolution: "The relic is home.",
      effects: {
        worldNews: "A relic walked back into the inn.",
        faction: "PIRATES:+6",
        title: "Relic Thief",
        relationship: `${npc.id}:+2`,
        legacy: "The relic night is still told.",
      },
      unlocks: { questId: "relic_home", npcId: npc.id, islandId: island.id },
    };
    chain.start = { dialogueBeats: 0, battlesCount: 0 };
    const generated = StoryChainService.generateStructure(chain, {
      hotspots: island.facilityHotspots ?? [],
      anchors: [],
      island,
    });
    const end = generated.nodes.find((n) => n.kind === "end")!;
    end.trigger = { kind: "enter_location", islandId: island.id };
    IslandService.setFacilityHotspots(island, island.facilityHotspots ?? [], [], {
      storyChains: [generated],
      locationAnchors: [],
    });
    const start = generated.nodes.find((n) => n.kind === "start");
    if (start) {
      StoryChainService.markFired(run, generated.id, start.id);
    }
    const piratesBefore = FactionService.getRelationship(run, "PIRATES").value;
    const line = StoryChainService.fireEvent(run, { kind: "enter_location", islandId: island.id }, profile);
    expect(line).toMatch(/Relic return|relic is home|News spreads/i);
    expect(run.world.history.some((h) => h.text.includes("relic walked back"))).toBe(true);
    expect(run.player.flags.some((f) => f.startsWith("story_title:Relic Thief"))).toBe(true);
    expect(run.player.title).toContain("Relic Thief");
    expect(run.runFlags).toContain("relic_home");
    expect(FactionService.getRelationship(run, "PIRATES").value - piratesBefore).toBe(6);
    expect(CharacterService.getCharacter(run, npc.id)?.relationshipWithPlayer).toBeGreaterThanOrEqual(2);
    expect(profile.legacy?.events.some((e) => e.summary.includes("relic night"))).toBe(true);
  });

  it("fires time, rest, battle, and sailing triggers without stacking two lines", () => {
    const run = freshRun();
    const island = IslandService.getCurrentIsland(run)!;
    const chain = createStoryChain("Hooks", island.id, island.mapAssetId ?? undefined);
    chain.start = { dialogueBeats: 0, battlesCount: 1 };
    const generated = StoryChainService.generateStructure(chain, {
      hotspots: island.facilityHotspots ?? [],
      anchors: [],
      island,
    });
    const battle = generated.nodes.find((n) => n.kind === "battle")!;
    const start = generated.nodes.find((n) => n.kind === "start")!;
    start.trigger = { kind: "time", ref: "1" };
    const restNode = generated.nodes.find((n) => n.kind === "end")!;
    restNode.trigger = { kind: "rest" };
    restNode.kind = "custom";
    IslandService.setFacilityHotspots(island, island.facilityHotspots ?? [], [], {
      storyChains: [generated],
      locationAnchors: [],
    });
    run.day = 1;
    const timeLine = StoryChainService.notifyTimeAndActivities(run, []);
    expect(timeLine).toMatch(/Hooks/);
    const timeAgain = StoryChainService.notifyTimeAndActivities(run, []);
    expect(timeAgain).toBeNull();
    const battleLine = StoryChainService.fireEvent(run, { kind: "battle_ended", won: true });
    expect(battleLine).toMatch(/Battle|Hooks/);
    expect(battle.id).toBeTruthy();
    const restLine = StoryChainService.fireEvent(run, { kind: "rest", childId: "INN_REST" });
    expect(restLine).toMatch(/Hooks/);
  });

  it("continues a cross-island node after landfall", () => {
    const run = freshRun();
    const island = IslandService.getCurrentIsland(run)!;
    const other = run.islands.find((i) => i.id !== island.id);
    expect(other).toBeTruthy();
    const chain = createStoryChain("Across the sea", island.id, island.mapAssetId ?? undefined);
    chain.start = { dialogueBeats: 1, battlesCount: 0, premise: "Leave a clue at the inn." };
    const generated = StoryChainService.generateStructure(chain, {
      hotspots: [innHotspot()],
      anchors: [],
      island,
    });
    const talk = generated.nodes.find((n) => n.kind === "talk")!;
    const nested = StoryChainService.nestNode(generated, talk.id, { hotspotId: "hs_inn", islandId: island.id });
    const withDest = {
      ...nested,
      nodes: nested.nodes.map((n) =>
        n.id === talk.id ? { ...n, toIslandId: other!.id, toMapAssetId: other!.mapAssetId ?? undefined } : n,
      ),
    };
    IslandService.setFacilityHotspots(island, island.facilityHotspots ?? [], [], {
      storyChains: [withDest],
      locationAnchors: [],
    });
    const clue = StoryChainService.fireEvent(run, { kind: "map_icon", hotspotId: "hs_inn", islandId: island.id });
    expect(clue).toMatch(/Sail there|continues at/i);
    expect(run.pendingStoryTravel?.toIslandId).toBe(other!.id);
    run.currentIslandId = other!.id;
    StoryChainService.enqueueCrossMapArrival(run);
    expect(run.pendingStoryTravel).toBeNull();
    expect(run.pendingStoryTriggers?.length).toBeGreaterThan(0);
    const continued = StoryChainService.fireEvent(run, {
      kind: "enter_location",
      islandId: other!.id,
      mapAssetId: other!.mapAssetId ?? undefined,
    });
    expect(continued).toMatch(/Across the sea/);
  });
});
