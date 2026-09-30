import { describe, expect, it } from "vitest";
import { namedCombatStatus, enemyOnHitStatus } from "../data/combatStatuses";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { CombatState, CombatantState, RunState } from "../models/types";
import { AfflictionService } from "./AfflictionService";
import { CombatEngine } from "./CombatEngine";
import { CombatStatusService } from "./CombatStatusService";
import { computeHitChance } from "./CombatCalculationService";
import { ItemService } from "./ItemService";
import { createRng } from "./RandomService";

function freshRun(): RunState {
  const profile = createEmptyProfile("combat_status_test", "NORMAL");
  return createRunState(profile, {
    name: "Bowie",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

function startFight(run: RunState): CombatState {
  return CombatEngine.createFromRequest(
    run.player,
    {
      enemyName: "Harbor Thug",
      enemyStrength: 4,
      enemyHp: 40,
      combatKind: "NORMAL",
      enemyFamily: "STREET",
      win: { text: "win" },
      lose: { text: "lose" },
    },
    createRng("status-fight"),
    run,
  );
}

function dummyCombatant(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    id: "foe-1",
    name: "Dummy",
    side: "ENEMY",
    hp: 50,
    maxHp: 50,
    stats: { strength: 5, defense: 5, speed: 5, willpower: 5, intelligence: 5, charisma: 5 },
    defending: false,
    observed: false,
    revealed: true,
    nextActionHint: null,
    intendedAction: "ATTACK",
    weakPointDiscovered: false,
    accuracyBonus: 0,
    dodgeBonus: 0,
    statusEffects: [],
    abilities: [],
    ...overrides,
  };
}

describe("Combat statuses", () => {
  it("maps enemy families to the right on-hit statuses", () => {
    expect(enemyOnHitStatus("SEA_BEAST", "NORMAL", false)?.kind).toBe("POISON");
    expect(enemyOnHitStatus("HUNTER", "NORMAL", true)?.kind).toBe("BLIND");
    expect(enemyOnHitStatus("MARINE", "ELITE", true)?.kind).toBe("STUN");
    expect(enemyOnHitStatus("TRAINING", "NORMAL", true)).toBeNull();
  });

  it("burns at the start of the turn", () => {
    const combat = startFight(freshRun());
    const enemy = combat.enemies[0]!;
    const before = enemy.hp;
    CombatStatusService.applyKind(combat, enemy, "BURN");
    const skipped = CombatStatusService.beginTurn(combat, enemy, createRng("burn"));
    expect(skipped).toBe(false);
    expect(enemy.hp).toBeLessThan(before);
    expect(combat.log.some((entry) => /Burn wracks/i.test(entry.text))).toBe(true);
  });

  it("stun skips the turn", () => {
    const combat = startFight(freshRun());
    const enemy = combat.enemies[0]!;
    CombatStatusService.applyKind(combat, enemy, "STUN");
    expect(CombatStatusService.beginTurn(combat, enemy, createRng("stun"))).toBe(true);
    expect(combat.log.some((entry) => /stunned/i.test(entry.text))).toBe(true);
  });

  it("blind lowers accuracy", () => {
    const attacker = dummyCombatant({ id: "atk", name: "Atk", side: "PLAYER" });
    const defender = dummyCombatant({ id: "def", name: "Def" });
    const clear = computeHitChance(attacker, defender).combined;
    attacker.statusEffects = [CombatStatusService.createEffect("BLIND", attacker.maxHp)];
    const blinded = computeHitChance(attacker, defender).combined;
    expect(blinded).toBeLessThan(clear);
  });

  it("stitch kit clears bleed in combat", () => {
    const run = freshRun();
    ItemService.grant(run, "stitch_kit", 1);
    const combat = startFight(run);
    CombatStatusService.applyKind(combat, combat.playerCombatant, "BLEED");
    combat.activeSide = "PLAYER";
    combat.activeCombatantId = combat.playerCombatant.id;
    combat.finished = false;
    run.combat = combat;
    const used = ItemService.useOnTarget(run, "stitch_kit", "player", "COMBAT");
    expect(used.ok).toBe(true);
    expect(used.clearedCombatStatuses).toContain("BLEED");
    const next = CombatEngine.applyItemResult(combat, used, createRng("kit"), run, run.player.id);
    expect(CombatStatusService.hasKind(next.playerCombatant, "BLEED")).toBe(false);
  });

  it("status remover kit lists every named battle status", () => {
    const kinds = CombatStatusService.kindsClearedByItemEffects([{ type: "CLEAR_AFFLICTION" }]);
    expect(kinds).toEqual(CombatStatusService.kinds());
  });

  it("calming tonic clears fear, panic, and confusion", () => {
    const kinds = CombatStatusService.kindsClearedByItemEffects([
      { type: "CLEAR_AFFLICTION", kinds: ["FEAR", "PANIC", "CONFUSION"] },
    ]);
    expect(kinds).toEqual(["FEAR", "PANIC", "CONFUSION"]);
  });

  it("named technique specs carry a status kind", () => {
    expect(namedCombatStatus("BURN").statusKind).toBe("BURN");
    expect(namedCombatStatus("DAZED").name).toBe("Dazed");
  });

  it("seeds overworld poison into the fight", () => {
    const run = freshRun();
    AfflictionService.apply(run, "player", "POISON", { days: 3 });
    const combat = startFight(run);
    expect(CombatStatusService.hasKind(combat.playerCombatant, "POISON")).toBe(true);
  });
});
