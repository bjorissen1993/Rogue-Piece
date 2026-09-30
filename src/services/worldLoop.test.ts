import { describe, expect, it } from "vitest";
import { createEmptyProfile, createRunState } from "../game/createGame";
import { namingStageRoman, namingStageTitle } from "../data/namingStage";
import { continuityMultiplier } from "../data/trainingGrounds";
import type { RunState } from "../models/types";
import { FactionDiplomacyService } from "./FactionDiplomacyService";
import { IslandPressureService } from "./IslandPressureService";
import { QuestDirectorService } from "./QuestDirectorService";
import { TrainingGroundsService } from "./TrainingGroundsService";
import { DialogueService } from "./DialogueService";
import { WorldService } from "./WorldService";
import { createRng } from "./RandomService";
import { IslandOccupationService } from "./IslandOccupationService";
import { NavalEscapeService } from "./NavalEscapeService";
import { WorldNewsService } from "./WorldNewsService";
import { MuseumService } from "./MuseumService";
import { LegacyService } from "./LegacyService";
import { VoyageService } from "./VoyageService";
import { LocationSemanticsService } from "./LocationSemanticsService";
import { GatherService } from "./GatherService";
import { getMapLayoutStoryChains } from "../data/islandMaps";
import { ItemService } from "./ItemService";
import { QUEST_ARCHETYPES } from "../data/questArchetypes";
import { StoryChainService } from "./StoryChainService";
import { CharacterService } from "./CharacterService";
import { GeneratedLocationService } from "./GeneratedLocationService";

function freshRun(): RunState {
  const profile = createEmptyProfile("world_loop_test", "NORMAL");
  return createRunState(profile, {
    name: "Riku",
    raceId: "HUMAN",
    originId: "SAILOR",
    locationId: "east_blue_port",
  });
}

describe("world loop increment", () => {
  it("uses roman naming stages, not path names or Legendary", () => {
    expect(namingStageRoman(0)).toBe("");
    expect(namingStageRoman(1)).toBe("I");
    expect(namingStageRoman(2)).toBe("II");
    expect(namingStageRoman(3)).toBe("III");
    expect(namingStageTitle(3)).toBe("Completed Identity");
    expect(namingStageTitle(3)).not.toMatch(/Legendary/i);
  });

  it("raises continuity then caps", () => {
    expect(continuityMultiplier(1)).toBe(1);
    expect(continuityMultiplier(5)).toBe(2.5);
    expect(continuityMultiplier(9)).toBe(3.5);
    expect(continuityMultiplier(20)).toBe(3.5);
  });

  it("lets training run without an end time and keeps EXP when stopped", () => {
    const run = freshRun();
    const start = TrainingGroundsService.start(run, "player", "strength");
    expect(start.ok).toBe(true);
    TrainingGroundsService.tickAfterTimeAdvance(run, 5);
    const session = TrainingGroundsService.getSession(run, "player");
    expect(session?.elapsedSlots).toBe(5);
    expect(session?.continuityMultiplier).toBe(2.5);
    const message = TrainingGroundsService.stop(run, "player");
    expect(message).toMatch(/stops training/i);
    expect(TrainingGroundsService.getSession(run, "player")).toBeNull();
    expect(run.characterAssignments?.some((row) => row.characterId === "player")).toBe(false);
  });

  it("keeps occupations on the island after they are set", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    const occupied = IslandPressureService.occupyFacility(run, "market", "MARINES");
    expect(occupied?.state).toBe("OCCUPIED");
    expect(IslandPressureService.occupationFor(run.islands[0]!, "market")?.factionId).toBe("MARINES");
    IslandPressureService.liberateFacility(run, "market");
    expect(IslandPressureService.occupationFor(run.islands[0]!, "market")?.state).toBe("AVAILABLE");
  });

  it("treats faction pairs as dynamic, not hardcoded forever-hate", () => {
    const run = freshRun();
    expect(FactionDiplomacyService.get(run, "MARINES", "PIRATES")).toBe(-40);
    FactionDiplomacyService.modify(run, "MARINES", "PIRATES", 80);
    expect(FactionDiplomacyService.areHostile(run, "MARINES", "PIRATES")).toBe(false);
  });

  it("caps generated quests and does not count promoted threads", () => {
    const run = freshRun();
    run.day = 4;
    const first = QuestDirectorService.maybeGenerate(run);
    expect(first).toBeTruthy();
    run.day = 8;
    QuestDirectorService.maybeGenerate(run);
    run.day = 12;
    QuestDirectorService.maybeGenerate(run);
    run.day = 16;
    QuestDirectorService.maybeGenerate(run);
    expect(QuestDirectorService.ensure(run).activeGeneratedQuestIds.length).toBeLessThanOrEqual(3);
    const id = QuestDirectorService.ensure(run).activeGeneratedQuestIds[0];
    if (id) {
      QuestDirectorService.promoteToThread(run, id);
      expect(QuestDirectorService.ensure(run).activeGeneratedQuestIds).not.toContain(id);
    }
  });

  it("locks exact dialogue and only uses supplied facts for intents", () => {
    expect(DialogueService.renderIntent({ intent: "x", exactLine: "Stay back." })).toBe("Stay back.");
    expect(
      DialogueService.renderIntent({
        intent: "asks for help.",
        requiredFacts: ["The heirloom was stolen."],
        emotion: "Worried",
      }, "The fisher"),
    ).toMatch(/heirloom was stolen/);
  });

  it("accrues training when world time advances", () => {
    const run = freshRun();
    TrainingGroundsService.start(run, "player", "speed");
    WorldService.spendTime(run, 2, createRng("train-tick"));
    expect(TrainingGroundsService.getSession(run, "player")?.elapsedSlots).toBe(2);
  });

  it("lets occupation actions fight or slip past", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    IslandPressureService.occupyFacility(run, "MARKET", "MARINES");
    const sneak = IslandOccupationService.act(run, "MARKET", "sneak", createRng("sneak-ok"));
    expect(sneak.message.length).toBeGreaterThan(0);
    const fight = IslandOccupationService.act(run, "MARKET", "fight", createRng("occ-fight"));
    expect(fight.startFight).toBe(true);
    expect(run.pendingIslandEvent?.kind).toBe("OCCUPATION");
    expect(IslandOccupationService.afterOccupationVictory(run)).toMatch(/free again/i);
    expect(IslandPressureService.occupationFor(run.islands[0]!, "MARKET")?.state).toBe("AVAILABLE");
  });

  it("blocks free sailing under a harbor blockade until escape finishes", () => {
    const profile = createEmptyProfile("blockade_test", "NORMAL");
    const run = createRunState(profile, {
      name: "Riku",
      raceId: "HUMAN",
      originId: "SAILOR",
      locationId: "east_blue_port",
    });
    profile.activeRun = run;
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    const island = run.islands[0]!;
    island.harborBlockade = { factionId: "MARINES", ships: 2, sinceDay: run.day };
    const dest = run.islands.find((row) => row.id !== island.id);
    expect(dest).toBeTruthy();
    const blocked = VoyageService.beginVoyage(profile, dest!.id, createRng("block"));
    expect(blocked.activeRun?.pendingNavalEscape?.toIslandId).toBe(dest!.id);
    expect(blocked.activeRun?.activityMode).not.toBe("SAILING");
    const escape = NavalEscapeService.finishEscape(blocked.activeRun!, "Clear.");
    expect(escape.escaped).toBe(true);
    expect(blocked.activeRun?.islands[0]?.harborBlockade).toBeNull();
  });

  it("reveals leftover-run news over days, not all at once", () => {
    const run = freshRun();
    WorldNewsService.schedule(run, run.day + 2, "A rumor from last voyage.");
    WorldNewsService.flushDue(run);
    expect(run.world.history.some((row) => row.text.includes("last voyage"))).toBe(false);
    run.day += 2;
    const due = WorldNewsService.flushDue(run);
    expect(due[0]).toMatch(/last voyage/);
  });

  it("keeps the museum to the dead, not living descendants", () => {
    const profile = createEmptyProfile("museum_test", "NORMAL");
    const run = createRunState(profile, {
      name: "Riku",
      raceId: "HUMAN",
      originId: "SAILOR",
      locationId: "east_blue_port",
    });
    profile.activeRun = run;
    run.deathCause = "Fell in battle";
    LegacyService.harvestRunEnd(profile);
    const exhibits = MuseumService.exhibits(profile);
    expect(exhibits.some((row) => row.character.name === "Riku" && row.status === "DEAD")).toBe(true);
    expect(exhibits.every((row) => row.status === "DEAD" || row.historical)).toBe(true);
  });

  it("infers zone tags from the name only", () => {
    expect(LocationSemanticsService.tagsForName("Whispering Marsh")).toEqual(
      expect.arrayContaining(["wetland", "vegetation"]),
    );
    expect(LocationSemanticsService.tagsForName("Ashen Ridge")).toEqual(
      expect.arrayContaining(["volcanic", "rocky"]),
    );
  });

  it("nests a generated quest start on an existing map icon", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    run.day = 4;
    const thread = QuestDirectorService.maybeGenerate(run);
    expect(thread).toBeTruthy();
    const island = run.islands[0]!;
    const chains = getMapLayoutStoryChains(island, island.mapAssetId);
    const start = chains[0]?.nodes.find((node) => node.kind === "start");
    expect(start?.placedHotspotId).toBeTruthy();
  });

  it("pre-rolls gather slots and reveals only equipped categories", () => {
    const run = freshRun();
    ItemService.grant(run, "herbalist_kit", 1);
    const roster = GatherService.begin(run);
    expect(roster.slots).toHaveLength(8);
    expect(roster.remaining).toBe(3);
    const herbs = roster.slots.filter((slot) => slot.itemId === "medicinal_herb" || slot.itemId === "rare_mushroom");
    expect(herbs.every((slot) => slot.revealedByEquipment || slot.hidden)).toBe(true);
    const hidden = roster.slots.find((slot) => slot.hidden);
    if (hidden) {
      GatherService.pick(run, hidden.id);
      expect(hidden.hidden).toBe(false);
      expect(hidden.taken).toBe(true);
    }
    GatherService.finish(run);
    expect(run.pendingGather).toBeNull();
  });

  it("raises gather yield with extraction kits and depletes a zone", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    ItemService.grant(run, "herbalist_kit", 1);
    const first = GatherService.begin(run);
    const herb = first.slots.find((slot) => slot.itemId === "medicinal_herb" || slot.itemId === "rare_mushroom");
    if (herb) {
      const message = GatherService.pick(run, herb.id);
      expect(message.toLowerCase()).toMatch(/extraction|collected|herb|mushroom/);
      expect(herb.extractionBonus).toBe(1);
    }
    GatherService.finish(run);
    const island = run.islands[0]!;
    expect(island.gatherZones?.[0]?.gatherCount).toBeGreaterThanOrEqual(1);
    island.gatherZones = [{ zoneKey: island.gatherZones![0]!.zoneKey, richness: "DEPLETED", gatherCount: 6, lastGatherDay: run.day }];
    const depleted = GatherService.begin(run);
    expect(depleted.richness).toBe("DEPLETED");
    expect(depleted.attempts).toBe(2);
    expect(depleted.slots.every((slot) => slot.category === "RESOURCE" || slot.category === "FOOD")).toBe(true);
    GatherService.finish(run);
    run.day += 2;
    GatherService.tickZones(run);
    expect(island.gatherZones?.[0]?.richness).not.toBe("DEPLETED");
  });

  it("opens a gather container when scavenging tools are owned", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    ItemService.grant(run, "scavenging_tools", 1);
    const roster = GatherService.begin(run);
    const crate = roster.slots.find((slot) => slot.container);
    if (!crate) {
      roster.slots[0] = {
        ...roster.slots[0]!,
        itemId: "washed_up_crate",
        container: true,
        contents: [{ itemId: "salt", quantity: 1 }],
        hidden: false,
      };
    }
    const target = roster.slots.find((slot) => slot.container)!;
    const message = GatherService.pick(run, target.id);
    expect(message.toLowerCase()).toMatch(/open|salt|rope|hardwood/);
    expect(roster.collected.some((row) => row.itemId !== "washed_up_crate")).toBe(true);
    GatherService.finish(run);
  });

  it("creates a quest resident when the island has no local NPC", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    const before = run.world.characters.length;
    const stolen = QUEST_ARCHETYPES.find((row) => row.id === "stolen_item")!;
    const thread = QuestDirectorService.spawn(run, stolen);
    expect(thread.involvedCharacterIds).toHaveLength(1);
    expect(run.world.characters.length).toBe(before + 1);
    const npc = CharacterService.getCharacter(run, thread.involvedCharacterIds[0]!);
    expect(npc?.homeLocationId).toBe(run.islands[0]!.id);
    expect(npc?.residencyStatus).toBe("VISITOR");
    const berries = run.player.berries;
    const trust = run.islands[0]!.trustLevel ?? 0;
    QuestDirectorService.resolve(run, thread.id);
    expect(thread.state).toBe("RESOLVED");
    expect(run.player.berries).toBeGreaterThan(berries);
    expect(run.islands[0]!.trustLevel ?? 0).toBeGreaterThan(trust);
    expect(CharacterService.getCharacter(run, npc!.id)?.residencyStatus).toBe("RESIDENT");
    expect(run.player.inventory.some((item) => item.itemId === "travel_rations")).toBe(true);
  });

  it("reuses an island NPC instead of inventing a second resident", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    const den = run.world.characters.find((row) => row.id === "npc_old_den");
    expect(den).toBeTruthy();
    den!.homeLocationId = run.islands[0]!.id;
    const before = run.world.characters.length;
    const thread = QuestDirectorService.spawn(run, QUEST_ARCHETYPES.find((row) => row.id === "local_dispute")!);
    expect(thread.involvedCharacterIds).toEqual(["npc_old_den"]);
    expect(run.world.characters.length).toBe(before);
  });

  it("applies generated quest rewards when the story chain ends", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    const thread = QuestDirectorService.spawn(run, QUEST_ARCHETYPES.find((row) => row.id === "escort")!);
    const island = run.islands[0]!;
    const chain = getMapLayoutStoryChains(island, island.mapAssetId).find(
      (row) => row.id === thread.metadata?.chainId,
    );
    expect(chain).toBeTruthy();
    const berries = run.player.berries;
    StoryChainService.applyEndEffects(run, chain!);
    expect(thread.state).toBe("RESOLVED");
    expect(run.player.berries).toBeGreaterThan(berries);
    expect(QuestDirectorService.ensure(run).activeGeneratedQuestIds).not.toContain(thread.id);
  });

  it("fails an ignored generated quest after eight days", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    run.day = 4;
    const thread = QuestDirectorService.spawn(run, QUEST_ARCHETYPES.find((row) => row.id === "rescue")!);
    run.day = 12;
    QuestDirectorService.tickExpiry(run);
    expect(thread.state).toBe("FAILED");
    expect(QuestDirectorService.ensure(run).activeGeneratedQuestIds).not.toContain(thread.id);
    expect(run.world.history.some((row) => row.text.toLowerCase().includes("rescue"))).toBe(true);
  });

  it("grows a persistent camp into a settlement then a village", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    const island = run.islands[0]!;
    const camp = GeneratedLocationService.placeTemporary(island, {
      name: "Fishing camp",
      xPct: 42,
      yPct: 48,
    });
    GeneratedLocationService.promotePersistent(run, island, camp);
    expect(camp.maturity).toBe("NEW");
    expect(camp.name).toMatch(/camp/i);
    camp.value.developmentValue = 8;
    run.day = (camp.foundedDay ?? run.day) + 3;
    GeneratedLocationService.tickGrowth(run, island);
    expect(camp.maturity).toBe("DEVELOPING");
    expect(camp.name).toMatch(/settlement/i);
    expect(island.developmentLevel ?? 0).toBeGreaterThanOrEqual(4);
    camp.value.developmentValue = 12;
    run.day = (camp.lastGrowthDay ?? run.day) + 5;
    GeneratedLocationService.tickGrowth(run, island);
    expect(camp.maturity).toBe("ESTABLISHED");
    expect(camp.name).toMatch(/village/i);
    expect(island.trustLevel ?? 0).toBeGreaterThanOrEqual(8);
  });

  it("aims occupation and wrecking at valuable or fragile sites, not the first pin", () => {
    const run = freshRun();
    run.currentIslandId = run.islands[0]?.id ?? run.currentIslandId;
    const island = run.islands[0]!;
    const camp = GeneratedLocationService.placeTemporary(island, { name: "Wayside camp", xPct: 30, yPct: 40 });
    const trade = GeneratedLocationService.placeTemporary(island, { name: "Trading stall", xPct: 60, yPct: 40 });
    GeneratedLocationService.promotePersistent(run, island, camp);
    GeneratedLocationService.promotePersistent(run, island, trade);
    camp.value = { ...camp.value, economicValue: 2, strategicValue: 1, vulnerability: 40 };
    trade.value = { ...trade.value, economicValue: 12, strategicValue: 2, vulnerability: 80 };
    const occupy = GeneratedLocationService.pickEventTarget(island, {
      prefer: "economic",
      includeFacilities: ["MARKET"],
    });
    expect(occupy?.generated?.id).toBe(trade.id);
    const wreck = GeneratedLocationService.pickDestroyTarget(island);
    expect(wreck?.id).toBe(trade.id);
    trade.maturity = "ESTABLISHED";
    const wreckAfter = GeneratedLocationService.pickDestroyTarget(island);
    expect(wreckAfter?.id).toBe(camp.id);
  });
});
