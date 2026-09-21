import { describe, expect, it } from "vitest";
import { getAbilitiesForPlayer } from "../data/abilities";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { MASTERY_COMBO_LEVEL } from "../game/constants";
import type { ProfileSave, RunState } from "../models/types";
import { DevilFruitService } from "./DevilFruitService";
import { WeaponMasteryService } from "./WeaponMasteryService";
import { WeaponService } from "./WeaponService";

function freshRun(seed: string): { profile: ProfileSave; run: RunState } {
  const profile = createEmptyProfile(`wm_${seed}`, "NORMAL");
  const run = createRunState(profile, {
    name: "Bowie",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  profile.activeRun = run;
  run.seed = seed;
  return { profile, run };
}

describe("WeaponMasteryService", () => {
  it("gains XP on weapon attacks and raises mastery level", () => {
    const { profile, run } = freshRun("gain");
    WeaponService.grantWeapon(run, "steel_cutlass", { autoEquip: true, skipDisposition: true });

    expect(WeaponMasteryService.getLevel(run.player, "SWORD")).toBe(0);

    WeaponMasteryService.recordCombatAction(profile, run, { type: "ATTACK" });
    expect(WeaponMasteryService.getXp(run.player, "SWORD")).toBe(1);
    expect(WeaponMasteryService.getLevel(run.player, "SWORD")).toBe(1);

    WeaponMasteryService.recordCombatAction(profile, run, { type: "ATTACK" });
    WeaponMasteryService.recordCombatAction(profile, run, { type: "ATTACK" });
    expect(WeaponMasteryService.getXp(run.player, "SWORD")).toBe(3);
    expect(WeaponMasteryService.getLevel(run.player, "SWORD")).toBe(2);
  });

  it("trains UNARMED when fighting with no weapons", () => {
    const { profile, run } = freshRun("unarmed");
    WeaponMasteryService.recordCombatAction(profile, run, { type: "ATTACK" });
    expect(WeaponMasteryService.getXp(run.player, "UNARMED")).toBe(1);
    expect(WeaponMasteryService.getLevel(run.player, "UNARMED")).toBe(1);
  });

  it("unlocks solo techniques at mastery level thresholds", () => {
    const { run } = freshRun("solo");
    WeaponService.grantWeapon(run, "steel_cutlass", { autoEquip: true, skipDisposition: true });

    // Level 1 unlocks at 1 XP
    WeaponMasteryService.addXp(run, "SWORD", 1);
    const line1 = WeaponMasteryService.applyUnlocks(run);
    expect(line1).toMatch(/Edge Sense/);
    expect(run.player.unlockedMasteryTechniques).toContain("mstry_sword_edge_sense");

    // Level 3 unlocks at 5 XP cumulative (thresholds: 0,1,3,5 → level 3)
    WeaponMasteryService.addXp(run, "SWORD", 4);
    expect(WeaponMasteryService.getLevel(run.player, "SWORD")).toBe(3);
    const line3 = WeaponMasteryService.applyUnlocks(run);
    expect(line3).toMatch(/Flowing Cut/);
    expect(run.player.unlockedMasteryTechniques).toContain("mstry_sword_flowing_cut");

    const ids = getAbilitiesForPlayer(run.player).map((a) => a.id);
    expect(ids).toContain("mstry_sword_edge_sense");
    expect(ids).toContain("mstry_sword_flowing_cut");
  });

  it("gates combo unlocks until both tracks reach the combo level", () => {
    const { run } = freshRun("combo");
    const fruitId = "bara_bara";
    const entry = run.world.devilFruits.find((f) => f.fruitId === fruitId)!;
    entry.status = "UNCLAIMED";
    DevilFruitService.eat(run, fruitId);
    WeaponService.grantWeapon(run, "steel_cutlass", { autoEquip: true, skipDisposition: true });

    // Raise sword to combo level, fruit still low
    while (WeaponMasteryService.getLevel(run.player, "SWORD") < MASTERY_COMBO_LEVEL) {
      WeaponMasteryService.addXp(run, "SWORD", 1);
    }
    expect(WeaponMasteryService.applyUnlocks(run)).not.toMatch(/Scattered Blade|Fruit-Edge|Warped Edge/);
    expect(run.player.unlockedMasteryTechniques ?? []).not.toContain("mstry_combo_df_sword");

    while (WeaponMasteryService.getLevel(run.player, "DEVIL_FRUIT") < MASTERY_COMBO_LEVEL) {
      WeaponMasteryService.addXp(run, "DEVIL_FRUIT", 1);
    }
    const line = WeaponMasteryService.applyUnlocks(run);
    expect(line).toMatch(/Scattered Blade/);
    expect(run.player.unlockedMasteryTechniques).toContain("mstry_combo_df_sword");

    const ids = getAbilitiesForPlayer(run.player).map((a) => a.id);
    expect(ids).toContain("mstry_combo_df_sword");
    const ability = getAbilitiesForPlayer(run.player).find((a) => a.id === "mstry_combo_df_sword");
    expect(ability?.name).toBe("Scattered Blade");
  });

  it("unlocks sword+gun hybrid when both masteries reach the gate", () => {
    const { run } = freshRun("gunblade");
    while (WeaponMasteryService.getLevel(run.player, "SWORD") < MASTERY_COMBO_LEVEL) {
      WeaponMasteryService.addXp(run, "SWORD", 1);
    }
    while (WeaponMasteryService.getLevel(run.player, "GUN") < MASTERY_COMBO_LEVEL) {
      WeaponMasteryService.addXp(run, "GUN", 1);
    }
    const line = WeaponMasteryService.applyUnlocks(run);
    expect(line).toMatch(/Gunblade Flourish/);
    expect(run.player.unlockedMasteryTechniques).toContain("mstry_combo_sword_gun");
  });
});
