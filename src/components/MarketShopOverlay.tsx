import { useMemo } from "react";
import { getItemDefinition } from "../data/items";
import {
  itemAisleTitle,
  itemIconSrc,
  itemRarityGlowClass,
  itemShopAisle,
  MARKET_SHOP_TABS,
  marketSellPrice,
  marketShopCatalog,
  marketShopPrice,
} from "../data/marketShop";
import type { RunState } from "../models/types";
import { ItemService } from "../services/ItemService";
import { TradeShopOverlay } from "./TradeShopOverlay";

type MarketShopOverlayProps = {
  run: RunState;
  onBuy: (itemId: string, quantity?: number) => string;
  onSell: (itemId: string, quantity?: number) => string;
  onClose: () => void;
};

export function MarketShopOverlay({ run, onBuy, onSell, onClose }: MarketShopOverlayProps) {
  const catalog = useMemo(() => marketShopCatalog(), []);
  const pack = useMemo(
    () =>
      run.player.inventory
        .map((item) => {
          const itemId = item.itemId || item.id;
          const price = marketSellPrice(itemId);
          if (price == null || (item.quantity ?? 1) <= 0 || item.type === "WEAPON") {
            return null;
          }
          const def = getItemDefinition(itemId);
          return {
            id: itemId,
            name: item.name || def?.name || itemId,
            description: item.description || def?.description || "",
            price,
            tab: itemShopAisle(itemId),
            iconSrc: itemIconSrc(itemId),
            rarityClass: itemRarityGlowClass(itemId),
            meta: itemAisleTitle(itemId),
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
        meta: itemAisleTitle(entry.itemId),
      })),
    [catalog],
  );

  return (
    <TradeShopOverlay
      berries={run.player.berries}
      buyPrice={marketShopPrice}
      onBuy={onBuy}
      onClose={onClose}
      onSell={onSell}
      ownedCount={(itemId) => ItemService.countOwned(run, itemId)}
      pack={pack}
      sellPrice={marketSellPrice}
      shop={shop}
      tabs={MARKET_SHOP_TABS}
      eyebrow="Market"
      title="Buy / Sell"
    />
  );
}
