import {
  applyZoanFormMods,
  fruitTechniqueToAbility,
  getDevilFruitCombat,
  type ZoanFormProfile,
} from "../data/devilFruitCombat";
import { getDevilFruit } from "../data/devilFruits";
import type { Ability, Player, PlayerStats, ProfileSave, RunState, ZoanFormId } from "../models/types";
import { CollectionService } from "./CollectionService";

function ensureFruitProgress(player: Player): void {
  if (!player.unlockedFruitTechniques) {
    player.unlockedFruitTechniques = [];
  }
  if (player.fruitTechniqueUses == null) {
    player.fruitTechniqueUses = 0;
  }
  if (!player.fruitTechniqueUseCounts) {
    player.fruitTechniqueUseCounts = {};
  }
}

function isUnlocked(player: Player, techId: string, starter?: boolean): boolean {
  if (player.unlockedFruitTechniques?.includes(techId)) {
    return true;
  }
  // Legacy saves that ate a fruit before starter tracking.
  return Boolean(starter);
}

export const DevilFruitCombatService = {
  combatDefFor(fruitId: string | null | undefined) {
    return fruitId ? getDevilFruitCombat(fruitId) : undefined;
  },

  isZoan(fruitId: string | null | undefined): boolean {
    const fruit = fruitId ? getDevilFruit(fruitId) : undefined;
    return fruit?.type === "ZOAN";
  },

  availableForms(fruitId: string | null | undefined): ZoanFormProfile[] {
    return this.combatDefFor(fruitId)?.zoanForms ?? [];
  },

  currentForm(player: Player): ZoanFormId {
    if (!this.isZoan(player.devilFruitId)) {
      return "HUMAN";
    }
    return player.zoanForm ?? "HUMAN";
  },

  /** Grant starter DF techniques when a fruit is eaten. */
  grantStarters(player: Player, fruitId: string): void {
    ensureFruitProgress(player);
    const combat = getDevilFruitCombat(fruitId);
    if (!combat) return;
    for (const tech of combat.techniques) {
      if (tech.starter && !player.unlockedFruitTechniques!.includes(tech.id)) {
        player.unlockedFruitTechniques!.push(tech.id);
      }
    }
    if (combat.type === "ZOAN") {
      player.zoanForm = player.zoanForm ?? "HUMAN";
    }
  },

  setForm(run: RunState, formId: ZoanFormId): { ok: boolean; reason: string } {
    const player = run.player;
    if (!this.isZoan(player.devilFruitId)) {
      return { ok: false, reason: "Only Zoan users can change forms." };
    }
    const forms = this.availableForms(player.devilFruitId);
    const profile = forms.find((entry) => entry.id === formId);
    if (!profile) {
      return { ok: false, reason: "That form is not available for this fruit." };
    }
    player.zoanForm = formId;
    return { ok: true, reason: `Shifted into ${profile.label}.` };
  },

  /** Base stats + active Zoan form mods (combat / display). */
  effectiveStats(player: Player): PlayerStats {
    const formId = this.currentForm(player);
    const profile = this.availableForms(player.devilFruitId).find((entry) => entry.id === formId);
    return applyZoanFormMods(player.stats, profile?.statMods);
  },

  abilitiesForPlayer(player: Player): Ability[] {
    const fruitId = player.devilFruitId;
    if (!fruitId) return [];
    ensureFruitProgress(player);
    // Backfill starters for saves that ate a fruit before combat tracking.
    this.grantStarters(player, fruitId);
    const combat = getDevilFruitCombat(fruitId);
    if (!combat) return [];

    const form = this.currentForm(player);
    const list: Ability[] = [];

    for (const tech of combat.techniques) {
      if (!isUnlocked(player, tech.id, tech.starter)) continue;
      if (tech.requiredForms?.length && !tech.requiredForms.includes(form)) continue;
      list.push(fruitTechniqueToAbility(tech));
    }
    return list;
  },

  isFruitAbilityId(abilityId: string | undefined, fruitId: string | null): boolean {
    if (!abilityId || !fruitId) return false;
    if (abilityId === "fruit_burst") return true;
    const combat = getDevilFruitCombat(fruitId);
    return Boolean(combat?.techniques.some((tech) => tech.id === abilityId));
  },

  /**
   * Record a DF technique use and unlock the next skill when thresholds are met.
   * Returns a short feedback line when something new unlocks.
   */
  recordTechniqueUse(profile: ProfileSave, run: RunState, abilityId: string): string | null {
    const player = run.player;
    const fruitId = player.devilFruitId;
    if (!fruitId || !this.isFruitAbilityId(abilityId, fruitId)) {
      return null;
    }

    ensureFruitProgress(player);
    player.fruitTechniqueUses = (player.fruitTechniqueUses ?? 0) + 1;
    player.fruitTechniqueUseCounts![abilityId] = (player.fruitTechniqueUseCounts![abilityId] ?? 0) + 1;

    const combat = getDevilFruitCombat(fruitId);
    if (!combat) return null;

    const loreKey = abilityId.replace(/^df_[a-z]+_/, "");
    CollectionService.discoverTechnique(profile, fruitId, loreKey);
    CollectionService.discoverTechnique(profile, fruitId, abilityId);

    for (const tech of combat.techniques) {
      if (tech.starter) continue;
      if (player.unlockedFruitTechniques!.includes(tech.id)) continue;

      const totalOk =
        tech.unlockAfterUses == null || (player.fruitTechniqueUses ?? 0) >= tech.unlockAfterUses;
      const specificOk =
        !tech.unlockAfterTechniqueId ||
        (player.fruitTechniqueUseCounts![tech.unlockAfterTechniqueId] ?? 0) >=
          (tech.unlockAfterTechniqueUses ?? 1);

      if (totalOk && specificOk) {
        player.unlockedFruitTechniques!.push(tech.id);
        // Keep DEVIL_FRUIT mastery track aligned with use-count progression.
        if (!player.weaponMastery) {
          player.weaponMastery = {};
        }
        player.weaponMastery.DEVIL_FRUIT = Math.max(
          player.weaponMastery.DEVIL_FRUIT ?? 0,
          player.fruitTechniqueUses ?? 0,
        );
        return `You learned ${tech.name} through the fruit's power.`;
      }
    }

    if (!player.weaponMastery) {
      player.weaponMastery = {};
    }
    player.weaponMastery.DEVIL_FRUIT = Math.max(
      player.weaponMastery.DEVIL_FRUIT ?? 0,
      player.fruitTechniqueUses ?? 0,
    );

    return null;
  },
};
