import type {
  CareerFactionId,
  CareerRoleId,
  FactionRankDefinition,
  OrganizationDefinition,
  RelationFactionId,
} from "../models/types";

function ranks(
  factionId: CareerFactionId,
  entries: Array<{
    id: string;
    name: string;
    membershipStatus: FactionRankDefinition["membershipStatus"];
    minReputationWithin?: number;
    minFactionStanding?: number;
    benefits?: string[];
    roleId?: CareerRoleId;
  }>,
): FactionRankDefinition[] {
  return entries.map((entry, order) => ({
    ...entry,
    factionId,
    order,
  }));
}

export const MARINE_RANKS: FactionRankDefinition[] = ranks("MARINES", [
  {
    id: "marine_recruit",
    name: "Recruit",
    membershipStatus: "PROSPECT",
    benefits: ["Marine barracks access", "Basic pay"],
  },
  {
    id: "marine_seaman",
    name: "Seaman",
    membershipStatus: "MEMBER",
    minReputationWithin: 5,
    benefits: ["Standard Marine pay", "Unit assignment"],
  },
  {
    id: "marine_petty_officer",
    name: "Petty Officer",
    membershipStatus: "MEMBER",
    minReputationWithin: 15,
  },
  {
    id: "marine_ensign",
    name: "Ensign",
    membershipStatus: "MEMBER",
    minReputationWithin: 25,
    minFactionStanding: 5,
  },
  {
    id: "marine_lieutenant",
    name: "Lieutenant",
    membershipStatus: "OFFICER",
    minReputationWithin: 40,
    minFactionStanding: 10,
    benefits: ["Command small detachments", "Issue unit orders"],
  },
  {
    id: "marine_commander",
    name: "Commander",
    membershipStatus: "OFFICER",
    minReputationWithin: 55,
    minFactionStanding: 15,
  },
  {
    id: "marine_captain",
    name: "Captain",
    membershipStatus: "OFFICER",
    minReputationWithin: 70,
    minFactionStanding: 20,
  },
  {
    id: "marine_commodore",
    name: "Commodore",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 85,
    minFactionStanding: 30,
  },
  {
    id: "marine_rear_admiral",
    name: "Rear Admiral",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 100,
    minFactionStanding: 40,
  },
  {
    id: "marine_vice_admiral",
    name: "Vice Admiral",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 120,
    minFactionStanding: 50,
  },
  {
    id: "marine_admiral",
    name: "Admiral",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 150,
    minFactionStanding: 60,
  },
  {
    id: "marine_fleet_admiral",
    name: "Fleet Admiral",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 200,
    minFactionStanding: 75,
    benefits: ["Supreme Marine authority"],
  },
]);

export const PIRATE_RANKS: FactionRankDefinition[] = ranks("PIRATES", [
  {
    id: "pirate_deckhand",
    name: "Deckhand",
    membershipStatus: "PROSPECT",
    benefits: ["Crew berth"],
  },
  {
    id: "pirate_crew",
    name: "Crew Member",
    membershipStatus: "MEMBER",
    minReputationWithin: 8,
  },
  {
    id: "pirate_officer",
    name: "Officer",
    membershipStatus: "OFFICER",
    minReputationWithin: 25,
  },
  {
    id: "pirate_first_mate",
    name: "First Mate",
    membershipStatus: "OFFICER",
    minReputationWithin: 45,
  },
  {
    id: "pirate_captain",
    name: "Captain",
    membershipStatus: "OFFICER",
    minReputationWithin: 60,
    benefits: ["Raise your flag", "Claim a crew"],
  },
  {
    id: "pirate_notorious",
    name: "Notorious Captain",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 90,
    minFactionStanding: 15,
  },
  {
    id: "pirate_legendary",
    name: "Legendary Captain",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 140,
    minFactionStanding: 35,
  },
]);

export const REVOLUTIONARY_RANKS: FactionRankDefinition[] = ranks("REVOLUTIONARY_ARMY", [
  {
    id: "rev_sympathizer",
    name: "Sympathizer",
    membershipStatus: "PROSPECT",
  },
  {
    id: "rev_cell_member",
    name: "Cell Member",
    membershipStatus: "MEMBER",
    minReputationWithin: 10,
  },
  {
    id: "rev_operative",
    name: "Operative",
    membershipStatus: "MEMBER",
    minReputationWithin: 25,
  },
  {
    id: "rev_officer",
    name: "Officer",
    membershipStatus: "OFFICER",
    minReputationWithin: 45,
  },
  {
    id: "rev_commander",
    name: "Commander",
    membershipStatus: "OFFICER",
    minReputationWithin: 70,
  },
  {
    id: "rev_army_commander",
    name: "Army Commander",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 110,
    minFactionStanding: 25,
  },
]);

export const WORLD_GOVERNMENT_RANKS: FactionRankDefinition[] = ranks("WORLD_GOVERNMENT", [
  {
    id: "wg_clerk",
    name: "Clerk",
    membershipStatus: "PROSPECT",
  },
  {
    id: "wg_agent",
    name: "Agent",
    membershipStatus: "MEMBER",
    minReputationWithin: 15,
  },
  {
    id: "wg_senior_agent",
    name: "Senior Agent",
    membershipStatus: "MEMBER",
    minReputationWithin: 35,
  },
  {
    id: "wg_official",
    name: "Official",
    membershipStatus: "OFFICER",
    minReputationWithin: 55,
  },
  {
    id: "wg_high_official",
    name: "High Official",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 90,
    minFactionStanding: 30,
  },
]);

/** Bounty Hunter is a Civilian role ladder — not a separate faction. */
export const BOUNTY_HUNTER_RANKS: FactionRankDefinition[] = ranks("CIVILIAN", [
  {
    id: "hunter_unknown",
    name: "Unknown Hunter",
    membershipStatus: "PROSPECT",
    roleId: "BOUNTY_HUNTER",
  },
  {
    id: "hunter_local",
    name: "Local Hunter",
    membershipStatus: "MEMBER",
    minReputationWithin: 10,
    roleId: "BOUNTY_HUNTER",
  },
  {
    id: "hunter_known",
    name: "Known Hunter",
    membershipStatus: "MEMBER",
    minReputationWithin: 30,
    roleId: "BOUNTY_HUNTER",
  },
  {
    id: "hunter_famous",
    name: "Famous Hunter",
    membershipStatus: "OFFICER",
    minReputationWithin: 55,
    roleId: "BOUNTY_HUNTER",
  },
  {
    id: "hunter_elite",
    name: "Elite Hunter",
    membershipStatus: "OFFICER",
    minReputationWithin: 85,
    roleId: "BOUNTY_HUNTER",
  },
  {
    id: "hunter_legendary",
    name: "Legendary Hunter",
    membershipStatus: "HIGH_RANK",
    minReputationWithin: 130,
    roleId: "BOUNTY_HUNTER",
  },
]);
export const INDEPENDENT_RANKS: FactionRankDefinition[] = ranks("INDEPENDENT", [
  {
    id: "indie_traveler",
    name: "Traveler",
    membershipStatus: "INDEPENDENT",
  },
  {
    id: "indie_adventurer",
    name: "Adventurer",
    membershipStatus: "INDEPENDENT",
    minReputationWithin: 20,
  },
  {
    id: "indie_sailor",
    name: "Independent Sailor",
    membershipStatus: "INDEPENDENT",
    minReputationWithin: 40,
  },
  {
    id: "indie_wanderer",
    name: "Renowned Wanderer",
    membershipStatus: "INDEPENDENT",
    minReputationWithin: 80,
  },
]);

export const CIVILIAN_RANKS: FactionRankDefinition[] = ranks("CIVILIAN", [
  {
    id: "civilian_wanderer",
    name: "Wanderer",
    membershipStatus: "INDEPENDENT",
    roleId: "WANDERER",
  },
  {
    id: "civilian_citizen",
    name: "Citizen",
    membershipStatus: "INDEPENDENT",
  },
  {
    id: "civilian_notable",
    name: "Notable Citizen",
    membershipStatus: "MEMBER",
    minReputationWithin: 25,
  },
]);
/** Organizations under factions — Cipher Pol etc. stubbed for later. */
export const ORGANIZATIONS: OrganizationDefinition[] = [
  {
    id: "cipher_pol",
    name: "Cipher Pol",
    parentFactionId: "WORLD_GOVERNMENT",
    description: "World Government intelligence network. Full espionage systems deferred.",
    espionageEnabled: false,
  },
  {
    id: "marine_hq",
    name: "Marine Headquarters",
    parentFactionId: "MARINES",
    description: "Central Marine command structure.",
  },
];

const ALL_RANK_TABLES: FactionRankDefinition[][] = [
  MARINE_RANKS,
  PIRATE_RANKS,
  REVOLUTIONARY_RANKS,
  WORLD_GOVERNMENT_RANKS,
  BOUNTY_HUNTER_RANKS,
  INDEPENDENT_RANKS,
  CIVILIAN_RANKS,
];

export const ALL_RANKS: FactionRankDefinition[] = ALL_RANK_TABLES.flat();

export function getRanksForFaction(factionId: CareerFactionId): FactionRankDefinition[] {
  return ALL_RANKS.filter(
    (rank) => rank.factionId === factionId && !rank.roleId,
  ).sort((a, b) => a.order - b.order);
}

export function getRanksForRole(roleId: CareerRoleId): FactionRankDefinition[] {
  const byRole = ALL_RANKS.filter((rank) => rank.roleId === roleId).sort((a, b) => a.order - b.order);
  if (byRole.length) return byRole;
  if (roleId === "WANDERER") {
    return ALL_RANKS.filter((rank) => rank.id === "civilian_wanderer" || rank.id === "civilian_citizen");
  }
  return [];
}

export function getRankById(rankId: string): FactionRankDefinition | undefined {
  return ALL_RANKS.find((rank) => rank.id === rankId);
}

export function getStartingRankId(factionId: CareerFactionId): string {
  if (factionId === "BOUNTY_HUNTER") {
    return getRanksForRole("BOUNTY_HUNTER")[0]?.id ?? "hunter_unknown";
  }
  const list = getRanksForFaction(factionId);
  return list[0]?.id ?? "civilian_wanderer";
}

export function getOrganization(id: string): OrganizationDefinition | undefined {
  return ORGANIZATIONS.find((org) => org.id === id);
}

export function careerToRelationFaction(factionId: CareerFactionId): RelationFactionId | null {
  switch (factionId) {
    case "MARINES":
      return "MARINES";
    case "PIRATES":
      return "PIRATES";
    case "REVOLUTIONARY_ARMY":
      return "REVOLUTIONARY_ARMY";
    case "WORLD_GOVERNMENT":
      return "WORLD_GOVERNMENT";
    case "CIVILIAN":
      return "CIVILIANS";
    case "BOUNTY_HUNTER":
    case "INDEPENDENT":
      return null;
    default:
      return null;
  }
}

export const CAREER_FACTION_LABELS: Record<CareerFactionId, string> = {
  PIRATES: "Pirates",
  MARINES: "Marines",
  REVOLUTIONARY_ARMY: "Revolutionary Army",
  WORLD_GOVERNMENT: "World Government",
  BOUNTY_HUNTER: "Bounty Hunter (legacy)",
  CIVILIAN: "Civilians",
  INDEPENDENT: "Independent",
};
