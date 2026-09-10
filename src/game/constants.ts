export const SAVE_VERSION = 12;

/** Core roster cap including the player character. */
export const CORE_CREW_CAP = 10;
export const MAX_ACTIVE_FIGHTERS = 3;
export const MAX_SUPPORT_SLOTS = 3;

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
