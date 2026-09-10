import { useMemo, useState } from "react";
import { getDevilFruit } from "../data/devilFruits";
import { getItemDefinition } from "../data/items";
import { getWeapon } from "../data/weapons";
import type { InventoryCategory, InventoryItem, RunState } from "../models/types";
import {
  carriedCollectibleStacks,
  categorizeItem,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
  isCarriedCollectible,
  ItemService,
  packItems,
} from "../services/ItemService";
import { AffiliationService } from "../services/AffiliationService";
import { WeaponService } from "../services/WeaponService";
import { InventoryCard } from "./CharacterCard";
import { ConfirmModal } from "./ConfirmModal";

type InventoryOverlayProps = {
  run: RunState;
  inCombat: boolean;
  initialSelectedId?: string | null;
  onClose: () => void;
  onUse: (itemId: string) => void;
  onFruitAction?: (action: "EAT" | "SELL" | "KEEP", fruitId: string) => void;
};

function itemKey(item: InventoryItem): string {
  return item.id;
}

function tabBadgeCount(inventory: InventoryItem[], category: InventoryCategory): number {
  if (category === "ALL") {
    return ItemService.totalQuantity(packItems(inventory));
  }
  return packItems(inventory, category).length;
}

export function InventoryOverlay({
  run,
  inCombat,
  initialSelectedId,
  onClose,
  onUse,
  onFruitAction,
}: InventoryOverlayProps) {
  const [category, setCategory] = useState<InventoryCategory>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [confirm, setConfirm] = useState<null | { kind: "eat"; fruitId: string }>(null);

  const fruit = run.player.devilFruitId ? getDevilFruit(run.player.devilFruitId) : undefined;
  const collectibles = useMemo(
    () => carriedCollectibleStacks(run.player.inventory),
    [run.player.inventory],
  );

  const list = useMemo(() => packItems(run.player.inventory, category), [category, run.player.inventory]);

  const selected =
    run.player.inventory.find((item) => item.id === selectedId) ??
    run.player.inventory.find((item) => (item.itemId || item.id) === selectedId) ??
    list[0] ??
    null;

  const def = selected && selected.type !== "WEAPON" ? getItemDefinition(selected.itemId || selected.id) : undefined;
  const weapon = selected?.weaponDefinitionId ? getWeapon(selected.weaponDefinitionId) : undefined;
  const detailNote = selected ? ItemService.detailNote(selected, inCombat) : null;
  const isFruit = selected?.type === "DEVIL_FRUIT" || Boolean(selected?.fruitId);
  const showUseButton = selected ? ItemService.canUseFromPack(selected, inCombat) : false;
  const collectibleTotal = collectibles.reduce((sum, entry) => sum + entry.quantity, 0);

  const selectCollectible = (inventoryId: string) => {
    setSelectedId(inventoryId);
  };

  const selectFirstInView = (cat: InventoryCategory) => {
    const nextList = packItems(run.player.inventory, cat);
    setSelectedId(nextList[0] ? itemKey(nextList[0]) : null);
  };

  return (
    <div className="overlay-scrim">
      <div className={`inventory-overlay-shell ${collectibles.length > 0 ? "has-collectibles" : ""}`}>
        {collectibles.length > 0 ? (
          <aside className="inventory-collectibles-special panel">
            <header className="inventory-collectibles-special-head">
              <p className="overlay-eyebrow">RELICS</p>
              <h2 className="font-display text-2xl text-gold">Collectibles</h2>
              <p className="inventory-collectibles-total">{collectibleTotal} carried</p>
            </header>
            <ul className="inventory-collectible-list">
              {collectibles.map((entry) => (
                <li key={entry.itemId}>
                  <button
                    className={`inventory-collectible-chip select-card ${
                      selectedId === entry.inventoryId ||
                      selected?.itemId === entry.itemId ||
                      selected?.id === entry.itemId
                        ? "is-selected"
                        : ""
                    }`}
                    onClick={() => selectCollectible(entry.inventoryId)}
                    type="button"
                  >
                    <span className="inventory-collectible-name font-display">{entry.name}</span>
                    <span className="inventory-collectible-count">×{entry.quantity}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        <section className="overlay-panel inventory-overlay-main">
          <header className="overlay-head">
            <div>
              <p className="overlay-eyebrow">PACK</p>
              <h2 className="font-display text-3xl text-gold">Inventory</h2>
            </div>
            <button className="ghost-btn py-2" onClick={onClose} type="button">
              Close
            </button>
          </header>

          <div className="overlay-body inventory-overlay-layout">
            {fruit ? <p className="inventory-fruit-note text-sm text-gold">Eaten: {fruit.name}</p> : null}
            <div className="inventory-tabs">
              {INVENTORY_CATEGORIES.map((cat) => (
                <button
                  className={`tab-btn ${category === cat ? "is-selected" : ""}`}
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    selectFirstInView(cat);
                  }}
                  type="button"
                >
                  {INVENTORY_CATEGORY_LABELS[cat]}
                  <span className="tab-badge">{tabBadgeCount(run.player.inventory, cat)}</span>
                </button>
              ))}
            </div>

            {run.player.inventory.length === 0 ? (
              <p className="text-parchment-dim">The pack is empty.</p>
            ) : list.length === 0 && collectibles.length === 0 ? (
              <p className="text-parchment-dim">Nothing in {INVENTORY_CATEGORY_LABELS[category]}.</p>
            ) : (
              <div className="split-overlay">
                <div className="split-pane">
                  {list.length > 0 ? (
                    <ul className="split-grid ledger-grid inventory-grid">
                      {list.map((item) => {
                        const id = itemKey(item);
                        const qty = item.type === "WEAPON" ? "×1" : `×${item.quantity ?? 1}`;
                        const ownerLabel = item.weaponDefinitionId
                          ? WeaponService.weaponOwnerLabel(run, item)
                          : undefined;
                        return (
                          <li key={`${id}-${item.weaponDefinitionId ?? item.fruitId ?? ""}`}>
                            <InventoryCard
                              name={item.name}
                              onClick={() => setSelectedId(id)}
                              quantityLabel={qty}
                              selected={selectedId === id || selected?.id === item.id}
                              subtitle={ownerLabel}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="inventory-empty-category text-parchment-dim">
                      No pack items in {INVENTORY_CATEGORY_LABELS[category]}.
                    </p>
                  )}
                </div>
                <aside className="detail-panel panel detail-panel-stack">
              {selected ? (
                <>
                  <div className="detail-panel-content">
                    <p className="hud-kicker">
                      {isCarriedCollectible(selected) ? "COLLECTIBLE" : categorizeItem(selected).replaceAll("_", " ")}
                    </p>
                    <h3 className="font-display mt-2 text-3xl">{selected.name}</h3>
                    <section className="detail-section mt-3">
                      <p className="detail-label">Description</p>
                      <p className="detail-value">{selected.description}</p>
                    </section>
                    {weapon ? (
                      <>
                        <section className="detail-section">
                          <p className="detail-label">Type</p>
                          <p className="detail-value">{weapon.weaponType}</p>
                        </section>
                        <section className="detail-section">
                          <p className="detail-label">Rarity</p>
                          <p className="detail-value">{weapon.rarity}</p>
                        </section>
                        <section className="detail-section">
                          <p className="detail-label">Damage</p>
                          <p className="detail-value">{weapon.damage}</p>
                        </section>
                        <section className="detail-section">
                          <p className="detail-label">Speed</p>
                          <p className="detail-value">{weapon.speed}</p>
                        </section>
                        <section className="detail-section">
                          <p className="detail-label">Status</p>
                          <p className="detail-value text-gold">{WeaponService.weaponOwnerLabel(run, selected)}</p>
                        </section>
                        <p className="text-sm text-parchment-dim">
                          Reassign weapons from the {AffiliationService.getCrewLabel(run)} screen.
                        </p>
                      </>
                    ) : null}
                    {def?.effects.some((effect) => effect.type === "HEAL") ? (
                      <section className="detail-section">
                        <p className="detail-label">Effect</p>
                        <p className="detail-value text-gold">
                          {(() => {
                            const previewHeal = ItemService.previewHeal(run.player, selected.itemId || selected.id);
                            if (!previewHeal) {
                              return "Restores HP";
                            }
                            return `${previewHeal.label}. Current ${previewHeal.before} → ${previewHeal.after}.`;
                          })()}
                        </p>
                      </section>
                    ) : null}
                    {detailNote ? (
                      <section className="detail-section">
                        <p className="detail-label">Note</p>
                        <p className="detail-value text-parchment-dim">{detailNote}</p>
                      </section>
                    ) : null}
                    {run.lastFeedback ? <p className="mt-3 text-sm text-gold">{run.lastFeedback}</p> : null}
                  </div>

                  <div className="detail-panel-actions">
                    {isFruit && selected.fruitId ? (
                      <div className="grid gap-2">
                        <button
                          className="gold-btn"
                          disabled={!DevilFruitCanEat(run)}
                          onClick={() => setConfirm({ kind: "eat", fruitId: selected.fruitId! })}
                          type="button"
                        >
                          Eat
                        </button>
                        <button
                          className="ghost-btn"
                          onClick={() => onFruitAction?.("SELL", selected.fruitId!)}
                          type="button"
                        >
                          Sell
                        </button>
                        <button
                          className="ghost-btn"
                          onClick={() => onFruitAction?.("KEEP", selected.fruitId!)}
                          type="button"
                        >
                          Keep
                        </button>
                        <p className="text-sm text-parchment-dim">
                          To give a fruit to a crewmate, drag it from the team screen.
                        </p>
                      </div>
                    ) : null}

                    {showUseButton ? (
                      <button
                        className="gold-btn inventory-use-btn"
                        onClick={() => onUse(selected.itemId || selected.id)}
                        type="button"
                      >
                        Use
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-parchment-dim">Select an item.</p>
              )}
            </aside>
              </div>
            )}
          </div>
        </section>
      </div>

      {confirm?.kind === "eat" ? (
        <ConfirmModal
          body="Eating a Devil Fruit is permanent. A second fruit would kill you."
          confirmLabel="Eat"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            onFruitAction?.("EAT", confirm.fruitId);
            setConfirm(null);
          }}
          title="Eat Devil Fruit?"
        />
      ) : null}
    </div>
  );
}

function DevilFruitCanEat(run: RunState): boolean {
  return run.player.devilFruitId === null;
}
