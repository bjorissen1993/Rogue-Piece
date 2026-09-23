import { FISH_CATCH_TIERS, isFishCatchItem } from "./fishing";
import {
  ITEM_SHOP_PRICES,
  getItemDefinition,
  isDevilFruitMerchandise,
  isSeaKingMeatItem,
  itemSellPrice,
} from "./items";

/** Portable stall goods — same set the old parchment Market sold. */
export const MARKET_SHOP_ITEM_IDS = [
  "rice_ball",
  "dried_meat",
  "travel_rations",
  "fresh_water",
  "grog",
  "energy_tonic",
  "bandage",
] as const;

export type MarketShopItemId = (typeof MARKET_SHOP_ITEM_IDS)[number];
export type MarketShopAisle = "food" | "drink" | "medicine";
export type MarketShopTab = "all" | MarketShopAisle;

export const MARKET_SHOP_CATEGORY_ICONS: Record<MarketShopAisle, string> = {
  food: "/icons/Items/Category_Food.png",
  drink: "/icons/Items/Category_Drinks.png",
  medicine: "/icons/Items/Category_Medicine.png",
};

export const MARKET_SHOP_TABS: Array<{ id: MarketShopTab; label: string; iconSrc?: string }> = [
  { id: "all", label: "All" },
  { id: "food", label: "Food", iconSrc: MARKET_SHOP_CATEGORY_ICONS.food },
  { id: "drink", label: "Drinks", iconSrc: MARKET_SHOP_CATEGORY_ICONS.drink },
  { id: "medicine", label: "Medicine", iconSrc: MARKET_SHOP_CATEGORY_ICONS.medicine },
];

const MARKET_SHOP_AISLES: Record<MarketShopItemId, MarketShopAisle> = {
  rice_ball: "food",
  dried_meat: "food",
  travel_rations: "food",
  fresh_water: "drink",
  grog: "drink",
  energy_tonic: "drink",
  bandage: "medicine",
};

const ITEM_ICON_SRC: Record<string, string> = {
  rice_ball: "/icons/Items/Food_Rice.png",
  dried_meat: "/icons/Items/Food_Meat.png",
  travel_rations: "/icons/Items/Food_Fruits.png",
  cooked_fish: "/icons/Items/Food_Fish.png",
  hearty_meal: "/icons/Items/Category_Food.png",
  fish: "/icons/Items/Food_Fish.png",
  fish_fine: "/icons/Items/Food_Fish.png",
  fish_prime: "/icons/Items/Food_Fish.png",
  fish_golden: "/icons/Items/Food_Fish.png",
  sea_king_meat: "/icons/Items/Food_Meat.png",
  fresh_water: "/icons/Items/Drinks_Water.png",
  grog: "/icons/Items/Drinks_Beer.png",
  citrus_juice: "/icons/Items/Drinks_Wine.png",
  energy_tonic: "/icons/Items/Drinks_Energy.png",
  strong_brew: "/icons/Items/Drinks_Alcohol.png",
  bandage: "/icons/Items/Medicine_Bandage.png",
  medicine: "/icons/Items/Medicine_Potion.png",
  medical_kit: "/icons/Items/Medicine_MedicalKit.png",
  strong_medicine: "/icons/Items/Medicine_PhoenixTear.png",
  antidote: "/icons/Items/Medicine_StatusRemover.png",
};

export function isMarketShopItem(itemId: string): itemId is MarketShopItemId {
  return (MARKET_SHOP_ITEM_IDS as readonly string[]).includes(itemId);
}

export function itemShopAisle(itemId: string): MarketShopAisle {
  if (isMarketShopItem(itemId)) {
    return MARKET_SHOP_AISLES[itemId];
  }
  if (isFishCatchItem(itemId) || /meat|meal|ration|rice|fish/i.test(itemId)) {
    return "food";
  }
  if (/water|grog|juice|tonic|brew/i.test(itemId)) {
    return "drink";
  }
  return "medicine";
}

export function marketShopAisleLabel(aisle: MarketShopAisle): string {
  if (aisle === "food") {
    return "Food";
  }
  if (aisle === "drink") {
    return "Drinks";
  }
  return "Medicine";
}

export function itemAisleTitle(itemId: string): string {
  if (/smoke|bomb/i.test(itemId)) {
    return "Tool";
  }
  return marketShopAisleLabel(itemShopAisle(itemId));
}

export function matchesMarketTab(itemId: string, tab: MarketShopTab): boolean {
  return tab === "all" || itemShopAisle(itemId) === tab;
}

export type ItemArtRarity = "common" | "uncommon" | "rare" | "legendary" | "sea-king";

/** Fish tiers (and Sea King meat) carry rarity; other stall goods do not. */
export function itemArtRarity(itemId: string): ItemArtRarity | null {
  if (isSeaKingMeatItem(itemId)) {
    return "sea-king";
  }
  return FISH_CATCH_TIERS.find((tier) => tier.id === itemId)?.rarity ?? null;
}

export function itemRarityGlowClass(itemId: string): string {
  const rarity = itemArtRarity(itemId);
  return rarity ? `shop-item-rarity shop-item-rarity--${rarity}` : "";
}

export function itemIconSrc(itemId: string): string {
  return ITEM_ICON_SRC[itemId] ?? `/icons/Items/${itemId}.png`;
}

export function marketShopPrice(itemId: string): number | null {
  if (!isMarketShopItem(itemId)) {
    return null;
  }
  return ITEM_SHOP_PRICES[itemId] ?? null;
}

export type MarketShopListing = {
  itemId: string;
  name: string;
  description: string;
  price: number;
  aisle: MarketShopAisle;
};

export function marketShopCatalog(): MarketShopListing[] {
  return MARKET_SHOP_ITEM_IDS.flatMap((itemId) => {
    const def = getItemDefinition(itemId);
    const price = marketShopPrice(itemId);
    if (!def || price == null || isDevilFruitMerchandise(itemId)) {
      return [];
    }
    return [
      {
        itemId,
        name: def.name,
        description: def.description,
        price,
        aisle: MARKET_SHOP_AISLES[itemId],
      },
    ];
  });
}

export function marketSellPrice(itemId: string): number | null {
  return itemSellPrice(itemId);
}

export const MARKET_QTY_PRESETS = [1, 5, 10] as const;

export function marketBuyLimit(berries: number, unitPrice: number): number {
  if (unitPrice <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor(berries / unitPrice));
}

export function clampMarketQuantity(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const cap = Math.max(1, Math.floor(max));
  return Math.min(Math.max(1, Math.floor(value)), cap);
}
