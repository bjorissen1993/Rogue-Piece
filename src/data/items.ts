import type { ItemDefinition } from "../models/types";

export const ITEMS: ItemDefinition[] = [
  // --- Food: cheap, common, moderate heal ---
  {
    id: "rice_ball",
    name: "Rice Ball",
    type: "CONSUMABLE",
    description: "Wrapped seaweed and cold rice. Fills a hole in the stomach.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 8, percentMaxHp: 3 }],
    category: "CONSUMABLES",
  },
  {
    id: "dried_meat",
    name: "Dried Meat",
    type: "CONSUMABLE",
    description: "Salted, tough, and better than starving. Emergency ration.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 10, percentMaxHp: 5 }],
    category: "CONSUMABLES",
  },
  {
    id: "cooked_fish",
    name: "Cooked Fish",
    type: "CONSUMABLE",
    description: "Charred at the edges, still warm. Harbor fare.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 14, percentMaxHp: 5 }],
    category: "CONSUMABLES",
  },
  {
    id: "hearty_meal",
    name: "Hearty Meal",
    type: "CONSUMABLE",
    description: "Stew, bread, and something that might be meat. Inn comfort.",
    consumable: true,
    useContext: "OUT_OF_COMBAT",
    effects: [{ type: "HEAL", amount: 22, percentMaxHp: 8 }],
    category: "CONSUMABLES",
  },
  {
    id: "travel_rations",
    name: "Travel Rations",
    type: "CONSUMABLE",
    description: "Hardtack, dried fruit, and hope. Built for the road.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 12, percentMaxHp: 4 }],
    category: "CONSUMABLES",
  },
  // --- Medicine: stronger, clinic/pharmacy ---
  {
    id: "bandage",
    name: "Bandage",
    type: "CONSUMABLE",
    description: "Clean cloth and a splash of spirits. Stops the worst bleeding.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 15, percentMaxHp: 5 }],
    category: "CONSUMABLES",
  },
  {
    id: "medicine",
    name: "Basic Medicine",
    type: "CONSUMABLE",
    description: "Bitter tincture in a stained bottle. Closes holes that meat cannot.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 25, percentMaxHp: 8 }],
    category: "CONSUMABLES",
  },
  {
    id: "medical_kit",
    name: "Medical Kit",
    type: "CONSUMABLE",
    description: "Salves, needle, and a pamphlet of shaky handwriting.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 40, percentMaxHp: 12 }],
    category: "CONSUMABLES",
  },
  {
    id: "strong_medicine",
    name: "Strong Medicine",
    type: "CONSUMABLE",
    description: "Clinic-grade. Burns going down. Worth it.",
    consumable: true,
    useContext: "BOTH",
    effects: [{ type: "HEAL", amount: 55, percentMaxHp: 15 }],
    category: "CONSUMABLES",
  },
  {
    id: "smoke_bomb",
    name: "Smoke Bomb",
    type: "CONSUMABLE",
    description: "A dense charge of black powder and oilcloth. Good for leaving.",
    consumable: true,
    useContext: "COMBAT",
    effects: [{ type: "GUARANTEE_ESCAPE" }],
    category: "CONSUMABLES",
  },
  {
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
];

/** Typical berry prices for shops (early game vs ~700 starting berries). */
export const ITEM_SHOP_PRICES: Record<string, number> = {
  rice_ball: 25,
  dried_meat: 40,
  cooked_fish: 55,
  travel_rations: 50,
  hearty_meal: 90,
  bandage: 70,
  medicine: 110,
  medical_kit: 180,
  strong_medicine: 260,
};

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

export function computeHealAmount(
  amount: number,
  percentMaxHp: number | undefined,
  maxHp: number,
): number {
  const pct = percentMaxHp ? Math.round(maxHp * (percentMaxHp / 100)) : 0;
  return amount + pct;
}
