import type {
  CareerRoleId,
  CrewMembershipType,
  CrewRole,
  RunState,
} from "../models/types";
import { CharacterService } from "./CharacterService";
import { IdentityService } from "./IdentityService";
import { AffiliationService } from "./AffiliationService";

export type RecruitmentRoute =
  | "PIRATES"
  | "BOUNTY_HUNTER"
  | "MARINES"
  | "REVOLUTIONARY_ARMY"
  | "CIPHER_POL"
  | "CELESTIAL"
  | "CIVILIAN";

export type RecruitGateResult = {
  ok: boolean;
  reason?: string;
  membership?: CrewMembershipType;
};

/**
 * Route-specific crew join policy. CharacterService.acceptRecruitment remains the roster writer;
 * this service decides whether a join is allowed and which membership type to create.
 */
export const RecruitmentModelService = {
  resolveRoute(run: RunState): RecruitmentRoute {
    IdentityService.ensure(run);
    const identity = IdentityService.get(run);
    if (IdentityService.isCelestialPrivileged(run)) {
      return "CELESTIAL";
    }
    if (identity.roleId === "CELESTIAL_DRAGON" && identity.celestial?.lostStatus) {
      return "CIVILIAN";
    }
    if (identity.roleId === "CIPHER_POL_AGENT" || AffiliationService.isPlayerWorldGovernment(run)) {
      return "CIPHER_POL";
    }
    if (IdentityService.isPlayerBountyHunter(run)) {
      return "BOUNTY_HUNTER";
    }
    if (AffiliationService.isPlayerMarine(run)) {
      return "MARINES";
    }
    if (AffiliationService.isPlayerRevolutionary(run)) {
      return "REVOLUTIONARY_ARMY";
    }
    if (AffiliationService.isPlayerPirate(run)) {
      return "PIRATES";
    }
    return "CIVILIAN";
  },

  defaultMembership(run: RunState, requested?: CrewMembershipType): CrewMembershipType {
    if (requested) {
      return requested;
    }
    switch (this.resolveRoute(run)) {
      case "BOUNTY_HUNTER":
        return "CONTRACTOR";
      case "MARINES":
        return "ASSIGNED";
      case "CIPHER_POL":
        return "ASSIGNED";
      case "REVOLUTIONARY_ARMY":
        return "CELL_CONTACT";
      case "PIRATES":
        return "ALLY";
      case "CELESTIAL":
        return "GUEST";
      default:
        return "ALLY";
    }
  },

  canRecruitCoreCrew(run: RunState, membership?: CrewMembershipType): RecruitGateResult {
    const route = this.resolveRoute(run);
    const resolved = this.defaultMembership(run, membership);

    if (route === "CELESTIAL") {
      return {
        ok: false,
        reason:
          "Celestial privilege forbids a personal crew. Attendants remain World staff — not your roster.",
      };
    }

    if (route === "CIPHER_POL") {
      if (resolved !== "ASSIGNED" && resolved !== "TEMPORARY") {
        return {
          ok: false,
          reason: "Cipher Pol does not open-recruit. Wait for an assigned partner or temporary attachment.",
          membership: "ASSIGNED",
        };
      }
    }

    if (route === "MARINES" && resolved === "PERMANENT") {
      // Marines can eventually transfer civilians — permanent requires official path (content flag).
      if (!run.runFlags.includes("marine_recruit_authorized")) {
        return {
          ok: false,
          reason: "Request an official transfer before inducting a permanent Marine recruit.",
          membership: "ASSIGNED",
        };
      }
    }

    if (route === "REVOLUTIONARY_ARMY" && (resolved === "PERMANENT" || resolved === "ALLY")) {
      if (!run.runFlags.includes("rev_cell_press_ok")) {
        return {
          ok: true,
          membership: "CELL_CONTACT",
        };
      }
    }

    return { ok: true, membership: resolved };
  },

  /**
   * Recruit into core crew using route policy. Returns null when blocked or writer fails.
   */
  recruit(
    run: RunState,
    characterId: string,
    role: CrewRole = "FIGHTER",
    membership?: CrewMembershipType,
  ) {
    const gate = this.canRecruitCoreCrew(run, membership);
    if (!gate.ok) {
      return { member: null as ReturnType<typeof CharacterService.acceptRecruitment>, reason: gate.reason };
    }
    const member = CharacterService.acceptRecruitment(
      run,
      characterId,
      role,
      gate.membership ?? this.defaultMembership(run, membership),
    );
    return { member, reason: member ? undefined : "Recruitment failed." };
  },

  assignPartner(run: RunState, characterId: string, role: CrewRole = "FIGHTER") {
    IdentityService.ensure(run);
    const identity = IdentityService.get(run);
    identity.assignedPartnerId = characterId;
    const result = this.recruit(run, characterId, role, "ASSIGNED");
    if (result.member) {
      run.runFlags = Array.from(new Set([...run.runFlags, "assigned_partner_active"]));
    }
    return result;
  },

  elevateContractorToPartner(run: RunState, characterId: string): boolean {
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (!member || member.membership !== "CONTRACTOR") {
      return false;
    }
    member.membership = "PARTNER";
    member.status = "Ready";
    return true;
  },

  elevatePartnerToFull(run: RunState, characterId: string): boolean {
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (!member || (member.membership !== "PARTNER" && member.membership !== "ASSIGNED")) {
      return false;
    }
    member.membership = "PERMANENT";
    member.status = "Ready";
    return true;
  },

  /**
   * After celestial privilege loss, free recruit unlocks on the civilian/ex-celestial route.
   */
  unlockPostCelestialRecruit(run: RunState): void {
    const identity = IdentityService.ensure(run);
    if (identity.celestial) {
      identity.celestial.lostStatus = true;
    }
    IdentityService.setLegalStatus(run, "WANTED", "Privilege stripped");
    run.runFlags = Array.from(new Set([...run.runFlags, "ex_celestial_free_recruit"]));
  },

  routeLabel(route: RecruitmentRoute): string {
    switch (route) {
      case "BOUNTY_HUNTER":
        return "Hunter contracts";
      case "MARINES":
        return "Marine assignments";
      case "CIPHER_POL":
        return "Cipher Pol attachments";
      case "REVOLUTIONARY_ARMY":
        return "Revolutionary cells";
      case "CELESTIAL":
        return "Celestial attendants (not crew)";
      case "PIRATES":
        return "Pirate free recruit";
      default:
        return "Open seas recruit";
    }
  },

  rolesThatAllowOpenRecruit(): CareerRoleId[] {
    return ["WANDERER", "BOUNTY_HUNTER", "PIRATE_CAPTAIN", "PIRATE_CREW", "MERCHANT", "MERCENARY", "EXPLORER"];
  },
};
