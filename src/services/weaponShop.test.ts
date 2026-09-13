import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { WEAPON_ARCHETYPES } from "../data/weaponArchetypes";
import type { RunState, WeaponShopTheme } from "../models/types";
import { createRng } from "./RandomService";
import { WeaponGenerationService } from "./WeaponGenerationService";
import { WeaponShopService } from "./WeaponShopService";
import { WeaponService } from "./WeaponService";

function freshRun(day = 5): RunState {
  const profile = createEmptyProfile("weapon_shop_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.day = day;
  run.player.berries = 5000;
  run.seed = "weapon-shop-test";
  return run;
}

describe("WeaponShopService", () => {
  it("generates more than 2 weapons for a normal shop", () => {
    const run = freshRun();
    const stock = WeaponShopService.generateStock(run, createRng("shop-size"), "GENERAL", "test:GENERAL");
    expect(stock.listings.length).toBeGreaterThanOrEqual(5);
    expect(stock.listings.length).toBeLessThanOrEqual(8);
  });

  it("keeps category diversity in a general shop", () => {
    const run = freshRun();
    const stock = WeaponShopService.generateStock(run, createRng("shop-diversity"), "GENERAL", "test:GENERAL");
    const categories = new Set(stock.listings.map((entry) => entry.weapon.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  it("persists stock when reopening before refresh day", () => {
    const run = freshRun(3);
    const first = WeaponShopService.ensureStock(run, createRng("shop-persist"), { theme: "GENERAL" });
    const second = WeaponShopService.ensureStock(run, createRng("shop-persist-other"), { theme: "GENERAL" });
    expect(second.listings.map((entry) => entry.listingId)).toEqual(
      first.listings.map((entry) => entry.listingId),
    );
  });

  it("refreshes stock after configured days", () => {
    const run = freshRun(3);
    const first = WeaponShopService.ensureStock(run, createRng("refresh-a"), { theme: "GENERAL" });
    run.day = first.refreshOnDay;
    const second = WeaponShopService.ensureStock(run, createRng("refresh-b"), { theme: "GENERAL" });
    expect(second.generatedOnDay).toBe(run.day);
    expect(second.listings[0]?.listingId).not.toBe(first.listings[0]?.listingId);
  });

  it("specialist shops respect specialization", () => {
    const run = freshRun();
    const stock = WeaponShopService.generateStock(run, createRng("blade"), "BLADE_SMITH", "test:BLADE_SMITH");
    expect(stock.listings.every((entry) => entry.weapon.category === "BLADE" || entry.weapon.isNamed)).toBe(true);
  });

  it("applies anti-repeat pressure to recent archetypes", () => {
    const run = freshRun();
    run.recentShopWeaponKeys = Array.from({ length: 8 }, () => "club:WOOD:STANDARD");
    const weights = WeaponShopService.inspectWeights(run, "GENERAL");
    const club = weights.find((entry) => entry.archetypeId === "club");
    const saber = weights.find((entry) => entry.archetypeId === "saber");
    expect(club && saber).toBeTruthy();
    expect(club!.weight).toBeLessThan(saber!.weight);
  });

  it("buying adds to inventory without auto-equip", () => {
    const run = freshRun();
    run.player.berries = 9999;
    const stock = WeaponShopService.ensureStock(run, createRng("buy"), { theme: "GENERAL" });
    const listing = stock.listings[0]!;
    const beforeEquip = run.player.equipment?.primaryWeaponId ?? null;
    const result = WeaponShopService.purchase(run, stock.shopKey, listing.listingId);
    expect(result.ok).toBe(true);
    expect(run.player.inventory.some((item) => item.id === result.instanceId)).toBe(true);
    expect(run.player.equipment?.primaryWeaponId ?? null).toBe(beforeEquip);
    const bought = run.player.inventory.find((item) => item.id === result.instanceId);
    expect(bought?.equipped).toBe(false);
    expect(bought?.generatedWeapon?.name).toBe(listing.weapon.name);
  });

  it("swapping weapons preserves the previous item", () => {
    const run = freshRun();
    const a = WeaponGenerationService.generate(createRng("swap-a"), { archetypeId: "saber" });
    const b = WeaponGenerationService.generate(createRng("swap-b"), { archetypeId: "rapier" });
    const idA = WeaponService.grantGeneratedWeapon(run, a, { skipDisposition: true })!;
    const idB = WeaponService.grantGeneratedWeapon(run, b, { skipDisposition: true })!;
    WeaponService.equipInstance(run, idA);
    WeaponService.equipInstance(run, idB);
    const first = WeaponService.findInstance(run.player, idA);
    const second = WeaponService.findInstance(run.player, idB);
    expect(first?.equipped).toBe(false);
    expect(second?.equipped).toBe(true);
    expect(run.player.inventory.filter((item) => item.type === "WEAPON").length).toBe(2);
  });
});

describe("WeaponGenerationService", () => {
  it("supports a large expandable archetype pool", () => {
    expect(WEAPON_ARCHETYPES.length).toBeGreaterThanOrEqual(30);
  });

  it("keeps named weapons uncommon across many general shops", () => {
    const run = freshRun();
    let named = 0;
    for (let i = 0; i < 20; i += 1) {
      const stock = WeaponShopService.generateStock(
        run,
        createRng(`named-${i}`),
        "GENERAL" satisfies WeaponShopTheme,
        `test:GENERAL:${i}`,
      );
      named += stock.listings.filter((entry) => entry.weapon.isNamed).length;
    }
    expect(named).toBeLessThan(12);
  });
});
