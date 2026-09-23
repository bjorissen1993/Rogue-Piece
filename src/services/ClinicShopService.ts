import { getItemDefinition } from "../data/items";
import { clinicSellPrice, clinicShopPrice } from "../data/clinicShop";
import type { ProfileSave, RunState } from "../models/types";
import { ItemService } from "./ItemService";

export type ClinicShopResult = {
  ok: boolean;
  message: string;
};

function wholeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.floor(quantity);
}

export const ClinicShopService = {
  buy(run: RunState, itemId: string, profile?: ProfileSave, quantity = 1): ClinicShopResult {
    const def = getItemDefinition(itemId);
    const price = clinicShopPrice(itemId);
    const qty = wholeQuantity(quantity);
    if (!def || price == null) {
      return { ok: false, message: "The clinic does not sell this." };
    }
    if (qty < 1) {
      return { ok: false, message: "Choose how many to buy." };
    }
    const total = price * qty;
    if (run.player.berries < total) {
      run.lastFeedback = `Not enough berries for ${def.name}.`;
      return { ok: false, message: run.lastFeedback };
    }
    run.player.berries -= total;
    ItemService.grant(run, itemId, qty, profile);
    run.lastFeedback = qty === 1 ? `Bought ${def.name} for ฿${price}.` : `Bought ${def.name} ×${qty} for ฿${total}.`;
    return { ok: true, message: run.lastFeedback };
  },

  sell(run: RunState, itemId: string, quantity = 1): ClinicShopResult {
    const def = getItemDefinition(itemId);
    const price = clinicSellPrice(itemId);
    const qty = wholeQuantity(quantity);
    if (price == null || !def) {
      return { ok: false, message: "The clinic will not take that." };
    }
    if (qty < 1) {
      return { ok: false, message: "Choose how many to sell." };
    }
    if (ItemService.countOwned(run, itemId) < qty) {
      run.lastFeedback = `You have no ${def.name} to sell.`;
      return { ok: false, message: run.lastFeedback };
    }
    ItemService.remove(run, itemId, qty);
    const total = price * qty;
    run.player.berries += total;
    run.lastFeedback = qty === 1 ? `Sold ${def.name} for ฿${price}.` : `Sold ${def.name} ×${qty} for ฿${total}.`;
    return { ok: true, message: run.lastFeedback };
  },
};
