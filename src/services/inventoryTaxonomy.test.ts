import { describe, expect, it } from "vitest";
import {
  classifyInventoryItem,
  inventorySubfiltersFor,
  matchesInventoryFilter,
  migrateInventoryCategory,
} from "../data/inventoryTaxonomy";
import { categorizeItem, ItemService, packItems } from "./ItemService";
import { createEmptyProfile, createRunState } from "../game/createGame";

function freshRun() {
  const profile = createEmptyProfile("inventory_taxonomy", "NORMAL");
  return createRunState(profile, {
    name: "Bowie",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

describe("inventory taxonomy", () => {
  it("maps legacy categories onto the seven pack groups", () => {
    expect(migrateInventoryCategory("TOOLS")).toBe("EQUIPMENT");
    expect(migrateInventoryCategory("MATERIALS")).toBe("RESOURCES");
    expect(migrateInventoryCategory("QUEST_ITEMS")).toBe("KEY_ITEMS");
    expect(migrateInventoryCategory("COLLECTABLES")).toBe("VALUABLES");
    expect(migrateInventoryCategory("DEVIL_FRUITS")).toBe("VALUABLES");
    expect(migrateInventoryCategory("MISCELLANEOUS")).toBe("VALUABLES");
  });

  it("keeps food, drinks, and medicine under Consumables", () => {
    expect(classifyInventoryItem(ItemService.createStack("dried_meat")!).category).toBe("CONSUMABLES");
    expect(classifyInventoryItem(ItemService.createStack("dried_meat")!).subtype).toBe("FOOD");
    expect(classifyInventoryItem(ItemService.createStack("energy_tonic")!).subtype).toBe("DRINK");
    expect(classifyInventoryItem(ItemService.createStack("bandage")!).subtype).toBe("HEALING_MEDICINE");
    expect(classifyInventoryItem(ItemService.createStack("antidote")!).subtype).toBe("STATUS_MEDICINE");
  });

  it("puts utility, knowledge, maps, and remnants in the new groups", () => {
    expect(categorizeItem(ItemService.createStack("smoke_bomb")!)).toBe("EQUIPMENT");
    expect(classifyInventoryItem(ItemService.createStack("smoke_bomb")!).subtype).toBe("UTILITY");
    expect(categorizeItem(ItemService.createStack("marine_field_manual")!)).toBe("KNOWLEDGE");
    expect(categorizeItem(ItemService.createStack("east_blue_chart")!)).toBe("KEY_ITEMS");
    expect(categorizeItem(ItemService.createStack("hardwood")!)).toBe("RESOURCES");
    expect(classifyInventoryItem(ItemService.createStack("hardwood")!).subtype).toBe("MATERIAL");
    expect(classifyInventoryItem(ItemService.createStack("rope_scrap")!).subtype).toBe("SHIP_SUPPLY");
    expect(categorizeItem(ItemService.createStack("fruitbound_remnant")!)).toBe("VALUABLES");
    expect(categorizeItem(ItemService.createStack("coral_charm")!)).toBe("VALUABLES");
    expect(categorizeItem(ItemService.createStack("forbidden_folio")!)).toBe("KEY_ITEMS");
  });

  it("includes former relics in the main pack under Valuables", () => {
    const run = freshRun();
    ItemService.grant(run, "coral_charm", 1);
    ItemService.grant(run, "dried_meat", 1);
    const valuables = packItems(run.player.inventory, "VALUABLES");
    expect(valuables.some((item) => item.itemId === "coral_charm")).toBe(true);
    expect(packItems(run.player.inventory, "CONSUMABLES").some((item) => item.itemId === "dried_meat")).toBe(true);
    expect(matchesInventoryFilter(valuables[0]!, "VALUABLES", "COLLECTABLE")).toBe(true);
  });

  it("shows live weapon families plus extras only when present", () => {
    const shown = inventorySubfiltersFor("WEAPONS", []);
    expect(shown).toContain("SWORD");
    expect(shown).toContain("BLUNT");
    expect(shown).not.toContain("TONTATTA");
  });
});
