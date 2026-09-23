import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import {
  CLINIC_SHOP_TABS,
  clinicSellPrice,
  clinicShopCatalog,
  clinicShopPrice,
  isClinicShopItem,
  matchesClinicTab,
} from "../data/clinicShop";
import { ItemService } from "./ItemService";
import { ClinicShopService } from "./ClinicShopService";
import type { RunState } from "../models/types";

function freshRun(seed = "clinic-shop"): RunState {
  const profile = createEmptyProfile("clinic_shop_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  run.player.berries = 400;
  return run;
}

describe("Clinic shop on the hub map", () => {
  it("sells clinic medicine at shop prices", () => {
    expect(clinicShopPrice("bandage")).toBe(70);
    expect(clinicShopPrice("medicine")).toBe(110);
    expect(clinicShopPrice("medical_kit")).toBe(180);
    expect(clinicShopPrice("antidote")).toBe(95);
    expect(clinicShopPrice("rice_ball")).toBeNull();
    expect(clinicShopCatalog().map((entry) => entry.itemId)).toEqual([
      "bandage",
      "medicine",
      "medical_kit",
      "strong_medicine",
      "antidote",
    ]);
  });

  it("only deals in medicine goods", () => {
    expect(isClinicShopItem("bandage")).toBe(true);
    expect(isClinicShopItem("grog")).toBe(false);
    expect(clinicSellPrice("bandage")).toBe(42);
    expect(clinicSellPrice("rice_ball")).toBeNull();
    expect(clinicShopCatalog().every((entry) => entry.aisle === "medicine")).toBe(true);
  });

  it("filters pack and shelves with All + Medicine tabs", () => {
    expect(matchesClinicTab("bandage", "all")).toBe(true);
    expect(matchesClinicTab("antidote", "medicine")).toBe(true);
    expect(CLINIC_SHOP_TABS.map((tab) => tab.id)).toEqual(["all", "medicine"]);
    expect(CLINIC_SHOP_TABS.find((tab) => tab.id === "medicine")?.iconSrc).toBe(
      "/icons/Items/Category_Medicine.png",
    );
  });

  it("buys a remedy without leaving the map state", () => {
    const run = freshRun();
    const result = ClinicShopService.buy(run, "bandage");
    expect(result.ok).toBe(true);
    expect(run.player.berries).toBe(330);
    expect(ItemService.countOwned(run, "bandage")).toBe(1);
  });

  it("refuses a buy the purse cannot cover", () => {
    const run = freshRun();
    run.player.berries = 20;
    const result = ClinicShopService.buy(run, "medical_kit");
    expect(result.ok).toBe(false);
    expect(ItemService.countOwned(run, "medical_kit")).toBe(0);
    expect(run.player.berries).toBe(20);
  });

  it("buys a stack when the purse covers the total", () => {
    const run = freshRun();
    const result = ClinicShopService.buy(run, "bandage", undefined, 3);
    expect(result.ok).toBe(true);
    expect(run.player.berries).toBe(190);
    expect(ItemService.countOwned(run, "bandage")).toBe(3);
  });

  it("sells only clinic goods at the stall rate", () => {
    const run = freshRun("clinic-sell");
    ItemService.grant(run, "antidote", 2);
    ItemService.grant(run, "rice_ball", 1);
    const food = ClinicShopService.sell(run, "rice_ball");
    expect(food.ok).toBe(false);
    const sold = ClinicShopService.sell(run, "antidote", 2);
    expect(sold.ok).toBe(true);
    expect(ItemService.countOwned(run, "antidote")).toBe(0);
    expect(run.player.berries).toBe(514);
  });

  it("clamps a stack buy the purse cannot cover", () => {
    const run = freshRun();
    run.player.berries = 100;
    const result = ClinicShopService.buy(run, "bandage", undefined, 3);
    expect(result.ok).toBe(false);
    expect(ItemService.countOwned(run, "bandage")).toBe(0);
    expect(run.player.berries).toBe(100);
  });
});
