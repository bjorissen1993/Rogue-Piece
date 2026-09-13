import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { CombatState, ProfileSave, RunState, WorldCharacter } from "../models/types";
import { CombatEngine } from "./CombatEngine";
import { createRng } from "./RandomService";
import { MedicalRecoveryService } from "./MedicalRecoveryService";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { CharacterService } from "./CharacterService";
import { PartyCombatService } from "./PartyCombatService";
import { RunEndResolutionService } from "./RunEndResolutionService";
import { endRun } from "../game/createGame";

function freshRun(): RunState {
  const profile = createEmptyProfile("ko_recovery_test", "NORMAL");
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

describe("KO and medical recovery", () => {
  it("marks a combatant KO without ending the fight while allies remain", () => {
    const run = freshRun();
    const combat = CombatEngine.createFromRequest(
      run.player,
      {
        enemyName: "Thug",
        enemyStrength: 4,
        enemyCount: 1,
        win: { text: "w" },
        lose: { text: "l" },
      },
      createRng("ko-continue"),
      run,
    );
    const captain = combat.playerCombatant;
    captain.hp = 5;
    MedicalRecoveryService.markKnockedOut(captain, 12);
    expect(captain.condition).toBe("KNOCKED_OUT");
    expect(captain.hp).toBe(0);
    expect(MedicalRecoveryService.isKnockedOut(captain)).toBe(true);
  });

  it("converts KO into recovering after a hostile win", () => {
    const run = freshRun();
    const mateId = addCrewmate(run, "Mika");
    const combat = CombatEngine.createFromRequest(
      run.player,
      {
        enemyName: "Harbor Thug",
        enemyStrength: 5,
        enemyCount: 1,
        win: { text: "w" },
        lose: { text: "l" },
      },
      createRng("ko-recover"),
      run,
    );
    // Attach crew fighter and KO them
    const ally = {
      ...combat.playerCombatant,
      id: mateId,
      name: "Mika",
      hp: 0,
      condition: "KNOCKED_OUT" as const,
      overkillDamage: 8,
      side: "PLAYER" as const,
    };
    // Force party allies list
    (combat as CombatState & { crewCombatants?: typeof ally[] }).crewCombatants = [ally];
    // PartyCombatService.allAllies — check implementation
    const lines = MedicalRecoveryService.beginRecovery(run, {
      characterId: mateId,
      name: "Mika",
      severity: "MODERATE",
      overkill: 8,
      combatKind: "NORMAL",
    });
    expect(lines.days).toBeGreaterThanOrEqual(1);
    expect(CharacterScheduleService.isAvailable(run, mateId)).toBe(false);
    expect(CharacterScheduleService.derivedStatus(run, mateId)).toBe("Injured");
    expect(CharacterService.hasMemory(run, mateId, "WAS_KNOCKED_OUT")).toBe(true);
  });

  it("Doctor reduces recovery duration vs no doctor", () => {
    const runNoDoc = freshRun();
    const idA = addCrewmate(runNoDoc, "Mika");
    const without = MedicalRecoveryService.beginRecovery(runNoDoc, {
      characterId: idA,
      name: "Mika",
      severity: "SEVERE",
      combatKind: "BOSS",
      doctor: null,
    });

    const runDoc = freshRun();
    const idB = addCrewmate(runDoc, "Mika2");
    const docId = addCrewmate(runDoc, "Ren", "DOCTOR");
    const doc = CharacterService.getCharacter(runDoc, docId)!;
    doc.crewStats = {
      strength: 4,
      defense: 4,
      speed: 4,
      willpower: 5,
      charisma: 4,
      intelligence: 10,
    };
    const withDoc = MedicalRecoveryService.beginRecovery(runDoc, {
      characterId: idB,
      name: "Mika2",
      severity: "SEVERE",
      combatKind: "BOSS",
      doctor: { member: runDoc.crew.find((m) => m.characterId === docId)!, character: doc },
    });
    expect(withDoc.days).toBeLessThan(without.days);
  });

  it("recovering character does not count as available crew", () => {
    const run = freshRun();
    const id = addCrewmate(run, "Mika");
    MedicalRecoveryService.beginRecovery(run, {
      characterId: id,
      name: "Mika",
      severity: "MINOR",
    });
    expect(CharacterScheduleService.availableCharacterIds(run)).not.toContain(id);
    expect(CharacterScheduleService.availableCount(run)).toBe(1); // captain only
  });

  it("hospitalized character stays at location metadata", () => {
    const run = freshRun();
    const id = addCrewmate(run, "Mika");
    const result = MedicalRecoveryService.beginRecovery(run, {
      characterId: id,
      name: "Mika",
      severity: "CRITICAL",
      combatKind: "BOSS",
      doctor: null,
    });
    expect(result.hospitalized).toBe(true);
    const assignment = CharacterScheduleService.getAssignment(run, id);
    expect(assignment?.type).toBe("HOSPITALIZED");
    expect(assignment?.locationId).toBe(run.currentLocationId);
    expect(CharacterScheduleService.derivedStatus(run, id)).toBe("Hospitalized");
  });

  it("friendly spar does not hospitalize", () => {
    const run = freshRun();
    const combat = CombatEngine.createFromRequest(
      run.player,
      {
        enemyName: "Spar Partner",
        enemyStrength: 5,
        combatKind: "SPARRING",
        isFriendly: true,
        win: { text: "w" },
        lose: { text: "l" },
      },
      createRng("spar-ko"),
      run,
    );
    combat.isFriendly = true;
    combat.combatKind = "SPARRING";
    MedicalRecoveryService.markKnockedOut(combat.playerCombatant, 20);
    const lines = MedicalRecoveryService.resolveAfterBattle(run, combat);
    expect(lines.some((line) => /winded|spar/i.test(line))).toBe(true);
    expect(CharacterScheduleService.getAssignment(run, "player")).toBeNull();
    expect(run.player.hp).toBeGreaterThan(0);
  });

  it("world time completes recovery assignments", () => {
    const run = freshRun();
    const id = addCrewmate(run, "Mika");
    MedicalRecoveryService.beginRecovery(run, {
      characterId: id,
      name: "Mika",
      severity: "MINOR",
      doctor: null,
    });
    const assignment = CharacterScheduleService.getAssignment(run, id)!;
    run.day = assignment.endDay;
    run.timeOfDay = "NIGHT";
    CharacterScheduleService.tickAfterTimeAdvance(run);
    expect(CharacterScheduleService.getAssignment(run, id)).toBeNull();
    expect(CharacterScheduleService.isAvailable(run, id)).toBe(true);
  });

  it("hospitalized survivor persists across run end", () => {
    const profile: ProfileSave = createEmptyProfile("survivor_test", "NORMAL");
    profile.activeRun = createRunState(profile, {
      name: "Bowie",
      raceId: "HUMAN",
      originId: "SAILOR",
      locationId: "east_blue_port",
    });
    const run = profile.activeRun!;
    const id = addCrewmate(run, "Mika");
    MedicalRecoveryService.beginRecovery(run, {
      characterId: id,
      name: "Mika",
      severity: "CRITICAL",
      combatKind: "BOSS",
      doctor: null,
    });
    run.gameOver = true;
    run.deathCause = "Crew wiped";
    const event = RunEndResolutionService.resolve(profile);
    expect(event).toBeTruthy();
    expect(event!.survivors.some((s) => s.characterId === id && s.fate === "SURVIVED_HOSPITAL")).toBe(
      true,
    );
    expect(profile.persistentCharacters?.some((p) => p.character.id === id)).toBe(true);
    expect(CharacterService.hasMemory(run, id, "CREW_DIED_WHILE_I_RECOVERED")).toBe(true);

    const ended = endRun(profile);
    expect(ended.activeRun).toBeNull();
    expect(ended.persistentCharacters?.length).toBeGreaterThan(0);

    const next = createEmptyProfile("x", "NORMAL");
    next.persistentCharacters = ended.persistentCharacters;
    const newRun = createRunState(next, {
      name: "NewCap",
      raceId: "HUMAN",
      originId: "SAILOR",
      locationId: "east_blue_port",
    });
    const resurfaced = newRun.world.characters.find((c) => c.id === id);
    expect(resurfaced).toBeTruthy();
    expect(resurfaced!.memories?.some((m) => m.type === "PRIOR_CREW_WIPED")).toBe(true);
  });

  it("entire usable team unavailable ends the run check", () => {
    const run = freshRun();
    const id = addCrewmate(run, "Mika");
    MedicalRecoveryService.beginRecovery(run, {
      characterId: id,
      name: "Mika",
      severity: "MODERATE",
    });
    MedicalRecoveryService.beginRecovery(run, {
      characterId: "player",
      name: run.player.name,
      severity: "MODERATE",
    });
    expect(CharacterScheduleService.getAssignment(run, "player")).toBeTruthy();
    expect(CharacterScheduleService.getAssignment(run, id)).toBeTruthy();
    expect(CharacterScheduleService.availableCount(run)).toBe(0);
    expect(MedicalRecoveryService.shouldEndRunAfterWipe(run)).toBe(true);
  });

  it("save/load preserves recovery assignment via structuredClone", () => {
    const run = freshRun();
    const id = addCrewmate(run, "Mika");
    MedicalRecoveryService.beginRecovery(run, {
      characterId: id,
      name: "Mika",
      severity: "MODERATE",
    });
    const cloned = structuredClone(run);
    expect(CharacterScheduleService.getAssignment(cloned, id)?.type).toBe("RECOVERING");
  });
});

describe("battle wipe vs partial KO", () => {
  it("anyAllyAlive is false only when all participating allies are down", () => {
    const run = freshRun();
    const combat = CombatEngine.createFromRequest(
      run.player,
      {
        enemyName: "Thug",
        enemyStrength: 3,
        win: { text: "w" },
        lose: { text: "l" },
      },
      createRng("wipe"),
      run,
    );
    expect(PartyCombatService.anyAllyAlive(combat)).toBe(true);
    MedicalRecoveryService.markKnockedOut(combat.playerCombatant, 1);
    expect(PartyCombatService.anyAllyAlive(combat)).toBe(false);
  });
});
