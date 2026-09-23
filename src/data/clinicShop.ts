import { ITEM_SHOP_PRICES, getItemDefinition, itemSellPrice } from "./items";
import { itemAisleTitle, itemIconSrc, itemRarityGlowClass } from "./marketShop";

/** Clinic stall goods — same medicine the old parchment clinic sold, plus stronger stock. */
export const CLINIC_SHOP_ITEM_IDS = [
  "bandage",
  "medicine",
  "medical_kit",
  "strong_medicine",
  "antidote",
] as const;

export type ClinicShopItemId = (typeof CLINIC_SHOP_ITEM_IDS)[number];
export type ClinicShopAisle = "medicine";
export type ClinicShopTab = "all" | ClinicShopAisle;

export const CLINIC_SHOP_TABS: Array<{ id: ClinicShopTab; label: string; iconSrc?: string }> = [
  { id: "all", label: "All" },
  { id: "medicine", label: "Medicine", iconSrc: "/icons/Items/Category_Medicine.png" },
];

export function isClinicShopItem(itemId: string): itemId is ClinicShopItemId {
  return (CLINIC_SHOP_ITEM_IDS as readonly string[]).includes(itemId);
}

export function clinicShopAisle(): ClinicShopAisle {
  return "medicine";
}

export function matchesClinicTab(itemId: string, tab: ClinicShopTab): boolean {
  return tab === "all" || clinicShopAisle(itemId) === tab;
}

export function clinicShopPrice(itemId: string): number | null {
  if (!isClinicShopItem(itemId)) {
    return null;
  }
  return ITEM_SHOP_PRICES[itemId] ?? null;
}

export function clinicSellPrice(itemId: string): number | null {
  if (!isClinicShopItem(itemId)) {
    return null;
  }
  return itemSellPrice(itemId);
}

export type ClinicShopListing = {
  itemId: string;
  name: string;
  description: string;
  price: number;
  aisle: ClinicShopAisle;
};

export function clinicShopCatalog(): ClinicShopListing[] {
  return CLINIC_SHOP_ITEM_IDS.flatMap((itemId) => {
    const def = getItemDefinition(itemId);
    const price = clinicShopPrice(itemId);
    if (!def || price == null) {
      return [];
    }
    return [
      {
        itemId,
        name: def.name,
        description: def.description,
        price,
        aisle: clinicShopAisle(itemId),
      },
    ];
  });
}

export function clinicAisleTitle(itemId: string): string {
  return itemAisleTitle(itemId);
}

export { itemIconSrc, itemRarityGlowClass };
