import { DEFAULT_SHIP_CARGO_CAPACITY, DEFAULT_SHIP_HULL_ID } from "../game/constants";
import type { InventoryItem, PlayerShip } from "../models/types";

export const SHIP_HULL_IDS = ["Ship1", "Ship2", "Ship3", "Ship4", "Ship5"] as const;

export type ShipHullId = (typeof SHIP_HULL_IDS)[number];

export type ShipOverlayTab = "vessel" | "cargo";

/** File under `public/icons/Ships` for each hull. Current starter vessel uses Ship1. */
export const SHIP_ART_SRC: Record<ShipHullId, string> = {
  Ship1: "/icons/Ships/Ship1.png",
  Ship2: "/icons/Ships/Ship2.png",
  Ship3: "/icons/Ships/Ship3.png",
  Ship4: "/icons/Ships/Ship4.png",
  Ship5: "/icons/Ships/Ship5.png",
};

export function isShipHullId(value: string | null | undefined): value is ShipHullId {
  return Boolean(value && (SHIP_HULL_IDS as readonly string[]).includes(value));
}

export function resolveShipHullId(hullId?: string | null): ShipHullId {
  return isShipHullId(hullId) ? hullId : DEFAULT_SHIP_HULL_ID;
}

export function shipArtSrc(shipOrHull?: PlayerShip | string | null): string {
  const hullId = typeof shipOrHull === "string" || shipOrHull == null ? shipOrHull : shipOrHull.hullId;
  return SHIP_ART_SRC[resolveShipHullId(hullId)];
}

export function shipCargoCapacity(ship: PlayerShip): number {
  return Number.isFinite(ship.cargoCapacity) && (ship.cargoCapacity ?? 0) > 0
    ? ship.cargoCapacity!
    : DEFAULT_SHIP_CARGO_CAPACITY;
}

/** Hold load: stacked item quantities in the player's packs (the ship hold). */
export function shipCargoUsed(inventory: InventoryItem[]): number {
  return inventory.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}

export function shipScreenTabForChild(childId: string): ShipOverlayTab {
  return childId === "HARBOR_CARGO" ? "cargo" : "vessel";
}

export function shipOverlayOpensHold(focus?: "vessel" | "cargo"): ShipOverlayTab {
  return focus === "cargo" ? "cargo" : "vessel";
}
