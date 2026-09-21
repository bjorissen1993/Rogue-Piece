import { MARINE_NAMES, PIRATE_NAMES, UNDERWORLD_NAMES } from "../data/npcs";
import { requireDevilFruit } from "../data/devilFruits";
import { getLocation } from "../data/locations";
import { TIME_OF_DAY_ORDER } from "../game/constants";
import type {
  AssignmentCompletionReport,
  NpcFaction,
  RunState,
  TimeOfDay,
  WorldCharacter,
  WorldHistoryEvent,
} from "../models/types";
import { createId } from "../utils/ids";
import { clamp } from "../utils/stats";
import type { RandomService } from "./RandomService";
import { TrainingService } from "./TrainingService";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { AfflictionService } from "./AfflictionService";
import { FactionService } from "./FactionService";
import { IslandService } from "./IslandService";
import { IslandPressureService } from "./IslandPressureService";

function pushNews(state: RunState, text: string): void {
  const event: WorldHistoryEvent = {
    id: createId("news"),
    day: state.day,
    text,
  };
  state.world.history.push(event);
}

function generateBuyer(fruitId: string, faction: NpcFaction, rng: RandomService): WorldCharacter {
  const fruit = requireDevilFruit(fruitId);
  const names =
    faction === "MARINE" ? MARINE_NAMES : faction === "PIRATE" ? PIRATE_NAMES : UNDERWORLD_NAMES;
  const tags = [
    "known_to_player",
    "acquired_sold_fruit",
    `fruit_${fruitId}`,
    `sold_to_${faction.toLowerCase()}`,
  ];
  if (fruitId !== "bomu_bomu") {
    tags.push("non_bomu_buyer");
  }

  return {
    id: createId("npc"),
    name: rng.pick(names),
    faction,
    raceId: "HUMAN",
    strength: 5 + fruit.rarity + rng.nextInt(0, 3),
    bounty: faction === "PIRATE" ? rng.nextInt(1500, 9000) : faction === "UNDERWORLD" ? rng.nextInt(400, 3000) : 0,
    devilFruitId: fruitId,
    alive: true,
    relationshipWithPlayer: -1,
    tags,
  };
}

function resolveTransit(state: RunState, fruitId: string, rng: RandomService): void {
  const entry = state.world.devilFruits.find((item) => item.fruitId === fruitId);
  if (!entry) {
    return;
  }

  const fruit = requireDevilFruit(fruitId);
  const forcePirate = fruitId === "bomu_bomu";
  const roll = forcePirate ? 0 : rng.next();

  let faction: NpcFaction | "LOST";
  if (roll < 0.4) {
    faction = "PIRATE";
  } else if (roll < 0.65) {
    faction = "MARINE";
  } else if (roll < 0.85) {
    faction = "UNDERWORLD";
  } else {
    faction = "LOST";
  }

  entry.transitRemaining = undefined;

  if (faction === "LOST") {
    entry.ownerCharacterId = null;
    if (rng.chance(0.5)) {
      entry.status = "UNCLAIMED";
      entry.history.push(`Day ${state.day}: Lost in transit. Unclaimed again.`);
      pushNews(state, `The ${fruit.name} sold days ago has slipped every ledger. It is unclaimed once more.`);
    } else {
      entry.status = "UNKNOWN";
      entry.history.push(`Day ${state.day}: Lost in transit. Whereabouts unknown.`);
      pushNews(state, `No one can say where the ${fruit.name} went after it was sold.`);
    }
    return;
  }

  const npc = generateBuyer(fruitId, faction, rng);
  state.world.characters.push(npc);
  entry.status = "NPC_USED";
  entry.ownerCharacterId = npc.id;
  entry.history.push(`Day ${state.day}: Claimed and eaten by ${npc.name} (${faction}).`);

  if (fruitId === "bomu_bomu" && faction === "PIRATE") {
    pushNews(state, "A rookie pirate has suddenly appeared using explosive powers.");
  } else if (faction === "PIRATE") {
    pushNews(state, `A rookie pirate named ${npc.name} has appeared using the ${fruit.name}.`);
  } else if (faction === "MARINE") {
    pushNews(state, `Marines report that ${npc.name} now wields the ${fruit.name}.`);
  } else {
    pushNews(state, `Underworld whispers say ${npc.name} paid dearly for the ${fruit.name}.`);
  }
}

function simulateWorld(state: RunState, rng: RandomService): void {
  const power = state.world.worldPower;
  power.worldGovernmentPower = clamp(power.worldGovernmentPower + rng.nextInt(0, 2), 0, 100);
  if (rng.chance(0.28)) {
    power.oppression = clamp(power.oppression + rng.nextInt(1, 3), 0, 100);
  }
  if (power.oppression > 38 && rng.chance(0.22)) {
    power.revolutionaryActivity = clamp(power.revolutionaryActivity + rng.nextInt(1, 2), 0, 100);
  }

  FactionService.ensureFactionWorld(state);

  const roll = rng.next();
  if (roll < 0.08) {
    power.oppression = clamp(power.oppression + 4, 0, 100);
    power.worldGovernmentPower = clamp(power.worldGovernmentPower + 2, 0, 100);
    FactionService.syncFromWorldSimulation(
      state,
      { WORLD_GOVERNMENT: 2, CIVILIANS: -2 },
      "Heavenly Tribute is raised again. Ports talk softly, then not at all.",
    );
  } else if (roll < 0.13) {
    power.oppression = clamp(power.oppression + 5, 0, 100);
    power.worldGovernmentPower = clamp(power.worldGovernmentPower + 3, 0, 100);
    power.revolutionaryActivity = clamp(power.revolutionaryActivity + 3, 0, 100);
    FactionService.syncFromWorldSimulation(
      state,
      { WORLD_GOVERNMENT: 2, REVOLUTIONARY_ARMY: 2, CIVILIANS: -3 },
      "A Government crackdown burns a free port. The smoke carries new names.",
    );
  } else if (roll < 0.18) {
    power.worldGovernmentPower = clamp(power.worldGovernmentPower - 2, 0, 100);
    FactionService.syncFromWorldSimulation(
      state,
      { MARINES: -2, PIRATES: 2 },
      "A Marine defeat is printed small and denied loudly.",
    );
  } else if (rng.chance(0.1)) {
    const location = getLocation(state.currentLocationId);
    const flavor = rng.pick([
      "A Marine warship was seen changing flags in the night. No one agrees what it means.",
      "Fishermen talk of fruits washing ashore that do not belong on any tree.",
      "An empty throne of influence — pirate or Marine — is drawing ambitious names.",
      "The underworld is buying maps, not weapons. Someone is hunting something specific.",
      `${location?.name ?? "This sea"} feels tighter. More uniforms. Fewer questions answered.`,
    ]);
    pushNews(state, flavor);
  }
}

export function fruitEncounterMultiplier(state: RunState): number {
  const last = state.world.lastDevilFruitDiscoveryDay;
  if (last === null) {
    return 1;
  }
  const days = state.day - last;
  if (days < 6) return 0.1;
  if (days < 10) return 0.22;
  if (days < 16) return 0.45;
  return 1;
}

export const WorldService = {
  addNews(state: RunState, text: string): void {
    if (!text.trim()) {
      return;
    }
    pushNews(state, text);
  },

  findNpcByTags(
    state: RunState,
    tags: string[],
    alive = true,
    options?: { recruitableOnly?: boolean },
  ): WorldCharacter | undefined {
    return state.world.characters.find((character) => {
      if (alive && !character.alive) {
        return false;
      }
      if (!tags.every((tag) => character.tags.includes(tag))) {
        return false;
      }
      if (options?.recruitableOnly) {
        const alreadyCrew =
          character.id === state.player.id ||
          character.id === "player" ||
          state.crew.some((entry) => entry.characterId === character.id) ||
          (state.fleet ?? []).some((entry) => entry.characterId === character.id);
        if (alreadyCrew) {
          return false;
        }
      }
      return true;
    });
  },

  /** First living tagged NPC who can still be offered a crew join. */
  findRecruitableNpcByTags(state: RunState, tags: string[]): WorldCharacter | undefined {
    return this.findNpcByTags(state, tags, true, { recruitableOnly: true });
  },

  upsertNpc(state: RunState, npc: WorldCharacter): void {
    const existing = state.world.characters.find((character) => character.id === npc.id);
    if (!existing) {
      state.world.characters.push(npc);
      return;
    }
    existing.alive = npc.alive;
    existing.relationshipWithPlayer += npc.relationshipWithPlayer;
    existing.bounty = Math.max(existing.bounty, npc.bounty);
    existing.strength = Math.max(existing.strength, npc.strength);
    for (const tag of npc.tags) {
      if (!existing.tags.includes(tag)) {
        existing.tags.push(tag);
      }
    }
  },

  afterEncounter(state: RunState, rng: RandomService): AssignmentCompletionReport[] {
    const slots = Math.max(0, state.pendingTimeCost ?? 1);
    state.pendingTimeCost = 0;
    return this.spendTime(state, slots, rng);
  },

  spendTime(state: RunState, slots: number, rng: RandomService): AssignmentCompletionReport[] {
    const completed: AssignmentCompletionReport[] = [];
    if (slots <= 0) {
      return completed;
    }
    let current = TIME_OF_DAY_ORDER.includes(state.timeOfDay)
      ? state.timeOfDay
      : ("MORNING" as TimeOfDay);
    let index = Math.max(0, TIME_OF_DAY_ORDER.indexOf(current));
    for (let step = 0; step < slots; step += 1) {
      if (index >= TIME_OF_DAY_ORDER.length - 1) {
        index = 0;
        this.turnDay(state, rng);
      } else {
        index += 1;
      }
      state.timeOfDay = TIME_OF_DAY_ORDER[index] ?? "MORNING";
      const finished = CharacterScheduleService.tickAfterTimeAdvance(state);
      completed.push(...finished);
      for (const report of finished) {
        if (report.summary) {
          state.lastFeedback = report.summary;
        }
      }
    }
    state.timeOfDay = TIME_OF_DAY_ORDER[index] ?? "MORNING";
    const pressureLines = IslandPressureService.tickAshore(state, slots);
    if (pressureLines.length) {
      state.lastFeedback = pressureLines[pressureLines.length - 1] ?? state.lastFeedback;
    }
    return completed;
  },

  turnDay(state: RunState, rng: RandomService): void {
    state.world.day += 1;
    state.day = state.world.day;
    TrainingService.resetDay(state);

    for (const fruit of state.world.devilFruits) {
      if (fruit.status !== "IN_TRANSIT") {
        continue;
      }
      fruit.transitRemaining = (fruit.transitRemaining ?? 1) - 1;
      if ((fruit.transitRemaining ?? 0) <= 0) {
        resolveTransit(state, fruit.fruitId, rng);
      }
    }

    const afflictionLines = AfflictionService.tickDaily(state);
    if (afflictionLines.length) {
      state.lastFeedback = afflictionLines[afflictionLines.length - 1] ?? state.lastFeedback;
    }

    simulateWorld(state, rng);
    this.tickCharacterProgression(state, rng);
  },

  tickCharacterProgression(state: RunState, rng: RandomService): void {
    for (const character of state.world.characters) {
      if (!character.alive || (character.importance ?? 0) < 2) {
        continue;
      }
      if (rng.chance(0.12)) {
        character.importance = (character.importance ?? 1) + 1;
        if (character.faction === "PIRATE") {
          character.bounty += rng.nextInt(200, 800);
          character.strength = Math.min(20, character.strength + 1);
        }
      }
    }
    if (rng.chance(0.08) && state.islands.length > 0) {
      const island = rng.pick(state.islands);
      island.dangerLevel = Math.min(10, island.dangerLevel + 1);
    }
  },

  getIslandIntroduction(state: RunState, regionLabel: string): string | null {
    const island = IslandService.getCurrentIsland(state);
    if (!island || island.introductionShown) {
      return null;
    }
    return IslandService.showIntroduction(state, island.id, regionLabel);
  },
};
