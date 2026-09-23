import {
  MASTERY_COMBO_LEVEL,
  MASTERY_LEVEL_XP_THRESHOLDS,
  MASTERY_XP_PER_USE,
} from "../game/constants";
import { getDevilFruit } from "../data/devilFruits";
import {
  getMasteryComboUnlock,
  getMasterySoloUnlock,
  MASTERY_COMBO_UNLOCKS,
  MASTERY_SOLO_UNLOCKS,
  masteryComboToAbility,
  masterySoloToAbility,
} from "../data/weaponMastery";
import { techniqueMatchesEquipped } from "../game/weaponClasses";
import type {
  Ability,
  CombatAction,
  MasteryTrackId,
  Player,
  ProfileSave,
  RunState,
} from "../models/types";
import { DevilFruitCombatService } from "./DevilFruitCombatService";
import { WeaponProgressionService } from "./WeaponProgressionService";
import { WeaponService } from "./WeaponService";

function ensureMasteryState(player: Player): void {
  if (!player.weaponMastery) {
    player.weaponMastery = WeaponService.defaultMastery();
  }
  if (!player.unlockedMasteryTechniques) {
    player.unlockedMasteryTechniques = [];
  }
  if (!player.unlockedTechniques) {
    player.unlockedTechniques = [];
  }
  // Mirror DF use count into the DEVIL_FRUIT mastery track when present.
  if (player.fruitTechniqueUses != null) {
    const current = player.weaponMastery.DEVIL_FRUIT ?? 0;
    if (player.fruitTechniqueUses > current) {
      player.weaponMastery.DEVIL_FRUIT = player.fruitTechniqueUses;
    }
  }
}

function playerIsUnarmed(player: Player): boolean {
  const equipped = WeaponService.getEquippedWeapons(player);
  if (equipped.length > 0) {
    return false;
  }
  // Bare hands / kicks styles still count as unarmed fighting.
  return true;
}

function grantUnlock(player: Player, techniqueId: string): boolean {
  ensureMasteryState(player);
  if (player.unlockedMasteryTechniques!.includes(techniqueId)) {
    return false;
  }
  player.unlockedMasteryTechniques!.push(techniqueId);
  if (!player.unlockedTechniques!.includes(techniqueId)) {
    player.unlockedTechniques!.push(techniqueId);
  }
  return true;
}

export const WeaponMasteryService = {
  ensure(player: Player): void {
    ensureMasteryState(player);
  },

  trackLabel(track: MasteryTrackId): string {
    switch (track) {
      case "UNARMED":
        return "Unarmed";
      case "DEVIL_FRUIT":
        return "Devil Fruit";
      case "SWORD":
        return "Sword";
      case "SPEAR":
        return "Spear";
      case "CLUB":
        return "Club / Staff";
      case "GUN":
        return "Gun";
      case "FISTS":
        return "Fists";
      case "KICKS":
        return "Kicks";
      default:
        return track;
    }
  },

  getXp(player: Player, track: MasteryTrackId): number {
    ensureMasteryState(player);
    if (track === "DEVIL_FRUIT") {
      return Math.max(player.weaponMastery!.DEVIL_FRUIT ?? 0, player.fruitTechniqueUses ?? 0);
    }
    return player.weaponMastery![track] ?? 0;
  },

  /** Mastery level derived from cumulative XP thresholds. */
  getLevel(player: Player, track: MasteryTrackId): number {
    const xp = this.getXp(player, track);
    let level = 0;
    for (let i = 0; i < MASTERY_LEVEL_XP_THRESHOLDS.length; i++) {
      if (xp >= MASTERY_LEVEL_XP_THRESHOLDS[i]!) {
        level = i;
      }
    }
    return level;
  },

  xpIntoLevel(player: Player, track: MasteryTrackId): { current: number; needed: number; level: number } {
    const xp = this.getXp(player, track);
    const level = this.getLevel(player, track);
    const floor = MASTERY_LEVEL_XP_THRESHOLDS[level] ?? 0;
    const next = MASTERY_LEVEL_XP_THRESHOLDS[level + 1];
    if (next == null) {
      return { current: xp - floor, needed: 0, level };
    }
    return { current: xp - floor, needed: next - floor, level };
  },

  addXp(run: RunState, track: MasteryTrackId, amount = MASTERY_XP_PER_USE): { xp: number; leveledTo: number | null } {
    const player = run.player;
    ensureMasteryState(player);
    const before = this.getLevel(player, track);
    const current = player.weaponMastery![track] ?? 0;
    const next = current + amount;
    player.weaponMastery![track] = next;
    if (track === "DEVIL_FRUIT") {
      // Keep DF use counter in sync when mastery is the source of the bump.
      player.fruitTechniqueUses = Math.max(player.fruitTechniqueUses ?? 0, next);
    }
    const after = this.getLevel(player, track);
    return { xp: next, leveledTo: after > before ? after : null };
  },

  /**
   * Resolve which mastery track(s) a combat action should train.
   * DF skills train DEVIL_FRUIT; weapon skills train their class; bare attacks train UNARMED.
   */
  tracksForAction(player: Player, action: CombatAction): MasteryTrackId[] {
    const tracks = new Set<MasteryTrackId>();

    if (action.type === "ATTACK") {
      const weapons = WeaponService.getEquippedWeapons(player);
      if (weapons.length === 0) {
        if (player.activeCombatStyle === "black_leg") {
          tracks.add("KICKS");
        } else if (player.activeCombatStyle === "brawler") {
          tracks.add("FISTS");
        }
        tracks.add("UNARMED");
      } else {
        for (const weapon of weapons) {
          tracks.add(weapon.weaponType);
        }
      }
      return [...tracks];
    }

    if (action.type !== "TECHNIQUE" || !action.abilityId) {
      return [];
    }

    const abilityId = action.abilityId;
    if (DevilFruitCombatService.isFruitAbilityId(abilityId, player.devilFruitId)) {
      tracks.add("DEVIL_FRUIT");
      return [...tracks];
    }

    const solo = getMasterySoloUnlock(abilityId);
    if (solo) {
      tracks.add(solo.track);
      return [...tracks];
    }

    const combo = getMasteryComboUnlock(abilityId);
    if (combo) {
      for (const track of combo.tracks) {
        tracks.add(track);
      }
      return [...tracks];
    }

    // Catalog / style techniques: infer from ability gates + equipped weapons.
    const fromWeaponTech = WeaponService.techniquesForPlayer(player).find((entry) => entry.id === abilityId);
    const ability =
      fromWeaponTech ??
      this.abilitiesForPlayer(player).find((entry) => entry.id === abilityId);

    if (ability?.requiredWeaponTypes?.length) {
      for (const type of ability.requiredWeaponTypes) {
        tracks.add(type);
      }
    }

    if (abilityId === "focused_strike") {
      const weapons = WeaponService.getEquippedWeapons(player);
      if (weapons.length === 0) {
        tracks.add("UNARMED");
        if (player.activeCombatStyle === "black_leg") tracks.add("KICKS");
        if (player.activeCombatStyle === "brawler") tracks.add("FISTS");
      } else {
        for (const weapon of weapons) {
          if (weapon.weaponType !== "GUN") {
            tracks.add(weapon.weaponType);
          }
        }
      }
    }

    // Fallback: primary equipped type or unarmed.
    if (tracks.size === 0) {
      const primary = WeaponService.getEquippedWeapon(player);
      if (primary) {
        tracks.add(primary.weaponType);
      } else {
        tracks.add("UNARMED");
      }
    }

    return [...tracks];
  },

  /** Apply XP for a player combat action and unlock newly earned techniques. */
  recordCombatAction(_profile: ProfileSave, run: RunState, action: CombatAction): string | null {
    if (action.type !== "ATTACK" && action.type !== "TECHNIQUE") {
      return null;
    }
    // Only the captain's actions train player mastery.
    if (run.combat?.activeCombatantId && run.combat.activeCombatantId !== run.combat.playerCombatant.id) {
      return null;
    }

    ensureMasteryState(run.player);
    const tracks = this.tracksForAction(run.player, action);
    if (tracks.length === 0) {
      return null;
    }

    // DF technique use is already counted in DevilFruitCombatService; still sync track + check combos.
    const skipXpForDf =
      action.type === "TECHNIQUE" &&
      DevilFruitCombatService.isFruitAbilityId(action.abilityId, run.player.devilFruitId);

    for (const instance of WeaponService.findEquippedInstances(run.player)) {
      WeaponProgressionService.addWielderXp(instance, run.player.id, MASTERY_XP_PER_USE);
      WeaponProgressionService.noteOwner(instance, run.player.id, run.player.name);
    }

    const leveled: string[] = [];
    for (const track of tracks) {
      if (skipXpForDf && track === "DEVIL_FRUIT") {
        // Sync XP from fruitTechniqueUses (just incremented).
        ensureMasteryState(run.player);
        continue;
      }
      if (skipXpForDf && track !== "DEVIL_FRUIT") {
        // Pure DF skills only train the fruit track.
        continue;
      }
      const result = this.addXp(run, track, MASTERY_XP_PER_USE);
      if (result.leveledTo != null) {
        leveled.push(`${this.trackLabel(track)} Lv ${result.leveledTo}`);
      }
    }

    if (skipXpForDf) {
      const before = this.getLevel(run.player, "DEVIL_FRUIT");
      ensureMasteryState(run.player);
      const after = this.getLevel(run.player, "DEVIL_FRUIT");
      if (after > before) {
        leveled.push(`${this.trackLabel("DEVIL_FRUIT")} Lv ${after}`);
      }
    }

    const unlockLine = this.applyUnlocks(run);
    if (unlockLine) {
      return unlockLine;
    }
    if (leveled.length) {
      return `Mastery grew: ${leveled.join(", ")}.`;
    }
    return null;
  },

  /** Sync DF track after DevilFruitCombatService.recordTechniqueUse. */
  syncDevilFruitFromUses(run: RunState): string | null {
    ensureMasteryState(run.player);
    return this.applyUnlocks(run);
  },

  applyUnlocks(run: RunState): string | null {
    const player = run.player;
    ensureMasteryState(player);
    const newlyUnlocked: string[] = [];

    for (const solo of MASTERY_SOLO_UNLOCKS) {
      if (this.getLevel(player, solo.track) < solo.level) continue;
      if (grantUnlock(player, solo.id)) {
        newlyUnlocked.push(solo.name);
      }
    }

    for (const combo of MASTERY_COMBO_UNLOCKS) {
      const need = combo.level ?? MASTERY_COMBO_LEVEL;
      const [a, b] = combo.tracks;
      if (this.getLevel(player, a) < need || this.getLevel(player, b) < need) continue;
      if (combo.requiresDevilFruit && !player.devilFruitId) continue;
      if (grantUnlock(player, combo.id)) {
        const fruit = player.devilFruitId ? getDevilFruit(player.devilFruitId) : undefined;
        const ability = masteryComboToAbility(combo, player.devilFruitId, fruit?.type);
        newlyUnlocked.push(ability.name);
      }
    }

    if (newlyUnlocked.length === 0) {
      return null;
    }
    if (newlyUnlocked.length === 1) {
      return `You learned ${newlyUnlocked[0]} through hard practice.`;
    }
    return `You learned ${newlyUnlocked.join(", ")} through hard practice.`;
  },

  /** Combat abilities unlocked by mastery that match current equipment. */
  abilitiesForPlayer(player: Player): Ability[] {
    ensureMasteryState(player);
    const equippedTypes = WeaponService.equippedTypesForPlayer(player);
    const unarmed = playerIsUnarmed(player);
    const fruit = player.devilFruitId ? getDevilFruit(player.devilFruitId) : undefined;
    const list: Ability[] = [];
    const unlocked = new Set(player.unlockedMasteryTechniques ?? []);

    for (const solo of MASTERY_SOLO_UNLOCKS) {
      if (!unlocked.has(solo.id)) continue;
      if (solo.unarmedOnly && !unarmed) continue;
      const ability = masterySoloToAbility(solo);
      if (!solo.unarmedOnly && !techniqueMatchesEquipped(solo, equippedTypes)) continue;
      if (!list.some((entry) => entry.id === ability.id)) {
        list.push(ability);
      }
    }

    for (const combo of MASTERY_COMBO_UNLOCKS) {
      if (!unlocked.has(combo.id)) continue;
      if (combo.requiresDevilFruit && !player.devilFruitId) continue;
      if (combo.unarmedOnly && !unarmed) continue;
      const ability = masteryComboToAbility(combo, player.devilFruitId, fruit?.type);
      if (!combo.unarmedOnly && !techniqueMatchesEquipped(combo, equippedTypes)) continue;
      // Hand-and-blade: needs a sword equipped (weaponType gate) — unarmed track is mastery only.
      if (!list.some((entry) => entry.id === ability.id)) {
        list.push(ability);
      }
    }

    return list;
  },

  /** Compact rows for UI. */
  displayTracks(player: Player): Array<{
    track: MasteryTrackId;
    label: string;
    level: number;
    xp: number;
    current: number;
    needed: number;
  }> {
    ensureMasteryState(player);
    const tracks: MasteryTrackId[] = [
      "UNARMED",
      "SWORD",
      "SPEAR",
      "CLUB",
      "GUN",
      "FISTS",
      "KICKS",
      "DEVIL_FRUIT",
    ];
    return tracks
      .map((track) => {
        const progress = this.xpIntoLevel(player, track);
        return {
          track,
          label: this.trackLabel(track),
          level: progress.level,
          xp: this.getXp(player, track),
          current: progress.current,
          needed: progress.needed,
        };
      })
      .filter((row) => row.xp > 0 || row.level > 0 || row.track === "UNARMED" || row.track === "DEVIL_FRUIT");
  },

  /** Primary track for HUD: equipped weapon class, else Unarmed, plus DF if present. */
  primaryTrack(player: Player): MasteryTrackId {
    const weapon = WeaponService.getEquippedWeapon(player);
    if (weapon) {
      return weapon.weaponType;
    }
    if (player.activeCombatStyle === "black_leg") return "KICKS";
    if (player.activeCombatStyle === "brawler") return "FISTS";
    return "UNARMED";
  },
};
