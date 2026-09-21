import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { RunState } from "../models/types";
import { AfflictionService } from "./AfflictionService";
import { CharacterService } from "./CharacterService";
import { MedicalRecoveryService } from "./MedicalRecoveryService";
import { WorldService } from "./WorldService";
import { createRng } from "./RandomService";

function freshRun(): RunState {
  const profile = createEmptyProfile("affliction_test", "NORMAL");
  return createRunState(profile, {
    name: "Bowie",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

describe("AfflictionService poison / sickness", () => {
  it("applies daily DoT damage and clears after remaining days", () => {
    const run = freshRun();
    run.player.hp = 80;
    AfflictionService.apply(run, "player", "POISON", { days: 2, damagePerDay: 5 });

    expect(AfflictionService.isAfflicted(run, "player")).toBe(true);
    expect(AfflictionService.badgeTip(run, "player")).toMatch(/5 HP \/ day/);
    expect(AfflictionService.badgeTip(run, "player")).toMatch(/2 days left/);

    const day1 = AfflictionService.tickDaily(run);
    expect(run.player.hp).toBe(75);
    expect(day1.some((line) => /poisoned/i.test(line))).toBe(true);
    expect(AfflictionService.activeDot(run, "player")?.daysRemaining).toBe(1);

    AfflictionService.tickDaily(run);
    expect(run.player.hp).toBe(70);
    expect(AfflictionService.isAfflicted(run, "player")).toBe(false);
  });

  it("does not drop HP below 1 from DoT", () => {
    const run = freshRun();
    run.player.hp = 3;
    AfflictionService.apply(run, "player", "SICKNESS", { days: 1, damagePerDay: 10 });
    AfflictionService.tickDaily(run);
    expect(run.player.hp).toBe(1);
  });

  it("clears DoT when hospital / doctor recovery begins", () => {
    const run = freshRun();
    AfflictionService.apply(run, "player", "POISON", { days: 3, damagePerDay: 4 });
    MedicalRecoveryService.beginRecovery(run, {
      characterId: "player",
      name: run.player.name,
      severity: "CRITICAL",
      doctor: null,
    });
    expect(AfflictionService.isAfflicted(run, "player")).toBe(false);
  });

  it("applies sickness on untreated moderate recovery", () => {
    const run = freshRun();
    const npc = CharacterService.getOrCreateCharacter(run, {
      name: "Mika",
      faction: "PIRATE",
      strength: 6,
      crewRole: "FIGHTER",
      alive: true,
      tags: ["test_crew"],
    });
    CharacterService.acceptRecruitment(run, npc.id, "FIGHTER", "PERMANENT");

    MedicalRecoveryService.beginRecovery(run, {
      characterId: npc.id,
      name: "Mika",
      severity: "MODERATE",
      doctor: null,
    });
    expect(AfflictionService.isAfflicted(run, npc.id)).toBe(true);
    expect(AfflictionService.activeDot(run, npc.id)?.kind).toBe("SICKNESS");
  });

  it("ticks on WorldService day turn", () => {
    const run = freshRun();
    run.player.hp = 90;
    AfflictionService.apply(run, "player", "POISON", { days: 1, damagePerDay: 6 });
    WorldService.turnDay(run, createRng("affliction-day"));
    expect(run.player.hp).toBe(84);
    expect(AfflictionService.isAfflicted(run, "player")).toBe(false);
  });
});
