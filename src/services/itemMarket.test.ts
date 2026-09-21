import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { RunState } from "../models/types";
import { FactionMissionService } from "./FactionMissionService";
import { ItemMarketService } from "./ItemMarketService";
import { createRng } from "./RandomService";
import { KnowledgeService } from "./KnowledgeService";

function freshRun(seed = "market-test"): RunState {
  const profile = createEmptyProfile("market", "NORMAL");
  const run = createRunState(profile, {
    name: "Market Tester",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  return run;
}

describe("ItemMarketService", () => {
  it("generates persistent black market stock until refresh day", () => {
    const run = freshRun("bm-persist");
    const first = ItemMarketService.ensureStock(run, "BLACK_MARKET", createRng("bm-a"));
    expect(first.listings.length).toBeGreaterThanOrEqual(3);
    const second = ItemMarketService.ensureStock(run, "BLACK_MARKET", createRng("bm-b"));
    expect(second.shopKey).toBe(first.shopKey);
    expect(second.listings.map((l) => l.listingId)).toEqual(first.listings.map((l) => l.listingId));
  });

  it("purchases a listing and can grant knowledge collectables", () => {
    const profile = createEmptyProfile("buy", "NORMAL");
    const run = createRunState(profile, {
      name: "Buyer",
      raceId: "HUMAN",
      originId: "SAILOR",
      locationId: "east_blue_port",
    });
    profile.activeRun = run;
    run.seed = "buy-market";
    run.player.berries = 5000;
    const stock = ItemMarketService.ensureStock(run, "BLACK_MARKET", createRng("buy-a"), {
      forceRefresh: true,
    });
    const listing = stock.listings[0]!;
    listing.itemId = "marine_field_manual";
    listing.price = 50;
    listing.sold = false;
    listing.quantity = 1;
    const result = ItemMarketService.purchase(
      run,
      profile,
      stock.shopKey,
      listing.listingId,
      createRng("buy-force"),
    );
    expect(result.ok).toBe(true);
    expect(run.player.inventory.some((item) => (item.itemId || item.id) === "marine_field_manual")).toBe(
      true,
    );
    expect(KnowledgeService.hasAtLeast(run, "marine_formations", "LIMITED")).toBe(true);
  });
});

describe("FactionMissionService board", () => {
  it("seeds available missions and can accept/resolve", () => {
    const run = freshRun("mission-board");
    run.factionMissions = [];
    FactionMissionService.ensureBoardStock(run);
    expect(FactionMissionService.listMissions(run).some((m) => m.status === "AVAILABLE")).toBe(true);
    const mission = FactionMissionService.listMissions(run).find((m) => m.status === "AVAILABLE")!;
    expect(FactionMissionService.activateMission(run, mission.id)).toContain("accepted");
    expect(mission.status).toBe("ACTIVE");
    const before = run.player.berries;
    FactionMissionService.resolveMission(run, mission.id, true);
    expect(mission.status).toBe("COMPLETED");
    expect(run.player.berries).toBeGreaterThanOrEqual(before);
  });
});
