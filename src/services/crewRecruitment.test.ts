import { describe, expect, it } from "vitest";
import { FLEET_UNLOCK_BOUNTY } from "../game/constants";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { RunState } from "../models/types";
import { CharacterService } from "./CharacterService";
import { CrewService } from "./CrewService";
import { FleetService } from "./FleetService";
import { RecruitmentModelService } from "./RecruitmentModelService";
import { WorldService } from "./WorldService";

function freshRun(): RunState {
  const profile = createEmptyProfile("crew_recruit_test", "NORMAL");
  return createRunState(profile, {
    name: "Captain Test",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

function makeNpc(run: RunState, id: string, name: string) {
  return CharacterService.getOrCreateCharacter(run, {
    id,
    name,
    faction: "PIRATE",
    strength: 5,
    tags: ["crew_candidate"],
    crewRole: "FIGHTER",
    joinInterest: 100,
    relationshipWithPlayer: 5,
  });
}

function fillCoreCrew(run: RunState, count: number) {
  for (let index = 0; index < count; index += 1) {
    const npc = makeNpc(run, `npc_fill_${index}`, `Fill ${index}`);
    const result = CrewService.resolveRecruitment(run, npc.id, "FIGHTER", "ALLY");
    expect(result.kind).toBe("JOINED_CORE");
  }
}

describe("CrewService recruitment", () => {
  it("lets a new character join when core has room", () => {
    const run = freshRun();
    const npc = makeNpc(run, "npc_new_joiner", "Nova");
    const result = CrewService.resolveRecruitment(run, npc.id, "FIGHTER", "ALLY");
    expect(result.kind).toBe("JOINED_CORE");
    expect(CrewService.isCharacterAlreadyInCrew(run, npc.id)).toBe(true);
    expect(run.crew.filter((entry) => entry.characterId === npc.id)).toHaveLength(1);
  });

  it("does not duplicate an existing crew member", () => {
    const run = freshRun();
    const npc = makeNpc(run, "npc_already", "Already");
    CrewService.resolveRecruitment(run, npc.id, "FIGHTER", "ALLY");
    const again = CrewService.resolveRecruitment(run, npc.id, "FIGHTER", "ALLY");
    expect(again.kind).toBe("ALREADY_CREW");
    expect(again.message.toLowerCase()).toMatch(/already/);
    expect(run.crew.filter((entry) => entry.characterId === npc.id)).toHaveLength(1);
  });

  it("treats recovering crew as already on the team", () => {
    const run = freshRun();
    const npc = makeNpc(run, "npc_hurt", "Hurt");
    CrewService.resolveRecruitment(run, npc.id, "FIGHTER", "ALLY");
    const member = run.crew.find((entry) => entry.characterId === npc.id)!;
    member.status = "Injured";
    member.currentAssignment = {
      characterId: npc.id,
      type: "RECOVERING",
      label: "Recovering",
      startDay: run.day,
      startSlot: 0,
      endDay: run.day + 2,
      endSlot: 0,
    };
    expect(CrewService.isCharacterAlreadyInCrew(run, npc.id)).toBe(true);
    expect(CrewService.canOfferRecruitment(run, npc.id)).toBe(false);
    const again = CrewService.resolveRecruitment(run, npc.id);
    expect(again.kind).toBe("ALREADY_CREW");
  });

  it("blocks fleet when core is full and bounty is too low", () => {
    const run = freshRun();
    run.player.bounty = Math.max(0, FLEET_UNLOCK_BOUNTY - 1);
    fillCoreCrew(run, 9);
    expect(CrewService.isCoreFull(run)).toBe(true);
    expect(CrewService.isFleetUnlocked(run)).toBe(false);

    const overflow = makeNpc(run, "npc_overflow_low", "Overflow Low");
    const result = CrewService.resolveRecruitment(run, overflow.id);
    expect(result.kind).toBe("BLOCKED_FLEET_BOUNTY");
    expect(result.message.toLowerCase()).toMatch(/infamous|bounty|fleet/);
    expect(run.fleet ?? []).toHaveLength(0);
    expect(CrewService.isCharacterAlreadyInCrew(run, overflow.id)).toBe(false);
  });

  it("sends overflow to fleet when bounty threshold is met", () => {
    const run = freshRun();
    run.player.bounty = FLEET_UNLOCK_BOUNTY;
    fillCoreCrew(run, 9);
    const overflow = makeNpc(run, "npc_overflow_ok", "Overflow Ok");
    const result = CrewService.resolveRecruitment(run, overflow.id);
    expect(result.kind).toBe("JOINED_FLEET");
    expect(CrewService.isCharacterInFleet(run, overflow.id)).toBe(true);
    expect(CrewService.isCharacterAlreadyInCrew(run, overflow.id)).toBe(false);
    expect(run.crew.filter((entry) => entry.characterId === overflow.id)).toHaveLength(0);
  });

  it("does not duplicate fleet captains", () => {
    const run = freshRun();
    run.player.bounty = FLEET_UNLOCK_BOUNTY;
    fillCoreCrew(run, 9);
    const overflow = makeNpc(run, "npc_fleet_once", "Fleet Once");
    CrewService.resolveRecruitment(run, overflow.id);
    const again = CrewService.resolveRecruitment(run, overflow.id);
    expect(again.kind).toBe("ALREADY_FLEET");
    expect((run.fleet ?? []).filter((entry) => entry.characterId === overflow.id)).toHaveLength(1);
  });

  it("derives fleet unlock from bounty constant", () => {
    const run = freshRun();
    run.player.bounty = FLEET_UNLOCK_BOUNTY - 10;
    expect(CrewService.isFleetUnlocked(run)).toBe(false);
    expect(CrewService.bountyNeededForFleet(run)).toBe(10);
    run.player.bounty = FLEET_UNLOCK_BOUNTY;
    expect(CrewService.isFleetUnlocked(run)).toBe(true);
    expect(CrewService.fleetUnlockSummary(run).toLowerCase()).toMatch(/available|banner/);
  });

  it("RecruitmentModelService.recruit suppresses already-on-team join text", () => {
    const run = freshRun();
    const npc = makeNpc(run, "npc_model", "Model");
    RecruitmentModelService.recruit(run, npc.id, "FIGHTER", "ALLY");
    const again = RecruitmentModelService.recruit(run, npc.id, "FIGHTER", "ALLY");
    expect(again.member).toBeNull();
    expect(again.reason?.toLowerCase()).toMatch(/already/);
    expect(again.outcome).toBe("ALREADY_CREW");
  });

  it("FleetService.offerFleetCaptain refuses core crew and duplicates", () => {
    const run = freshRun();
    const npc = makeNpc(run, "npc_core_not_fleet", "Core Not Fleet");
    CrewService.resolveRecruitment(run, npc.id);
    expect(FleetService.offerFleetCaptain(run, npc)).toBeNull();

    run.player.bounty = FLEET_UNLOCK_BOUNTY;
    fillCoreCrew(run, 8);
    const fleetNpc = makeNpc(run, "npc_fleet_dedupe", "Fleet Dedupe");
    const first = FleetService.offerFleetCaptain(run, fleetNpc);
    const second = FleetService.offerFleetCaptain(run, fleetNpc);
    expect(first?.characterId).toBe(fleetNpc.id);
    expect(second?.characterId).toBe(fleetNpc.id);
    expect((run.fleet ?? []).filter((entry) => entry.characterId === fleetNpc.id)).toHaveLength(1);
  });

  it("keeps existing crew out of the join-offer rotation", () => {
    const run = freshRun();
    const npc = makeNpc(run, "npc_jex_like", "Jex");
    npc.tags.push("known_to_player");
    CrewService.resolveRecruitment(run, npc.id, "FIGHTER", "ALLY");
    expect(CrewService.canOfferRecruitment(run, npc.id)).toBe(false);
    expect(WorldService.findRecruitableNpcByTags(run, ["known_to_player"])?.id).not.toBe(npc.id);
    expect(WorldService.findNpcByTags(run, ["known_to_player"], true)?.id).toBe(npc.id);
  });
});
