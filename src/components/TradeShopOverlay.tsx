import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { clampMarketQuantity, MARKET_QTY_PRESETS, marketBuyLimit } from "../data/marketShop";
import { OverlayFrame } from "./OverlayFrame";
import { ShopItemCard } from "./ShopItemCard";

export type TradeShopTab = {
  id: string;
  label: string;
  iconSrc?: string;
};

export type TradeShopListing = {
  id: string;
  name: string;
  description: string;
  price: number;
  tab: string;
  iconSrc: string;
  rarityClass?: string;
  meta?: string;
  maxQuantity?: number;
};

export type TradeShopOverlayProps = {
  eyebrow: string;
  title: string;
  flavor?: string;
  berries: number;
  tabs: readonly TradeShopTab[];
  pack: TradeShopListing[];
  shop: TradeShopListing[];
  emptyPack?: string;
  emptyAisle?: string;
  emptyShop?: string;
  emptyDetail?: string;
  ownedCount: (id: string) => number;
  buyPrice: (id: string) => number | null;
  sellPrice: (id: string) => number | null;
  onBuy: (id: string, quantity?: number) => string;
  onSell: (id: string, quantity?: number) => string;
  onClose: () => void;
};

type TradeSelection = {
  listing: TradeShopListing;
  source: "own" | "shop";
};

const TAB_WAVE_RANGE = 150;
const TAB_WAVE_PEAK = 1.22;

function tabWaveScale(distance: number): number {
  const t = Math.max(0, 1 - distance / TAB_WAVE_RANGE);
  const eased = t * t * (3 - 2 * t);
  return 1 + (TAB_WAVE_PEAK - 1) * eased;
}

function matchesTab(listing: TradeShopListing, tab: string): boolean {
  return tab === "all" || listing.tab === tab;
}

export function TradeShopOverlay({
  eyebrow,
  title,
  flavor = "Select a good. Trade in the middle.",
  berries,
  tabs,
  pack,
  shop,
  emptyPack = "Nothing the stall will buy.",
  emptyAisle = "Nothing in this aisle.",
  emptyShop = "Nothing on this shelf.",
  emptyDetail = "Choose a good from your pack or the stall.",
  ownedCount,
  buyPrice,
  sellPrice,
  onBuy,
  onSell,
  onClose,
}: TradeShopOverlayProps) {
  const tabRefs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});
  const [tabScales, setTabScales] = useState<Partial<Record<string, number>>>({});
  const [shopTab, setShopTab] = useState(tabs[0]?.id ?? "all");
  const [selected, setSelected] = useState<TradeSelection | null>(null);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [sellArmed, setSellArmed] = useState(false);
  const [flash, setFlash] = useState("");

  const visiblePack = pack.filter((entry) => matchesTab(entry, shopTab));
  const shopItems = shop.filter((entry) => matchesTab(entry, shopTab));
  const fromShop = selected?.source === "shop";
  const selectedId = selected?.listing.id ?? null;
  const liveListing = selectedId
    ? (fromShop ? shop : pack).find((entry) => entry.id === selectedId)
    : undefined;
  const selectedListing = liveListing ?? selected?.listing;
  const unitBuy = selectedId ? buyPrice(selectedId) : null;
  const unitSell = selectedId ? sellPrice(selectedId) : null;
  const owned = selectedId ? ownedCount(selectedId) : 0;
  const listingCap = selectedListing?.maxQuantity;
  const maxBuy =
    unitBuy != null
      ? Math.min(marketBuyLimit(berries, unitBuy), listingCap ?? Number.POSITIVE_INFINITY)
      : 0;
  const maxSell = Math.min(owned, listingCap ?? owned);
  const qtyCap = Math.max(fromShop ? maxBuy : maxSell, 1);
  const quantity = clampMarketQuantity(Number.parseInt(qtyDraft, 10), qtyCap);
  const buyQty = Math.min(quantity, maxBuy);
  const sellQty = Math.min(quantity, maxSell);
  const canBuy = Boolean(fromShop && selectedId && unitBuy != null && buyQty >= 1);
  const canSell = Boolean(!fromShop && selectedId && unitSell != null && sellQty >= 1);

  const compactTabs = tabs.length > 4;

  function waveTabs(event: MouseEvent<HTMLDivElement>) {
    const next: Partial<Record<string, number>> = {};
    for (const tab of tabs) {
      const node = tabRefs.current[tab.id];
      if (!node) {
        continue;
      }
      const box = node.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      next[tab.id] = tabWaveScale(Math.hypot(dx, dy));
    }
    setTabScales(next);
  }

  function resetTabWave() {
    setTabScales({});
  }

  function selectItem(listing: TradeShopListing, source: "own" | "shop") {
    setSelected({ listing, source });
    setQtyDraft("1");
    setSellArmed(false);
  }

  function applyPreset(value: number | "all") {
    if (!selected) {
      return;
    }
    const sourceMax = selected.source === "shop" ? Math.max(maxBuy, 1) : Math.max(maxSell, 1);
    const next = value === "all" ? sourceMax : clampMarketQuantity(value, sourceMax);
    setQtyDraft(String(next));
    setSellArmed(false);
  }

  function setCustomQty(raw: string) {
    setSellArmed(false);
    if (raw === "") {
      setQtyDraft("");
      return;
    }
    setQtyDraft(String(clampMarketQuantity(Number.parseInt(raw, 10), qtyCap)));
  }

  function tradeBuy() {
    if (!selectedId || !canBuy) {
      return;
    }
    setFlash(onBuy(selectedId, buyQty));
  }

  function requestSell() {
    if (!selectedId || !canSell) {
      return;
    }
    if (!sellArmed) {
      setSellArmed(true);
      return;
    }
    setFlash(onSell(selectedId, sellQty));
    setSellArmed(false);
  }

  const selectedName = selectedListing?.name ?? selectedId;
  const selectedDescription = selectedListing?.description ?? "";
  const selectedMeta = selectedListing?.meta ?? "";
  const selectedIcon = selectedListing?.iconSrc ?? "";
  const selectedRarity = selectedListing?.rarityClass ?? "";

  const qtyPresets = useMemo(() => MARKET_QTY_PRESETS, []);

  return (
    <OverlayFrame elevate eyebrow={eyebrow} onClose={onClose} title={title}>
      <div className="market-shop">
        <div className="market-shop-toolbar">
          <p className="item-market-flavor">{flavor}</p>
        </div>

        <div className="market-shop-split">
          <section className="market-shop-pane" aria-label="Own inventory">
            <header className="market-shop-pane-head market-shop-pane-head-own">
              <h3 className="font-display text-2xl text-gold">Own inventory</h3>
              <div className="market-shop-purse" title="Your berries">
                <img alt="" className="market-shop-purse-icon" src="/icons/UI/money.png" />
                <strong className="font-display">฿{berries}</strong>
              </div>
            </header>
            {pack.length === 0 ? (
              <p className="item-market-empty">{emptyPack}</p>
            ) : visiblePack.length === 0 ? (
              <p className="item-market-empty">{emptyAisle}</p>
            ) : (
              <ul className="market-shop-grid">
                {visiblePack.map((entry) => (
                  <li key={`own-${entry.id}`}>
                    <ShopItemCard
                      iconSrc={entry.iconSrc}
                      itemId={entry.id}
                      name={entry.name}
                      onSelect={() => selectItem(entry, "own")}
                      price={entry.price}
                      rarityClass={entry.rarityClass}
                      selected={selected?.listing.id === entry.id && selected.source === "own"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="market-shop-center">
            <div
              className={`market-shop-tabs${compactTabs ? " is-compact" : ""}`}
              onMouseLeave={resetTabWave}
              onMouseMove={waveTabs}
              role="tablist"
              aria-label="Shop aisles"
            >
              {tabs.map((tab) => (
                <button
                  aria-label={tab.label}
                  aria-selected={shopTab === tab.id}
                  className={`market-shop-tab${shopTab === tab.id ? " is-active" : ""}${tab.iconSrc ? " has-icon" : ""}`}
                  key={tab.id}
                  onClick={() => setShopTab(tab.id)}
                  ref={(node) => {
                    tabRefs.current[tab.id] = node;
                  }}
                  role="tab"
                  style={{ "--tab-scale": tabScales[tab.id] ?? 1 } as CSSProperties}
                  type="button"
                >
                  <span className="market-shop-tab-visual">
                    {tab.iconSrc ? <img alt="" className="market-shop-tab-icon" src={tab.iconSrc} /> : null}
                    {tab.id === "all" ? (
                      <span className="market-shop-tab-all">ALL</span>
                    ) : (
                      <span className="sr-only">{tab.label}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <section className="market-shop-pane market-shop-detail" aria-label="Selected item">
              {selected && selectedName ? (
                <>
                  <div
                    className={["market-shop-detail-portrait", selectedRarity].filter(Boolean).join(" ")}
                    aria-hidden="true"
                  >
                    <img alt="" src={selectedIcon} />
                  </div>
                  <h3 className="font-display text-3xl text-gold market-shop-detail-name">{selectedName}</h3>
                  {selectedMeta ? <p className="market-shop-detail-meta">{selectedMeta}</p> : null}
                  <p className="market-shop-detail-copy">{selectedDescription || "No stall notes on this one."}</p>
                  <dl className="market-shop-detail-stats">
                    <div>
                      <dt>Owned</dt>
                      <dd>{owned}</dd>
                    </div>
                    {fromShop ? (
                      <div>
                        <dt>Buy</dt>
                        <dd>{unitBuy != null ? `฿${unitBuy}` : "—"}</dd>
                      </div>
                    ) : (
                      <div>
                        <dt>Sell</dt>
                        <dd>{unitSell != null ? `฿${unitSell}` : "—"}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Total</dt>
                      <dd>
                        {fromShop
                          ? canBuy && unitBuy != null
                            ? `฿${unitBuy * buyQty}`
                            : "—"
                          : canSell && unitSell != null
                            ? `฿${unitSell * sellQty}`
                            : "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className="market-shop-qty" role="group" aria-label="Quantity">
                    {qtyPresets.map((preset) => (
                      <button
                        className={`market-shop-qty-btn${quantity === preset ? " is-active" : ""}`}
                        key={preset}
                        onClick={() => applyPreset(preset)}
                        type="button"
                      >
                        {preset}
                      </button>
                    ))}
                    <button className="market-shop-qty-btn" onClick={() => applyPreset("all")} type="button">
                      All
                    </button>
                    <label className="market-shop-qty-field">
                      <span className="sr-only">Custom quantity</span>
                      <input
                        inputMode="numeric"
                        min={1}
                        onBlur={() => setQtyDraft(String(quantity))}
                        onChange={(event) => setCustomQty(event.target.value.replace(/[^\d]/g, ""))}
                        type="number"
                        value={qtyDraft}
                      />
                    </label>
                  </div>

                  <div className="market-shop-detail-actions">
                    {fromShop ? (
                      <button className="choice-btn" disabled={!canBuy} onClick={tradeBuy} type="button">
                        {canBuy ? `Buy ×${buyQty}` : unitBuy == null ? "Not sold here" : "Buy (short)"}
                      </button>
                    ) : (
                      <button
                        className={`choice-btn${sellArmed ? " is-confirm" : ""}`}
                        disabled={!canSell}
                        onClick={requestSell}
                        type="button"
                      >
                        {!canSell
                          ? unitSell == null
                            ? "Not bought here"
                            : "Sell (none)"
                          : sellArmed
                            ? `Confirm sell ×${sellQty}`
                            : `Sell ×${sellQty}`}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="item-market-empty market-shop-detail-empty">{emptyDetail}</p>
              )}
            </section>
          </div>

          <section className="market-shop-pane" aria-label="Shop inventory">
            <header className="market-shop-pane-head">
              <h3 className="font-display text-2xl text-gold">Shop inventory</h3>
            </header>
            {shopItems.length === 0 ? (
              <p className="item-market-empty">{emptyShop}</p>
            ) : (
              <ul className="market-shop-grid">
                {shopItems.map((entry) => (
                  <li key={`shop-${entry.id}`}>
                    <ShopItemCard
                      iconSrc={entry.iconSrc}
                      itemId={entry.id}
                      name={entry.name}
                      onSelect={() => selectItem(entry, "shop")}
                      price={entry.price}
                      rarityClass={entry.rarityClass}
                      selected={selected?.listing.id === entry.id && selected.source === "shop"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className="fishing-flash" aria-live="polite">
          {flash || "\u00a0"}
        </p>
      </div>
    </OverlayFrame>
  );
}
