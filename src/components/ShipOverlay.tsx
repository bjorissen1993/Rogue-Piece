import { useMemo, useState } from "react";
import { getItemDefinition } from "../data/items";
import { itemIconSrc, itemRarityGlowClass } from "../data/marketShop";
import {
  shipArtSrc,
  shipCargoCapacity,
  shipCargoUsed,
  type ShipOverlayTab,
} from "../data/ships";
import type { InventoryItem, RunState } from "../models/types";
import { VoyageService } from "../services/VoyageService";
import { OverlayFrame } from "./OverlayFrame";
import { ShopItemCard } from "./ShopItemCard";

type ShipOverlayProps = {
  run: RunState;
  initialTab?: ShipOverlayTab;
  onClose: () => void;
};

function itemKey(item: InventoryItem): string {
  return item.id;
}

function cargoItemId(item: InventoryItem): string {
  return item.itemId || item.id;
}

export function ShipOverlay({ run, initialTab = "vessel", onClose }: ShipOverlayProps) {
  const ship = VoyageService.ensureShip(run);
  const [tab, setTab] = useState<ShipOverlayTab>(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cargo = run.player.inventory;
  const used = shipCargoUsed(cargo);
  const capacity = shipCargoCapacity(ship);
  const overCapacity = used > capacity;

  const selected = useMemo(
    () => cargo.find((item) => itemKey(item) === selectedId) ?? null,
    [cargo, selectedId],
  );
  const selectedDef =
    selected && selected.type !== "WEAPON" ? getItemDefinition(cargoItemId(selected)) : undefined;
  const selectedName = selected?.name || selectedDef?.name || selected?.id || "";
  const selectedCopy = selected?.description || selectedDef?.description || "";
  const selectedQty = selected ? (selected.quantity ?? 1) : 0;
  const selectedArtId = selected ? cargoItemId(selected) : "";

  return (
    <OverlayFrame elevate eyebrow="SHIP" onClose={onClose} title={ship.name}>
      <div className="ship-screen">
        <div className="crew-tabs" role="tablist" aria-label="Ship screen">
          <button
            aria-selected={tab === "vessel"}
            className={tab === "vessel" ? "crew-tab is-active" : "crew-tab"}
            onClick={() => setTab("vessel")}
            type="button"
          >
            Vessel
          </button>
          <button
            aria-selected={tab === "cargo"}
            className={tab === "cargo" ? "crew-tab is-active" : "crew-tab"}
            onClick={() => setTab("cargo")}
            type="button"
          >
            Cargo
          </button>
        </div>

        {tab === "vessel" ? (
          <div className="ship-vessel">
            <figure className="ship-vessel-art">
              <img alt="" src={shipArtSrc(ship)} />
            </figure>
            <aside className="ship-vessel-panel panel">
              <p className="overlay-eyebrow">Vessel</p>
              <h3 className="font-display text-2xl text-gold">{ship.name}</h3>
              <p className="ship-vessel-copy">Your ship at the pier. Chart a course from Harbor — Depart.</p>
              <dl className="ship-stats">
                <div>
                  <dt>Speed</dt>
                  <dd>{ship.speed.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>Hull</dt>
                  <dd>{Math.round(ship.condition)}%</dd>
                </div>
                <div>
                  <dt>Cargo</dt>
                  <dd className={overCapacity ? "is-over" : undefined}>
                    {used} / {capacity}
                  </dd>
                </div>
              </dl>
              <button className="ghost-btn ship-vessel-hold-btn" onClick={() => setTab("cargo")} type="button">
                Open hold
              </button>
            </aside>
          </div>
        ) : (
          <div className="ship-cargo">
            <header className="ship-cargo-meter">
              <div>
                <p className="overlay-eyebrow">Hold</p>
                <h3 className="font-display text-2xl text-gold">Cargo</h3>
              </div>
              <p className={`ship-cargo-load${overCapacity ? " is-over" : ""}`}>
                {used} / {capacity}
                <span>units stowed</span>
              </p>
              <div
                aria-label={`Hold ${used} of ${capacity}`}
                aria-valuemax={capacity}
                aria-valuemin={0}
                aria-valuenow={Math.min(used, capacity)}
                className="ship-cargo-track"
                role="progressbar"
              >
                <div
                  className={`ship-cargo-track-fill${overCapacity ? " is-over" : ""}`}
                  style={{ width: `${Math.min(100, (used / Math.max(1, capacity)) * 100)}%` }}
                />
              </div>
            </header>

            <div className="ship-cargo-split">
              <section className="ship-cargo-pane panel">
                {cargo.length === 0 ? (
                  <p className="item-market-empty">The hold is empty.</p>
                ) : (
                  <ul className="market-shop-grid">
                    {cargo.map((item) => {
                      const id = cargoItemId(item);
                      return (
                        <li key={itemKey(item)}>
                          <ShopItemCard
                            footer={`×${item.quantity ?? 1}`}
                            iconSrc={itemIconSrc(id)}
                            itemId={id}
                            name={item.name || getItemDefinition(id)?.name || id}
                            onSelect={() => setSelectedId(itemKey(item))}
                            rarityClass={itemRarityGlowClass(id)}
                            selected={selectedId === itemKey(item)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <aside className="market-shop-detail panel">
                {selected ? (
                  <>
                    <div
                      className={[
                        "market-shop-detail-portrait",
                        itemRarityGlowClass(selectedArtId),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <img alt="" src={itemIconSrc(selectedArtId)} />
                    </div>
                    <h3 className="font-display market-shop-detail-name">{selectedName}</h3>
                    <p className="market-shop-detail-meta">×{selectedQty} in the hold</p>
                    <p className="market-shop-detail-copy">
                      {selectedCopy || "Stowed below deck until you need it."}
                    </p>
                  </>
                ) : (
                  <p className="market-shop-detail-empty">Select a stack in the hold.</p>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
    </OverlayFrame>
  );
}
