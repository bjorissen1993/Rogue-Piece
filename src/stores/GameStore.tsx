import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { endRun, startRun } from "../game/createGame";
import type {
  CareerFactionId,
  CombatAction,
  CombatRequest,
  ProfileSave,
  ProfileSlot,
  RaceDefinition,
  RelationFactionId,
  SavePreview,
  TimeOfDay,
} from "../models/types";
import { AchievementService } from "../services/AchievementService";
import { AffiliationService } from "../services/AffiliationService";
import { CharacterService } from "../services/CharacterService";
import { CombatEngine } from "../services/CombatEngine";
import { AuthorityService } from "../services/AuthorityService";
import { CrewCombatService } from "../services/CrewCombatService";
import { DevilFruitService } from "../services/DevilFruitService";
import { FleetService } from "../services/FleetService";
import { CombatPreviewService } from "../services/CombatPreviewService";
import { CrewService } from "../services/CrewService";
import { EncounterEngine } from "../services/EncounterEngine";
import { EncounterHistoryService } from "../services/EncounterHistoryService";
import { FactionMissionService } from "../services/FactionMissionService";
import { FactionService } from "../services/FactionService";
import { IslandService } from "../services/IslandService";
import { ItemService } from "../services/ItemService";
import { RaceService } from "../services/RaceService";
import { createRng } from "../services/RandomService";
import { SaveService } from "../services/SaveService";
import { StoryThreadService } from "../services/StoryThreadService";
import { WeaponService } from "../services/WeaponService";
import { ProgressionService } from "../services/ProgressionService";
import { CharacterScheduleService } from "../services/CharacterScheduleService";
import { TrainingService } from "../services/TrainingService";
import { WorldService } from "../services/WorldService";
import { KnowledgeService } from "../services/KnowledgeService";
import { LootDispositionService } from "../services/LootDispositionService";
import { PartyCombatService } from "../services/PartyCombatService";
import { WorldCombatProgressionService } from "../services/WorldCombatProgressionService";
import { createSeed } from "../utils/ids";
import { DEVIL_FRUITS } from "../data/devilFruits";
import type { StatName } from "../models/types";

export type Screen = "profileSelect" | "profileMenu" | "playMenu" | "newRun" | "game" | "gameOver";
export type Overlay =
  | "collection"
  | "achievements"
  | "statistics"
  | "inventory"
  | "crew"
  | "debug"
  | "gameMenu"
  | "time"
  | null;
export type NewRunStep = "race" | "origin" | "location" | "name";

type GameStoreValue = {
  screen: Screen;
  overlay: Overlay;
  profile: ProfileSave | null;
  selectedSlot: ProfileSlot | null;
  saves: SavePreview[];
  devPreview: SavePreview;
  confirmNewRun: boolean;
  confirmResetDev: boolean;
  newRunStep: NewRunStep;
  raceOffers: RaceDefinition[];
  selectedRaceId: string;
  selectedOriginId: string;
  selectedLocationId: string;
  characterName: string;
  goProfileSelect: () => void;
  openProfile: (slot: ProfileSlot) => void;
  openPlay: () => void;
  continueRun: () => void;
  requestNewRun: () => void;
  cancelNewRunConfirm: () => void;
  startNewRunFlow: () => void;
  setNewRunStep: (step: NewRunStep) => void;
  setSelectedRaceId: (id: string) => void;
  setSelectedOriginId: (id: string) => void;
  setSelectedLocationId: (id: string) => void;
  setCharacterName: (name: string) => void;
  launchRun: () => void;
  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
  resetDevProfile: () => void;
  requestResetDev: () => void;
  cancelResetDev: () => void;
  choose: (choiceId: string, participantIds?: string[]) => void;
  continueResult: () => void;
  dismissAssignmentResults: () => void;
  dismissBattleResult: () => void;
  finishCombatPresentation: () => void;
  combatAction: (action: CombatAction) => void;
  resolveEnemyTurn: () => void;
  useCombatItem: (itemId: string) => void;
  useInventoryItem: (itemId: string) => void;
  equipWeapon: (instanceId: string) => void;
  unequipWeapon: (instanceId: string) => void;
  confirmLevelUp: (stat: StatName) => boolean;
  selectTechnique: (techniqueId: string) => void;
  skipTechniqueChoice: () => void;
  fruitInventoryAction: (action: "EAT" | "SELL" | "KEEP", fruitId: string) => void;
  giveFruitToCrew: (fruitId: string, characterId: string) => void;
  giveWeaponToCrew: (instanceId: string, characterId: string) => void;
  resolveLootBackpack: () => void;
  resolveLootAssign: (characterId: string) => void;
  assignStashWeapon: (instanceId: string, characterId: string) => void;
  assignStashFruit: (fruitId: string, characterId: string) => void;
  dismissFeedback: () => void;
  returnToProfileMenu: () => void;
  acknowledgeGameOver: () => void;
  debugGenerateRaceOffer: () => void;
  debugIncreasePity: () => void;
  debugForceCombat: () => void;
  debugGiveTestItem: () => void;
  debugHealPlayer: () => void;
  debugFactionInfluence: (factionId: RelationFactionId, amount: number) => void;
  debugFactionEvent: (factionId: RelationFactionId) => void;
  debugDiscoverRevolutionary: () => void;
  debugFactionRumor: (factionId: RelationFactionId) => void;
  debugGenerateStoryThread: () => void;
  debugAdvanceStoryThread: () => void;
  debugResolveStoryThread: () => void;
  debugGenerateCharacter: () => void;
  debugForceJoinInterest: () => void;
  debugGiveWeapon: () => void;
  debugGiveRandomWeapon: () => void;
  debugEquipSelectedWeapon: () => void;
  debugPrintEquippedWeaponState: () => void;
  debugSetPlayerHp: (hp: number) => void;
  debugDamagePlayer: (amount: number) => void;
  debugGiveDriedMeat: () => void;
  debugGiveMedicine: () => void;
  debugOpenFoodShop: () => void;
  debugOpenClinic: () => void;
  debugGenerateSupplySearch: () => void;
  debugGenerateTraining: () => void;
  debugStartCrewTraining: () => void;
  debugEndCrewTraining: () => void;
  debugAdvanceTimeSlot: () => void;
  debugAdvanceDay: () => void;
  debugGenerateCrewRequirement: () => void;
  debugGenerateCharacterChoice: () => void;
  debugGenerateRuinedMechanism: () => void;
  debugGiveKnowledgeCollectable: () => void;
  debugSetIntelligence: (value: number) => void;
  debugClearRunKnowledge: () => void;
  debugSetTimeSlots: (time: TimeOfDay) => void;
  debugSpawnEasyFight: () => void;
  debugSpawnStandardFight: () => void;
  debugSpawnDeadlyFight: () => void;
  debugSpawnTwoEnemyFight: () => void;
  debugSpawnFourEnemyFight: () => void;
  debugSpawnBossFight: () => void;
  debugSpawnBossAddsFight: () => void;
  debugSetDay: (day: number) => void;
  debugShowDifficulty: () => void;
  debugShowInitiative: () => void;
  debugForceKnownCharacter: () => void;
  debugGiveDevilFruit: () => void;
  debugAddQuestItem: () => void;
  debugRecruitTestCrew: () => void;
  debugEquipToCrew: () => void;
  debugAddMastery: () => void;
  debugGenerateIslandName: () => void;
  debugSetTimeWeather: (time: TimeOfDay, weather: "CLEAR" | "STORM" | "FOG") => void;
  debugClearCooldowns: () => void;
  debugGiveXp: () => void;
  debugLevelUp: () => void;
  debugStatPoint: () => void;
  debugTechniquePoint: () => void;
  debugGenerateChestEncounter: () => void;
  debugJoinFaction: (factionId: CareerFactionId) => void;
  debugSetIndependent: () => void;
  debugPromote: () => void;
  debugDemote: () => void;
  debugAddFactionReputation: (amount: number) => void;
  debugTriggerRecruitmentOffer: (factionId: CareerFactionId) => void;
  debugDesert: () => void;
  debugSwitchFaction: (factionId: CareerFactionId) => void;
  debugGenerateFactionMission: () => void;
  debugGenerateFactionOrder: () => void;
  debugSetAuthority: (score: number) => void;
  debugTogglePolicy: (orderId: string) => void;
  debugForcePolicyViolation: () => void;
  debugSetRaceKnowledge: (raceId: string) => void;
  debugAutoParty: () => void;
  debugShowCombatCalc: () => void;
  debugGenerateFleetStory: () => void;
  debugFeedback: string | null;
};

const GameStoreContext = createContext<GameStoreValue | null>(null);

export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("profileSelect");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedSlot, setSelectedSlot] = useState<ProfileSlot | null>(null);
  const [profile, setProfile] = useState<ProfileSave | null>(null);
  const [tick, setTick] = useState(0);
  const [confirmNewRun, setConfirmNewRun] = useState(false);
  const [confirmResetDev, setConfirmResetDev] = useState(false);
  const [newRunStep, setNewRunStep] = useState<NewRunStep>("race");
  const [raceOffers, setRaceOffers] = useState<RaceDefinition[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState("HUMAN");
  const [selectedOriginId, setSelectedOriginId] = useState("STREET_KID");
  const [selectedLocationId, setSelectedLocationId] = useState("east_blue_port");
  const [characterName, setCharacterName] = useState("");
  const [debugFeedback, setDebugFeedback] = useState<string | null>(null);

  const bump = useCallback(() => setTick((value) => value + 1), []);
  const saves = useMemo(() => SaveService.listProfiles(), [tick]);
  const devPreview = useMemo(() => SaveService.developmentPreview(), [tick]);

  const persist = useCallback(
    (next: ProfileSave) => {
      const saved = SaveService.persist(next);
      setProfile(saved);
      bump();
      return saved;
    },
    [bump],
  );

  const goProfileSelect = useCallback(() => {
    setScreen("profileSelect");
    setOverlay(null);
    setSelectedSlot(null);
    setProfile(null);
    setConfirmNewRun(false);
    bump();
  }, [bump]);

  const openProfile = useCallback(
    (slot: ProfileSlot) => {
      const loaded = SaveService.getOrCreateProfile(slot);
      setSelectedSlot(slot);
      setProfile(loaded);
      setOverlay(null);
      setScreen("profileMenu");
      bump();
    },
    [bump],
  );

  const openPlay = useCallback(() => {
    setScreen("playMenu");
    setOverlay(null);
  }, []);

  const continueRun = useCallback(() => {
    if (!profile?.activeRun || profile.activeRun.gameOver) {
      return;
    }
    setOverlay(null);
    setScreen("game");
  }, [profile]);

  const startNewRunFlow = useCallback(() => {
    if (!profile) {
      return;
    }
    const rolled = RaceService.rollRaceOffers(structuredClone(profile), createRng(createSeed()));
    persist(rolled.profile);
    setRaceOffers(rolled.offers);
    setSelectedRaceId(rolled.offers[0]?.id ?? "HUMAN");
    setSelectedOriginId("STREET_KID");
    setSelectedLocationId(rolled.profile.progression.unlockedStartingLocations[0] ?? "east_blue_port");
    setCharacterName("");
    setNewRunStep("race");
    setConfirmNewRun(false);
    setScreen("newRun");
  }, [profile, persist]);

  const requestNewRun = useCallback(() => {
    if (profile?.activeRun && !profile.activeRun.gameOver) {
      setConfirmNewRun(true);
      return;
    }
    startNewRunFlow();
  }, [profile, startNewRunFlow]);

  const launchRun = useCallback(() => {
    if (!profile) {
      return;
    }
    let next = profile;
    if (next.activeRun) {
      next = endRun(next);
    }
    next = startRun(next, {
      name: characterName.trim(),
      raceId: selectedRaceId,
      originId: selectedOriginId,
      locationId: selectedLocationId,
    });
    AchievementService.evaluate(next);
    persist(next);
    setScreen("game");
    setOverlay(null);
  }, [profile, characterName, selectedRaceId, selectedOriginId, selectedLocationId, persist]);

  const openOverlay = useCallback((next: Overlay) => setOverlay(next), []);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  const requestResetDev = useCallback(() => setConfirmResetDev(true), []);
  const cancelResetDev = useCallback(() => setConfirmResetDev(false), []);

  const resetDevProfile = useCallback(() => {
    const next = SaveService.resetDevelopmentProfile();
    setSelectedSlot("dev");
    setProfile(next);
    setConfirmResetDev(false);
    setOverlay(null);
    setScreen("profileMenu");
    bump();
  }, [bump]);

  const choose = useCallback(
    (choiceId: string, participantIds?: string[]) => {
      if (!profile?.activeRun || profile.activeRun.awaitingAdvance || profile.activeRun.combat) {
        return;
      }
      const next = structuredClone(profile);
      const run = next.activeRun!;
      if (participantIds?.length) {
        run.pendingParticipantIds = participantIds;
        run.pendingParticipantId = participantIds[0] ?? null;
      } else {
        run.pendingParticipantIds = [];
        run.pendingParticipantId = null;
      }
      persist(EncounterEngine.resolveChoice(next, choiceId).profile);
    },
    [profile, persist],
  );

  const dismissAssignmentResults = useCallback(() => {
    if (!profile?.activeRun?.pendingAssignmentResults?.length) {
      return;
    }
    const next = structuredClone(profile);
    next.activeRun!.pendingAssignmentResults = [];
    persist(next);
  }, [profile, persist]);

  const continueResult = useCallback(() => {
    if (!profile?.activeRun) {
      return;
    }
    const next = EncounterEngine.completeEncounter(profile);
    persist(next);
    if (next.activeRun?.gameOver) {
      setScreen("gameOver");
      setOverlay(null);
    }
  }, [profile, persist]);

  const dismissBattleResult = useCallback(() => {
    if (!profile?.activeRun?.pendingBattleResult) {
      return;
    }
    if (profile.activeRun.pendingLevelUps?.length) {
      return;
    }
    const next = structuredClone(profile);
    const run = next.activeRun!;
    run.pendingBattleResult = null;
    run.combat = null;
    run.awaitingAdvance = true;
    persist(next);
  }, [profile, persist]);

  const finishCombatPresentation = useCallback(() => {
    if (!profile?.activeRun?.combat?.finished) {
      return;
    }
    if (profile.activeRun.pendingBattleResult) {
      return;
    }
    persist(EncounterEngine.finishCombatPresentation(profile));
  }, [profile, persist]);

  const combatAction = useCallback(
    (action: CombatAction) => {
      if (!profile?.activeRun?.combat) {
        return;
      }
      persist(EncounterEngine.applyCombatAction(profile, action));
    },
    [profile, persist],
  );

  const resolveEnemyTurn = useCallback(() => {
    if (!profile?.activeRun?.combat || profile.activeRun.combat.activeSide !== "ENEMY") {
      return;
    }
    persist(EncounterEngine.resolveEnemyTurn(profile));
  }, [profile, persist]);

  const useCombatItem = useCallback(
    (itemId: string) => {
      if (!profile?.activeRun?.combat) {
        return;
      }
      persist(EncounterEngine.useCombatItem(profile, itemId));
    },
    [profile, persist],
  );

  const useInventoryItem = useCallback(
    (itemId: string) => {
      if (!profile?.activeRun || profile.activeRun.combat) {
        return;
      }
      persist(EncounterEngine.useOutOfCombatItem(profile, itemId));
    },
    [profile, persist],
  );

  const equipWeapon = useCallback(
    (instanceId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      if (WeaponService.equipInstance(run, instanceId)) {
        run.lastFeedback = "Weapon equipped. Previous weapon returned to backpack if any.";
        persist(next);
      }
    },
    [profile, persist],
  );

  const unequipWeapon = useCallback(
    (instanceId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      if (WeaponService.unequipInstance(run, instanceId)) {
        run.lastFeedback = "Weapon unequipped.";
        persist(next);
      }
    },
    [profile, persist],
  );

  const confirmLevelUp = useCallback(
    (stat: StatName) => {
      if (!profile?.activeRun) return false;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const pending = ProgressionService.peekPendingLevelUp(run);
      if (!pending) return false;
      const message = ProgressionService.applyStatPoint(run, pending.characterId, stat);
      if (message === "No stat points available." || message === "Crewmate not found.") {
        run.lastFeedback = message;
        persist(next);
        return false;
      }
      ProgressionService.consumePendingLevelUp(run);
      run.lastFeedback = message;
      persist(next);
      return true;
    },
    [profile, persist],
  );

  const selectTechnique = useCallback(
    (techniqueId: string) => {
      if (!profile?.activeRun?.pendingTechniqueChoice) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const pending = run.pendingTechniqueChoice!;
      run.lastFeedback = ProgressionService.unlockTechnique(run, pending.characterId, techniqueId);
      ProgressionService.clearTechniqueChoice(run);
      persist(next);
    },
    [profile, persist],
  );

  const skipTechniqueChoice = useCallback(() => {
    if (!profile?.activeRun?.pendingTechniqueChoice) return;
    const next = structuredClone(profile);
    next.activeRun!.pendingTechniqueChoice = null;
    persist(next);
  }, [profile, persist]);

  const fruitInventoryAction = useCallback(
    (action: "EAT" | "SELL" | "KEEP", fruitId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const rng = createRng(`${run.seed}_fruit_${run.day}_${fruitId}`);
      let message = "";
      if (action === "EAT") {
        message = DevilFruitService.eatFromInventory(run, fruitId);
      } else if (action === "SELL") {
        message = DevilFruitService.sell(run, fruitId, rng);
      } else {
        message = DevilFruitService.keep(run, fruitId);
      }
      run.lastFeedback = message;
      persist(next);
    },
    [profile, persist],
  );

  const giveFruitToCrew = useCallback(
    (fruitId: string, characterId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      run.lastFeedback = DevilFruitService.giveToCrew(run, fruitId, characterId);
      persist(next);
    },
    [profile, persist],
  );

  const giveWeaponToCrew = useCallback(
    (instanceId: string, characterId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const check = WeaponService.canCrewEquip(run, instanceId, characterId);
      if (!check.ok) {
        run.lastFeedback = check.reason;
        persist(next);
        return;
      }
      const result = WeaponService.assignToCrew(run, instanceId, characterId);
      run.lastFeedback = result.reason;
      persist(next);
    },
    [profile, persist],
  );

  const resolveLootBackpack = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    run.lastFeedback = LootDispositionService.resolveBackpack(run);
    persist(next);
  }, [profile, persist]);

  const resolveLootAssign = useCallback(
    (characterId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const pending = LootDispositionService.peek(run);
      if (!pending) return;
      const targetId = characterId === "player" ? run.player.id : characterId;
      if (pending.kind === "weapon") {
        run.lastFeedback = LootDispositionService.resolveWeapon(run, pending.instanceId, targetId);
      } else {
        run.lastFeedback = LootDispositionService.resolveFruit(run, pending.fruitId, targetId);
      }
      persist(next);
    },
    [profile, persist],
  );

  const assignStashWeapon = useCallback(
    (instanceId: string, characterId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const targetId = characterId === "player" ? run.player.id : characterId;
      if (targetId !== run.player.id) {
        const check = WeaponService.canCrewEquip(run, instanceId, targetId);
        if (!check.ok) {
          run.lastFeedback = check.reason;
          persist(next);
          return;
        }
      }
      run.lastFeedback = LootDispositionService.assignWeaponFromStash(run, instanceId, targetId);
      persist(next);
    },
    [profile, persist],
  );

  const assignStashFruit = useCallback(
    (fruitId: string, characterId: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const targetId = characterId === "player" ? run.player.id : characterId;
      run.lastFeedback = LootDispositionService.assignFruitFromStash(run, fruitId, targetId);
      persist(next);
    },
    [profile, persist],
  );

  const dismissFeedback = useCallback(() => {
    if (!profile?.activeRun?.lastFeedback) {
      return;
    }
    const next = structuredClone(profile);
    if (next.activeRun) {
      next.activeRun.lastFeedback = null;
    }
    persist(next);
  }, [profile, persist]);

  const debugGenerateRaceOffer = useCallback(() => {
    if (!profile) {
      return;
    }
    const rolled = RaceService.rollRaceOffers(structuredClone(profile), createRng(createSeed()));
    persist(rolled.profile);
    setRaceOffers(rolled.offers);
  }, [profile, persist]);

  const debugIncreasePity = useCallback(() => {
    if (!profile) {
      return;
    }
    const next = structuredClone(profile);
    RaceService.increaseAllPity(next);
    persist(next);
  }, [profile, persist]);

  const debugForceCombat = useCallback(() => {
    if (!profile?.activeRun) {
      return;
    }
    persist(EncounterEngine.forceCombat(profile));
    setOverlay(null);
    setScreen("game");
  }, [profile, persist]);

  const debugGiveTestItem = useCallback(() => {
    if (!profile?.activeRun) {
      return;
    }
    const next = structuredClone(profile);
    const run = next.activeRun;
    if (!run) {
      return;
    }
    ItemService.grant(run, "dried_meat", 1, next);
    ItemService.grant(run, "medicine", 1, next);
    ItemService.grant(run, "bandage", 1, next);
    ItemService.grant(run, "energy_tonic", 1, next);
    ItemService.grant(run, "smoke_bomb", 1, next);
    setDebugFeedback("Granted dried meat, medicine, bandage, energy tonic, smoke bomb.");
    persist(next);
  }, [profile, persist]);

  const debugHealPlayer = useCallback(() => {
    if (!profile?.activeRun) {
      return;
    }
    const next = structuredClone(profile);
    const run = next.activeRun;
    if (!run) {
      return;
    }
    run.player.hp = run.player.maxHp;
    if (run.combat) {
      run.combat.playerCombatant.hp = run.combat.playerCombatant.maxHp;
    }
    persist(next);
  }, [profile, persist]);

  const debugFactionInfluence = useCallback(
    (factionId: RelationFactionId, amount: number) => {
      if (!profile?.activeRun) {
        return;
      }
      const next = structuredClone(profile);
      const run = next.activeRun;
      if (!run) {
        return;
      }
      FactionService.ensureFactionWorld(run);
      FactionService.modifyInfluence(
        run,
        factionId,
        amount,
        amount >= 0 ? `Debug: ${factionId} influence rose.` : `Debug: ${factionId} influence fell.`,
      );
      persist(next);
    },
    [profile, persist],
  );

  const debugFactionEvent = useCallback(
    (factionId: RelationFactionId) => {
      if (!profile?.activeRun) {
        return;
      }
      const next = structuredClone(profile);
      const run = next.activeRun;
      if (!run) {
        return;
      }
      FactionService.ensureFactionWorld(run);
      FactionService.addFactionEvent(
        run,
        factionId,
        `Debug pulse — something stirs within ${factionId.replaceAll("_", " ")}.`,
        3,
        "KNOWN",
      );
      FactionService.addShift(run, factionId, {
        day: run.day,
        type: "POWER_SHIFT",
        text: "Debug-generated power shift.",
        knowledgeLevel: "CONFIRMED",
      });
      persist(next);
    },
    [profile, persist],
  );

  const debugDiscoverRevolutionary = useCallback(() => {
    if (!profile?.activeRun) {
      return;
    }
    const next = structuredClone(profile);
    const run = next.activeRun;
    if (!run) {
      return;
    }
    FactionService.ensureFactionWorld(run);
    if (FactionService.discoverFaction(run, "REVOLUTIONARY_ARMY")) {
      run.world.flags = run.world.flags.includes("revolutionary_revealed")
        ? run.world.flags
        : [...run.world.flags, "revolutionary_revealed"];
      run.runFlags = run.runFlags.includes("revolutionary_revealed")
        ? run.runFlags
        : [...run.runFlags, "revolutionary_revealed"];
      FactionService.addFactionEvent(
        run,
        "REVOLUTIONARY_ARMY",
        "Debug: Revolutionary Army forcibly revealed.",
        5,
        "CONFIRMED",
      );
    }
    persist(next);
  }, [profile, persist]);

  const debugFactionRumor = useCallback(
    (factionId: RelationFactionId) => {
      if (!profile?.activeRun) {
        return;
      }
      const next = structuredClone(profile);
      const run = next.activeRun;
      if (!run) {
        return;
      }
      FactionService.ensureFactionWorld(run);
      FactionService.addRumor(
        run,
        factionId,
        "Debug rumor: docks whisper of a sudden change in command.",
        "RUMORED",
      );
      persist(next);
    },
    [profile, persist],
  );

  const debugGenerateStoryThread = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const thread = StoryThreadService.createThread(run, "red_fang_rivalry");
    setDebugFeedback(thread ? `Started: ${thread.title}` : "Could not start thread (limit/cooldown).");
    persist(next);
  }, [profile, persist]);

  const debugAdvanceStoryThread = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const active = StoryThreadService.getActiveThreads(run)[0];
    if (!active) {
      setDebugFeedback("No active thread.");
      return;
    }
    StoryThreadService.advanceStage(run, active.templateId, "Debug advance.");
    setDebugFeedback(`Advanced: ${active.title} → stage ${active.stage}`);
    persist(next);
  }, [profile, persist]);

  const debugResolveStoryThread = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const active = StoryThreadService.getActiveThreads(run)[0];
    if (!active) {
      setDebugFeedback("No active thread.");
      return;
    }
    StoryThreadService.resolve(run, active.templateId, "Debug resolve.");
    setDebugFeedback(`Resolved: ${active.title}`);
    persist(next);
  }, [profile, persist]);

  const debugGenerateCharacter = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const npc = CharacterService.getOrCreateCharacter(run, {
      name: "Debug Sailor",
      faction: "PIRATE",
      tags: ["debug", "known_to_player"],
      joinInterest: 20,
      personality: "Eager",
    });
    setDebugFeedback(`Created ${npc.name} (${npc.id})`);
    persist(next);
  }, [profile, persist]);

  const debugForceJoinInterest = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const npc = run.world.characters.find((c) => c.alive) ?? CharacterService.getOrCreateCharacter(run, {
      name: "Debug Recruit",
      faction: "CIVILIAN",
      tags: ["crew_candidate"],
    });
    const value = CharacterService.modifyJoinInterest(run, npc.id, 40);
    setDebugFeedback(`${npc.name} join interest → ${value}`);
    persist(next);
  }, [profile, persist]);

  const debugGiveWeapon = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    WeaponService.grantWeapon(run, "steel_cutlass", { autoEquip: false, skipDisposition: true });
    setDebugFeedback("Give Weapon Without Equipping: steel cutlass → backpack.");
    persist(next);
  }, [profile, persist]);

  const debugGiveRandomWeapon = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const id = WeaponService.randomWeaponId();
    WeaponService.grantWeapon(run, id, { autoEquip: false, skipDisposition: true });
    setDebugFeedback(`Give Weapon Without Equipping: ${id} → backpack.`);
    persist(next);
  }, [profile, persist]);

  const debugEquipSelectedWeapon = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const candidate =
      run.player.inventory.find((item) => item.type === "WEAPON" && !item.equipped) ??
      run.player.inventory.find((item) => item.type === "WEAPON");
    if (!candidate) {
      setDebugFeedback("No weapon in inventory to equip.");
      return;
    }
    WeaponService.equipInstance(run, candidate.id);
    setDebugFeedback(`Equipped ${candidate.name} (old weapon returned to backpack if any).`);
    persist(next);
  }, [profile, persist]);

  const debugPrintEquippedWeaponState = useCallback(() => {
    if (!profile?.activeRun) return;
    const run = profile.activeRun;
    const equipped = WeaponService.findEquippedInstance(run.player);
    const primary = run.player.equipment?.primaryWeaponId ?? null;
    const weapons = run.player.inventory
      .filter((item) => item.type === "WEAPON" || item.weaponDefinitionId)
      .map((item) => `${item.name}[${item.id.slice(-6)}] eq=${item.equipped} owner=${item.ownerCharacterId ?? "player"}`)
      .join("; ");
    setDebugFeedback(
      `primaryWeaponId=${primary ?? "null"} | equipped=${equipped ? `${equipped.name} (${equipped.id})` : "none"} | inventory: ${weapons || "—"}`,
    );
  }, [profile]);

  const debugSetPlayerHp = useCallback(
    (hp: number) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      run.player.hp = Math.max(1, Math.min(run.player.maxHp, hp));
      if (run.combat) {
        run.combat.playerCombatant.hp = run.player.hp;
      }
      setDebugFeedback(`Set HP to ${run.player.hp}/${run.player.maxHp}.`);
      persist(next);
    },
    [profile, persist],
  );

  const debugDamagePlayer = useCallback(
    (amount: number) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      run.player.hp = Math.max(1, run.player.hp - amount);
      if (run.combat) {
        run.combat.playerCombatant.hp = run.player.hp;
      }
      setDebugFeedback(`Damaged player by ${amount}. HP ${run.player.hp}/${run.player.maxHp}.`);
      persist(next);
    },
    [profile, persist],
  );

  const debugGiveDriedMeat = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    ItemService.grant(next.activeRun!, "dried_meat", 1, next);
    setDebugFeedback("Granted Dried Meat (backpack).");
    persist(next);
  }, [profile, persist]);

  const debugGiveMedicine = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    ItemService.grant(next.activeRun!, "medicine", 1, next);
    setDebugFeedback("Granted Basic Medicine (backpack).");
    persist(next);
  }, [profile, persist]);

  const loadDebugEncounter = useCallback(
    (encounterId: string, label: string) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      run.currentEncounterId = encounterId;
      run.awaitingAdvance = false;
      run.lastResultText = null;
      run.combat = null;
      setDebugFeedback(`Loaded ${label}.`);
      persist(next);
      setOverlay(null);
      setScreen("game");
    },
    [profile, persist],
  );

  const debugOpenFoodShop = useCallback(() => {
    loadDebugEncounter("food_stall", "Food Stall");
  }, [loadDebugEncounter]);

  const debugOpenClinic = useCallback(() => {
    loadDebugEncounter("clinic_shop", "Island Clinic");
  }, [loadDebugEncounter]);

  const debugGenerateSupplySearch = useCallback(() => {
    loadDebugEncounter("supply_search", "Scavenger's Round");
  }, [loadDebugEncounter]);

  const debugGenerateTraining = useCallback(() => {
    loadDebugEncounter("island_shore_day", "A Day Ashore (train/rest/explore)");
  }, [loadDebugEncounter]);

  const debugStartCrewTraining = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const target =
      run.crew.find((member) => CharacterScheduleService.isAvailable(run, member.characterId))
        ?.characterId ?? "player";
    const result = TrainingService.beginLongTraining(run, target, {
      label: "Intensive Sword Training",
      focus: "strength",
      durationSlots: 8,
      type: "WEAPON_TRAINING",
    });
    setDebugFeedback(result.message);
    persist(next);
  }, [profile, persist]);

  const debugEndCrewTraining = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    CharacterScheduleService.ensure(run);
    const assignment = run.characterAssignments?.[0];
    if (!assignment) {
      setDebugFeedback("No active training.");
      return;
    }
    const report = CharacterScheduleService.completeAssignment(run, assignment);
    run.characterAssignments = run.characterAssignments!.filter(
      (entry) => entry.characterId !== assignment.characterId,
    );
    run.pendingAssignmentResults = [...(run.pendingAssignmentResults ?? []), report];
    setDebugFeedback(report.summary);
    persist(next);
  }, [profile, persist]);

  const debugAdvanceTimeSlot = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const rng = createRng(`${run.seed}_slot_${Date.now()}`);
    WorldService.spendTime(run, 1, rng);
    setDebugFeedback(`Advanced 1 slot → Day ${run.day} ${run.timeOfDay}`);
    persist(next);
  }, [profile, persist]);

  const debugAdvanceDay = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const rng = createRng(`${run.seed}_day_${Date.now()}`);
    WorldService.turnDay(run, rng);
    setDebugFeedback(`Advanced to Day ${run.day}`);
    persist(next);
  }, [profile, persist]);

  const debugGenerateCrewRequirement = useCallback(() => {
    loadDebugEncounter("crew_roadblock", "Collapsed Road (3 crew)");
  }, [loadDebugEncounter]);

  const debugGenerateCharacterChoice = useCallback(() => {
    loadDebugEncounter("chase_the_thief", "Chase the Thief");
  }, [loadDebugEncounter]);

  const debugGenerateRuinedMechanism = useCallback(() => {
    loadDebugEncounter("ruined_mechanism", "Sealed Ruin Gate");
  }, [loadDebugEncounter]);

  const debugGiveKnowledgeCollectable = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const msg = KnowledgeService.grantFromCollectable(next.activeRun!, next, "ancient_gear_diagram");
    setDebugFeedback(msg);
    persist(next);
  }, [profile, persist]);

  const debugSetIntelligence = useCallback(
    (value: number) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      next.activeRun!.player.stats.intelligence = Math.max(1, Math.min(20, value));
      setDebugFeedback(`Player Intelligence set to ${next.activeRun!.player.stats.intelligence}.`);
      persist(next);
    },
    [profile, persist],
  );

  const debugClearRunKnowledge = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    KnowledgeService.clearRunKnowledge(next.activeRun!);
    setDebugFeedback("Cleared run knowledge.");
    persist(next);
  }, [profile, persist]);

  const debugSetTimeSlots = useCallback(
    (time: TimeOfDay) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      next.activeRun!.timeOfDay = time;
      setDebugFeedback(`Time set to ${time}.`);
      persist(next);
    },
    [profile, persist],
  );

  const spawnDebugFight = useCallback(
    (enemyStrength: number, enemyName: string, label: string, extras?: CombatRequest["extraEnemies"], enemyCount?: number, combatKind?: CombatRequest["combatKind"]) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      const rng = createRng(`${run.seed}_dbg_${Date.now()}`);
      run.combat = CombatEngine.createFromRequest(
        run.player,
        {
          enemyName,
          enemyStrength,
          combatKind: combatKind ?? "NORMAL",
          canEscape: true,
          enemyCount,
          extraEnemies: extras,
          win: { text: `You defeat the ${enemyName}.` },
          lose: { text: "You are beaten back.", hpChange: -8 },
          escape: { text: "You break away." },
        },
        rng,
        run,
      );
      setDebugFeedback(`Spawned ${label} fight (${enemyName}, str ${enemyStrength}).`);
      persist(next);
      setOverlay(null);
      setScreen("game");
    },
    [profile, persist],
  );

  const debugSpawnEasyFight = useCallback(() => {
    spawnDebugFight(4, "Street Thug", "1-enemy", undefined, 1);
  }, [spawnDebugFight]);

  const debugSpawnStandardFight = useCallback(() => {
    spawnDebugFight(7, "Harbor Brute", "2-enemy", undefined, 2);
  }, [spawnDebugFight]);

  const debugSpawnDeadlyFight = useCallback(() => {
    spawnDebugFight(14, "East Blue Menace", "Deadly", undefined, 1, "HIGH_RISK");
  }, [spawnDebugFight]);

  const debugSpawnTwoEnemyFight = useCallback(() => {
    spawnDebugFight(8, "Marine Captain", "2-enemy", undefined, 2);
  }, [spawnDebugFight]);

  const debugSpawnFourEnemyFight = useCallback(() => {
    spawnDebugFight(6, "Marine Patrol Lead", "4-enemy", undefined, 4);
  }, [spawnDebugFight]);

  const debugSpawnBossFight = useCallback(() => {
    spawnDebugFight(16, "Captain Redjaw", "Boss", undefined, 1, "BOSS");
  }, [spawnDebugFight]);

  const debugSpawnBossAddsFight = useCallback(() => {
    spawnDebugFight(
      16,
      "Vice Admiral",
      "Boss+adds",
      [
        { name: "Elite Marine", strength: 8, hp: 28, formation: "FRONT" },
        { name: "Marine Medic", strength: 6, hp: 22, formation: "BACK" },
      ],
      undefined,
      "BOSS",
    );
  }, [spawnDebugFight]);

  const debugSetDay = useCallback(
    (day: number) => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      next.activeRun!.day = Math.max(1, day);
      setDebugFeedback(`Day set to ${next.activeRun!.day}.`);
      persist(next);
    },
    [profile, persist],
  );

  const debugShowDifficulty = useCallback(() => {
    if (!profile?.activeRun) return;
    setDebugFeedback(WorldCombatProgressionService.explainDifficulty(profile.activeRun));
  }, [profile]);

  const debugShowInitiative = useCallback(() => {
    if (!profile?.activeRun?.combat) {
      setDebugFeedback("No active combat.");
      return;
    }
    const combat = profile.activeRun.combat;
    const order = PartyCombatService.upcomingTurnPositions(combat)
      .map((entry) => {
        const unit = PartyCombatService.getCombatant(combat, entry.id);
        return `#${entry.position} ${unit?.name ?? entry.id} (spd ${unit?.stats.speed ?? "?"}, init ${unit?.initiativeScore ?? "?"})`;
      })
      .join("\n");
    setDebugFeedback(order || "Empty turn order.");
  }, [profile]);

  const debugForceKnownCharacter = useCallback(() => {
    if (!profile?.activeRun) return;
    const info = WorldCombatProgressionService.knownCharacterEligibility(profile.activeRun);
    setDebugFeedback(
      `${info.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}\n${info.reasons.join("\n") || "No reasons yet"}\n${info.names.join(", ")}`,
    );
  }, [profile]);

  const debugGiveDevilFruit = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const unclaimed = DevilFruitService.unclaimed(run);
    const fruitId = unclaimed[0]?.fruitId ?? DEVIL_FRUITS[0]?.id;
    if (!fruitId) {
      setDebugFeedback("No devil fruit available.");
      return;
    }
    setDebugFeedback(DevilFruitService.keep(run, fruitId, { skipDisposition: true }));
    persist(next);
  }, [profile, persist]);

  const debugAddQuestItem = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    run.player.inventory.push({
      id: `quest_${Date.now()}`,
      itemId: "quest_token",
      name: "Red Fang Token",
      type: "QUEST",
      description: "Proof of a settled rivalry. Cannot be used — only shown.",
      quantity: 1,
      category: "QUEST_ITEMS",
    });
    setDebugFeedback("Added quest item: Red Fang Token.");
    persist(next);
  }, [profile, persist]);

  const debugRecruitTestCrew = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const npc = CrewService.recruitTestCrew(run);
    setDebugFeedback(`Recruited ${npc.name}.`);
    persist(next);
  }, [profile, persist]);

  const debugEquipToCrew = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const member = run.crew[0];
    if (!member) {
      setDebugFeedback("No crew to equip.");
      persist(next);
      return;
    }
    let weapon = run.player.inventory.find((item) => item.type === "WEAPON" && !item.equipped);
    if (!weapon) {
      WeaponService.grantWeapon(run, "iron_spear", { autoEquip: false, skipDisposition: true });
      weapon = run.player.inventory.find((item) => item.weaponDefinitionId === "iron_spear");
    }
    if (!weapon) {
      setDebugFeedback("Could not find a weapon to assign.");
      persist(next);
      return;
    }
    const result = WeaponService.assignToCrew(run, weapon.id, member.characterId);
    setDebugFeedback(result.reason);
    persist(next);
  }, [profile, persist]);

  const debugAddMastery = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const weapon = WeaponService.getEquippedWeapon(run.player);
    const type = weapon?.weaponType ?? "SWORD";
    const value = WeaponService.addMastery(run, type, 5);
    setDebugFeedback(`${type} mastery → ${value}`);
    persist(next);
  }, [profile, persist]);

  const debugGenerateIslandName = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const island = IslandService.createIsland(run, createRng(run.seed), {
      region: "EAST_BLUE",
      archetype: "TROPICAL",
    });
    setDebugFeedback(`New island: ${island.name}`);
    persist(next);
  }, [profile, persist]);

  const debugSetTimeWeather = useCallback(
    (time: TimeOfDay, weather: "CLEAR" | "STORM" | "FOG") => {
      if (!profile?.activeRun) return;
      const next = structuredClone(profile);
      const run = next.activeRun!;
      run.timeOfDay = time;
      run.currentWeather = weather;
      setDebugFeedback(`Time ${time}, weather ${weather}`);
      persist(next);
    },
    [profile, persist],
  );

  const debugClearCooldowns = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    EncounterHistoryService.clearCooldowns(run);
    StoryThreadService.clearCooldowns(run);
    setDebugFeedback("Encounter history and thread cooldowns cleared.");
    persist(next);
  }, [profile, persist]);

  const debugGiveXp = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const result = ProgressionService.grantExperience(run, "player", 120, "debug");
    setDebugFeedback(result.message || "Granted 120 XP.");
    persist(next);
  }, [profile, persist]);

  const debugLevelUp = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    const prog = ProgressionService.getProgression(run, "player");
    prog.experience = ProgressionService.xpToNextLevel(prog.level);
    const result = ProgressionService.grantExperience(run, "player", 1, "debug");
    setDebugFeedback(result.message || "Forced level up.");
    persist(next);
  }, [profile, persist]);

  const debugStatPoint = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    run.player.progression!.availableStatPoints += 1;
    if (!run.pendingLevelUps?.length) {
      run.pendingLevelUps = [{ characterId: "player", fromLevel: run.player.progression!.level, toLevel: run.player.progression!.level + 1 }];
    }
    setDebugFeedback("Added stat point + level-up prompt.");
    persist(next);
  }, [profile, persist]);

  const debugTechniquePoint = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    run.player.progression!.techniquePoints = (run.player.progression!.techniquePoints ?? 0) + 1;
    ProgressionService.queueTechniqueChoice(run, "player");
    setDebugFeedback("Queued technique opportunity.");
    persist(next);
  }, [profile, persist]);

  const debugGenerateChestEncounter = useCallback(() => {
    if (!profile?.activeRun) return;
    const next = structuredClone(profile);
    const run = next.activeRun!;
    run.currentEncounterId = "sealed_chest";
    run.awaitingAdvance = false;
    run.lastResultText = null;
    run.combat = null;
    setDebugFeedback("Loaded Sealed Chest encounter.");
    persist(next);
    setOverlay(null);
    setScreen("game");
  }, [profile, persist]);

  const withRunFeedback = useCallback(
    (fn: (run: NonNullable<ProfileSave["activeRun"]>) => string) => {
      if (!profile?.activeRun) {
        return;
      }
      const next = structuredClone(profile);
      const run = next.activeRun;
      if (!run) {
        return;
      }
      AffiliationService.ensure(run);
      const message = fn(run);
      setDebugFeedback(message);
      persist(next);
    },
    [profile, persist],
  );

  const debugJoinFaction = useCallback(
    (factionId: CareerFactionId) => {
      withRunFeedback((run) =>
        AffiliationService.join(run, {
          factionId,
          note: `Debug join ${factionId}`,
        }),
      );
    },
    [withRunFeedback],
  );

  const debugSetIndependent = useCallback(() => {
    withRunFeedback((run) => AffiliationService.setIndependent(run, "Debug set independent"));
  }, [withRunFeedback]);

  const debugPromote = useCallback(() => {
    withRunFeedback((run) => AffiliationService.promote(run, true));
  }, [withRunFeedback]);

  const debugDemote = useCallback(() => {
    withRunFeedback((run) => AffiliationService.demote(run));
  }, [withRunFeedback]);

  const debugAddFactionReputation = useCallback(
    (amount: number) => {
      withRunFeedback((run) => {
        AffiliationService.adjustInternalReputation(run, amount);
        return `Internal reputation ${amount >= 0 ? "+" : ""}${amount} → ${AffiliationService.get(run).reputationWithinFaction}`;
      });
    },
    [withRunFeedback],
  );

  const debugTriggerRecruitmentOffer = useCallback(
    (factionId: CareerFactionId) => {
      withRunFeedback((run) =>
        AffiliationService.offerRecruitment(run, {
          factionId,
          source: "debug",
        }),
      );
    },
    [withRunFeedback],
  );

  const debugDesert = useCallback(() => {
    withRunFeedback((run) => AffiliationService.leave(run, "DESERT", "Debug desert"));
  }, [withRunFeedback]);

  const debugSwitchFaction = useCallback(
    (factionId: CareerFactionId) => {
      withRunFeedback((run) =>
        AffiliationService.join(run, {
          factionId,
          note: `Debug switch to ${factionId}`,
        }),
      );
    },
    [withRunFeedback],
  );

  const debugGenerateFactionMission = useCallback(() => {
    withRunFeedback((run) => {
      const mission = FactionMissionService.generateMission(run, {
        title: "Debug Patrol",
        description: "A generated faction mission for testing rewards and standing.",
        moralConflict: false,
      });
      return `Mission: ${mission.title} (${mission.id})`;
    });
  }, [withRunFeedback]);

  const debugGenerateFactionOrder = useCallback(() => {
    withRunFeedback((run) => {
      const order = FactionMissionService.issueOrder(run, {
        title: "Debug Direct Order",
        description: "Command requires immediate compliance. Moral weight optional.",
        moralConflict: true,
      });
      return `Order: ${order.title} (${order.id})`;
    });
  }, [withRunFeedback]);

  const debugSetAuthority = useCallback(
    (score: number) => {
      withRunFeedback((run) => {
        AuthorityService.setScore(run, score);
        const auth = AuthorityService.get(run);
        return `Authority set to ${auth.score} (${AuthorityService.stateLabel(auth.state)}).`;
      });
    },
    [withRunFeedback],
  );

  const debugTogglePolicy = useCallback(
    (orderId: string) => {
      withRunFeedback((run) => {
        const active = AuthorityService.toggleOrder(run, orderId);
        return `Policy "${orderId}" now ${active ? "active" : "inactive"}.`;
      });
    },
    [withRunFeedback],
  );

  const debugForcePolicyViolation = useCallback(() => {
    withRunFeedback((run) => {
      const incident = AuthorityService.forceViolation(run);
      return incident.description;
    });
  }, [withRunFeedback]);

  const debugSetRaceKnowledge = useCallback(
    (raceId: string) => {
      withRunFeedback((run) => {
        RaceService.setRunKnowledge(run, raceId, {
          discoveryState: "UNDERSTOOD",
          culturalKnowledge: 3,
          encounterExposure: 2,
          normalRecruitmentUnlocked: raceId !== "FISH_MAN",
        });
        return `Race knowledge updated for ${raceId}.`;
      });
    },
    [withRunFeedback],
  );

  const debugAutoParty = useCallback(() => {
    withRunFeedback((run) => {
      const ids = run.crew.map((member) => member.characterId);
      CrewCombatService.setActiveFighters(run, ids.slice(0, 3));
      CrewCombatService.setSupportSlots(run, ids.slice(3, 6));
      const summary = CrewService.activePartySummary(run);
      return `Party set — fighters: ${summary.fighters.join(", ") || "player only"} · support: ${summary.support.join(", ") || "none"}`;
    });
  }, [withRunFeedback]);

  const debugShowCombatCalc = useCallback(() => {
    withRunFeedback((run) => {
      if (run.combat) {
        const preview = CombatPreviewService.previewAttack(run.combat);
        const last = run.combat.lastCombatResult;
        return [
          preview ? `Preview hit ${preview.hitChance}% · dmg ${preview.damageMin}-${preview.damageMax}` : null,
          last ? `Last: ${last.dodged ? "miss" : `${last.damage} dmg`} · ${last.damageBreakdown.join("; ")}` : "No last result.",
        ]
          .filter(Boolean)
          .join("\n");
      }
      return "Not in combat — spawn a fight first.";
    });
  }, [withRunFeedback]);

  const debugGenerateFleetStory = useCallback(() => {
    withRunFeedback((run) => FleetService.generateFleetStoryStub(run));
  }, [withRunFeedback]);

  const returnToProfileMenu = useCallback(() => {
    setOverlay(null);
    setScreen("profileMenu");
  }, []);

  const acknowledgeGameOver = useCallback(() => {
    if (!profile) {
      setScreen("profileMenu");
      return;
    }
    const next = endRun(profile);
    persist(next);
    setScreen("profileMenu");
    setOverlay(null);
  }, [profile, persist]);

  const value: GameStoreValue = {
    screen,
    overlay,
    profile,
    selectedSlot,
    saves,
    devPreview,
    confirmNewRun,
    confirmResetDev,
    newRunStep,
    raceOffers,
    selectedRaceId,
    selectedOriginId,
    selectedLocationId,
    characterName,
    goProfileSelect,
    openProfile,
    openPlay,
    continueRun,
    requestNewRun,
    cancelNewRunConfirm: () => setConfirmNewRun(false),
    startNewRunFlow,
    setNewRunStep,
    setSelectedRaceId,
    setSelectedOriginId,
    setSelectedLocationId,
    setCharacterName,
    launchRun,
    openOverlay,
    closeOverlay,
    resetDevProfile,
    requestResetDev,
    cancelResetDev,
    choose,
    continueResult,
    dismissAssignmentResults,
    dismissBattleResult,
    finishCombatPresentation,
    combatAction,
    resolveEnemyTurn,
    useCombatItem,
    useInventoryItem,
    equipWeapon,
    unequipWeapon,
    confirmLevelUp,
    selectTechnique,
    skipTechniqueChoice,
    fruitInventoryAction,
    giveFruitToCrew,
    giveWeaponToCrew,
    resolveLootBackpack,
    resolveLootAssign,
    assignStashWeapon,
    assignStashFruit,
    dismissFeedback,
    returnToProfileMenu,
    acknowledgeGameOver,
    debugGenerateRaceOffer,
    debugIncreasePity,
    debugForceCombat,
    debugGiveTestItem,
    debugHealPlayer,
    debugFactionInfluence,
    debugFactionEvent,
    debugDiscoverRevolutionary,
    debugFactionRumor,
    debugGenerateStoryThread,
    debugAdvanceStoryThread,
    debugResolveStoryThread,
    debugGenerateCharacter,
    debugForceJoinInterest,
    debugGiveWeapon,
    debugGiveRandomWeapon,
    debugEquipSelectedWeapon,
    debugPrintEquippedWeaponState,
    debugSetPlayerHp,
    debugDamagePlayer,
    debugGiveDriedMeat,
    debugGiveMedicine,
    debugOpenFoodShop,
    debugOpenClinic,
    debugGenerateSupplySearch,
    debugGenerateTraining,
    debugStartCrewTraining,
    debugEndCrewTraining,
    debugAdvanceTimeSlot,
    debugAdvanceDay,
    debugGenerateCrewRequirement,
    debugGenerateCharacterChoice,
    debugGenerateRuinedMechanism,
    debugGiveKnowledgeCollectable,
    debugSetIntelligence,
    debugClearRunKnowledge,
    debugSetTimeSlots,
    debugSpawnEasyFight,
    debugSpawnStandardFight,
    debugSpawnDeadlyFight,
    debugSpawnTwoEnemyFight,
    debugSpawnFourEnemyFight,
    debugSpawnBossFight,
    debugSpawnBossAddsFight,
    debugSetDay,
    debugShowDifficulty,
    debugShowInitiative,
    debugForceKnownCharacter,
    debugGiveDevilFruit,
    debugAddQuestItem,
    debugRecruitTestCrew,
    debugEquipToCrew,
    debugAddMastery,
    debugGenerateIslandName,
    debugSetTimeWeather,
    debugClearCooldowns,
    debugGiveXp,
    debugLevelUp,
    debugStatPoint,
    debugTechniquePoint,
    debugGenerateChestEncounter,
    debugJoinFaction,
    debugSetIndependent,
    debugPromote,
    debugDemote,
    debugAddFactionReputation,
    debugTriggerRecruitmentOffer,
    debugDesert,
    debugSwitchFaction,
    debugGenerateFactionMission,
    debugGenerateFactionOrder,
    debugSetAuthority,
    debugTogglePolicy,
    debugForcePolicyViolation,
    debugSetRaceKnowledge,
    debugAutoParty,
    debugShowCombatCalc,
    debugGenerateFleetStory,
    debugFeedback,
  };

  return <GameStoreContext.Provider value={value}>{children}</GameStoreContext.Provider>;
}

export function useGameStore(): GameStoreValue {
  const value = useContext(GameStoreContext);
  if (!value) {
    throw new Error("useGameStore must be used within GameStoreProvider");
  }
  return value;
}
