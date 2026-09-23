import { useState } from "react";
import { itemIconSrc, itemRarityGlowClass } from "../data/marketShop";

type ShopItemCardProps = {
  itemId: string;
  name: string;
  price?: number;
  /** Replaces the berry price line (e.g. hold quantity). */
  footer?: string;
  iconSrc?: string;
  rarityClass?: string;
  selected?: boolean;
  onSelect: () => void;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function ShopItemCard({
  itemId,
  name,
  price,
  footer,
  iconSrc,
  rarityClass,
  selected = false,
  onSelect,
}: ShopItemCardProps) {
  const [hasArt, setHasArt] = useState(true);
  const glowClass = rarityClass ?? itemRarityGlowClass(itemId);
  const artSrc = iconSrc ?? itemIconSrc(itemId);

  return (
    <button
      aria-pressed={selected}
      className={`shop-item-card select-card${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <p className="font-display shop-item-card-name">{name}</p>
      <div
        className={["shop-item-card-portrait", hasArt ? "has-art" : "", glowClass].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
        {hasArt ? (
          <img alt="" className="shop-item-card-art" onError={() => setHasArt(false)} src={artSrc} />
        ) : (
          initialsFor(name)
        )}
      </div>
      <p className="shop-item-card-price">{footer ?? (price != null ? `฿${price}` : "")}</p>
    </button>
  );
}
