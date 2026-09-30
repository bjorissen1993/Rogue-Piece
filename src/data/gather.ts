import type { GatherCategoryWeights, GatherDetectionCategory, GatherSlotCategory, ItemRarity } from "../models/types";

export const GATHER_ATTEMPTS = 3;
export const GATHER_SLOT_COUNT = 8;

export const GATHER_CATEGORY_WEIGHTS: GatherCategoryWeights = {
  resource: 82,
  food: 8,
  item: 4,
  information: 2,
  equipment: 2,
  special: 2,
};

export type GatherResourceDef = {
  itemId: string;
  category: GatherSlotCategory;
  rarity: ItemRarity;
  tags: string[];
  detection: GatherDetectionCategory[];
};

export const GATHER_RESOURCES: GatherResourceDef[] = [
  { itemId: "hardwood", category: "RESOURCE", rarity: "COMMON", tags: ["woodland", "natural", "vegetation"], detection: ["fiber"] },
  { itemId: "fiber", category: "RESOURCE", rarity: "COMMON", tags: ["vegetation", "woodland", "fiber"], detection: ["fiber"] },
  { itemId: "stone", category: "RESOURCE", rarity: "COMMON", tags: ["rocky", "mineral-rich"], detection: ["stone"] },
  { itemId: "copper_ore", category: "RESOURCE", rarity: "UNCOMMON", tags: ["rocky", "mineral-rich", "volcanic"], detection: ["ore", "minerals"] },
  { itemId: "iron_ore", category: "RESOURCE", rarity: "UNCOMMON", tags: ["rocky", "mineral-rich"], detection: ["ore", "minerals"] },
  { itemId: "resin", category: "RESOURCE", rarity: "COMMON", tags: ["woodland", "vegetation"], detection: ["resin", "fiber"] },
  { itemId: "clay", category: "RESOURCE", rarity: "COMMON", tags: ["wetland", "coastal"], detection: ["stone"] },
  { itemId: "coal", category: "RESOURCE", rarity: "UNCOMMON", tags: ["rocky", "mineral-rich"], detection: ["ore", "minerals"] },
  { itemId: "salt", category: "RESOURCE", rarity: "COMMON", tags: ["coastal", "ships"], detection: ["minerals"] },
  { itemId: "medicinal_herb", category: "RESOURCE", rarity: "UNCOMMON", tags: ["vegetation", "medicinal plants", "wetland"], detection: ["herbs", "plants"] },
  { itemId: "rare_mushroom", category: "RESOURCE", rarity: "RARE", tags: ["fungi", "wetland", "woodland"], detection: ["fungi"] },
  { itemId: "seeds", category: "RESOURCE", rarity: "COMMON", tags: ["vegetation", "food"], detection: ["berries", "plants"] },
  { itemId: "biological_material", category: "RESOURCE", rarity: "UNCOMMON", tags: ["wildlife", "natural"], detection: ["plants"] },
  { itemId: "sulfur", category: "RESOURCE", rarity: "RARE", tags: ["volcanic", "hazardous"], detection: ["minerals"] },
  { itemId: "obsidian_shard", category: "RESOURCE", rarity: "RARE", tags: ["volcanic", "rocky"], detection: ["stone", "minerals"] },
  { itemId: "reeds", category: "RESOURCE", rarity: "COMMON", tags: ["wetland"], detection: ["fiber", "plants"] },
  { itemId: "rope_scrap", category: "RESOURCE", rarity: "COMMON", tags: ["coastal", "ships", "cargo"], detection: ["scrap"] },
];

export const GATHER_FOOD: GatherResourceDef[] = [
  { itemId: "island_apple", category: "FOOD", rarity: "COMMON", tags: ["vegetation", "food"], detection: ["berries", "plants"] },
  { itemId: "wild_banana", category: "FOOD", rarity: "COMMON", tags: ["vegetation", "food"], detection: ["berries"] },
];

export const GATHER_UNUSUAL: GatherResourceDef[] = [
  { itemId: "abandoned_backpack", category: "ITEM", rarity: "UNCOMMON", tags: ["travel", "isolated"], detection: ["containers", "scrap"] },
  { itemId: "washed_up_crate", category: "SPECIAL", rarity: "RARE", tags: ["coastal", "wreckage-compatible"], detection: ["containers"] },
  { itemId: "buried_box", category: "SPECIAL", rarity: "RARE", tags: ["isolated", "natural"], detection: ["containers"] },
  { itemId: "torn_document", category: "INFORMATION", rarity: "UNCOMMON", tags: ["official", "faction-visible"], detection: ["documents"] },
  { itemId: "smoke_bomb", category: "EQUIPMENT", rarity: "UNCOMMON", tags: ["criminal activity", "ambush-compatible"], detection: ["scrap"] },
];

export const GATHER_CONTAINERS = new Set(["abandoned_backpack", "washed_up_crate", "buried_box"]);

export const GATHER_CONTAINER_LOOT: Record<string, Array<{ itemId: string; quantity: number }>> = {
  abandoned_backpack: [
    { itemId: "fiber", quantity: 2 },
    { itemId: "rice_ball", quantity: 1 },
    { itemId: "bandage", quantity: 1 },
  ],
  washed_up_crate: [
    { itemId: "rope_scrap", quantity: 2 },
    { itemId: "salt", quantity: 1 },
    { itemId: "hardwood", quantity: 1 },
  ],
  buried_box: [
    { itemId: "stone", quantity: 1 },
    { itemId: "copper_ore", quantity: 1 },
    { itemId: "torn_document", quantity: 1 },
  ],
};

export const GATHER_EQUIPMENT: Array<{
  itemId: string;
  detection: GatherDetectionCategory[];
  extract: GatherDetectionCategory[];
  bonus: number;
}> = [
  { itemId: "herbalist_kit", detection: ["herbs", "fungi", "plants"], extract: ["herbs", "fungi", "plants"], bonus: 1 },
  { itemId: "prospecting_kit", detection: ["ore", "stone", "minerals"], extract: ["ore", "stone", "minerals"], bonus: 1 },
  { itemId: "foraging_basket", detection: ["berries", "plants"], extract: ["berries", "plants"], bonus: 1 },
  { itemId: "field_knife", detection: ["fiber", "resin"], extract: ["fiber", "resin"], bonus: 1 },
  { itemId: "scavenging_tools", detection: ["scrap", "containers"], extract: ["containers", "scrap"], bonus: 1 },
  { itemId: "investigation_kit", detection: ["documents"], extract: ["documents"], bonus: 0 },
];

export const GATHER_RICHNESS_ORDER = ["DEPLETED", "SPARSE", "NORMAL", "RICH"] as const;
