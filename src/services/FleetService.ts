import type { Apprentice, NamedFleetCharacter, RunState, WorldCharacter } from "../models/types";
import { CharacterService } from "./CharacterService";
import { StoryThreadService } from "./StoryThreadService";
import { WorldService } from "./WorldService";

export const FleetService = {
  ensure(run: RunState): void {
    if (!run.fleet) {
      run.fleet = [];
    }
    if (!run.apprentices) {
      run.apprentices = [];
    }
  },

  list(run: RunState): NamedFleetCharacter[] {
    this.ensure(run);
    return run.fleet!;
  },

  listApprentices(run: RunState): Apprentice[] {
    this.ensure(run);
    return run.apprentices!;
  },

  offerFleetCaptain(
    run: RunState,
    character: WorldCharacter,
    shipName?: string,
  ): NamedFleetCharacter | null {
    this.ensure(run);
    const entry: NamedFleetCharacter = {
      characterId: character.id,
      shipName: shipName ?? `${character.name}'s Ship`,
      crewCount: 12 + Math.floor(character.strength * 2),
      locationId: run.currentLocationId,
      activity: "Patrolling nearby waters",
      joinDay: run.day,
      lastTickDay: run.day,
    };
    run.fleet!.push(entry);
    if (!run.runFlags.includes("crew_overflow_unlocked")) {
      run.runFlags.push("crew_overflow_unlocked");
    }
    WorldService.addNews(
      run,
      `${character.name} sails under your flag as Fleet Captain of the ${entry.shipName}.`,
    );
    return entry;
  },

  promoteApprentice(
    run: RunState,
    characterId: string,
    mentorId?: string,
    role: Apprentice["role"] = "FIGHTER",
  ): Apprentice {
    this.ensure(run);
    const existing = run.apprentices!.find((entry) => entry.characterId === characterId);
    if (existing) {
      return existing;
    }
    const apprentice: Apprentice = {
      characterId,
      mentorId,
      role,
      progress: 0,
      joinDay: run.day,
    };
    run.apprentices!.push(apprentice);
    return apprentice;
  },

  tickFleetCaptains(run: RunState, rng: () => number): string[] {
    this.ensure(run);
    const lines: string[] = [];
    for (const captain of run.fleet!) {
      if (run.day - captain.lastTickDay < 3) {
        continue;
      }
      captain.lastTickDay = run.day;
      const character = CharacterService.getCharacter(run, captain.characterId);
      if (!character) {
        continue;
      }
      const roll = rng();
      if (roll < 0.35) {
        const news = `${captain.shipName} (${character.name}) reports activity near ${captain.locationId}.`;
        WorldService.addNews(run, news);
        lines.push(news);
      } else if (roll < 0.5) {
        const thread = StoryThreadService.createThread(run, "fleet_captain_hook", {
          characterIds: [captain.characterId],
        });
        if (thread) {
          lines.push(`${character.name}'s fleet stirs a new thread: ${thread.title}.`);
        }
      }
      captain.activity =
        roll < 0.33
          ? "Escorting merchant vessels"
          : roll < 0.66
            ? "Hunting pirates"
            : "Training new recruits";
    }
    return lines;
  },

  generateFleetStoryStub(run: RunState): string {
    this.ensure(run);
    if (!run.fleet!.length) {
      const npc = CharacterService.getOrCreateCharacter(run, {
        name: "Kael",
        faction: "PIRATE",
        strength: 6,
        tags: ["fleet_captain"],
        crewRole: "FIGHTER",
      });
      this.offerFleetCaptain(run, npc, "Sea Sparrow");
      return `Fleet captain ${npc.name} added under your flag.`;
    }
    const captain = run.fleet![0]!;
    const character = CharacterService.getCharacter(run, captain.characterId);
    WorldService.addNews(
      run,
      `${captain.shipName} requests orders — ${character?.name ?? "Your captain"} awaits word.`,
    );
    return `Fleet story stub: ${captain.shipName} pinged for orders.`;
  },
};
