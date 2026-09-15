import { computeHealAmount, computeMpRestoreAmount, getItemDefinition } from "../data/items";
import type {
  InventoryCategory,
  InventoryItem,
  ItemUseContext,
  Player,
  ProfileSave,
  RunState,
} from "../models/types";
import { clamp } from "../utils/stats";
import { CollectionService } from "./CollectionService";
import { CharacterService } from "./CharacterService";
import { CrewService } from "./CrewService";
import { MpService } from "./MpService";

export type ItemUseResult = {
  ok: boolean;
  message: string;
  consumed: boolean;
  freeAction: boolean;
  hpHealed: number;
  mpRestored: number;
  guaranteeEscape: boolean;
  itemName: string;
};

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  "ALL",
  "WEAPONS",
  "DEVIL_FRUITS",
  "CONSUMABLES",
  "MATERIALS",
  "QUEST_ITEMS",
  "KEY_ITEMS",
  "MISCELLANEOUS",
];

export const INVENTORY_FILTER_CATEGORIES: Exclude<InventoryCategory, "ALL">[] = [
  "WEAPONS",
  "DEVIL_FRUITS",
  "CONSUMABLES",
  "MATERIALS",
  "QUEST_ITEMS",
  "KEY_ITEMS",
  "MISCELLANEOUS",
];

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  ALL: "All",
  WEAPONS: "Weapons",
  DEVIL_FRUITS: "Devil Fruits",
  CONSUMABLES: "Consumables",
  MATERIALS: "Materials",
  QUEST_ITEMS: "Quest",
  KEY_ITEMS: "Key",
  MISCELLANEOUS: "Misc",
};

function stackOf(player: Player, itemId: string): InventoryItem | undefined {
  return player.inventory.find((item) => (item.itemId || item.id) === itemId && item.type !== "WEAPON");
}

function definitionIdOf(item: InventoryItem): string {
  return item.itemId || item.id;
}

export type CarriedCollectibleStack = {
  itemId: string;
  name: string;
  description: string;
  quantity: number;
  inventoryId: string;
};

export function isCarriedCollectible(item: InventoryItem): boolean {
  const def = getItemDefinition(definitionIdOf(item));
  return def?.useContext === "PASSIVE";
}

export function isCombatOnlyItem(item: InventoryItem): boolean {
  const def = getItemDefinition(definitionIdOf(item));
  return def?.useContext === "COMBAT";
}

export function carriedCollectibleStacks(inventory: InventoryItem[]): CarriedCollectibleStack[] {
  const stacks = new Map<string, CarriedCollectibleStack>();
  for (const item of inventory) {
    if (!isCarriedCollectible(item)) {
      continue;
    }
    const itemId = definitionIdOf(item);
    const qty = item.quantity ?? 1;
    const existing = stacks.get(itemId);
    if (existing) {
      existing.quantity += qty;
      continue;
    }
    stacks.set(itemId, {
      itemId,
      name: item.name,
      description: item.description,
      quantity: qty,
      inventoryId: item.id,
    });
  }
  return [...stacks.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function packItems(inventory: InventoryItem[], category: InventoryCategory = "ALL"): InventoryItem[] {
  const carried = inventory.filter((item) => !isCarriedCollectible(item));
  return category === "ALL" ? carried : carried.filter((item) => categorizeItem(item) === category);
}

type StoredCategory = Exclude<InventoryCategory, "ALL">;

export function categorizeItem(item: InventoryItem): StoredCategory {
  if (item.category && item.category !== "ALL") {
    return item.category;
  }
  if (item.type === "WEAPON" || item.weaponDefinitionId) {
    return "WEAPONS";
  }
  if (item.type === "DEVIL_FRUIT" || item.fruitId) {
    return "DEVIL_FRUITS";
  }
  if (item.type === "CONSUMABLE") {
    return "CONSUMABLES";
  }
  if (item.type === "MATERIAL") {
    return "MATERIALS";
  }
  if (item.type === "QUEST") {
    return "QUEST_ITEMS";
  }
  if (item.type === "KEY") {
    return "KEY_ITEMS";
  }
  const def = getItemDefinition(definitionIdOf(item));
  if (def?.category && def.category !== "ALL") {
    return def.category;
  }
  if (def?.type === "CONSUMABLE") return "CONSUMABLES";
  if (def?.type === "MATERIAL") return "MATERIALS";
  if (def?.useContext === "SPECIAL") return "KEY_ITEMS";
  const hay = `${item.name} ${item.description}`.toLowerCase();
  if (/chart|folio|key|map|contract/.test(hay)) return "KEY_ITEMS";
  if (/quest|letter|token/.test(hay)) return "QUEST_ITEMS";
  return "MISCELLANEOUS";
}

export const ItemService = {
  createStack(itemId: string, quantity = 1): InventoryItem | null {
    const def = getItemDefinition(itemId);
    if (!def) {
      return null;
    }
    return {
      id: def.id,
      itemId: def.id,
      name: def.name,
      type: def.type,
      description: def.description,
      quantity: Math.max(1, quantity),
      healAmount: (() => {
        const heal = def.effects.find((effect) => effect.type === "HEAL");
        return heal && heal.type === "HEAL" ? heal.amount : undefined;
      })(),
      category: def.category ?? categorizeItem({
        id: def.id,
        name: def.name,
        type: def.type,
        description: def.description,
      }),
    };
  },

  grant(run: RunState, itemId: string, quantity = 1, profile?: ProfileSave): InventoryItem | null {
    const stack = this.createStack(itemId, quantity);
    if (!stack) {
      return null;
    }
    const existing = stackOf(run.player, itemId);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + quantity;
      existing.itemId = itemId;
      if (profile) {
        CollectionService.discoverItem(profile, itemId);
      }
      return existing;
    }
    run.player.inventory.push(stack);
    if (profile) {
      CollectionService.discoverItem(profile, itemId);
    }
    return stack;
  },

  grantMany(run: RunState, items: InventoryItem[], profile?: ProfileSave): void {
    for (const item of items) {
      const id = definitionIdOf(item);
      if (item.type === "DEVIL_FRUIT" || item.fruitId) {
        run.player.inventory.push({
          ...item,
          itemId: item.itemId || item.id,
          quantity: item.quantity ?? 1,
          type: "DEVIL_FRUIT",
          category: "DEVIL_FRUITS",
        });
        if (item.fruitId && profile) {
          CollectionService.discoverFruit(profile, item.fruitId);
        }
        continue;
      }
      if (item.type === "WEAPON" || item.weaponDefinitionId) {
        run.player.inventory.push({
          ...item,
          type: "WEAPON",
          category: "WEAPONS",
          quantity: 1,
          equipped: item.equipped ?? false,
        });
        continue;
      }
      if (getItemDefinition(id)) {
        this.grant(run, id, item.quantity ?? 1, profile);
        continue;
      }
      run.player.inventory.push({
        ...item,
        itemId: id,
        quantity: item.quantity ?? 1,
        category: item.category ?? categorizeItem(item),
      });
      if (profile) {
        CollectionService.discoverItemByName(profile, item.name);
      }
    }
  },

  byCategory(inventory: InventoryItem[], category: InventoryCategory): InventoryItem[] {
    if (category === "ALL") {
      return inventory;
    }
    return inventory.filter((item) => categorizeItem(item) === category);
  },

  totalQuantity(inventory: InventoryItem[]): number {
    return inventory.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  },

  categoryCount(inventory: InventoryItem[], category: Exclude<InventoryCategory, "ALL">): number {
    return packItems(inventory, category).length;
  },

  canUseFromPack(item: InventoryItem, inCombat: boolean): boolean {
    if (item.type === "WEAPON" || item.weaponDefinitionId) {
      return false;
    }
    if (item.type === "DEVIL_FRUIT" || item.fruitId) {
      return false;
    }
    if (isCarriedCollectible(item) || isCombatOnlyItem(item)) {
      return false;
    }
    const itemId = definitionIdOf(item);
    const preview = this.previewUse(itemId);
    if (!preview.canUse) {
      return false;
    }
    return this.usableIn(itemId, inCombat ? "COMBAT" : "OUT_OF_COMBAT");
  },

  detailNote(item: InventoryItem, inCombat: boolean): string | null {
    if (item.type === "WEAPON" || item.weaponDefinitionId) {
      return null;
    }
    if (item.type === "DEVIL_FRUIT" || item.fruitId) {
      return null;
    }
    const def = getItemDefinition(definitionIdOf(item));
    if (!def) {
      return null;
    }
    if (def.useContext === "PASSIVE") {
      return "Carried in your pack. Its power comes from the collection.";
    }
    if (def.useContext === "COMBAT" && !inCombat) {
      return "Only usable during combat.";
    }
    if (def.useContext === "SPECIAL") {
      return "A special item — not something you consume from the pack.";
    }
    return null;
  },

  usableIn(itemId: string, context: ItemUseContext): boolean {
    const def = getItemDefinition(itemId);
    if (!def || def.useContext === "PASSIVE" || def.useContext === "SPECIAL") {
      return false;
    }
    if (def.useContext === "BOTH") {
      return context === "COMBAT" || context === "OUT_OF_COMBAT" || context === "BOTH";
    }
    return def.useContext === context;
  },

  combatItems(inventory: InventoryItem[]): InventoryItem[] {
    return inventory.filter(
      (item) => item.type !== "WEAPON" && this.usableIn(definitionIdOf(item), "COMBAT"),
    );
  },

  previewUse(itemId: string): { canUse: boolean; reason: string; defName: string } {
    const def = getItemDefinition(itemId);
    if (!def) {
      return { canUse: false, reason: "Unknown item.", defName: "Unknown" };
    }
    if (def.useContext === "PASSIVE") {
      return { canUse: false, reason: "This item works by being carried.", defName: def.name };
    }
    if (def.useContext === "SPECIAL") {
      return { canUse: false, reason: "This cannot simply be consumed.", defName: def.name };
    }
    if (!def.consumable && def.effects.every((effect) => effect.type === "NONE")) {
      return { canUse: false, reason: "Nothing happens if you use this.", defName: def.name };
    }
    return { canUse: true, reason: "", defName: def.name };
  },

  previewHeal(
    player: Player,
    itemId: string,
  ): { before: number; after: number; total: number; label: string } | null {
    const def = getItemDefinition(itemId);
    const heal = def?.effects.find((effect) => effect.type === "HEAL");
    if (!heal || heal.type !== "HEAL") {
      return null;
    }
    const total = computeHealAmount(heal.amount, heal.percentMaxHp, player.maxHp);
    const before = player.hp;
    const after = clamp(player.hp + total, 0, player.maxHp);
    const parts: string[] = [];
    if (heal.amount > 0) {
      parts.push(`+${heal.amount}`);
    }
    if (heal.percentMaxHp) {
      parts.push(`+${heal.percentMaxHp}% max HP`);
    }
    const label = parts.length ? `Restores ${parts.join(" ")} (${total} HP)` : `Restores ${total} HP`;
    return { before, after, total, label };
  },

  previewMpRestore(
    player: Player,
    itemId: string,
  ): { before: number; after: number; total: number; label: string } | null {
    const def = getItemDefinition(itemId);
    const restore = def?.effects.find((effect) => effect.type === "RESTORE_MP");
    if (!restore || restore.type !== "RESTORE_MP") {
      return null;
    }
    MpService.ensurePlayer(player);
    const maxMp = player.maxMp ?? MpService.maxMpFor(player);
    const current = player.mp ?? 0;
    const total = computeMpRestoreAmount(restore.amount, restore.percentMaxMp, maxMp);
    const after = clamp(current + total, 0, maxMp);
    const parts: string[] = [];
    if (restore.amount > 0) {
      parts.push(`+${restore.amount}`);
    }
    if (restore.percentMaxMp) {
      parts.push(`+${restore.percentMaxMp}% max MP`);
    }
    const label = parts.length ? `Restores ${parts.join(" ")} (${total} MP)` : `Restores ${total} MP`;
    return { before: current, after, total, label };
  },

  /** Center-stage combat hint for an inventory item. */
  combatHint(
    itemId: string,
    resources: { hp: number; maxHp: number; mp: number; maxMp: number },
    description?: string,
  ): string {
    const def = getItemDefinition(itemId);
    if (!def) {
      return "Unknown item.";
    }
    const lines: string[] = [def.name];
    if (description ?? def.description) {
      lines.push(description ?? def.description);
    }
    const effectLines: string[] = [];
    for (const effect of def.effects) {
      if (effect.type === "HEAL") {
        const total = computeHealAmount(effect.amount, effect.percentMaxHp, resources.maxHp);
        const actual = Math.min(total, Math.max(0, resources.maxHp - resources.hp));
        effectLines.push(actual > 0 ? `Restores ${total} HP` : `Restores ${total} HP (already full)`);
      }
      if (effect.type === "RESTORE_MP") {
        const total = computeMpRestoreAmount(effect.amount, effect.percentMaxMp, resources.maxMp);
        const actual = Math.min(total, Math.max(0, resources.maxMp - resources.mp));
        effectLines.push(actual > 0 ? `Restores ${total} MP` : `Restores ${total} MP (already full)`);
      }
      if (effect.type === "GUARANTEE_ESCAPE") {
        effectLines.push("Guarantees escape from this fight.");
      }
    }
    if (effectLines.length) {
      lines.push(effectLines.join(" · "));
    }
    return lines.join("\n");
  },

  unusableReason(item: InventoryItem, inCombat: boolean): string | null {
    if (item.type === "WEAPON" || item.weaponDefinitionId) {
      return null;
    }
    if (item.type === "DEVIL_FRUIT" || item.fruitId) {
      return null;
    }
    if (isCarriedCollectible(item)) {
      return null;
    }
    const preview = this.previewUse(definitionIdOf(item));
    if (!preview.canUse) {
      return null;
    }
    if (inCombat && !this.usableIn(definitionIdOf(item), "COMBAT")) {
      return "Only usable during combat.";
    }
    if (!inCombat && !this.usableIn(definitionIdOf(item), "OUT_OF_COMBAT")) {
      return "Only usable during combat.";
    }
    return null;
  },

  useOnPlayer(player: Player, itemId: string, context: ItemUseContext): ItemUseResult {
    const def = getItemDefinition(itemId);
    const fail = (message: string): ItemUseResult => ({
      ok: false,
      message,
      consumed: false,
      freeAction: false,
      hpHealed: 0,
      mpRestored: 0,
      guaranteeEscape: false,
      itemName: def?.name ?? "item",
    });
    if (!def) {
      return fail("That item is not in the ledger.");
    }
    const stack = stackOf(player, itemId);
    if (!stack || (stack.quantity ?? 0) <= 0) {
      return fail("You do not have that.");
    }
    if (!this.usableIn(itemId, context)) {
      if (def.useContext === "COMBAT") {
        return fail("This is for a fight, not the open deck.");
      }
      if (def.useContext === "OUT_OF_COMBAT") {
        return fail("Not while blades are out.");
      }
      return fail("This cannot be used here.");
    }

    MpService.ensurePlayer(player);
    let hpHealed = 0;
    let mpRestored = 0;
    let guaranteeEscape = false;
    for (const effect of def.effects) {
      if (effect.type === "HEAL") {
        const before = player.hp;
        const total = computeHealAmount(effect.amount, effect.percentMaxHp, player.maxHp);
        player.hp = clamp(player.hp + total, 0, player.maxHp);
        hpHealed += player.hp - before;
      }
      if (effect.type === "RESTORE_MP") {
        const maxMp = player.maxMp ?? MpService.maxMpFor(player);
        const before = player.mp ?? 0;
        const total = computeMpRestoreAmount(effect.amount, effect.percentMaxMp, maxMp);
        player.mp = clamp(before + total, 0, maxMp);
        mpRestored += (player.mp ?? 0) - before;
      }
      if (effect.type === "GUARANTEE_ESCAPE") {
        guaranteeEscape = true;
      }
    }

    let consumed = false;
    if (def.consumable) {
      stack.quantity = (stack.quantity ?? 1) - 1;
      consumed = true;
      if (stack.quantity <= 0) {
        player.inventory = player.inventory.filter((item) => item !== stack);
      }
    }

    const parts: string[] = [];
    if (hpHealed > 0) {
      parts.push(`${def.name} restored ${hpHealed} HP.`);
    } else if (def.effects.some((effect) => effect.type === "HEAL") && hpHealed === 0) {
      parts.push(`${def.name} did nothing for HP — you are already at full health.`);
    }
    if (mpRestored > 0) {
      parts.push(`${def.name} restored ${mpRestored} MP.`);
    } else if (def.effects.some((effect) => effect.type === "RESTORE_MP") && mpRestored === 0) {
      parts.push(`${def.name} did nothing for MP — your spirit is already full.`);
    }
    if (guaranteeEscape) {
      parts.push(`${def.name} guaranteed your escape.`);
    }
    if (!parts.length) {
      parts.push(`You use the ${def.name}.`);
    }

    return {
      ok: true,
      message: parts.join(" "),
      consumed,
      freeAction: Boolean(def.freeAction),
      hpHealed,
      mpRestored,
      guaranteeEscape,
      itemName: def.name,
    };
  },

  /**
   * Use a pack item on the captain or a crewmate. Consumables come from the
   * player inventory either way. Escape tools stay captain-only.
   */
  useOnTarget(
    run: RunState,
    itemId: string,
    targetCharacterId: string,
    context: ItemUseContext,
  ): ItemUseResult {
    const isPlayer =
      targetCharacterId === run.player.id ||
      targetCharacterId === "player" ||
      !targetCharacterId;
    if (isPlayer) {
      return this.useOnPlayer(run.player, itemId, context);
    }

    const def = getItemDefinition(itemId);
    const fail = (message: string): ItemUseResult => ({
      ok: false,
      message,
      consumed: false,
      freeAction: false,
      hpHealed: 0,
      mpRestored: 0,
      guaranteeEscape: false,
      itemName: def?.name ?? "item",
    });
    if (!def) {
      return fail("That item is not in the ledger.");
    }
    if (!CrewService.isCharacterAlreadyInCrew(run, targetCharacterId)) {
      return fail("That crewmate is not sailing with you.");
    }
    if (!this.usableIn(itemId, context)) {
      if (def.useContext === "COMBAT") {
        return fail("This is for a fight, not the open deck.");
      }
      if (def.useContext === "OUT_OF_COMBAT") {
        return fail("Not while blades are out.");
      }
      return fail("This cannot be used here.");
    }
    if (def.effects.some((effect) => effect.type === "GUARANTEE_ESCAPE")) {
      return fail("Only you can use that to escape.");
    }

    const stack = stackOf(run.player, itemId);
    if (!stack || (stack.quantity ?? 0) <= 0) {
      return fail("You do not have that.");
    }

    const inCombat = Boolean(run.combat && !run.combat.finished);
    const allyCombatant = inCombat
      ? run.combat?.party?.allyCombatants.find((ally) => ally.id === targetCharacterId)
      : undefined;

    let hpHealed = 0;
    let mpRestored = 0;
    let targetName = CharacterService.getCharacter(run, targetCharacterId)?.name ?? "crewmate";

    if (inCombat && allyCombatant) {
      targetName = allyCombatant.name;
      for (const effect of def.effects) {
        if (effect.type === "HEAL") {
          const total = computeHealAmount(effect.amount, effect.percentMaxHp, allyCombatant.maxHp);
          const before = allyCombatant.hp;
          const after = clamp(allyCombatant.hp + total, 0, allyCombatant.maxHp);
          hpHealed += after - before;
        }
        if (effect.type === "RESTORE_MP") {
          const maxMp = allyCombatant.maxMp ?? 0;
          const before = allyCombatant.mp ?? 0;
          const total = computeMpRestoreAmount(effect.amount, effect.percentMaxMp, maxMp);
          const after = clamp(before + total, 0, maxMp);
          mpRestored += after - before;
        }
      }
    } else {
      let plannedHp = 0;
      let plannedMp = 0;
      for (const effect of def.effects) {
        if (effect.type === "HEAL") {
          const vitals = CrewService.ensureMemberVitals(run, targetCharacterId);
          if (!vitals) {
            return fail("That crewmate is not sailing with you.");
          }
          plannedHp += computeHealAmount(effect.amount, effect.percentMaxHp, vitals.maxHp);
        }
        if (effect.type === "RESTORE_MP") {
          const vitals = CrewService.ensureMemberVitals(run, targetCharacterId);
          if (!vitals) {
            return fail("That crewmate is not sailing with you.");
          }
          plannedMp += computeMpRestoreAmount(effect.amount, effect.percentMaxMp, vitals.maxMp);
        }
      }
      const applied = CrewService.applyMemberHeal(run, targetCharacterId, plannedHp, plannedMp);
      if (!applied) {
        return fail("That crewmate is not sailing with you.");
      }
      hpHealed = applied.hpHealed;
      mpRestored = applied.mpRestored;
      targetName = applied.name;
    }

    let consumed = false;
    if (def.consumable) {
      stack.quantity = (stack.quantity ?? 1) - 1;
      consumed = true;
      if (stack.quantity <= 0) {
        run.player.inventory = run.player.inventory.filter((item) => item !== stack);
      }
    }

    const parts: string[] = [];
    if (hpHealed > 0) {
      parts.push(`${def.name} restored ${hpHealed} HP to ${targetName}.`);
    } else if (def.effects.some((effect) => effect.type === "HEAL")) {
      parts.push(`${def.name} did nothing for HP — ${targetName} is already at full health.`);
    }
    if (mpRestored > 0) {
      parts.push(`${def.name} restored ${mpRestored} MP to ${targetName}.`);
    } else if (def.effects.some((effect) => effect.type === "RESTORE_MP")) {
      parts.push(`${def.name} did nothing for MP — ${targetName}'s spirit is already full.`);
    }
    if (!parts.length) {
      parts.push(`You use the ${def.name} on ${targetName}.`);
    }

    return {
      ok: true,
      message: parts.join(" "),
      consumed,
      freeAction: Boolean(def.freeAction),
      hpHealed,
      mpRestored,
      guaranteeEscape: false,
      itemName: def.name,
    };
  },
};
