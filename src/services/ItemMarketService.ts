import { ITEM_SHOP_PRICES, getItemDefinition } from "../data/items";
import type {
  ItemMarketKind,
  ItemMarketListing,
  ItemMarketStock,
  ProfileSave,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { IslandService } from "./IslandService";
import { ItemService } from "./ItemService";
import { KnowledgeService, getKnowledgeCollectable } from "./KnowledgeService";
import type { RandomService } from "./RandomService";
import { createRng } from "./RandomService";

const BLACK_MARKET_POOL = [
  "medical_kit",
  "strong_medicine",
  "smoke_bomb",
  "antidote",
  "energy_tonic",
  "marine_field_manual",
  "wanted_poster_scrap",
  "coral_charm",
] as const;

const AUCTION_POOL = [
  "medical_kit",
  "strong_medicine",
  "ancient_gear_diagram",
  "ancient_navigation_journal",
  "old_bounty_ledger",
  "forbidden_folio",
  "sky_island_fragment",
] as const;

function clampPrice(itemId: string, mult: number): number {
  const fromShop = ITEM_SHOP_PRICES[itemId];
  const fallback =
    itemId.includes("folio") || itemId.includes("diagram") || itemId.includes("journal")
      ? 180
      : itemId.includes("ledger") || itemId.includes("poster")
        ? 95
        : getItemDefinition(itemId)
          ? 110
          : 80;
  return Math.max(25, Math.round((fromShop ?? fallback) * mult));
}

function shopKeyFor(islandId: string, kind: ItemMarketKind): string {
  return `${islandId}:${kind}`;
}

function ensureMap(run: RunState): Record<string, ItemMarketStock> {
  if (!run.itemMarkets) {
    run.itemMarkets = {};
  }
  return run.itemMarkets;
}

function buildListings(
  kind: ItemMarketKind,
  rng: RandomService,
  count: number,
): ItemMarketListing[] {
  const pool = kind === "BLACK_MARKET" ? BLACK_MARKET_POOL : AUCTION_POOL;
  const listings: ItemMarketListing[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    let itemId = pool[rng.nextInt(0, pool.length - 1)]!;
    let guard = 0;
    while (used.has(itemId) && guard < 8) {
      itemId = pool[rng.nextInt(0, pool.length - 1)]!;
      guard += 1;
    }
    used.add(itemId);
    const priceMult = kind === "BLACK_MARKET" ? 1.15 + rng.next() * 0.55 : 1.05 + rng.next() * 0.7;
    const price = clampPrice(itemId, priceMult);
    listings.push({
      listingId: createId("mlot"),
      itemId,
      price,
      quantity: 1,
      sold: false,
      startingBid: kind === "AUCTION" ? Math.max(40, Math.round(price * 0.55)) : undefined,
      npcBidChance: kind === "AUCTION" ? 0.28 + rng.next() * 0.35 : undefined,
    });
  }
  return listings;
}

export const ItemMarketService = {
  shopKey(islandId: string | null | undefined, kind: ItemMarketKind): string {
    return shopKeyFor(islandId ?? "unknown", kind);
  },

  getStock(run: RunState, shopKey: string): ItemMarketStock | null {
    return ensureMap(run)[shopKey] ?? null;
  },

  availableListings(stock: ItemMarketStock): ItemMarketListing[] {
    return stock.listings.filter((entry) => !entry.sold && entry.quantity > 0);
  },

  ensureStock(
    run: RunState,
    kind: ItemMarketKind,
    rng: RandomService = createRng(`${run.seed}:${kind}:${run.day}`),
    options?: { forceRefresh?: boolean },
  ): ItemMarketStock {
    const island = IslandService.getCurrentIsland(run);
    const islandId = island?.id ?? run.currentIslandId ?? "unknown";
    const key = shopKeyFor(islandId, kind);
    const map = ensureMap(run);
    const existing = map[key];
    if (existing && !options?.forceRefresh && existing.refreshOnDay > run.day) {
      return existing;
    }
    const count = kind === "BLACK_MARKET" ? 4 + rng.nextInt(0, 2) : 3 + rng.nextInt(0, 2);
    const stock: ItemMarketStock = {
      shopKey: key,
      kind,
      shopName: kind === "BLACK_MARKET" ? "Black Market Stalls" : "Auction Floor",
      islandId,
      refreshOnDay: run.day + 2,
      flavor:
        kind === "BLACK_MARKET"
          ? "Keep your coin quiet and your back to the wall."
          : "Lots under cloth. NPCs will push the bid if they smell interest.",
      listings: buildListings(kind, rng, count),
    };
    map[key] = stock;
    return stock;
  },

  purchase(
    run: RunState,
    profile: ProfileSave | null,
    shopKey: string,
    listingId: string,
    rng: RandomService = createRng(`${run.seed}:buy:${listingId}`),
  ): { ok: boolean; message: string } {
    const stock = ensureMap(run)[shopKey];
    if (!stock) {
      return { ok: false, message: "No stock here." };
    }
    const listing = stock.listings.find((entry) => entry.listingId === listingId);
    if (!listing || listing.sold || listing.quantity <= 0) {
      return { ok: false, message: "That lot is gone." };
    }

    if (stock.kind === "AUCTION") {
      const npcChance = listing.npcBidChance ?? 0.35;
      if (rng.next() < npcChance) {
        const deposit = Math.min(run.player.berries, Math.round((listing.startingBid ?? listing.price) * 0.25));
        run.player.berries = Math.max(0, run.player.berries - deposit);
        listing.sold = true;
        listing.quantity = 0;
        return {
          ok: false,
          message: `An NPC outbids you at the last second. You lose ฿${deposit} in fees.`,
        };
      }
      listing.price = Math.max(listing.price, Math.round(listing.price * (1.05 + rng.next() * 0.2)));
    }

    if (run.player.berries < listing.price) {
      return { ok: false, message: "Not enough berries." };
    }

    run.player.berries -= listing.price;
    listing.sold = true;
    listing.quantity = 0;
    ItemService.grant(run, listing.itemId, 1, profile ?? undefined);
    const def = getItemDefinition(listing.itemId);
    if (getKnowledgeCollectable(listing.itemId)) {
      KnowledgeService.grantFromCollectable(run, profile, listing.itemId);
    }
    const label = def?.name ?? listing.itemId;
    return {
      ok: true,
      message:
        stock.kind === "AUCTION"
          ? `Gavel falls — you win ${label} for ฿${listing.price}.`
          : `You slip ${label} into your pack for ฿${listing.price}.`,
    };
  },
};
