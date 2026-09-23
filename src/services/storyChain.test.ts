import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { SAVE_VERSION } from "../game/constants";
import { IslandService } from "./IslandService";
import { ItemService } from "./ItemService";
import { FactionService } from "./FactionService";
import { CharacterService } from "./CharacterService";
import {
  StoryChainService,
  matchLocationForKind,
  nestChildForStoryNode,
  storyChainStructureFingerprint,
} from "./StoryChainService";
import {
  createLocationAnchor,
  createStoryChain,
  facilityIdForStoryChainNode,
  migrateStoryChain,
  unplacedStoryChainNodes,
  unplacedStoryChainQueue,
} from "../data/islandMaps";
import { SEA_KING_MEAT_ITEM_ID } from "../data/items";
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
  it("uses SAVE_VERSION 36", () => {
    expect(SAVE_VERSION).toBe(36);
  });

  function generateAfterEndPlaced(
    chain: StoryChain,
    ctx: { hotspots: IslandFacilityHotspot[]; anchors: ReturnType<typeof createLocationAnchor>[]; island?: RunState["islands"][number] },
  ): StoryChain {
    const first = StoryChainService.generateStructure(chain, ctx);
    const end = first.nodes.find((n) => n.kind === "end");
    if (!end) {
      return first;
    }
    const nested = StoryChainService.nestNode(first, end.id, { hotspotId: end.placedHotspotId ?? "hs_end" });
    return StoryChainService.generateStructure(nested, ctx);
  }

  it("generates unplaced beats into the queue without scattering map icons", () => {
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
    expect(StoryChainService.validateForGenerate(chain)).toBeNull();
    expect(StoryChainService.validateForGenerate(createStoryChain("Empty"))).toMatch(/Premise/);

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
    expect(unplacedStoryChainQueue(next).some((n) => n.kind === "end")).toBe(true);
    expect(facilityIdForStoryChainNode(next, next.nodes.find((n) => n.kind === "boss")!)).toBe(
      "CHALLENGE",
    );
    expect(next.generationFingerprint).toBe(storyChainStructureFingerprint(chain.start));
    const middles = next.nodes.filter((n) => n.kind !== "start" && n.kind !== "end");
    expect(middles.filter((n) => n.kind === "talk" || n.kind === "event").every((n) => n.placedHotspotId === "hs_inn")).toBe(
      true,
    );
    expect(
      middles
        .filter((n) => n.kind === "battle" || n.kind === "boss" || n.kind === "investigate")
        .every((n) => !n.placedHotspotId && (n.editState === "generated" || n.editState === "locked")),
    ).toBe(true);
  });

  it("does not auto-place generated beats onto existing map icons", () => {
    const chain = createStoryChain("No scatter");
    chain.start = { premise: "A lead", dialogueBeats: 1, eventsCount: 1, battlesCount: 1 };
    const existing: IslandFacilityHotspot[] = [
      { hotspotId: "hs_quest", facilityId: "QUEST", xPct: 20, yPct: 20 },
      { hotspotId: "hs_event", facilityId: "EVENT", xPct: 40, yPct: 40 },
      { hotspotId: "hs_talk", facilityId: "TALK", xPct: 60, yPct: 60 },
    ];
    const next = generateAfterEndPlaced(chain, { hotspots: existing, anchors: [] });
    const generated = next.nodes.filter((n) => n.kind !== "start" && n.kind !== "end");
    expect(generated.length).toBeGreaterThan(0);
    expect(generated.every((n) => !n.placedHotspotId)).toBe(true);
    expect(generated.some((n) => n.editState === "generated")).toBe(true);
  });

  it("keeps locked and edited nodes when regenerating a section", () => {
    const chain = createStoryChain("Keep edited");
    chain.start = { dialogueBeats: 2, battlesCount: 0 };
    let next = generateAfterEndPlaced(chain, { hotspots: [], anchors: [] });
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

    const region = matchLocationForKind("explore", {
      hotspots: [],
      anchors: [],
      regions: [
        {
          id: "reg_caves",
          name: "East caves",
          points: [
            { xPct: 60, yPct: 40 },
            { xPct: 80, yPct: 40 },
            { xPct: 70, yPct: 60 },
          ],
          aiPermission: "auto",
        },
      ],
    });
    expect(region.locationRegionId).toBe("reg_caves");
  });

  it("nests a node onto a hotspot and suboption trigger", () => {
    const chain = createStoryChain("Nest me");
    chain.start = { dialogueBeats: 1 };
    const generated = generateAfterEndPlaced(chain, { hotspots: [innHotspot()], anchors: [] });
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
    const generated = generateAfterEndPlaced(chain, {
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
    const generated = generateAfterEndPlaced(chain, {
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
    const generated = generateAfterEndPlaced(chain, {
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

  it("nests market / training beats under the hub icon and offers three options", () => {
    const chain = createStoryChain("Market brawl");
    chain.start = {
      premise: "A crate of smuggled fruit vanished from the stalls.",
      eventsCount: 1,
      battlesCount: 1,
      tone: "mystery",
    };
    chain.end = { resolution: "The crate is found or the fence is named." };
    const market: IslandFacilityHotspot = { hotspotId: "hs_market", facilityId: "MARKET", xPct: 50, yPct: 50 };
    const training: IslandFacilityHotspot = {
      hotspotId: "hs_train",
      facilityId: "TRAINING_GROUNDS",
      xPct: 70,
      yPct: 40,
    };
    const next = StoryChainService.generateStructure(chain, {
      hotspots: [market, training],
      anchors: [],
    });
    const event = next.nodes.find((n) => n.kind === "event")!;
    const battle = next.nodes.find((n) => n.kind === "battle")!;
    expect(event.placedHotspotId).toBe("hs_market");
    expect(event.trigger?.kind).toBe("suboption");
    expect(event.trigger?.childId).toMatch(/^STORY:/);
    expect(event.questDraft?.options).toHaveLength(3);
    expect(battle.placedHotspotId).toBe("hs_train");
    expect(battle.trigger?.childId).toBe("TRAIN_SPAR");
    expect(battle.questDraft?.enemyCount).toBe(3);
    const picked = StoryChainService.applyBeatChoice(next, event.id, { index: 1 }, "Market");
    expect(picked.nodes.find((n) => n.id === event.id)?.questDraft?.chosenIndex).toBe(1);
    expect(picked.nodes.find((n) => n.id === event.id)?.notes).toBeTruthy();
    const custom = StoryChainService.applyBeatChoice(
      picked,
      event.id,
      { customPrompt: "A monkey steals the ledger" },
      "Market",
    );
    expect(custom.nodes.find((n) => n.id === event.id)?.notes).toMatch(/monkey steals the ledger/i);
    const tuned = StoryChainService.applyBattleDraft(custom, battle.id, {
      enemyCount: 5,
      enemyStrength: "strong",
      enemyRole: "boss",
    });
    expect(tuned.nodes.find((n) => n.id === battle.id)?.questDraft?.enemyCount).toBe(5);
    expect(tuned.nodes.find((n) => n.id === battle.id)?.kind).toBe("boss");
  });

  it("nests weapon-shop beats as their own story children, not under Buy / Sell", () => {
    const childId = nestChildForStoryNode("WEAPON_SHOP", { id: "n_blade", kind: "event" });
    expect(childId).toBe("STORY:n_blade");
    expect(childId).not.toBe("WEAPON_BUY_SELL");
    const remapped = migrateStoryChain({
      id: "schain_legacy_weapon",
      name: "Old smithy thread",
      start: {},
      end: {},
      nodes: [
        {
          id: "n_old",
          order: 1,
          kind: "talk",
          trigger: { kind: "suboption", childId: "WEAPON_BUY", ref: "hs_weapons:WEAPON_BUY" },
        },
      ],
    });
    const oldBeat = remapped?.nodes.find((node) => node.id === "n_old");
    expect(oldBeat?.trigger?.childId).toBe("WEAPON_BUY_SELL");
    expect(oldBeat?.trigger?.ref).toBe("hs_weapons:WEAPON_BUY_SELL");
  });

  it("generates beats in authored plan order and nests the start under Market", () => {
    const chain = createStoryChain("Fishing quest");
    chain.start = {
      premise: "The merchant at the market is out of fish.",
      startHub: "MARKET",
      beatPlan: [
        { id: "p-talk", kind: "talk", note: "He says the fish is not enough and needs more." },
        { id: "p-event", kind: "event", note: "Fishing choices; one path finds a sea king." },
        { id: "p-battle", kind: "battle", note: "Battle the sea king." },
      ],
      tone: "adventure",
    };
    chain.end = { resolution: "Bring the sea king back to the merchant to finish the quest." };
    const market: IslandFacilityHotspot = { hotspotId: "hs_market", facilityId: "MARKET", xPct: 50, yPct: 50 };
    const next = StoryChainService.generateStructure(chain, { hotspots: [market], anchors: [] });
    const start = next.nodes.find((n) => n.kind === "start")!;
    const middles = next.nodes.filter((n) => n.kind !== "start" && n.kind !== "end");
    expect(start.placedHotspotId).toBe("hs_market");
    expect(start.trigger?.kind).toBe("suboption");
    expect(start.trigger?.childId).toMatch(/^STORY:/);
    expect(start.questDraft?.npcName).toBeTruthy();
    expect(start.questDraft?.dialogueLines?.length).toBeGreaterThan(0);
    expect(middles.map((n) => n.kind)).toEqual(["talk", "event", "battle"]);
    expect(middles[1]?.questDraft?.objective).toEqual({
      type: "collect_item",
      itemId: "fish",
      count: 5,
      label: "Catch 5 fish",
    });
    expect(middles[0]?.notes).toMatch(/not enough/i);
    expect(middles[1]?.notes).toMatch(/sea king/i);
    expect(middles[2]?.notes).toMatch(/sea king/i);
    expect(middles[0]?.questDraft?.options?.[0]).toMatch(/not enough/i);
    const end = next.nodes.find((n) => n.kind === "end")!;
    expect(end.placedHotspotId).toBe("hs_market");
    expect(end.questDraft?.objective).toEqual({
      type: "collect_item",
      itemId: SEA_KING_MEAT_ITEM_ID,
      count: 1,
      label: "Bring Sea King meat to the merchant",
    });
  });

  it("fires a market quest child without opening the shop action", () => {
    const run = freshRun("market-quest-child");
    const island = IslandService.getCurrentIsland(run)!;
    const chain = createStoryChain("Fishing Quest", island.id);
    chain.start = { premise: "The merchant is out of fish.", startHub: "MARKET" };
    chain.end = { resolution: "Return the sea king." };
    const market: IslandFacilityHotspot = { hotspotId: "hs_market", facilityId: "MARKET", xPct: 50, yPct: 50 };
    const generated = StoryChainService.generateStructure(chain, { hotspots: [market], anchors: [], island });
    IslandService.setFacilityHotspots(island, [market], [], { storyChains: [generated] });
    const start = generated.nodes.find((n) => n.kind === "start")!;
    const shopLine = StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: "HUB_VISIT",
      islandId: island.id,
    });
    expect(shopLine).toBeNull();
    const questLine = StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: `STORY:${start.id}`,
      islandId: island.id,
    });
    expect(questLine).toMatch(/Fishing Quest|out of fish/i);
    expect(run.dynamicEncounter?.id).toMatch(/^story:/);
    expect(run.dynamicEncounter?.dialogueBeats?.[0]?.speakerName).toBeTruthy();
    expect(run.currentEncounterId).toBe(run.dynamicEncounter?.id);
  });

  it("keeps later beats locked until the previous action is done, and skips fishing if the crate is full", () => {
    const run = freshRun("story-sequence");
    const island = IslandService.getCurrentIsland(run)!;
    const chain = createStoryChain("Fishing Quest", island.id);
    chain.start = {
      premise: "The merchant at the market is out of fish.",
      startHub: "MARKET",
      beatPlan: [
        { id: "p-event", kind: "event", note: "Catch five fish at the shallows." },
        { id: "p-talk", kind: "talk", note: "He says it is still not enough." },
      ],
    };
    chain.end = { resolution: "Bring the sea king back." };
    const market: IslandFacilityHotspot = { hotspotId: "hs_market", facilityId: "MARKET", xPct: 50, yPct: 50 };
    const fishing: IslandFacilityHotspot = { hotspotId: "hs_fish", facilityId: "FISHING", xPct: 20, yPct: 80 };
    const generated = StoryChainService.generateStructure(chain, {
      hotspots: [market, fishing],
      anchors: [],
      island,
    });
    IslandService.setFacilityHotspots(island, [market, fishing], [], { storyChains: [generated] });
    const start = generated.nodes.find((n) => n.kind === "start")!;
    const event = generated.nodes.find((n) => n.kind === "event")!;
    const talk = generated.nodes.find((n) => n.kind === "talk")!;
    expect(event.placedHotspotId).toBe("hs_fish");
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${start.id}`)).toBe(true);
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${event.id}`)).toBe(false);
    StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: `STORY:${start.id}`,
      islandId: island.id,
    });
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${event.id}`)).toBe(true);
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${talk.id}`)).toBe(false);
    ItemService.grant(run, "fish", 5);
    StoryChainService.syncObjectives(run);
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${event.id}`)).toBe(false);
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${talk.id}`)).toBe(true);
  });

  it("resets a thread so the opening quest can fire again", () => {
    const run = freshRun("story-reset");
    const island = IslandService.getCurrentIsland(run)!;
    const chain = createStoryChain("Fish Shortage", island.id);
    chain.start = { premise: "The merchant is out of fish.", startHub: "MARKET" };
    chain.end = { resolution: "Done." };
    const market: IslandFacilityHotspot = { hotspotId: "hs_market", facilityId: "MARKET", xPct: 50, yPct: 50 };
    const generated = StoryChainService.generateStructure(chain, { hotspots: [market], anchors: [], island });
    IslandService.setFacilityHotspots(island, [market], [], { storyChains: [generated] });
    const start = generated.nodes.find((n) => n.kind === "start")!;
    StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: `STORY:${start.id}`,
      islandId: island.id,
    });
    expect(run.storyChainProgress?.some((p) => p.firedNodeIds.includes(start.id))).toBe(true);
    StoryChainService.resetChain(run, generated.id);
    expect(run.storyChainProgress?.some((p) => p.chainId === generated.id)).toBe(false);
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${start.id}`)).toBe(true);
    const again = StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: `STORY:${start.id}`,
      islandId: island.id,
    });
    expect(again).toBeTruthy();
  });

  it("arms the Sea King fishing hook only after the merchant says five fish is not enough", () => {
    const run = freshRun("sea-king-hook-gate");
    const island = IslandService.getCurrentIsland(run)!;
    const chain = createStoryChain("Fishing Quest", island.id);
    chain.start = {
      premise: "The merchant at the market is out of fish.",
      startHub: "MARKET",
      beatPlan: [
        { id: "p-event", kind: "event", note: "Catch five fish at the shallows." },
        { id: "p-talk", kind: "talk", note: "He says it is still not enough." },
        { id: "p-battle", kind: "battle", note: "Battle the sea king." },
      ],
    };
    chain.end = { resolution: "Bring the sea king back." };
    const market: IslandFacilityHotspot = { hotspotId: "hs_market", facilityId: "MARKET", xPct: 50, yPct: 50 };
    const fishing: IslandFacilityHotspot = { hotspotId: "hs_fish", facilityId: "FISHING", xPct: 20, yPct: 80 };
    const generated = StoryChainService.generateStructure(chain, {
      hotspots: [market, fishing],
      anchors: [],
      island,
    });
    IslandService.setFacilityHotspots(island, [market, fishing], [], { storyChains: [generated] });
    const start = generated.nodes.find((n) => n.kind === "start")!;
    const talk = generated.nodes.find((n) => n.kind === "talk")!;
    const battle = generated.nodes.find((n) => n.kind === "battle")!;

    expect(StoryChainService.seaKingHookAvailable(run)).toBeNull();

    StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: `STORY:${start.id}`,
      islandId: island.id,
    });
    expect(StoryChainService.seaKingHookAvailable(run)).toBeNull();

    ItemService.grant(run, "fish", 5);
    StoryChainService.syncObjectives(run);
    expect(StoryChainService.seaKingHookAvailable(run)).toBeNull();

    StoryChainService.markFired(run, generated.id, talk.id);
    expect(StoryChainService.seaKingHookAvailable(run)).toEqual({
      chainId: generated.id,
      battleNodeId: battle.id,
    });

    StoryChainService.markSeaKingHooked(run);
    expect(StoryChainService.seaKingHookAvailable(run)).toBeNull();

    const end = generated.nodes.find((n) => n.kind === "end")!;
    expect(end.placedHotspotId).toBe("hs_market");
    expect(end.questDraft?.objective?.itemId).toBe(SEA_KING_MEAT_ITEM_ID);
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${end.id}`)).toBe(true);

    StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: `STORY:${end.id}`,
      islandId: island.id,
    });
    expect(run.storyChainProgress?.find((p) => p.chainId === generated.id)?.effectsApplied).toBeFalsy();
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${end.id}`)).toBe(true);

    ItemService.grant(run, SEA_KING_MEAT_ITEM_ID, 1);
    StoryChainService.fireEvent(run, {
      kind: "suboption",
      hotspotId: "hs_market",
      childId: `STORY:${end.id}`,
      islandId: island.id,
    });
    expect(ItemService.countOwned(run, SEA_KING_MEAT_ITEM_ID)).toBe(0);
    expect(run.storyChainProgress?.find((p) => p.chainId === generated.id)?.effectsApplied).toBe(true);
    expect(StoryChainService.isPlayableStoryAction(run, [generated], `STORY:${end.id}`)).toBe(false);
  });
});
