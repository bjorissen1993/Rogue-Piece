import { useMemo, useState } from "react";
import { getDevilFruit } from "../data/devilFruits";
import { getItemDefinition } from "../data/items";
import { useIsMobile } from "../hooks/useMediaQuery";
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
import { CrewService } from "../services/CrewService";
import { DevilFruitService } from "../services/DevilFruitService";
import { WeaponService } from "../services/WeaponService";
import { InventoryCard } from "./CharacterCard";
import { ConfirmModal } from "./ConfirmModal";
import { ItemTargetPicker } from "./ItemTargetPicker";

type InventoryOverlayProps = {
  run: RunState;
  inCombat: boolean;
  initialSelectedId?: string | null;
  onClose: () => void;
  onUse: (itemId: string, targetCharacterId: string) => void;
  onFruitAction?: (action: "EAT" | "SELL" | "KEEP", fruitId: string) => void;
  onGiveFruitToCrew?: (fruitId: string, characterId: string) => void;
  onEquipWeapon?: (instanceId: string, slot: "primary" | "secondary") => void;
  onUnequipWeapon?: (instanceId: string) => void;
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
  onGiveFruitToCrew,
  onEquipWeapon,
  onUnequipWeapon,
}: InventoryOverlayProps) {
  const isMobile = useIsMobile();
  const [category, setCategory] = useState<InventoryCategory>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [confirm, setConfirm] = useState<null | { kind: "eat"; fruitId: string }>(null);
  const [pendingTarget, setPendingTarget] = useState<null | {
    kind: "item" | "fruit";
    itemId: string;
    label: string;
  }>(null);

  const fruit = run.player.devilFruitId ? getDevilFruit(run.player.devilFruitId) : undefined;
  const collectibles = useMemo(
    () => carriedCollectibleStacks(run.player.inventory),
    [run.player.inventory],
  );

  const list = useMemo(() => packItems(run.player.inventory, category), [category, run.player.inventory]);

  const selected =
    run.player.inventory.find((item) => item.id === selectedId) ??
    run.player.inventory.find((item) => (item.itemId || item.id) === selectedId) ??
    (isMobile ? null : list[0] ?? null);

  const def = selected && selected.type !== "WEAPON" ? getItemDefinition(selected.itemId || selected.id) : undefined;
  const weapon = selected ? WeaponService.resolveWeaponView(selected) : undefined;
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
            {isMobile ? (
              <div className="inventory-filter-mobile">
                <button
                  aria-expanded={filterOpen}
                  className="inventory-filter-trigger"
                  onClick={() => setFilterOpen((open) => !open)}
                  type="button"
                >
                  <span>
                    Filter · {INVENTORY_CATEGORY_LABELS[category]}
                    <span className="tab-badge">{tabBadgeCount(run.player.inventory, category)}</span>
                  </span>
                  <span aria-hidden="true">{filterOpen ? "▴" : "▾"}</span>
                </button>
                {filterOpen ? (
                  <ul className="inventory-filter-menu">
                    {INVENTORY_CATEGORIES.map((cat) => (
                      <li key={cat}>
                        <button
                          className={`inventory-filter-option ${category === cat ? "is-selected" : ""}`}
                          onClick={() => {
                            setCategory(cat);
                            selectFirstInView(cat);
                            setFilterOpen(false);
                          }}
                          type="button"
                        >
                          {INVENTORY_CATEGORY_LABELS[cat]}
                          <span className="tab-badge">{tabBadgeCount(run.player.inventory, cat)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
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
            )}

            {run.player.inventory.length === 0 ? (
              <p className="text-parchment-dim">The pack is empty.</p>
            ) : list.length === 0 && collectibles.length === 0 ? (
              <p className="text-parchment-dim">Nothing in {INVENTORY_CATEGORY_LABELS[category]}.</p>
            ) : (
              <div className={`split-overlay ${isMobile ? "is-mobile-inventory is-mobile-accordion" : ""}`}>
                <div className="split-pane">
                  {list.length > 0 ? (
                    <ul
                      className={
                        isMobile
                          ? "inventory-item-list"
                          : "split-grid ledger-grid inventory-grid"
                      }
                    >
                      {list.map((item) => {
                        const id = itemKey(item);
                        const qty = item.type === "WEAPON" ? "×1" : `×${item.quantity ?? 1}`;
                        const ownerLabel = item.weaponDefinitionId
                          ? WeaponService.weaponOwnerLabel(run, item)
                          : undefined;
                        const selectedRow = selectedId === id || (!isMobile && selected?.id === item.id);
                        const itemIsFruit = item.type === "DEVIL_FRUIT" || Boolean(item.fruitId);
                        const itemDef =
                          item.type !== "WEAPON" ? getItemDefinition(item.itemId || item.id) : undefined;
                        const itemWeapon = WeaponService.resolveWeaponView(item);
                        const itemShowUse = ItemService.canUseFromPack(item, inCombat);
                        const itemNote = ItemService.detailNote(item, inCombat);
                        return (
                          <li
                            className={selectedRow && isMobile ? "inventory-accordion-item is-open" : "inventory-accordion-item"}
                            key={`${id}-${item.weaponDefinitionId ?? item.fruitId ?? ""}`}
                          >
                            {isMobile ? (
                              <>
                                <button
                                  aria-expanded={selectedRow}
                                  className={`inventory-list-row ${selectedRow ? "is-selected" : ""}`}
                                  onClick={() => setSelectedId(selectedRow ? null : id)}
                                  type="button"
                                >
                                  <span className="inventory-list-name font-display">{item.name}</span>
                                  {ownerLabel ? (
                                    <span className="inventory-list-meta">{ownerLabel}</span>
                                  ) : null}
                                  <span className="inventory-list-qty">{qty}</span>
                                </button>
                                {selectedRow ? (
                                  <div className="inventory-accordion-body">
                                    <p className="hud-kicker">
                                      {isCarriedCollectible(item)
                                        ? "COLLECTIBLE"
                                        : categorizeItem(item).replaceAll("_", " ")}
                                    </p>
                                    <section className="detail-section mt-2">
                                      <p className="detail-label">Description</p>
                                      <p className="detail-value">{item.description}</p>
                                    </section>
                                    {itemWeapon ? (
                                      <section className="detail-section">
                                        <p className="detail-label">Weapon</p>
                                        <p className="detail-value">
                                          {itemWeapon.weaponType} · {itemWeapon.rarity} · dmg {itemWeapon.damage} · spd{" "}
                                          {itemWeapon.speed}
                                        </p>
                                        {onEquipWeapon && !inCombat ? (
                                          <div className="grid gap-2 mt-2">
                                            <button
                                              className="gold-btn"
                                              onClick={() => onEquipWeapon(item.id, "primary")}
                                              type="button"
                                            >
                                              Equip primary
                                            </button>
                                            <button
                                              className="ghost-btn"
                                              disabled={itemWeapon.grip === "TWO_HAND"}
                                              onClick={() => onEquipWeapon(item.id, "secondary")}
                                              type="button"
                                            >
                                              Equip secondary
                                            </button>
                                          </div>
                                        ) : null}
                                      </section>
                                    ) : null}
                                    {itemDef?.effects.some(
                                      (effect) => effect.type === "HEAL" || effect.type === "RESTORE_MP",
                                    ) ? (
                                      <section className="detail-section">
                                        <p className="detail-label">Effect</p>
                                        <p className="detail-value text-gold">
                                          {(() => {
                                            const lines: string[] = [];
                                            const previewHeal = ItemService.previewHeal(
                                              run.player,
                                              item.itemId || item.id,
                                            );
                                            if (previewHeal) {
                                              lines.push(
                                                `${previewHeal.label}. Current ${previewHeal.before} → ${previewHeal.after}.`,
                                              );
                                            }
                                            const previewMp = ItemService.previewMpRestore(
                                              run.player,
                                              item.itemId || item.id,
                                            );
                                            if (previewMp) {
                                              lines.push(
                                                `${previewMp.label}. Current ${previewMp.before} → ${previewMp.after}.`,
                                              );
                                            }
                                            return lines.length ? lines.join(" ") : "Restores resources";
                                          })()}
                                        </p>
                                      </section>
                                    ) : null}
                                    {itemNote ? (
                                      <p className="text-sm text-parchment-dim mt-2">{itemNote}</p>
                                    ) : null}
                                    <div className="inventory-accordion-actions">
                                      {itemIsFruit && item.fruitId ? (
                                        <div className="grid gap-2">
                                          <button
                                            className="gold-btn"
                                            onClick={() =>
                                              setPendingTarget({
                                                kind: "fruit",
                                                itemId: item.fruitId!,
                                                label: item.name,
                                              })
                                            }
                                            type="button"
                                          >
                                            Use on…
                                          </button>
                                          <button
                                            className="ghost-btn"
                                            onClick={() => onFruitAction?.("SELL", item.fruitId!)}
                                            type="button"
                                          >
                                            Sell
                                          </button>
                                          <button
                                            className="ghost-btn"
                                            onClick={() => onFruitAction?.("KEEP", item.fruitId!)}
                                            type="button"
                                          >
                                            Keep
                                          </button>
                                        </div>
                                      ) : null}
                                      {itemShowUse ? (
                                        <button
                                          className="gold-btn inventory-use-btn"
                                          onClick={() =>
                                            setPendingTarget({
                                              kind: "item",
                                              itemId: item.itemId || item.id,
                                              label: item.name,
                                            })
                                          }
                                          type="button"
                                        >
                                          Use on…
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <InventoryCard
                                name={item.name}
                                onClick={() => setSelectedId(id)}
                                quantityLabel={qty}
                                selected={selectedRow}
                                subtitle={ownerLabel}
                              />
                            )}
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
                {isMobile ? null : (
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
                          <p className="detail-label">Accuracy / Reach</p>
                          <p className="detail-value">
                            {weapon.accuracy} / {weapon.reach}
                          </p>
                        </section>
                        {weapon.special ? (
                          <section className="detail-section">
                            <p className="detail-label">Special</p>
                            <p className="detail-value">{weapon.special}</p>
                          </section>
                        ) : null}
                        <section className="detail-section">
                          <p className="detail-label">Grip</p>
                          <p className="detail-value">{weapon.grip === "TWO_HAND" ? "Two-handed" : "One-handed"}</p>
                        </section>
                        <section className="detail-section">
                          <p className="detail-label">Status</p>
                          <p className="detail-value text-gold">{WeaponService.weaponOwnerLabel(run, selected)}</p>
                        </section>
                        {onEquipWeapon && !inCombat ? (
                          <div className="grid gap-2 mt-2">
                            <button
                              className="gold-btn"
                              onClick={() => onEquipWeapon(selected.id, "primary")}
                              type="button"
                            >
                              Equip primary
                            </button>
                            <button
                              className="ghost-btn"
                              disabled={weapon.grip === "TWO_HAND"}
                              onClick={() => onEquipWeapon(selected.id, "secondary")}
                              title={
                                weapon.grip === "TWO_HAND"
                                  ? "Two-handed weapons must be primary."
                                  : "Equip as off-hand (dual wield)."
                              }
                              type="button"
                            >
                              Equip secondary
                            </button>
                            {selected.equipped ? (
                              <button
                                className="ghost-btn"
                                onClick={() => onUnequipWeapon?.(selected.id)}
                                type="button"
                              >
                                Unequip
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-sm text-parchment-dim">
                            Reassign weapons from the {AffiliationService.getCrewLabel(run)} screen.
                          </p>
                        )}
                      </>
                    ) : null}
                    {def?.effects.some((effect) => effect.type === "HEAL" || effect.type === "RESTORE_MP") ? (
                      <section className="detail-section">
                        <p className="detail-label">Effect</p>
                        <p className="detail-value text-gold">
                          {(() => {
                            const lines: string[] = [];
                            const previewHeal = ItemService.previewHeal(run.player, selected.itemId || selected.id);
                            if (previewHeal) {
                              lines.push(`${previewHeal.label}. Current ${previewHeal.before} → ${previewHeal.after}.`);
                            }
                            const previewMp = ItemService.previewMpRestore(run.player, selected.itemId || selected.id);
                            if (previewMp) {
                              lines.push(`${previewMp.label}. Current ${previewMp.before} → ${previewMp.after}.`);
                            }
                            return lines.length ? lines.join(" ") : "Restores resources";
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
                          onClick={() =>
                            setPendingTarget({
                              kind: "fruit",
                              itemId: selected.fruitId!,
                              label: selected.name,
                            })
                          }
                          type="button"
                        >
                          Use on…
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
                      </div>
                    ) : null}

                    {showUseButton ? (
                      <button
                        className="gold-btn inventory-use-btn"
                        onClick={() =>
                          setPendingTarget({
                            kind: "item",
                            itemId: selected.itemId || selected.id,
                            label: selected.name,
                          })
                        }
                        type="button"
                      >
                        Use on…
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-parchment-dim">Select an item.</p>
              )}
            </aside>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {pendingTarget ? (
        <ItemTargetPicker
          itemLabel={pendingTarget.label}
          onCancel={() => setPendingTarget(null)}
          onPick={(characterId) => {
            if (pendingTarget.kind === "fruit") {
              if (characterId === run.player.id || characterId === "player") {
                setPendingTarget(null);
                setConfirm({ kind: "eat", fruitId: pendingTarget.itemId });
                return;
              }
              onGiveFruitToCrew?.(pendingTarget.itemId, characterId);
              setPendingTarget(null);
              return;
            }
            onUse(pendingTarget.itemId, characterId);
            setPendingTarget(null);
          }}
          options={
            pendingTarget.kind === "fruit"
              ? [
                  {
                    id: run.player.id,
                    name: run.player.name,
                    detail: DevilFruitService.canEat(run) ? "Eat (you)" : "Already bound",
                  },
                  ...CrewService.list(run)
                    .filter((entry) => !entry.character.devilFruitId)
                    .map((entry) => ({
                      id: entry.member.characterId,
                      name: entry.character.name,
                      detail: "Give fruit",
                    })),
                ].filter((entry) =>
                  entry.id === run.player.id ? DevilFruitService.canEat(run) : true,
                )
              : undefined
          }
          prompt={
            pendingTarget.kind === "fruit"
              ? "Who should eat this Devil Fruit? This choice is permanent."
              : "Who should this item be used on?"
          }
          run={run}
        />
      ) : null}

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
