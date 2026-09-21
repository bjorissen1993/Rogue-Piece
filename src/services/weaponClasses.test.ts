import { describe, expect, it } from "vitest";
import { getAbilitiesForCrewmember, getAbilitiesForPlayer } from "../data/abilities";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { ProfileSave, RunState } from "../models/types";
import { CharacterService } from "./CharacterService";
import { DevilFruitCombatService } from "./DevilFruitCombatService";
import { DevilFruitService } from "./DevilFruitService";
import { createRng } from "./RandomService";
import { WeaponGenerationService } from "./WeaponGenerationService";
import { WeaponService } from "./WeaponService";

function freshRun(seed: string): { profile: ProfileSave; run: RunState } {
  const profile = createEmptyProfile(`wc_${seed}`, "NORMAL");
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

describe("weapon class gating + dual wield", () => {
  it("hides Focused Strike and sword techniques when only a rifle is equipped", () => {
    const { run } = freshRun("rifle");
    const generated = WeaponGenerationService.generate(createRng("rifle-2"), {
      archetypeId: "rifle",
      material: "STEEL",
      quality: "FINE",
    });
    WeaponService.grantGeneratedWeapon(run, generated, { autoEquip: true, skipDisposition: true });

    const ids = getAbilitiesForPlayer(run.player).map((a) => a.id);
    expect(ids).toContain("gun_shot");
    expect(ids).not.toContain("focused_strike");
    expect(ids).not.toContain("sword_slash");
  });

  it("keeps unlocked sword skills with another sword, not with a gun", () => {
    const { run } = freshRun("sword-persist");
    run.player.unlockedTechniques = ["sword_crescent", "sword_slash"];
    WeaponService.grantWeapon(run, "steel_cutlass", { autoEquip: true, skipDisposition: true });
    let ids = getAbilitiesForPlayer(run.player).map((a) => a.id);
    expect(ids).toContain("sword_crescent");
    expect(ids).toContain("focused_strike");

    const pistol = WeaponGenerationService.generate(createRng("pistol-3"), {
      archetypeId: "pistol",
      material: "STEEL",
      quality: "FINE",
    });
    WeaponService.grantGeneratedWeapon(run, pistol, { autoEquip: true, skipDisposition: true });
    ids = getAbilitiesForPlayer(run.player).map((a) => a.id);
    expect(ids).toContain("gun_shot");
    expect(ids).not.toContain("sword_crescent");
    expect(ids).not.toContain("focused_strike");
  });

  it("allows sword + pistol dual wield and unlocks Cut and Shot", () => {
    const { run } = freshRun("dual");
    WeaponService.grantWeapon(run, "steel_cutlass", { autoEquip: true, skipDisposition: true });
    const pistol = WeaponGenerationService.generate(createRng("pistol-4"), {
      archetypeId: "pistol",
      material: "STEEL",
      quality: "FINE",
    });
    const secondaryId = WeaponService.grantGeneratedWeapon(run, pistol, { skipDisposition: true });
    expect(secondaryId).toBeTruthy();
    expect(WeaponService.equipInstance(run, secondaryId!, run.player.id, "secondary")).toBe(true);
    const ids = getAbilitiesForPlayer(run.player).map((a) => a.id);
    expect(ids).toContain("sword_slash");
    expect(ids).toContain("gun_shot");
    expect(ids).toContain("sword_and_shot");
    expect(ids).toContain("focused_strike");
  });

  it("hides Focused Strike for crewmates with only a rifle", () => {
    const { run } = freshRun("crew-rifle");
    const character = CharacterService.getOrCreateCharacter(run, {
      name: "Ren",
      faction: "PIRATE",
      strength: 6,
      combatStyle: "marksmanship",
      personality: "Quiet",
      tags: ["test"],
      alive: true,
    });
    CharacterService.acceptRecruitment(run, character.id, "SNIPER", "PERMANENT");
    const rifle = WeaponGenerationService.generate(createRng("crew-rifle-wpn"), {
      archetypeId: "rifle",
      material: "STEEL",
      quality: "FINE",
    });
    const instanceId = WeaponService.grantGeneratedWeapon(run, rifle, { skipDisposition: true });
    WeaponService.assignToCrew(run, instanceId!, character.id);
    const ids = getAbilitiesForCrewmember(run, character.id).map((a) => a.id);
    expect(ids).toContain("gun_shot");
    expect(ids).not.toContain("focused_strike");
  });

  it("allows crew dual wield with 2H primary clearing secondary", () => {
    const { run } = freshRun("crew-dual");
    const character = CharacterService.getOrCreateCharacter(run, {
      name: "Kai",
      faction: "PIRATE",
      strength: 7,
      combatStyle: "swordsman",
      personality: "Bold",
      tags: ["test"],
      alive: true,
    });
    CharacterService.acceptRecruitment(run, character.id, "SWORDSMAN", "PERMANENT");

    WeaponService.grantWeapon(run, "steel_cutlass", { skipDisposition: true });
    const cutlass = run.player.inventory.find((item) => item.weaponDefinitionId === "steel_cutlass")!;
    expect(WeaponService.assignToCrew(run, cutlass.id, character.id, "primary").ok).toBe(true);

    const pistol = WeaponGenerationService.generate(createRng("crew-dual-pistol"), {
      archetypeId: "pistol",
      material: "STEEL",
      quality: "FINE",
    });
    const pistolId = WeaponService.grantGeneratedWeapon(run, pistol, { skipDisposition: true });
    expect(WeaponService.assignToCrew(run, pistolId!, character.id, "secondary").ok).toBe(true);

    const primary = WeaponService.equippedInstanceFor(run, character.id, "primary");
    const secondary = WeaponService.equippedInstanceFor(run, character.id, "secondary");
    expect(primary?.id).toBe(cutlass.id);
    expect(secondary?.id).toBe(pistolId);
    expect(primary?.equipSlot).toBe("primary");
    expect(secondary?.equipSlot).toBe("secondary");

    const ids = getAbilitiesForCrewmember(run, character.id).map((a) => a.id);
    expect(ids).toContain("sword_slash");
    expect(ids).toContain("gun_shot");
    expect(ids).toContain("sword_and_shot");

    const rifle = WeaponGenerationService.generate(createRng("crew-dual-rifle"), {
      archetypeId: "rifle",
      material: "STEEL",
      quality: "FINE",
    });
    const rifleId = WeaponService.grantGeneratedWeapon(run, rifle, { skipDisposition: true });
    expect(WeaponService.assignToCrew(run, rifleId!, character.id, "primary").ok).toBe(true);
    expect(WeaponService.equippedInstanceFor(run, character.id, "primary")?.id).toBe(rifleId);
    expect(WeaponService.equippedInstanceFor(run, character.id, "secondary")).toBeUndefined();
    const pistolAfter = WeaponService.findInstance(run.player, pistolId!);
    expect(pistolAfter?.equipped).toBe(false);
  });

  it("rejects two-hand weapons as crew secondary", () => {
    const { run } = freshRun("crew-2h-secondary");
    const character = CharacterService.getOrCreateCharacter(run, {
      name: "Mira",
      faction: "PIRATE",
      strength: 6,
      combatStyle: "swordsman",
      personality: "Calm",
      tags: ["test"],
      alive: true,
    });
    CharacterService.acceptRecruitment(run, character.id, "FIGHTER", "PERMANENT");
    WeaponService.grantWeapon(run, "steel_cutlass", { skipDisposition: true });
    const cutlass = run.player.inventory.find((item) => item.weaponDefinitionId === "steel_cutlass")!;
    WeaponService.assignToCrew(run, cutlass.id, character.id, "primary");

    const rifle = WeaponGenerationService.generate(createRng("crew-2h-rifle"), {
      archetypeId: "rifle",
      material: "STEEL",
      quality: "FINE",
    });
    const rifleId = WeaponService.grantGeneratedWeapon(run, rifle, { skipDisposition: true });
    const result = WeaponService.assignToCrew(run, rifleId!, character.id, "secondary");
    expect(result.ok).toBe(false);
    expect(WeaponService.equippedInstanceFor(run, character.id, "secondary")).toBeUndefined();
  });

  it("does not mirror a secondary into primary via weaponIds (no ghost duplicate)", () => {
    const { run } = freshRun("crew-no-ghost");
    const character = CharacterService.getOrCreateCharacter(run, {
      name: "Niko",
      faction: "PIRATE",
      strength: 6,
      combatStyle: "swordsman",
      personality: "Steady",
      tags: ["test"],
      alive: true,
      weaponIds: ["steel_cutlass"],
    });
    CharacterService.acceptRecruitment(run, character.id, "FIGHTER", "PERMANENT");

    const pistol = WeaponGenerationService.generate(createRng("crew-ghost-pistol"), {
      archetypeId: "pistol",
      material: "STEEL",
      quality: "FINE",
    });
    const pistolId = WeaponService.grantGeneratedWeapon(run, pistol, { skipDisposition: true });
    expect(WeaponService.assignToCrew(run, pistolId!, character.id, "secondary").ok).toBe(true);

    const primary = WeaponService.equippedInstanceFor(run, character.id, "primary");
    const secondary = WeaponService.equippedInstanceFor(run, character.id, "secondary");
    expect(primary).toBeUndefined();
    expect(secondary?.id).toBe(pistolId);
    expect(primary?.id).not.toBe(secondary?.id);
    expect(WeaponService.preferredCrewEquipSlot(run, character.id)).toBe("primary");
  });

  it("drop preference fills empty primary, and 2H replaces primary instead of failing secondary", () => {
    const { run } = freshRun("crew-drop-pref");
    const character = CharacterService.getOrCreateCharacter(run, {
      name: "Osa",
      faction: "PIRATE",
      strength: 7,
      combatStyle: "swordsman",
      personality: "Bold",
      tags: ["test"],
      alive: true,
    });
    CharacterService.acceptRecruitment(run, character.id, "FIGHTER", "PERMANENT");

    WeaponService.grantWeapon(run, "steel_cutlass", { skipDisposition: true });
    const cutlass = run.player.inventory.find((item) => item.weaponDefinitionId === "steel_cutlass")!;
    const cutlassView = WeaponService.resolveWeaponView(cutlass)!;
    expect(WeaponService.preferredCrewEquipSlot(run, character.id, cutlassView)).toBe("primary");
    expect(WeaponService.assignToCrew(run, cutlass.id, character.id).ok).toBe(true);

    const pistol = WeaponGenerationService.generate(createRng("crew-drop-pistol"), {
      archetypeId: "pistol",
      material: "STEEL",
      quality: "FINE",
    });
    const pistolId = WeaponService.grantGeneratedWeapon(run, pistol, { skipDisposition: true });
    const pistolView = WeaponService.resolveWeaponView(WeaponService.findInstance(run.player, pistolId!)!)!;
    expect(WeaponService.preferredCrewEquipSlot(run, character.id, pistolView)).toBe("secondary");

    const rifle = WeaponGenerationService.generate(createRng("crew-drop-rifle"), {
      archetypeId: "rifle",
      material: "STEEL",
      quality: "FINE",
    });
    const rifleId = WeaponService.grantGeneratedWeapon(run, rifle, { skipDisposition: true });
    const rifleView = WeaponService.resolveWeaponView(WeaponService.findInstance(run.player, rifleId!)!)!;
    expect(WeaponService.preferredCrewEquipSlot(run, character.id, rifleView)).toBe("primary");

    const slot = WeaponService.preferredCrewEquipSlot(run, character.id, rifleView);
    expect(WeaponService.assignToCrew(run, rifleId!, character.id, slot).ok).toBe(true);
    expect(WeaponService.equippedInstanceFor(run, character.id, "primary")?.id).toBe(rifleId);
    expect(WeaponService.equippedInstanceFor(run, character.id, "secondary")).toBeUndefined();
  });

  it("reassigning a weapon between crewmates clears the previous owner's loadout", () => {
    const { run } = freshRun("crew-reassign");
    const a = CharacterService.getOrCreateCharacter(run, {
      name: "Ada",
      faction: "PIRATE",
      strength: 6,
      combatStyle: "swordsman",
      personality: "Calm",
      tags: ["test"],
      alive: true,
    });
    const b = CharacterService.getOrCreateCharacter(run, {
      name: "Bea",
      faction: "PIRATE",
      strength: 6,
      combatStyle: "swordsman",
      personality: "Bold",
      tags: ["test"],
      alive: true,
    });
    CharacterService.acceptRecruitment(run, a.id, "FIGHTER", "PERMANENT");
    CharacterService.acceptRecruitment(run, b.id, "FIGHTER", "PERMANENT");

    WeaponService.grantWeapon(run, "steel_cutlass", { skipDisposition: true });
    const cutlass = run.player.inventory.find((item) => item.weaponDefinitionId === "steel_cutlass")!;
    expect(WeaponService.assignToCrew(run, cutlass.id, a.id, "primary").ok).toBe(true);
    expect(WeaponService.assignToCrew(run, cutlass.id, b.id, "primary").ok).toBe(true);

    expect(WeaponService.equippedInstanceFor(run, a.id, "primary")).toBeUndefined();
    expect(WeaponService.equippedInstanceFor(run, b.id, "primary")?.id).toBe(cutlass.id);
    expect(a.weaponIds ?? []).not.toContain("steel_cutlass");
    expect(b.weaponIds).toContain("steel_cutlass");
  });

  it("hides Focused Strike when crew only has weaponIds catalog loadout (no inventory link)", () => {
    const { run } = freshRun("crew-weaponids");
    const character = CharacterService.getOrCreateCharacter(run, {
      name: "Ren",
      faction: "PIRATE",
      strength: 6,
      combatStyle: "marksmanship",
      personality: "Quiet",
      tags: ["test"],
      alive: true,
      weaponIds: ["flintlock_pistol"],
    });
    CharacterService.acceptRecruitment(run, character.id, "SNIPER", "PERMANENT");
    const ids = getAbilitiesForCrewmember(run, character.id).map((a) => a.id);
    expect(ids).toContain("gun_shot");
    expect(ids).not.toContain("focused_strike");
  });
});

describe("devil fruit combat + zoan forms", () => {
  it("grants starter DF skills and unlocks more by use", () => {
    const { profile, run } = freshRun("df");
    const fruitId = "bara_bara";
    const entry = run.world.devilFruits.find((f) => f.fruitId === fruitId)!;
    entry.status = "UNCLAIMED";
    DevilFruitService.eat(run, fruitId);

    const starters = DevilFruitCombatService.abilitiesForPlayer(run.player).map((a) => a.id);
    expect(starters).toContain("df_bara_split");
    expect(starters).not.toContain("df_bara_cannon");

    for (let i = 0; i < 3; i++) {
      DevilFruitCombatService.recordTechniqueUse(profile, run, "df_bara_split");
    }
    const after = DevilFruitCombatService.abilitiesForPlayer(run.player).map((a) => a.id);
    expect(after).toContain("df_bara_cannon");
  });

  it("applies different zoan form stat profiles", () => {
    const { run } = freshRun("zoan");
    const fruitId = "inu_wolf";
    const entry = run.world.devilFruits.find((f) => f.fruitId === fruitId)!;
    entry.status = "UNCLAIMED";
    DevilFruitService.eat(run, fruitId);
    const humanStr = DevilFruitCombatService.effectiveStats(run.player).strength;
    DevilFruitCombatService.setForm(run, "HYBRID");
    const hybridStr = DevilFruitCombatService.effectiveStats(run.player).strength;
    DevilFruitCombatService.setForm(run, "FULL_BEAST");
    const beastSpd = DevilFruitCombatService.effectiveStats(run.player).speed;
    DevilFruitCombatService.setForm(run, "HYBRID");
    const hybridSpd = DevilFruitCombatService.effectiveStats(run.player).speed;
    expect(hybridStr).toBeGreaterThan(humanStr);
    expect(beastSpd).toBeGreaterThan(hybridSpd);
  });
});
