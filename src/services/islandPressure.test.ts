import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { AfflictionService } from "./AfflictionService";
import { IslandPressureService } from "./IslandPressureService";
import { categorizeItem, ItemService } from "./ItemService";
import { VoyageService } from "./VoyageService";
import type { RunState } from "../models/types";

function freshRun(seed = "pressure-test"): RunState {
  const profile = createEmptyProfile("pressure", "NORMAL");
  const run = createRunState(profile, {
    name: "Pressure Tester",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  return run;
}

describe("Island pressure & prosperity", () => {
  it("escalates pressure from time ashore and bounty, not a fixed day boss", () => {
    const run = freshRun();
    run.player.bounty = 80_000;
    const island = IslandPressureService.ensureCurrent(run)!;
    const before = island.pressureLevel ?? 0;
    IslandPressureService.tickAshore(run, 4);
    expect(island.pressureLevel ?? 0).toBeGreaterThan(before);
    IslandPressureService.onHostileAction(run, 20);
    expect(island.pressureLevel ?? 0).toBeGreaterThanOrEqual(30);
  });

  it("funds civilian projects and raises trust/development", () => {
    const run = freshRun();
    run.player.berries = 500;
    const island = IslandPressureService.ensureCurrent(run)!;
    const msg = IslandPressureService.fundProject(run, "clinic_wing");
    expect(msg).toMatch(/clinic wing/i);
    expect(island.fundedProjects).toContain("clinic_wing");
    expect(island.trustLevel ?? 0).toBeGreaterThan(0);
    expect(island.developmentLevel ?? 0).toBeGreaterThan(0);
  });

  it("lists destinations with distance, ETA, and facilities", () => {
    const run = freshRun();
    const destinations = VoyageService.listDestinations(run);
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations[0]!.distance).toBeGreaterThan(0);
    expect(destinations[0]!.etaSlots).toBeGreaterThan(0);
    expect(Array.isArray(destinations[0]!.facilities)).toBe(true);
  });
});

describe("Medicine clears afflictions", () => {
  it("clears sickness with basic medicine via useOnTarget", () => {
    const profile = createEmptyProfile("med_clear", "NORMAL");
    profile.activeRun = freshRun("med-clear");
    const run = profile.activeRun!;
    AfflictionService.apply(run, "player", "SICKNESS", { days: 3 });
    ItemService.grant(run, "medicine", 1, profile);
    const result = ItemService.useOnTarget(run, "medicine", "player", "OUT_OF_COMBAT");
    expect(result.ok).toBe(true);
    expect(AfflictionService.isAfflicted(run, "player")).toBe(false);
  });

  it("categorizes smoke bombs as TOOLS", () => {
    expect(
      categorizeItem({
        id: "x",
        itemId: "smoke_bomb",
        name: "Smoke Bomb",
        type: "CONSUMABLE",
        description: "escape",
        category: "TOOLS",
      }),
    ).toBe("TOOLS");
  });
});
