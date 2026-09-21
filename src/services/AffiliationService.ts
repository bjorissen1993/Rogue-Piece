import {
  CAREER_FACTION_LABELS,
  careerToRelationFaction,
  getRankById,
  getRanksForFaction,
  getStartingRankId,
} from "../data/ranks";
import type {
  CareerFactionId,
  LeaveAffiliationMode,
  MembershipStatus,
  Player,
  PlayerAffiliation,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { clamp } from "../utils/stats";
import { FactionService } from "./FactionService";
import { WorldService } from "./WorldService";
import { IdentityService } from "./IdentityService";

const ACTIVE_MEMBERSHIP: MembershipStatus[] = [
  "PROSPECT",
  "MEMBER",
  "OFFICER",
  "HIGH_RANK",
];

export type HudMetricKind =
  | "BOUNTY"
  | "MERIT"
  | "NOTORIETY"
  | "HUNTER_RANK"
  | "TITLE";

export interface HudMetric {
  kind: HudMetricKind;
  label: string;
  value: string;
}

function pushHistory(
  affiliation: PlayerAffiliation,
  day: number,
  event: PlayerAffiliation["history"][number]["event"],
  note?: string,
): void {
  affiliation.history.push({
    id: createId("aff_hist"),
    day,
    factionId: affiliation.primaryFactionId ?? null,
    organizationId: affiliation.organizationId ?? null,
    membershipStatus: affiliation.membershipStatus,
    rankId: affiliation.rankId ?? null,
    event,
    note,
  });
}

export function defaultAffiliation(): PlayerAffiliation {
  return {
    primaryFactionId: "CIVILIAN",
    organizationId: null,
    membershipStatus: "INDEPENDENT",
    rankId: "civilian_wanderer",
    joinedDay: null,
    loyalty: 50,
    reputationWithinFaction: 0,
    history: [],
    pendingOffer: null,
  };
}

function looksLikePirateFromLegacy(player: Player, run?: RunState): boolean {
  if (player.flags.some((flag) => /pirate|raise_flag|declared_pirate/i.test(flag))) {
    return true;
  }
  if (run?.runFlags.some((flag) => /pirate|raise_flag|declared_pirate/i.test(flag))) {
    return true;
  }
  if ((player.title || "").toLowerCase().includes("pirate")) {
    return true;
  }
  return false;
}

/** Create/migrate affiliation only — never sync title (avoids ensure↔computeTitle recursion). */
function materializeAffiliation(run: RunState): PlayerAffiliation {
  if (!run.player.affiliation) {
    if (looksLikePirateFromLegacy(run.player, run)) {
      run.player.affiliation = {
        ...defaultAffiliation(),
        primaryFactionId: "PIRATES",
        membershipStatus: "MEMBER",
        rankId: "pirate_crew",
        joinedDay: run.day,
        loyalty: 55,
        reputationWithinFaction: 10,
      };
      pushHistory(run.player.affiliation, run.day, "JOINED", "Migrated from legacy pirate cues");
    } else {
      run.player.affiliation = defaultAffiliation();
    }
  }
  return run.player.affiliation;
}

/** Story-chain granted epithet (player.flags story_title:…). */
const STORY_TITLE_FLAG_PREFIX = "story_title:";

function overlayStoryTitle(run: RunState, base: string): string {
  const flag = run.player.flags.find((f) => f.startsWith(STORY_TITLE_FLAG_PREFIX));
  const extra = flag?.slice(STORY_TITLE_FLAG_PREFIX.length).trim();
  if (!extra || base.includes(extra)) {
    return base;
  }
  return `${base} · ${extra}`;
}

function computeCareerTitle(run: RunState): string {
  const aff = materializeAffiliation(run);
  const identity = run.player.identity;
  const hunterRankId = identity?.roleRankId;
  const hunterRank = hunterRankId ? getRankById(hunterRankId) : undefined;
  const rank = aff.rankId ? getRankById(aff.rankId) : undefined;
  const wanted =
    identity?.legalStatusId === "WANTED" ||
    identity?.legalStatusId === "FUGITIVE" ||
    run.player.bounty > 0;
  const active = ACTIVE_MEMBERSHIP.includes(aff.membershipStatus);

  if (identity?.roleId === "BOUNTY_HUNTER") {
    const name = hunterRank?.name ?? "Bounty Hunter";
    return wanted ? `${name} · Wanted` : name;
  }

  if (identity?.roleId === "CELESTIAL_DRAGON") {
    return identity.celestial?.lostStatus ? "Ex-Celestial" : "Celestial Dragon";
  }

  if (aff.membershipStatus === "TRAITOR") {
    const label = aff.primaryFactionId
      ? CAREER_FACTION_LABELS[aff.primaryFactionId]
      : "Faction";
    return wanted ? `Traitor · Wanted` : `Traitor to the ${label}`;
  }

  if (aff.membershipStatus === "FORMER_MEMBER") {
    if (aff.primaryFactionId === "MARINES") {
      return wanted ? "Former Marine · Wanted" : "Former Marine";
    }
    if (aff.primaryFactionId === "PIRATES") {
      return wanted ? "Former Pirate · Wanted" : "Former Pirate";
    }
    if (aff.primaryFactionId) {
      const label = CAREER_FACTION_LABELS[aff.primaryFactionId];
      return wanted ? `Former ${label} · Wanted` : `Former ${label}`;
    }
  }

  if (aff.primaryFactionId === "MARINES" && active && rank) {
    return `Marine ${rank.name}`;
  }
  if (aff.primaryFactionId === "PIRATES" && active && rank) {
    if (rank.id === "pirate_captain" || rank.order >= 4) {
      return rank.name;
    }
    return `Pirate ${rank.name}`;
  }
  if (aff.primaryFactionId === "REVOLUTIONARY_ARMY" && active && rank) {
    return `Revolutionary ${rank.name}`;
  }
  if (aff.primaryFactionId === "WORLD_GOVERNMENT" && active && rank) {
    return `WG ${rank.name}`;
  }
  if (aff.primaryFactionId === "BOUNTY_HUNTER" && active && rank) {
    return rank.name;
  }
  if (identity?.roleId === "WANDERER") {
    return wanted ? "Wanderer · Wanted" : "Wanderer";
  }
  if (rank && (aff.primaryFactionId === "INDEPENDENT" || aff.primaryFactionId === "CIVILIAN" || aff.membershipStatus === "INDEPENDENT")) {
    return wanted ? `${rank.name} · Wanted` : rank.name;
  }
  return wanted ? "Wanderer · Wanted" : "Wanderer";
}

export const AffiliationService = {
  defaultAffiliation,

  ensure(run: RunState): PlayerAffiliation {
    const affiliation = materializeAffiliation(run);
    // Existing saves may still carry bounty / Wanted after joining the Marines.
    if (
      affiliation.primaryFactionId === "MARINES" &&
      ACTIVE_MEMBERSHIP.includes(affiliation.membershipStatus)
    ) {
      if (run.player.bounty > 0) {
        run.player.bounty = 0;
      }
      IdentityService.syncLegalFromBounty(run);
    }
    run.player.title = this.computeTitle(run);
    return affiliation;
  },

  get(run: RunState): PlayerAffiliation {
    return this.ensure(run);
  },

  isActiveMember(affiliation: PlayerAffiliation): boolean {
    return ACTIVE_MEMBERSHIP.includes(affiliation.membershipStatus);
  },

  isPlayerPirate(run: RunState): boolean {
    const aff = this.get(run);
    return aff.primaryFactionId === "PIRATES" && this.isActiveMember(aff);
  },

  isPlayerMarine(run: RunState): boolean {
    const aff = this.get(run);
    return aff.primaryFactionId === "MARINES" && this.isActiveMember(aff);
  },

  isPlayerRevolutionary(run: RunState): boolean {
    const aff = this.get(run);
    return aff.primaryFactionId === "REVOLUTIONARY_ARMY" && this.isActiveMember(aff);
  },

  isPlayerWorldGovernment(run: RunState): boolean {
    const aff = this.get(run);
    return aff.primaryFactionId === "WORLD_GOVERNMENT" && this.isActiveMember(aff);
  },

  isPlayerBountyHunter(run: RunState): boolean {
    if (run.player.identity?.roleId === "BOUNTY_HUNTER") {
      return true;
    }
    const aff = this.get(run);
    return aff.primaryFactionId === "BOUNTY_HUNTER" && this.isActiveMember(aff);
  },

  isPlayerIndependent(run: RunState): boolean {
    const aff = this.get(run);
    return (
      aff.membershipStatus === "INDEPENDENT" ||
      !aff.primaryFactionId ||
      aff.primaryFactionId === "INDEPENDENT" ||
      aff.primaryFactionId === "CIVILIAN"
    );
  },

  belongsToFaction(run: RunState, factionId: CareerFactionId): boolean {
    const aff = this.get(run);
    return aff.primaryFactionId === factionId && this.isActiveMember(aff);
  },

  getRank(run: RunState) {
    const aff = this.get(run);
    return aff.rankId ? getRankById(aff.rankId) : undefined;
  },

  computeTitle(run: RunState): string {
    return overlayStoryTitle(run, computeCareerTitle(run));
  },

  syncTitle(run: RunState): void {
    materializeAffiliation(run);
    run.player.title = this.computeTitle(run);
  },

  getCrewLabel(run: RunState): string {
    if (this.isPlayerMarine(run)) return "Marine Unit";
    if (this.isPlayerRevolutionary(run)) return "Revolutionary Cell";
    if (this.isPlayerWorldGovernment(run)) return "Operative Team";
    if (this.isPlayerBountyHunter(run)) return "Hunter Team";
    if (this.isPlayerPirate(run)) return "Crew";
    return "Crew";
  },

  getLeaderLabel(run: RunState): string {
    if (this.isPlayerMarine(run)) {
      const rank = this.getRank(run);
      if (rank && rank.order >= 4) return rank.name;
      return "Officer";
    }
    if (this.isPlayerRevolutionary(run)) return "Cell Lead";
    if (this.isPlayerWorldGovernment(run)) return "Lead Agent";
    if (this.isPlayerBountyHunter(run)) return "Lead Hunter";
    if (this.isPlayerPirate(run)) return "Captain";
    return "Leader";
  },

  getHudMetric(run: RunState): HudMetric {
    const aff = this.get(run);
    const rank = this.getRank(run);

    if (this.isPlayerMarine(run)) {
      return {
        kind: "MERIT",
        label: "Merit",
        value: String(Math.round(aff.reputationWithinFaction)),
      };
    }
    if (this.isPlayerRevolutionary(run)) {
      return {
        kind: "NOTORIETY",
        label: "Notoriety",
        value: String(Math.round(aff.reputationWithinFaction)),
      };
    }
    if (this.isPlayerBountyHunter(run)) {
      return {
        kind: "HUNTER_RANK",
        label: "Hunter Rank",
        value: rank?.name ?? "Unknown Hunter",
      };
    }
    if (this.isPlayerWorldGovernment(run)) {
      return {
        kind: "MERIT",
        label: "Standing",
        value: String(Math.round(aff.reputationWithinFaction)),
      };
    }
    if (this.isPlayerPirate(run) || run.player.bounty > 0 || aff.membershipStatus === "TRAITOR") {
      return {
        kind: "BOUNTY",
        label: "Bounty",
        value: String(run.player.bounty),
      };
    }
    return {
      kind: "TITLE",
      label: "Title",
      value: run.player.title || "Independent Sailor",
    };
  },

  join(
    run: RunState,
    options: {
      factionId: CareerFactionId;
      rankId?: string;
      organizationId?: string | null;
      asProspect?: boolean;
      note?: string;
      silent?: boolean;
    },
  ): string {
    // Bounty Hunter is a Civilian role, not an institutional faction.
    if (options.factionId === "BOUNTY_HUNTER") {
      const aff = this.ensure(run);
      aff.primaryFactionId = "CIVILIAN";
      aff.membershipStatus = options.asProspect ? "PROSPECT" : "MEMBER";
      aff.rankId = "civilian_citizen";
      aff.joinedDay = run.day;
      aff.pendingOffer = null;
      pushHistory(aff, run.day, "JOINED", options.note ?? "Registered as civilian bounty hunter");
      const identity = run.player.identity ?? {
        factionId: "CIVILIAN" as const,
        roleId: "WANDERER" as const,
        legalStatusId: "LAWFUL" as const,
        roleRankId: "civilian_wanderer",
        tendencies: {
          authorityAlignment: 0,
          civilianConduct: 10,
          profitMotive: 0,
          criminality: 0,
          independence: 20,
          worldGovernmentLoyalty: 0,
          compassion: 0,
          entitlement: 0,
          ideologicalAlignment: 0,
          violenceAgainstCivilians: 0,
          violenceAgainstMarines: 0,
          violenceAgainstPirates: 0,
          bountyCollectionBehavior: 0,
          protectionBehavior: 0,
          obedience: 0,
          rebellion: 0,
        },
        celestial: null,
        assignedPartnerId: null,
        roleHistory: [],
        legalHistory: [],
      };
      identity.factionId = "CIVILIAN";
      identity.roleId = "BOUNTY_HUNTER";
      identity.roleRankId = options.rankId ?? "hunter_unknown";
      identity.roleHistory.push({
        id: createId("role_hist"),
        day: run.day,
        roleId: "BOUNTY_HUNTER",
        note: options.note,
      });
      run.player.identity = identity;
      this.syncTitle(run);
      const message = `You register as a Bounty Hunter while remaining a Civilian.`;
      if (!options.silent) {
        WorldService.addNews(run, `${run.player.name} takes up bounty contracts as a civilian hunter.`);
      }
      return message;
    }

    const aff = this.ensure(run);
    const previous = aff.primaryFactionId;
    const switching =
      previous &&
      previous !== options.factionId &&
      this.isActiveMember(aff);

    const rankId = options.rankId ?? getStartingRankId(options.factionId);
    const rank = getRankById(rankId) ?? getRanksForFaction(options.factionId)[0];
    const status: MembershipStatus = options.asProspect
      ? "PROSPECT"
      : rank?.membershipStatus ?? "MEMBER";

    aff.primaryFactionId = options.factionId;
    aff.organizationId = options.organizationId ?? null;
    aff.membershipStatus = status === "INDEPENDENT" ? "MEMBER" : status;
    aff.rankId = rank?.id ?? rankId;
    aff.joinedDay = run.day;
    aff.loyalty = switching ? 40 : 60;
    aff.reputationWithinFaction = Math.max(aff.reputationWithinFaction, rank?.minReputationWithin ?? 0);
    aff.pendingOffer = null;

    pushHistory(
      aff,
      run.day,
      switching ? "SWITCHED" : options.factionId === "PIRATES" ? "DECLARED" : "JOINED",
      options.note ??
        (switching
          ? `Switched from ${previous} to ${options.factionId}`
          : `Joined ${CAREER_FACTION_LABELS[options.factionId]}`),
    );

    const identity = IdentityService.ensure(run);
    switch (options.factionId) {
      case "MARINES":
        IdentityService.setFaction(run, "MARINES");
        if (identity.roleId === "WANDERER" || identity.roleId === "BOUNTY_HUNTER" || switching) {
          IdentityService.setRole(run, "MARINE_RECRUIT", rank?.id, options.note);
        }
        // Active Marines are not wanted — clear personal bounty + warrant until they leave.
        run.player.bounty = 0;
        IdentityService.setLegalStatus(run, "LAWFUL", options.note ?? "Marine enlistment clears your warrant");
        break;
      case "PIRATES":
        IdentityService.setFaction(run, "PIRATES");
        IdentityService.setRole(
          run,
          rank?.id === "pirate_captain" ? "PIRATE_CAPTAIN" : "PIRATE_CREW",
          rank?.id,
          options.note,
        );
        break;
      case "REVOLUTIONARY_ARMY":
        IdentityService.setFaction(run, "REVOLUTIONARY_ARMY");
        IdentityService.setRole(run, "REVOLUTIONARY_OPERATIVE", rank?.id, options.note);
        break;
      case "WORLD_GOVERNMENT":
        IdentityService.setFaction(run, "WORLD_GOVERNMENT");
        IdentityService.setRole(run, "CIPHER_POL_AGENT", rank?.id, options.note);
        IdentityService.setLegalStatus(run, "GOVERNMENT_AGENT", options.note);
        break;
      case "CIVILIAN":
        IdentityService.setFaction(run, "CIVILIAN");
        break;
      default:
        break;
    }

    this.syncTitle(run);

    const relation = careerToRelationFaction(options.factionId);
    if (relation) {
      FactionService.modifyRelationship(
        run,
        relation,
        switching ? 8 : 12,
        options.note ?? `Joined ${CAREER_FACTION_LABELS[options.factionId]}`,
      );
    }

    const message = switching
      ? `You leave your old path behind and join the ${CAREER_FACTION_LABELS[options.factionId]} as ${rank?.name ?? "a recruit"}.`
      : `You join the ${CAREER_FACTION_LABELS[options.factionId]} as ${rank?.name ?? "a recruit"}.`;

    if (!options.silent) {
      WorldService.addNews(
        run,
        `${run.player.name} has aligned with the ${CAREER_FACTION_LABELS[options.factionId]}.`,
      );
    }

    run.runFlags = run.runFlags.includes(`joined_${options.factionId.toLowerCase()}`)
      ? run.runFlags
      : [...run.runFlags, `joined_${options.factionId.toLowerCase()}`];
    run.player.flags = run.player.flags.includes("has_affiliation")
      ? run.player.flags
      : [...run.player.flags, "has_affiliation"];

    return message;
  },

  leave(
    run: RunState,
    mode: LeaveAffiliationMode,
    note?: string,
  ): string {
    const aff = this.ensure(run);
    if (!this.isActiveMember(aff) || !aff.primaryFactionId) {
      return "You have no active affiliation to leave.";
    }

    const factionId = aff.primaryFactionId;
    const label = CAREER_FACTION_LABELS[factionId];
    const relation = careerToRelationFaction(factionId);

    if (mode === "RESIGN") {
      aff.membershipStatus = "FORMER_MEMBER";
      aff.loyalty = clamp(aff.loyalty - 15, 0, 100);
      pushHistory(aff, run.day, "RESIGNED", note ?? `Resigned from ${label}`);
      if (relation) {
        FactionService.modifyRelationship(run, relation, -8, note ?? `Resigned from ${label}`);
      }
      WorldService.addNews(run, `${run.player.name} has resigned from the ${label}.`);
      this.syncTitle(run);
      return `You resign from the ${label}. Papers are stamped. Bridges remain — barely.`;
    }

    if (mode === "DESERT") {
      aff.membershipStatus = "FORMER_MEMBER";
      aff.loyalty = clamp(aff.loyalty - 35, 0, 100);
      pushHistory(aff, run.day, "DESERTED", note ?? `Deserted ${label}`);
      if (relation) {
        FactionService.modifyRelationship(run, relation, -25, note ?? `Deserted ${label}`);
      }
      if (factionId === "MARINES") {
        run.player.bounty = Math.max(run.player.bounty, 5000);
        FactionService.modifyRelationship(run, "PIRATES", 5, "Marine deserter");
      }
      WorldService.addNews(run, `${run.player.name} has deserted the ${label}.`);
      this.syncTitle(run);
      return `You desert the ${label}. Word travels fast — and not kindly.`;
    }

    // BETRAY
    aff.membershipStatus = "TRAITOR";
    aff.loyalty = 0;
    pushHistory(aff, run.day, "BETRAYED", note ?? `Betrayed ${label}`);
    if (relation) {
      FactionService.modifyRelationship(run, relation, -45, note ?? `Betrayed ${label}`);
    }
    if (factionId === "MARINES") {
      run.player.bounty = Math.max(run.player.bounty + 25000, 30000);
      FactionService.modifyRelationship(run, "PIRATES", 12, "Betrayed the Marines");
    }
    WorldService.addNews(run, `${run.player.name} has betrayed the ${label} — a name now spoken with venom.`);
    this.syncTitle(run);
    return `You betray the ${label}. There is no going back cleanly.`;
  },

  setIndependent(run: RunState, note?: string): string {
    const aff = this.ensure(run);
    aff.primaryFactionId = null;
    aff.organizationId = null;
    aff.membershipStatus = "INDEPENDENT";
    aff.rankId = "indie_sailor";
    aff.joinedDay = null;
    aff.loyalty = 50;
    aff.pendingOffer = null;
    pushHistory(aff, run.day, "SET_INDEPENDENT", note ?? "Returned to independent life");
    this.syncTitle(run);
    WorldService.addNews(run, `${run.player.name} sails under no banner.`);
    return "You walk your own path again — Independent Sailor.";
  },

  canPromote(run: RunState): boolean {
    const aff = this.get(run);
    if (!aff.primaryFactionId || !this.isActiveMember(aff)) {
      return false;
    }
    const ranks = getRanksForFaction(aff.primaryFactionId);
    const current = aff.rankId ? getRankById(aff.rankId) : undefined;
    if (!current) {
      return false;
    }
    const next = ranks.find((rank) => rank.order === current.order + 1);
    if (!next) {
      return false;
    }
    if (
      next.minReputationWithin != null &&
      aff.reputationWithinFaction < next.minReputationWithin
    ) {
      return false;
    }
    const relation = careerToRelationFaction(aff.primaryFactionId);
    if (next.minFactionStanding != null && relation) {
      const standing = FactionService.getRelationship(run, relation).value;
      if (standing < next.minFactionStanding) {
        return false;
      }
    }
    return true;
  },

  promote(run: RunState, force = false): string {
    const aff = this.ensure(run);
    if (!aff.primaryFactionId || !this.isActiveMember(aff)) {
      return "No active affiliation to promote.";
    }
    if (!force && !this.canPromote(run)) {
      return "Promotion requirements not met (reputation / standing).";
    }
    const ranks = getRanksForFaction(aff.primaryFactionId);
    const current = aff.rankId ? getRankById(aff.rankId) : ranks[0];
    if (!current) {
      return "No rank table found.";
    }
    const next = ranks.find((rank) => rank.order === current.order + 1);
    if (!next) {
      return "Already at the highest rank.";
    }
    aff.rankId = next.id;
    aff.membershipStatus = next.membershipStatus === "INDEPENDENT" ? "MEMBER" : next.membershipStatus;
    aff.loyalty = clamp(aff.loyalty + 5, 0, 100);
    pushHistory(aff, run.day, "PROMOTED", `Promoted to ${next.name}`);
    this.syncTitle(run);
    WorldService.addNews(
      run,
      `${run.player.name} has been promoted to ${next.name} within the ${CAREER_FACTION_LABELS[aff.primaryFactionId]}.`,
    );
    return `Promoted to ${next.name}.`;
  },

  demote(run: RunState): string {
    const aff = this.ensure(run);
    if (!aff.primaryFactionId || !this.isActiveMember(aff)) {
      return "No active affiliation to demote.";
    }
    const ranks = getRanksForFaction(aff.primaryFactionId);
    const current = aff.rankId ? getRankById(aff.rankId) : undefined;
    if (!current || current.order <= 0) {
      return "Already at the lowest rank.";
    }
    const prev = ranks.find((rank) => rank.order === current.order - 1);
    if (!prev) {
      return "No lower rank found.";
    }
    aff.rankId = prev.id;
    aff.membershipStatus = prev.membershipStatus === "INDEPENDENT" ? "MEMBER" : prev.membershipStatus;
    aff.loyalty = clamp(aff.loyalty - 8, 0, 100);
    pushHistory(aff, run.day, "DEMOTED", `Demoted to ${prev.name}`);
    this.syncTitle(run);
    return `Demoted to ${prev.name}.`;
  },

  adjustLoyalty(run: RunState, amount: number): void {
    const aff = this.ensure(run);
    aff.loyalty = clamp(aff.loyalty + amount, 0, 100);
  },

  adjustInternalReputation(run: RunState, amount: number): void {
    const aff = this.ensure(run);
    aff.reputationWithinFaction = Math.max(0, aff.reputationWithinFaction + amount);
    this.syncTitle(run);
  },

  offerRecruitment(
    run: RunState,
    options: {
      factionId: CareerFactionId;
      rankId?: string;
      organizationId?: string | null;
      source?: string;
      benefits?: string[];
      consequences?: string[];
    },
  ): string {
    const aff = this.ensure(run);
    const rankId = options.rankId ?? getStartingRankId(options.factionId);
    const rank = getRankById(rankId);
    aff.pendingOffer = {
      factionId: options.factionId,
      organizationId: options.organizationId ?? null,
      offeredRankId: rankId,
      source: options.source ?? "encounter",
      day: run.day,
      expiresDay: run.day + 14,
      benefits: options.benefits ?? rank?.benefits ?? [
        `Rank: ${rank?.name ?? "Recruit"}`,
        "Faction missions and standing",
      ],
      consequences: options.consequences ?? [
        "Orders may conflict with personal freedom",
        "Leaving later may damage reputation",
      ],
    };
    pushHistory(aff, run.day, "OFFER_RECEIVED", `Offer from ${CAREER_FACTION_LABELS[options.factionId]}`);
    return `A recruitment offer from the ${CAREER_FACTION_LABELS[options.factionId]} awaits your answer.`;
  },

  acceptPendingOffer(run: RunState): string {
    const aff = this.ensure(run);
    const offer = aff.pendingOffer;
    if (!offer) {
      return "No pending recruitment offer.";
    }
    if (offer.source === "identity_bounty_hunter_path" || offer.offeredRankId?.startsWith("hunter_")) {
      aff.pendingOffer = null;
      IdentityService.setRole(run, "BOUNTY_HUNTER", offer.offeredRankId ?? "hunter_unknown", `Accepted offer from ${offer.source}`);
      return "You take the hunter's path — still Civilian, now a bounty hunter.";
    }
    return this.join(run, {
      factionId: offer.factionId,
      rankId: offer.offeredRankId,
      organizationId: offer.organizationId,
      note: `Accepted offer from ${offer.source}`,
    });
  },

  declinePendingOffer(run: RunState): string {
    const aff = this.ensure(run);
    if (!aff.pendingOffer) {
      return "No pending recruitment offer.";
    }
    const factionId = aff.pendingOffer.factionId;
    aff.pendingOffer = null;
    pushHistory(aff, run.day, "OFFER_DECLINED", `Declined ${CAREER_FACTION_LABELS[factionId]}`);
    return `You decline the ${CAREER_FACTION_LABELS[factionId]} offer.`;
  },

  summary(run: RunState): {
    factionLabel: string;
    rankLabel: string;
    status: MembershipStatus;
    loyalty: number;
    reputationWithin: number;
    joinedDay: number | null;
    standingLabel: string;
  } {
    const aff = this.get(run);
    const identity = run.player.identity;
    const rank = this.getRank(run);
    const hunterRank = identity?.roleRankId ? getRankById(identity.roleRankId) : undefined;
    const factionLabel =
      identity?.roleId === "BOUNTY_HUNTER"
        ? "Civilian"
        : aff.primaryFactionId
          ? CAREER_FACTION_LABELS[aff.primaryFactionId]
          : "Independent";
    return {
      factionLabel,
      rankLabel:
        identity?.roleId === "BOUNTY_HUNTER"
          ? hunterRank?.name ?? "Bounty Hunter"
          : rank?.name ?? "—",
      status: aff.membershipStatus,
      loyalty: aff.loyalty,
      reputationWithin: aff.reputationWithinFaction,
      joinedDay: aff.joinedDay ?? null,
      standingLabel: this.isActiveMember(aff)
        ? "Member"
        : aff.membershipStatus === "INDEPENDENT"
          ? "Unaffiliated"
          : aff.membershipStatus.replaceAll("_", " "),
    };
  },
};

export function isPlayerPirate(run: RunState): boolean {
  return AffiliationService.isPlayerPirate(run);
}

export function isPlayerMarine(run: RunState): boolean {
  return AffiliationService.isPlayerMarine(run);
}

export function isPlayerRevolutionary(run: RunState): boolean {
  return AffiliationService.isPlayerRevolutionary(run);
}

export function isPlayerWorldGovernment(run: RunState): boolean {
  return AffiliationService.isPlayerWorldGovernment(run);
}

export function isPlayerBountyHunter(run: RunState): boolean {
  return AffiliationService.isPlayerBountyHunter(run);
}

export function isPlayerIndependent(run: RunState): boolean {
  return AffiliationService.isPlayerIndependent(run);
}
