export const SAVE_VERSION = 36;

/** Primary shore navigation encounter (Island State hub). */
export const ISLAND_HUB_ENCOUNTER_ID = "island_hub";
/** At-sea travel screen while a voyage is in progress. */
export const AT_SEA_ENCOUNTER_ID = "at_sea";

/** Default player ship speed in distance-units per time slot. */
export const DEFAULT_SHIP_SPEED = 1;
/** Default hold capacity in item-quantity units. */
export const DEFAULT_SHIP_CARGO_CAPACITY = 40;
/** Default hull art key (`/icons/Ships/Ship1.png`). */
export const DEFAULT_SHIP_HULL_ID = "Ship1";
/** Baseline voyage distance between East Blue islands (abstract units). */
export const DEFAULT_VOYAGE_DISTANCE = 3;
/** Chance per sailing time slot to pause for a sea event. */
export const SEA_EVENT_CHANCE_PER_SLOT = 0.28;
/** Auto-tick interval (ms) while sailing with no event pending. */
export const VOYAGE_AUTO_TICK_MS = 900;

/** Core roster cap including the player character. */
export const CORE_CREW_CAP = 10;
/** Max fighters in the active battle row (includes captain when present). */
export const BATTLE_ROW_SLOTS = 5;
/** Max crew IDs derived into activeFighterIds (battle row minus optional captain). */
export const MAX_ACTIVE_FIGHTERS = 4;
export const MAX_SUPPORT_SLOTS = 3;

/**
 * Minimum player bounty required before overflow recruits can join the fleet.
 * Below this, a full core crew simply cannot take more joiners.
 */
export const FLEET_UNLOCK_BOUNTY = 50_000;

/** XP required to reach `level` from previous level: BASE_XP * level^XP_EXPONENT */
export const XP_BASE = 50;
export const XP_EXPONENT = 1.45;

export const XP_REWARDS = {
  COMBAT_WIN: 35,
  COMBAT_BOSS: 80,
  TRAINING: 20,
  STORY_RESOLVE: 45,
  ENCOUNTER: 15,
} as const;

/** Levels that offer a technique choice. */
export const TECHNIQUE_MILESTONE_LEVELS = [3, 5, 8, 12, 16] as const;

/**
 * Cumulative mastery XP thresholds → mastery level index.
 * Level 0 at 0 XP; level 1 at 1 use; 3/5/8/12 match technique-milestone spirit.
 */
export const MASTERY_LEVEL_XP_THRESHOLDS = [0, 1, 3, 5, 8, 12, 16, 22, 30, 40, 55, 75, 100] as const;

/** Solo weapon/unarmed techniques unlock at these mastery levels. */
export const MASTERY_SOLO_UNLOCK_LEVELS = [1, 3, 5, 8, 12] as const;

/** Both tracks must reach this mastery level for hybrid combo unlocks. */
export const MASTERY_COMBO_LEVEL = 5;

/** XP granted per successful combat use of a mastery track. */
export const MASTERY_XP_PER_USE = 1;

export const TIME_OF_DAY_ORDER = ["DAWN", "MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;

export const TIME_COST = {
  BRIEF: 0,
  SLOT: 1,
  LONG: 2,
  DAY: 4,
} as const;

export const MAX_TRAINING_ACTIONS_PER_DAY = 2;
export const MAX_TRAINING_PER_STAT_PER_DAY = 1;

export const RACE_OFFER_COUNT = 4;

export const EARLY_RUN_ENCOUNTER_LIMIT = 5;
export const EARLY_RUN_STRICT_LIMIT = 3;

export const ESCAPE_PITY_PER_ATTEMPT = 0.15;
export const ESCAPE_CHANCE_MIN = 0.15;
export const ESCAPE_CHANCE_MAX = 0.95;

export const SURRENDER_BERRY_LOSS_RATIO = 0.4;
export const SURRENDER_HP_LOSS = 8;

export const MAX_MAJOR_THREADS = 3;
export const MAX_MINOR_THREADS = 5;
export const STORY_THREAD_COOLDOWN_DAYS = 12;

export const ENCOUNTER_HISTORY_PENALTY = {
  YESTERDAY: 0.1,
  DAYS_5: 0.4,
  DAYS_15: 0.85,
  DAYS_30: 1.0,
} as const;

export const CATEGORY_STREAK_PENALTY = 0.15;
export const MAX_CATEGORY_STREAK = 5;

export const MASTERY_THRESHOLDS: Record<string, number> = {
  BEGINNER: 0,
  TRAINED: 5,
  SKILLED: 15,
  EXPERT: 30,
  MASTER: 50,
  LEGENDARY: 80,
};

export const MASTERY_RANK_ORDER = [
  "BEGINNER",
  "TRAINED",
  "SKILLED",
  "EXPERT",
  "MASTER",
  "LEGENDARY",
] as const;
