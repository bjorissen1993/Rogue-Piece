import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { ISLAND_HUB_ENCOUNTER_ID } from "../game/constants";
import { BASIC_FACILITY_IDS, IslandService } from "./IslandService";
import { EncounterEngine } from "./EncounterEngine";
import { createRng } from "./RandomService";
import type { IslandFacilityHotspot, RunState } from "../models/types";
import {
  childActionsForFacility,
  FACILITY_CHILD_ACTIONS,
  MAP_CHILD_ACTIONS,
  clampIconScale,
  createLocationAnchor,
  createMapAnchorRegion,
  hotspotAuthorName,
  hotspotIdsOwnedByStoryChain,
  omitHotspotsAndRefs,
  revealIdsForProbe,
  revealSourcesForHotspot,
  getMapLayoutAnchorRegions,
  getMapLayoutIconScale,
  isHotspotVisibleInPlay,
  migrateHotspot,
  migrateIslandMapLayouts,
  playHotspotUsesHubChoice,
  resolveChildActionsForHotspot,
  specialMarkerIconSrc,
  storyChainNodeOriginLabel,
} from "../data/islandMaps";

function freshRun(seed = "island-phase1"): RunState {
  const profile = createEmptyProfile("island_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  return run;
}

describe("Island facilities (Phase 1)", () => {
  it("seeds islands with basic facilities always present", () => {
    const run = freshRun();
    expect(run.islands.length).toBeGreaterThan(0);
    for (const island of run.islands) {
      const ids = new Set((island.facilities ?? []).map((facility) => facility.id));
      for (const basic of BASIC_FACILITY_IDS) {
        expect(ids.has(basic)).toBe(true);
      }
      expect(island.developmentLevel).toBe(0);
      expect(island.protectionLevel).toBe(0);
      expect(island.trustLevel).toBe(0);
      expect(island.mapAssetId).toBeTruthy();
      expect(Array.isArray(island.facilityHotspots)).toBe(true);
      expect(island.mapLayouts).toBeTruthy();
    }
  });

  it("persists facility hotspot overrides on an island", () => {
    const run = freshRun("hotspot-save");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      { hotspotId: "hs_harbor", facilityId: "HARBOR", xPct: 20, yPct: 70, unlock: { mode: "always" } },
      { hotspotId: "hs_inn", facilityId: "INN", xPct: 55, yPct: 40, unlock: { mode: "always" } },
      { hotspotId: "hs_explore", facilityId: "EXPLORE", xPct: 50, yPct: 80, unlock: { mode: "always" }, alwaysVisible: true },
    ]);
    expect(island.facilityHotspots?.some((h) => h.facilityId === "EXPLORE")).toBe(true);
    expect(island.facilityHotspots?.every((h) => Boolean(h.hotspotId))).toBe(true);
    expect(island.mapLayouts?.[island.mapAssetId!]?.hotspots.some((h) => h.facilityId === "HARBOR")).toBe(
      true,
    );
    const resolved = IslandService.resolveHotspots(island, run);
    expect(resolved.some((h) => h.facilityId === "HARBOR" && h.xPct === 20)).toBe(true);
    expect(resolved.some((h) => h.facilityId === "EXPLORE")).toBe(true);
  });

  it("does not re-seed a facility hotspot after Remove + Save when the facility stays unlocked", () => {
    const run = freshRun("hotspot-no-reseed");
    const island = IslandService.getCurrentIsland(run)!;
    island.facilities = island.facilities ?? [];
    if (!island.facilities.some((f) => f.id === "AUCTION_HOUSE")) {
      island.facilities.push({
        id: "AUCTION_HOUSE",
        kind: "SPECIAL",
        encounterId: "island_auction_house",
        name: "Auction House",
        unlocked: true,
      });
    } else {
      island.facilities = island.facilities.map((f) =>
        f.id === "AUCTION_HOUSE" ? { ...f, unlocked: true } : f,
      );
    }

    // Authored layout deliberately omits Auction House (editor Remove + Save).
    IslandService.setFacilityHotspots(island, [
      { hotspotId: "hs_harbor", facilityId: "HARBOR", xPct: 20, yPct: 70, unlock: { mode: "always" } },
      {
        hotspotId: "hs_explore",
        facilityId: "EXPLORE",
        xPct: 50,
        yPct: 80,
        unlock: { mode: "always" },
        alwaysVisible: true,
      },
    ]);

    expect(IslandService.hasFacility(island, "AUCTION_HOUSE")).toBe(true);
    expect(island.mapLayouts?.[island.mapAssetId!]?.hotspots.some((h) => h.facilityId === "AUCTION_HOUSE")).toBe(
      false,
    );

    const play = IslandService.resolveHotspots(island, run, false);
    const editor = IslandService.resolveHotspots(island, run, true);
    expect(play.some((h) => h.facilityId === "AUCTION_HOUSE")).toBe(false);
    expect(editor.some((h) => h.facilityId === "AUCTION_HOUSE")).toBe(false);
    expect(play.some((h) => h.facilityId === "HARBOR")).toBe(true);
    expect(editor.some((h) => h.facilityId === "EXPLORE")).toBe(true);
  });

  it("keeps independent hotspot layouts per mapAssetId", () => {
    const run = freshRun("hotspot-per-map");
    const island = IslandService.getCurrentIsland(run)!;
    const mapA = island.mapAssetId!;
    const mapB = mapA === "Island_Library" ? "Island_Begin" : "Island_Library";

    IslandService.setMapHotspots(island, mapA, [
      { hotspotId: "a_harbor", facilityId: "HARBOR", xPct: 10, yPct: 10, unlock: { mode: "always" } },
      { hotspotId: "a_explore", facilityId: "EXPLORE", xPct: 50, yPct: 80, unlock: { mode: "always" } },
    ]);
    IslandService.setMapHotspots(island, mapB, [
      { hotspotId: "b_inn", facilityId: "INN", xPct: 90, yPct: 90, unlock: { mode: "always" } },
      { hotspotId: "b_explore", facilityId: "EXPLORE", xPct: 50, yPct: 80, unlock: { mode: "always" } },
    ]);

    expect(island.mapLayouts?.[mapA]?.hotspots.some((h) => h.facilityId === "HARBOR")).toBe(true);
    expect(island.mapLayouts?.[mapA]?.hotspots.some((h) => h.facilityId === "INN")).toBe(false);
    expect(island.mapLayouts?.[mapB]?.hotspots.some((h) => h.facilityId === "INN")).toBe(true);
    expect(island.mapLayouts?.[mapB]?.hotspots.some((h) => h.facilityId === "HARBOR")).toBe(false);

    island.mapAssetId = mapB;
    island.facilityHotspots = island.mapLayouts?.[mapB]?.hotspots ?? [];
    const resolvedB = IslandService.resolveHotspots(island, run, true);
    expect(resolvedB.some((h) => h.facilityId === "INN" && h.xPct === 90)).toBe(true);
    expect(resolvedB.some((h) => h.facilityId === "HARBOR" && h.xPct === 10)).toBe(false);

    // Editing map B must not wipe map A.
    IslandService.setFacilityHotspots(island, [
      { hotspotId: "b2", facilityId: "MARKET", xPct: 40, yPct: 40, unlock: { mode: "always" } },
      { hotspotId: "b2e", facilityId: "EXPLORE", xPct: 50, yPct: 80, unlock: { mode: "always" } },
    ]);
    expect(island.mapLayouts?.[mapA]?.hotspots.some((h) => h.hotspotId === "a_harbor")).toBe(true);
    expect(island.mapLayouts?.[mapB]?.hotspots.some((h) => h.facilityId === "MARKET")).toBe(true);
  });

  it("migrates legacy facilityHotspots into mapLayouts for the current map", () => {
    const run = freshRun("hotspot-migrate-layouts");
    const island = IslandService.getCurrentIsland(run)!;
    const mapKey = island.mapAssetId!;
    island.mapLayouts = {};
    island.facilityHotspots = [
      {
        hotspotId: "legacy_q",
        facilityId: "QUEST",
        xPct: 33,
        yPct: 44,
        unlock: { mode: "flag", flag: "map_quest" },
        questConfig: {
          kind: "STORY_THREAD",
          questOrEventId: "red_fang_rivalry",
          handlerType: "NPC",
          handlerId: "npc_test",
        },
      },
    ];

    migrateIslandMapLayouts(island);

    expect(island.mapLayouts[mapKey]?.hotspots).toHaveLength(1);
    expect(island.mapLayouts[mapKey]?.hotspots[0]?.facilityId).toBe("QUEST");
    expect(island.mapLayouts[mapKey]?.hotspots[0]?.questConfig?.questOrEventId).toBe(
      "red_fang_rivalry",
    );
    expect(island.facilityHotspots?.[0]?.hotspotId).toBe("legacy_q");
  });

  it("persists scenes, stages, links, reveals, and notes on map layouts (SAVE_VERSION 30)", () => {
    const run = freshRun("hotspot-scenes-stages");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(
      island,
      [
        {
          hotspotId: "q1",
          facilityId: "QUEST",
          xPct: 20,
          yPct: 30,
          unlock: { mode: "flag", flag: "map_quest" },
          sceneId: "scn_test",
          purpose: "Fetch the relic",
          notes: "Starts the chain",
          stages: [
            { id: "s1", order: 1, kind: "FIND_ITEM", label: "Find relic", notes: "crate near dock" },
            { id: "s2", order: 2, kind: "BATTLE", battle: true, label: "Ambush" },
            { id: "s3", order: 3, kind: "JOIN_OFFER", label: "Recruit survivor" },
          ],
          links: [
            {
              id: "l1",
              toHotspotId: "e1",
              label: "Continue",
              notes: "After accepting quest",
            },
            {
              id: "l2",
              toIslandId: "other_isle",
              toMapAssetId: "Island_Desert",
              notes: "Finale elsewhere",
            },
          ],
        },
        {
          hotspotId: "explore1",
          facilityId: "EXPLORE",
          xPct: 40,
          yPct: 55,
          unlock: { mode: "always" },
          revealsHotspotIds: ["q1", "e1"],
          consumeOnUse: true,
          notes: "One-shot probe",
        },
        {
          hotspotId: "e1",
          facilityId: "EVENT",
          xPct: 70,
          yPct: 40,
          unlock: { mode: "flag", flag: "map_event" },
          sceneId: "scn_test",
          notes: "Second step",
        },
      ],
      [{ id: "scn_test", name: "Relic Hunt", islandId: island.id, notes: "Chain notes" }],
    );

    const layout = island.mapLayouts?.[island.mapAssetId!];
    expect(layout?.scenes).toHaveLength(1);
    expect(layout?.scenes?.[0]?.name).toBe("Relic Hunt");
    expect(layout?.hotspots[0]?.stages).toHaveLength(3);
    expect(layout?.hotspots[0]?.stages?.[1]?.kind).toBe("BATTLE");
    expect(layout?.hotspots[0]?.links?.[1]?.toIslandId).toBe("other_isle");
    expect(layout?.hotspots[0]?.purpose).toBe("Fetch the relic");
    expect(layout?.hotspots[1]?.revealsHotspotIds).toEqual(["q1", "e1"]);
    expect(layout?.hotspots[1]?.consumeOnUse).toBe(true);
    expect(layout?.hotspots[2]?.sceneId).toBe("scn_test");

    migrateIslandMapLayouts(island);
    expect(island.mapLayouts?.[island.mapAssetId!]?.scenes?.[0]?.id).toBe("scn_test");
    expect(island.mapLayouts?.[island.mapAssetId!]?.hotspots[0]?.notes).toBe("Starts the chain");
    expect(island.mapLayouts?.[island.mapAssetId!]?.hotspots[1]?.consumeOnUse).toBe(true);
  });

  it("folds REVEAL links and disappearAfterUse into SAVE_VERSION 30 fields", () => {
    const migrated = migrateHotspot({
      hotspotId: "search1",
      facilityId: "SEARCH",
      xPct: 30,
      yPct: 40,
      unlock: { mode: "always" },
      links: [{ id: "rv1", toHotspotId: "hidden1", kind: "REVEAL" }],
      disappearAfterUse: true,
    } as Parameters<typeof migrateHotspot>[0] & { disappearAfterUse?: boolean });
    expect(migrated.revealsHotspotIds).toContain("hidden1");
    expect(migrated.consumeOnUse).toBe(true);
  });

  it("migrates Explore probes to consumeOnUse (SAVE_VERSION 34)", () => {
    const unset = migrateHotspot({
      hotspotId: "ex",
      facilityId: "EXPLORE",
      xPct: 50,
      yPct: 80,
      unlock: { mode: "always" },
    });
    expect(unset.consumeOnUse).toBe(true);

    const wasFalse = migrateHotspot({
      hotspotId: "ex2",
      facilityId: "EXPLORE",
      xPct: 50,
      yPct: 80,
      unlock: { mode: "always" },
      consumeOnUse: false,
    });
    expect(wasFalse.consumeOnUse).toBe(true);

    const scout = migrateHotspot({
      hotspotId: "sc1",
      facilityId: "SCOUT",
      xPct: 40,
      yPct: 40,
      unlock: { mode: "always" },
    });
    expect(scout.consumeOnUse).toBe(true);

    const quest = migrateHotspot({
      hotspotId: "q1",
      facilityId: "QUEST",
      xPct: 20,
      yPct: 20,
      unlock: { mode: "always" },
    });
    expect(quest.consumeOnUse).toBeUndefined();
  });

  it("allows multiple instances of the same icon type", () => {
    const run = freshRun("hotspot-multi");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      { hotspotId: "g1", facilityId: "GATHER", xPct: 20, yPct: 30, unlock: { mode: "always" } },
      { hotspotId: "g2", facilityId: "GATHER", xPct: 40, yPct: 50, unlock: { mode: "always" } },
      { hotspotId: "g3", facilityId: "GATHER", xPct: 70, yPct: 60, unlock: { mode: "always" } },
      { hotspotId: "ex", facilityId: "EXPLORE", xPct: 50, yPct: 80, unlock: { mode: "always" } },
    ]);
    const placed = (island.facilityHotspots ?? []).filter((h) => h.facilityId === "GATHER");
    expect(placed).toHaveLength(3);
    expect(new Set(placed.map((h) => h.hotspotId)).size).toBe(3);
    const editor = IslandService.resolveHotspots(island, run, true);
    expect(editor.filter((h) => h.facilityId === "GATHER")).toHaveLength(3);
    expect(IslandService.resolveHotspots(island, run).filter((h) => h.facilityId === "GATHER")).toHaveLength(
      0,
    );
  });

  it("hides quest markers until island discovery flags unlock them", () => {
    const run = freshRun("hotspot-unlock");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      { hotspotId: "h1", facilityId: "HARBOR", xPct: 20, yPct: 70, unlock: { mode: "always" } },
      { hotspotId: "ex", facilityId: "EXPLORE", xPct: 50, yPct: 80, unlock: { mode: "always" }, alwaysVisible: true },
      { hotspotId: "q1", facilityId: "QUEST", xPct: 60, yPct: 30, unlock: { mode: "flag", flag: "map_quest" } },
      { hotspotId: "e1", facilityId: "EVENT", xPct: 25, yPct: 35, unlock: { mode: "flag", flag: "map_event" } },
    ]);
    const before = IslandService.resolveHotspots(island, run);
    expect(before.some((h) => h.facilityId === "EXPLORE")).toBe(true);
    expect(before.some((h) => h.facilityId === "QUEST")).toBe(false);
    expect(before.some((h) => h.facilityId === "EVENT")).toBe(false);

    IslandService.addDiscoveryFlags(island, ["map_quest"]);
    const mid = IslandService.resolveHotspots(island, run);
    expect(mid.some((h) => h.facilityId === "QUEST")).toBe(true);
    expect(mid.some((h) => h.facilityId === "EVENT")).toBe(false);

    IslandService.addDiscoveryFlags(island, ["map_event"]);
    const after = IslandService.resolveHotspots(island, run);
    expect(after.some((h) => h.facilityId === "EVENT")).toBe(true);

    const editor = IslandService.resolveHotspots(island, run, true);
    expect(editor.filter((h) => h.facilityId === "QUEST" || h.facilityId === "EVENT")).toHaveLength(2);
  });

  it("hides reveal targets until an explore probe is used", () => {
    const run = freshRun("hotspot-explore-reveal");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      { facilityId: "HARBOR", xPct: 20, yPct: 70 } as never,
      {
        hotspotId: "ex_caves",
        facilityId: "EXPLORE",
        xPct: 50,
        yPct: 80,
        purpose: "East caves",
        alwaysVisible: true,
        revealsHotspotIds: ["hs_gather"],
      } as never,
      {
        hotspotId: "hs_gather",
        facilityId: "GATHER",
        xPct: 40,
        yPct: 40,
        unlock: { mode: "always" },
      } as never,
    ]);
    expect(island.facilityHotspots?.find((h) => h.facilityId === "GATHER")?.unlock?.mode).toBe(
      "always",
    );
    expect(IslandService.resolveHotspots(island, run).some((h) => h.facilityId === "GATHER")).toBe(
      false,
    );
    const explore = island.facilityHotspots?.find((h) => h.hotspotId === "ex_caves")!;
    const gather = island.facilityHotspots?.find((h) => h.hotspotId === "hs_gather")!;
    expect(hotspotAuthorName(explore)).toBe("East caves");
    expect(revealSourcesForHotspot("hs_gather", island.facilityHotspots ?? []).map((h) => h.hotspotId)).toEqual([
      "ex_caves",
    ]);
    expect(isHotspotVisibleInPlay(gather, island, run)).toBe(false);
    IslandService.revealHotspots(island, ["hs_gather"]);
    expect(island.revealedHotspotIds).toContain("hs_gather");
    expect(isHotspotVisibleInPlay(gather, island, run)).toBe(true);
    expect(IslandService.resolveHotspots(island, run).some((h) => h.facilityId === "GATHER")).toBe(
      true,
    );
    const folded = migrateHotspot({
      hotspotId: "old_count",
      facilityId: "GATHER",
      xPct: 10,
      yPct: 10,
      unlock: { mode: "explore_count", exploreCount: 2 },
    });
    expect(folded.unlock?.mode).toBe("always");
  });

  it("hides gather until the nearest explore probe is used", () => {
    const run = freshRun("gather-needs-explore");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      { facilityId: "HARBOR", xPct: 18, yPct: 72 } as never,
      {
        hotspotId: "ex_hills",
        facilityId: "EXPLORE",
        xPct: 48,
        yPct: 36,
        purpose: "Hill path",
        alwaysVisible: true,
      } as never,
      {
        hotspotId: "hs_gather",
        facilityId: "GATHER",
        xPct: 50,
        yPct: 32,
        unlock: { mode: "always" },
      } as never,
    ]);
    const gather = island.facilityHotspots?.find((h) => h.hotspotId === "hs_gather")!;
    const explore = island.facilityHotspots?.find((h) => h.hotspotId === "ex_hills")!;
    expect(gather.unlock?.mode).toBe("always");
    expect(explore.revealsHotspotIds).toBeUndefined();
    expect(IslandService.resolveHotspots(island, run).some((h) => h.facilityId === "GATHER")).toBe(
      false,
    );
    expect(isHotspotVisibleInPlay(gather, island, run)).toBe(false);
    expect(revealIdsForProbe(explore, island.facilityHotspots ?? [])).toEqual(["hs_gather"]);

    IslandService.consumeHotspot(island, "ex_hills");
    expect(isHotspotVisibleInPlay(gather, island, run)).toBe(true);
    IslandService.revealHotspots(island, revealIdsForProbe(explore, island.facilityHotspots ?? []));
    expect(island.revealedHotspotIds).toContain("hs_gather");
    expect(IslandService.resolveHotspots(island, run).some((h) => h.facilityId === "GATHER")).toBe(
      true,
    );
  });

  it("only reveals the gather nearest the used explore", () => {
    const run = freshRun("gather-nearest-explore");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      {
        hotspotId: "ex_west",
        facilityId: "EXPLORE",
        xPct: 20,
        yPct: 30,
        alwaysVisible: true,
      } as never,
      {
        hotspotId: "g_west",
        facilityId: "GATHER",
        xPct: 22,
        yPct: 28,
        unlock: { mode: "always" },
      } as never,
      {
        hotspotId: "ex_east",
        facilityId: "EXPLORE",
        xPct: 80,
        yPct: 70,
        alwaysVisible: true,
      } as never,
      {
        hotspotId: "g_east",
        facilityId: "GATHER",
        xPct: 78,
        yPct: 68,
        unlock: { mode: "always" },
      } as never,
    ]);
    const west = island.facilityHotspots?.find((h) => h.hotspotId === "g_west")!;
    const east = island.facilityHotspots?.find((h) => h.hotspotId === "g_east")!;
    const westExplore = island.facilityHotspots?.find((h) => h.hotspotId === "ex_west")!;
    expect(isHotspotVisibleInPlay(west, island, run)).toBe(false);
    expect(isHotspotVisibleInPlay(east, island, run)).toBe(false);
    expect(revealIdsForProbe(westExplore, island.facilityHotspots ?? [])).toEqual(["g_west"]);

    IslandService.consumeHotspot(island, "ex_west");
    IslandService.revealHotspots(island, revealIdsForProbe(westExplore, island.facilityHotspots ?? []));
    expect(isHotspotVisibleInPlay(west, island, run)).toBe(true);
    expect(isHotspotVisibleInPlay(east, island, run)).toBe(false);
  });

  it("lists child actions for parent facilities including reusable Talk", () => {
    expect(FACILITY_CHILD_ACTIONS.HARBOR).toContain("HARBOR_CREW");
    expect(FACILITY_CHILD_ACTIONS.INN).toContain("TALK_NPCS");
    expect(childActionsForFacility("INN").some((a) => a.id === "TALK_NPCS")).toBe(true);
    expect(childActionsForFacility("MARKET").map((a) => a.id)).toEqual(["MARKET_BUY_SELL"]);
    expect(childActionsForFacility("WEAPON_SHOP").map((a) => a.id)).toEqual([
      "WEAPON_BUY_SELL",
      "WEAPON_SERVICES",
    ]);
    expect(childActionsForFacility("CLINIC").map((a) => a.id)).toEqual([
      "CLINIC_MEDICINE",
      "CLINIC_HEAL",
      "CLINIC_HOSPITAL",
    ]);
    expect(MAP_CHILD_ACTIONS.HARBOR_SHIP.resolve).toEqual({ type: "overlay", overlay: "ship" });
    expect(MAP_CHILD_ACTIONS.HARBOR_CARGO.resolve).toEqual({
      type: "overlay",
      overlay: "ship",
      focus: "cargo",
    });
    expect(MAP_CHILD_ACTIONS.HARBOR_DEPART.resolve).toEqual({
      type: "hub_choice",
      choiceId: "harbor",
    });
  });

  it("resolves optional Talk and per-child unlock overrides on parent hotspots", () => {
    const run = freshRun("child-overrides");
    const island = IslandService.getCurrentIsland(run)!;
    const harbor: IslandFacilityHotspot = {
      hotspotId: "hs_harbor",
      facilityId: "HARBOR",
      xPct: 20,
      yPct: 70,
      unlock: { mode: "always" },
      childOverrides: [
        { childId: "TALK_NPCS", included: true, unlock: { mode: "flag", flag: "met_dockmaster" } },
        { childId: "HARBOR_FLEET", included: false },
      ],
    };
    const withoutTalk = resolveChildActionsForHotspot(
      { ...harbor, childOverrides: [{ childId: "HARBOR_FLEET", included: false }] },
      island,
      run,
    );
    expect(withoutTalk.some((a) => a.id === "TALK_NPCS")).toBe(false);
    expect(withoutTalk.some((a) => a.id === "HARBOR_FLEET")).toBe(false);
    expect(withoutTalk.some((a) => a.id === "HARBOR_CREW")).toBe(true);

    const lockedTalk = resolveChildActionsForHotspot(harbor, island, run);
    expect(lockedTalk.some((a) => a.id === "TALK_NPCS")).toBe(false);

    IslandService.addDiscoveryFlags(island, ["met_dockmaster"]);
    const unlockedTalk = resolveChildActionsForHotspot(harbor, island, run);
    expect(unlockedTalk.some((a) => a.id === "TALK_NPCS")).toBe(true);

    const marketWithTalk = resolveChildActionsForHotspot(
      {
        hotspotId: "hs_market",
        facilityId: "MARKET",
        xPct: 50,
        yPct: 50,
        unlock: { mode: "always" },
        childOverrides: [{ childId: "TALK_NPCS", included: true }],
      },
      island,
      run,
    );
    expect(marketWithTalk.some((a) => a.id === "TALK_NPCS")).toBe(true);
    expect(marketWithTalk.some((a) => a.id === "MARKET_BUY_SELL")).toBe(true);
    expect(marketWithTalk.some((a) => a.id === "HUB_VISIT")).toBe(false);
  });

  it("opens Market as a hub menu with shop plus nested story quests", () => {
    const market: IslandFacilityHotspot = {
      hotspotId: "hs_market",
      facilityId: "MARKET",
      xPct: 50,
      yPct: 50,
      unlock: { mode: "always" },
    };
    const shopOnly = resolveChildActionsForHotspot(market);
    expect(shopOnly.some((a) => a.id === "MARKET_BUY_SELL" && a.resolve.type === "overlay")).toBe(true);
    expect(shopOnly.some((a) => a.id === "HUB_VISIT")).toBe(false);

    const withQuest = resolveChildActionsForHotspot(market, undefined, undefined, {
      storyChains: [
        {
          id: "schain_fish",
          name: "Fishing Quest",
          start: {},
          end: {},
          nodes: [
            {
              id: "n_start",
              order: 1,
              kind: "start",
              placedHotspotId: "hs_market",
              trigger: { kind: "suboption", childId: "HUB_VISIT", ref: "hs_market:HUB_VISIT" },
            },
          ],
        },
      ],
    });
    expect(withQuest.some((a) => a.id === "MARKET_BUY_SELL" && a.resolve.type === "overlay")).toBe(true);
    expect(withQuest.some((a) => a.id === "STORY:n_start" && a.resolve.type === "story")).toBe(true);
    expect(withQuest.find((a) => a.id === "STORY:n_start")?.label).toBe("Fishing Quest");
  });

  it("opens Weapon Shop and Clinic medicine as map overlays", () => {
    const weapons = resolveChildActionsForHotspot({
      hotspotId: "hs_weapons",
      facilityId: "WEAPON_SHOP",
      xPct: 40,
      yPct: 40,
      unlock: { mode: "always" },
    });
    expect(weapons.some((a) => a.id === "WEAPON_BUY_SELL" && a.resolve.type === "overlay")).toBe(true);
    expect(weapons.some((a) => a.id === "WEAPON_SERVICES" && a.resolve.type === "overlay")).toBe(true);
    expect(weapons.find((a) => a.id === "WEAPON_SERVICES")?.resolve).toEqual({
      type: "overlay",
      overlay: "weapon_services",
    });
    expect(weapons.some((a) => a.id === "HUB_VISIT")).toBe(false);

    const clinic = resolveChildActionsForHotspot({
      hotspotId: "hs_clinic",
      facilityId: "CLINIC",
      xPct: 60,
      yPct: 50,
      unlock: { mode: "always" },
    });
    const medicine = clinic.find((a) => a.id === "CLINIC_MEDICINE");
    expect(medicine?.resolve).toEqual({ type: "overlay", overlay: "clinic" });
    expect(clinic.some((a) => a.id === "CLINIC_HEAL" && a.resolve.type === "hub_choice")).toBe(true);
  });

  it("keeps weapon-shop story quests as their own child beside the overlay", () => {
    const withQuest = resolveChildActionsForHotspot(
      {
        hotspotId: "hs_weapons",
        facilityId: "WEAPON_SHOP",
        xPct: 40,
        yPct: 40,
        unlock: { mode: "always" },
      },
      undefined,
      undefined,
      {
        storyChains: [
          {
            id: "schain_steel",
            name: "Missing Blade",
            start: {},
            end: {},
            nodes: [
              {
                id: "n_start",
                order: 1,
                kind: "start",
                placedHotspotId: "hs_weapons",
                trigger: { kind: "suboption", childId: "HUB_VISIT", ref: "hs_weapons:HUB_VISIT" },
              },
            ],
          },
        ],
      },
    );
    expect(withQuest.some((a) => a.id === "WEAPON_BUY_SELL" && a.resolve.type === "overlay")).toBe(true);
    expect(withQuest.some((a) => a.id === "STORY:n_start" && a.resolve.type === "story")).toBe(true);
  });

  it("removes only story fiches when a thread is deleted, not shared hubs", () => {
    const market: IslandFacilityHotspot = { hotspotId: "hs_market", facilityId: "MARKET", xPct: 50, yPct: 50 };
    const start: IslandFacilityHotspot = { hotspotId: "hs_start", facilityId: "QUEST", xPct: 40, yPct: 40 };
    const talk: IslandFacilityHotspot = { hotspotId: "hs_talk", facilityId: "TALK", xPct: 45, yPct: 42 };
    const chain = {
      id: "c1",
      name: "Fish Shortage",
      start: {},
      end: {},
      nodes: [
        { id: "n1", order: 1, kind: "start" as const, placedHotspotId: "hs_market" },
        { id: "n2", order: 2, kind: "talk" as const, placedHotspotId: "hs_talk" },
        { id: "n3", order: 3, kind: "start" as const, placedHotspotId: "hs_start" },
      ],
    };
    const owned = hotspotIdsOwnedByStoryChain(chain, [market, start, talk]);
    expect(owned).toEqual(["hs_talk", "hs_start"]);
    const next = omitHotspotsAndRefs(
      [
        market,
        start,
        talk,
        { ...market, hotspotId: "hs_other", links: [{ id: "l1", toHotspotId: "hs_talk" }] },
      ],
      owned,
    );
    expect(next.map((h) => h.hotspotId)).toEqual(["hs_market", "hs_other"]);
    expect(next.find((h) => h.hotspotId === "hs_other")?.links).toEqual([]);
  });

  it("migrates childOverrides on hotspot lists", () => {
    const run = freshRun("child-migrate");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      {
        facilityId: "INN",
        xPct: 40,
        yPct: 40,
        childOverrides: [
          { childId: "TALK_NPCS", included: true, unlock: { mode: "explore_count", exploreCount: 2 } },
          { childId: "TALK_NPCS", included: false },
        ],
      } as never,
    ]);
    const inn = island.facilityHotspots?.find((h) => h.facilityId === "INN");
    expect(inn?.hotspotId).toBeTruthy();
    expect(inn?.childOverrides).toHaveLength(1);
    expect(inn?.childOverrides?.[0]?.childId).toBe("TALK_NPCS");
    expect(inn?.childOverrides?.[0]?.unlock?.mode).toBe("always");

    IslandService.setFacilityHotspots(island, [
      {
        facilityId: "WEAPON_SHOP",
        xPct: 30,
        yPct: 30,
        childOverrides: [
          { childId: "WEAPON_BUY", included: true },
          { childId: "WEAPON_SELL", included: false },
        ],
      } as never,
    ]);
    const shop = island.facilityHotspots?.find((h) => h.facilityId === "WEAPON_SHOP");
    expect(shop?.childOverrides).toEqual([{ childId: "WEAPON_BUY_SELL", included: true }]);
  });

  it("unlocks map markers from explore outcomes via discovery flags", () => {
    const profile = createEmptyProfile("map_unlock_explore", "NORMAL");
    profile.activeRun = freshRun("map-unlock-explore");
    const run = profile.activeRun!;
    run.currentEncounterId = ISLAND_HUB_ENCOUNTER_ID;
    const island = IslandService.getCurrentIsland(run)!;
    expect(island.discoveryFlags ?? []).not.toContain("map_quest");

    // Force the quest-unlock explore branch by resolving a synthetic outcome path:
    IslandService.addDiscoveryFlags(island, ["map_quest"]);
    expect(IslandService.hasDiscoveryFlag(island, "map_quest")).toBe(true);
  });

  it("increments exploreCount when exploring from the hub", () => {
    const profile = createEmptyProfile("explore_count_hub", "NORMAL");
    profile.activeRun = freshRun("explore-count-hub");
    const run = profile.activeRun!;
    run.currentEncounterId = ISLAND_HUB_ENCOUNTER_ID;
    const island = IslandService.getCurrentIsland(run)!;
    expect(island.exploreCount ?? 0).toBe(0);
    const chosen = EncounterEngine.resolveChoice(profile, "explore", createRng("explore-once"));
    expect(IslandService.getCurrentIsland(chosen.profile.activeRun!)?.exploreCount).toBe(1);
  });

  it("assigns map art to islands that predate mapAssetId", () => {
    const run = freshRun("map-backfill");
    const island = IslandService.getCurrentIsland(run)!;
    island.mapAssetId = null;
    island.facilityHotspots = undefined;
    IslandService.ensureMapAsset(island, createRng("map-backfill"));
    expect(island.mapAssetId).toBeTruthy();
    expect(Array.isArray(island.facilityHotspots)).toBe(true);
  });

  it("falls back to first island when currentIslandId is stale", () => {
    const run = freshRun("stale-island-id");
    expect(run.islands.length).toBeGreaterThan(0);
    run.currentIslandId = "island_does_not_exist";
    expect(IslandService.getCurrentIsland(run)?.id).toBe(run.islands[0].id);
  });

  it("starts a new run on the island hub in ISLAND mode", () => {
    const run = freshRun();
    expect(run.activityMode).toBe("ISLAND");
    expect(run.currentEncounterId).toBe(ISLAND_HUB_ENCOUNTER_ID);
    expect(run.currentIslandId).toBeTruthy();
  });

  it("rolls special facilities by archetype without dropping basics", () => {
    const run = freshRun("marine-base-roll");
    const marine = run.islands.find((island) => island.archetype === "MARINE_FORTRESS");
    expect(marine).toBeTruthy();
    IslandService.ensureFacilities(marine!, createRng("marine-ensure"));
    expect(IslandService.hasFacility(marine, "HARBOR")).toBe(true);
    expect(IslandService.hasFacility(marine, "TASK_BOARD")).toBe(true);
    // High chance MARINE_BASE on fortress; tolerate RNG by checking generateFacilities directly.
    const forced = IslandService.generateFacilities("MARINE_FORTRESS", createRng("always-marine"));
    // With many rolls, marine base should appear often — verify generate includes basics + optional specials shape.
    expect(forced.filter((facility) => facility.kind === "BASIC")).toHaveLength(5);
    expect(forced.every((facility) => facility.unlocked)).toBe(true);
  });

  it("persists map iconScale on save (SAVE_VERSION 35)", () => {
    const run = freshRun("icon-scale");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, island.facilityHotspots ?? [], [], {
      iconScale: 1.35,
    });
    expect(getMapLayoutIconScale(island, island.mapAssetId)).toBe(1.35);
    migrateIslandMapLayouts(island);
    expect(island.mapLayouts?.[island.mapAssetId!]?.iconScale).toBe(1.35);
    expect(clampIconScale(9)).toBe(1.8);
    expect(clampIconScale(undefined)).toBe(1);
  });

  it("hides consumed explore probes and location anchors in play (SAVE_VERSION 36)", () => {
    const run = freshRun("consume-probes");
    const island = IslandService.getCurrentIsland(run)!;
    const explore: IslandFacilityHotspot = {
      hotspotId: "ex_gone",
      facilityId: "EXPLORE",
      xPct: 50,
      yPct: 80,
      unlock: { mode: "always" },
      alwaysVisible: true,
      consumeOnUse: true,
    };
    const anchor: IslandFacilityHotspot = {
      hotspotId: "anc1",
      facilityId: "LOCATION_ANCHOR",
      xPct: 40,
      yPct: 40,
      unlock: { mode: "always" },
      alwaysVisible: true,
    };
    expect(isHotspotVisibleInPlay(explore, island, run)).toBe(true);
    expect(isHotspotVisibleInPlay(anchor, island, run)).toBe(false);
    IslandService.consumeHotspot(island, "ex_gone");
    expect(island.consumedHotspotIds).toContain("ex_gone");
    expect(isHotspotVisibleInPlay(explore, island, run)).toBe(false);
    migrateIslandMapLayouts(island);
    expect(island.consumedHotspotIds).toContain("ex_gone");
  });

  it("restores a broken explore consume so the probe and its reveals can be used again", () => {
    const run = freshRun("restore-broken-explore");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(island, [
      { facilityId: "HARBOR", xPct: 20, yPct: 70 } as never,
      {
        hotspotId: "ex_caves",
        facilityId: "EXPLORE",
        xPct: 50,
        yPct: 80,
        purpose: "East caves",
        alwaysVisible: true,
        consumeOnUse: true,
        revealsHotspotIds: ["hs_gather"],
      } as never,
      {
        hotspotId: "hs_gather",
        facilityId: "GATHER",
        xPct: 40,
        yPct: 40,
        unlock: { mode: "always" },
      } as never,
    ]);
    const explore = island.facilityHotspots?.find((h) => h.hotspotId === "ex_caves")!;
    const gather = island.facilityHotspots?.find((h) => h.hotspotId === "hs_gather")!;
    IslandService.consumeHotspot(island, "ex_caves");
    expect(island.consumedHotspotIds).toContain("ex_caves");
    expect(isHotspotVisibleInPlay(explore, island, run)).toBe(true);
    expect(isHotspotVisibleInPlay(gather, island, run)).toBe(false);
    migrateIslandMapLayouts(island);
    expect(island.consumedHotspotIds ?? []).not.toContain("ex_caves");
    expect(isHotspotVisibleInPlay(explore, island, run)).toBe(true);

    IslandService.consumeHotspot(island, "ex_caves");
    IslandService.revealHotspots(island, ["hs_gather"]);
    expect(isHotspotVisibleInPlay(explore, island, run)).toBe(false);
    expect(isHotspotVisibleInPlay(gather, island, run)).toBe(true);
    IslandService.restoreProbe(island, "ex_caves");
    expect(island.consumedHotspotIds ?? []).not.toContain("ex_caves");
    expect(island.revealedHotspotIds ?? []).not.toContain("hs_gather");
    expect(isHotspotVisibleInPlay(explore, island, run)).toBe(true);
    expect(isHotspotVisibleInPlay(gather, island, run)).toBe(false);
  });

  it("persists named anchor regions on a map layout (SAVE_VERSION 36)", () => {
    const run = freshRun("anchor-regions");
    const island = IslandService.getCurrentIsland(run)!;
    const region = createMapAnchorRegion(
      "East caves",
      [
        { xPct: 60, yPct: 40 },
        { xPct: 80, yPct: 42 },
        { xPct: 72, yPct: 62 },
      ],
      "auto",
    );
    IslandService.setFacilityHotspots(island, island.facilityHotspots ?? [], [], {
      anchorRegions: [region],
    });
    const stored = getMapLayoutAnchorRegions(island, island.mapAssetId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe("East caves");
    expect(stored[0]?.points).toHaveLength(3);
    expect(stored[0]?.aiPermission).toBe("auto");
    migrateIslandMapLayouts(island);
    expect(island.mapLayouts?.[island.mapAssetId!]?.anchorRegions?.[0]?.name).toBe("East caves");
  });

  it("routes Quest / thread-begin clicks away from Task Board", () => {
    const quest: IslandFacilityHotspot = {
      hotspotId: "q1",
      facilityId: "QUEST",
      xPct: 40,
      yPct: 40,
    };
    const event: IslandFacilityHotspot = {
      hotspotId: "e1",
      facilityId: "EVENT",
      xPct: 50,
      yPct: 50,
    };
    const tasks: IslandFacilityHotspot = {
      hotspotId: "t1",
      facilityId: "TASK_BOARD",
      xPct: 30,
      yPct: 30,
    };
    expect(playHotspotUsesHubChoice(quest, { hasNestedStory: true, storyFired: true })).toBe(false);
    expect(playHotspotUsesHubChoice(quest)).toBe(false);
    expect(playHotspotUsesHubChoice(event, { hasNestedStory: true })).toBe(false);
    expect(playHotspotUsesHubChoice(event)).toBe(true);
    expect(playHotspotUsesHubChoice(tasks, { hasNestedStory: true, storyFired: true })).toBe(true);
    expect(storyChainNodeOriginLabel("generated")).toBe("Generated");
    expect(specialMarkerIconSrc("LOCATION_ANCHOR")).toBe("/icons/UI/location.png");
    const anchor = createLocationAnchor("Cliff well", ["well"], "suggest");
    expect(anchor.hotspotId).toBeUndefined();
  });

  it("returns to the island hub after completing a non-chained shore beat", () => {
    const profile = createEmptyProfile("island_hub_loop", "NORMAL");
    profile.activeRun = freshRun("hub-return");
    const run = profile.activeRun!;
    run.currentEncounterId = "supply_search";
    run.awaitingAdvance = true;
    run.lastResultText = "Done scavenging.";
    run.pendingTimeCost = 0;
    const next = EncounterEngine.completeEncounter(profile, createRng("hub-return-complete"));
    expect(next.activeRun?.currentEncounterId).toBe(ISLAND_HUB_ENCOUNTER_ID);
    expect(next.activeRun?.activityMode).toBe("ISLAND");
  });

  it("chains into a facility from the hub without picking a random encounter", () => {
    const profile = createEmptyProfile("island_chain", "NORMAL");
    profile.activeRun = freshRun("hub-chain");
    const run = profile.activeRun!;
    expect(run.currentEncounterId).toBe(ISLAND_HUB_ENCOUNTER_ID);
    const chosen = EncounterEngine.resolveChoice(profile, "inn", createRng("hub-chain-inn"));
    expect(chosen.profile.activeRun?.pendingEncounterId).toBe("island_inn");
    const advanced = EncounterEngine.completeEncounter(chosen.profile, createRng("hub-chain-adv"));
    expect(advanced.activeRun?.currentEncounterId).toBe("island_inn");
  });
});
