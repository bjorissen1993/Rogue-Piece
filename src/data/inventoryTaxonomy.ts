import type {
  InventoryCategory,
  InventoryItem,
  InventorySubtype,
  ItemDefinition,
  WeaponType,
} from "../models/types";
import { getItemDefinition } from "./items";
import { getWeapon } from "./weapons";

export type InventoryClass = {
  category: Exclude<InventoryCategory, "ALL">;
  subtype?: InventorySubtype;
};

const MAIN_CATEGORIES: Exclude<InventoryCategory, "ALL">[] = [
  "CONSUMABLES",
  "EQUIPMENT",
  "KNOWLEDGE",
  "KEY_ITEMS",
  "VALUABLES",
  "RESOURCES",
  "WEAPONS",
];

const LEGACY_CATEGORY_MAP: Record<string, Exclude<InventoryCategory, "ALL">> = {
  ALL: "VALUABLES",
  WEAPONS: "WEAPONS",
  DEVIL_FRUITS: "VALUABLES",
  CONSUMABLES: "CONSUMABLES",
  TOOLS: "EQUIPMENT",
  EQUIPMENT: "EQUIPMENT",
  MATERIALS: "RESOURCES",
  RESOURCES: "RESOURCES",
  QUEST_ITEMS: "KEY_ITEMS",
  KEY_ITEMS: "KEY_ITEMS",
  COLLECTABLES: "VALUABLES",
  MISCELLANEOUS: "VALUABLES",
  KNOWLEDGE: "KNOWLEDGE",
  VALUABLES: "VALUABLES",
};

const ITEM_CLASS_OVERRIDES: Record<string, InventoryClass> = {
  smoke_bomb: { category: "EQUIPMENT", subtype: "UTILITY" },
  dirty_rag: { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" },
  bandage: { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" },
  medicine: { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" },
  medical_kit: { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" },
  strong_medicine: { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" },
  miracle_salve: { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" },
  phoenix_tear: { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" },
  antidote: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  burn_salve: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  stitch_kit: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  eye_wash: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  smelling_salts: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  calming_tonic: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  anti_nausea: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  status_remover_kit: { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" },
  east_blue_chart: { category: "KEY_ITEMS", subtype: "TREASURE_MAP" },
  forbidden_folio: { category: "KEY_ITEMS", subtype: "STORY" },
  sea_king_meat: { category: "KEY_ITEMS", subtype: "QUEST" },
  rusty_cutlass: { category: "VALUABLES", subtype: "TREASURE" },
  marine_breastplate: { category: "VALUABLES", subtype: "CONTRABAND" },
  fishman_scale: { category: "VALUABLES", subtype: "TREASURE" },
  sky_island_fragment: { category: "VALUABLES", subtype: "TREASURE" },
  ancient_gear_diagram: { category: "KNOWLEDGE", subtype: "DOCUMENT" },
  marine_field_manual: { category: "KNOWLEDGE", subtype: "MANUAL" },
  ancient_navigation_journal: { category: "KNOWLEDGE", subtype: "MANUAL" },
  wanted_poster_scrap: { category: "KNOWLEDGE", subtype: "INTEL" },
  old_bounty_ledger: { category: "KNOWLEDGE", subtype: "INTEL" },
  torn_document: { category: "KNOWLEDGE", subtype: "DOCUMENT" },
  coral_charm: { category: "VALUABLES", subtype: "COLLECTABLE" },
  fruitbound_remnant: { category: "VALUABLES", subtype: "COLLECTABLE" },
  biological_material: { category: "VALUABLES", subtype: "CONTRABAND" },
  abandoned_backpack: { category: "VALUABLES", subtype: "TREASURE" },
  washed_up_crate: { category: "VALUABLES", subtype: "TREASURE" },
  buried_box: { category: "VALUABLES", subtype: "TREASURE" },
  herbalist_kit: { category: "EQUIPMENT", subtype: "EXPLORATION" },
  prospecting_kit: { category: "EQUIPMENT", subtype: "EXPLORATION" },
  foraging_basket: { category: "EQUIPMENT", subtype: "EXPLORATION" },
  field_knife: { category: "EQUIPMENT", subtype: "EXPLORATION" },
  scavenging_tools: { category: "EQUIPMENT", subtype: "TOOLS" },
  investigation_kit: { category: "EQUIPMENT", subtype: "EXPLORATION" },
  rope_scrap: { category: "RESOURCES", subtype: "SHIP_SUPPLY" },
};

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  ALL: "All",
  CONSUMABLES: "Consumables",
  EQUIPMENT: "Equipment",
  KNOWLEDGE: "Knowledge",
  KEY_ITEMS: "Key Items",
  VALUABLES: "Valuables",
  RESOURCES: "Resources",
  WEAPONS: "Weapons",
};

export const INVENTORY_CATEGORY_TITLES: Record<InventoryCategory, string> = {
  ALL: "All",
  CONSUMABLES: "Consumables",
  EQUIPMENT: "Equipment",
  KNOWLEDGE: "Knowledge & Identity",
  KEY_ITEMS: "Key Items",
  VALUABLES: "Valuables & Contraband",
  RESOURCES: "Resources",
  WEAPONS: "Weapons",
};

export const INVENTORY_SUBTYPE_LABELS: Record<InventorySubtype, string> = {
  FOOD: "Food",
  DRINK: "Drinks",
  HEALING_MEDICINE: "Healing",
  STATUS_MEDICINE: "Status",
  UTILITY: "Utility",
  EXPLORATION: "Exploration",
  TOOLS: "Tools",
  TRAINING: "Training",
  BOOK: "Books",
  MANUAL: "Manuals",
  DOCUMENT: "Documents",
  INTEL: "Intel",
  IDENTITY: "Identity",
  QUEST: "Quest",
  TREASURE_MAP: "Maps",
  STORY: "Story",
  TREASURE: "Treasure",
  COLLECTABLE: "Collectables",
  TRADE_GOODS: "Trade Goods",
  CONTRABAND: "Contraband",
  DEVIL_FRUIT: "Devil Fruits",
  MATERIAL: "Materials",
  SHIP_SUPPLY: "Ship Supplies",
  SHIP_COMPONENT: "Ship Components",
  SWORD: "Swords",
  BLUNT: "Blunt",
  AXE: "Axes",
  POLEARM: "Polearms",
  FIREARM: "Firearms",
  HEAVY_RANGED: "Heavy Ranged",
  THROWING: "Throwing",
  FLEXIBLE: "Flexible",
  DEFENSIVE: "Defensive",
  SPECIAL: "Special",
  IMPROVISED: "Improvised",
  MUSICAL: "Musical",
  TECH: "Tech",
  MEDICAL: "Medical",
  GIANT: "Giant",
  TONTATTA: "Tontatta",
};

export const INVENTORY_CATEGORIES: InventoryCategory[] = ["ALL", ...MAIN_CATEGORIES];

export const INVENTORY_FILTER_CATEGORIES: Exclude<InventoryCategory, "ALL">[] = [...MAIN_CATEGORIES];

export const INVENTORY_SUBFILTERS: Record<Exclude<InventoryCategory, "ALL">, InventorySubtype[]> = {
  CONSUMABLES: ["FOOD", "DRINK", "HEALING_MEDICINE", "STATUS_MEDICINE"],
  EQUIPMENT: ["UTILITY", "EXPLORATION", "TOOLS", "TRAINING"],
  KNOWLEDGE: ["BOOK", "MANUAL", "DOCUMENT", "INTEL", "IDENTITY"],
  KEY_ITEMS: ["QUEST", "TREASURE_MAP", "STORY"],
  VALUABLES: ["TREASURE", "COLLECTABLE", "TRADE_GOODS", "CONTRABAND", "DEVIL_FRUIT"],
  RESOURCES: ["MATERIAL", "SHIP_SUPPLY", "SHIP_COMPONENT"],
  WEAPONS: [
    "SWORD",
    "BLUNT",
    "AXE",
    "POLEARM",
    "FIREARM",
    "HEAVY_RANGED",
    "THROWING",
    "FLEXIBLE",
    "DEFENSIVE",
    "SPECIAL",
    "IMPROVISED",
    "MUSICAL",
    "TECH",
    "MEDICAL",
    "GIANT",
    "TONTATTA",
  ],
};

const LIVE_WEAPON_SUBTYPES: InventorySubtype[] = ["SWORD", "BLUNT", "POLEARM", "FIREARM", "IMPROVISED"];

export function isInventoryCategory(value: string | undefined): value is Exclude<InventoryCategory, "ALL"> {
  return Boolean(value && (MAIN_CATEGORIES as string[]).includes(value));
}

export function migrateInventoryCategory(
  value: string | undefined,
): Exclude<InventoryCategory, "ALL"> | undefined {
  if (!value) {
    return undefined;
  }
  return LEGACY_CATEGORY_MAP[value];
}

export function weaponInventorySubtype(weaponType: WeaponType | undefined): InventorySubtype | undefined {
  if (weaponType === "SWORD") return "SWORD";
  if (weaponType === "CLUB") return "BLUNT";
  if (weaponType === "SPEAR") return "POLEARM";
  if (weaponType === "GUN") return "FIREARM";
  if (weaponType === "FISTS" || weaponType === "KICKS") return "IMPROVISED";
  return undefined;
}

function definitionIdOf(item: Pick<InventoryItem, "id" | "itemId">): string {
  return item.itemId || item.id;
}

function consumableClass(itemId: string, def: ItemDefinition | undefined): InventoryClass {
  const override = ITEM_CLASS_OVERRIDES[itemId];
  if (override) {
    return override;
  }
  if (def?.effects.some((effect) => effect.type === "CLEAR_AFFLICTION")) {
    return { category: "CONSUMABLES", subtype: "STATUS_MEDICINE" };
  }
  if (/water|grog|juice|brew|dregs|beer|rum|wine|tonic/.test(itemId) && itemId !== "calming_tonic") {
    return { category: "CONSUMABLES", subtype: "DRINK" };
  }
  if (/rag|bandage|medicine|salve|kit|antidote|tear|wash|salts|nausea/.test(itemId)) {
    return { category: "CONSUMABLES", subtype: "HEALING_MEDICINE" };
  }
  return { category: "CONSUMABLES", subtype: "FOOD" };
}

function inferFromText(hay: string): InventoryClass | null {
  if (/forged|fake|false|counterfeit|permit|identity|papers/.test(hay)) {
    return { category: "KNOWLEDGE", subtype: "IDENTITY" };
  }
  if (/rumor|intel|informant|patrol schedule|faction/.test(hay)) {
    return { category: "KNOWLEDGE", subtype: "INTEL" };
  }
  if (/manual|technique book|journal/.test(hay)) {
    return { category: "KNOWLEDGE", subtype: "MANUAL" };
  }
  if (/book|folio|diagram|document|ledger/.test(hay)) {
    return { category: "KNOWLEDGE", subtype: "BOOK" };
  }
  if (/treasure map|map fragment|chart|coordinates|secret route/.test(hay)) {
    return { category: "KEY_ITEMS", subtype: "TREASURE_MAP" };
  }
  if (/smoke|flare|dial/.test(hay)) {
    return { category: "EQUIPMENT", subtype: "UTILITY" };
  }
  if (/training dummy|weighted|practice/.test(hay)) {
    return { category: "EQUIPMENT", subtype: "TRAINING" };
  }
  if (/ship part|machinery|precision part|tech part/.test(hay)) {
    return { category: "RESOURCES", subtype: "SHIP_COMPONENT" };
  }
  if (/rope|sail|plank|ballast/.test(hay)) {
    return { category: "RESOURCES", subtype: "SHIP_SUPPLY" };
  }
  if (/contraband|stolen|illegal|restricted|smuggled|forbidden/.test(hay)) {
    return { category: "VALUABLES", subtype: "CONTRABAND" };
  }
  return null;
}

export function classifyInventoryItem(
  item: Pick<InventoryItem, "id" | "itemId" | "name" | "description" | "type" | "category" | "subtype" | "weaponDefinitionId" | "fruitId" | "generatedWeapon">,
): InventoryClass {
  const itemId = definitionIdOf(item);
  const override = ITEM_CLASS_OVERRIDES[itemId];
  if (override) {
    return override;
  }

  if (item.type === "WEAPON" || item.weaponDefinitionId || item.generatedWeapon) {
    const catalogType = item.weaponDefinitionId ? getWeapon(item.weaponDefinitionId)?.weaponType : undefined;
    const weaponType = item.generatedWeapon?.weaponType ?? catalogType;
    return { category: "WEAPONS", subtype: item.subtype ?? weaponInventorySubtype(weaponType) };
  }
  if (item.type === "DEVIL_FRUIT" || item.fruitId) {
    return { category: "VALUABLES", subtype: "DEVIL_FRUIT" };
  }

  const def = getItemDefinition(itemId);
  if (def?.subtype && def.category && isInventoryCategory(def.category)) {
    return { category: def.category, subtype: def.subtype };
  }
  if (def && ITEM_CLASS_OVERRIDES[def.id]) {
    return ITEM_CLASS_OVERRIDES[def.id];
  }

  if (item.subtype && item.category && isInventoryCategory(item.category)) {
    return { category: item.category, subtype: item.subtype };
  }

  if (item.type === "CONSUMABLE" || def?.type === "CONSUMABLE") {
    return consumableClass(itemId, def);
  }
  if (item.type === "MATERIAL" || def?.type === "MATERIAL") {
    const migrated = migrateInventoryCategory(def?.category ?? item.category);
    if (migrated === "VALUABLES") {
      return { category: "VALUABLES", subtype: item.subtype ?? def?.subtype ?? "TREASURE" };
    }
    return { category: "RESOURCES", subtype: item.subtype ?? def?.subtype ?? "MATERIAL" };
  }
  if (item.type === "QUEST" || def?.type === "QUEST") {
    return { category: "KEY_ITEMS", subtype: "QUEST" };
  }
  if (item.type === "KEY" || def?.type === "KEY") {
    const hay = `${item.name} ${item.description} ${def?.name ?? ""}`.toLowerCase();
    if (/map|chart/.test(hay)) {
      return { category: "KEY_ITEMS", subtype: "TREASURE_MAP" };
    }
    return { category: "KEY_ITEMS", subtype: "STORY" };
  }

  const fromText = inferFromText(`${item.name} ${item.description} ${def?.name ?? ""} ${def?.description ?? ""}`.toLowerCase());
  if (fromText) {
    return fromText;
  }

  const migrated = migrateInventoryCategory(def?.category ?? item.category);
  if (migrated === "EQUIPMENT") {
    return { category: "EQUIPMENT", subtype: item.subtype ?? def?.subtype ?? "TOOLS" };
  }
  if (migrated === "KNOWLEDGE") {
    return { category: "KNOWLEDGE", subtype: item.subtype ?? def?.subtype ?? "DOCUMENT" };
  }
  if (migrated === "RESOURCES") {
    return { category: "RESOURCES", subtype: item.subtype ?? def?.subtype ?? "MATERIAL" };
  }
  if (migrated === "KEY_ITEMS") {
    return { category: "KEY_ITEMS", subtype: item.subtype ?? def?.subtype ?? "STORY" };
  }
  if (migrated === "CONSUMABLES") {
    return consumableClass(itemId, def);
  }
  if (migrated === "WEAPONS") {
    return { category: "WEAPONS", subtype: item.subtype };
  }
  if (def?.useContext === "PASSIVE") {
    return { category: "VALUABLES", subtype: "COLLECTABLE" };
  }
  return { category: migrated ?? "VALUABLES", subtype: item.subtype ?? def?.subtype ?? "COLLECTABLE" };
}

export function inventorySubfiltersFor(
  category: InventoryCategory,
  inventory: InventoryItem[] = [],
): InventorySubtype[] {
  if (category === "ALL") {
    return [];
  }
  const declared = INVENTORY_SUBFILTERS[category];
  if (category !== "WEAPONS") {
    return declared;
  }
  const present = new Set(
    inventory
      .filter((item) => classifyInventoryItem(item).category === "WEAPONS")
      .map((item) => classifyInventoryItem(item).subtype)
      .filter((entry): entry is InventorySubtype => Boolean(entry)),
  );
  return declared.filter((subtype) => LIVE_WEAPON_SUBTYPES.includes(subtype) || present.has(subtype));
}

export function inventoryClassLabel(item: InventoryItem): string {
  const classified = classifyInventoryItem(item);
  const main = INVENTORY_CATEGORY_TITLES[classified.category];
  if (!classified.subtype) {
    return main;
  }
  return `${main} · ${INVENTORY_SUBTYPE_LABELS[classified.subtype]}`;
}

export function matchesInventoryFilter(
  item: InventoryItem,
  category: InventoryCategory,
  subtype?: InventorySubtype | "ALL" | null,
): boolean {
  const classified = classifyInventoryItem(item);
  if (category !== "ALL" && classified.category !== category) {
    return false;
  }
  if (!subtype || subtype === "ALL") {
    return true;
  }
  return classified.subtype === subtype;
}
