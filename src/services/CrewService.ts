import { CORE_CREW_CAP, MAX_ACTIVE_FIGHTERS, MAX_SUPPORT_SLOTS } from "../game/constants";
import type {
  ActivePartyConfig,
  CrewMember,
  CrewRole,
  CrewStatus,
  RunState,
  WorldCharacter,
} from "../models/types";
import { CharacterService } from "./CharacterService";
import { FleetService } from "./FleetService";
import { WeaponService } from "./WeaponService";

export type CrewOverviewEntry = {
  member: CrewMember;
  character: WorldCharacter;
  status: CrewStatus;
  isCaptain: boolean;
};

function membershipStatus(membership: CrewMember["membership"], status?: CrewStatus): CrewStatus {
  if (status) {
    return status;
  }
  if (membership === "TEMPORARY" || membership === "GUEST") {
    return "Temporary";
  }
  return "Ready";
}

export const CrewService = {
  coreCount(run: RunState): number {
    return 1 + run.crew.length;
  },

  isCoreFull(run: RunState): boolean {
    return this.coreCount(run) >= CORE_CREW_CAP;
  },

  canRecruitCore(run: RunState): boolean {
    return !this.isCoreFull(run);
  },

  list(run: RunState): CrewOverviewEntry[] {
    return run.crew
      .map((member) => {
        const character = CharacterService.getCharacter(run, member.characterId);
        if (!character) {
          return null;
        }
        return {
          member,
          character,
          status: membershipStatus(member.membership, member.status),
          isCaptain: member.role === "CAPTAIN",
        };
      })
      .filter((entry): entry is CrewOverviewEntry => Boolean(entry));
  },

  captainEntry(run: RunState): {
    name: string;
    role: CrewRole;
    hp: number;
    maxHp: number;
    status: CrewStatus;
  } {
    return {
      name: run.player.name,
      role: "CAPTAIN",
      hp: run.player.hp,
      maxHp: run.player.maxHp,
      status: "Ready",
    };
  },

  getMember(run: RunState, characterId: string): CrewOverviewEntry | null {
    return this.list(run).find((entry) => entry.member.characterId === characterId) ?? null;
  },

  setStatus(run: RunState, characterId: string, status: CrewStatus): void {
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (member) {
      member.status = status;
    }
  },

  /** Recruit to core crew or fleet captain when roster is full. */
  recruitOrFleet(
    run: RunState,
    characterId: string,
    role: CrewRole = "FIGHTER",
    membership: CrewMember["membership"] = "ALLY",
  ): { kind: "CORE" | "FLEET"; member?: CrewMember } | null {
    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return null;
    }
    if (run.crew.some((entry) => entry.characterId === characterId)) {
      return { kind: "CORE", member: run.crew.find((entry) => entry.characterId === characterId) };
    }
    if (this.isCoreFull(run)) {
      FleetService.offerFleetCaptain(run, character);
      return { kind: "FLEET" };
    }
    const member = CharacterService.acceptRecruitment(run, characterId, role, membership);
    return member ? { kind: "CORE", member } : null;
  },

  recruitTestCrew(run: RunState): WorldCharacter {
    const mika = CharacterService.getOrCreateCharacter(run, {
      id: "npc_mika_smash",
      name: "Mika",
      faction: "PIRATE",
      epithet: "The Hammer",
      strength: 7,
      tags: ["crew_candidate", "test"],
      crewRole: "FIGHTER",
      personality: "Direct and fearless",
      goals: ["Break every lock that dares her"],
      combatStyle: "brawler",
      weaponIds: ["iron_knuckles"],
      relationshipWithPlayer: 5,
      joinInterest: 100,
      crewStats: { strength: 7, defense: 5, speed: 6, willpower: 4, charisma: 3 },
    });
    CharacterService.acceptRecruitment(run, mika.id, "FIGHTER", "PERMANENT");
    const ren = CharacterService.getOrCreateCharacter(run, {
      id: "npc_ren_traps",
      name: "Ren",
      faction: "PIRATE",
      epithet: "Quiet Step",
      strength: 5,
      tags: ["crew_candidate", "test"],
      crewRole: "NAVIGATOR",
      personality: "Observant and cautious",
      goals: ["Map every hidden path"],
      combatStyle: "scout",
      weaponIds: ["iron_spear"],
      relationshipWithPlayer: 4,
      joinInterest: 100,
      crewStats: { strength: 5, defense: 4, speed: 8, willpower: 5, charisma: 3 },
    });
    CharacterService.acceptRecruitment(run, ren.id, "NAVIGATOR", "PERMANENT");
    for (const member of run.crew.filter((entry) => [mika.id, ren.id].includes(entry.characterId))) {
      member.personalGoal = member.characterId === mika.id ? "Break every lock" : "Map hidden paths";
      member.status = "Ready";
    }
    return mika;
  },

  estimatedHp(character: WorldCharacter): { hp: number; maxHp: number } {
    const maxHp = 18 + character.strength * 4;
    return { hp: maxHp, maxHp };
  },

  roleLabel(role: CrewRole): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  },

  captainWeaponName(run: RunState): string | null {
    return WeaponService.getEquippedWeapon(run.player)?.name ?? null;
  },

  membershipLabel(membership: CrewMember["membership"]): string {
    return membership.charAt(0) + membership.slice(1).toLowerCase();
  },

  activePartySummary(run: RunState): { fighters: string[]; support: string[] } {
    const config = run.activeParty;
    const nameFor = (id: string) => CharacterService.getCharacter(run, id)?.name ?? id;
    return {
      fighters: (config?.activeFighterIds ?? []).slice(0, MAX_ACTIVE_FIGHTERS).map(nameFor),
      support: (config?.supportSlotIds ?? []).slice(0, MAX_SUPPORT_SLOTS).map(nameFor),
    };
  },

  defaultActiveParty(): ActivePartyConfig {
    return { activeFighterIds: [], supportSlotIds: [] };
  },
};
