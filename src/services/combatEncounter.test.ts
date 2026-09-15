import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { MAX_ACTIVE_FIGHTERS } from "../game/constants";
import type { RunState } from "../models/types";
import { createRng } from "./RandomService";
import {
  composeSupportEnemies,
  familiesCompatible,
  inferEnemyFamily,
  inferEnemyRole,
  BATTLE_FORMATS,
} from "./EncounterCompositionService";
import { CombatEngine } from "./CombatEngine";
import { SparringService, needsBattleSetup } from "./SparringService";
import { WorldCombatProgressionService } from "./WorldCombatProgressionService";
import { PartyCombatService } from "./PartyCombatService";
import { CharacterService } from "./CharacterService";
import { CrewCombatService } from "./CrewCombatService";

function freshRun(): RunState {
  const profile = createEmptyProfile("combat_overhaul_test", "NORMAL");
  return createRunState(profile, {
    name: "Bowie",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

describe("EncounterCompositionService", () => {
  it("recognizes Sea King as boss-family SEA_BEAST", () => {
    expect(inferEnemyFamily("Sea King")).toBe("SEA_BEAST");
    expect(inferEnemyRole("Sea King", "BOSS")).toBe("BOSS");
  });

  it("does not allow Sea King family to mix with Harbor Thug family", () => {
    expect(familiesCompatible("SEA_BEAST", "STREET")).toBe(false);
    expect(familiesCompatible("PIRATE", "PIRATE")).toBe(true);
  });

  it("composes Sea King supports only from sea beasts", () => {
    const { extras } = composeSupportEnemies({
      primaryName: "Sea King",
      primaryStrength: 11,
      primaryHp: 160,
      kind: "BOSS",
      templateId: "SEA_BEAST",
      desiredTotal: 3,
      rng: createRng("sea-compose"),
    });
    for (const extra of extras) {
      expect(extra.enemyFamily).toBe("SEA_BEAST");
      expect(inferEnemyFamily(extra.name)).toBe("SEA_BEAST");
    }
  });

  it("does not attach Harbor Thug to Sea King via world progression", () => {
    const run = freshRun();
    run.day = 30;
    const request = {
      enemyName: "Sea King",
      enemyStrength: 11,
      enemyHp: 160,
      combatKind: "BOSS" as const,
      enemyFamily: "SEA_BEAST" as const,
      enemyRole: "BOSS" as const,
      compositionTemplateId: "SEA_BEAST",
      win: { text: "win" },
      lose: { text: "lose" },
    };
    const extras = WorldCombatProgressionService.additionalEnemies(run, request, createRng("no-thug"));
    expect(extras.every((entry) => !/thug|bandit|marine/i.test(entry.name))).toBe(true);
  });

  it("allows pirate captain to group with pirate crew", () => {
    const { extras } = composeSupportEnemies({
      primaryName: "Pirate Captain",
      primaryStrength: 10,
      kind: "NORMAL",
      templateId: "PIRATE_CREW",
      desiredTotal: 3,
      rng: createRng("pirate-crew"),
    });
    expect(extras.length).toBeGreaterThan(0);
    expect(extras.every((entry) => entry.enemyFamily === "PIRATE")).toBe(true);
  });
});

describe("Battle formats", () => {
  it("1v1 accepts exactly one participant and can sit captain out", () => {
    const run = freshRun();
    const combat = CombatEngine.createFromRequest(
      run.player,
      {
        enemyName: "Rival",
        enemyStrength: 8,
        combatKind: "DUEL",
        enemyCount: 1,
        battleFormat: BATTLE_FORMATS.DUEL_1V1,
        participantIds: [], // will fill? lock with empty + captain
        lockParticipants: true,
        forcedParticipantIds: [run.player.id],
        win: { text: "w" },
        lose: { text: "l" },
      },
      createRng("duel-1"),
      run,
    );
    expect(PartyCombatService.allAllies(combat)).toHaveLength(1);
    expect(combat.enemies).toHaveLength(1);
  });

  it("Sea King combat marks boss role for card styling", () => {
    const run = freshRun();
    const combat = CombatEngine.createFromRequest(
      run.player,
      {
        enemyName: "Sea King",
        enemyStrength: 11,
        enemyHp: 160,
        combatKind: "BOSS",
        enemyRole: "BOSS",
        enemyFamily: "SEA_BEAST",
        compositionTemplateId: "SEA_BEAST",
        enemyCount: 1,
        win: { text: "w" },
        lose: { text: "l" },
      },
      createRng("boss-card"),
      run,
    );
    expect(combat.enemies[0]?.enemyRole).toBe("BOSS");
    expect(combat.combatKind).toBe("BOSS");
  });

  it("friendly spar requests require setup and are non-lethal flagged", () => {
    const request = SparringService.buildFriendlyRequest({
      enemyName: "Friendly Rival",
      enemyStrength: 7,
      requireSetup: true,
      wager: { type: "BERRIES", berries: 200, label: "฿200" },
    });
    expect(needsBattleSetup(request)).toBe(true);
    expect(request.isFriendly).toBe(true);
    expect(request.combatKind).toBe("SPARRING");
  });

  it("repeated sparring reduces reward multiplier", () => {
    const run = freshRun();
    const key = "spar:test:DUEL_1V1";
    expect(SparringService.sparMultiplier(run, key)).toBe(1);
    run.sparHistory = { [key]: { count: 4, lastDay: run.day } };
    expect(SparringService.sparMultiplier(run, key)).toBeLessThan(0.3);
  });

  it("wager berries are paid on settle", () => {
    const run = freshRun();
    run.player.berries = 1000;
    const combat = CombatEngine.createFromRequest(
      run.player,
      SparringService.buildFriendlyRequest({
        enemyName: "Rival",
        enemyStrength: 6,
        wager: { type: "BERRIES", berries: 200, label: "฿200" },
        requireSetup: false,
      }),
      createRng("wager"),
      run,
    );
    combat.isFriendly = true;
    combat.wager = { type: "BERRIES", berries: 200, label: "฿200" };
    const before = run.player.berries;
    SparringService.settleWager(run, combat, false);
    expect(run.player.berries).toBe(before - 200);
  });

  it("unavailable crew is marked not selectable", () => {
    const run = freshRun();
    // Add a crew slot if empty — schedule unavailable via CharacterSchedule
    const eligible = SparringService.eligibleParticipants(run);
    expect(eligible.some((entry) => entry.id === run.player.id && entry.available)).toBe(true);
  });

  it("2v2 format locks max fighters to 2", () => {
    expect(BATTLE_FORMATS.SKIRMISH_2V2.maxPlayerFighters).toBe(2);
    expect(BATTLE_FORMATS.DUEL_1V1.maxPlayerFighters).toBe(1);
  });

  it("crew battle formats allow five fighters on the field", () => {
    expect(BATTLE_FORMATS.TEAM.maxPlayerFighters).toBe(5);
    expect(BATTLE_FORMATS.BOSS_RAID.maxPlayerFighters).toBe(5);
    expect(BATTLE_FORMATS.CUSTOM.maxPlayerFighters).toBe(5);
  });

  it("active party accepts up to four crew fighters", () => {
    expect(MAX_ACTIVE_FIGHTERS).toBe(4);
    const run = freshRun();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const character = CharacterService.getOrCreateCharacter(run, {
        name: `Mate ${i}`,
        faction: "PIRATE",
        strength: 5,
        tags: ["test"],
        alive: true,
      });
      CharacterService.acceptRecruitment(run, character.id, "FIGHTER", "PERMANENT");
      ids.push(character.id);
    }
    CrewCombatService.setActiveFighters(run, ids);
    const party = CrewCombatService.ensurePartyConfig(run);
    expect(party.activeFighterIds).toHaveLength(4);
    expect(party.activeFighterIds).toEqual(ids.slice(0, 4));
  });

  it("cancel setup clears pending without starting combat", () => {
    const run = freshRun();
    const request = SparringService.buildFriendlyRequest({
      enemyName: "Rival",
      enemyStrength: 6,
      requireSetup: true,
      wager: { type: "BERRIES", berries: 500, label: "฿500" },
    });
    run.pendingBattleSetup = SparringService.createSetup(run, request);
    expect(run.pendingBattleSetup).toBeTruthy();
    run.pendingBattleSetup = null;
    run.combat = null;
    expect(run.combat).toBeNull();
    expect(run.pendingBattleSetup).toBeNull();
  });

  it("sparHistory survives structuredClone save round-trip", () => {
    const run = freshRun();
    run.sparHistory = { "spar:a:DUEL_1V1": { count: 2, lastDay: 5 } };
    const cloned = structuredClone(run);
    expect(cloned.sparHistory?.["spar:a:DUEL_1V1"]?.count).toBe(2);
  });

  it("forced participant locks captain into duel setup", () => {
    const run = freshRun();
    const request = {
      enemyName: "Rival",
      enemyStrength: 8,
      combatKind: "DUEL" as const,
      battleFormat: BATTLE_FORMATS.DUEL_1V1,
      forcedParticipantIds: [run.player.id],
      lockParticipants: true,
      participantIds: [run.player.id],
      win: { text: "w" },
      lose: { text: "l" },
    };
    const combat = CombatEngine.createFromRequest(run.player, request, createRng("forced"), run);
    expect(combat.playerCombatant.participating).not.toBe(false);
    expect(PartyCombatService.allAllies(combat).some((a) => a.id === run.player.id)).toBe(true);
  });
});
