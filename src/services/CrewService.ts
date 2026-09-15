import {
  CORE_CREW_CAP,
  FLEET_UNLOCK_BOUNTY,
  MAX_ACTIVE_FIGHTERS,
  MAX_SUPPORT_SLOTS,
} from "../game/constants";
import type {
  ActivePartyConfig,
  CrewMember,
  CrewRole,
  CrewStatus,
  NamedFleetCharacter,
  RunState,
  WorldCharacter,
} from "../models/types";
import { AffiliationService } from "./AffiliationService";
import { CharacterService } from "./CharacterService";
import { statsFromStrength } from "./CombatCalculationService";
import { FleetService } from "./FleetService";
import { MpService } from "./MpService";
import { RaceService } from "./RaceService";
import { RecruitmentModelService } from "./RecruitmentModelService";
import { WeaponService } from "./WeaponService";
import { clamp } from "../utils/stats";

export type CrewOverviewEntry = {
  member: CrewMember;
  character: WorldCharacter;
  status: CrewStatus;
  isCaptain: boolean;
};

/** Where a character currently belongs relative to the player's organization. */
export type CrewMembershipKind = "PLAYER" | "CORE" | "FLEET" | "APPRENTICE" | "NONE";

export type JoinResolutionKind =
  | "ALREADY_CREW"
  | "ALREADY_FLEET"
  | "JOINED_CORE"
  | "JOINED_FLEET"
  | "BLOCKED_CAPACITY"
  | "BLOCKED_FLEET_BOUNTY"
  | "BLOCKED_POLICY"
  | "BLOCKED_RACE"
  | "NOT_FOUND";

export type JoinResolution = {
  kind: JoinResolutionKind;
  message: string;
  member?: CrewMember;
  fleetEntry?: NamedFleetCharacter;
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

function partyNoun(run: RunState): string {
  return AffiliationService.getCrewLabel(run).toLowerCase();
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

  fleetUnlockBounty(): number {
    return FLEET_UNLOCK_BOUNTY;
  },

  /** True when the player's bounty is high enough to attract a fleet. */
  isFleetUnlocked(run: RunState): boolean {
    return run.player.bounty >= FLEET_UNLOCK_BOUNTY;
  },

  bountyNeededForFleet(run: RunState): number {
    return Math.max(0, FLEET_UNLOCK_BOUNTY - run.player.bounty);
  },

  fleetUnlockSummary(run: RunState): string {
    if (this.isFleetUnlocked(run)) {
      return "Fleet available — your name carries enough weight for followers under your banner.";
    }
    const needed = this.bountyNeededForFleet(run);
    return `Fleet unlocks at ฿${FLEET_UNLOCK_BOUNTY.toLocaleString()} bounty (฿${needed.toLocaleString()} more).`;
  },

  /**
   * Authoritative "already on this team" check — includes recovering / hospitalized /
   * injured members who are still on `run.crew`.
   */
  isCharacterAlreadyInCrew(run: RunState, characterId: string): boolean {
    if (characterId === run.player.id || characterId === "player") {
      return true;
    }
    return run.crew.some((entry) => entry.characterId === characterId);
  },

  isCharacterInFleet(run: RunState, characterId: string): boolean {
    return (run.fleet ?? []).some((entry) => entry.characterId === characterId);
  },

  isCharacterApprentice(run: RunState, characterId: string): boolean {
    return (run.apprentices ?? []).some((entry) => entry.characterId === characterId);
  },

  getCrewMembershipStatus(run: RunState, characterId: string): CrewMembershipKind {
    if (characterId === run.player.id || characterId === "player") {
      return "PLAYER";
    }
    if (this.isCharacterAlreadyInCrew(run, characterId)) {
      return "CORE";
    }
    if (this.isCharacterInFleet(run, characterId)) {
      return "FLEET";
    }
    if (this.isCharacterApprentice(run, characterId)) {
      return "APPRENTICE";
    }
    return "NONE";
  },

  /** Soft gate for showing join prompts / offers. */
  canOfferRecruitment(run: RunState, characterId: string): boolean {
    const status = this.getCrewMembershipStatus(run, characterId);
    return status === "NONE" || status === "APPRENTICE";
  },

  alreadyOnTeamMessage(run: RunState, characterId: string): string {
    const character = CharacterService.getCharacter(run, characterId);
    const name = character?.name ?? "They";
    const status = this.getCrewMembershipStatus(run, characterId);
    if (status === "FLEET") {
      return `${name} already sails under your wider banner as a fleet captain.`;
    }
    if (status === "PLAYER") {
      return "You cannot recruit yourself.";
    }
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (member?.status === "Hospitalized" || member?.currentAssignment?.type === "HOSPITALIZED") {
      return `${name} is already part of your ${partyNoun(run)} — recovering in care, not a new recruit.`;
    }
    if (member?.status === "Injured" || member?.currentAssignment?.type === "RECOVERING") {
      return `${name} already sails with you, even while recovering.`;
    }
    return `${name} already sails under your flag.`;
  },

  /**
   * Single recruitment resolver used by encounters and helpers.
   * Never duplicates core crew or fleet entries.
   */
  resolveRecruitment(
    run: RunState,
    characterId: string,
    role: CrewRole = "FIGHTER",
    membership?: CrewMember["membership"],
  ): JoinResolution {
    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return { kind: "NOT_FOUND", message: "No one answers the call." };
    }

    const status = this.getCrewMembershipStatus(run, characterId);
    if (status === "CORE" || status === "PLAYER") {
      return {
        kind: "ALREADY_CREW",
        message: this.alreadyOnTeamMessage(run, characterId),
        member: run.crew.find((entry) => entry.characterId === characterId),
      };
    }
    if (status === "FLEET") {
      return {
        kind: "ALREADY_FLEET",
        message: this.alreadyOnTeamMessage(run, characterId),
        fleetEntry: (run.fleet ?? []).find((entry) => entry.characterId === characterId),
      };
    }

    if (!RaceService.canRecruitCharacter(run, character)) {
      return {
        kind: "BLOCKED_RACE",
        message: `${character.name} cannot join your ${partyNoun(run)} yet — the world has not opened that path.`,
      };
    }

    const gate = RecruitmentModelService.canRecruitCoreCrew(run, membership);
    if (!gate.ok) {
      return {
        kind: "BLOCKED_POLICY",
        message: gate.reason ?? `${character.name} cannot join under your current path.`,
      };
    }

    const resolvedMembership = gate.membership ?? RecruitmentModelService.defaultMembership(run, membership);

    if (!this.isCoreFull(run)) {
      const member = CharacterService.acceptRecruitment(run, characterId, role, resolvedMembership);
      if (!member) {
        return {
          kind: "BLOCKED_POLICY",
          message: "Recruitment failed.",
        };
      }
      return {
        kind: "JOINED_CORE",
        message: `${character.name} joins your ${partyNoun(run)} (${this.membershipLabel(member.membership)}).`,
        member,
      };
    }

    if (!this.isFleetUnlocked(run)) {
      const needed = this.bountyNeededForFleet(run);
      return {
        kind: "BLOCKED_FLEET_BOUNTY",
        message: `${character.name} would follow — but you are not yet infamous enough to gather a fleet under your banner. Reach ฿${FLEET_UNLOCK_BOUNTY.toLocaleString()} bounty (฿${needed.toLocaleString()} more).`,
      };
    }

    const fleetEntry = FleetService.offerFleetCaptain(run, character);
    if (!fleetEntry) {
      return {
        kind: "ALREADY_FLEET",
        message: this.alreadyOnTeamMessage(run, characterId),
      };
    }
    return {
      kind: "JOINED_FLEET",
      message: `${character.name} cannot squeeze into your core ${partyNoun(run)}, so they sail under your wider banner as Fleet Captain of the ${fleetEntry.shipName}.`,
      fleetEntry,
    };
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

  /** Recruit to core crew or fleet captain when roster is full (bounty-gated). */
  recruitOrFleet(
    run: RunState,
    characterId: string,
    role: CrewRole = "FIGHTER",
    membership: CrewMember["membership"] = "ALLY",
  ): { kind: "CORE" | "FLEET" | "BLOCKED"; member?: CrewMember; message: string } {
    const result = this.resolveRecruitment(run, characterId, role, membership);
    if (result.kind === "JOINED_CORE" || result.kind === "ALREADY_CREW") {
      return { kind: "CORE", member: result.member, message: result.message };
    }
    if (result.kind === "JOINED_FLEET" || result.kind === "ALREADY_FLEET") {
      return { kind: "FLEET", message: result.message };
    }
    return { kind: "BLOCKED", message: result.message };
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
      crewStats: { strength: 7, defense: 5, speed: 6, willpower: 4, charisma: 3, intelligence: 4 },
    });
    this.resolveRecruitment(run, mika.id, "FIGHTER", "PERMANENT");
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
      crewStats: { strength: 5, defense: 4, speed: 8, willpower: 5, charisma: 3, intelligence: 6 },
    });
    this.resolveRecruitment(run, ren.id, "NAVIGATOR", "PERMANENT");
    for (const member of run.crew.filter((entry) => [mika.id, ren.id].includes(entry.characterId))) {
      member.personalGoal = member.characterId === mika.id ? "Break every lock" : "Map hidden paths";
      member.status = "Ready";
    }
    return mika;
  },

  estimatedHp(character: WorldCharacter, member?: CrewMember | null): { hp: number; maxHp: number } {
    const maxHp = Math.max(1, 18 + character.strength * 4);
    const hp = member?.hp != null ? clamp(member.hp, 0, maxHp) : maxHp;
    return { hp, maxHp };
  },

  maxMpForCharacter(character: WorldCharacter): number {
    const stats = character.crewStats ?? statsFromStrength(character.strength);
    return MpService.maxMpForStats(stats);
  },

  /** Ensure crewmate vitals exist; returns live hp/mp pools. */
  ensureMemberVitals(
    run: RunState,
    characterId: string,
  ): { hp: number; maxHp: number; mp: number; maxMp: number; name: string } | null {
    const member = run.crew.find((entry) => entry.characterId === characterId);
    const character = CharacterService.getCharacter(run, characterId);
    if (!member || !character) {
      return null;
    }
    const { hp: defaultHp, maxHp } = this.estimatedHp(character, null);
    const maxMp = this.maxMpForCharacter(character);
    if (member.hp == null) {
      member.hp = defaultHp;
    }
    if (member.mp == null) {
      member.mp = maxMp;
    }
    member.hp = clamp(member.hp, 0, maxHp);
    member.mp = clamp(member.mp, 0, maxMp);
    return { hp: member.hp, maxHp, mp: member.mp, maxMp, name: character.name };
  },

  applyMemberHeal(
    run: RunState,
    characterId: string,
    hpGain: number,
    mpGain: number,
  ): { hpHealed: number; mpRestored: number; name: string } | null {
    const vitals = this.ensureMemberVitals(run, characterId);
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (!vitals || !member) {
      return null;
    }
    const beforeHp = member.hp ?? vitals.hp;
    const beforeMp = member.mp ?? vitals.mp;
    member.hp = clamp(beforeHp + Math.max(0, hpGain), 0, vitals.maxHp);
    member.mp = clamp(beforeMp + Math.max(0, mpGain), 0, vitals.maxMp);
    return {
      hpHealed: (member.hp ?? beforeHp) - beforeHp,
      mpRestored: (member.mp ?? beforeMp) - beforeMp,
      name: vitals.name,
    };
  },

  roleLabel(role: CrewRole): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  },

  captainWeaponName(run: RunState): string | null {
    return WeaponService.getEquippedWeapon(run.player)?.name ?? null;
  },

  membershipLabel(membership: CrewMember["membership"]): string {
    const labels: Record<CrewMember["membership"], string> = {
      CONTRACTOR: "Contractor",
      PARTNER: "Partner",
      ASSIGNED: "Assigned",
      CELL_CONTACT: "Cell contact",
      PERMANENT: "Permanent",
      TEMPORARY: "Temporary",
      GUEST: "Guest",
      ALLY: "Ally",
    };
    return labels[membership] ?? membership;
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
