export type ProfileType = "NORMAL" | "DEVELOPMENT";
export type SaveType = ProfileType;
export type NormalSlot = 1 | 2 | 3;
export type ProfileSlot = NormalSlot | "dev";

export type FruitType = "PARAMECIA" | "ZOAN" | "LOGIA";

export type DevilFruitStatus =
  | "UNCLAIMED"
  | "PLAYER_INVENTORY"
  | "NPC_INVENTORY"
  | "PLAYER_USED"
  | "NPC_USED"
  | "IN_TRANSIT"
  | "UNKNOWN";

export type NpcFaction = "PIRATE" | "MARINE" | "CIVILIAN" | "UNDERWORLD";
export type Faction = NpcFaction;

export type RelationFactionId =
  | "MARINES"
  | "PIRATES"
  | "WORLD_GOVERNMENT"
  | "CIVILIANS"
  | "REVOLUTIONARY_ARMY";

/** Career / institutional membership path — distinct from world reputation and from Role. */
export type CareerFactionId =
  | "PIRATES"
  | "MARINES"
  | "REVOLUTIONARY_ARMY"
  | "WORLD_GOVERNMENT"
  | "CIVILIAN"
  | "INDEPENDENT"
  /** @deprecated Migrated to CareerRoleId BOUNTY_HUNTER under CIVILIAN faction. */
  | "BOUNTY_HUNTER";

/** World / institutional affiliation (player faction layer). */
export type AffiliationFactionId =
  | "CIVILIAN"
  | "PIRATES"
  | "MARINES"
  | "REVOLUTIONARY_ARMY"
  | "WORLD_GOVERNMENT";

/** Role / career — not a faction. Bounty Hunter lives here under Civilian. */
export type CareerRoleId =
  | "WANDERER"
  | "BOUNTY_HUNTER"
  | "PIRATE_CAPTAIN"
  | "PIRATE_CREW"
  | "MARINE_RECRUIT"
  | "MARINE_OFFICER"
  | "REVOLUTIONARY_OPERATIVE"
  | "CIPHER_POL_AGENT"
  | "CELESTIAL_DRAGON"
  | "MERCHANT"
  | "MERCENARY"
  | "EXPLORER";

export type LegalStatusId =
  | "LAWFUL"
  | "SUSPECTED"
  | "WANTED"
  | "FUGITIVE"
  | "PROTECTED"
  | "GOVERNMENT_AGENT"
  | "CELESTIAL_PRIVILEGE";

export type IdentityTendencyId =
  | "authorityAlignment"
  | "civilianConduct"
  | "profitMotive"
  | "criminality"
  | "independence"
  | "worldGovernmentLoyalty"
  | "compassion"
  | "entitlement"
  | "ideologicalAlignment"
  | "violenceAgainstCivilians"
  | "violenceAgainstMarines"
  | "violenceAgainstPirates"
  | "bountyCollectionBehavior"
  | "protectionBehavior"
  | "obedience"
  | "rebellion";

export type IdentityTendencies = Record<IdentityTendencyId, number>;

export interface CelestialIdentityState {
  acceptance: number;
  humanConnection: number;
  privilegeLevel: number;
  protectionLevel: number;
  royalKnightTraining: boolean;
  lostStatus: boolean;
}

export interface PlayerIdentity {
  factionId: AffiliationFactionId;
  roleId: CareerRoleId;
  legalStatusId: LegalStatusId;
  /** Role ladder rank (e.g. hunter_local) when distinct from institutional affiliation.rankId. */
  roleRankId?: string | null;
  tendencies: IdentityTendencies;
  celestial?: CelestialIdentityState | null;
  assignedPartnerId?: string | null;
  /** Day last identity offer was generated, keyed by offer source id. */
  offerCooldowns?: Record<string, number>;
  roleHistory: Array<{
    id: string;
    day: number;
    roleId: CareerRoleId;
    note?: string;
  }>;
  legalHistory: Array<{
    id: string;
    day: number;
    statusId: LegalStatusId;
    note?: string;
  }>;
}
export type MembershipStatus =
  | "INDEPENDENT"
  | "PROSPECT"
  | "MEMBER"
  | "OFFICER"
  | "HIGH_RANK"
  | "FORMER_MEMBER"
  | "TRAITOR";

export type AffiliationHistoryEvent =
  | "JOINED"
  | "PROMOTED"
  | "DEMOTED"
  | "RESIGNED"
  | "DESERTED"
  | "BETRAYED"
  | "DECLARED"
  | "SET_INDEPENDENT"
  | "SWITCHED"
  | "OFFER_RECEIVED"
  | "OFFER_DECLINED";

export type LeaveAffiliationMode = "RESIGN" | "DESERT" | "BETRAY";

export type FactionMissionStatus =
  | "AVAILABLE"
  | "ACTIVE"
  | "COMPLETED"
  | "FAILED"
  | "REFUSED";

export type FactionOrderStatus =
  | "ISSUED"
  | "ACCEPTED"
  | "COMPLETED"
  | "REFUSED"
  | "IGNORED";

export interface AffiliationHistoryEntry {
  id: string;
  day: number;
  factionId: CareerFactionId | null;
  organizationId?: string | null;
  membershipStatus: MembershipStatus;
  rankId?: string | null;
  event: AffiliationHistoryEvent;
  note?: string;
}

export interface FactionRecruitmentOffer {
  factionId: CareerFactionId;
  organizationId?: string | null;
  offeredRankId: string;
  source: string;
  day: number;
  expiresDay?: number;
  benefits?: string[];
  consequences?: string[];
}

/**
 * Player career membership. Separate from world faction reputation
 * (`WorldState.factions`). Having a crew does not imply piracy.
 */
export interface PlayerAffiliation {
  primaryFactionId?: CareerFactionId | null;
  /** Sub-org under a faction (e.g. Cipher Pol later). */
  organizationId?: string | null;
  membershipStatus: MembershipStatus;
  rankId?: string | null;
  joinedDay?: number | null;
  /** Loyalty to current (or last) organization, 0–100. */
  loyalty: number;
  /** Standing inside the faction for promotions — not world reputation. */
  reputationWithinFaction: number;
  history: AffiliationHistoryEntry[];
  pendingOffer?: FactionRecruitmentOffer | null;
}

export interface FactionRankDefinition {
  id: string;
  factionId: CareerFactionId;
  /** When set, rank belongs to a Civilian (or other) role ladder rather than institutional faction. */
  roleId?: CareerRoleId;
  name: string;
  /** Ascending seniority (0 = junior). */
  order: number;
  membershipStatus: MembershipStatus;
  minReputationWithin?: number;
  minFactionStanding?: number;
  benefits?: string[];
}

export interface OrganizationDefinition {
  id: string;
  name: string;
  parentFactionId: CareerFactionId;
  description: string;
  /** Reserved for Cipher Pol-style espionage later. */
  espionageEnabled?: boolean;
}

export interface FactionMission {
  id: string;
  factionId: CareerFactionId;
  title: string;
  description: string;
  status: FactionMissionStatus;
  offeredDay: number;
  moralConflict?: boolean;
  rewards?: {
    reputationWithin?: number;
    factionStanding?: number;
    berries?: number;
    xp?: number;
  };
}

export interface FactionOrder {
  id: string;
  factionId: CareerFactionId;
  title: string;
  description: string;
  status: FactionOrderStatus;
  moralConflict?: boolean;
  issuedDay: number;
}

export type StatName =
  | "strength"
  | "defense"
  | "speed"
  | "willpower"
  | "charisma"
  | "intelligence";

export type RaceCategory = "DIRECT" | "DISCOVERABLE" | "EXTREMELY_RARE";

export type RegionId = "EAST_BLUE" | "SOUTH_BLUE" | "WEST_BLUE" | "NORTH_BLUE" | "GRAND_LINE";

export type CombatSide = "PLAYER" | "ENEMY";
export type CombatActionType =
  | "ATTACK"
  | "TECHNIQUE"
  | "DEFEND"
  | "OBSERVE"
  | "ITEM"
  | "ESCAPE"
  | "SURRENDER";
export type CombatResultKind = "WIN" | "LOSE" | "ESCAPE" | "SURRENDER";

/** Authoritative output from a single attack resolution. */
export interface CombatResult {
  hit: boolean;
  dodged: boolean;
  crit: boolean;
  damage: number;
  hitBreakdown: string[];
  damageBreakdown: string[];
}

export type CrewAiMode = "MANUAL" | "BALANCED" | "AGGRESSIVE" | "DEFENSIVE" | "SUPPORT";

export type AuthorityState = "QUESTIONED" | "RESPECTED" | "TRUSTED" | "FEARED" | "LEGENDARY";

export interface PlayerAuthority {
  score: number;
  state: AuthorityState;
}

export type StandingOrderKind = "HARD" | "GUIDELINE";

export interface StandingOrder {
  id: string;
  label: string;
  description: string;
  kind: StandingOrderKind;
  active: boolean;
  effects?: {
    reputationModifier?: number;
    grievanceChance?: number;
  };
}

export interface PolicyIncident {
  id: string;
  day: number;
  orderId: string;
  characterId?: string;
  description: string;
  resolved: boolean;
}

export type RaceDiscoveryState = "UNKNOWN" | "RUMORED" | "ENCOUNTERED" | "UNDERSTOOD" | "KNOWN";

/** Per-run race knowledge — separate from profile meta unlock. */
export interface RaceKnowledge {
  raceId: string;
  discoveryState: RaceDiscoveryState;
  encounterExposure: number;
  culturalKnowledge: number;
  relationshipExposure: number;
  normalRecruitmentUnlocked: boolean;
  playableUnlockProgress: number;
}

export interface RaceDiscoveryProfile {
  raceId: string;
  encounterTierGate?: EncounterTier;
  culturalThreshold: number;
  recruitmentLockedUntilCultural?: boolean;
  storyThreadOverride?: string;
  rumorOnlyUntilTier?: EncounterTier;
}

export interface NamedFleetCharacter {
  characterId: string;
  shipName: string;
  crewCount: number;
  locationId: string;
  activity: string;
  joinDay: number;
  lastTickDay: number;
}

export interface Apprentice {
  characterId: string;
  mentorId?: string;
  role: CrewRole;
  progress: number;
  joinDay: number;
}

export interface FleetShip {
  id: string;
  name: string;
  captainId: string;
  crewCount: number;
}

export type CrewSupportTrigger =
  | "COMBAT_START"
  | "ALLY_LOW_HP"
  | "ESCAPE_ATTEMPT"
  | "TURN_START";

export interface CrewSupportAbility {
  id: string;
  role: CrewRole;
  name: string;
  description: string;
  trigger: CrewSupportTrigger;
}

export interface CombatContribution {
  combatantId: string;
  name: string;
  side: CombatSide;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  mpSpent?: number;
  xpEarned: number;
  participation: "ACTIVE" | "SUPPORT" | "CORE" | "RESERVE";
}

export interface BattleXpSnapshot {
  characterId: string;
  name: string;
  xpEarned: number;
  levelBefore: number;
  xpBefore: number;
  xpNeededBefore: number;
  levelAfter: number;
  xpAfter: number;
  xpNeededAfter: number;
  leveledUp: boolean;
  participation: CombatContribution["participation"];
}

export interface BattleResultReport {
  outcome: "WIN" | "LOSE" | "ESCAPE" | "SURRENDER";
  round: number;
  enemyNames: string[];
  threatLevel?: ThreatLevel;
  combatKind?: CombatKind;
  contributions: CombatContribution[];
  xpSnapshots: BattleXpSnapshot[];
}

export interface ActivePartyConfig {
  /** Up to 3 crew character ids in the fighting line (player always fights). */
  activeFighterIds: string[];
  /** Up to 3 crew ids providing off-field support. */
  supportSlotIds: string[];
}

export interface CombatPartyState {
  activeFighterIds: string[];
  supportSlotIds: string[];
  allyCombatants: CombatantState[];
  supportInterventionUsed: boolean;
  contributions: CombatContribution[];
  postBattleSummary?: string;
}

export type ThreatLevel = "TRIVIAL" | "EASY" | "FAIR" | "DANGEROUS" | "DEADLY";
export type CombatKind = "NORMAL" | "HIGH_RISK" | "BOSS" | "DUEL" | "STORY";
export type ItemUseContext = "OUT_OF_COMBAT" | "COMBAT" | "BOTH" | "PASSIVE" | "SPECIAL";
export type ChoiceRisk = "LOW" | "MODERATE" | "HIGH" | "DEADLY";
export type ChoiceRiskLevel = "SAFE" | "FAIR" | "RISKY" | "DANGEROUS";
export type VisualOverlay = "DARK" | "LIGHT" | "FOG" | "FIRE" | "SEA" | "SHADOW" | "TAVERN";
export type ChoiceVariant = "fight" | "parley" | "escape" | "steal" | "help" | "train" | "default";
export type TimeOfDay = "DAWN" | "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
export type TimeCostId = "BRIEF" | "SLOT" | "LONG" | "DAY";

export type InventoryCategory =
  | "ALL"
  | "WEAPONS"
  | "DEVIL_FRUITS"
  | "CONSUMABLES"
  | "MATERIALS"
  | "QUEST_ITEMS"
  | "KEY_ITEMS"
  | "MISCELLANEOUS";

export type InventoryTab = InventoryCategory;

export interface CharacterProgression {
  level: number;
  experience: number;
  availableStatPoints: number;
  techniquePoints?: number;
}

export interface PendingLevelUp {
  characterId: "player" | string;
  fromLevel: number;
  toLevel: number;
}

export interface PendingTechniqueChoice {
  characterId: "player" | string;
  techniqueIds: string[];
}

export type PendingLootDisposition =
  | { kind: "weapon"; instanceId: string; label: string }
  | { kind: "devil_fruit"; fruitId: string; label: string };

export type InventoryItemType =
  | "CONSUMABLE"
  | "MATERIAL"
  | "DEVIL_FRUIT"
  | "WEAPON"
  | "QUEST"
  | "KEY"
  | "MISC";

export type CrewStatus =
  | "Ready"
  | "Injured"
  | "Resting"
  | "Missing"
  | "Captured"
  | "Training"
  | "Temporary"
  | "Unavailable"
  | "OnMission"
  | "PersonalActivity";

export type AssignmentType =
  | "TRAINING"
  | "WEAPON_TRAINING"
  | "STYLE_TRAINING"
  | "RECOVERING"
  | "ON_MISSION"
  | "RESTING"
  | "PERSONAL_ACTIVITY"
  | "CAPTURED"
  | "MISSING"
  | "HELPING";

export interface CharacterAssignment {
  characterId: "player" | string;
  type: AssignmentType;
  label: string;
  startDay: number;
  startSlot: number;
  endDay: number;
  endSlot: number;
  locationId?: string;
  islandId?: string;
  /** Stat / weapon / style / etc. */
  focus?: string;
  berriesCost?: number;
  interruptible?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AssignmentCompletionReport {
  characterId: "player" | string;
  label: string;
  type: AssignmentType;
  summary: string;
  rewards?: string[];
}

export type EncounterCategory =
  | "COMBAT"
  | "SOCIAL"
  | "EXPLORATION"
  | "SEA"
  | "CREW"
  | "FACTION"
  | "WEIRD"
  | "TRAINING"
  | "STORY"
  | "RECOVERY";

export type EncounterTier = "EARLY" | "MID" | "LATE" | "LEGENDARY";

export type StoryThreadState =
  | "DISCOVERED"
  | "ACTIVE"
  | "ESCALATING"
  | "CLIMAX_READY"
  | "RESOLVED"
  | "FAILED"
  | "ABANDONED";

export type StoryThreadType = "MAJOR" | "MINOR";

export type CharacterMemoryType =
  | "HELPED"
  | "BETRAYED"
  | "FOUGHT"
  | "TRADED"
  | "RESCUED"
  | "INSULTED"
  | "RECRUITED"
  | "PLAYER_SAVED_ME"
  | "PLAYER_BETRAYED_ME"
  | "PLAYER_SPARED_ME"
  | "PLAYER_ATTACKED_ME"
  | "PLAYER_TRAINED_ME"
  | "PLAYER_ABANDONED_ME"
  | "PLAYER_BROKE_PROMISE"
  | "PLAYER_KEPT_PROMISE"
  | "PLAYER_PROTECTED_FAMILY"
  | "PLAYER_HUMILIATED_ME"
  | "FOUGHT_TOGETHER"
  | "LOST_BATTLE_TOGETHER"
  | "SHARED_SECRET"
  | "TRAINED_TOGETHER"
  | "WAS_RECRUITED"
  | "WAS_REJECTED"
  | "WAS_PARDONED"
  | "WAS_ARRESTED";

export type CrewMembershipType =
  | "PERMANENT"
  | "TEMPORARY"
  | "GUEST"
  | "ALLY"
  | "CONTRACTOR"
  | "PARTNER"
  | "ASSIGNED"
  | "CELL_CONTACT";

export type NarrativeArchetype =
  | "rivalry"
  | "friendship"
  | "betrayal"
  | "mentorship"
  | "investigation"
  | "mystery"
  | "political_conflict"
  | "faction_corruption"
  | "revenge"
  | "rescue"
  | "competition"
  | "romance"
  | "debt"
  | "bounty_pursuit"
  | "mistaken_identity"
  | "hidden_lineage"
  | "stolen_artifact"
  | "trainer_rivalry"
  | "ship_conflict"
  | "crew_disagreement"
  | "island_rebellion"
  | "criminal_conspiracy"
  | "recruitment"
  | "apprenticeship"
  | "faction_promotion"
  | "defection"
  | "moral_dilemma"
  | "survival"
  | "disaster"
  | "tournament"
  | "exploration"
  | "treasure_hunt"
  | "missing_person"
  | "secret_organization"
  | "assassination_attempt"
  | "hostage_situation"
  | "smuggling"
  | "undercover_mission";

export type StoryThreadStageKind =
  | "HOOK"
  | "DEVELOPMENT"
  | "COMPLICATION"
  | "ESCALATION"
  | "CLIMAX"
  | "AFTERMATH"
  | "INVESTIGATION"
  | "RESOLUTION";

export interface StoryThreadStageDefinition {
  kind: StoryThreadStageKind;
  label: string;
  encounterTags?: string[];
  encounterIds?: string[];
}

export interface SpeechProfile {
  speechStyle?: string;
  verbosity?: number;
  confidence?: number;
  humor?: number;
  formality?: number;
  aggression?: number;
  education?: number;
  emotionalOpenness?: number;
  directness?: number;
  optimism?: number;
  cynicism?: number;
  dialectFlavor?: string;
}

export interface DialogueBeat {
  speakerId: string;
  speakerName?: string;
  line: string;
  /** If set, only show when this crew member is present/available. */
  requireCrewId?: string;
  memoryGate?: CharacterMemoryType;
}

export type CrewRole =
  | "CAPTAIN"
  | "FIGHTER"
  | "SWORDSMAN"
  | "SNIPER"
  | "NAVIGATOR"
  | "COOK"
  | "DOCTOR"
  | "SHIPWRIGHT";

export type ParticipantRequirement =
  | { type: "MIN_CREW"; count: number }
  | { type: "ROLE"; role: CrewRole }
  | { type: "STAT"; stat: StatName; minimum: number }
  | { type: "RACE"; raceId: string }
  | { type: "FIGHTING_STYLE"; styleId: string }
  | { type: "AVAILABLE_CHARACTER"; characterId: string };

export type WeaponType = "SWORD" | "SPEAR" | "CLUB" | "GUN" | "KICKS" | "FISTS";

export type WeaponRarity = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";

export type MasteryRank =
  | "BEGINNER"
  | "TRAINED"
  | "SKILLED"
  | "EXPERT"
  | "MASTER"
  | "LEGENDARY";

export type TechniqueSource =
  | "WEAPON"
  | "FIGHTING_STYLE"
  | "DEVIL_FRUIT"
  | "RACE"
  | "HAKI";

export type IslandArchetype =
  | "TROPICAL"
  | "JUNGLE"
  | "DESERT"
  | "PIRATE_HAVEN"
  | "MARINE_FORTRESS"
  | "FISHING"
  | "TRADING";

export type RunWeather = "CLEAR" | "STORM" | "FOG";

export interface PlayerStats {
  strength: number;
  defense: number;
  speed: number;
  willpower: number;
  charisma: number;
  intelligence: number;
}

/** Owned weapon copy living in inventory (never destroyed on unequip). */
export interface WeaponInstance {
  id: string;
  weaponDefinitionId: string;
  ownerCharacterId?: string | null;
  equipped: boolean;
}

export interface InventoryItem {
  id: string;
  itemId?: string;
  name: string;
  type: InventoryItemType;
  description: string;
  fruitId?: string;
  quantity?: number;
  healAmount?: number;
  /** Present when this stack is a weapon instance. */
  weaponDefinitionId?: string;
  ownerCharacterId?: string | null;
  equipped?: boolean;
  category?: InventoryCategory;
}

export interface Equipment {
  /** Inventory instance id of the equipped primary weapon (legacy: definition id). */
  primaryWeaponId: string | null;
  secondaryWeaponId: string | null;
}

export interface Player {
  id: string;
  name: string;
  raceId: string;
  origin: string;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  stats: PlayerStats;
  berries: number;
  bounty: number;
  /** Dynamic reputation/career title — kept in sync from identity + affiliation + rank. */
  title: string;
  /** Career membership; world reputation lives on `WorldState.factions`. */
  affiliation?: PlayerAffiliation;
  /** Faction / Role / Legal / tendencies — separate from institutional affiliation blob. */
  identity?: PlayerIdentity;
  devilFruitId: string | null;
  haki: {
    observation: number;
    armament: number;
    conquerors: number;
  };
  inventory: InventoryItem[];
  flags: string[];
  equipment?: Equipment;
  weaponMastery?: Partial<Record<WeaponType, number>>;
  activeCombatStyle?: string | null;
  unlockedStyles?: string[];
  progression?: CharacterProgression;
  unlockedTechniques?: string[];
}

export interface DevilFruitEffect {
  type: "STAT";
  stat: StatName;
  value: number;
}

export interface DevilFruitTechnique {
  id: string;
  name: string;
  description: string;
}

export interface DevilFruit {
  id: string;
  name: string;
  type: FruitType;
  description: string;
  rarity: number;
  effects: DevilFruitEffect[];
  techniques?: DevilFruitTechnique[];
}

export interface DevilFruitWorldState {
  fruitId: string;
  status: DevilFruitStatus;
  ownerCharacterId: string | null;
  history: string[];
  transitRemaining?: number;
}

export type KnowledgeLevel = "UNKNOWN" | "RUMORED" | "KNOWN" | "CONFIRMED";

export type FactionKind =
  | "MILITARY"
  | "GOVERNMENT"
  | "CRIMINAL"
  | "REVOLUTIONARY"
  | "CIVILIAN"
  | "OTHER";

export type FactionDiscoveryState = "UNKNOWN" | "RUMORED" | "DISCOVERED" | "KNOWN";

export type FactionShiftType =
  | "LEADERSHIP_CHANGE"
  | "PROMOTION"
  | "DEATH"
  | "ALLIANCE"
  | "BETRAYAL"
  | "TERRITORY_CHANGE"
  | "IDEOLOGY_CHANGE"
  | "POWER_SHIFT"
  | "EXPANSION"
  | "DECLINE";

export type FactionStatusLabel =
  | "Collapsing"
  | "Weak"
  | "Recovering"
  | "Stable"
  | "Growing"
  | "Powerful"
  | "Dominant";

export type FactionTrendLabel =
  | "Rapidly Falling"
  | "Falling"
  | "Stable"
  | "Rising"
  | "Rapidly Rising";

export interface CharacterMemory {
  type: CharacterMemoryType;
  day: number;
  importance: number;
  note?: string;
}

export interface WorldCharacter {
  id: string;
  name: string;
  faction: NpcFaction;
  raceId?: string;
  strength: number;
  bounty: number;
  devilFruitId: string | null;
  alive: boolean;
  relationshipWithPlayer: number;
  tags: string[];
  epithet?: string;
  rankTitle?: string;
  importance?: number;
  knowledgeLevel?: KnowledgeLevel;
  relationFactionId?: RelationFactionId;
  personality?: string;
  goals?: string[];
  combatStyle?: string;
  weaponIds?: string[];
  firstMetDay?: number;
  firstMetIslandId?: string;
  memories?: CharacterMemory[];
  joinInterest?: number;
  crewRole?: CrewRole;
  recruitmentPath?: string;
  speechProfile?: SpeechProfile;
  crewStats?: PlayerStats;
  progression?: CharacterProgression;
  unlockedTechniques?: string[];
}

export interface WorldHistoryEvent {
  id: string;
  day: number;
  text: string;
  involvedFactions?: RelationFactionId[];
  importance?: number;
}

export interface FactionRelationChange {
  amount: number;
  reason: string;
  day: number;
  at: string;
}

export interface FactionRelationship {
  factionId: RelationFactionId;
  value: number;
  discovered: boolean;
  recentChanges: FactionRelationChange[];
}

export interface PowerHistoryPoint {
  day: number;
  influence: number;
}

export interface FactionLeadershipSeat {
  role: string;
  characterId: string | null;
  knowledgeLevel: KnowledgeLevel;
}

export interface HierarchyCount {
  role: string;
  filled: number;
  capacity: number;
}

export interface RegionalInfluence {
  eastBlue: number;
  northBlue: number;
  westBlue: number;
  southBlue: number;
  grandLine: number;
  newWorld: number;
}

export interface FactionToFactionRelation {
  otherFactionId: RelationFactionId;
  score: number;
}

export interface FactionShift {
  id: string;
  day: number;
  type: FactionShiftType;
  text: string;
  characterId?: string;
  knowledgeLevel?: KnowledgeLevel;
}

export interface ActiveConflict {
  id: string;
  day: number;
  title: string;
  againstFactionId?: RelationFactionId;
  region?: string;
  intensity: number;
  knowledgeLevel: KnowledgeLevel;
}

export interface FactionRumor {
  id: string;
  day: number;
  text: string;
  reliability: KnowledgeLevel;
}

export interface NotableLoss {
  id: string;
  day: number;
  characterId?: string;
  nameHint: string;
  role?: string;
  knowledgeLevel: KnowledgeLevel;
}

export interface FactionWorldEvent {
  id: string;
  day: number;
  text: string;
  importance: number;
  knowledgeLevel: KnowledgeLevel;
}

export interface FactionWorldState {
  id: RelationFactionId;
  type: FactionKind;
  influence: number;
  discoveryState: FactionDiscoveryState;
  powerHistory: PowerHistoryPoint[];
  leadership: FactionLeadershipSeat[];
  majorFigures: string[];
  hierarchyCounts?: HierarchyCount[];
  regionalInfluence: RegionalInfluence;
  relationships: FactionToFactionRelation[];
  shifts: FactionShift[];
  conflicts: ActiveConflict[];
  rumors: FactionRumor[];
  notableLosses: NotableLoss[];
  events: FactionWorldEvent[];
  lastUpdatedDay: number;
  stability?: number;
  morale?: number;
}

export interface WorldPowerState {
  worldGovernmentPower: number;
  oppression: number;
  revolutionaryActivity: number;
}

export interface WorldState {
  day: number;
  devilFruits: DevilFruitWorldState[];
  characters: WorldCharacter[];
  history: WorldHistoryEvent[];
  flags: string[];
  factions: FactionRelationship[];
  factionWorld: FactionWorldState[];
  worldPower: WorldPowerState;
  lastDevilFruitDiscoveryDay: number | null;
}

export interface StatusEffect {
  id: string;
  name: string;
  remainingTurns: number;
  kind?: "BUFF" | "DEBUFF";
  /** Flat hit-chance bonus in percentage points. */
  accuracyBonus?: number;
  /** Flat dodge bonus in percentage points. */
  dodgeBonus?: number;
  /** Additive damage dealt modifier (0.25 = +25%). */
  damageDealtMod?: number;
  /** Additive damage taken modifier (0.2 = +20% taken). */
  damageTakenMod?: number;
}

export type AbilityTag =
  | "MELEE"
  | "RANGED"
  | "AOE"
  | "SINGLE"
  | "BUFF"
  | "DEBUFF"
  | "DEFENSIVE"
  | "ALLY"
  | "MULTI_HIT"
  | "RANDOM"
  | "HEAL";

export type CombatAnimationType =
  | "MELEE_SLASH"
  | "MELEE_HEAVY"
  | "THRUST"
  | "PROJECTILE"
  | "AOE"
  | "HEAL"
  | "BUFF"
  | "DEBUFF"
  | "DEFEND"
  | "DODGE"
  | "IMPACT"
  | "OBSERVE"
  | "DEFEAT";

export type CombatFormation = "FRONT" | "BACK";

/** Who a targeting rule draws from. */
export type TargetGroup = "ENEMY" | "ALLY" | "SELF" | "OTHER_ALLY";

/** How targets are chosen among the filtered pool. */
export type TargetSelectionMode = "MANUAL" | "RANDOM" | "ALL" | "AUTO" | "SELF";

export type TargetFormationFilter = "ANY" | "FRONT" | "BACK";

export type TargetCondition =
  | { type: "LIVING" }
  | { type: "INJURED" }
  | { type: "KO" }
  | { type: "LOWEST_HP" }
  | { type: "HIGHEST_HP" }
  | { type: "HIGHEST_MAX_HP" }
  | { type: "MOST_INJURED" }
  | { type: "HIGHEST_STAT"; stat: StatName }
  | { type: "LOWEST_STAT"; stat: StatName };

/**
 * Data-driven targeting for attacks, heals, buffs, debuffs, and utility.
 * Prefer this over relying on AbilityTag alone.
 */
export interface TargetingSpec {
  group: TargetGroup;
  selection: TargetSelectionMode;
  /** Exactly N targets (manual/random unique). Distinct from maxCount "up to". */
  exactCount?: number;
  minCount?: number;
  maxCount?: number;
  allowRepeatedTargets?: boolean;
  /** Independent hit rolls (multi-hit). Distinct from target count. */
  hitCount?: number;
  /** Each hit re-rolls its target (typically with allowRepeatedTargets). */
  retargetEachHit?: boolean;
  formation?: TargetFormationFilter;
  /** When group is ALLY, whether the actor may be included. Default true. */
  includeSelf?: boolean;
  conditions?: TargetCondition[];
  /** Extra chain jumps after the primary target. */
  chainJumps?: number;
  /** Damage multipliers per chain hop including the first (default 1, 0.75, 0.5…). */
  chainDamageMult?: number[];
  /** Splash damage fraction applied to adjacent slot enemies of the primary. */
  adjacentSplash?: number;
  /** When not enough valid targets exist for exactCount. Default REDUCE for random/all, DISABLE for manual exact. */
  whenInsufficient?: "DISABLE" | "REDUCE";
}

export type TechniqueEffectKind = "DAMAGE" | "HEAL" | "BUFF" | "DEBUFF" | "UTILITY";

/**
 * Grouped skill badges — compact category icons.
 * Exact counts/behavior live in tooltips, not separate badge types.
 */
export type SkillBadgeId =
  | "SINGLE_TARGET"
  | "MULTI_TARGET"
  | "ALL_TARGETS"
  | "RANDOM_TARGET"
  | "CHAIN"
  | "SPLASH"
  | "SELF"
  | "ROW_TARGET"
  | "MULTI_HIT"
  | "HEAL"
  | "CLEANSE"
  | "MP_RESTORE"
  | "GUARD"
  | "COUNTER"
  | "FOCUS"
  | "CONTROL_BREAK"
  | "AFFLICTION"
  | "VULNERABILITY";

/** Explicit or derived badge attachment for a skill. */
export interface SkillBadgeRef {
  id: SkillBadgeId;
  /** Optional numeric overlay (x2, x6) — not a separate badge concept. */
  count?: number;
  /** Overrides the default category tooltip with skill-specific detail. */
  tip?: string;
}

/** One effect on a technique — each may use different targeting. */
export interface TechniqueEffect {
  id: string;
  kind: TechniqueEffectKind;
  targeting: TargetingSpec;
  /** Multiplier on technique power + scaling (1 = 100%). */
  damageMult?: number;
  healAmount?: number;
  /** Fraction of target max HP healed. */
  healMaxHpFraction?: number;
  applyEffect?: AbilityEffectSpec;
  /** Chance to apply applyEffect / statusEffect per resolved hit (0–1). */
  statusChance?: number;
  statusEffect?: AbilityEffectSpec;
}

export interface AbilityEffectSpec {
  id: string;
  name: string;
  kind: "BUFF" | "DEBUFF";
  turns: number;
  target: "SELF" | "TARGET" | "ALL_ENEMIES" | "ALL_ALLIES";
  accuracyBonus?: number;
  dodgeBonus?: number;
  damageDealtMod?: number;
  damageTakenMod?: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  /** Legacy damage contribution; prefer powerLevel when present. */
  power: number;
  /** Skill tier used for hit chance vs character level. */
  powerLevel?: number;
  scalingStat: StatName;
  /** Small accuracy bias in percentage points (on top of level formula). */
  accuracyMod: number;
  mpCost?: number;
  tags?: AbilityTag[];
  animationType?: CombatAnimationType;
  cooldown?: number;
  effects?: string[];
  applyEffect?: AbilityEffectSpec;
  /** Primary targeting (legacy single-effect techniques). */
  targeting?: TargetingSpec;
  /** Multi-effect techniques; if empty, derived from targeting/tags/applyEffect. */
  techniqueEffects?: TechniqueEffect[];
  /**
   * Optional explicit skill badges. When omitted, badges are derived from
   * targeting / effects / tags. Prefer explicit tips for unusual skills.
   */
  badges?: SkillBadgeRef[];
}

export interface CombatLogEntry {
  id: string;
  round: number;
  text: string;
  detail?: string;
}

export interface CombatHit {
  id: string;
  combatantId: string;
  side: CombatSide;
  amount: number;
  kind: "HIT" | "MISS" | "HEAL";
}

export interface CombatantState {
  id: string;
  name: string;
  side: CombatSide;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  stats: PlayerStats;
  defending: boolean;
  observed: boolean;
  revealed: boolean;
  nextActionHint: string | null;
  intendedAction: "ATTACK" | "HEAVY" | "DEFEND";
  weakPointDiscovered: boolean;
  accuracyBonus: number;
  dodgeBonus: number;
  statusEffects: StatusEffect[];
  abilities: Ability[];
  /** Character level for technique accuracy scaling. */
  level?: number;
  initiativeScore?: number;
  initiativeVariance?: number;
  formation?: CombatFormation;
}

export interface PendingCombatOutcome {
  win: EncounterOutcome;
  lose: EncounterOutcome;
  escape?: EncounterOutcome;
  surrender?: EncounterOutcome;
}

export interface CombatState {
  round: number;
  playerCombatant: CombatantState;
  enemies: CombatantState[];
  activeSide: CombatSide;
  /** Who is currently taking a player-controlled turn (captain or crewmate). */
  activeCombatantId: string | null;
  /** Initiative order for the current round cycle. */
  turnOrder: string[];
  turnIndex: number;
  log: CombatLogEntry[];
  lastHits: CombatHit[];
  finished: boolean;
  result: CombatResultKind | null;
  canEscape: boolean;
  canSurrender: boolean;
  escapeAttempts: number;
  guaranteedEscape: boolean;
  threatLevel: ThreatLevel;
  combatKind: CombatKind;
  unescapableReason: string | null;
  pendingOutcome: PendingCombatOutcome | null;
  party?: CombatPartyState;
  /** Last resolved attack breakdown for dev / log expansion. */
  lastCombatResult?: CombatResult;
}

export interface CombatRequest {
  enemyName: string;
  enemyStrength: number;
  enemyHp?: number;
  canEscape?: boolean;
  canSurrender?: boolean;
  combatKind?: CombatKind;
  unescapableReason?: string;
  /** Total living enemies to spawn (1–4). Boss/duel default to 1. */
  enemyCount?: number;
  extraEnemies?: Array<{
    name: string;
    strength: number;
    hp?: number;
    formation?: CombatFormation;
  }>;
  win: EncounterOutcome;
  lose: EncounterOutcome;
  escape?: EncounterOutcome;
  surrender?: EncounterOutcome;
}

export interface EncounterHistory {
  encounterType: string;
  templateId: string;
  characterIds: string[];
  islandId: string;
  storyThreadId: string | null;
  day: number;
  result: string;
  archetypes?: NarrativeArchetype[];
  themes?: string[];
}

export interface StoryThreadHistoryEntry {
  day: number;
  stage: number;
  text: string;
}

export interface StoryThread {
  id: string;
  type: StoryThreadType;
  templateId: string;
  title: string;
  state: StoryThreadState;
  stage: number;
  maxStage?: number;
  stageKind?: StoryThreadStageKind;
  startedDay: number;
  lastUpdatedDay: number;
  involvedCharacterIds: string[];
  involvedFactionIds: RelationFactionId[];
  involvedIslandIds: string[];
  tags: string[];
  archetypes?: NarrativeArchetype[];
  mergedFromThreadIds?: string[];
  history: StoryThreadHistoryEntry[];
  cooldownUntilDay?: number;
  metadata?: Record<string, unknown>;
}

export interface CrewMember {
  characterId: string;
  role: CrewRole;
  membership: CrewMembershipType;
  joinDay: number;
  status?: CrewStatus;
  personalGoal?: string;
  progression?: CharacterProgression;
  aiMode?: CrewAiMode;
  factionPreferences?: CareerFactionId[];
  grievances?: string[];
  inActiveParty?: boolean;
  inSupportSlot?: boolean;
  /** Blocking activity — source of truth for availability. */
  currentAssignment?: CharacterAssignment | null;
}

export interface Weapon {
  id: string;
  name: string;
  weaponType: WeaponType;
  rarity: WeaponRarity;
  damage: number;
  speed: number;
  traits: string[];
  techniqueIds: string[];
}

export interface Technique {
  id: string;
  name: string;
  description: string;
  source: TechniqueSource;
  power: number;
  /** Skill tier — compared to character level for accuracy. */
  powerLevel?: number;
  scalingStat: StatName;
  accuracyMod: number;
  weaponType?: WeaponType;
  styleId?: string;
  tags?: AbilityTag[];
  applyEffect?: AbilityEffectSpec;
  targeting?: TargetingSpec;
  techniqueEffects?: TechniqueEffect[];
  mpCost?: number;
  /** Flavor / keyword strings used for badge derivation (cleanse, bleed, etc.). */
  effects?: string[];
  /** Optional explicit badges; otherwise derived at display time. */
  badges?: SkillBadgeRef[];
}

export interface FightingStyle {
  id: string;
  name: string;
  description: string;
  requirements: EncounterCondition[];
  techniqueIds: string[];
}

export interface Island {
  id: string;
  name: string;
  region: RegionId;
  biome: string;
  climate: string;
  settlementType: string;
  dominantFactionId?: RelationFactionId;
  dangerLevel: number;
  cultureTags: string[];
  uniqueTraits: string[];
  archetype: IslandArchetype;
  introductionShown?: boolean;
  /** Shop encounter ids discovered on this island (food stall, clinic, etc.). */
  knownShops?: string[];
}

export interface BackgroundContext {
  biome?: string;
  islandType?: IslandArchetype;
  weather?: RunWeather;
  timeOfDay?: TimeOfDay;
  encounterType?: EncounterCategory;
  dangerLevel?: number;
}

export interface WorldProgressionFlags {
  first_bounty?: boolean;
  first_crew?: boolean;
  first_rival?: boolean;
  [key: string]: boolean | undefined;
}

export type EncounterCondition =
  | { type: "PLAYER_FLAG"; flag: string; negate?: boolean }
  | { type: "WORLD_FLAG"; flag: string; negate?: boolean }
  | { type: "MIN_BERRIES"; value: number }
  | { type: "MAX_BERRIES"; value: number }
  | { type: "MIN_BOUNTY"; value: number }
  | { type: "MIN_HP"; value: number }
  | { type: "HAS_EATEN_FRUIT"; negate?: boolean }
  | { type: "PLAYER_FRUIT"; fruitId: string }
  | { type: "FRUIT_STATUS"; fruitId: string; status: DevilFruitStatus }
  | { type: "ANY_UNCLAIMED_FRUIT" }
  | { type: "NPC_TAGS"; tags: string[]; alive?: boolean; negate?: boolean }
  | { type: "PLAYER_RACE"; raceId: string; negate?: boolean }
  | { type: "REGION"; regionId: RegionId }
  | { type: "LOCATION"; locationId: string }
  | { type: "ANY_LOCATION"; locationIds: string[] }
  | { type: "FACTION_MIN"; factionId: RelationFactionId; value: number }
  | { type: "FACTION_MAX"; factionId: RelationFactionId; value: number }
  | { type: "FACTION_DISCOVERED"; factionId: RelationFactionId; negate?: boolean }
  | { type: "PLAYER_AFFILIATION"; factionId: CareerFactionId; negate?: boolean }
  | { type: "PLAYER_ROLE"; roleId: CareerRoleId; negate?: boolean }
  | { type: "PLAYER_LEGAL_STATUS"; statusId: LegalStatusId; negate?: boolean }
  | {
      type: "MEMBERSHIP_STATUS";
      statuses: MembershipStatus[];
      negate?: boolean;
    }
  | { type: "MIN_RANK_ORDER"; factionId: CareerFactionId; order: number }
  | { type: "WORLD_POWER_MIN"; field: keyof WorldPowerState; value: number }
  | { type: "RUN_FLAG"; flag: string; negate?: boolean }
  | { type: "STORY_THREAD"; templateId: string; minStage?: number; state?: StoryThreadState }
  | { type: "WORLD_PROGRESSION"; flag: string; negate?: boolean }
  | { type: "ENCOUNTER_TIER"; tier: EncounterTier; negate?: boolean }
  | { type: "MIN_MASTERY"; weaponType: WeaponType; value: number }
  | { type: "HAS_STYLE"; styleId: string; negate?: boolean }
  | { type: "CREW_MIN"; value: number }
  | { type: "CREW_AVAILABLE_MIN"; value: number }
  | { type: "CREW_ROLE"; role: CrewRole; minCount?: number }
  | { type: "CREW_RACE"; raceId: string; minCount?: number }
  | { type: "STAT_MIN"; stat: StatName; value: number; target?: "player" | "any_crew" }
  | { type: "TECHNIQUE"; techniqueId: string; target?: "player" }
  | { type: "HAS_ITEM"; itemId: string; quantity?: number }
  | { type: "RUN_KNOWLEDGE"; subjectId: string; minStage?: KnowledgeStage; negate?: boolean };

export interface SkillCheckRequest {
  stat: StatName;
  difficulty: number;
  success: EncounterOutcome;
  failure: EncounterOutcome;
}

export interface WeightedOutcome {
  weight: number;
  outcome: EncounterOutcome;
}

export type DevilFruitActionType = "EAT" | "KEEP" | "SELL" | "LEAVE";

export interface DevilFruitAction {
  action: DevilFruitActionType;
  fruitId: string;
}

export interface CreateNpcRequest extends WorldCharacter {}

export interface FactionChangeSpec {
  factionId: RelationFactionId;
  amount: number;
  reason: string;
}

export interface RaceDiscoverySpec {
  raceId: string;
  sourceId: string;
  amount?: number;
}

export interface WorldPowerChangeSpec {
  worldGovernmentPower?: number;
  oppression?: number;
  revolutionaryActivity?: number;
}

export interface EncounterOutcome {
  text: string;
  hpChange?: number;
  berriesChange?: number;
  bountyChange?: number;
  statChanges?: Partial<PlayerStats>;
  addPlayerFlags?: string[];
  removePlayerFlags?: string[];
  addWorldFlags?: string[];
  addRunFlags?: string[];
  addInventory?: InventoryItem[];
  grantItemIds?: string[];
  removeInventoryIds?: string[];
  worldNews?: string;
  combat?: CombatRequest;
  deathCause?: string;
  discoverTechniques?: Array<{ fruitId: string; techniqueId: string }>;
  discoverLore?: Array<{ kind: "race" | "fruit" | "item"; id: string; entryId: string }>;
  skillCheck?: SkillCheckRequest;
  randomTable?: WeightedOutcome[];
  devilFruit?: DevilFruitAction;
  createNpc?: CreateNpcRequest;
  factionChanges?: FactionChangeSpec[];
  raceDiscoveries?: RaceDiscoverySpec[];
  worldPowerChanges?: WorldPowerChangeSpec;
  unlockLocation?: string;
  addMilestones?: string[];
  moveToLocation?: string;
  trainStat?: StatName;
  /** Begin a blocking character assignment (long training, mission, etc.). */
  startAssignment?: {
    type: AssignmentType;
    label: string;
    durationSlots: number;
    focus?: string;
    berriesCost?: number;
    characterId?: string;
    interruptible?: boolean;
  };
  startStoryThread?: string;
  advanceStoryThread?: string;
  resolveStoryThread?: string;
  failStoryThread?: string;
  modifyJoinInterest?: { characterId?: string; amount: number };
  offerRecruitment?: { characterId?: string; path?: string };
  acceptRecruitment?: {
    characterId?: string;
    role?: CrewRole;
    membership?: CrewMembershipType;
  };
  grantWeaponId?: string;
  unlockFightingStyle?: string;
  /** Remember a shop location on the current island (e.g. food_stall, clinic_shop). */
  discoverShop?: string;
  /** After Continue, force this encounter instead of a random pick (submenu / chain). */
  goToEncounter?: string;
  addCharacterMemory?: {
    characterId?: string;
    type: CharacterMemoryType;
    importance?: number;
    note?: string;
  };
  recordFirstMeeting?: { characterId?: string };
  bumpCharacterImportance?: { characterId?: string; amount: number };
  setWorldProgressionFlag?: string;
  showIslandIntroduction?: string;
  grantExperience?: number;
  /** Grant a knowledge collectable into current-run knowledge (+ meta collection if profile present). */
  grantKnowledgeCollectable?: string;
  addInformation?: string;
  addNoise?: boolean;
  /** Join or switch primary career affiliation. */
  joinFaction?: {
    factionId: CareerFactionId;
    rankId?: string;
    organizationId?: string | null;
    asProspect?: boolean;
    note?: string;
  };
  setRole?: {
    roleId: CareerRoleId;
    rankId?: string;
    note?: string;
  };
  setLegalStatus?: {
    statusId: LegalStatusId;
    note?: string;
  };
  tendencyChanges?: Partial<IdentityTendencies>;
  leaveFaction?: {
    mode: LeaveAffiliationMode;
    note?: string;
  };
  setIndependent?: { note?: string };
  promoteRank?: boolean;
  demoteRank?: boolean;
  adjustLoyalty?: number;
  adjustInternalReputation?: number;
  offerFactionRecruitment?: {
    factionId: CareerFactionId;
    rankId?: string;
    organizationId?: string | null;
    source?: string;
    benefits?: string[];
    consequences?: string[];
  };
  issueFactionOrder?: {
    title: string;
    description: string;
    factionId?: CareerFactionId;
    moralConflict?: boolean;
  };
  completeFactionOrder?: { orderId?: string; success?: boolean };
  generateFactionMission?: {
    title: string;
    description: string;
    factionId?: CareerFactionId;
    moralConflict?: boolean;
  };
}

export interface EncounterVisual {
  background?: string;
  overlay?: VisualOverlay;
  focusPosition?: string;
  variant?: ChoiceVariant;
}

export interface ChoiceVisual {
  icon?: string;
  background?: string;
  backgroundImage?: string;
  backgroundVariant?: string;
  overlay?: VisualOverlay;
  variant?: ChoiceVariant;
  accent?: string;
}

export interface ChoicePresentation {
  primaryLabel?: string;
  riskLevel?: ChoiceRiskLevel;
}

export interface EncounterChoice {
  id: string;
  text: string;
  flavour?: string;
  checkStat?: StatName;
  risk?: ChoiceRisk;
  costLabel?: string;
  timeCost?: TimeCostId | number;
  advantage?: boolean;
  visual?: ChoiceVisual;
  presentation?: ChoicePresentation;
  conditions?: EncounterCondition[];
  /** Player must pick who performs this action. */
  requiresParticipant?: boolean;
  participantRequirements?: ParticipantRequirement[];
  /** For group activities (default 1 when requiresParticipant). */
  maxParticipants?: number;
  minParticipants?: number;
  outcome: EncounterOutcome;
}

export interface Encounter {
  id: string;
  title: string;
  description: string;
  category?: EncounterCategory | string;
  tier?: EncounterTier;
  visual?: EncounterVisual;
  weight: number;
  timeCost?: TimeCostId | number;
  conditions?: EncounterCondition[];
  choices: EncounterChoice[];
  bindFruit?: "UNCLAIMED" | string;
  bindNpcTags?: string[];
  bindCharacterId?: string;
  regions?: RegionId[];
  fruitEncounter?: boolean;
  relevantRaces?: string[];
  storyThreadTemplateId?: string;
  narrativeArchetypes?: NarrativeArchetype[];
  narrativeThemes?: string[];
  dialogueBeats?: DialogueBeat[];
}

export interface RacialTrait {
  id: string;
  name: string;
  description: string;
}

export interface RacialTransformation {
  id: string;
  name: string;
  description: string;
}

export interface LoreEntryDefinition {
  id: string;
  minLevel: number;
  title: string;
  body: string;
}

export interface RaceDefinition {
  id: string;
  name: string;
  category: RaceCategory;
  description: string;
  worldEncounterWeight: number;
  selectionWeight: number;
  hardPityAfterMisses: number;
  requiredDiscoveryProgress: number | null;
  defaultPlayable: boolean;
  defaultKnown: boolean;
  traits: RacialTrait[];
  abilities: string[];
  transformations: RacialTransformation[];
  statMods: Partial<PlayerStats>;
  lore?: LoreEntryDefinition[];
}

export interface RaceOfferPity {
  raceId: string;
  missedOffers: number;
  pityBonus: number;
}

export interface RaceProgress {
  raceId: string;
  known: boolean;
  playable: boolean;
  discoveryProgress: number;
  requiredDiscoveryProgress: number | null;
  discoverySources: string[];
  firstDiscoveredRunId?: string;
  knowledgeLevel: number;
  unlockedEntries: string[];
}

export interface LocationDefinition {
  id: string;
  name: string;
  regionId: RegionId;
  description: string;
  startingUnlocked: boolean;
}

export interface OriginDefinition {
  id: string;
  name: string;
  description: string;
  raceIds: string[];
  stats: PlayerStats;
  berries: number;
}

export interface CollectionKnowledge {
  id: string;
  discovered: boolean;
  knowledgeLevel: number;
  unlockedEntries: string[];
  discoveredTechniques: string[];
  discoveredAt?: string;
}

/** @deprecated Use CollectionKnowledge. Kept as an alias for older call sites. */
export type CollectionEntry = CollectionKnowledge;

export interface ProfileCollection {
  devilFruits: CollectionKnowledge[];
  items: CollectionKnowledge[];
  /** World-knowledge collectables (books, maps, dossiers, etc.). */
  knowledge?: CollectionKnowledge[];
}

export type KnowledgeCategory =
  | "WORLD"
  | "ISLANDS"
  | "RACES"
  | "FACTIONS"
  | "CHARACTERS"
  | "DEVIL_FRUITS"
  | "WEAPONS"
  | "HISTORY"
  | "COMBAT"
  | "NAVIGATION"
  | "MYSTERIES";

export type KnowledgeStage =
  | "UNKNOWN"
  | "RUMORED"
  | "LIMITED"
  | "FAMILIAR"
  | "WELL_KNOWN"
  | "EXPERT";

/** Current-run actionable knowledge (separate from meta collection). */
export interface RunKnowledgeEntry {
  subjectId: string;
  category: KnowledgeCategory;
  stage: KnowledgeStage;
  label: string;
  sourceCollectableIds?: string[];
  note?: string;
}

export interface ProfileStatistics {
  runsStarted: number;
  deaths: number;
  daysSurvivedTotal: number;
  fruitsDiscovered: number;
  highestBounty: number;
  encountersCompleted: number;
  longestRunDays: number;
  combatWins: number;
  combatLosses: number;
  fruitsEaten: number;
}

export interface ProfileProgression {
  races: RaceProgress[];
  unlockedStartingLocations: string[];
  milestones: string[];
}

export interface AchievementProgress {
  id: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export type AchievementCondition =
  | { type: "MILESTONE"; id: string }
  | { type: "STAT_MIN"; stat: keyof ProfileStatistics; value: number }
  | { type: "RACE_KNOWN"; raceId: string }
  | { type: "RACE_PLAYABLE"; raceId: string }
  | { type: "LOCATION_UNLOCKED"; locationId: string }
  | { type: "FRUITS_EATEN"; value: number }
  | { type: "RACE_AND_MILESTONE"; raceId: string; milestone: string };

export type AchievementReward =
  | { type: "UNLOCK_RACE"; raceId: string }
  | { type: "UNLOCK_LOCATION"; locationId: string }
  | { type: "DISCOVER_FRUIT"; fruitId: string };

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  hidden?: boolean;
  hiddenUntilUnlocked?: boolean;
  conditions: AchievementCondition[];
  rewards?: AchievementReward[];
}

export type ItemEffect =
  | { type: "HEAL"; amount: number; percentMaxHp?: number }
  | { type: "RESTORE_MP"; amount: number; percentMaxMp?: number }
  | { type: "GUARANTEE_ESCAPE" }
  | { type: "NONE" };

export interface ItemDefinition {
  id: string;
  name: string;
  type: InventoryItem["type"];
  description: string;
  consumable: boolean;
  useContext: ItemUseContext;
  freeAction?: boolean;
  effects: ItemEffect[];
  lore?: LoreEntryDefinition[];
  category?: InventoryCategory;
  /** Weapon types this item can be equipped as (crew assignment checks). */
  weaponType?: WeaponType;
}

export interface RunState {
  id: string;
  seed: string;
  createdAt: string;
  updatedAt: string;
  player: Player;
  world: WorldState;
  day: number;
  timeOfDay: TimeOfDay;
  pendingTimeCost: number;
  trainingToday: Partial<Record<StatName, number>>;
  /** Per-character training counts today (player id = "player"). */
  characterTrainingToday?: Record<string, Partial<Record<StatName, number>>>;
  /** Selected actor for the next participant-gated choice. */
  pendingParticipantId?: string | null;
  /** Multi-select participants for group activities. */
  pendingParticipantIds?: string[];
  /** Completed assignment reports waiting to be shown. */
  pendingAssignmentResults?: AssignmentCompletionReport[];
  /** Active character schedules (source of truth for availability). */
  characterAssignments?: CharacterAssignment[];
  currentLocationId: string;
  currentEncounterId: string | null;
  encounterCount: number;
  runFlags: string[];
  gameOver: boolean;
  currentBoundFruitId: string | null;
  currentBoundNpcId: string | null;
  lastResultText: string | null;
  lastFeedback: string | null;
  lastHpChange: number | null;
  awaitingAdvance: boolean;
  combat: CombatState | null;
  deathCause?: string;
  encounterHistory: EncounterHistory[];
  storyThreads: StoryThread[];
  crew: CrewMember[];
  islands: Island[];
  usedIslandNames: string[];
  worldProgressionFlags: WorldProgressionFlags;
  currentWeather?: RunWeather;
  currentIslandId?: string | null;
  lastEncounterCategory?: EncounterCategory | string | null;
  pendingLevelUps?: PendingLevelUp[];
  pendingTechniqueChoice?: PendingTechniqueChoice | null;
  /** Set by outcome.goToEncounter; consumed on completeEncounter. */
  pendingEncounterId?: string | null;
  pendingLootDispositions?: PendingLootDisposition[];
  factionMissions?: FactionMission[];
  factionOrders?: FactionOrder[];
  activeParty?: ActivePartyConfig;
  /** Post-combat report shown before encounter narrative (victory XP + stats). */
  pendingBattleResult?: BattleResultReport | null;
  apprentices?: Apprentice[];
  fleet?: NamedFleetCharacter[];
  authority?: PlayerAuthority;
  standingOrders?: StandingOrder[];
  policyIncidents?: PolicyIncident[];
  raceKnowledge?: RaceKnowledge[];
  /** Actionable knowledge discovered this run (maps, journals, etc.). */
  runKnowledge?: RunKnowledgeEntry[];
}

export interface ProfileSave {
  version: number;
  id: string;
  profileType: ProfileType;
  createdAt: string;
  updatedAt: string;
  progression: ProfileProgression;
  statistics: ProfileStatistics;
  collection: ProfileCollection;
  achievements: AchievementProgress[];
  raceOfferPity: RaceOfferPity[];
  activeRun: RunState | null;
}

export interface ResolveResult {
  profile: ProfileSave;
  text: string;
  gameOver: boolean;
}

export interface SavePreview {
  slot: ProfileSlot;
  empty: boolean;
  profileType: ProfileType;
  hasActiveRun: boolean;
  name?: string;
  day?: number;
  bounty?: number;
  raceName?: string;
  runsStarted?: number;
  updatedAt?: string;
}

export interface CombatAction {
  type: CombatActionType;
  abilityId?: string;
  itemId?: string;
  targetId?: string;
  /** Manual multi-target selection (ordered). */
  targetIds?: string[];
}

/** @deprecated Old v1 save shape used only for migration. */
export interface LegacyGameState {
  version: number;
  saveId: string;
  saveType: SaveType;
  createdAt: string;
  updatedAt: string;
  seed: string;
  player: Omit<Player, "raceId"> & { raceId?: string; origin: string };
  world: Omit<WorldState, "factions" | "factionWorld" | "worldPower" | "lastDevilFruitDiscoveryDay"> & {
    factions?: FactionRelationship[];
    factionWorld?: FactionWorldState[];
    worldPower?: WorldPowerState;
    lastDevilFruitDiscoveryDay?: number | null;
  };
  currentEncounterId: string | null;
  encounterCount: number;
  gameOver: boolean;
  currentBoundFruitId: string | null;
  currentBoundNpcId: string | null;
  lastResultText: string | null;
  awaitingAdvance: boolean;
}
