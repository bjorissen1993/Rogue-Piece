import { DEVIL_FRUITS, requireDevilFruit } from "../data/devilFruits";
import type { DevilFruit, DevilFruitAction, DevilFruitWorldState, RunState } from "../models/types";
import { createId } from "../utils/ids";
import { applyStatChanges } from "../utils/stats";
import type { RandomService } from "./RandomService";
import { DevilFruitCombatService } from "./DevilFruitCombatService";
import { LootDispositionService } from "./LootDispositionService";

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
};
