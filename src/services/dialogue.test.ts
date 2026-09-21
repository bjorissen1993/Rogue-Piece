import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { SAVE_VERSION } from "../game/constants";
import { DialogueService } from "./DialogueService";
import { IslandService } from "./IslandService";
import { EncounterEngine } from "./EncounterEngine";
import { CharacterService } from "./CharacterService";
import { createRng } from "./RandomService";
import { ProgressionService } from "./ProgressionService";
import {
  addStoryChainBeat,
  createLocationAnchor,
  createStoryChain,
  migrateIslandMapLayouts,
  unplacedStoryChainNodes,
} from "../data/islandMaps";
import type { RunState, WorldCharacter } from "../models/types";

function freshRun(seed = "dialogue-phase1"): RunState {
  const profile = createEmptyProfile("dialogue_test", "NORMAL");
  const run = createRunState(profile, {
    name: "Test Sailor",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
  run.seed = seed;
  return run;
}

function sampleNpc(overrides: Partial<WorldCharacter> = {}): WorldCharacter {
  return {
    id: "npc_test_mira",
    name: "Mira",
    faction: "CIVILIAN",
    strength: 4,
    bounty: 0,
    devilFruitId: null,
    alive: true,
    relationshipWithPlayer: 0,
    tags: ["local"],
    personality: "Observant and cautious",
    speechProfile: { formality: 40, directness: 55, dialectFlavor: "east-blue lilt" },
    ...overrides,
  };
}

describe("NPC personality & dialogue (Phase 1)", () => {
  it("bumps SAVE_VERSION for personality / story-chain schema", () => {
    expect(SAVE_VERSION).toBe(33);
  });

  it("reuses SpeechProfile on PersonalityProfile instead of duplicating axes", () => {
    const npc = sampleNpc();
    const profile = DialogueService.ensurePersonality(npc);
    expect(profile.speech.dialectFlavor).toBe("east-blue lilt");
    expect(npc.speechProfile?.dialectFlavor).toBe("east-blue lilt");
    expect(profile.speech).toEqual(npc.speechProfile);
    expect(profile.core.curiosity).toBeGreaterThan(50);
    expect(profile.alignment.lawChaos).toBeGreaterThanOrEqual(-100);
  });

  it("maps marine faction onto lawful-leaning alignment when missing", () => {
    const npc = sampleNpc({
      faction: "MARINE",
      personality: "Cold and professional",
      speechProfile: undefined,
    });
    const profile = DialogueService.ensurePersonality(npc);
    expect(profile.alignment.lawChaos).toBeGreaterThan(0);
    expect(profile.speech.formality).toBeGreaterThan(50);
  });

  it("situation severity suppresses humor even when the profile is playful", () => {
    const npc = sampleNpc({
      personality: "Proud and theatrical",
      personalityProfile: undefined,
    });
    const profile = DialogueService.ensurePersonality(npc);
    profile.humor = { style: "playful", intensity: 80 };
    const idle = DialogueService.buildContext(freshRun(), npc, {
      situation: "idle",
      situationSeverity: 10,
    });
    const crisis = DialogueService.buildContext(freshRun(), npc, {
      situation: "crisis",
      situationSeverity: 80,
    });
    expect(DialogueService.humorAllowed(profile, idle)).toBe(true);
    expect(DialogueService.humorAllowed(profile, crisis)).toBe(false);
    const crisisLine = DialogueService.renderLine(npc, crisis);
    expect(crisisLine).not.toMatch(/surprise me/i);
    expect(crisisLine).toMatch(/breathing|blades|Later/i);
  });

  it("hostile relationship overrides warmth and quirks", () => {
    const npc = sampleNpc({
      relationshipWithPlayer: -4,
      personalityProfile: undefined,
    });
    const profile = DialogueService.ensurePersonality(npc);
    profile.core.warmth = 90;
    profile.quirks = ["Always mentions soup."];
    const context = DialogueService.buildContext(freshRun(), npc, { situation: "idle" });
    expect(context.relationship).toBe("hostile");
    const line = DialogueService.renderLine(npc, context);
    expect(line).toMatch(/nerve showing your face/i);
    expect(line).not.toMatch(/soup/i);
  });

  it("records lightweight dialogue memory flags on talk", () => {
    const run = freshRun();
    const island = IslandService.getCurrentIsland(run)!;
    const result = DialogueService.performTalk(run, island);
    const speaker = run.world.characters.find((c) => c.id === result.characterId)!;
    expect(result.line).toContain(speaker.name);
    expect(DialogueService.hasFlag(speaker, "talked")).toBe(true);
    expect(DialogueService.hasFlag(speaker, `talked_at_${island.id}`)).toBe(true);
    expect(speaker.dialogueMemory?.talkCount).toBe(1);
    DialogueService.performTalk(run, island);
    expect(speaker.dialogueMemory?.talkCount).toBe(2);
  });

  it("talk templates are not one-note gimmicks of dialectFlavor", () => {
    const npc = sampleNpc({
      speechProfile: { dialectFlavor: "nyahaha catchphrase" },
    });
    const run = freshRun();
    run.world.characters.push(npc);
    const context = DialogueService.buildContext(run, npc, { situation: "greeting" });
    const line = DialogueService.renderLine(npc, context);
    expect(line).not.toMatch(/nyahaha catchphrase/i);
    expect(line.startsWith("Mira:")).toBe(true);
  });

  it("explore flavor uses Auto-use location anchors and never permission is skipped", () => {
    const run = freshRun("explore-anchors");
    const island = IslandService.getCurrentIsland(run)!;
    IslandService.setFacilityHotspots(
      island,
      island.facilityHotspots ?? [],
      island.mapLayouts?.[island.mapAssetId!]?.scenes ?? [],
      {
        locationAnchors: [
          createLocationAnchor("A sealed well behind the market", ["well", "secret"], "never"),
          createLocationAnchor("Tide-cut caves under the east cliff", ["caves"], "auto"),
        ],
        storyChains: [],
      },
    );
    const flavor = DialogueService.exploreFlavor(run, island);
    expect(flavor.toLowerCase()).toMatch(/cave|cliff|tide/);
    expect(flavor.toLowerCase()).not.toMatch(/sealed well/);
  });

  it("persists story chains with Start/End nodes in the unplaced tray", () => {
    const run = freshRun("story-chain");
    const island = IslandService.getCurrentIsland(run)!;
    const chain = addStoryChainBeat(createStoryChain("Relic rumor", island.id, island.mapAssetId ?? undefined));
    IslandService.setFacilityHotspots(island, island.facilityHotspots ?? [], [], {
      locationAnchors: [],
      storyChains: [chain],
    });
    migrateIslandMapLayouts(island);
    const saved = island.mapLayouts?.[island.mapAssetId!]?.storyChains?.[0];
    expect(saved?.name).toBe("Relic rumor");
    expect(saved?.nodes.some((n) => n.kind === "start")).toBe(true);
    expect(saved?.nodes.some((n) => n.kind === "end")).toBe(true);
    expect(unplacedStoryChainNodes(saved!).length).toBe(saved!.nodes.length);
    expect(saved!.nodes.some((n) => n.kind === "beat")).toBe(true);
  });

  it("migrates legacy WorldCharacter personality string into a profile", () => {
    const migrated = ProgressionService.migrateCharacter(
      sampleNpc({ personalityProfile: undefined, speechProfile: { confidence: 80 } }),
    );
    expect(migrated.personalityProfile?.speech.confidence).toBe(80);
    expect(migrated.dialogueMemory?.flags).toEqual([]);
  });

  it("explore from the hub still increments exploreCount and prepends flavor", () => {
    const profile = createEmptyProfile("explore_flavor", "NORMAL");
    profile.activeRun = freshRun("explore-flavor-hub");
    const island = IslandService.getCurrentIsland(profile.activeRun)!;
    profile.activeRun.currentEncounterId = "island_hub";
    expect(island.exploreCount ?? 0).toBe(0);
    const chosen = EncounterEngine.resolveChoice(profile, "explore", createRng("explore-flavor"));
    expect(IslandService.getCurrentIsland(chosen.profile.activeRun!)?.exploreCount).toBe(1);
    expect(chosen.text.length).toBeGreaterThan(0);
  });

  it("CharacterService still records event memories separately from dialogue flags", () => {
    const run = freshRun();
    const npc = sampleNpc();
    run.world.characters.push(npc);
    CharacterService.addMemory(run, npc.id, "HELPED", 2);
    expect(CharacterService.hasMemory(run, npc.id, "HELPED")).toBe(true);
    expect(DialogueService.hasFlag(npc, "talked")).toBe(false);
  });
});
