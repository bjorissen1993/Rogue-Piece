import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import type { RunState } from "../models/types";
import { CharacterService } from "./CharacterService";
import { CrewService } from "./CrewService";
import { ItemService } from "./ItemService";

function freshRun(): RunState {
  const profile = createEmptyProfile("crew_item_use", "NORMAL");
  return createRunState(profile, {
    name: "Captain Test",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

describe("ItemService.useOnTarget", () => {
  it("heals a crewmate from the pack and consumes the item", () => {
    const run = freshRun();
    const npc = CharacterService.getOrCreateCharacter(run, {
      id: "npc_heal_target",
      name: "Ren",
      faction: "PIRATE",
      strength: 5,
      tags: ["crew_candidate"],
      crewRole: "NAVIGATOR",
      joinInterest: 100,
      relationshipWithPlayer: 5,
    });
    CrewService.resolveRecruitment(run, npc.id, "NAVIGATOR", "ALLY");
    const member = run.crew.find((entry) => entry.characterId === npc.id)!;
    const vitals = CrewService.ensureMemberVitals(run, npc.id)!;
    member.hp = Math.max(1, vitals.maxHp - 10);
    ItemService.grant(run, "dried_meat", 1);

    const beforeQty =
      run.player.inventory.find((item) => (item.itemId || item.id) === "dried_meat")?.quantity ?? 0;
    const result = ItemService.useOnTarget(run, "dried_meat", npc.id, "OUT_OF_COMBAT");
    expect(result.ok).toBe(true);
    expect(result.hpHealed).toBeGreaterThan(0);
    expect(member.hp).toBeGreaterThan(vitals.maxHp - 10);
    const afterQty =
      run.player.inventory.find((item) => (item.itemId || item.id) === "dried_meat")?.quantity ?? 0;
    expect(afterQty).toBe(beforeQty - 1);
  });

  it("revives a knocked-out crewmate with phoenix tear and refuses food", () => {
    const run = freshRun();
    const npc = CharacterService.getOrCreateCharacter(run, {
      id: "npc_revive_target",
      name: "Nami",
      faction: "PIRATE",
      strength: 5,
      tags: ["crew_candidate"],
      crewRole: "NAVIGATOR",
      joinInterest: 100,
      relationshipWithPlayer: 5,
    });
    CrewService.resolveRecruitment(run, npc.id, "NAVIGATOR", "ALLY");
    const member = run.crew.find((entry) => entry.characterId === npc.id)!;
    const vitals = CrewService.ensureMemberVitals(run, npc.id)!;
    member.hp = 0;

    ItemService.grant(run, "dried_meat", 1);
    const foodFail = ItemService.useOnTarget(run, "dried_meat", npc.id, "OUT_OF_COMBAT");
    expect(foodFail.ok).toBe(false);
    expect(foodFail.revived).toBe(false);
    expect(member.hp).toBe(0);

    ItemService.grant(run, "phoenix_tear", 2);
    const result = ItemService.useOnTarget(run, "phoenix_tear", npc.id, "OUT_OF_COMBAT");
    expect(result.ok).toBe(true);
    expect(result.revived).toBe(true);
    expect(result.hpHealed).toBeGreaterThan(0);
    expect(member.hp).toBeGreaterThan(0);
    expect(member.hp).toBeLessThanOrEqual(vitals.maxHp);

    const standingFail = ItemService.useOnTarget(run, "phoenix_tear", npc.id, "OUT_OF_COMBAT");
    expect(standingFail.ok).toBe(false);
    expect(standingFail.message).toMatch(/still standing/i);
  });
});
