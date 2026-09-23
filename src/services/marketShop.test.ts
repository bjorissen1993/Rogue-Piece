import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import {
  clampMarketQuantity,
  itemArtRarity,
  itemIconSrc,
  itemRarityGlowClass,
  itemShopAisle,
  MARKET_SHOP_TABS,
  marketBuyLimit,
  marketShopCatalog,
  marketShopPrice,
  matchesMarketTab,
} from "../data/marketShop";
import { ItemService } from "./ItemService";
import { MarketShopService } from "./MarketShopService";
import type { RunState } from "../models/types";

function freshRun(seed = "market-shop"): RunState {
  const profile = createEmptyProfile("market_shop_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  run.player.berries = 200;
  return run;
}

describe("Market shop on the hub map", () => {
  it("sells the old parchment stall goods at shop prices", () => {
    expect(marketShopPrice("rice_ball")).toBe(25);
    expect(marketShopCatalog().some((entry) => entry.itemId === "bandage")).toBe(true);
  });

  it("splits stall goods into food, drinks, and medicine", () => {
    expect(itemShopAisle("rice_ball")).toBe("food");
    expect(itemShopAisle("grog")).toBe("drink");
    expect(itemShopAisle("bandage")).toBe("medicine");
    expect(itemShopAisle("medical_kit")).toBe("medicine");
    expect(itemShopAisle("fish_prime")).toBe("food");
    expect(marketShopCatalog().filter((entry) => entry.aisle === "food")).toHaveLength(3);
    expect(marketShopCatalog().filter((entry) => entry.aisle === "drink")).toHaveLength(3);
    expect(marketShopCatalog().filter((entry) => entry.aisle === "medicine")).toHaveLength(1);
  });

  it("filters pack and stall goods with the same aisle tabs", () => {
    expect(matchesMarketTab("rice_ball", "all")).toBe(true);
    expect(matchesMarketTab("rice_ball", "food")).toBe(true);
    expect(matchesMarketTab("grog", "food")).toBe(false);
    expect(matchesMarketTab("fish_prime", "food")).toBe(true);
    expect(matchesMarketTab("bandage", "medicine")).toBe(true);
    expect(matchesMarketTab("fresh_water", "drink")).toBe(true);
  });

  it("glows only items that carry a rarity", () => {
    expect(itemArtRarity("rice_ball")).toBeNull();
    expect(itemRarityGlowClass("rice_ball")).toBe("");
    expect(itemArtRarity("fish")).toBe("common");
    expect(itemArtRarity("fish_fine")).toBe("uncommon");
    expect(itemArtRarity("fish_prime")).toBe("rare");
    expect(itemArtRarity("fish_golden")).toBe("legendary");
    expect(itemArtRarity("sea_king_meat")).toBe("sea-king");
    expect(itemRarityGlowClass("fish_golden")).toContain("shop-item-rarity--legendary");
  });

  it("maps stall portraits and aisle tabs to the new item art", () => {
    expect(itemIconSrc("rice_ball")).toBe("/icons/Items/Food_Rice.png");
    expect(itemIconSrc("bandage")).toBe("/icons/Items/Medicine_Bandage.png");
    expect(itemIconSrc("energy_tonic")).toBe("/icons/Items/Drinks_Energy.png");
    expect(MARKET_SHOP_TABS.map((tab) => tab.id)).toEqual(["all", "food", "drink", "medicine"]);
    expect(MARKET_SHOP_TABS.find((tab) => tab.id === "food")?.iconSrc).toBe("/icons/Items/Category_Food.png");
  });

  it("buys a good without leaving the map state", () => {
    const run = freshRun();
    const result = MarketShopService.buy(run, "rice_ball");
    expect(result.ok).toBe(true);
    expect(run.player.berries).toBe(175);
    expect(ItemService.countOwned(run, "rice_ball")).toBe(1);
  });

  it("refuses a buy the purse cannot cover", () => {
    const run = freshRun();
    run.player.berries = 10;
    const result = MarketShopService.buy(run, "energy_tonic");
    expect(result.ok).toBe(false);
    expect(ItemService.countOwned(run, "energy_tonic")).toBe(0);
    expect(run.player.berries).toBe(10);
  });

  it("buys back a sold catch at the stall rate", () => {
    const run = freshRun("sell-at-market");
    ItemService.grant(run, "fish", 1);
    const result = MarketShopService.sell(run, "fish");
    expect(result.ok).toBe(true);
    expect(ItemService.countOwned(run, "fish")).toBe(0);
    expect(run.player.berries).toBe(209);
  });

  it("buys a stack when the purse covers the total", () => {
    const run = freshRun();
    const result = MarketShopService.buy(run, "rice_ball", undefined, 3);
    expect(result.ok).toBe(true);
    expect(run.player.berries).toBe(125);
    expect(ItemService.countOwned(run, "rice_ball")).toBe(3);
  });

  it("sells a stack at the stall rate", () => {
    const run = freshRun("sell-stack");
    ItemService.grant(run, "fish", 3);
    const result = MarketShopService.sell(run, "fish", 2);
    expect(result.ok).toBe(true);
    expect(ItemService.countOwned(run, "fish")).toBe(1);
    expect(run.player.berries).toBe(218);
  });

  it("clamps trade quantities to what the purse or pack allows", () => {
    expect(marketBuyLimit(200, 25)).toBe(8);
    expect(clampMarketQuantity(10, 3)).toBe(3);
    expect(clampMarketQuantity(0, 8)).toBe(1);
    const run = freshRun();
    run.player.berries = 40;
    const result = MarketShopService.buy(run, "rice_ball", undefined, 3);
    expect(result.ok).toBe(false);
    expect(ItemService.countOwned(run, "rice_ball")).toBe(0);
    expect(run.player.berries).toBe(40);
  });
});
