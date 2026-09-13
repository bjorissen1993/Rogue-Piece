import { getTechnique, getWeapon } from "../data/weapons";
import { getFightingStyle, getStyleTechnique } from "../data/fightingStyles";
import {
  TECHNIQUE_MILESTONE_LEVELS,
  XP_BASE,
  XP_EXPONENT,
  XP_REWARDS,
} from "../game/constants";
import type {
  CharacterProgression,
  CrewMember,
  PendingLevelUp,
  Player,
  PlayerStats,
  RunState,
  StatName,
  WorldCharacter,
} from "../models/types";
import { STAT_LABELS } from "../utils/text";
import { clampStat, ensurePlayerStats } from "../utils/stats";
import { CharacterService } from "./CharacterService";
import { MpService } from "./MpService";
import { WeaponService } from "./WeaponService";

export function defaultProgression(): CharacterProgression {
  return { level: 1, experience: 0, availableStatPoints: 0, techniquePoints: 0 };
}

export function xpToNextLevel(level: number): number {
  return Math.round(XP_BASE * Math.pow(level, XP_EXPONENT));
}

export function xpProgress(progression: CharacterProgression): { current: number; needed: number; ratio: number } {
  const needed = xpToNextLevel(progression.level);
  return {
    current: progression.experience,
    needed,
    ratio: needed > 0 ? Math.min(1, progression.experience / needed) : 0,
  };
}

function ensurePlayerProgression(player: Player): CharacterProgression {
  if (!player.progression) {
    player.progression = defaultProgression();
  }
  if (player.progression.techniquePoints == null) {
    player.progression.techniquePoints = 0;
  }
  if (!player.unlockedTechniques) {
    player.unlockedTechniques = [];
  }
  return player.progression;
}

function ensureCrewProgression(run: RunState, characterId: string): CharacterProgression | null {
  const member = run.crew.find((entry) => entry.characterId === characterId);
  if (!member) {
    return null;
  }
  if (!member.progression) {
    member.progression = defaultProgression();
  }
  if (member.progression.techniquePoints == null) {
    member.progression.techniquePoints = 0;
  }
  const character = CharacterService.getCharacter(run, characterId);
  if (character && !character.unlockedTechniques) {
    character.unlockedTechniques = [];
  }
  return member.progression;
}

function crewStats(character: WorldCharacter): PlayerStats {
  if (character.crewStats) {
    return ensurePlayerStats(character.crewStats);
  }
  const base = character.strength;
  return ensurePlayerStats({
    strength: base,
    defense: Math.max(1, base - 1),
    speed: Math.max(1, base - 2),
    willpower: Math.max(2, Math.floor(base / 2)),
    charisma: 2,
  });
}

export const ProgressionService = {
  defaultProgression,
  xpToNextLevel,
  xpProgress,

  getProgression(run: RunState, characterId: "player" | string): CharacterProgression {
    if (characterId === "player") {
      return ensurePlayerProgression(run.player);
    }
    return ensureCrewProgression(run, characterId) ?? defaultProgression();
  },

  getDisplayName(run: RunState, characterId: "player" | string): string {
    if (characterId === "player") {
      return run.player.name;
    }
    return CharacterService.getCharacter(run, characterId)?.name ?? "Crewmate";
  },

  getStats(run: RunState, characterId: "player" | string): PlayerStats {
    if (characterId === "player") {
      return ensurePlayerStats(run.player.stats);
    }
    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return ensurePlayerStats(undefined);
    }
    return ensurePlayerStats(crewStats(character));
  },

  grantExperience(
    run: RunState,
    characterId: "player" | string,
    amount: number,
    source?: string,
  ): { leveled: boolean; message: string } {
    if (amount <= 0) {
      return { leveled: false, message: "" };
    }
    const progression =
      characterId === "player" ? ensurePlayerProgression(run.player) : ensureCrewProgression(run, characterId);
    if (!progression) {
      return { leveled: false, message: "" };
    }

    progression.experience += amount;
    let leveled = false;
    while (progression.experience >= xpToNextLevel(progression.level)) {
      progression.experience -= xpToNextLevel(progression.level);
      const fromLevel = progression.level;
      progression.level += 1;
      progression.availableStatPoints += 1;
      leveled = true;
      if (!run.pendingLevelUps) {
        run.pendingLevelUps = [];
      }
      run.pendingLevelUps.push({ characterId, fromLevel, toLevel: progression.level });
      if (TECHNIQUE_MILESTONE_LEVELS.includes(progression.level as (typeof TECHNIQUE_MILESTONE_LEVELS)[number])) {
        progression.techniquePoints = (progression.techniquePoints ?? 0) + 1;
        this.queueTechniqueChoice(run, characterId);
      }
    }

    const name = this.getDisplayName(run, characterId);
    const suffix = source ? ` (${source})` : "";
    return {
      leveled,
      message: leveled ? `${name} gained ${amount} XP${suffix} and leveled up!` : `+${amount} XP${suffix}`,
    };
  },

  queueTechniqueChoice(run: RunState, characterId: "player" | string): void {
    const offers = this.techniqueOffers(run, characterId);
    if (offers.length === 0) {
      return;
    }
    run.pendingTechniqueChoice = { characterId, techniqueIds: offers.slice(0, 3) };
  },

  techniqueOffers(run: RunState, characterId: "player" | string): string[] {
    const pool = new Set<string>();
    if (characterId === "player") {
      const weapon = WeaponService.getEquippedWeapon(run.player);
      if (weapon) {
        for (const id of weapon.techniqueIds) {
          pool.add(id);
        }
        const mastery = WeaponService.getMastery(run.player, weapon.weaponType);
        if (mastery >= 5) {
          for (const id of weapon.techniqueIds) {
            pool.add(id);
          }
        }
      }
      const styleId = run.player.activeCombatStyle;
      if (styleId) {
        const style = getFightingStyle(styleId);
        for (const id of style?.techniqueIds ?? []) {
          pool.add(id);
        }
      }
      for (const id of run.player.unlockedTechniques ?? []) {
        pool.delete(id);
      }
    } else {
      const character = CharacterService.getCharacter(run, characterId);
      const weaponId = character?.weaponIds?.[0];
      if (weaponId) {
        const weapon = getWeapon(weaponId);
        for (const id of weapon?.techniqueIds ?? []) {
          pool.add(id);
        }
      }
      for (const id of character?.unlockedTechniques ?? []) {
        pool.delete(id);
      }
    }
    return [...pool].filter((id) => Boolean(getTechnique(id) || getStyleTechnique(id)));
  },

  applyStatPoint(run: RunState, characterId: "player" | string, stat: StatName): string {
    if (characterId === "player") {
      const progression = ensurePlayerProgression(run.player);
      if (progression.availableStatPoints <= 0) {
        return "No stat points available.";
      }
      progression.availableStatPoints -= 1;
      run.player.stats[stat] = clampStat(run.player.stats[stat] + 1);
      if (stat === "defense" || stat === "willpower") {
        run.player.maxHp = Math.max(run.player.maxHp, 100 + run.player.stats.defense * 2);
      }
      if (stat === "willpower") {
        MpService.ensurePlayer(run.player);
      }
      return `${STAT_LABELS[stat]} increased to ${run.player.stats[stat]}.`;
    }
    const progression = ensureCrewProgression(run, characterId);
    if (!progression) {
      return "Crewmate not found.";
    }
    if (progression.availableStatPoints <= 0) {
      return "No stat points available.";
    }
    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return "Crewmate not found.";
    }
    progression.availableStatPoints -= 1;
    const stats = crewStats(character);
    stats[stat] = clampStat(stats[stat] + 1);
    character.crewStats = stats;
    if (stat === "strength") {
      character.strength = stats.strength;
    }
    return `${character.name}'s ${STAT_LABELS[stat].toLowerCase()} increased to ${stats[stat]}.`;
  },

  consumePendingLevelUp(run: RunState): PendingLevelUp | null {
    if (!run.pendingLevelUps?.length) {
      return null;
    }
    return run.pendingLevelUps.shift() ?? null;
  },

  peekPendingLevelUp(run: RunState): PendingLevelUp | null {
    return run.pendingLevelUps?.[0] ?? null;
  },

  unlockTechnique(run: RunState, characterId: "player" | string, techniqueId: string): string {
    const tech = getTechnique(techniqueId) ?? getStyleTechnique(techniqueId);
    if (!tech) {
      return "Unknown technique.";
    }
    if (characterId === "player") {
      ensurePlayerProgression(run.player);
      if (!run.player.unlockedTechniques!.includes(techniqueId)) {
        run.player.unlockedTechniques!.push(techniqueId);
      }
      const progression = run.player.progression!;
      if ((progression.techniquePoints ?? 0) > 0) {
        progression.techniquePoints! -= 1;
      }
      return `Learned ${tech.name}.`;
    }
    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return "Crewmate not found.";
    }
    if (!character.unlockedTechniques) {
      character.unlockedTechniques = [];
    }
    if (!character.unlockedTechniques.includes(techniqueId)) {
      character.unlockedTechniques.push(techniqueId);
    }
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (member?.progression && (member.progression.techniquePoints ?? 0) > 0) {
      member.progression.techniquePoints! -= 1;
    }
    return `${character.name} learned ${tech.name}.`;
  },

  clearTechniqueChoice(run: RunState): void {
    run.pendingTechniqueChoice = null;
  },

  grantCombatXp(run: RunState, combatKind?: string): string {
    const amount =
      combatKind === "BOSS" || combatKind === "HIGH_RISK" || combatKind === "ELITE"
        ? XP_REWARDS.COMBAT_BOSS
        : XP_REWARDS.COMBAT_WIN;
    const result = this.grantExperience(run, "player", amount, "combat victory");
    for (const member of run.crew) {
      this.grantExperience(run, member.characterId, Math.round(amount * 0.6), "combat victory");
    }
    return result.message;
  },

  migratePlayer(player: Player): Player {
    return {
      ...player,
      stats: ensurePlayerStats(player.stats),
      progression: player.progression ?? defaultProgression(),
      unlockedTechniques: player.unlockedTechniques ?? [],
      title: player.title ?? "Independent Sailor",
    };
  },

  migrateCrewMember(member: CrewMember): CrewMember {
    return {
      ...member,
      progression: member.progression ?? defaultProgression(),
    };
  },

  migrateCharacter(character: WorldCharacter): WorldCharacter {
    return {
      ...character,
      crewStats: character.crewStats ? ensurePlayerStats(character.crewStats) : character.crewStats,
      unlockedTechniques: character.unlockedTechniques ?? [],
    };
  },
};
