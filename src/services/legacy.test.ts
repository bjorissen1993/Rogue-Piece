import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState, endRun, startRun } from "../game/createGame";
import type { ProfileSave } from "../models/types";
import { CharacterService } from "./CharacterService";
import { LegacyService } from "./LegacyService";
import { createRng } from "./RandomService";

function profileWithCrew(): ProfileSave {
  const profile = createEmptyProfile("legacy_test", "NORMAL");
  profile.activeRun = createRunState(profile, {
    name: "Bowie",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  const run = profile.activeRun!;
  const mika = CharacterService.getOrCreateCharacter(run, {
    name: "Mika of the Coast",
    faction: "PIRATE",
    strength: 7,
    combatStyle: "swordsmanship",
    personality: "Patient and honorable",
    tags: ["test"],
    alive: true,
  });
  CharacterService.acceptRecruitment(run, mika.id, "FIGHTER", "PERMANENT");
  return profile;
}

describe("LegacySystem", () => {
  it("promotes core crew to Legacy and survives run reset", () => {
    const profile = profileWithCrew();
    const mikaId = profile.activeRun!.crew[0]!.characterId;
    profile.activeRun!.gameOver = true;
    profile.activeRun!.deathCause = "Test wipe";
    const ended = endRun(profile);
    expect(ended.activeRun).toBeNull();
    const legacy = LegacyService.ensure(ended);
    expect(legacy.characters.some((c) => c.characterId === mikaId && c.tier === "LEGACY")).toBe(
      true,
    );

    const next = startRun(ended, {
      name: "NewCap",
      raceId: "HUMAN",
      originId: "SAILOR",
      locationId: "east_blue_port",
    });
    expect(next.legacy?.characters.some((c) => c.characterId === mikaId)).toBe(true);
    expect(next.activeRun!.world.characters.some((c) => c.id === mikaId)).toBe(true);
    // New protagonist does not inherit personal relationship
    const injected = next.activeRun!.world.characters.find((c) => c.id === mikaId)!;
    expect(injected.relationshipWithPlayer).toBe(0);
  });

  it("advances world time across years and ages characters", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const mikaId = profile.activeRun!.crew[0]!.characterId;
    const before = LegacyService.ageOf(profile, mikaId)!;
    LegacyService.advanceYears(profile, 10, createRng("age10"));
    const after = LegacyService.ageOf(profile, mikaId)!;
    expect(after).toBe(before + 10);
    expect(profile.legacy!.timeline.totalDays).toBeGreaterThanOrEqual(10 * 360);
  });

  it("generates a child that references parent and is not a clone", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const parentId = profile.activeRun!.crew[0]!.characterId;
    const parent = LegacyService.getCharacter(profile, parentId)!;
    parent.birthYear = profile.legacy!.timeline.year - 35;
    const child = LegacyService.generateChild(profile, parentId, createRng("child1"));
    expect(child).toBeTruthy();
    expect(child!.parentIds).toContain(parentId);
    expect(child!.character.name).not.toBe(parent.character.name);
    expect(child!.character.memories?.some((m) => m.type === "IS_DESCENDANT_OF")).toBe(true);
    expect(parent.childIds).toContain(child!.characterId);
    const family = LegacyService.familyTree(profile, child!.characterId);
    expect(family?.memberIds).toContain(parentId);
    expect(family?.memberIds).toContain(child!.characterId);
  });

  it("apprentice lineage chains mentor → student", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const mentorId = profile.activeRun!.crew[0]!.characterId;
    const apprentice = LegacyService.generateApprentice(profile, mentorId, createRng("ap1"));
    expect(apprentice).toBeTruthy();
    expect(apprentice!.mentorId).toBe(mentorId);
    const chain = LegacyService.mentorChain(profile, apprentice!.characterId);
    expect(chain?.chain[0]).toBe(mentorId);
    expect(chain?.chain).toContain(apprentice!.characterId);
    expect(apprentice!.character.memories?.some((m) => m.type === "TRAINED_BY_MASTER")).toBe(true);
  });

  it("dead Legacy history persists", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const id = profile.activeRun!.crew[0]!.characterId;
    LegacyService.killCharacter(profile, id, "Test death");
    const record = LegacyService.getCharacter(profile, id)!;
    expect(record.status).toBe("DEAD");
    expect(LegacyService.eventsForCharacter(profile, id).some((e) => e.eventType === "DEATH")).toBe(
      true,
    );
    const ended = endRun(profile);
    expect(ended.legacy?.characters.find((c) => c.characterId === id)?.status).toBe("DEAD");
  });

  it("legacy dialogue hints use historical events", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const id = profile.activeRun!.crew[0]!.characterId;
    const hints = LegacyService.dialogueHints(profile, id);
    expect(hints.some((h) => /sailed under Bowie/i.test(h))).toBe(true);
  });

  it("fighting style lineage persists", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const id = profile.activeRun!.crew[0]!.characterId;
    const lineages = profile.legacy!.styleLineages;
    expect(lineages.some((s) => s.practitionerIds.includes(id))).toBe(true);
  });

  it("save/load shaped profile keeps legacy via ensure", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const clone = structuredClone(profile);
    LegacyService.ensure(clone);
    expect(clone.legacy?.characters.length).toBeGreaterThan(0);
  });

  it("migrates persistentCharacters into legacy without inventing events", () => {
    const profile = createEmptyProfile("mig", "NORMAL");
    profile.persistentCharacters = [
      {
        character: {
          id: "npc_old",
          name: "Old Sailor",
          faction: "CIVILIAN",
          strength: 5,
          bounty: 0,
          devilFruitId: null,
          alive: true,
          relationshipWithPlayer: 0,
          tags: [],
          memories: [{ type: "PRIOR_CREW_WIPED", day: 1, importance: 5 }],
        },
        survivalStatus: "ALIVE",
        updatedAt: new Date().toISOString(),
      },
    ];
    LegacyService.ensure(profile);
    expect(profile.legacy!.characters.some((c) => c.characterId === "npc_old")).toBe(true);
  });

  it("background tier is not required for core crew (they become LEGACY)", () => {
    const profile = profileWithCrew();
    LegacyService.harvestRunEnd(profile);
    const rec = profile.legacy!.characters.find(
      (c) => c.characterId === profile.activeRun!.crew[0]!.characterId,
    );
    expect(rec?.tier).toBe("LEGACY");
  });
});
