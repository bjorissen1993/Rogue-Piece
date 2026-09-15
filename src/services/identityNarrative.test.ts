import { describe, expect, it } from "vitest";
import { createPlayer, createRunState, createEmptyProfile } from "../game/createGame";
import { IdentityService } from "../services/IdentityService";
import { AffiliationService } from "../services/AffiliationService";
import { RecruitmentModelService } from "../services/RecruitmentModelService";
import { CharacterService } from "../services/CharacterService";
import { StoryThreadService } from "../services/StoryThreadService";
import { EncounterHistoryService } from "../services/EncounterHistoryService";
import type { Encounter, RunState } from "../models/types";

function freshRun(): RunState {
  const profile = createEmptyProfile("test_profile", "NORMAL");
  return createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

describe("IdentityService", () => {
  it("starts as Civilian / Wanderer / Lawful", () => {
    const run = freshRun();
    const identity = IdentityService.ensure(run);
    expect(identity.factionId).toBe("CIVILIAN");
    expect(identity.roleId).toBe("WANDERER");
    expect(identity.legalStatusId).toBe("LAWFUL");
  });

  it("Civilian → Bounty Hunter keeps Civilian faction", () => {
    const run = freshRun();
    IdentityService.setRole(run, "BOUNTY_HUNTER", "hunter_unknown");
    const identity = IdentityService.get(run);
    expect(identity.factionId).toBe("CIVILIAN");
    expect(identity.roleId).toBe("BOUNTY_HUNTER");
    expect(AffiliationService.isPlayerBountyHunter(run)).toBe(true);
  });

  it("BH → Wanted still Civilian", () => {
    const run = freshRun();
    IdentityService.setRole(run, "BOUNTY_HUNTER", "hunter_unknown");
    run.player.bounty = 5000;
    IdentityService.syncLegalFromBounty(run);
    const identity = IdentityService.get(run);
    expect(identity.factionId).toBe("CIVILIAN");
    expect(identity.roleId).toBe("BOUNTY_HUNTER");
    expect(identity.legalStatusId).toBe("WANTED");
  });

  it("BH can join Marines (faction change via join)", () => {
    const run = freshRun();
    IdentityService.setRole(run, "BOUNTY_HUNTER", "hunter_unknown");
    AffiliationService.join(run, { factionId: "MARINES", note: "test" });
    const identity = IdentityService.get(run);
    expect(identity.factionId).toBe("MARINES");
    expect(identity.roleId).toBe("MARINE_RECRUIT");
  });

  it("joining Marines clears Wanted legal status with the bounty", () => {
    const run = freshRun();
    run.player.bounty = 12_000;
    IdentityService.syncLegalFromBounty(run);
    expect(IdentityService.get(run).legalStatusId).toBe("WANTED");
    AffiliationService.join(run, { factionId: "MARINES", note: "enlist" });
    expect(run.player.bounty).toBe(0);
    expect(IdentityService.get(run).legalStatusId).toBe("LAWFUL");
  });

  it("active Marine ensure clears leftover Wanted even with bounty already 0", () => {
    const run = freshRun();
    AffiliationService.join(run, { factionId: "MARINES", note: "enlist" });
    IdentityService.setLegalStatus(run, "WANTED", "stale warrant");
    run.player.bounty = 0;
    AffiliationService.ensure(run);
    expect(IdentityService.get(run).legalStatusId).toBe("LAWFUL");
  });

  it("bounty alone does not make you a pirate", () => {
    const run = freshRun();
    IdentityService.setRole(run, "BOUNTY_HUNTER", "hunter_unknown");
    run.player.bounty = 100_000;
    IdentityService.syncLegalFromBounty(run);
    IdentityService.applyTendencyChanges(run, { criminality: 10 });
    const identity = IdentityService.get(run);
    expect(identity.factionId).toBe("CIVILIAN");
    expect(AffiliationService.isPlayerPirate(run)).toBe(false);
  });

  it("migrates legacy BOUNTY_HUNTER affiliation", () => {
    const run = freshRun();
    run.player.identity = undefined;
    run.player.affiliation = {
      ...AffiliationService.defaultAffiliation(),
      primaryFactionId: "BOUNTY_HUNTER",
      membershipStatus: "MEMBER",
      rankId: "hunter_local",
    };
    const identity = IdentityService.ensure(run);
    expect(identity.factionId).toBe("CIVILIAN");
    expect(identity.roleId).toBe("BOUNTY_HUNTER");
    expect(run.player.affiliation?.primaryFactionId).toBe("CIVILIAN");
  });
});

describe("RecruitmentModelService", () => {
  it("blocks celestial core crew while privileged", () => {
    const run = freshRun();
    IdentityService.setRole(run, "CELESTIAL_DRAGON");
    CharacterService.getOrCreateCharacter(run, {
      id: "npc_test_crew",
      name: "Hopeful",
      faction: "CIVILIAN",
      joinInterest: 100,
    });
    const gate = RecruitmentModelService.canRecruitCoreCrew(run);
    expect(gate.ok).toBe(false);
    const result = RecruitmentModelService.recruit(run, "npc_test_crew");
    expect(result.member).toBeNull();
  });

  it("allows recruit after celestial privilege loss", () => {
    const run = freshRun();
    IdentityService.setRole(run, "CELESTIAL_DRAGON");
    IdentityService.loseCelestialPrivilege(run);
    CharacterService.getOrCreateCharacter(run, {
      id: "npc_test_crew2",
      name: "Hopeful",
      faction: "CIVILIAN",
      joinInterest: 100,
    });
    const gate = RecruitmentModelService.canRecruitCoreCrew(run, "ALLY");
    expect(gate.ok).toBe(true);
  });

  it("Marine partner assignment uses ASSIGNED membership", () => {
    const run = freshRun();
    AffiliationService.join(run, { factionId: "MARINES" });
    CharacterService.getOrCreateCharacter(run, {
      id: "npc_marine_partner",
      name: "Hana",
      faction: "MARINE",
      joinInterest: 100,
    });
    const result = RecruitmentModelService.assignPartner(run, "npc_marine_partner");
    expect(result.member?.membership).toBe("ASSIGNED");
    expect(IdentityService.get(run).assignedPartnerId).toBe("npc_marine_partner");
  });
});

describe("StoryThreadService", () => {
  it("advances stage kinds and can merge shared threads", () => {
    const run = freshRun();
    const a = StoryThreadService.createThread(run, "bounty_hunter_milo");
    const b = StoryThreadService.createThread(run, "fishman_exception", {
      characterIds: ["npc_shared"],
      islandIds: [run.currentLocationId],
    });
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    a!.involvedCharacterIds.push("npc_shared");
    a!.involvedIslandIds.push(run.currentLocationId);
    StoryThreadService.advanceStage(run, "bounty_hunter_milo");
    expect(StoryThreadService.getThreadByTemplate(run, "bounty_hunter_milo")?.stageKind).toBeTruthy();
    const merged = StoryThreadService.proposeMerge(run, a!.id, b!.id);
    expect(merged?.mergedFromThreadIds?.length).toBe(2);
  });
});

describe("EncounterHistoryService novelty", () => {
  it("penalizes repeated archetypes", () => {
    const run = freshRun();
    const encounter: Encounter = {
      id: "test_arch",
      title: "Test",
      description: "x",
      weight: 1,
      choices: [],
      narrativeArchetypes: ["rivalry"],
      narrativeThemes: ["bounty_hunter"],
    };
    EncounterHistoryService.recordEncounter(run, encounter, "ok");
    run.day += 1;
    const penalty = EncounterHistoryService.noveltyPenaltyFor(run, ["rivalry"], ["bounty_hunter"]);
    expect(penalty).toBeLessThan(1);
  });
});

describe("createPlayer identity", () => {
  it("embeds default identity on new player", () => {
    const player = createPlayer({ name: "A", raceId: "HUMAN", originId: "SAILOR" });
    expect(player.identity?.roleId).toBe("WANDERER");
    expect(player.title).toBe("Wanderer");
  });
});
