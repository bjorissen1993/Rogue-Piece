import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { WEAPON_ARCHETYPES } from "../data/weaponArchetypes";
import type { RunState, WeaponShopTheme } from "../models/types";
import { createRng } from "./RandomService";
import { WeaponGenerationService } from "./WeaponGenerationService";
import {
  WEAPON_SHOP_TABS,
  matchesWeaponTab,
  weaponCategoryTitle,
  weaponIconSrc,
  weaponShopRarityGlow,
} from "../data/weaponShopUi";
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

describe("Weapon shop overlay catalog", () => {
  it("tabs All plus weapon-type icons", () => {
    expect(WEAPON_SHOP_TABS.map((tab) => tab.id)).toEqual([
      "all",
      "BLADE",
      "POLEARM",
      "BLUNT",
      "RANGED",
      "UNUSUAL",
    ]);
    expect(WEAPON_SHOP_TABS.find((tab) => tab.id === "BLADE")?.iconSrc).toBe("/icons/Weapons/Weapon_Sword.png");
    expect(weaponCategoryTitle("POLEARM")).toBe("Polearm");
    expect(matchesWeaponTab("BLADE", "all")).toBe(true);
    expect(matchesWeaponTab("BLADE", "BLUNT")).toBe(false);
  });

  it("maps archetypes to weapon art and rarity glow", () => {
    expect(weaponIconSrc({ archetypeId: "cutlass", category: "BLADE" })).toBe("/icons/Weapons/Weapon_Sword.png");
    expect(weaponIconSrc({ archetypeId: "greatsword", category: "BLADE" })).toBe(
      "/icons/Weapons/Weapon_Sword_2Handed.png",
    );
    expect(weaponIconSrc({ archetypeId: "axe", category: "UNUSUAL" })).toBe("/icons/Weapons/Weapon_Axe.png");
    expect(weaponIconSrc({ archetypeId: "pistol", category: "RANGED" })).toBe("/icons/Weapons/Weapon_Pistol.png");
    expect(weaponShopRarityGlow("LEGENDARY")).toContain("shop-item-rarity--legendary");
    expect(weaponShopRarityGlow("RARE", "SEA_STONE_ALLOY")).toContain("shop-item-rarity--sea-king");
  });

  it("buys a unique listing and sells an owned weapon", () => {
    const run = freshRun();
    run.player.berries = 9999;
    const stock = WeaponShopService.ensureStock(run, createRng("overlay-buy"), { theme: "GENERAL" });
    const listing = stock.listings[0]!;
    const bought = WeaponShopService.purchase(run, stock.shopKey, listing.listingId);
    expect(bought.ok).toBe(true);
    expect(bought.instanceId).toBeTruthy();
    expect(WeaponShopService.availableListings(stock).some((entry) => entry.listingId === listing.listingId)).toBe(
      false,
    );
    const sold = WeaponShopService.sellOwned(run, bought.instanceId!);
    expect(sold.ok).toBe(true);
    expect(run.player.inventory.some((item) => item.id === bought.instanceId)).toBe(false);
  });
});
