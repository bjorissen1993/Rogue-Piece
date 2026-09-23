import { useMemo } from "react";
import { getItemDefinition } from "../data/items";
import {
  CLINIC_SHOP_TABS,
  clinicAisleTitle,
  clinicSellPrice,
  clinicShopCatalog,
  clinicShopPrice,
  isClinicShopItem,
  itemIconSrc,
  itemRarityGlowClass,
} from "../data/clinicShop";
import type { RunState } from "../models/types";
import { ItemService } from "../services/ItemService";
import { TradeShopOverlay } from "./TradeShopOverlay";

type ClinicShopOverlayProps = {
  run: RunState;
  onBuy: (itemId: string, quantity?: number) => string;
  onSell: (itemId: string, quantity?: number) => string;
  onClose: () => void;
};

export function ClinicShopOverlay({ run, onBuy, onSell, onClose }: ClinicShopOverlayProps) {
  const catalog = useMemo(() => clinicShopCatalog(), []);
  const pack = useMemo(
    () =>
      run.player.inventory
        .map((item) => {
          const itemId = item.itemId || item.id;
          const price = clinicSellPrice(itemId);
          if (price == null || (item.quantity ?? 1) <= 0 || !isClinicShopItem(itemId)) {
            return null;
          }
          const def = getItemDefinition(itemId);
          return {
            id: itemId,
            name: item.name || def?.name || itemId,
            description: item.description || def?.description || "",
            price,
            tab: "medicine",
            iconSrc: itemIconSrc(itemId),
            rarityClass: itemRarityGlowClass(itemId),
            meta: clinicAisleTitle(itemId),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [run.player.inventory],
  );
  const shop = useMemo(
    () =>
      catalog.map((entry) => ({
        id: entry.itemId,
        name: entry.name,
        description: entry.description,
        price: entry.price,
        tab: entry.aisle,
        iconSrc: itemIconSrc(entry.itemId),
        rarityClass: itemRarityGlowClass(entry.itemId),
        meta: clinicAisleTitle(entry.itemId),
      })),
    [catalog],
  );

  return (
    <TradeShopOverlay
      berries={run.player.berries}
      buyPrice={clinicShopPrice}
      emptyDetail="Choose a remedy from your pack or the clinic."
      emptyPack="Nothing the clinic will buy."
      eyebrow="Clinic"
      flavor="Medicine and kits. Trade in the middle."
      onBuy={onBuy}
      onClose={onClose}
      onSell={onSell}
      ownedCount={(itemId) => ItemService.countOwned(run, itemId)}
      pack={pack}
      sellPrice={clinicSellPrice}
      shop={shop}
      tabs={CLINIC_SHOP_TABS}
      title="Buy / Sell"
    />
  );
}
