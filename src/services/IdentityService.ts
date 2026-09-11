import {
  AFFILIATION_FACTION_LABELS,
  CAREER_ROLE_LABELS,
  LEGAL_STATUS_LABELS,
  defaultPlayerIdentity,
  defaultTendencies,
  qualitativeBand,
} from "../data/identity";
import {
  CAREER_FACTION_LABELS,
  getRankById,
  getRanksForRole,
  getStartingRankId,
} from "../data/ranks";
import type {
  AffiliationFactionId,
  CareerFactionId,
  CareerRoleId,
  IdentityTendencies,
  LegalStatusId,
  PlayerIdentity,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { clamp } from "../utils/stats";
import { AffiliationService } from "./AffiliationService";

const WANTED_BOUNTY_THRESHOLD = 1;
const SUSPECTED_BOUNTY_THRESHOLD = 1;
const FUGITIVE_BOUNTY_THRESHOLD = 50_000;

function careerFactionToAffiliation(factionId: CareerFactionId | null | undefined): AffiliationFactionId {
  switch (factionId) {
    case "PIRATES":
      return "PIRATES";
    case "MARINES":
      return "MARINES";
    case "REVOLUTIONARY_ARMY":
      return "REVOLUTIONARY_ARMY";
    case "WORLD_GOVERNMENT":
      return "WORLD_GOVERNMENT";
    case "BOUNTY_HUNTER":
    case "CIVILIAN":
    case "INDEPENDENT":
    case null:
    case undefined:
    default:
      return "CIVILIAN";
  }
}

function roleFromLegacyAffiliation(factionId: CareerFactionId | null | undefined): CareerRoleId {
  switch (factionId) {
    case "BOUNTY_HUNTER":
      return "BOUNTY_HUNTER";
    case "PIRATES":
      return "PIRATE_CREW";
    case "MARINES":
      return "MARINE_RECRUIT";
    case "REVOLUTIONARY_ARMY":
      return "REVOLUTIONARY_OPERATIVE";
    case "WORLD_GOVERNMENT":
      return "CIPHER_POL_AGENT";
    default:
      return "WANDERER";
  }
}

function legalFromBounty(bounty: number, existing?: LegalStatusId): LegalStatusId {
  if (existing === "CELESTIAL_PRIVILEGE" || existing === "GOVERNMENT_AGENT" || existing === "PROTECTED") {
    return existing;
  }
  if (bounty >= FUGITIVE_BOUNTY_THRESHOLD) return "FUGITIVE";
  if (bounty >= WANTED_BOUNTY_THRESHOLD) return "WANTED";
  if (bounty >= SUSPECTED_BOUNTY_THRESHOLD) return "SUSPECTED";
  return existing ?? "LAWFUL";
}

function mergeTendencies(base: IdentityTendencies, patch?: Partial<IdentityTendencies>): IdentityTendencies {
  const next = { ...base };
  if (!patch) return next;
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "number") {
      next[key as keyof IdentityTendencies] = clamp(next[key as keyof IdentityTendencies] + value, -100, 100);
    }
  }
  return next;
}

export const IdentityService = {
  defaultIdentity: defaultPlayerIdentity,

  ensure(run: RunState): PlayerIdentity {
    AffiliationService.ensure(run);
    if (!run.player.identity) {
      run.player.identity = this.migrateFromLegacy(run);
    }
    const identity = run.player.identity;
    if (!identity.tendencies) {
      identity.tendencies = defaultTendencies();
    }
    identity.roleHistory ??= [];
    identity.legalHistory ??= [];
    // Keep legal status aligned with bounty without forcing pirate faction.
    if (
      run.player.bounty > 0 &&
      identity.legalStatusId === "LAWFUL" &&
      identity.roleId !== "CELESTIAL_DRAGON"
    ) {
      const nextLegal = legalFromBounty(run.player.bounty);
      if (nextLegal !== identity.legalStatusId) {
        identity.legalStatusId = nextLegal;
        identity.legalHistory.push({
          id: createId("legal_hist"),
          day: run.day,
          statusId: nextLegal,
          note: "Bounty posted",
        });
      }
    }
    run.player.title = this.computeTitle(run);
    return identity;
  },

  get(run: RunState): PlayerIdentity {
    return this.ensure(run);
  },

  migrateFromLegacy(run: RunState): PlayerIdentity {
    const aff = run.player.affiliation;
    const legacyFaction = aff?.primaryFactionId ?? null;
    const wasHunter = legacyFaction === "BOUNTY_HUNTER";
    const identity = defaultPlayerIdentity();
    identity.factionId = careerFactionToAffiliation(legacyFaction);
    identity.roleId = roleFromLegacyAffiliation(legacyFaction);
    identity.legalStatusId = legalFromBounty(run.player.bounty);
    if (wasHunter) {
      identity.factionId = "CIVILIAN";
      identity.roleId = "BOUNTY_HUNTER";
      identity.roleRankId = aff?.rankId ?? "hunter_unknown";
      // Institutional affiliation should not claim a fake hunter faction.
      if (run.player.affiliation) {
        run.player.affiliation.primaryFactionId = "CIVILIAN";
        run.player.affiliation.membershipStatus =
          run.player.affiliation.membershipStatus === "INDEPENDENT"
            ? "MEMBER"
            : run.player.affiliation.membershipStatus;
        run.player.affiliation.rankId = run.player.affiliation.rankId?.startsWith("hunter_")
          ? "civilian_citizen"
          : run.player.affiliation.rankId ?? "civilian_citizen";
      }
    } else if (!legacyFaction || legacyFaction === "INDEPENDENT" || legacyFaction === "CIVILIAN") {
      identity.factionId = "CIVILIAN";
      identity.roleId = "WANDERER";
      identity.roleRankId = "civilian_wanderer";
      if (run.player.affiliation) {
        run.player.affiliation.primaryFactionId = "CIVILIAN";
        run.player.affiliation.membershipStatus = "INDEPENDENT";
        run.player.affiliation.rankId = "civilian_wanderer";
      }
    } else if (aff?.rankId) {
      identity.roleRankId = aff.rankId;
    }
    if (identity.roleId === "CELESTIAL_DRAGON") {
      identity.legalStatusId = "CELESTIAL_PRIVILEGE";
      identity.celestial = {
        acceptance: 60,
        humanConnection: 10,
        privilegeLevel: 80,
        protectionLevel: 80,
        royalKnightTraining: false,
        lostStatus: false,
      };
    }
    return identity;
  },

  hasRole(run: RunState, roleId: CareerRoleId): boolean {
    return this.get(run).roleId === roleId;
  },

  belongsToFaction(run: RunState, factionId: AffiliationFactionId): boolean {
    return this.get(run).factionId === factionId;
  },

  isPlayerBountyHunter(run: RunState): boolean {
    return this.hasRole(run, "BOUNTY_HUNTER");
  },

  isCelestialPrivileged(run: RunState): boolean {
    const id = this.get(run);
    return (
      id.roleId === "CELESTIAL_DRAGON" &&
      id.legalStatusId === "CELESTIAL_PRIVILEGE" &&
      !id.celestial?.lostStatus
    );
  },

  setFaction(run: RunState, factionId: AffiliationFactionId, note?: string): void {
    const identity = this.ensure(run);
    identity.factionId = factionId;
    if (note) {
      identity.roleHistory.push({
        id: createId("id_hist"),
        day: run.day,
        roleId: identity.roleId,
        note: `Faction → ${AFFILIATION_FACTION_LABELS[factionId]}: ${note}`,
      });
    }
    run.player.title = this.computeTitle(run);
  },

  setRole(run: RunState, roleId: CareerRoleId, rankId?: string, note?: string): void {
    const identity = this.ensure(run);
    identity.roleId = roleId;
    if (rankId) {
      identity.roleRankId = rankId;
    } else {
      const ranks = getRanksForRole(roleId);
      identity.roleRankId = ranks[0]?.id ?? identity.roleRankId;
    }
    identity.roleHistory.push({
      id: createId("role_hist"),
      day: run.day,
      roleId,
      note,
    });
    if (roleId === "BOUNTY_HUNTER") {
      identity.factionId = "CIVILIAN";
      const aff = AffiliationService.ensure(run);
      aff.primaryFactionId = "CIVILIAN";
      if (aff.membershipStatus === "INDEPENDENT") {
        aff.membershipStatus = "MEMBER";
      }
      aff.rankId = "civilian_citizen";
      aff.reputationWithinFaction = Math.max(aff.reputationWithinFaction, 5);
    }
    if (roleId === "CELESTIAL_DRAGON") {
      identity.legalStatusId = "CELESTIAL_PRIVILEGE";
      identity.celestial ??= {
        acceptance: 55,
        humanConnection: 15,
        privilegeLevel: 75,
        protectionLevel: 75,
        royalKnightTraining: false,
        lostStatus: false,
      };
    }
    run.player.title = this.computeTitle(run);
  },

  setLegalStatus(run: RunState, statusId: LegalStatusId, note?: string): void {
    if (!run.player.identity) {
      run.player.identity = this.migrateFromLegacy(run);
    }
    const identity = run.player.identity;
    if (identity.legalStatusId === statusId) return;
    identity.legalStatusId = statusId;
    identity.legalHistory.push({
      id: createId("legal_hist"),
      day: run.day,
      statusId,
      note,
    });
    run.player.title = this.computeTitle(run);
  },

  applyTendencyChanges(run: RunState, changes?: Partial<IdentityTendencies>): void {
    if (!changes) return;
    const identity = this.ensure(run);
    identity.tendencies = mergeTendencies(identity.tendencies, changes);
    this.evaluateGradualTransitions(run);
  },

  syncLegalFromBounty(run: RunState): void {
    if (!run.player.identity) {
      this.ensure(run);
    }
    const identity = run.player.identity!;
    if (identity.roleId === "CELESTIAL_DRAGON" && !identity.celestial?.lostStatus) {
      return;
    }
    const next = legalFromBounty(run.player.bounty, identity.legalStatusId);
    if (next !== identity.legalStatusId && (next === "WANTED" || next === "FUGITIVE" || next === "LAWFUL")) {
      if (identity.legalStatusId === "FUGITIVE" && next === "WANTED") return;
      if (identity.legalStatusId === "GOVERNMENT_AGENT" || identity.legalStatusId === "PROTECTED") return;
      this.setLegalStatus(run, next, "Legal standing updated from bounty");
    }
  },

  /**
   * Gradual opportunities — never instant faction flips from a single spike.
   * Offers respect hysteresis via pendingOffer + day cooldowns on run flags.
   */
  evaluateGradualTransitions(run: RunState): void {
    const identity = this.ensure(run);
    const t = identity.tendencies;
    identity.offerCooldowns ??= {};
    const offerCooldownOk = (key: string, days = 5) => {
      const last = identity.offerCooldowns![key];
      if (last == null) return true;
      return run.day - last >= days;
    };
    const markOffer = (key: string) => {
      identity.offerCooldowns![key] = run.day;
    };

    if (
      identity.factionId === "CIVILIAN" &&
      identity.roleId === "WANDERER" &&
      t.bountyCollectionBehavior >= 25 &&
      t.violenceAgainstPirates >= 10 &&
      offerCooldownOk("hunter")
    ) {
      if (!run.player.affiliation?.pendingOffer || run.player.affiliation.pendingOffer.factionId !== "CIVILIAN") {
        AffiliationService.offerRecruitment(run, {
          factionId: "CIVILIAN",
          rankId: "hunter_unknown",
          source: "identity_bounty_hunter_path",
          benefits: ["Civilian bounty contracts", "Remain independent of pirate flags"],
        });
        markOffer("hunter");
      }
    }

    if (
      identity.factionId === "CIVILIAN" &&
      t.authorityAlignment >= 35 &&
      t.protectionBehavior >= 20 &&
      t.criminality < 10 &&
      !AffiliationService.isPlayerMarine(run) &&
      offerCooldownOk("marine")
    ) {
      AffiliationService.offerRecruitment(run, {
        factionId: "MARINES",
        rankId: getStartingRankId("MARINES"),
        source: "identity_marine_path",
      });
      markOffer("marine");
    }

    if (
      identity.roleId === "BOUNTY_HUNTER" &&
      t.criminality >= 40 &&
      t.violenceAgainstCivilians >= 20 &&
      t.rebellion >= 25 &&
      identity.factionId === "CIVILIAN" &&
      offerCooldownOk("pirate")
    ) {
      AffiliationService.offerRecruitment(run, {
        factionId: "PIRATES",
        rankId: getStartingRankId("PIRATES"),
        source: "identity_outlaw_drift",
        consequences: ["Joining pirates changes your faction — bounty alone does not."],
      });
      markOffer("pirate");
    }

    if (identity.roleId === "BOUNTY_HUNTER" && run.player.bounty > 0) {
      this.syncLegalFromBounty(run);
    }

    if (identity.roleId === "CELESTIAL_DRAGON" && identity.celestial && !identity.celestial.lostStatus) {
      if (t.compassion >= 30 && t.entitlement <= 10) {
        identity.celestial.humanConnection = clamp(identity.celestial.humanConnection + 1, 0, 100);
        identity.celestial.acceptance = clamp(identity.celestial.acceptance - 1, 0, 100);
      }
      if (t.entitlement >= 40 && t.compassion <= 0) {
        identity.celestial.privilegeLevel = clamp(identity.celestial.privilegeLevel + 1, 0, 100);
        identity.celestial.humanConnection = clamp(identity.celestial.humanConnection - 1, 0, 100);
      }
    }
  },

  nudgeCelestial(
    run: RunState,
    patch: Partial<{ acceptance: number; humanConnection: number; privilegeLevel: number; protectionLevel: number }>,
  ): void {
    const identity = this.ensure(run);
    if (!identity.celestial) return;
    const c = identity.celestial;
    if (typeof patch.acceptance === "number") c.acceptance = clamp(c.acceptance + patch.acceptance, 0, 100);
    if (typeof patch.humanConnection === "number") {
      c.humanConnection = clamp(c.humanConnection + patch.humanConnection, 0, 100);
    }
    if (typeof patch.privilegeLevel === "number") {
      c.privilegeLevel = clamp(c.privilegeLevel + patch.privilegeLevel, 0, 100);
    }
    if (typeof patch.protectionLevel === "number") {
      c.protectionLevel = clamp(c.protectionLevel + patch.protectionLevel, 0, 100);
    }
  },

  loseCelestialPrivilege(run: RunState, note?: string): void {
    const identity = this.ensure(run);
    if (identity.celestial) {
      identity.celestial.lostStatus = true;
      identity.celestial.protectionLevel = 0;
      identity.celestial.privilegeLevel = 0;
    }
    this.setLegalStatus(run, "WANTED", note ?? "Celestial privilege lost");
    this.setFaction(run, "CIVILIAN", "Exiled from Mariejois");
    run.runFlags = Array.from(new Set([...run.runFlags, "ex_celestial_free_recruit"]));
  },

  computeTitle(run: RunState): string {
    const identity = run.player.identity ?? defaultPlayerIdentity();
    const roleLabel = CAREER_ROLE_LABELS[identity.roleId];
    const legal = LEGAL_STATUS_LABELS[identity.legalStatusId];
    const roleRank = identity.roleRankId ? getRankById(identity.roleRankId) : undefined;
    const aff = run.player.affiliation;
    const affRank = aff?.rankId ? getRankById(aff.rankId) : undefined;

    if (identity.roleId === "BOUNTY_HUNTER") {
      const hunter = roleRank?.name ?? "Bounty Hunter";
      if (identity.legalStatusId === "WANTED" || identity.legalStatusId === "FUGITIVE") {
        return `${hunter} · ${legal}`;
      }
      return hunter;
    }

    if (identity.roleId === "CELESTIAL_DRAGON") {
      return identity.celestial?.lostStatus ? `Ex-Celestial · ${roleLabel}` : "Celestial Dragon";
    }

    if (aff && AffiliationService.isActiveMember(aff) && aff.primaryFactionId) {
      const factionLabel =
        aff.primaryFactionId === "BOUNTY_HUNTER"
          ? CAREER_ROLE_LABELS.BOUNTY_HUNTER
          : CAREER_FACTION_LABELS[aff.primaryFactionId];
      const rankName = affRank?.name;
      const base = rankName ? `${rankName}` : factionLabel;
      if (identity.legalStatusId === "WANTED" || identity.legalStatusId === "FUGITIVE") {
        return `${base} · ${legal}`;
      }
      return base;
    }

    if (identity.legalStatusId === "WANTED" || identity.legalStatusId === "FUGITIVE") {
      return `${roleLabel} · ${legal}`;
    }
    return roleRank?.name ?? roleLabel;
  },

  hudSummary(run: RunState): {
    faction: string;
    role: string;
    legal: string;
    reputation: string;
  } {
    const identity = run.player.identity ?? this.ensure(run);
    const roleRank = identity.roleRankId ? getRankById(identity.roleRankId) : undefined;
    return {
      faction: AFFILIATION_FACTION_LABELS[identity.factionId],
      role: roleRank?.name ?? CAREER_ROLE_LABELS[identity.roleId],
      legal: LEGAL_STATUS_LABELS[identity.legalStatusId],
      reputation:
        identity.roleId === "BOUNTY_HUNTER"
          ? roleRank?.name ?? "Hunter"
          : qualitativeBand(identity.tendencies.civilianConduct),
    };
  },

  celestialQualitative(run: RunState): {
    standing: string;
    privilege: string;
    protection: string;
    humanConnection: string;
  } | null {
    const identity = this.get(run);
    if (!identity.celestial) return null;
    const c = identity.celestial;
    return {
      standing: qualitativeBand(c.acceptance),
      privilege: qualitativeBand(c.privilegeLevel),
      protection: qualitativeBand(c.protectionLevel),
      humanConnection: qualitativeBand(c.humanConnection),
    };
  },
};

export function isPlayerBountyHunter(run: RunState): boolean {
  return IdentityService.isPlayerBountyHunter(run);
}
