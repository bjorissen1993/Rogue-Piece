import { useEffect, useMemo, useState } from "react";
import type { ItemMarketStock, RunState } from "../models/types";
import { itemIconSrc } from "../data/itemArt";
import { getItemDefinition } from "../data/items";
import { ItemMarketService } from "../services/ItemMarketService";
import { FacilityActionCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

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
    <OverlayFrame
      elevate
      eyebrow={isAuction ? "Auction" : "Black Market"}
      onClose={onLeave}
      title={stock.shopName}
    >
      <p className="encounter-choice-lede">{stock.flavor}</p>
      <p className="facility-purse">Your berries · ฿{run.player.berries} · stock until day {stock.refreshOnDay}</p>

      <div className="facility-crew-split">
        <ul className={`facility-action-grid${selectedId ? " has-selection" : ""}`}>
          {available.length === 0 ? (
            <li className="facility-detail-copy">Nothing left on the floor. Return after a refresh.</li>
          ) : (
            available.map((listing) => {
              const item = getItemDefinition(listing.itemId);
              return (
                <li key={listing.listingId}>
                  <FacilityActionCard
                    active={listing.listingId === selected?.listingId}
                    body={
                      isAuction
                        ? `Ask ฿${listing.price} · open ฿${listing.startingBid ?? listing.price}`
                        : `฿${listing.price}`
                    }
                    iconSrc={itemIconSrc(listing.itemId)}
                    kicker={isAuction ? "Lot" : "Stall"}
                    onClick={() => setSelectedId(listing.listingId)}
                    title={item?.name ?? listing.itemId}
                  />
                </li>
              );
            })
          )}
        </ul>

        <aside className="detail-panel panel facility-detail">
          {selected && def ? (
            <>
              <div>
                <p className="overlay-eyebrow">{isAuction ? "Winning bid" : "On the table"}</p>
                <span className="inventory-detail-art-wrap" aria-hidden="true">
                  <img alt="" className="inventory-detail-art" src={itemIconSrc(selected.itemId)} />
                </span>
                <h3 className="font-display text-2xl text-gold">{def.name}</h3>
                <p className="facility-detail-copy">{def.description}</p>
              </div>
              {isAuction ? (
                <p className="facility-detail-copy">
                  NPCs may outbid you — deposits are lost when that happens.
                </p>
              ) : null}
              <FacilityActionCard
                body={`${isAuction ? "Winning bid" : "Price"} ฿${price}`}
                disabled={!affordable}
                kicker={affordable ? `฿${price}` : "Short on berries"}
                onClick={() => onBuy(selected.listingId)}
                title={isAuction ? "Place bid" : "Buy"}
              />
            </>
          ) : (
            <p className="facility-detail-copy">Select a lot.</p>
          )}
          {isDev && onRefresh ? (
            <FacilityActionCard
              body="Rerolls the floor without waiting for the next island day."
              kicker="Dev"
              onClick={onRefresh}
              title="Refresh stock"
            />
          ) : null}
        </aside>
      </div>
    </OverlayFrame>
  );
}
