import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import {
  applyFishingTimerBonus,
  computeFishingMultiplier,
  fishingArcsOverlap,
  fishingRarityWeights,
  FISHING_TIMER_MS,
  rollFishCatch,
  rollFishingZones,
} from "../data/fishing";
import { itemSellPrice, SEA_KING_MEAT_ITEM_ID } from "../data/items";
import { FishingService, SEA_KING_HOOK_LINE } from "./FishingService";
import { ItemService } from "./ItemService";
import { storyObjectiveMet } from "./StoryChainService";
import type { RunState } from "../models/types";

function freshRun(seed = "fishing"): RunState {
  const profile = createEmptyProfile("fishing_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  run.timeOfDay = "DAWN";
  return run;
}

const session = {
  caught: true,
  attempted: true,
  elapsedMs: 3000,
  greenHits: 2,
  goldHits: 1,
  grayHits: 0,
  timeLeftMs: 7000,
} as const;

describe("Fishing minigame rewards", () => {
  it("builds a higher multiplier from green, gold, and remaining clock", () => {
    const poor = computeFishingMultiplier({
      greenHits: 3,
      goldHits: 0,
      grayHits: 4,
      timeLeftMs: 800,
    });
    const rich = computeFishingMultiplier({
      greenHits: 0,
      goldHits: 3,
      grayHits: 0,
      timeLeftMs: FISHING_TIMER_MS,
    });
    expect(rich).toBeGreaterThan(poor);
    expect(poor).toBeLessThan(2);
    expect(rich).toBeGreaterThan(3);
  });

  it("subtracts gray hits from the multiplier", () => {
    const clean = computeFishingMultiplier({
      greenHits: 3,
      goldHits: 0,
      grayHits: 0,
      timeLeftMs: 5000,
    });
    const messy = computeFishingMultiplier({
      greenHits: 3,
      goldHits: 0,
      grayHits: 3,
      timeLeftMs: 5000,
    });
    expect(messy).toBeLessThan(clean);
    expect(clean - messy).toBeCloseTo(0.84, 2);
  });

  it("shifts rarity weight toward better fish as the multiplier rises", () => {
    const low = fishingRarityWeights(0.6);
    const high = fishingRarityWeights(2.8);
    const lowCommon = low[0]!.weight;
    const highCommon = high[0]!.weight;
    const lowGold = low[3]!.weight;
    const highGold = high[3]!.weight;
    expect(highCommon).toBeLessThan(lowCommon);
    expect(highGold).toBeGreaterThan(lowGold);
  });

  it("rolls a better fish on a high multiplier when the roll is lucky", () => {
    const stats = { greenHits: 0, goldHits: 3, grayHits: 0, timeLeftMs: FISHING_TIMER_MS };
    expect(rollFishCatch(stats, 0.01).tier.id).toBe("fish");
    expect(["fish_prime", "fish_golden"]).toContain(rollFishCatch(stats, 0.92).tier.id);
  });

  it("refills the fight clock on green and gold, capped at the start time", () => {
    expect(applyFishingTimerBonus(4000, false)).toBe(6000);
    expect(applyFishingTimerBonus(4000, true)).toBe(7200);
    expect(applyFishingTimerBonus(FISHING_TIMER_MS - 200, false)).toBe(FISHING_TIMER_MS);
  });

  it("grants a catch and spends one time slot", () => {
    const run = freshRun();
    const line = FishingService.applySession(run, session);
    expect(run.timeOfDay).toBe("MORNING");
    expect(FishingService.countCaughtFish(run)).toBe(1);
    expect(line).toMatch(/Catch/);
  });

  it("spends a time slot on a miss without granting a fish", () => {
    const run = freshRun();
    FishingService.applySession(run, {
      ...session,
      caught: false,
      elapsedMs: 1200,
      timeLeftMs: 0,
    });
    expect(run.timeOfDay).toBe("MORNING");
    expect(FishingService.countCaughtFish(run)).toBe(0);
  });

  it("does not spend time when the line is never cast", () => {
    const run = freshRun();
    const line = FishingService.applySession(run, {
      caught: false,
      attempted: false,
      elapsedMs: 0,
      greenHits: 0,
      goldHits: 0,
      grayHits: 0,
      timeLeftMs: FISHING_TIMER_MS,
    });
    expect(line).toBe("");
    expect(run.timeOfDay).toBe("DAWN");
  });

  it("places two greens and a gold that do not sit on top of each other", () => {
    for (let i = 0; i < 20; i += 1) {
      const zones = rollFishingZones(i % 3);
      expect(zones.greens).toHaveLength(2);
      expect(zones.red).toBeUndefined();
      expect(fishingArcsOverlap(zones.greens[0]!, zones.greens[1]!, 8)).toBe(false);
      expect(fishingArcsOverlap(zones.greens[0]!, zones.gold, 8)).toBe(false);
      expect(fishingArcsOverlap(zones.greens[1]!, zones.gold, 8)).toBe(false);
    }
  });

  it("adds a red slice the same width as gold when the Sea King hunt is armed", () => {
    for (let i = 0; i < 20; i += 1) {
      const zones = rollFishingZones(i % 3, { includeRed: true });
      expect(zones.red).toBeTruthy();
      expect(zones.red!.width).toBe(zones.gold.width);
      expect(fishingArcsOverlap(zones.red!, zones.gold, 8)).toBe(false);
      expect(fishingArcsOverlap(zones.red!, zones.greens[0]!, 8)).toBe(false);
      expect(fishingArcsOverlap(zones.red!, zones.greens[1]!, 8)).toBe(false);
    }
  });

  it("hooks a Sea King without granting a fish", () => {
    const run = freshRun("sea-king-hook");
    const line = FishingService.applySession(run, {
      ...session,
      caught: false,
      redHits: 3,
      seaKingHooked: true,
    });
    expect(line).toBe(SEA_KING_HOOK_LINE);
    expect(run.timeOfDay).toBe("MORNING");
    expect(FishingService.countCaughtFish(run)).toBe(0);
    expect(run.combat?.pendingOutcome?.win?.addMilestones).toContain("defeated_sea_king");
    expect(run.combat?.pendingOutcome?.win?.grantItemIds).toContain("sea_king_meat");
  });

  it("keeps Sea King meat as a quest item that cannot be sold", () => {
    const run = freshRun("sea-king-meat");
    ItemService.grant(run, SEA_KING_MEAT_ITEM_ID, 1);
    expect(ItemService.countOwned(run, SEA_KING_MEAT_ITEM_ID)).toBe(1);
    expect(itemSellPrice(SEA_KING_MEAT_ITEM_ID)).toBeNull();
    expect(ItemService.sell(run, SEA_KING_MEAT_ITEM_ID).ok).toBe(false);
    expect(ItemService.countOwned(run, SEA_KING_MEAT_ITEM_ID)).toBe(1);
    expect(ItemService.remove(run, SEA_KING_MEAT_ITEM_ID, 1)).toBe(1);
    expect(ItemService.countOwned(run, SEA_KING_MEAT_ITEM_ID)).toBe(0);
  });

  it("lets a caught fish sell for berries from the pack", () => {
    const run = freshRun("sell-fish");
    run.player.berries = 100;
    ItemService.grant(run, "fish_prime", 1);
    const price = itemSellPrice("fish_prime");
    expect(price).toBe(42);
    const sold = ItemService.sell(run, "fish_prime");
    expect(sold.ok).toBe(true);
    expect(run.player.berries).toBe(142);
    expect(ItemService.countOwned(run, "fish_prime")).toBe(0);
  });

  it("counts every fish quality toward a collect-5-fish objective", () => {
    const run = freshRun("fish-quest-count");
    ItemService.grant(run, "fish", 2);
    ItemService.grant(run, "fish_fine", 1);
    ItemService.grant(run, "fish_prime", 1);
    ItemService.grant(run, "fish_golden", 1);
    expect(FishingService.countCaughtFish(run)).toBe(5);
    expect(storyObjectiveMet(run, { type: "collect_item", itemId: "fish", count: 5 })).toBe(true);
  });
});
