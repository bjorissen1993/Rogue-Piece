import { useEffect, useMemo, useState } from "react";
import type { RunState, WeaponShopStock } from "../models/types";
import { resolveWeaponGrip } from "../game/weaponClasses";
import { WeaponService } from "../services/WeaponService";
import { WeaponShopService } from "../services/WeaponShopService";
import { WeaponStatsBlock } from "./WeaponStatsBlock";
import { weaponRarityClass } from "../utils/weaponRarity";

type WeaponShopOverlayProps = {
  run: RunState;
  stock: WeaponShopStock;
  onBuy: (listingId: string, options?: { equip?: boolean; tradeInInstanceId?: string }) => void;
  onSell: (instanceId: string) => void;
  onLeave: () => void;
  onRefresh?: () => void;
  isDev?: boolean;
};

export function WeaponShopOverlay({
  run,
  stock,
  onBuy,
  onSell,
  onLeave,
  onRefresh,
  isDev = false,
}: WeaponShopOverlayProps) {
  const available = useMemo(() => WeaponShopService.availableListings(stock), [stock]);
  const owned = useMemo(() => WeaponService.listCrewWeapons(run), [run]);
  const [selectedId, setSelectedId] = useState<string | null>(available[0]?.listingId ?? null);
  const [tradeInId, setTradeInId] = useState<string | null>(null);
  const equipped = WeaponService.getEquippedWeapon(run.player);

  useEffect(() => {
    if (!available.some((entry) => entry.listingId === selectedId)) {
      setSelectedId(available[0]?.listingId ?? null);
    }
  }, [available, selectedId]);

  useEffect(() => {
    if (tradeInId && !owned.some((entry) => entry.instance.id === tradeInId)) {
      setTradeInId(null);
    }
  }, [owned, tradeInId]);

  const selected = available.find((entry) => entry.listingId === selectedId) ?? available[0] ?? null;
  const tradeIn = owned.find((entry) => entry.instance.id === tradeInId) ?? null;
  const tradeView = tradeIn ? WeaponService.resolveWeaponView(tradeIn.instance) : undefined;
  const tradeCredit = tradeView ? WeaponService.sellValue(tradeView) : 0;
  const price = selected?.weapon.price ?? 0;
  const netCost = Math.max(0, price - tradeCredit);
  const affordable = selected ? run.player.berries + tradeCredit >= price : false;

  return (
    <div className="overlay-scrim weapon-shop-scrim">
      <section className="weapon-shop-shell panel">
        <div className="weapon-shop-body">
          <header className="weapon-shop-head">
            <div>
              <p className="hud-kicker">{stock.theme.replace(/_/g, " ")}</p>
              <h2 className="font-display text-3xl text-gold">{stock.shopName}</h2>
              <p className="weapon-shop-proprietor">
                {stock.proprietor}: <em>{stock.proprietorFlavor}</em>
              </p>
            </div>
            <div className="weapon-shop-purse">
              <span>Your berries</span>
              <strong>฿{run.player.berries}</strong>
              <span className="weapon-shop-refresh">Stock until day {stock.refreshOnDay}</span>
            </div>
          </header>

          <div className="weapon-shop-layout is-trade">
            <div className="weapon-shop-column">
              <p className="detail-label">For sale</p>
              <ul className="weapon-shop-list">
                {available.length === 0 ? (
                  <li className="weapon-shop-empty">The racks are empty. Come back after a refresh.</li>
                ) : (
                  available.map((listing) => {
                    const canBuy = run.player.berries + (tradeInId ? tradeCredit : 0) >= listing.weapon.price;
                    return (
                      <li key={listing.listingId}>
                        <button
                          className={`weapon-shop-row ${selected?.listingId === listing.listingId ? "is-selected" : ""} ${canBuy ? "" : "is-locked"}`}
                          onClick={() => setSelectedId(listing.listingId)}
                          type="button"
                        >
                          <span className={`weapon-shop-row-name ${weaponRarityClass(listing.weapon.rarity, listing.weapon.material)}`}>
                            {listing.weapon.name}
                            {listing.weapon.isNamed ? <span className="weapon-shop-named">★</span> : null}
                          </span>
                          <span className="weapon-shop-row-type">{listing.weapon.archetypeId.replace(/_/g, " ")}</span>
                          <span className={`weapon-shop-row-rarity ${weaponRarityClass(listing.weapon.rarity, listing.weapon.material)}`}>
                            {listing.weapon.rarity}
                          </span>
                          <span className="weapon-shop-row-price">฿{listing.weapon.price}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <div className="weapon-shop-column">
              <p className="detail-label">Your weapons — select to trade in / sell</p>
              <ul className="weapon-shop-list weapon-shop-owned">
                {owned.length === 0 ? (
                  <li className="weapon-shop-empty">No weapons in your pack.</li>
                ) : (
                  owned.map(({ instance, ownerLabel }) => {
                    const view = WeaponService.resolveWeaponView(instance);
                    if (!view) return null;
                    const value = WeaponService.sellValue(view);
                    return (
                      <li key={instance.id}>
                        <button
                          className={`weapon-shop-row ${tradeInId === instance.id ? "is-selected" : ""}`}
                          onClick={() => setTradeInId((current) => (current === instance.id ? null : instance.id))}
                          type="button"
                        >
                          <span className={`weapon-shop-row-name ${weaponRarityClass(view.rarity, view.material)}`}>
                            {view.name}
                          </span>
                          <span className="weapon-shop-row-type">{ownerLabel}</span>
                          <span className="weapon-shop-row-price">Sell ฿{value}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <aside className="weapon-shop-aside">
              {selected ? (
                <>
                  <WeaponStatsBlock
                    compare={equipped}
                    weapon={{
                      id: selected.listingId,
                      name: selected.weapon.name,
                      weaponType: selected.weapon.weaponType,
                      rarity: selected.weapon.rarity,
                      damage: selected.weapon.damage,
                      speed: selected.weapon.speed,
                      traits: selected.weapon.traits,
                      techniqueIds: selected.weapon.techniqueIds,
                      accuracy: selected.weapon.accuracy,
                      reach: selected.weapon.reach,
                      weight: selected.weapon.weight,
                      scalingStat: selected.weapon.scalingStat,
                      material: selected.weapon.material,
                      quality: selected.weapon.quality,
                      price: selected.weapon.price,
                      special: selected.weapon.special,
                      isNamed: selected.weapon.isNamed,
                      archetypeId: selected.weapon.archetypeId,
                      category: selected.weapon.category,
                      critBonus: selected.weapon.critBonus,
                      grip: resolveWeaponGrip({
                        grip: selected.weapon.grip,
                        traits: selected.weapon.traits,
                        archetypeId: selected.weapon.archetypeId,
                      }),
                    }}
                  />
                  <p className={`weapon-shop-price ${affordable ? "" : "is-expensive"}`}>
                    ฿{price}
                    {tradeCredit > 0 ? ` · trade-in −฿${tradeCredit} · net ฿${netCost}` : ""}
                  </p>
                  {!affordable ? <p className="weapon-shop-hint">Beyond your purse — even with trade-in.</p> : null}
                  {equipped ? (
                    <p className="weapon-shop-compare">Compared to equipped {equipped.name}.</p>
                  ) : (
                    <p className="weapon-shop-compare">No weapon equipped for comparison.</p>
                  )}
                </>
              ) : (
                <p className="weapon-shop-empty">Select a shop weapon to inspect it.</p>
              )}

              {tradeView ? (
                <div className="weapon-shop-trade-preview">
                  <p className="detail-label">Trade-in</p>
                  <WeaponStatsBlock weapon={tradeView} />
                </div>
              ) : null}

              <p className="weapon-shop-note">
                Select one of your weapons to trade it in (half price credit) or sell it outright.
              </p>
            </aside>
          </div>
        </div>

        <div className="weapon-shop-actions weapon-shop-actions-sticky">
          <button
            className="gold-btn"
            disabled={!selected || !affordable}
            onClick={() =>
              selected &&
              onBuy(selected.listingId, {
                tradeInInstanceId: tradeInId ?? undefined,
              })
            }
            type="button"
          >
            {tradeInId ? "Trade in + buy (backpack)" : "Buy (backpack)"}
          </button>
          <button
            className="gold-btn"
            disabled={!selected || !affordable}
            onClick={() =>
              selected &&
              onBuy(selected.listingId, {
                equip: true,
                tradeInInstanceId: tradeInId ?? undefined,
              })
            }
            type="button"
          >
            {tradeInId ? "Trade in + equip" : "Buy & equip"}
          </button>
          <button
            className="choice-btn"
            disabled={!tradeInId}
            onClick={() => tradeInId && onSell(tradeInId)}
            type="button"
          >
            Sell selected only
          </button>
          <button className="choice-btn" onClick={onLeave} type="button">
            Leave shop
          </button>
          {isDev && onRefresh ? (
            <button className="ghost-btn" onClick={onRefresh} type="button">
              Dev: Refresh stock
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
