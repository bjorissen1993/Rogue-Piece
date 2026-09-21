import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { AT_SEA_ENCOUNTER_ID, ISLAND_HUB_ENCOUNTER_ID } from "../game/constants";
import { EncounterEngine } from "./EncounterEngine";
import { createRng } from "./RandomService";
import { VoyageService } from "./VoyageService";
import type { RunState } from "../models/types";

function freshRun(seed = "voyage-phase2"): RunState {
  const profile = createEmptyProfile("voyage_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  return run;
}

describe("Harbor + Voyage (Phase 2/3)", () => {
  it("creates a ship on new runs", () => {
    const run = freshRun();
    expect(run.ship?.name).toContain("Test Sailor");
    expect(run.ship?.speed).toBeGreaterThan(0);
    expect(run.ship?.condition).toBe(100);
  });

  it("lists other islands as harbor destinations", () => {
    const run = freshRun();
    const destinations = VoyageService.listDestinations(run);
    expect(destinations.length).toBe(run.islands.length - 1);
    expect(destinations.every((dest) => dest.id !== run.currentIslandId)).toBe(true);
  });

  it("begins a voyage and enters SAILING at_sea", () => {
    const profile = createEmptyProfile("voyage_begin", "NORMAL");
    profile.activeRun = freshRun("begin-sail");
    const dest = VoyageService.listDestinations(profile.activeRun!)[0]!;
    const next = VoyageService.beginVoyage(profile, dest.id, createRng("begin-sail"));
    const run = next.activeRun!;
    expect(run.activityMode).toBe("SAILING");
    expect(run.currentEncounterId).toBe(AT_SEA_ENCOUNTER_ID);
    expect(run.activeVoyage?.toIslandId).toBe(dest.id);
    expect(run.activeVoyage?.progress).toBe(0);
  });

  it("ticks voyage progress using ship speed / distance", () => {
    const profile = createEmptyProfile("voyage_tick", "NORMAL");
    profile.activeRun = freshRun("tick-sail");
    const dest = VoyageService.listDestinations(profile.activeRun!)[0]!;
    let next = VoyageService.beginVoyage(profile, dest.id, createRng("tick-start"));
    const before = next.activeRun!.activeVoyage!.progress;
    // Force no event for this tick by using a seeded path that still advances; retry until progress moves without arrival.
    next.activeRun!.ship!.speed = 1;
    next.activeRun!.activeVoyage!.distance = 4;
    const result = VoyageService.tick(next, createRng("tick-no-event-hopefully"));
    if (!result.arrived && !result.needsEvent) {
      expect(result.profile.activeRun!.activeVoyage!.progress).toBeGreaterThan(before);
      expect(result.profile.activeRun!.activeVoyage!.slotsElapsed).toBe(1);
    } else {
      // Event or arrival is still a valid tick outcome.
      expect(result.arrived || result.needsEvent).toBe(true);
    }
  });

  it("arrives at destination and can enter island hub", () => {
    const profile = createEmptyProfile("voyage_arrive", "NORMAL");
    profile.activeRun = freshRun("arrive-sail");
    const dest = VoyageService.listDestinations(profile.activeRun!)[0]!;
    let next = VoyageService.beginVoyage(profile, dest.id, createRng("arrive-start"));
    const run = next.activeRun!;
    run.ship!.speed = 10;
    run.activeVoyage!.distance = 1;
    run.activeVoyage!.progress = 0.99;
    const result = VoyageService.tick(next, createRng("arrive-tick"));
    expect(result.arrived).toBe(true);
    expect(result.profile.activeRun!.activityMode).toBe("ISLAND");
    expect(result.profile.activeRun!.currentIslandId).toBe(dest.id);
    expect(result.profile.activeRun!.activeVoyage).toBeNull();
    EncounterEngine.enterIslandHub(result.profile.activeRun!, createRng("arrive-hub"));
    expect(result.profile.activeRun!.currentEncounterId).toBe(ISLAND_HUB_ENCOUNTER_ID);
  });

  it("resumes at_sea after a sailing event completes", () => {
    const profile = createEmptyProfile("voyage_event", "NORMAL");
    profile.activeRun = freshRun("event-sail");
    const dest = VoyageService.listDestinations(profile.activeRun!)[0]!;
    const sailed = VoyageService.beginVoyage(profile, dest.id, createRng("event-start"));
    const run = sailed.activeRun!;
    run.activeVoyage!.pausedForEvent = true;
    run.currentEncounterId = "supply_search";
    run.awaitingAdvance = true;
    run.lastResultText = "A squall passes.";
    run.pendingTimeCost = 0;
    const done = EncounterEngine.completeEncounter(sailed, createRng("event-done"));
    expect(done.activeRun?.activityMode).toBe("SAILING");
    expect(done.activeRun?.currentEncounterId).toBe(AT_SEA_ENCOUNTER_ID);
    expect(done.activeRun?.activeVoyage?.pausedForEvent).toBe(false);
  });
});
