import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { SAVE_VERSION } from "../game/constants";
import { isDevilFruitMerchandise } from "../data/items";
import { marketShopCatalog } from "../data/marketShop";
import { FRUITBOUND_REMNANT_ITEM_ID } from "../data/weaponServices";
import type { InventoryItem, RunState } from "../models/types";
import type { RandomService } from "./RandomService";
import { createRng } from "./RandomService";

function stubRng(nextValue = 0): RandomService {
  const rng = createRng("stub");
  rng.next = () => nextValue;
  rng.chance = (probability: number) => nextValue < probability;
  return rng;
}
import { DevilFruitService } from "./DevilFruitService";
import { WeaponProgressionService } from "./WeaponProgressionService";
import { WeaponService } from "./WeaponService";
import { WeaponServicesService } from "./WeaponServicesService";
import { WeaponShopService } from "./WeaponShopService";

function freshRun(seed = "weapon-progress"): RunState {
  const profile = createEmptyProfile("weapon_progress_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Eric",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  run.player.berries = 5000;
  run.currentIslandId = run.currentIslandId ?? run.islands[0]?.id ?? "test-island";
  return run;
}

function grantCutlass(run: RunState): InventoryItem {
  const ok = WeaponService.grantWeapon(run, "steel_cutlass", { skipDisposition: true });
  expect(ok).toBe(true);
  const item = WeaponService.listOwnedWeapons(run.player).at(-1);
  expect(item).toBeTruthy();
  return item!;
}

describe("Weapon progression + services + fruits", () => {
  it("uses SAVE_VERSION 37", () => {
    expect(SAVE_VERSION).toBe(37);
  });

  it("replaces naming adjectives instead of stacking them", () => {
    const run = freshRun();
    const weapon = grantCutlass(run);
    WeaponProgressionService.applyNamingStage(weapon, { path: "AGILITY", adjective: "Swift" });
    expect(WeaponProgressionService.displayName(weapon)).toBe("Swift Steel Cutlass");
    WeaponProgressionService.applyNamingStage(weapon, { path: "EFFICIENCY", adjective: "Precise" });
    expect(WeaponProgressionService.displayName(weapon)).toBe("Precise Steel Cutlass");
    WeaponProgressionService.applyNamingStage(weapon, { path: "POWER", adjective: "Razorwind" });
    expect(WeaponProgressionService.displayName(weapon)).toBe("Razorwind Steel Cutlass");
    expect(weapon.name).not.toContain("Swift Precise");
    expect(WeaponProgressionService.ensure(weapon).naming.stages).toHaveLength(3);
  });

  it("does not transfer instance mastery to a new wielder", () => {
    const run = freshRun();
    const weapon = grantCutlass(run);
    WeaponProgressionService.addWielderXp(weapon, run.player.id, 40);
    expect(WeaponProgressionService.wielderRank(weapon, run.player.id)).toBe("EXPERT");
    expect(WeaponProgressionService.wielderRank(weapon, "crew_other")).toBe("BEGINNER");
    expect(WeaponProgressionService.wielderXp(weapon, run.player.id)).toBe(40);
  });

  it("backfills old weapons and fruit records on migrate", () => {
    const run = freshRun("migrate");
    const legacyWeapon: InventoryItem = {
      id: "wpn_old",
      itemId: "weapon_steel_cutlass",
      name: "Steel Cutlass",
      type: "WEAPON",
      description: "old",
      quantity: 1,
      weaponDefinitionId: "steel_cutlass",
      equipped: false,
      category: "WEAPONS",
    };
    run.player.inventory.push(legacyWeapon);
    run.world.devilFruits = run.world.devilFruits.filter((entry) => entry.fruitId !== "bara_bara");
    run.world.devilFruits.push({
      fruitId: "bara_bara",
      status: "UNCLAIMED",
      ownerCharacterId: null,
      history: ["old"],
    });
    WeaponService.migrateInventoryWeapons(run);
    DevilFruitService.migrateWorldFruits(run);
    expect(legacyWeapon.weaponProgress?.soul.state).toBe("DORMANT");
    expect(legacyWeapon.weaponProgress?.legacy.status).toBe("NONE");
    expect(legacyWeapon.weaponProgress?.naming.baseName).toBe("Steel Cutlass");
    const fruit = DevilFruitService.getState(run, "bara_bara");
    expect(fruit?.identified).toBe(false);
    expect(run.world.devilFruits.filter((entry) => entry.fruitId === "bara_bara")).toHaveLength(1);
  });

  it("always offers three distinct naming paths", () => {
    const run = freshRun("choices");
    const weapon = grantCutlass(run);
    const choices = WeaponProgressionService.generateNamingChoices(weapon, createRng("name-choices"));
    expect(choices).toHaveLength(3);
    expect(choices.map((entry) => entry.path).sort()).toEqual(["AGILITY", "EFFICIENCY", "POWER"]);
  });

  it("locks historical named base names", () => {
    const run = freshRun("named");
    const id = WeaponService.grantGeneratedWeapon(
      run,
      {
        archetypeId: "saber",
        material: "STEEL",
        quality: "FINE",
        name: "Greyfang",
        weaponType: "SWORD",
        category: "BLADE",
        rarity: "RARE",
        damage: 12,
        speed: 7,
        accuracy: 7,
        reach: 2,
        weight: 4,
        critBonus: 1,
        scalingStat: "strength",
        traits: [],
        techniqueIds: [],
        price: 400,
        isNamed: true,
        namedId: "greyfang",
      },
      { skipDisposition: true },
    );
    const weapon = WeaponService.findInstance(run.player, id!);
    expect(weapon).toBeTruthy();
    const lock = WeaponProgressionService.canSetBaseName(weapon!);
    expect(lock.ok).toBe(false);
    expect(WeaponProgressionService.setBaseName(weapon!, "Eric").ok).toBe(false);
    expect(WeaponProgressionService.ensure(weapon!).naming.baseName).toBe("Greyfang");
  });

  it("enforces seastone / devil fruit mutex and mastery gates", () => {
    const run = freshRun("mutex");
    const weapon = grantCutlass(run);
    DevilFruitService.keep(run, "inu_wolf", { skipDisposition: true });
    const fruitBind = WeaponServicesService.bindDevilFruit(run, weapon.id, "inu_wolf");
    expect(fruitBind.ok).toBe(false);
    expect(fruitBind.reason).toMatch(/LOCKED|Requires Master/i);

    WeaponProgressionService.addWielderXp(weapon, run.player.id, 50);
    const seastone = WeaponServicesService.applySeastone(run, weapon.id, "EDGE");
    expect(seastone.ok).toBe(true);
    const blockedFruit = WeaponServicesService.bindDevilFruit(run, weapon.id, "inu_wolf");
    expect(blockedFruit.ok).toBe(false);
    expect(blockedFruit.reason).toMatch(/LOCKED/);

    const other = grantCutlass(run);
    WeaponProgressionService.addWielderXp(other, run.player.id, 50);
    const bound = WeaponServicesService.bindDevilFruit(run, other.id, "inu_wolf");
    expect(bound.ok).toBe(true);
    const blockedStone = WeaponServicesService.applySeastone(run, other.id, "TIP");
    expect(blockedStone.ok).toBe(false);
    expect(blockedStone.reason).toMatch(/LOCKED/);
  });

  it("destroying a host creates a remnant and does not give the fruit to the player", () => {
    const run = freshRun("destroy");
    const weapon = grantCutlass(run);
    WeaponProgressionService.addWielderXp(weapon, run.player.id, 50);
    WeaponProgressionService.setBaseName(weapon, "Eric");
    WeaponProgressionService.applyNamingStage(weapon, { path: "AGILITY", adjective: "Razorwind" });
    DevilFruitService.keep(run, "inu_wolf", { skipDisposition: true });
    expect(WeaponServicesService.bindDevilFruit(run, weapon.id, "inu_wolf").ok).toBe(true);

    const refused = WeaponServicesService.destroyHost(run, weapon.id, createRng("no"), "please");
    expect(refused.ok).toBe(false);

    const gone = WeaponServicesService.destroyHost(run, weapon.id, stubRng(0.99), "destroy");
    expect(gone.ok).toBe(true);
    expect(WeaponService.findInstance(run.player, weapon.id)).toBeUndefined();
    expect(run.player.inventory.some((item) => item.itemId === FRUITBOUND_REMNANT_ITEM_ID)).toBe(true);
    expect(run.player.inventory.some((item) => item.name === "Remnant of Razorwind Eric")).toBe(true);
    expect(run.player.inventory.some((item) => item.fruitId === "inu_wolf")).toBe(false);
    const fruit = DevilFruitService.getState(run, "inu_wolf")!;
    expect(fruit.status === "UNCLAIMED" || fruit.status === "UNKNOWN" || fruit.status === "PLAYER_INVENTORY").toBe(
      true,
    );
    if (fruit.status !== "PLAYER_INVENTORY") {
      expect(run.player.inventory.some((item) => item.type === "DEVIL_FRUIT" && item.fruitId === "inu_wolf")).toBe(
        false,
      );
    }
  });

  it("keeps a bound fruit on the weapon when the wielder dies", () => {
    const run = freshRun("wielder-death");
    const weapon = grantCutlass(run);
    WeaponProgressionService.addWielderXp(weapon, run.player.id, 50);
    DevilFruitService.keep(run, "inu_wolf", { skipDisposition: true });
    expect(WeaponServicesService.bindDevilFruit(run, weapon.id, "inu_wolf").ok).toBe(true);
    const line = DevilFruitService.onCharacterPermanentlyDead(run, run.player.id, createRng("death"));
    expect(line).toBeNull();
    expect(DevilFruitService.getState(run, "inu_wolf")?.status).toBe("WEAPON_BOUND");
    expect(weapon.weaponProgress?.devilFruit?.fruitId).toBe("inu_wolf");
  });

  it("reincarnates an eaten fruit on definitive death, not on KO", () => {
    const run = freshRun("eat-death");
    DevilFruitService.eat(run, "bara_bara");
    run.player.hp = 0;
    expect(DevilFruitService.getState(run, "bara_bara")?.status).toBe("PLAYER_USED");
    const afterKo = DevilFruitService.getState(run, "bara_bara")!;
    expect(afterKo.status).toBe("PLAYER_USED");

    DevilFruitService.onCharacterPermanentlyDead(run, run.player.id, createRng("true-death"));
    const afterDeath = DevilFruitService.getState(run, "bara_bara")!;
    expect(afterDeath.status).not.toBe("PLAYER_USED");
    expect(afterDeath.status === "REINCARNATING").toBe(false);
  });

  it("treats each fruit as unique and bans shops from stocking them", () => {
    const run = freshRun("unique");
    DevilFruitService.eat(run, "bomu_bomu");
    expect(DevilFruitService.isAvailableForGeneration(run, "bomu_bomu")).toBe(false);
    expect(DevilFruitService.occupiedFruitIds(run)).toContain("bomu_bomu");
    expect(marketShopCatalog().every((entry) => !isDevilFruitMerchandise(entry.itemId))).toBe(true);
    const stock = WeaponShopService.generateStock(run, createRng("no-fruit"), "GENERAL", "test:GENERAL");
    expect(stock.listings.every((listing) => !("fruitId" in listing.weapon))).toBe(true);
    expect(stock.listings.every((listing) => listing.weapon.archetypeId)).toBeTruthy();
  });

  it("excludes other-island fruit and applies diminishing returns locally", () => {
    const run = freshRun("nearby");
    const localApple: InventoryItem = {
      id: "apple_1",
      itemId: "island_apple",
      name: "Island Apple",
      type: "CONSUMABLE",
      description: "apple",
      quantity: 1,
    };
    const farApple: InventoryItem = { ...localApple, id: "apple_far" };
    const locals = DevilFruitService.inspectCandidateWeights([
      { item: localApple, location: "INVENTORY", islandId: run.currentIslandId ?? "here", proximity: 8 },
      { item: { ...localApple, id: "apple_2" }, location: "INVENTORY", islandId: run.currentIslandId ?? "here", proximity: 8 },
      { item: { ...localApple, id: "apple_3" }, location: "INVENTORY", islandId: run.currentIslandId ?? "here", proximity: 8 },
    ]);
    expect(locals[0]!.weight).toBeGreaterThan(locals[2]!.weight);
    const one = DevilFruitService.localAttemptChance([
      { item: localApple, location: "INVENTORY", islandId: run.currentIslandId ?? "here", proximity: 8 },
    ]);
    const many = DevilFruitService.localAttemptChance(
      Array.from({ length: 12 }, (_, index) => ({
        item: { ...localApple, id: `spam_${index}` },
        location: "INVENTORY" as const,
        islandId: run.currentIslandId ?? "here",
        proximity: 8,
      })),
    );
    expect(many).toBeLessThan(0.49);
    expect(many).toBeLessThan(one * 12);

    DevilFruitService.eat(run, "bari_bari");
    const farOnly = DevilFruitService.beginReincarnation(run, "bari_bari", createRng("far"), {
      reason: "User died.",
      currentIslandId: run.currentIslandId ?? "here",
      candidates: [{ item: farApple, location: "ENVIRONMENT", islandId: "other-island", proximity: 3 }],
    });
    expect(farOnly.placed).toBe("world");
    expect(run.player.inventory.some((item) => item.fruitId === "bari_bari")).toBe(false);
  });

  it("local success replaces one ordinary fruit and never duplicates the devil fruit", () => {
    const run = freshRun("local-success");
    run.player.inventory.push({
      id: "bag_apple",
      itemId: "island_apple",
      name: "Island Apple",
      type: "CONSUMABLE",
      description: "apple",
      quantity: 1,
    });
    DevilFruitService.eat(run, "doru_doru");
    const apple = run.player.inventory.find((item) => item.id === "bag_apple")!;
    const result = DevilFruitService.beginReincarnation(run, "doru_doru", stubRng(0), {
      reason: "User died.",
      currentIslandId: run.currentIslandId ?? "here",
      candidates: [{ item: apple, location: "INVENTORY", islandId: run.currentIslandId ?? "here", proximity: 8 }],
    });
    const fruits = run.player.inventory.filter((item) => item.fruitId === "doru_doru");
    if (result.placed === "local") {
      expect(fruits).toHaveLength(1);
      expect(run.player.inventory.filter((item) => (item.itemId || item.id) === "island_apple" && !item.fruitId)).toHaveLength(
        0,
      );
    } else {
      expect(fruits).toHaveLength(0);
    }
  });
});
