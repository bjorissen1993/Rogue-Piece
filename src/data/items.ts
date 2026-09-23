import type { ItemDefinition, ItemRarity } from "../models/types";

export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  POOR: "Poor",
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
};

export const ITEMS: ItemDefinition[] = [
  // --- Food ×6 (HP-focused) — rarity ladder Grey → Orange ---
  {
    id: "spoiled_biscuit",
    name: "Spoiled Biscuit",
    type: "CONSUMABLE",
    description: "Hardtack gone soft. You eat it because the alternative is worse.",
    consumable: true,
    useContext: "BOTH",
    rarity: "POOR",
    effects: [
      { type: "HEAL", amount: 3, percentMaxHp: 1 },
      { type: "RESTORE_MP", amount: 1 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "rice_ball",
    name: "Rice Ball",
    type: "CONSUMABLE",
    description: "Wrapped seaweed and cold rice. Fills a hole in the stomach.",
    consumable: true,
    useContext: "BOTH",
    rarity: "COMMON",
    effects: [
      { type: "HEAL", amount: 8, percentMaxHp: 3 },
      { type: "RESTORE_MP", amount: 2 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "dried_meat",
    name: "Dried Meat",
    type: "CONSUMABLE",
    description: "Salted, tough, and better than starving. Emergency ration.",
    consumable: true,
    useContext: "BOTH",
    rarity: "UNCOMMON",
    effects: [
      { type: "HEAL", amount: 12, percentMaxHp: 5 },
      { type: "RESTORE_MP", amount: 3 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "cooked_fish",
    name: "Cooked Fish",
    type: "CONSUMABLE",
    description: "Charred at the edges, still warm. Harbor fare.",
    consumable: true,
    useContext: "BOTH",
    rarity: "RARE",
    effects: [
      { type: "HEAL", amount: 18, percentMaxHp: 6 },
      { type: "RESTORE_MP", amount: 4 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "hearty_meal",
    name: "Hearty Meal",
    type: "CONSUMABLE",
    description: "Stew, bread, and something that might be meat. Inn comfort.",
    consumable: true,
    useContext: "OUT_OF_COMBAT",
    rarity: "EPIC",
    effects: [
      { type: "HEAL", amount: 28, percentMaxHp: 10 },
      { type: "RESTORE_MP", amount: 8 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "captains_feast",
    name: "Captain's Feast",
    type: "CONSUMABLE",
    description: "A table fit for a pirate king: spice, wine, and meat that still remembers the hunt.",
    consumable: true,
    useContext: "OUT_OF_COMBAT",
    rarity: "LEGENDARY",
    effects: [
      { type: "HEAL", amount: 45, percentMaxHp: 18 },
      { type: "RESTORE_MP", amount: 14 },
    ],
    category: "CONSUMABLES",
  },
  // Legacy id kept for old saves / encounter grants — maps onto the uncommon food tier.
  {
    id: "travel_rations",
    name: "Travel Rations",
    type: "CONSUMABLE",
    description: "Hardtack, dried fruit, and hope. Built for the road.",
    consumable: true,
    useContext: "BOTH",
    rarity: "UNCOMMON",
    effects: [
      { type: "HEAL", amount: 12, percentMaxHp: 4 },
      { type: "RESTORE_MP", amount: 3 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "island_apple",
    name: "Island Apple",
    type: "CONSUMABLE",
    description: "A common apple from a roadside tree. Sweet, ordinary, forgettable.",
    consumable: true,
    useContext: "BOTH",
    rarity: "COMMON",
    ordinaryFruit: true,
    effects: [
      { type: "HEAL", amount: 6, percentMaxHp: 2 },
      { type: "RESTORE_MP", amount: 1 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "island_mango",
    name: "Island Mango",
    type: "CONSUMABLE",
    description: "Sun-warm fruit. The kind sailors trade for gossip.",
    consumable: true,
    useContext: "BOTH",
    rarity: "COMMON",
    ordinaryFruit: true,
    effects: [
      { type: "HEAL", amount: 7, percentMaxHp: 2 },
      { type: "RESTORE_MP", amount: 2 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "wild_banana",
    name: "Wild Banana",
    type: "CONSUMABLE",
    description: "Picked green and left to ripen in a hammock.",
    consumable: true,
    useContext: "BOTH",
    rarity: "POOR",
    ordinaryFruit: true,
    effects: [
      { type: "HEAL", amount: 5, percentMaxHp: 1 },
      { type: "RESTORE_MP", amount: 1 },
    ],
    category: "CONSUMABLES",
  },

  // --- Drinks ×6 (MP-focused) ---
  {
    id: "brackish_dregs",
    name: "Brackish Dregs",
    type: "CONSUMABLE",
    description: "Barrel scrapings. Wet, salty, and barely worth the swallow.",
    consumable: true,
    useContext: "BOTH",
    rarity: "POOR",
    effects: [
      { type: "RESTORE_MP", amount: 4, percentMaxMp: 1 },
      { type: "HEAL", amount: 1 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "fresh_water",
    name: "Fresh Water",
    type: "CONSUMABLE",
    description: "A clean canteen. Clears the head more than the bruises.",
    consumable: true,
    useContext: "BOTH",
    rarity: "COMMON",
    effects: [
      { type: "RESTORE_MP", amount: 10, percentMaxMp: 4 },
      { type: "HEAL", amount: 3 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "grog",
    name: "Grog",
    type: "CONSUMABLE",
    description: "Watered rum with a kick. Warmth first, courage second.",
    consumable: true,
    useContext: "BOTH",
    rarity: "UNCOMMON",
    effects: [
      { type: "RESTORE_MP", amount: 14, percentMaxMp: 5 },
      { type: "HEAL", amount: 4 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "citrus_juice",
    name: "Citrus Juice",
    type: "CONSUMABLE",
    description: "Sharp, bright, and good against foggy minds.",
    consumable: true,
    useContext: "BOTH",
    rarity: "RARE",
    effects: [
      { type: "RESTORE_MP", amount: 20, percentMaxMp: 7 },
      { type: "HEAL", amount: 5 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "energy_tonic",
    name: "Energy Tonic",
    type: "CONSUMABLE",
    description: "Bitter herbs in a green bottle. Sparks return to tired limbs.",
    consumable: true,
    useContext: "BOTH",
    rarity: "EPIC",
    effects: [
      { type: "RESTORE_MP", amount: 28, percentMaxMp: 10 },
      { type: "HEAL", amount: 7 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "strong_brew",
    name: "Strong Brew",
    type: "CONSUMABLE",
    description: "Dockside coffee thick enough to stand a spoon in. Legend among night watches.",
    consumable: true,
    useContext: "BOTH",
    rarity: "LEGENDARY",
    effects: [
      { type: "RESTORE_MP", amount: 40, percentMaxMp: 15 },
      { type: "HEAL", amount: 10 },
    ],
    category: "CONSUMABLES",
  },

  // --- Medicine ×6 (HP + MP) ---
  {
    id: "dirty_rag",
    name: "Dirty Rag",
    type: "CONSUMABLE",
    description: "Once a bandage. Now mostly hope and old blood.",
    consumable: true,
    useContext: "BOTH",
    rarity: "POOR",
    effects: [
      { type: "HEAL", amount: 6, percentMaxHp: 2 },
      { type: "RESTORE_MP", amount: 2, percentMaxMp: 1 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "bandage",
    name: "Bandage",
    type: "CONSUMABLE",
    description: "Clean cloth and a splash of spirits. Stops the worst bleeding.",
    consumable: true,
    useContext: "BOTH",
    rarity: "COMMON",
    effects: [
      { type: "HEAL", amount: 15, percentMaxHp: 5 },
      { type: "RESTORE_MP", amount: 6, percentMaxMp: 3 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "medicine",
    name: "Basic Medicine",
    type: "CONSUMABLE",
    description: "Bitter tincture in a stained bottle. Closes holes and clears fever.",
    consumable: true,
    useContext: "BOTH",
    rarity: "UNCOMMON",
    effects: [
      { type: "HEAL", amount: 25, percentMaxHp: 8 },
      { type: "RESTORE_MP", amount: 10, percentMaxMp: 4 },
      { type: "CLEAR_AFFLICTION", kinds: ["SICKNESS"] },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "medical_kit",
    name: "Medical Kit",
    type: "CONSUMABLE",
    description: "Salves, needle, and a pamphlet of shaky handwriting. Treats poison and sickness.",
    consumable: true,
    useContext: "BOTH",
    rarity: "RARE",
    effects: [
      { type: "HEAL", amount: 40, percentMaxHp: 12 },
      { type: "RESTORE_MP", amount: 16, percentMaxMp: 6 },
      { type: "CLEAR_AFFLICTION" },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "strong_medicine",
    name: "Strong Medicine",
    type: "CONSUMABLE",
    description: "Clinic-grade. Burns going down. Clears toxins thoroughly.",
    consumable: true,
    useContext: "BOTH",
    rarity: "EPIC",
    effects: [
      { type: "HEAL", amount: 55, percentMaxHp: 15 },
      { type: "RESTORE_MP", amount: 22, percentMaxMp: 8 },
      { type: "CLEAR_AFFLICTION" },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "miracle_salve",
    name: "Miracle Salve",
    type: "CONSUMABLE",
    description: "A luminous paste from a doctor who charged like a Celestial. Wounds close like they were never there.",
    consumable: true,
    useContext: "BOTH",
    rarity: "LEGENDARY",
    effects: [
      { type: "HEAL", amount: 80, percentMaxHp: 25 },
      { type: "RESTORE_MP", amount: 30, percentMaxMp: 12 },
    ],
    category: "CONSUMABLES",
  },

  // --- Combat utility ---
  {
    id: "smoke_bomb",
    name: "Smoke Bomb",
    type: "CONSUMABLE",
    description: "A dense charge of black powder and oilcloth. Guarantees escape from a fight.",
    consumable: true,
    useContext: "COMBAT",
    rarity: "UNCOMMON",
    effects: [{ type: "GUARANTEE_ESCAPE" }],
    category: "TOOLS",
  },

  // --- Revive (mythic / unique) ---
  {
    id: "phoenix_tear",
    name: "Phoenix Tear",
    type: "CONSUMABLE",
    description:
      "A single drop sealed in crystal, warm as a living pulse. Can call a fallen crewmate back from the edge — once.",
    consumable: true,
    useContext: "BOTH",
    rarity: "LEGENDARY",
    effects: [{ type: "REVIVE", percentMaxHp: 45, hpAmount: 20 }],
    category: "CONSUMABLES",
  },

  {
    id: "antidote",
    name: "Antidote",
    type: "CONSUMABLE",
    description: "A sharp herbal draught meant for poison alone.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "CLEAR_AFFLICTION", kinds: ["POISON"] }],
    category: "CONSUMABLES",
  },  {
    id: "east_blue_chart",
    name: "East Blue Chart",
    type: "KEY",
    description: "A stained chart of familiar waters. Not something you eat, throw, or spend.",
    consumable: false,
    useContext: "SPECIAL",
    effects: [{ type: "NONE" }],
    category: "KEY_ITEMS",
  },
  {
    id: "rusty_cutlass",
    name: "Rusty Cutlass",
    type: "MISC",
    description: "Not pretty. Still sharp enough.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "MISCELLANEOUS",
  },
  {
    id: "marine_breastplate",
    name: "Marine Breastplate",
    type: "MISC",
    description: "Still stamped with a unit number nobody will claim.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "MISCELLANEOUS",
  },
  {
    id: "fishman_scale",
    name: "Fish-Man Scale",
    type: "MATERIAL",
    description: "Iridescent, hard, and not from any fish you know.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "MATERIALS",
  },
  {
    id: "sky_island_fragment",
    name: "Sky Island Fragment",
    type: "MATERIAL",
    description: "Cloud-stone that should not exist at sea level.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "MATERIALS",
  },
  {
    id: "forbidden_folio",
    name: "Forbidden Folio",
    type: "KEY",
    description: "A World Government record that was never meant to leave a vault.",
    consumable: false,
    useContext: "SPECIAL",
    effects: [{ type: "NONE" }],
    category: "KEY_ITEMS",
  },
  // --- Collectables: knowledge / dialogue hooks ---
  {
    id: "ancient_gear_diagram",
    name: "Ancient Gear Diagram",
    type: "MISC",
    description: "A brittle page mapping gear teeth and release rings.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "COLLECTABLES",
  },
  {
    id: "marine_field_manual",
    name: "Marine Field Manual",
    type: "MISC",
    description: "Formation notes and rifleman drills — still useful if you can read between the lines.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "COLLECTABLES",
  },
  {
    id: "ancient_navigation_journal",
    name: "Ancient Navigation Journal",
    type: "MISC",
    description: "A sailor's log of a hidden current that charts do not mark.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "COLLECTABLES",
  },
  {
    id: "fish",
    name: "Common Catch",
    type: "CONSUMABLE",
    description: "A modest fish from the shallows. Eat it, sell it, or fill a merchant's crate.",
    consumable: true,
    useContext: "BOTH",
    effects: [
      { type: "HEAL", amount: 6, percentMaxHp: 2 },
      { type: "RESTORE_MP", amount: 2 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "fish_fine",
    name: "Choice Catch",
    type: "CONSUMABLE",
    description: "Firm and clean. A stall will pay — or it fills a hungry sailor.",
    consumable: true,
    useContext: "BOTH",
    effects: [
      { type: "HEAL", amount: 10, percentMaxHp: 3 },
      { type: "RESTORE_MP", amount: 3 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "fish_prime",
    name: "Prime Catch",
    type: "CONSUMABLE",
    description: "A strong fish taken on a fast line. Good eating, better coin.",
    consumable: true,
    useContext: "BOTH",
    effects: [
      { type: "HEAL", amount: 16, percentMaxHp: 5 },
      { type: "RESTORE_MP", amount: 4 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "fish_golden",
    name: "Golden Catch",
    type: "CONSUMABLE",
    description: "Struck on a gold mark. Rare enough that a merchant will open the purse.",
    consumable: true,
    useContext: "BOTH",
    effects: [
      { type: "HEAL", amount: 22, percentMaxHp: 8 },
      { type: "RESTORE_MP", amount: 6 },
    ],
    category: "CONSUMABLES",
  },
  {
    id: "sea_king_meat",
    name: "Sea King Meat",
    type: "QUEST",
    description: "A slab carved from a god of the deep. A merchant asked for this — take it to the stall.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "QUEST_ITEMS",
  },
  {
    id: "wanted_poster_scrap",
    name: "Wanted Poster Scrap",
    type: "MISC",
    description: "Half a face and a bounty number that still means something ashore.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "COLLECTABLES",
  },
  {
    id: "coral_charm",
    name: "Coral Charm",
    type: "MISC",
    description: "A fish-man keepsake that warms conversation under the waves.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "COLLECTABLES",
  },
  {
    id: "old_bounty_ledger",
    name: "Old Bounty Ledger",
    type: "MISC",
    description: "Names crossed out in three different inks — a hunter's memory.",
    consumable: false,
    useContext: "PASSIVE",
    effects: [{ type: "NONE" }],
    category: "COLLECTABLES",
  },
  {
    id: "fruitbound_remnant",
    name: "Fruitbound Remnant",
    type: "MATERIAL",
    description: "What a Devil Fruit weapon leaves when it is unmade. Not a fruit.",
    consumable: false,
    useContext: "PASSIVE",
    rarity: "RARE",
    effects: [{ type: "NONE" }],
    category: "COLLECTABLES",
  },
];

/** Typical berry prices for shops (early game vs ~700 starting berries). */
export const ITEM_SHOP_PRICES: Record<string, number> = {
  spoiled_biscuit: 8,
  rice_ball: 25,
  dried_meat: 45,
  cooked_fish: 70,
  hearty_meal: 140,
  captains_feast: 420,
  fish: 15,
  fish_fine: 35,
  fish_prime: 70,
  fish_golden: 140,
  travel_rations: 50,
  island_apple: 12,
  island_mango: 16,
  wild_banana: 8,
  brackish_dregs: 6,
  fresh_water: 20,
  grog: 35,
  citrus_juice: 55,
  energy_tonic: 110,
  strong_brew: 280,
  dirty_rag: 12,
  bandage: 70,
  medicine: 110,
  medical_kit: 180,
  strong_medicine: 280,
  miracle_salve: 650,
  smoke_bomb: 95,
  /** Extremely costly one-shot revive. */
  phoenix_tear: 3500,
  antidote: 95,
  ancient_gear_diagram: 160,
  marine_field_manual: 120,
  ancient_navigation_journal: 150,
  wanted_poster_scrap: 45,
  coral_charm: 110,
  old_bounty_ledger: 140,
};

export const SEA_KING_MEAT_ITEM_ID = "sea_king_meat";

export function isSeaKingMeatItem(itemId: string): boolean {
  return itemId === SEA_KING_MEAT_ITEM_ID;
}

export function itemSellPrice(itemId: string): number | null {
  const def = getItemDefinition(itemId);
  if (!def || def.type === "KEY" || def.type === "QUEST") {
    return null;
  }
  const shop = ITEM_SHOP_PRICES[itemId];
  if (shop == null) {
    return null;
  }
  return Math.max(1, Math.round(shop * 0.6));
}

export function getItemDefinition(id: string): ItemDefinition | undefined {
  return ITEMS.find((item) => item.id === id);
}

export function requireItemDefinition(id: string): ItemDefinition {
  const def = getItemDefinition(id);
  if (!def) {
    throw new Error(`Unknown item: ${id}`);
  }
  return def;
}

export function itemIdFromName(name: string): string | undefined {
  return ITEMS.find((item) => item.name === name)?.id;
}

export function isOrdinaryFruitItem(itemId: string | undefined): boolean {
  if (!itemId) {
    return false;
  }
  return Boolean(getItemDefinition(itemId)?.ordinaryFruit);
}

export function isDevilFruitMerchandise(itemId: string | undefined, fruitId?: string | null): boolean {
  if (fruitId) {
    return true;
  }
  if (!itemId) {
    return false;
  }
  const def = getItemDefinition(itemId);
  return def?.type === "DEVIL_FRUIT" || Boolean(itemId && DEVIL_FRUIT_ITEM_HINT.test(itemId));
}

const DEVIL_FRUIT_ITEM_HINT = /(devil[_-]?fruit|_no_mi|bara_bara|bomu_bomu|bari_bari|doru_doru|inu_)/i;

export function computeHealAmount(
  amount: number,
  percentMaxHp: number | undefined,
  maxHp: number,
): number {
  const pct = percentMaxHp ? Math.round(maxHp * (percentMaxHp / 100)) : 0;
  return amount + pct;
}

export function computeMpRestoreAmount(
  amount: number,
  percentMaxMp: number | undefined,
  maxMp: number,
): number {
  const pct = percentMaxMp ? Math.round(maxMp * (percentMaxMp / 100)) : 0;
  return amount + pct;
}

export function computeReviveHp(
  effect: { hpAmount?: number; percentMaxHp?: number },
  maxHp: number,
): number {
  return Math.max(1, computeHealAmount(effect.hpAmount ?? 0, effect.percentMaxHp, maxHp));
}
