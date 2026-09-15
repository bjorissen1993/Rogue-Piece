import type { InventoryItem, PendingLootDisposition, RunState } from "../models/types";
import { DevilFruitService } from "./DevilFruitService";
import { WeaponService } from "./WeaponService";

function isWeaponItem(item: InventoryItem): boolean {
  return item.type === "WEAPON" || Boolean(item.weaponDefinitionId);
}

function isFruitItem(item: InventoryItem): boolean {
  return item.type === "DEVIL_FRUIT" || Boolean(item.fruitId);
}

export const LootDispositionService = {
  queue(run: RunState, entry: PendingLootDisposition): void {
    if (!run.pendingLootDispositions) {
      run.pendingLootDispositions = [];
    }
    run.pendingLootDispositions.push(entry);
  },

  peek(run: RunState): PendingLootDisposition | null {
    return run.pendingLootDispositions?.[0] ?? null;
  },

  shift(run: RunState): PendingLootDisposition | null {
    const next = run.pendingLootDispositions?.shift() ?? null;
    if (run.pendingLootDispositions?.length === 0) {
      run.pendingLootDispositions = undefined;
    }
    return next;
  },

  /** Unequipped weapons and packed devil fruits — shared crew backpack. */
  stashItems(run: RunState): InventoryItem[] {
    return run.player.inventory.filter((item) => {
      if (isWeaponItem(item)) {
        return !item.equipped;
      }
      if (isFruitItem(item)) {
        return Boolean(item.fruitId);
      }
      return false;
    });
  },

  resolveBackpack(run: RunState): string {
    const entry = this.shift(run);
    if (!entry) {
      return "";
    }
    return `${entry.label} stored in the shared backpack.`;
  },

  resolveWeapon(
    run: RunState,
    instanceId: string,
    characterId: string,
    slot?: "primary" | "secondary",
  ): string {
    const entry = this.shift(run);
    if (!entry || entry.kind !== "weapon") {
      return "";
    }
    if (characterId === run.player.id) {
      if (WeaponService.equipInstance(run, instanceId, run.player.id, slot ?? "primary")) {
        return `${entry.label} equipped.`;
      }
      return "Could not equip that weapon.";
    }
    const result = WeaponService.assignToCrew(run, instanceId, characterId, slot);
    return result.reason;
  },

  resolveFruit(run: RunState, fruitId: string, characterId: string): string {
    const entry = this.shift(run);
    if (!entry || entry.kind !== "devil_fruit") {
      return "";
    }
    if (characterId === run.player.id) {
      return DevilFruitService.eatFromInventory(run, fruitId);
    }
    return DevilFruitService.giveToCrew(run, fruitId, characterId);
  },

  assignWeaponFromStash(
    run: RunState,
    instanceId: string,
    characterId: string,
    slot?: "primary" | "secondary",
  ): string {
    if (characterId === run.player.id) {
      const resolved =
        slot ?? (WeaponService.findEquippedInstance(run.player, "primary") ? "secondary" : "primary");
      return WeaponService.equipInstance(run, instanceId, run.player.id, resolved)
        ? "Weapon equipped."
        : run.lastFeedback ?? "Could not equip.";
    }
    return WeaponService.assignToCrew(run, instanceId, characterId, slot).reason;
  },

  assignFruitFromStash(run: RunState, fruitId: string, characterId: string): string {
    if (characterId === run.player.id) {
      return DevilFruitService.eatFromInventory(run, fruitId);
    }
    return DevilFruitService.giveToCrew(run, fruitId, characterId);
  },
};
