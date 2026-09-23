import { useMemo } from "react";
import {
  WEAPON_SHOP_TABS,
  weaponIconSrc,
  weaponShopDescription,
  weaponShopMeta,
  weaponShopRarityGlow,
} from "../data/weaponShopUi";
import type { RunState, WeaponShopStock } from "../models/types";
import { WeaponService } from "../services/WeaponService";
import { WeaponShopService } from "../services/WeaponShopService";
import { TradeShopOverlay } from "./TradeShopOverlay";

type WeaponTradeShopOverlayProps = {
  run: RunState;
  stock: WeaponShopStock | null;
  onBuy: (listingId: string) => string;
  onSell: (instanceId: string) => string;
  onClose: () => void;
};

export function WeaponTradeShopOverlay({
  run,
  stock,
  onBuy,
  onSell,
  onClose,
}: WeaponTradeShopOverlayProps) {
  const available = useMemo(() => (stock ? WeaponShopService.availableListings(stock) : []), [stock]);
  const owned = useMemo(() => WeaponService.listCrewWeapons(run), [run]);

  const pack = useMemo(
    () =>
      owned.flatMap(({ instance }) => {
        const view = WeaponService.resolveWeaponView(instance);
        const generated = instance.generatedWeapon;
        if (!view) {
          return [];
        }
        const category = generated?.category ?? view.category ?? "UNUSUAL";
        const rarity = generated?.rarity ?? view.rarity;
        const material = generated?.material;
        const price = WeaponService.sellValue(view);
        return [
          {
            id: instance.id,
            name: view.name,
            description: generated ? weaponShopDescription(generated) : view.name,
            price,
            tab: category,
            iconSrc: weaponIconSrc({
              archetypeId: generated?.archetypeId ?? view.archetypeId,
              category,
              traits: view.traits,
              grip: view.grip,
            }),
            rarityClass: weaponShopRarityGlow(rarity, material),
            meta: generated ? weaponShopMeta(generated) : `${view.rarity} · ${view.weaponType}`,
            maxQuantity: 1,
          },
        ];
      }),
    [owned],
  );

  const shop = useMemo(
    () =>
      available.map((listing) => ({
        id: listing.listingId,
        name: listing.weapon.name,
        description: weaponShopDescription(listing.weapon),
        price: listing.weapon.price,
        tab: listing.weapon.category,
        iconSrc: weaponIconSrc(listing.weapon),
        rarityClass: weaponShopRarityGlow(listing.weapon.rarity, listing.weapon.material),
        meta: weaponShopMeta(listing.weapon),
        maxQuantity: 1,
      })),
    [available],
  );

  const sellPrices = useMemo(() => {
    const next = new Map<string, number>();
    for (const entry of pack) {
      next.set(entry.id, entry.price);
    }
    return next;
  }, [pack]);

  const buyPrices = useMemo(() => {
    const next = new Map<string, number>();
    for (const listing of available) {
      next.set(listing.listingId, listing.weapon.price);
    }
    return next;
  }, [available]);

  const ownedIds = useMemo(() => new Set(pack.map((entry) => entry.id)), [pack]);

  return (
    <TradeShopOverlay
      berries={run.player.berries}
      buyPrice={(id) => buyPrices.get(id) ?? null}
      emptyDetail="Choose a weapon from your pack or the rack."
      emptyPack="No weapons the smith will buy."
      emptyShop="The racks are empty."
      eyebrow="Weapon Shop"
      flavor={stock ? `${stock.proprietor}: ${stock.proprietorFlavor}` : "Steel on the rack. Trade in the middle."}
      onBuy={(id) => onBuy(id)}
      onClose={onClose}
      onSell={(id) => onSell(id)}
      ownedCount={(id) => (ownedIds.has(id) ? 1 : 0)}
      pack={pack}
      sellPrice={(id) => sellPrices.get(id) ?? null}
      shop={shop}
      tabs={WEAPON_SHOP_TABS}
      title="Buy / Sell"
    />
  );
}
