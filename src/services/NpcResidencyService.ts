import { QUEST_NPC_NAMES } from "../data/questOutcomes";
import type { Island, NpcFaction, RunState, WorldCharacter } from "../models/types";
import { CharacterService } from "./CharacterService";

const SHELTER_ORDER = ["INN", "HARBOR", "CLINIC", "MARKET"];

function isLocalToIsland(character: WorldCharacter, islandId: string): boolean {
  return (
    character.homeLocationId === islandId ||
    character.currentLocationId === islandId ||
    character.firstMetIslandId === islandId
  );
}

function factionForTags(tags: string[]): NpcFaction {
  const hay = tags.join(" ").toLowerCase();
  if (hay.includes("faction-controlled") || hay.includes("official") || hay.includes("guards") || hay.includes("high-security")) {
    return "MARINE";
  }
  if (hay.includes("cargo") && hay.includes("ships")) {
    return "UNDERWORLD";
  }
  if (hay.includes("ambush") || hay.includes("faction-visible")) {
    return "PIRATE";
  }
  return "CIVILIAN";
}

function shelterId(island: Island): string {
  return (
    island.facilities?.find((row) => SHELTER_ORDER.includes(row.id.toUpperCase()))?.id ??
    SHELTER_ORDER.find((id) => island.facilities?.some((row) => row.id.toUpperCase() === id || row.kind.toUpperCase() === id)) ??
    "INN"
  );
}

export const NpcResidencyService = {
  preferExisting(run: RunState, island: Island, tags: string[]): WorldCharacter | null {
    const locals = run.world.characters.filter((row) => row.alive && isLocalToIsland(row, island.id));
    const wanted = new Set(tags.map((tag) => tag.toLowerCase()));
    const scored = locals
      .map((character) => {
        const hay = `${character.tags.join(" ")} ${character.crewRole ?? ""}`.toLowerCase();
        const score = [...wanted].filter((tag) => hay.includes(tag)).length;
        return { character, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0] && scored[0].score > 0 ? scored[0].character : locals[0] ?? null;
  },

  ensureForQuest(run: RunState, island: Island, tags: string[]): WorldCharacter {
    const existing = this.preferExisting(run, island, tags);
    const home = shelterId(island);
    if (existing) {
      existing.homeLocationId ??= island.id;
      existing.firstMetIslandId ??= island.id;
      if (!existing.currentLocationId) {
        this.move(run, existing, home, run.day, "joined a local job");
      }
      return existing;
    }
    const used = new Set(run.world.characters.map((row) => row.name));
    const name = QUEST_NPC_NAMES.find((entry) => !used.has(entry)) ?? `Islander ${run.world.characters.length + 1}`;
    const npc = CharacterService.getOrCreateCharacter(run, {
      name,
      faction: factionForTags(tags),
      tags: ["generated_quest", "island_resident", ...tags],
      strength: 3,
      currentLocationId: home,
      homeLocationId: island.id,
      firstMetIslandId: island.id,
      firstMetDay: run.day,
      residencyStatus: "VISITOR",
      locationHistory: [{ locationId: home, day: run.day, note: "arrived with a job" }],
    });
    return npc;
  },

  settleAfterQuest(run: RunState, character: WorldCharacter, island: Island): void {
    const home = shelterId(island);
    this.move(run, character, home, run.day, "stayed after the job");
    character.homeLocationId = island.id;
    character.residencyStatus = "RESIDENT";
    if (!character.tags.includes("island_resident")) {
      character.tags.push("island_resident");
    }
  },

  move(run: RunState, character: WorldCharacter, locationId: string, day: number, note?: string): void {
    character.locationHistory = [
      ...(character.locationHistory ?? []),
      { locationId: character.currentLocationId ?? "unknown", day, note },
    ].slice(-12);
    character.currentLocationId = locationId;
    character.residencyStatus = character.residencyStatus === "VISITOR" ? "RESIDENT" : character.residencyStatus ?? "RESIDENT";
  },

  relocateFrom(run: RunState, island: Island, fromLocationId: string): void {
    const shelter = island.facilities?.find((row) => SHELTER_ORDER.includes(row.kind.toUpperCase()))?.id
      ?? SHELTER_ORDER.find((id) => island.facilities?.some((row) => row.kind.toUpperCase() === id))
      ?? "INN";
    for (const character of run.world.characters) {
      if (character.currentLocationId !== fromLocationId) {
        continue;
      }
      this.move(run, character, shelter, run.day, "location closed");
      character.residencyStatus = "DISPLACED";
    }
  },
};
