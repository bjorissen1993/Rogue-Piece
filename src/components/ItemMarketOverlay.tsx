import { useEffect, useMemo, useState } from "react";
import type { ItemMarketStock, RunState } from "../models/types";
import { getItemDefinition } from "../data/items";
import { ItemMarketService } from "../services/ItemMarketService";

type ItemMarketOverlayProps = {
  run: RunState;
  stock: ItemMarketStock;
  onBuy: (listingId: string) => void;
  onLeave: () => void;
  onRefresh?: () => void;
  isDev?: boolean;
};

export function ItemMarketOverlay({
  run,
  stock,
  onBuy,
  onLeave,
  onRefresh,
  isDev = false,
}: ItemMarketOverlayProps) {
  const available = useMemo(() => ItemMarketService.availableListings(stock), [stock]);
  const [selectedId, setSelectedId] = useState<string | null>(available[0]?.listingId ?? null);

  useEffect(() => {
    if (!available.some((entry) => entry.listingId === selectedId)) {
      setSelectedId(available[0]?.listingId ?? null);
    }
  }, [available, selectedId]);

  const selected = available.find((entry) => entry.listingId === selectedId) ?? available[0] ?? null;
  const def = selected ? getItemDefinition(selected.itemId) : undefined;
  const price = selected?.price ?? 0;
  const affordable = selected ? run.player.berries >= price : false;
  const isAuction = stock.kind === "AUCTION";

  return (
    <div className="overlay-scrim item-market-scrim">
      <section className="item-market-shell panel">
        <header className="item-market-head">
          <div>
            <p className="hud-kicker">{isAuction ? "Auction" : "Black Market"}</p>
            <h2 className="font-display text-3xl text-gold">{stock.shopName}</h2>
            <p className="item-market-flavor">{stock.flavor}</p>
          </div>
          <div className="item-market-purse">
            <span>Your berries</span>
            <strong>฿{run.player.berries}</strong>
            <span className="weapon-shop-refresh">Stock until day {stock.refreshOnDay}</span>
          </div>
        </header>

        <div className="item-market-layout">
          <ul className="item-market-list">
            {available.length === 0 ? (
              <li className="item-market-empty">Nothing left on the floor. Return after a refresh.</li>
            ) : (
              available.map((listing) => {
                const item = getItemDefinition(listing.itemId);
                return (
                  <li key={listing.listingId}>
                    <button
                      className={`choice-btn item-market-lot${
                        listing.listingId === selected?.listingId ? " is-selected" : ""
                      }`}
                      onClick={() => setSelectedId(listing.listingId)}
                      type="button"
                    >
                      <span>{item?.name ?? listing.itemId}</span>
                      <span className="harbor-action-meta">
                        {isAuction
                          ? `Ask ฿${listing.price} · open ฿${listing.startingBid ?? listing.price}`
                          : `฿${listing.price}`}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="item-market-detail">
            {selected && def ? (
              <>
                <h3 className="font-display text-2xl text-gold">{def.name}</h3>
                <p>{def.description}</p>
                <p className="item-market-price">
                  {isAuction ? "Winning bid" : "Price"}: <strong>฿{price}</strong>
                </p>
                {isAuction ? (
                  <p className="harbor-action-meta">
                    NPCs may outbid you — deposits are lost when that happens.
                  </p>
                ) : null}
                <button
                  className="choice-btn"
                  disabled={!affordable}
                  onClick={() => onBuy(selected.listingId)}
                  type="button"
                >
                  {isAuction ? "Place bid" : "Buy"}
                  {!affordable ? " (short)" : ""}
                </button>
              </>
            ) : (
              <p className="item-market-empty">Select a lot.</p>
            )}
          </div>
        </div>

        <footer className="item-market-foot">
          {isDev && onRefresh ? (
            <button className="ghost-btn" onClick={onRefresh} type="button">
              Refresh stock (dev)
            </button>
          ) : null}
          <button className="ghost-btn" onClick={onLeave} type="button">
            Leave
          </button>
        </footer>
      </section>
    </div>
  );
}
