import { DEVIL_FRUITS } from "../data/devilFruits";
import { STARTING_NPCS } from "../data/npcs";
import { requireLocation } from "../data/locations";
import { requireOrigin } from "../data/origins";
import { requireRace } from "../data/races";
import { RACES } from "../data/races";
import type { Player, ProfileSave, RunState, WorldState } from "../models/types";
import { createId, createSeed, nowIso } from "../utils/ids";
import { applyStatChanges } from "../utils/stats";
import { EncounterEngine } from "../services/EncounterEngine";
import { FactionService } from "../services/FactionService";
import { IslandService } from "../services/IslandService";
import { ItemService } from "../services/ItemService";
import { CollectionService } from "../services/CollectionService";
import { createRng } from "../services/RandomService";
import { WeaponService } from "../services/WeaponService";
import { MpService } from "../services/MpService";
import { ProgressionService } from "../services/ProgressionService";
import { WorldService } from "../services/WorldService";
import { defaultEncounterHistory } from "../services/EncounterHistoryService";
import { defaultStoryThreads } from "../services/StoryThreadService";
import { defaultCrew } from "../services/CharacterService";
import { AffiliationService } from "../services/AffiliationService";
import { IdentityService } from "../services/IdentityService";
import { defaultAuthority, defaultStandingOrders } from "../services/AuthorityService";
import { CrewService } from "../services/CrewService";
import { MedicalRecoveryService } from "../services/MedicalRecoveryService";
import { RunEndResolutionService } from "../services/RunEndResolutionService";
import { LegacyService } from "../services/LegacyService";

export { createEmptyProfile, emptyStatistics } from "./profileFactory";

export function createPlayer(options: {
  name: string;
  raceId: string;
  originId: string;
}): Player {
  const origin = requireOrigin(options.originId);
  const race = requireRace(options.raceId);
  const stats = applyStatChanges({ ...origin.stats }, race.statMods);
  const affiliation = AffiliationService.defaultAffiliation();
  const maxMp = MpService.maxMpForStats(stats);
  return {
    id: createId("player"),
    name: options.name.trim(),
    raceId: options.raceId,
    origin: options.originId,
    hp: 100,
    maxHp: 100,
    mp: maxMp,
    maxMp,
    stats,
    berries: origin.berries,
    bounty: 0,
    title: "Wanderer",
    affiliation,
    identity: IdentityService.defaultIdentity(),
    devilFruitId: null,
    haki: { observation: 0, armament: 0, conquerors: 0 },
    inventory: [],
    flags: [],
    equipment: WeaponService.defaultEquipment(),
    weaponMastery: WeaponService.defaultMastery(),
    activeCombatStyle: null,
    unlockedStyles: [],
    progression: ProgressionService.defaultProgression(),
    unlockedTechniques: [],
  };
}

export function createWorld(): WorldState {
  const seeded = FactionService.seedFactionWorld(1);
  return {
    day: 1,
    devilFruits: DEVIL_FRUITS.map((fruit) => ({
      fruitId: fruit.id,
      status: "UNCLAIMED" as const,
      ownerCharacterId: null,
      history: [`Day 1: ${fruit.name} exists in the world, unclaimed.`],
    })),
    characters: [
      ...STARTING_NPCS.map((npc) => ({ ...npc, tags: [...npc.tags], raceId: "HUMAN" })),
      ...seeded.characters,
    ],
    history: [
      {
        id: createId("news"),
        day: 1,
        text: "A new era stirs. Devil Fruits and old seats of power wait for whoever claims them.",
      },
    ],
    flags: [],
    factions: FactionService.initialRelationships(),
    factionWorld: seeded.factionWorld,
    worldPower: {
      worldGovernmentPower: 45,
      oppression: 28,
      revolutionaryActivity: 6,
    },
    lastDevilFruitDiscoveryDay: null,
  };
}

export function createRunState(
  profile: ProfileSave,
  options: { name: string; raceId: string; originId: string; locationId: string },
): RunState {
  const timestamp = nowIso();
  const location = requireLocation(options.locationId);
  const run: RunState = {
    id: createId("run"),
    seed: createSeed(),
    createdAt: timestamp,
    updatedAt: timestamp,
    player: createPlayer({
      name: options.name,
      raceId: options.raceId,
      originId: options.originId,
    }),
    world: createWorld(),
    day: 1,
    timeOfDay: "DAWN",
    pendingTimeCost: 0,
    trainingToday: {},
    characterTrainingToday: {},
    characterAssignments: [],
    pendingAssignmentResults: [],
    pendingParticipantId: null,
    pendingParticipantIds: [],
    runKnowledge: [],
    currentLocationId: location.id,
    currentEncounterId: null,
    encounterCount: 0,
    runFlags: [],
    gameOver: false,
    currentBoundFruitId: null,
    currentBoundNpcId: null,
    lastResultText: null,
    lastFeedback: null,
    lastHpChange: null,
    awaitingAdvance: false,
    combat: null,
    encounterHistory: defaultEncounterHistory(),
    storyThreads: defaultStoryThreads(),
    crew: defaultCrew(),
    islands: IslandService.defaultIslands(),
    usedIslandNames: [],
    worldProgressionFlags: {},
    currentWeather: "CLEAR",
    currentIslandId: null,
    lastEncounterCategory: null,
    pendingLevelUps: [],
    pendingTechniqueChoice: null,
    pendingEncounterId: null,
    factionMissions: [],
    factionOrders: [],
    activeParty: CrewService.defaultActiveParty(),
    pendingBattleResult: null,
    apprentices: [],
    fleet: [],
    authority: defaultAuthority(),
    standingOrders: defaultStandingOrders(),
    policyIncidents: [],
    raceKnowledge: RACES.map((race) => ({
      raceId: race.id,
      discoveryState: race.defaultKnown ? "KNOWN" as const : "UNKNOWN" as const,
      encounterExposure: 0,
      culturalKnowledge: race.defaultKnown ? 1 : 0,
      relationshipExposure: 0,
      normalRecruitmentUnlocked: race.defaultPlayable,
      playableUnlockProgress: 0,
    })),
  };

  const rng = createRng(run.seed);
  IslandService.seedEastBlueIslands(run, rng);
  if (location.regionId === "GRAND_LINE") {
    run.runFlags.push("reached_grand_line");
    profile.progression.milestones = profile.progression.milestones.includes("reached_grand_line")
      ? profile.progression.milestones
      : [...profile.progression.milestones, "reached_grand_line"];
  }

  WorldService.addNews(
    run,
    `${run.player.name} has set sail from ${location.name}.`,
  );
  LegacyService.ensure(profile);
  LegacyService.injectIntoRun(profile, run);
  MedicalRecoveryService.injectPersistentCharacters(profile, run);
  ItemService.grant(run, "dried_meat", 1, profile);
  CollectionService.discoverItem(profile, "dried_meat");
  EncounterEngine.selectEncounter(run, rng);
  return run;
}

export function startRun(
  profile: ProfileSave,
  options: { name: string; raceId: string; originId: string; locationId: string },
): ProfileSave {
  const next = structuredClone(profile);
  LegacyService.ensure(next);
  if (next.statistics.runsStarted > 0 || (next.legacy?.characters.length ?? 0) > 0) {
    LegacyService.onNewRun(next);
  }
  next.activeRun = createRunState(next, options);
  next.statistics.runsStarted += 1;
  if (options.raceId !== "HUMAN") {
    const flag = `race_${options.raceId}`;
    if (!next.progression.milestones.includes(flag)) {
      next.progression.milestones.push(flag);
    }
  }
  return next;
}

export function endRun(profile: ProfileSave): ProfileSave {
  const next = structuredClone(profile);
  if (next.activeRun?.gameOver) {
    RunEndResolutionService.resolve(next);
    LegacyService.harvestRunEnd(next);
  } else if (next.activeRun) {
    // Abandoned / ended without death — still promote notable crew lightly
    LegacyService.harvestRunEnd(next);
  }
  next.activeRun = null;
  return next;
}
