import type {
  CharacterMemory,
  CharacterMemoryType,
  CrewMember,
  CrewMembershipType,
  CrewRole,
  RunState,
  WorldCharacter,
} from "../models/types";
import { CORE_CREW_CAP } from "../game/constants";
import { createId } from "../utils/ids";
import { clamp } from "../utils/stats";
import { AffiliationService } from "./AffiliationService";
import { FleetService } from "./FleetService";
import { RaceService } from "./RaceService";

function findCharacter(run: RunState, characterId: string): WorldCharacter | undefined {
  return run.world.characters.find((character) => character.id === characterId);
}

/** Soft preference: Marines prefer Marine-aligned captains; pirates prefer pirate crews. */
function affiliationJoinBias(run: RunState, character: WorldCharacter): number {
  const aff = AffiliationService.get(run);
  if (!AffiliationService.isActiveMember(aff) || !aff.primaryFactionId) {
    return 0;
  }
  if (aff.primaryFactionId === "MARINES" && character.faction === "MARINE") {
    return 8;
  }
  if (aff.primaryFactionId === "PIRATES" && character.faction === "PIRATE") {
    return 8;
  }
  if (aff.primaryFactionId === "MARINES" && character.faction === "PIRATE") {
    return -12;
  }
  if (aff.primaryFactionId === "PIRATES" && character.faction === "MARINE") {
    return -12;
  }
  if (aff.primaryFactionId === "REVOLUTIONARY_ARMY" && character.faction === "UNDERWORLD") {
    return 5;
  }
  return 0;
}

export const CharacterService = {
  getCharacter(run: RunState, characterId: string): WorldCharacter | undefined {
    return findCharacter(run, characterId);
  },

  getOrCreateCharacter(
    run: RunState,
    partial: Partial<WorldCharacter> & { name: string; faction: WorldCharacter["faction"] },
  ): WorldCharacter {
    if (partial.id) {
      const existing = findCharacter(run, partial.id);
      if (existing) {
        return existing;
      }
    }
    const npc: WorldCharacter = {
      id: partial.id ?? createId("npc"),
      name: partial.name,
      faction: partial.faction,
      raceId: partial.raceId ?? "HUMAN",
      strength: partial.strength ?? 4,
      bounty: partial.bounty ?? 0,
      devilFruitId: partial.devilFruitId ?? null,
      alive: partial.alive ?? true,
      relationshipWithPlayer: partial.relationshipWithPlayer ?? 0,
      tags: partial.tags ?? [],
      epithet: partial.epithet,
      rankTitle: partial.rankTitle,
      importance: partial.importance ?? 1,
      personality: partial.personality,
      goals: partial.goals,
      combatStyle: partial.combatStyle,
      weaponIds: partial.weaponIds,
      joinInterest: partial.joinInterest ?? 0,
      crewRole: partial.crewRole,
      recruitmentPath: partial.recruitmentPath,
      memories: partial.memories ?? [],
      crewStats: partial.crewStats,
      unlockedTechniques: partial.unlockedTechniques ?? [],
    };
    run.world.characters.push(npc);
    return npc;
  },

  recordFirstMeeting(run: RunState, characterId: string): void {
    const character = findCharacter(run, characterId);
    if (!character || character.firstMetDay != null) {
      return;
    }
    character.firstMetDay = run.day;
    character.firstMetIslandId = run.currentIslandId ?? run.currentLocationId;
  },

  addMemory(
    run: RunState,
    characterId: string,
    type: CharacterMemoryType,
    importance = 1,
    note?: string,
  ): void {
    const character = findCharacter(run, characterId);
    if (!character) {
      return;
    }
    const memory: CharacterMemory = { type, day: run.day, importance, note };
    character.memories = [...(character.memories ?? []), memory];
  },

  modifyJoinInterest(run: RunState, characterId: string, amount: number): number {
    const character = findCharacter(run, characterId);
    if (!character) {
      return 0;
    }
    const biased = amount + affiliationJoinBias(run, character);
    const next = clamp((character.joinInterest ?? 0) + biased, 0, 100);
    character.joinInterest = next;
    return next;
  },

  relationshipLabel(character: WorldCharacter): string {
    const interest = character.joinInterest ?? 0;
    if (interest >= 75) {
      return "Wants to Join";
    }
    if (interest >= 50) {
      return "Friendly";
    }
    if (character.relationshipWithPlayer >= 3) {
      return "Ally";
    }
    if (character.relationshipWithPlayer <= -3) {
      return "Hostile";
    }
    if (interest <= 15 && character.relationshipWithPlayer < 0) {
      return "Hostile";
    }
    return "Neutral";
  },

  memoryAwareGreeting(run: RunState, characterId: string): string | null {
    const character = findCharacter(run, characterId);
    if (!character?.memories?.length) {
      return null;
    }
    const recent = character.memories
      .slice()
      .sort((a, b) => b.day - a.day)[0];
    if (!recent) {
      return null;
    }
    const name = character.epithet ? `${character.name} "${character.epithet}"` : character.name;
    switch (recent.type) {
      case "HELPED":
        return `${name} remembers you helped them on day ${recent.day}.`;
      case "BETRAYED":
        return `${name} has not forgotten your betrayal.`;
      case "FOUGHT":
        return `${name} still bears scars from your last fight.`;
      case "RESCUED":
        return `${name} owes you their life.`;
      case "RECRUITED":
        return `${name} sails with you now.`;
      default:
        return `${name} recognizes you from day ${recent.day}.`;
    }
  },

  acceptRecruitment(
    run: RunState,
    characterId: string,
    role: CrewRole = "FIGHTER",
    membership: CrewMembershipType = "ALLY",
  ): CrewMember | null {
    const character = findCharacter(run, characterId);
    if (!character) {
      return null;
    }
    if (run.crew.some((member) => member.characterId === characterId)) {
      return run.crew.find((member) => member.characterId === characterId) ?? null;
    }
    if (!RaceService.canRecruitCharacter(run, character)) {
      return null;
    }
    if (1 + run.crew.length >= CORE_CREW_CAP) {
      FleetService.offerFleetCaptain(run, character);
      return null;
    }
    const member: CrewMember = {
      characterId,
      role,
      membership,
      joinDay: run.day,
      status: membership === "TEMPORARY" || membership === "GUEST" ? "Temporary" : "Ready",
      progression: { level: 1, experience: 0, availableStatPoints: 0, techniquePoints: 0 },
      aiMode: "BALANCED",
      factionPreferences: [],
      grievances: [],
    };
    run.crew.push(member);
    character.joinInterest = 100;
    character.relationshipWithPlayer = Math.max(character.relationshipWithPlayer, 5);
    this.addMemory(run, characterId, "RECRUITED", 3, "Joined the crew.");
    if (!run.worldProgressionFlags.first_crew) {
      run.worldProgressionFlags.first_crew = true;
    }
    return member;
  },

  bumpImportance(run: RunState, characterId: string, amount: number): void {
    const character = findCharacter(run, characterId);
    if (!character) {
      return;
    }
    character.importance = (character.importance ?? 1) + amount;
    character.bounty = Math.max(character.bounty, character.bounty + amount * 500);
    character.strength = Math.max(character.strength, character.strength + Math.floor(amount / 2));
  },
};

export function defaultCrew(): CrewMember[] {
  return [];
}
