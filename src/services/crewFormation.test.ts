import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { RunState, WorldCharacter } from "../models/types";
import { CharacterService } from "./CharacterService";
import { CrewCombatService } from "./CrewCombatService";
import { MedicalRecoveryService } from "./MedicalRecoveryService";
import { BATTLE_ROW_SLOTS, CORE_CREW_CAP } from "../game/constants";

function freshRun(): RunState {
  const profile = createEmptyProfile("formation_test", "NORMAL");
  return createRunState(profile, {
    name: "Bowie",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

function addCrewmate(run: RunState, name: string, role: WorldCharacter["crewRole"] = "FIGHTER"): string {
  const npc = CharacterService.getOrCreateCharacter(run, {
    name,
    faction: "PIRATE",
    strength: 6,
    crewRole: role,
    alive: true,
    tags: ["test_crew"],
  });
  CharacterService.acceptRecruitment(run, npc.id, role ?? "FIGHTER", "PERMANENT");
  return npc.id;
}

function hospitalize(run: RunState, characterId: string, name: string): void {
  MedicalRecoveryService.beginRecovery(run, {
    characterId,
    name,
    severity: "CRITICAL",
    combatKind: "BOSS",
    doctor: null,
  });
}

describe("crew formation packing", () => {
  it("packs initial roster into the battle row with unavailable after available", () => {
    const run = freshRun();
    const mika = addCrewmate(run, "Mika");
    const ren = addCrewmate(run, "Ren");
    hospitalize(run, mika, "Mika");
    hospitalize(run, ren, "Ren");

    // Force rebuild as if migrating an old save without formation slots.
    delete run.activeParty!.formationSlots;
    const slots = CrewCombatService.ensurePartyConfig(run).formationSlots!;
    expect(slots[0]).toBe(run.player.id);
    expect(slots.slice(1, 3).sort()).toEqual([mika, ren].sort());
    expect(slots.slice(0, BATTLE_ROW_SLOTS).filter(Boolean)).toHaveLength(3);
  });

  it("does not drag unavailable crewmates along when the leader moves", () => {
    const run = freshRun();
    const mika = addCrewmate(run, "Mika");
    hospitalize(run, mika, "Mika");
    delete run.activeParty!.formationSlots;
    CrewCombatService.ensurePartyConfig(run);

    const before = CrewCombatService.getFormationSlots(run);
    const mikaIndex = before.indexOf(mika);
    expect(mikaIndex).toBe(1);

    // Move captain from battle slot 0 to bench slot 5 — Mika must stay put.
    expect(CrewCombatService.moveFormationMember(run, 0, 5)).toBe(true);
    const after = CrewCombatService.getFormationSlots(run);
    expect(after[5]).toBe(run.player.id);
    expect(after[mikaIndex]).toBe(mika);
    expect(after[0]).toBeNull();
  });

  it("lets any crewmate swap into an open battle slot", () => {
    const run = freshRun();
    const mika = addCrewmate(run, "Mika");
    hospitalize(run, mika, "Mika");
    delete run.activeParty!.formationSlots;
    CrewCombatService.ensurePartyConfig(run);

    expect(CrewCombatService.moveFormationMember(run, 1, 3)).toBe(true);
    const slots = CrewCombatService.getFormationSlots(run);
    expect(slots[3]).toBe(mika);
    expect(slots[1]).toBeNull();
    expect(slots[0]).toBe(run.player.id);
  });

  it("repairs an empty battle row left by the old follow-leader bug", () => {
    const run = freshRun();
    const mika = addCrewmate(run, "Mika");
    hospitalize(run, mika, "Mika");
    const config = CrewCombatService.ensurePartyConfig(run);
    config.formationSlots = Array.from({ length: CORE_CREW_CAP }, () => null);
    config.formationSlots[5] = run.player.id;
    config.formationSlots[6] = mika;

    const slots = CrewCombatService.ensurePartyConfig(run).formationSlots!;
    expect(slots[0]).toBe(run.player.id);
    expect(slots[1]).toBe(mika);
    expect(slots.slice(0, BATTLE_ROW_SLOTS).every((id) => !id)).toBe(false);
  });

  it("inserts a new available recruit between the captain and unavailable park", () => {
    const run = freshRun();
    const mika = addCrewmate(run, "Mika");
    hospitalize(run, mika, "Mika");
    delete run.activeParty!.formationSlots;
    CrewCombatService.ensurePartyConfig(run);

    const nova = addCrewmate(run, "Nova");
    const slots = CrewCombatService.ensurePartyConfig(run).formationSlots!;
    expect(slots[0]).toBe(run.player.id);
    expect(slots[1]).toBe(nova);
    expect(slots[2]).toBe(mika);
  });
});
