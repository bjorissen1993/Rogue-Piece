import type {
  BattleFormat,
  BattleFormatId,
  CombatKind,
  EnemyFamily,
  EnemyRole,
} from "../models/types";
import type { ExtraEnemySpec } from "./WorldCombatProgressionService";
import type { RandomService } from "./RandomService";

export type EncounterTemplateId =
  | "STREET_THUG_GROUP"
  | "MARINE_PATROL"
  | "PIRATE_CREW"
  | "SEA_BEAST"
  | "HUNTER_TEAM"
  | "TRAINING_DUMMY"
  | "SOLO_BOSS"
  | "ELITE_GUARD";

export type EncounterTemplate = {
  id: EncounterTemplateId;
  family: EnemyFamily;
  compatibleFamilies: EnemyFamily[];
  leaderNames: string[];
  supportNames: string[];
  bossNames?: string[];
  groupMin: number;
  groupMax: number;
  defaultKind: CombatKind;
  allowRandomMix: boolean;
};

export const BATTLE_FORMATS: Record<BattleFormatId, BattleFormat> = {
  TEAM: {
    id: "TEAM",
    minPlayerFighters: 1,
    maxPlayerFighters: 4,
    minEnemies: 1,
    maxEnemies: 4,
    playerChoosesParticipants: false,
    allowCaptainSitOut: false,
    isFriendly: false,
    stakesAllowed: false,
    label: "Crew Battle",
  },
  DUEL_1V1: {
    id: "DUEL_1V1",
    minPlayerFighters: 1,
    maxPlayerFighters: 1,
    minEnemies: 1,
    maxEnemies: 1,
    playerChoosesParticipants: true,
    allowCaptainSitOut: true,
    isFriendly: false,
    stakesAllowed: false,
    label: "Duel · 1 vs 1",
  },
  SKIRMISH_2V2: {
    id: "SKIRMISH_2V2",
    minPlayerFighters: 2,
    maxPlayerFighters: 2,
    minEnemies: 2,
    maxEnemies: 2,
    playerChoosesParticipants: true,
    allowCaptainSitOut: true,
    isFriendly: false,
    stakesAllowed: false,
    label: "Skirmish · 2 vs 2",
  },
  BOSS_RAID: {
    id: "BOSS_RAID",
    minPlayerFighters: 1,
    maxPlayerFighters: 4,
    minEnemies: 1,
    maxEnemies: 3,
    playerChoosesParticipants: false,
    allowCaptainSitOut: false,
    isFriendly: false,
    stakesAllowed: false,
    label: "Boss Encounter",
  },
  CUSTOM: {
    id: "CUSTOM",
    minPlayerFighters: 1,
    maxPlayerFighters: 4,
    minEnemies: 1,
    maxEnemies: 4,
    playerChoosesParticipants: false,
    allowCaptainSitOut: true,
    isFriendly: false,
    stakesAllowed: false,
    label: "Battle",
  },
};

export const ENCOUNTER_TEMPLATES: EncounterTemplate[] = [
  {
    id: "STREET_THUG_GROUP",
    family: "STREET",
    compatibleFamilies: ["STREET", "PIRATE"],
    leaderNames: ["Harbor Brute", "Dock Boss", "Cutpurse Chief"],
    supportNames: ["Harbor Thug", "Bandit", "Bounty Thug", "Rookie Pirate", "Dock Bruiser", "Cutpurse"],
    groupMin: 1,
    groupMax: 4,
    defaultKind: "NORMAL",
    allowRandomMix: true,
  },
  {
    id: "MARINE_PATROL",
    family: "MARINE",
    compatibleFamilies: ["MARINE"],
    leaderNames: ["Marine Captain", "Marine Officer", "Patrol Lead"],
    supportNames: ["Marine Recruit", "Marine Rifleman", "Marine Soldier", "Marine Medic", "Elite Marine"],
    groupMin: 1,
    groupMax: 4,
    defaultKind: "NORMAL",
    allowRandomMix: true,
  },
  {
    id: "PIRATE_CREW",
    family: "PIRATE",
    compatibleFamilies: ["PIRATE", "STREET"],
    leaderNames: ["Pirate Captain", "Notorious Captain", "Veteran Pirate"],
    supportNames: ["Rookie Pirate", "Pirate Officer", "Pirate Gunner", "Pirate Swordsman", "Veteran Deckhand"],
    groupMin: 1,
    groupMax: 4,
    defaultKind: "NORMAL",
    allowRandomMix: true,
  },
  {
    id: "SEA_BEAST",
    family: "SEA_BEAST",
    compatibleFamilies: ["SEA_BEAST"],
    leaderNames: ["Sea King"],
    supportNames: ["Juvenile Sea Beast", "Reef Serpent", "Deep Hatchling"],
    bossNames: ["Sea King"],
    groupMin: 1,
    groupMax: 3,
    defaultKind: "BOSS",
    allowRandomMix: false,
  },
  {
    id: "HUNTER_TEAM",
    family: "HUNTER",
    compatibleFamilies: ["HUNTER"],
    leaderNames: ["Elite Bounty Hunter", "Famous Mercenary"],
    supportNames: ["Local Hunter", "Bounty Thug", "Tracker"],
    groupMin: 1,
    groupMax: 3,
    defaultKind: "NORMAL",
    allowRandomMix: true,
  },
  {
    id: "TRAINING_DUMMY",
    family: "TRAINING",
    compatibleFamilies: ["TRAINING"],
    leaderNames: ["Sparring Partner", "Training Dummy"],
    supportNames: ["Training Dummy"],
    groupMin: 1,
    groupMax: 2,
    defaultKind: "SPARRING",
    allowRandomMix: false,
  },
  {
    id: "SOLO_BOSS",
    family: "STORY",
    compatibleFamilies: ["STORY"],
    leaderNames: ["Named Threat"],
    supportNames: [],
    bossNames: ["Named Threat"],
    groupMin: 1,
    groupMax: 1,
    defaultKind: "BOSS",
    allowRandomMix: false,
  },
  {
    id: "ELITE_GUARD",
    family: "GOVERNMENT",
    compatibleFamilies: ["GOVERNMENT", "MARINE"],
    leaderNames: ["Special Agent", "Government Assassin"],
    supportNames: ["Cipher Pol Scout", "Elite Marine", "CP0 Shadow"],
    groupMin: 1,
    groupMax: 3,
    defaultKind: "ELITE",
    allowRandomMix: true,
  },
];

const NAME_FAMILY_HINTS: Array<{ match: RegExp; family: EnemyFamily; role?: EnemyRole }> = [
  { match: /sea\s*king/i, family: "SEA_BEAST", role: "BOSS" },
  { match: /sea\s*beast|serpent|hatchling|reef/i, family: "SEA_BEAST", role: "SUPPORT" },
  { match: /marine|vice admiral|enforcement/i, family: "MARINE" },
  { match: /pirate|deckhand|cutlass|red\s*fang/i, family: "PIRATE" },
  { match: /harbor|bandit|thug|cutpurse|bruiser|dock/i, family: "STREET" },
  { match: /hunter|mercenary|tracker/i, family: "HUNTER" },
  { match: /cipher|government|cp0|agent/i, family: "GOVERNMENT" },
  { match: /revolutionary/i, family: "REVOLUTIONARY" },
  { match: /sparring|training|dummy/i, family: "TRAINING" },
];

export function inferEnemyFamily(name: string): EnemyFamily {
  for (const hint of NAME_FAMILY_HINTS) {
    if (hint.match.test(name)) {
      return hint.family;
    }
  }
  return "STREET";
}

export function inferEnemyRole(name: string, kind?: CombatKind, explicit?: EnemyRole): EnemyRole {
  if (explicit) return explicit;
  if (kind === "BOSS") return "BOSS";
  if (kind === "ELITE") return "ELITE";
  for (const hint of NAME_FAMILY_HINTS) {
    if (hint.role && hint.match.test(name)) {
      return hint.role;
    }
  }
  if (/captain|officer|chief|boss|admiral|king/i.test(name)) {
    return "ELITE";
  }
  return "NORMAL";
}

export function formatForKind(kind: CombatKind | undefined, isFriendly?: boolean): BattleFormat {
  if (isFriendly || kind === "SPARRING") {
    return {
      ...BATTLE_FORMATS.DUEL_1V1,
      isFriendly: true,
      stakesAllowed: true,
      label: "Friendly Match",
      playerChoosesParticipants: true,
    };
  }
  if (kind === "DUEL") return { ...BATTLE_FORMATS.DUEL_1V1 };
  if (kind === "SKIRMISH") return { ...BATTLE_FORMATS.SKIRMISH_2V2 };
  if (kind === "BOSS") return { ...BATTLE_FORMATS.BOSS_RAID };
  if (kind === "TEAM_BATTLE") return { ...BATTLE_FORMATS.TEAM };
  return { ...BATTLE_FORMATS.TEAM };
}

export function getTemplate(id: string | undefined): EncounterTemplate | undefined {
  return ENCOUNTER_TEMPLATES.find((entry) => entry.id === id);
}

export function templateForFamily(family: EnemyFamily): EncounterTemplate {
  return (
    ENCOUNTER_TEMPLATES.find((entry) => entry.family === family) ??
    ENCOUNTER_TEMPLATES.find((entry) => entry.id === "STREET_THUG_GROUP")!
  );
}

export function familiesCompatible(a: EnemyFamily, b: EnemyFamily): boolean {
  if (a === b) return true;
  const template = templateForFamily(a);
  return template.compatibleFamilies.includes(b);
}

export function battleFormatLabel(format: BattleFormat, allyCount: number, enemyCount: number): string {
  if (format.isFriendly) {
    return `Friendly Match · ${allyCount} vs ${enemyCount}`;
  }
  if (format.id === "BOSS_RAID" || format.id === "DUEL_1V1" || format.id === "SKIRMISH_2V2") {
    return `${format.label.replace(/·.*/, "").trim()} · ${allyCount} vs ${enemyCount}`;
  }
  return `${allyCount} vs ${enemyCount}`;
}

export type ComposedEnemy = ExtraEnemySpec & {
  enemyRole: EnemyRole;
  enemyFamily: EnemyFamily;
};

/**
 * Build coherent extras for a primary foe. Never mixes Sea King with Harbor Thug, etc.
 */
export function composeSupportEnemies(options: {
  primaryName: string;
  primaryStrength: number;
  primaryHp?: number;
  primaryFamily?: EnemyFamily;
  primaryRole?: EnemyRole;
  kind?: CombatKind;
  templateId?: string;
  desiredTotal: number;
  explicitExtras?: Array<{
    name: string;
    strength: number;
    hp?: number;
    formation?: "FRONT" | "BACK";
    enemyRole?: EnemyRole;
    enemyFamily?: EnemyFamily;
  }>;
  rng: RandomService;
}): { extras: ComposedEnemy[]; reason: string; templateId: string } {
  const family = options.primaryFamily ?? inferEnemyFamily(options.primaryName);
  const role = inferEnemyRole(options.primaryName, options.kind, options.primaryRole);
  const template =
    getTemplate(options.templateId) ??
    (role === "BOSS" && family === "SEA_BEAST"
      ? getTemplate("SEA_BEAST")!
      : templateForFamily(family));

  if (options.explicitExtras?.length) {
    const extras = options.explicitExtras.slice(0, 3).map((entry, index) => {
      const entryFamily = entry.enemyFamily ?? inferEnemyFamily(entry.name);
      if (!template.allowRandomMix && !familiesCompatible(family, entryFamily)) {
        // Replace incompatible authored extras with template supports when mix is forbidden.
        const fallbackName = template.supportNames[index] ?? template.supportNames[0] ?? entry.name;
        return {
          name: fallbackName,
          strength: entry.strength,
          hp: entry.hp ?? Math.max(10, Math.round((options.primaryHp ?? 22 + options.primaryStrength * 5) * 0.45)),
          formation: entry.formation ?? (index === 0 ? "FRONT" : ("BACK" as const)),
          enemyRole: (entry.enemyRole ?? "SUPPORT") as EnemyRole,
          enemyFamily: family,
        };
      }
      return {
        name: entry.name,
        strength: entry.strength,
        hp: entry.hp ?? Math.max(10, Math.round((options.primaryHp ?? 22 + options.primaryStrength * 5) * 0.55)),
        formation: entry.formation ?? (index === 0 ? "FRONT" : ("BACK" as const)),
        enemyRole: (entry.enemyRole ?? inferEnemyRole(entry.name, options.kind)) as EnemyRole,
        enemyFamily: entryFamily,
      };
    });
    return {
      extras,
      reason: `Explicit extras for template ${template.id} (family ${family}).`,
      templateId: template.id,
    };
  }

  const desired = Math.max(1, Math.min(4, options.desiredTotal));
  const extrasNeeded = desired - 1;
  if (extrasNeeded <= 0) {
    return {
      extras: [],
      reason: `Solo encounter for ${options.primaryName} (${template.id}).`,
      templateId: template.id,
    };
  }

  // Bosses without allowRandomMix: only same-family supports (e.g. juvenile sea beasts).
  const pool = template.supportNames.length
    ? template.supportNames
    : template.allowRandomMix
      ? template.leaderNames
      : [];

  if (!pool.length) {
    return {
      extras: [],
      reason: `No compatible supports for ${template.id}; keeping ${options.primaryName} alone.`,
      templateId: template.id,
    };
  }

  const extras: ComposedEnemy[] = [];
  for (let i = 0; i < extrasNeeded; i += 1) {
    const name = pool[options.rng.nextInt(0, pool.length - 1)] ?? pool[0]!;
    extras.push({
      name,
      strength: Math.max(2, Math.round(options.primaryStrength * (0.4 + i * 0.08))),
      hp: Math.max(10, Math.round((options.primaryHp ?? 22 + options.primaryStrength * 5) * 0.45)),
      formation: i === 0 ? "FRONT" : "BACK",
      enemyRole: "SUPPORT",
      enemyFamily: family,
    });
  }

  return {
    extras,
    reason: `Composed ${extras.length} support(s) from ${template.id} for family ${family}.`,
    templateId: template.id,
  };
}

export const EncounterCompositionService = {
  BATTLE_FORMATS,
  ENCOUNTER_TEMPLATES,
  inferEnemyFamily,
  inferEnemyRole,
  formatForKind,
  getTemplate,
  templateForFamily,
  familiesCompatible,
  battleFormatLabel,
  composeSupportEnemies,
};
