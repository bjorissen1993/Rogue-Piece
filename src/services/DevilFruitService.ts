import { DEVIL_FRUITS, requireDevilFruit } from "../data/devilFruits";
import { isOrdinaryFruitItem } from "../data/items";
import type {
  DevilFruit,
  DevilFruitAction,
  DevilFruitStatus,
  DevilFruitWorldState,
  InventoryItem,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { applyStatChanges } from "../utils/stats";
import type { RandomService } from "./RandomService";
import { DevilFruitCombatService } from "./DevilFruitCombatService";
import { LootDispositionService } from "./LootDispositionService";

const OCCUPIED_FRUIT_STATUSES: DevilFruitStatus[] = [
  "PLAYER_INVENTORY",
  "NPC_INVENTORY",
  "PLAYER_USED",
  "NPC_USED",
  "IN_TRANSIT",
  "WEAPON_BOUND",
  "REINCARNATING",
];

export type OrdinaryFruitLocation =
  | "SCENE"
  | "INVENTORY"
  | "CREW"
  | "NPC"
  | "CARGO"
  | "ENVIRONMENT";

export type OrdinaryFruitCandidate = {
  item: InventoryItem;
  location: OrdinaryFruitLocation;
  islandId: string | null;
  /** Internal closeness. Never show this number in UI. */
  proximity: number;
};

const LOCATION_PROXIMITY: Record<OrdinaryFruitLocation, number> = {
  SCENE: 10,
  INVENTORY: 8,
  CREW: 6,
  NPC: 5,
  CARGO: 4,
  ENVIRONMENT: 3,
};

export function fruitStatusLabel(status: DevilFruitStatus): string {
  switch (status) {
    case "UNCLAIMED":
      return "Available";
    case "PLAYER_INVENTORY":
    case "NPC_INVENTORY":
      return "Owned";
    case "PLAYER_USED":
    case "NPC_USED":
      return "Consumed by Character";
    case "WEAPON_BOUND":
      return "Bound to Weapon";
    case "REINCARNATING":
      return "Reincarnating";
    case "IN_TRANSIT":
      return "In transit";
    case "UNKNOWN":
      return "Unknown";
    default:
      return status;
  }
}

function fruitState(state: RunState, fruitId: string): DevilFruitWorldState | undefined {
  return state.world.devilFruits.find((entry) => entry.fruitId === fruitId);
}

function markSeen(state: RunState, fruitId: string): void {
  if (!state.player.flags.includes(`seen_fruit_${fruitId}`)) {
    state.player.flags.push(`seen_fruit_${fruitId}`);
  }
  state.world.lastDevilFruitDiscoveryDay = state.day;
}

function record(entry: DevilFruitWorldState, line: string): void {
  entry.history.push(line);
}

export const DevilFruitService = {
  getAll(): DevilFruit[] {
    return DEVIL_FRUITS;
  },

  get(id: string): DevilFruit | undefined {
    return DEVIL_FRUITS.find((fruit) => fruit.id === id);
  },

  unclaimed(state: RunState): DevilFruitWorldState[] {
    return state.world.devilFruits.filter((entry) => entry.status === "UNCLAIMED");
  },

  pickUnclaimed(state: RunState, rng: RandomService, preferId?: string): string | null {
    const open = this.unclaimed(state);
    if (open.length === 0) {
      return null;
    }
    if (preferId && open.some((entry) => entry.fruitId === preferId)) {
      if (rng.chance(0.45)) {
        return preferId;
      }
    }
    return rng.pick(open).fruitId;
  },

  canEat(state: RunState): boolean {
    return state.player.devilFruitId === null;
  },

  resolveAction(state: RunState, action: DevilFruitAction, rng: RandomService): string {
    const fruitId = action.fruitId === "BOUND" ? state.currentBoundFruitId : action.fruitId;
    if (!fruitId) {
      return "Whatever power was here is already gone.";
    }

    switch (action.action) {
      case "EAT":
        return this.eat(state, fruitId);
      case "KEEP":
        return this.keep(state, fruitId, { skipDisposition: true });
      case "SELL":
        return this.sell(state, fruitId, rng);
      case "LEAVE":
        return this.leave(state, fruitId);
      default:
        return "";
    }
  },

  eat(state: RunState, fruitId: string): string {
    const fruit = requireDevilFruit(fruitId);
    const entry = fruitState(state, fruitId);
    if (!entry) {
      return "The fruit is only a story.";
    }

    if (state.player.devilFruitId) {
      state.player.hp = 0;
      record(entry, `Day ${state.day}: ${state.player.name} tried to eat a second Devil Fruit.`);
      return "You cannot survive eating a second Devil Fruit.";
    }

    if (entry.status === "NPC_USED" || entry.status === "NPC_INVENTORY") {
      return `The ${fruit.name} already belongs to someone living.`;
    }
    if (entry.status === "WEAPON_BOUND") {
      return `The ${fruit.name} is bound to a weapon.`;
    }

    state.player.devilFruitId = fruitId;
    state.player.stats = applyStatChanges(
      state.player.stats,
      fruit.effects.reduce<Partial<RunState["player"]["stats"]>>((stats, effect) => {
        stats[effect.stat] = (stats[effect.stat] ?? 0) + effect.value;
        return stats;
      }, {}),
    );
    DevilFruitCombatService.grantStarters(state.player, fruitId);
    state.player.inventory = state.player.inventory.filter((item) => item.fruitId !== fruitId);
    entry.status = "PLAYER_USED";
    entry.ownerCharacterId = state.player.id;
    record(entry, `Day ${state.day}: Eaten by ${state.player.name}.`);
    markSeen(state, fruitId);
    return `The ${fruit.name} is yours now.`;
  },

  keep(state: RunState, fruitId: string, options?: { skipDisposition?: boolean }): string {
    const fruit = requireDevilFruit(fruitId);
    const entry = fruitState(state, fruitId);
    if (!entry) {
      return "There is no fruit to keep.";
    }
    if (entry.status === "NPC_USED" || entry.status === "PLAYER_USED") {
      return `The ${fruit.name} is already bound to a living user.`;
    }

    entry.status = "PLAYER_INVENTORY";
    entry.ownerCharacterId = state.player.id;
    record(entry, `Day ${state.day}: Taken into ${state.player.name}'s pack.`);
    markSeen(state, fruitId);
    if (!state.player.inventory.some((item) => item.fruitId === fruitId)) {
      state.player.inventory.push({
        id: createId("fruit"),
        itemId: fruitId,
        name: fruit.name,
        type: "DEVIL_FRUIT",
        description: fruit.description,
        fruitId,
        quantity: 1,
      });
      if (!options?.skipDisposition) {
        LootDispositionService.queue(state, {
          kind: "devil_fruit",
          fruitId,
          label: fruit.name,
        });
      }
    }
    return `You keep the ${fruit.name}.`;
  },

  sell(state: RunState, fruitId: string, rng: RandomService): string {
    const fruit = requireDevilFruit(fruitId);
    const entry = fruitState(state, fruitId);
    if (!entry) {
      return "There is no fruit to sell.";
    }
    if (entry.status === "PLAYER_USED" || entry.status === "NPC_USED") {
      return "A fruit already eaten cannot be sold.";
    }

    const price = 700 + fruit.rarity * 650 + rng.nextInt(0, 400);
    state.player.berries += price;
    state.player.inventory = state.player.inventory.filter((item) => item.fruitId !== fruitId);
    entry.status = "IN_TRANSIT";
    entry.ownerCharacterId = null;
    entry.transitRemaining = rng.nextInt(2, 4);
    record(
      entry,
      `Day ${state.day}: Sold by ${state.player.name} for ${price} berries. Now in transit.`,
    );
    markSeen(state, fruitId);
    return `You sell the ${fruit.name} for ${price} berries. It does not vanish from the world — it is already moving.`;
  },

  leave(state: RunState, fruitId: string): string {
    const fruit = requireDevilFruit(fruitId);
    const entry = fruitState(state, fruitId);
    if (!entry) {
      return "";
    }
    if (entry.status === "PLAYER_USED" || entry.status === "NPC_USED") {
      return "";
    }
    state.player.inventory = state.player.inventory.filter((item) => item.fruitId !== fruitId);
    entry.status = "UNCLAIMED";
    entry.ownerCharacterId = null;
    entry.transitRemaining = undefined;
    record(entry, `Day ${state.day}: Left unclaimed by ${state.player.name}.`);
    markSeen(state, fruitId);
    return `The ${fruit.name} remains in the world, ownerless.`;
  },

  /** Give a stored fruit to a crewmate. Permanent — they eat it. */
  giveToCrew(state: RunState, fruitId: string, characterId: string): string {
    const fruit = requireDevilFruit(fruitId);
    const entry = fruitState(state, fruitId);
    const character = state.world.characters.find((npc) => npc.id === characterId);
    if (!entry || !character) {
      return "There is no fruit or crewmate for that.";
    }
    if (!state.crew.some((member) => member.characterId === characterId)) {
      return `${character.name} is not in your crew.`;
    }
    if (character.devilFruitId) {
      return `${character.name} already has a Devil Fruit.`;
    }
    if (entry.status === "PLAYER_USED" || entry.status === "NPC_USED") {
      return "That power is already bound.";
    }
    const inPack = state.player.inventory.some((item) => item.fruitId === fruitId);
    if (!inPack && entry.status !== "PLAYER_INVENTORY") {
      return "You are not holding that fruit.";
    }
    state.player.inventory = state.player.inventory.filter((item) => item.fruitId !== fruitId);
    character.devilFruitId = fruitId;
    entry.status = "NPC_USED";
    entry.ownerCharacterId = characterId;
    record(entry, `Day ${state.day}: Given to ${character.name} by ${state.player.name}.`);
    markSeen(state, fruitId);
    return `${character.name} eats the ${fruit.name}. There is no taking it back.`;
  },

  eatFromInventory(state: RunState, fruitId: string): string {
    if (!this.canEat(state)) {
      return "You already ate a Devil Fruit. A second would kill you.";
    }
    return this.eat(state, fruitId);
  },

  migrateWorldFruits(state: RunState): void {
    if (!state.world.devilFruits) {
      state.world.devilFruits = [];
    }
    const seen = new Set<string>();
    state.world.devilFruits = state.world.devilFruits.filter((entry) => {
      if (seen.has(entry.fruitId)) {
        return false;
      }
      seen.add(entry.fruitId);
      entry.identified =
        entry.identified ??
        (state.player.flags.includes(`seen_fruit_${entry.fruitId}`) ||
          entry.status === "PLAYER_USED" ||
          entry.status === "PLAYER_INVENTORY");
      entry.hostWeaponInstanceId = entry.hostWeaponInstanceId ?? null;
      entry.hostWeaponName = entry.hostWeaponName ?? null;
      entry.lastKnownIslandId = entry.lastKnownIslandId ?? state.currentIslandId ?? null;
      return true;
    });
    for (const fruit of DEVIL_FRUITS) {
      if (seen.has(fruit.id)) {
        continue;
      }
      state.world.devilFruits.push({
        fruitId: fruit.id,
        status: "UNCLAIMED",
        ownerCharacterId: null,
        history: [`Migrated: ${fruit.name} exists in the world, unclaimed.`],
        identified: false,
        hostWeaponInstanceId: null,
        hostWeaponName: null,
        lastKnownIslandId: null,
      });
    }
  },

  getState(state: RunState, fruitId: string): DevilFruitWorldState | undefined {
    return fruitState(state, fruitId);
  },

  isOccupied(entry: DevilFruitWorldState): boolean {
    return OCCUPIED_FRUIT_STATUSES.includes(entry.status);
  },

  /** Fruits that must not appear in any generation pool. */
  occupiedFruitIds(state: RunState): string[] {
    return state.world.devilFruits.filter((entry) => this.isOccupied(entry)).map((entry) => entry.fruitId);
  },

  isAvailableForGeneration(state: RunState, fruitId: string): boolean {
    const entry = fruitState(state, fruitId);
    if (!entry) {
      return false;
    }
    return entry.status === "UNCLAIMED" || entry.status === "UNKNOWN";
  },

  bindToWeapon(
    state: RunState,
    fruitId: string,
    weaponInstanceId: string,
    weaponName: string,
  ): { ok: boolean; reason: string } {
    const fruit = requireDevilFruit(fruitId);
    const entry = fruitState(state, fruitId);
    if (!entry) {
      return { ok: false, reason: "That fruit is only a story." };
    }
    if (entry.status === "PLAYER_USED" || entry.status === "NPC_USED" || entry.status === "WEAPON_BOUND") {
      return { ok: false, reason: `The ${fruit.name} is already bound.` };
    }
    if (entry.status !== "PLAYER_INVENTORY" && !state.player.inventory.some((item) => item.fruitId === fruitId)) {
      return { ok: false, reason: "You are not holding that fruit." };
    }
    state.player.inventory = state.player.inventory.filter((item) => item.fruitId !== fruitId);
    entry.status = "WEAPON_BOUND";
    entry.ownerCharacterId = null;
    entry.hostWeaponInstanceId = weaponInstanceId;
    entry.hostWeaponName = weaponName;
    entry.identified = true;
    record(entry, `Day ${state.day}: Bound to weapon ${weaponName}.`);
    markSeen(state, fruitId);
    return { ok: true, reason: `${fruit.name} — Bound to Weapon — Host: ${weaponName}.` };
  },

  /**
   * Permanent host loss. Does not put the fruit in the player's inventory.
   * KO / durability 0 must not call this.
   */
  beginReincarnation(
    state: RunState,
    fruitId: string,
    rng: RandomService,
    options?: {
      reason?: string;
      candidates?: OrdinaryFruitCandidate[];
      currentIslandId?: string | null;
    },
  ): { ok: boolean; reason: string; placed: "local" | "world"; replacedItemId?: string } {
    const fruit = requireDevilFruit(fruitId);
    const entry = fruitState(state, fruitId);
    if (!entry) {
      return { ok: false, reason: "No fruit to release.", placed: "world" };
    }
    entry.status = "REINCARNATING";
    entry.ownerCharacterId = null;
    entry.hostWeaponInstanceId = null;
    const hostName = entry.hostWeaponName;
    entry.hostWeaponName = null;
    record(entry, `Day ${state.day}: ${options?.reason ?? "Host lost."} Reincarnating.`);

    const islandId = options?.currentIslandId ?? state.currentIslandId ?? null;
    const gathered = options?.candidates ?? this.gatherLocalOrdinaryFruits(state, islandId);
    const local = this.trySecretLocalReincarnation(state, entry, gathered, islandId, rng);
    if (local.ok) {
      return local;
    }

    entry.status = rng.chance(0.45) ? "UNKNOWN" : "UNCLAIMED";
    entry.identified = false;
    entry.lastKnownIslandId = islandId;
    record(entry, `Day ${state.day}: Reentered the world. Whereabouts uncertain.`);
    return {
      ok: true,
      reason: hostName
        ? `What lived in ${hostName} is gone from the wreck.`
        : `The ${fruit.name} has left this place.`,
      placed: "world",
    };
  },

  /** Test/debug: internal weights after diminishing returns. Do not show in UI. */
  inspectCandidateWeights(candidates: OrdinaryFruitCandidate[]): Array<{ location: OrdinaryFruitLocation; weight: number }> {
    const byLocation = new Map<OrdinaryFruitLocation, number>();
    return candidates.map((row) => {
      const count = (byLocation.get(row.location) ?? 0) + 1;
      byLocation.set(row.location, count);
      const dim = 1 / (1 + Math.pow(Math.max(0, count - 1), 0.72) * 0.85);
      return { location: row.location, weight: Math.max(0.05, row.proximity * dim) };
    });
  },

  localAttemptChance(candidates: OrdinaryFruitCandidate[]): number {
    const totalWeight = this.inspectCandidateWeights(candidates).reduce((sum, row) => sum + row.weight, 0);
    return Math.min(0.48, 0.08 + totalWeight * 0.03);
  },

  gatherLocalOrdinaryFruits(state: RunState, currentIslandId: string | null): OrdinaryFruitCandidate[] {
    const candidates: OrdinaryFruitCandidate[] = [];
    for (const item of state.player.inventory) {
      const itemId = item.itemId || item.id;
      if (!isOrdinaryFruitItem(itemId) || item.type === "DEVIL_FRUIT" || item.fruitId) {
        continue;
      }
      const crewHeld = Boolean(item.ownerCharacterId && item.ownerCharacterId !== state.player.id);
      candidates.push({
        item,
        location: crewHeld ? "CREW" : "INVENTORY",
        islandId: currentIslandId,
        proximity: crewHeld ? LOCATION_PROXIMITY.CREW : LOCATION_PROXIMITY.INVENTORY,
      });
    }
    return candidates;
  },

  trySecretLocalReincarnation(
    state: RunState,
    entry: DevilFruitWorldState,
    candidates: OrdinaryFruitCandidate[],
    currentIslandId: string | null,
    rng: RandomService,
  ): { ok: boolean; reason: string; placed: "local" | "world"; replacedItemId?: string } {
    const local = candidates.filter((row) => {
      if (!row.islandId || !currentIslandId) {
        return row.location === "INVENTORY" || row.location === "CREW" || row.location === "SCENE";
      }
      return row.islandId === currentIslandId;
    });
    if (local.length === 0) {
      return { ok: false, reason: "", placed: "world" };
    }

    const byLocation = new Map<OrdinaryFruitLocation, number>();
    const weighted = local.map((row) => {
      const count = (byLocation.get(row.location) ?? 0) + 1;
      byLocation.set(row.location, count);
      const dim = 1 / (1 + Math.pow(Math.max(0, count - 1), 0.72) * 0.85);
      return { row, weight: Math.max(0.05, row.proximity * dim) };
    });
    const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
    const chance = Math.min(0.48, 0.08 + totalWeight * 0.03);
    if (rng.next() > chance) {
      return { ok: false, reason: "", placed: "world" };
    }

    let roll = rng.next() * totalWeight;
    let pick = weighted[0]!;
    for (const row of weighted) {
      roll -= row.weight;
      if (roll <= 0) {
        pick = row;
        break;
      }
    }

    const fruit = requireDevilFruit(entry.fruitId);
    const target = pick.row.item;
    const qty = target.quantity ?? 1;
    if (qty > 1) {
      target.quantity = qty - 1;
      state.player.inventory.push({
        id: createId("fruit"),
        itemId: fruit.id,
        name: pick.row.location === "INVENTORY" && rng.chance(0.4) ? "Unknown Devil Fruit" : fruit.name,
        type: "DEVIL_FRUIT",
        description: pick.row.location === "INVENTORY" && rng.chance(0.4) ? "A fruit that was not this strange yesterday." : fruit.description,
        fruitId: fruit.id,
        quantity: 1,
      });
    } else {
      const unknown = rng.chance(0.55);
      target.itemId = fruit.id;
      target.fruitId = fruit.id;
      target.type = "DEVIL_FRUIT";
      target.name = unknown ? "Unknown Devil Fruit" : fruit.name;
      target.description = unknown
        ? "Something about this fruit is not the same."
        : fruit.description;
      target.quantity = 1;
    }

    entry.status = "PLAYER_INVENTORY";
    entry.ownerCharacterId = state.player.id;
    entry.identified = target.name !== "Unknown Devil Fruit";
    record(entry, `Day ${state.day}: Reincarnated into a nearby ordinary fruit.`);
    markSeen(state, entry.fruitId);
    return {
      ok: true,
      reason: "Something in your bag looks different...",
      placed: "local",
      replacedItemId: target.id,
    };
  },

  /**
   * Definitive death only. Combat KO must not call this.
   * Fruit bound to a surviving weapon stays bound.
   */
  onCharacterPermanentlyDead(state: RunState, characterId: string, rng: RandomService): string | null {
    const eaten = state.world.devilFruits.find(
      (entry) =>
        (entry.status === "PLAYER_USED" || entry.status === "NPC_USED") &&
        entry.ownerCharacterId === characterId,
    );
    if (!eaten) {
      return null;
    }
    const result = this.beginReincarnation(state, eaten.fruitId, rng, {
      reason: "User died.",
      currentIslandId: state.currentIslandId ?? null,
    });
    if (result.reason) {
      state.lastFeedback = result.reason;
    }
    return result.reason;
  },

  fruitHostLine(entry: DevilFruitWorldState | undefined): string {
    if (!entry) {
      return "—";
    }
    const fruit = this.get(entry.fruitId);
    const name = entry.identified === false ? "Unknown Devil Fruit" : fruit?.name ?? entry.fruitId;
    if (entry.status === "WEAPON_BOUND") {
      return `${name} — Bound to Weapon — Host: ${entry.hostWeaponName ?? "a weapon"}.`;
    }
    return `${name} — ${fruitStatusLabel(entry.status)}`;
  },

  /** Thin world-competition hook. Does not invent a faction AI. */
  tickWorldCompetition(state: RunState, rng: RandomService): void {
    for (const entry of state.world.devilFruits) {
      if (entry.status !== "UNCLAIMED" && entry.status !== "UNKNOWN") {
        continue;
      }
      if (!rng.chance(0.035)) {
        continue;
      }
      const fruit = requireDevilFruit(entry.fruitId);
      const label = entry.identified ? fruit.name : "a strange fruit";
      entry.history.push(`Day ${state.day}: Rumors moved around ${label}.`);
    }
  },
};
