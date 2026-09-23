import {
  FRUITBOUND_REMNANT_ITEM_ID,
  SEASTONE_OPTIONS,
  seastoneCompatibleWithType,
} from "../data/weaponServices";
import { getDevilFruit } from "../data/devilFruits";
import {
  WEAPON_ADVANCED_UPGRADE_COST,
  WEAPON_FRUIT_BIND_COST,
  WEAPON_NAMING_COST,
  WEAPON_RENAME_COST,
  WEAPON_SEASTONE_COST,
  WEAPON_SERVICE_GATES,
  WEAPON_UPGRADE_COST,
} from "../data/weaponProgression";
import type {
  InventoryItem,
  RunState,
  SeastoneMod,
  WeaponNamingPath,
} from "../models/types";
import { createId } from "../utils/ids";
import type { RandomService } from "./RandomService";
import { DevilFruitService } from "./DevilFruitService";
import { WeaponProgressionService } from "./WeaponProgressionService";
import { WeaponService } from "./WeaponService";

export type WeaponServiceActionResult = { ok: boolean; reason: string };

function currentWielderId(run: RunState, item: InventoryItem): string {
  return item.ownerCharacterId ?? run.player.id;
}

export const WeaponServicesService = {
  gates: WEAPON_SERVICE_GATES,

  inspect(run: RunState, instanceId: string) {
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return null;
    }
    const progress = WeaponProgressionService.ensure(item);
    const wielderId = currentWielderId(run, item);
    const fruit = progress.devilFruit
      ? DevilFruitService.getState(run, progress.devilFruit.fruitId)
      : undefined;
    return {
      item,
      progress,
      view: WeaponService.resolveWeaponView(item),
      identity: WeaponProgressionService.identitySnapshot(item, wielderId),
      fruitLine: DevilFruitService.fruitHostLine(fruit),
      wielderId,
    };
  },

  compatibility(run: RunState, instanceId: string) {
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return { seastoneLocked: true, fruitLocked: true, seastoneReason: "Unknown weapon.", fruitReason: "Unknown weapon." };
    }
    const progress = WeaponProgressionService.ensure(item);
    const fruitLocked = progress.seastone.functional;
    const seastoneLocked = Boolean(progress.devilFruit);
    return {
      seastoneLocked,
      fruitLocked,
      seastoneReason: seastoneLocked
        ? "A Devil Fruit host cannot receive functional seastone."
        : null,
      fruitReason: fruitLocked ? "Functional seastone cannot receive a Devil Fruit." : null,
    };
  },

  upgrade(run: RunState, instanceId: string, advanced = false): WeaponServiceActionResult {
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return { ok: false, reason: "That weapon is not here." };
    }
    const wielderId = currentWielderId(run, item);
    const required = advanced ? WEAPON_SERVICE_GATES.ADVANCED_UPGRADE : WEAPON_SERVICE_GATES.UPGRADE;
    const gate = WeaponProgressionService.gateReason(item, wielderId, required);
    if (gate) {
      return { ok: false, reason: gate };
    }
    const cost = advanced ? WEAPON_ADVANCED_UPGRADE_COST : WEAPON_UPGRADE_COST;
    if (run.player.berries < cost) {
      return { ok: false, reason: `The smith wants ฿${cost}.` };
    }
    const progress = WeaponProgressionService.ensure(item);
    run.player.berries -= cost;
    if (advanced) {
      progress.advancedUpgradeLevel += 1;
      progress.history.push(`Advanced upgrade ${progress.advancedUpgradeLevel}.`);
    } else {
      progress.upgradeLevel += 1;
      progress.history.push(`Upgrade ${progress.upgradeLevel}.`);
    }
    return { ok: true, reason: `${WeaponProgressionService.displayName(item)} is sharper than it was.` };
  },

  applySeastone(run: RunState, instanceId: string, mod: SeastoneMod): WeaponServiceActionResult {
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return { ok: false, reason: "That weapon is not here." };
    }
    const option = SEASTONE_OPTIONS.find((entry) => entry.id === mod);
    if (!option) {
      return { ok: false, reason: "Unknown seastone work." };
    }
    const progress = WeaponProgressionService.ensure(item);
    if (progress.devilFruit) {
      return { ok: false, reason: "LOCKED: A Devil Fruit host cannot receive functional seastone." };
    }
    const wielderId = currentWielderId(run, item);
    const gate = WeaponProgressionService.gateReason(item, wielderId, WEAPON_SERVICE_GATES.SEASTONE);
    if (gate) {
      return { ok: false, reason: `LOCKED: ${gate}` };
    }
    if (run.player.berries < WEAPON_SEASTONE_COST) {
      return { ok: false, reason: `The smith wants ฿${WEAPON_SEASTONE_COST}.` };
    }
    const view = WeaponService.resolveWeaponView(item);
    const fit = view ? seastoneCompatibleWithType(mod, view.weaponType) : { ok: true };
    run.player.berries -= WEAPON_SEASTONE_COST;
    progress.seastone = { mod, functional: option.functional };
    if (mod === "FULL_CONVERSION" && item.generatedWeapon) {
      item.generatedWeapon.material = "SEA_STONE_ALLOY";
    }
    progress.history.push(`Seastone: ${option.label}.`);
    const warning = fit.warning ? ` ${fit.warning}` : "";
    return { ok: true, reason: `${option.label} is set.${warning}` };
  },

  bindDevilFruit(run: RunState, instanceId: string, fruitId: string): WeaponServiceActionResult {
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return { ok: false, reason: "That weapon is not here." };
    }
    const progress = WeaponProgressionService.ensure(item);
    if (progress.seastone.functional) {
      return { ok: false, reason: "LOCKED: Functional seastone cannot receive a Devil Fruit." };
    }
    if (progress.devilFruit) {
      return { ok: false, reason: "This weapon already hosts a Devil Fruit." };
    }
    const wielderId = currentWielderId(run, item);
    const gate = WeaponProgressionService.gateReason(item, wielderId, WEAPON_SERVICE_GATES.DEVIL_FRUIT_BIND);
    if (gate) {
      return { ok: false, reason: `LOCKED: ${gate}` };
    }
    if (WEAPON_FRUIT_BIND_COST > 0 && run.player.berries < WEAPON_FRUIT_BIND_COST) {
      return { ok: false, reason: "Not enough berries." };
    }
    const fruit = getDevilFruit(fruitId);
    if (!fruit) {
      return { ok: false, reason: "Unknown fruit." };
    }
    const hostName = WeaponProgressionService.displayName(item);
    const bound = DevilFruitService.bindToWeapon(run, fruitId, item.id, hostName);
    if (!bound.ok) {
      return bound;
    }
    progress.devilFruit = { fruitId, bondRank: "UNFAMILIAR" };
    progress.history.push(`Devil Fruit bound: ${fruit.name}.`);
    if (progress.soul.state === "DORMANT") {
      progress.soul.state = "STIRRING";
    }
    return { ok: true, reason: bound.reason };
  },

  rename(run: RunState, instanceId: string, name: string): WeaponServiceActionResult {
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return { ok: false, reason: "That weapon is not here." };
    }
    if (run.player.berries < WEAPON_RENAME_COST) {
      return { ok: false, reason: `The smith wants ฿${WEAPON_RENAME_COST} to cut a name.` };
    }
    const result = WeaponProgressionService.setBaseName(item, name);
    if (result.ok) {
      run.player.berries -= WEAPON_RENAME_COST;
    }
    return result;
  },

  applyNaming(
    run: RunState,
    instanceId: string,
    path: WeaponNamingPath,
    adjective: string,
  ): WeaponServiceActionResult {
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return { ok: false, reason: "That weapon is not here." };
    }
    if (run.player.berries < WEAPON_NAMING_COST) {
      return { ok: false, reason: `Naming work costs ฿${WEAPON_NAMING_COST}.` };
    }
    const result = WeaponProgressionService.applyNamingStage(item, { path, adjective });
    if (result.ok) {
      run.player.berries -= WEAPON_NAMING_COST;
    }
    return result;
  },

  /**
   * Permanent destroy of a host weapon. Not durability 0.
   * Releases a bound fruit into reincarnation (never into the player's hands).
   */
  destroyHost(
    run: RunState,
    instanceId: string,
    rng: RandomService,
    confirmPhrase: string,
  ): WeaponServiceActionResult {
    if (confirmPhrase.trim().toLowerCase() !== "destroy") {
      return { ok: false, reason: "Type DESTROY to unmake this weapon." };
    }
    const item = WeaponService.findInstance(run.player, instanceId);
    if (!item) {
      return { ok: false, reason: "That weapon is not here." };
    }
    const progress = WeaponProgressionService.ensure(item);
    const display = WeaponProgressionService.displayName(item);
    const fruitId = progress.devilFruit?.fruitId;
    const remnantName =
      progress.naming.historicalNamed || progress.naming.customNamed || progress.soul.state !== "DORMANT"
        ? `Remnant of ${display}`
        : "Fruitbound Remnant";

    const remnant: InventoryItem = {
      id: createId("rem"),
      itemId: FRUITBOUND_REMNANT_ITEM_ID,
      name: remnantName,
      type: "MATERIAL",
      description: fruitId
        ? `What remains of ${display}. Not a Devil Fruit.`
        : `Ash and story from ${display}.`,
      quantity: 1,
      category: "COLLECTABLES",
      remnant: {
        formerWeaponName: display,
        formerOwners: [...progress.legacy.formerOwners],
        soulEcho: progress.soul.trait !== "NONE" ? progress.soul.trait : undefined,
        fruitId,
        named: progress.naming.customNamed || progress.naming.historicalNamed,
        history: [...progress.history],
      },
    };

    WeaponService.removeWeaponInstance(run, instanceId);
    run.player.inventory.push(remnant);

    let fruitLine = "";
    if (fruitId) {
      const reincarnated = DevilFruitService.beginReincarnation(run, fruitId, rng, {
        reason: `${display} was permanently destroyed.`,
        currentIslandId: run.currentIslandId ?? null,
      });
      fruitLine = reincarnated.reason;
    }

    return {
      ok: true,
      reason: fruitLine
        ? `${display} is unmade. ${remnantName} remains. ${fruitLine}`
        : `${display} is unmade. ${remnantName} remains.`,
    };
  },

  ownedFruits(run: RunState): Array<{ fruitId: string; name: string }> {
    return run.player.inventory
      .filter((item) => item.type === "DEVIL_FRUIT" && item.fruitId)
      .map((item) => ({
        fruitId: item.fruitId!,
        name: getDevilFruit(item.fruitId!)?.name ?? item.name,
      }));
  },

};
