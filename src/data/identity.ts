import type {
  AffiliationFactionId,
  CareerRoleId,
  IdentityTendencies,
  IdentityTendencyId,
  LegalStatusId,
  PlayerIdentity,
} from "../models/types";

export const AFFILIATION_FACTION_LABELS: Record<AffiliationFactionId, string> = {
  CIVILIAN: "Civilian",
  PIRATES: "Pirates",
  MARINES: "Marines",
  REVOLUTIONARY_ARMY: "Revolutionary Army",
  WORLD_GOVERNMENT: "World Government",
};

export const CAREER_ROLE_LABELS: Record<CareerRoleId, string> = {
  WANDERER: "Wanderer",
  BOUNTY_HUNTER: "Bounty Hunter",
  PIRATE_CAPTAIN: "Pirate Captain",
  PIRATE_CREW: "Pirate Crew",
  MARINE_RECRUIT: "Marine Recruit",
  MARINE_OFFICER: "Marine Officer",
  REVOLUTIONARY_OPERATIVE: "Revolutionary Operative",
  CIPHER_POL_AGENT: "Cipher Pol Agent",
  CELESTIAL_DRAGON: "Celestial Dragon",
  MERCHANT: "Merchant",
  MERCENARY: "Mercenary",
  EXPLORER: "Explorer",
};

export const LEGAL_STATUS_LABELS: Record<LegalStatusId, string> = {
  LAWFUL: "Lawful",
  SUSPECTED: "Suspected",
  WANTED: "Wanted",
  FUGITIVE: "Fugitive",
  PROTECTED: "Protected",
  GOVERNMENT_AGENT: "Government Agent",
  CELESTIAL_PRIVILEGE: "Celestial Privilege",
};

export const IDENTITY_TENDENCY_IDS: IdentityTendencyId[] = [
  "authorityAlignment",
  "civilianConduct",
  "profitMotive",
  "criminality",
  "independence",
  "worldGovernmentLoyalty",
  "compassion",
  "entitlement",
  "ideologicalAlignment",
  "violenceAgainstCivilians",
  "violenceAgainstMarines",
  "violenceAgainstPirates",
  "bountyCollectionBehavior",
  "protectionBehavior",
  "obedience",
  "rebellion",
];

export function defaultTendencies(): IdentityTendencies {
  return {
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
  };
}

export function defaultPlayerIdentity(): PlayerIdentity {
  return {
    factionId: "CIVILIAN",
    roleId: "WANDERER",
    legalStatusId: "LAWFUL",
    roleRankId: "civilian_wanderer",
    tendencies: defaultTendencies(),
    celestial: null,
    assignedPartnerId: null,
    roleHistory: [],
    legalHistory: [],
  };
}

export function qualitativeBand(value: number): string {
  if (value <= -40) return "Very Low";
  if (value <= -15) return "Low";
  if (value < 15) return "Neutral";
  if (value < 40) return "High";
  return "Very High";
}
