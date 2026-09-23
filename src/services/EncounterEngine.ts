import { getAbilitiesForPlayer } from "../data/abilities";
import { ENCOUNTERS, getEncounterById } from "../data/encounters";
import { getItemDefinition } from "../data/items";
import { getLocation } from "../data/locations";
import { getWeapon } from "../data/weapons";
import { SURRENDER_BERRY_LOSS_RATIO, SURRENDER_HP_LOSS, ISLAND_HUB_ENCOUNTER_ID, AT_SEA_ENCOUNTER_ID, XP_REWARDS } from "../game/constants";
import type {
  Encounter,
  EncounterChoice,
  EncounterCondition,
  EncounterOutcome,
  ProfileSave,
  ResolveResult,
  RunState,
  SparWager,
} from "../models/types";
import { interpolate } from "../utils/text";
import { addUnique, applyStatChanges, clamp, ensurePlayerStats, removeValues } from "../utils/stats";
import { AchievementService } from "./AchievementService";
import { CharacterService } from "./CharacterService";
import { CollectionService } from "./CollectionService";
import { CombatEngine } from "./CombatEngine";
import { BattleResultService } from "./BattleResultService";
import { DevilFruitCombatService } from "./DevilFruitCombatService";
import { DevilFruitService } from "./DevilFruitService";
import { EncounterHistoryService } from "./EncounterHistoryService";
import { FactionService } from "./FactionService";
import { ItemService } from "./ItemService";
import { RaceService } from "./RaceService";
import { StoryThreadService } from "./StoryThreadService";
import { type RandomService, createRng } from "./RandomService";
import { isUnescapableRequest, threatWeightMultiplier } from "./ThreatService";
import { WeaponMasteryService } from "./WeaponMasteryService";
import { WeaponService } from "./WeaponService";
import { WorldService, fruitEncounterMultiplier } from "./WorldService";
import { TrainingService } from "./TrainingService";
import { IslandService } from "./IslandService";
import { DialogueService } from "./DialogueService";
import { StoryChainService } from "./StoryChainService";
import { VoyageService } from "./VoyageService";
import { IslandPressureService } from "./IslandPressureService";
import { AfflictionService } from "./AfflictionService";
import { ProgressionService } from "./ProgressionService";
import { AffiliationService } from "./AffiliationService";
import { IdentityService } from "./IdentityService";
import { CrewService } from "./CrewService";
import { FactionMissionService } from "./FactionMissionService";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { KnowledgeService, getKnowledgeCollectable } from "./KnowledgeService";
import { SparringService, needsBattleSetup } from "./SparringService";
import { MedicalRecoveryService } from "./MedicalRecoveryService";
import { RunEndResolutionService } from "./RunEndResolutionService";
import { MpService } from "./MpService";
import { PartyCombatService } from "./PartyCombatService";
import {
  choiceNeedsParticipants,
  participantBounds,
} from "../game/encounterParticipants";
import { getRankById } from "../data/ranks";
import { resolveTimeCost } from "../utils/presentation";
import type { EncounterTier } from "../models/types";

function shopLabel(shopId: string): string {
  const labels: Record<string, string> = {
    food_stall: "food stall",
    general_store: "general store",
    clinic_shop: "clinic",
    island_inn: "inn",
    weapon_smith: "smithy",
  };
  return labels[shopId] ?? shopId.replaceAll("_", " ");
}

function cloneProfile(profile: ProfileSave): ProfileSave {
  return structuredClone(profile);
}

function requireRun(profile: ProfileSave): RunState {
  if (!profile.activeRun) {
    throw new Error("No active run");
  }
  return profile.activeRun;
}

function hasFlag(flags: string[], flag: string): boolean {
  return flags.includes(flag);
}

export function conditionMet(condition: EncounterCondition, run: RunState): boolean {
  const location = getLocation(run.currentLocationId);
  switch (condition.type) {
    case "PLAYER_FLAG":
      return hasFlag(run.player.flags, condition.flag) !== Boolean(condition.negate);
    case "WORLD_FLAG":
      return hasFlag(run.world.flags, condition.flag) !== Boolean(condition.negate);
    case "RUN_FLAG":
      return hasFlag(run.runFlags, condition.flag) !== Boolean(condition.negate);
    case "MIN_BERRIES":
      return run.player.berries >= condition.value;
    case "MAX_BERRIES":
      return run.player.berries <= condition.value;
    case "MIN_BOUNTY":
      return run.player.bounty >= condition.value;
    case "MIN_HP":
      return run.player.hp >= condition.value;
    case "HAS_EATEN_FRUIT":
      return Boolean(run.player.devilFruitId) !== Boolean(condition.negate);
    case "PLAYER_FRUIT":
      return run.player.devilFruitId === condition.fruitId;
    case "FRUIT_STATUS": {
      const fruit = run.world.devilFruits.find((entry) => entry.fruitId === condition.fruitId);
      return fruit?.status === condition.status;
    }
    case "ANY_UNCLAIMED_FRUIT":
      return run.world.devilFruits.some((entry) => entry.status === "UNCLAIMED");
    case "NPC_TAGS": {
      const found = WorldService.findNpcByTags(run, condition.tags, condition.alive ?? true, {
        recruitableOnly: condition.recruitableOnly,
      });
      return Boolean(found) !== Boolean(condition.negate);
    }
    case "PLAYER_RACE":
      return (run.player.raceId === condition.raceId) !== Boolean(condition.negate);
    case "REGION":
      return location?.regionId === condition.regionId;
    case "LOCATION":
      return run.currentLocationId === condition.locationId;
    case "ANY_LOCATION":
      return condition.locationIds.includes(run.currentLocationId);
    case "FACTION_MIN":
      return FactionService.getRelationship(run, condition.factionId).value >= condition.value;
    case "FACTION_MAX":
      return FactionService.getRelationship(run, condition.factionId).value <= condition.value;
    case "FACTION_DISCOVERED":
      return FactionService.isFactionDiscovered(run, condition.factionId) !== Boolean(condition.negate);
    case "PLAYER_AFFILIATION": {
      if (condition.factionId === "BOUNTY_HUNTER") {
        const isHunter = IdentityService.isPlayerBountyHunter(run);
        return isHunter !== Boolean(condition.negate);
      }
      const belongs = AffiliationService.belongsToFaction(run, condition.factionId);
      return belongs !== Boolean(condition.negate);
    }
    case "PLAYER_ROLE": {
      const has = IdentityService.hasRole(run, condition.roleId);
      return has !== Boolean(condition.negate);
    }
    case "PLAYER_LEGAL_STATUS": {
      const status = IdentityService.get(run).legalStatusId;
      const matched = status === condition.statusId;
      return matched !== Boolean(condition.negate);
    }
    case "MEMBERSHIP_STATUS": {
      const status = AffiliationService.get(run).membershipStatus;
      const matched = condition.statuses.includes(status);
      return matched !== Boolean(condition.negate);
    }
    case "MIN_RANK_ORDER": {
      const aff = AffiliationService.get(run);
      if (aff.primaryFactionId !== condition.factionId) {
        return false;
      }
      const rank = aff.rankId ? getRankById(aff.rankId) : undefined;
      return (rank?.order ?? -1) >= condition.order;
    }
    case "WORLD_POWER_MIN":
      return run.world.worldPower[condition.field] >= condition.value;
    case "STORY_THREAD": {
      const thread = StoryThreadService.getThreadByTemplate(run, condition.templateId);
      if (!thread) {
        return false;
      }
      if (condition.state && thread.state !== condition.state) {
        return false;
      }
      if (condition.minStage != null && thread.stage < condition.minStage) {
        return false;
      }
      return true;
    }
    case "WORLD_PROGRESSION":
      return Boolean(run.worldProgressionFlags[condition.flag]) !== Boolean(condition.negate);
    case "ENCOUNTER_TIER":
      return tierAllowed(condition.tier, run) !== Boolean(condition.negate);
    case "MIN_MASTERY":
      return WeaponService.getMastery(run.player, condition.weaponType) >= condition.value;
    case "HAS_STYLE": {
      const unlocked = run.player.unlockedStyles ?? [];
      const has = unlocked.includes(condition.styleId) || run.player.activeCombatStyle === condition.styleId;
      return has !== Boolean(condition.negate);
    }
    case "CREW_MIN":
      return run.crew.length >= condition.value;
    case "CREW_AVAILABLE_MIN":
      return CharacterScheduleService.availableCount(run) >= condition.value;
    case "CREW_ROLE": {
      const count = run.crew.filter((member) => member.role === condition.role).length;
      return count >= (condition.minCount ?? 1);
    }
    case "CREW_RACE": {
      return RaceService.hasCrewRace(run, condition.raceId, condition.minCount ?? 1);
    }
    case "STAT_MIN": {
      if (condition.target === "any_crew") {
        return run.crew.some((member) => {
          const character = CharacterService.getCharacter(run, member.characterId);
          if (!character) return false;
          const stats = ensurePlayerStats(
            character.crewStats ?? {
              strength: character.strength,
              defense: Math.max(1, character.strength - 1),
              speed: Math.max(1, character.strength - 2),
              willpower: Math.max(2, Math.floor(character.strength / 2)),
              charisma: 2,
            },
          );
          return stats[condition.stat] >= condition.value;
        });
      }
      return run.player.stats[condition.stat] >= condition.value;
    }
    case "TECHNIQUE": {
      if (condition.target === "player" || !condition.target) {
        return (run.player.unlockedTechniques ?? []).includes(condition.techniqueId);
      }
      return false;
    }
    case "HAS_ITEM": {
      const qty = condition.quantity ?? 1;
      const total = run.player.inventory
        .filter((item) => (item.itemId || item.id) === condition.itemId)
        .reduce((sum, item) => sum + (item.quantity ?? 1), 0);
      return total >= qty;
    }
    case "RUN_KNOWLEDGE": {
      const ok = KnowledgeService.hasAtLeast(
        run,
        condition.subjectId,
        condition.minStage ?? "LIMITED",
      );
      return ok !== Boolean(condition.negate);
    }
    case "HAS_FACILITY": {
      const island = IslandService.getCurrentIsland(run);
      const has = IslandService.hasFacility(island, condition.facilityId);
      return has !== Boolean(condition.negate);
    }
    case "ISLAND_FLAG": {
      const island = IslandService.getCurrentIsland(run);
      const has = IslandService.hasDiscoveryFlag(island, condition.flag);
      return has !== Boolean(condition.negate);
    }
    case "ACTIVITY_MODE": {
      const mode = run.activityMode ?? "ISLAND";
      const matched = mode === condition.mode;
      return matched !== Boolean(condition.negate);
    }
    case "MIN_ISLAND_PRESSURE": {
      const island = IslandService.getCurrentIsland(run);
      return (island?.pressureLevel ?? 0) >= condition.value;
    }
    case "MAX_ISLAND_PRESSURE": {
      const island = IslandService.getCurrentIsland(run);
      return (island?.pressureLevel ?? 0) <= condition.value;
    }
    case "MIN_ISLAND_TRUST": {
      const island = IslandService.getCurrentIsland(run);
      return (island?.trustLevel ?? 0) >= condition.value;
    }
    default:
      return true;
  }
}

const TIER_ORDER: EncounterTier[] = ["EARLY", "MID", "LATE", "LEGENDARY"];

function runTier(run: RunState): EncounterTier {
  const flags = run.worldProgressionFlags;
  if (flags.first_rival || run.encounterCount >= 20) {
    return "LEGENDARY";
  }
  if (flags.first_bounty || run.encounterCount >= 12) {
    return "LATE";
  }
  if (flags.first_crew || run.encounterCount >= 5) {
    return "MID";
  }
  return "EARLY";
}

function tierAllowed(required: EncounterTier, run: RunState): boolean {
  const current = runTier(run);
  return TIER_ORDER.indexOf(required) <= TIER_ORDER.indexOf(current);
}

export function conditionsMet(
  conditions: EncounterCondition[] | undefined,
  run: RunState,
): boolean {
  if (!conditions?.length) {
    return true;
  }
  return conditions.every((condition) => conditionMet(condition, run));
}

function isSoftLockCondition(condition: EncounterCondition): boolean {
  return (
    condition.type === "MIN_BERRIES" ||
    condition.type === "MIN_HP" ||
    condition.type === "MIN_BOUNTY" ||
    condition.type === "HAS_EATEN_FRUIT" ||
    condition.type === "CREW_AVAILABLE_MIN"
  );
}

function softLockReason(choice: EncounterChoice, run: RunState): string | undefined {
  for (const condition of choice.conditions ?? []) {
    if (!isSoftLockCondition(condition) || conditionMet(condition, run)) {
      continue;
    }
    if (condition.type === "MIN_BERRIES") {
      return `Need ฿${condition.value}`;
    }
    if (condition.type === "MIN_HP") {
      return `Need ${condition.value} HP`;
    }
    if (condition.type === "MIN_BOUNTY") {
      return `Need bounty ${condition.value}`;
    }
    if (condition.type === "HAS_EATEN_FRUIT") {
      return condition.negate ? "Already bound to a fruit" : "Need a Devil Fruit";
    }
    if (condition.type === "CREW_AVAILABLE_MIN") {
      const have = CharacterScheduleService.availableCount(run);
      return `${have} / ${condition.value} available`;
    }
  }

  const req = CharacterScheduleService.evaluateRequirements(run, choice.participantRequirements);
  if (!req.ok) {
    return req.reasons[0];
  }

  const { min: minParticipants } = participantBounds(choice);
  if (minParticipants > 0) {
    const have = CharacterScheduleService.availableCount(run);
    if (have < minParticipants) {
      return `${have} / ${minParticipants} available`;
    }
  }

  return undefined;
}

export type PresentedEncounterChoice = {
  choice: EncounterChoice;
  available: boolean;
  lockReason?: string;
};

function presentedChoices(encounter: Encounter, run: RunState): PresentedEncounterChoice[] {
  return encounter.choices.flatMap((choice) => {
    const hard = (choice.conditions ?? []).filter((condition) => !isSoftLockCondition(condition));
    if (!conditionsMet(hard, run)) {
      return [];
    }
    const lockReason = softLockReason(choice, run);
    return [{ choice, available: !lockReason, lockReason }];
  });
}

function availableChoices(encounter: Encounter, run: RunState): EncounterChoice[] {
  return encounter.choices.filter((choice) => conditionsMet(choice.conditions, run));
}

/** True when any choice outcome tries to recruit / offer joining the crew. */
function encounterOffersCrewJoin(encounter: Encounter): boolean {
  return encounter.choices.some(
    (choice) => Boolean(choice.outcome.acceptRecruitment) || Boolean(choice.outcome.offerRecruitment),
  );
}

/**
 * Resolve who a join-offer encounter would target. Existing crew / fleet are never
 * valid — those characters stay fully out of the join rotation.
 */
function resolveJoinTargetId(encounter: Encounter, run: RunState): string | null {
  for (const choice of encounter.choices) {
    const explicit =
      choice.outcome.acceptRecruitment?.characterId ?? choice.outcome.offerRecruitment?.characterId;
    if (explicit) {
      return explicit;
    }
  }
  if (encounter.bindCharacterId) {
    return encounter.bindCharacterId;
  }
  if (encounter.bindNpcTags?.length) {
    return WorldService.findRecruitableNpcByTags(run, encounter.bindNpcTags)?.id ?? null;
  }
  if (run.currentBoundNpcId) {
    return run.currentBoundNpcId;
  }
  return null;
}

function joinEncounterAvailable(encounter: Encounter, run: RunState): boolean {
  if (!encounterOffersCrewJoin(encounter)) {
    return true;
  }
  const targetId = resolveJoinTargetId(encounter, run);
  if (!targetId) {
    return false;
  }
  return CrewService.canOfferRecruitment(run, targetId);
}

function effectiveWeight(encounter: Encounter, run: RunState): number {
  const location = getLocation(run.currentLocationId);
  const regions = encounter.regions ?? ["EAST_BLUE"];
  if (location && !regions.includes(location.regionId)) {
    return 0;
  }
  if (!joinEncounterAvailable(encounter, run)) {
    return 0;
  }
  let weight = encounter.weight;
  if (encounter.fruitEncounter) {
    weight *= fruitEncounterMultiplier(run);
  }
  if (encounter.relevantRaces?.includes(run.player.raceId)) {
    weight *= 1.4;
  }
  weight *= threatWeightMultiplier(encounter, run);
  weight *= EncounterHistoryService.historyWeightMultiplier(run, encounter);
  weight *= StoryThreadService.contextScore(run, encounter);
  if (encounter.tier && !tierAllowed(encounter.tier, run)) {
    return 0;
  }
  if (encounter.storyThreadTemplateId) {
    const thread = StoryThreadService.getThreadByTemplate(run, encounter.storyThreadTemplateId);
    if (!thread) {
      weight *= 0.15;
    } else {
      weight *= 1.6;
    }
  }
  return weight;
}

function bindEncounter(run: RunState, encounter: Encounter, rng: RandomService): void {
  run.currentBoundFruitId = null;
  run.currentBoundNpcId = null;

  if (encounter.bindNpcTags?.length) {
    const preferRecruitable = encounterOffersCrewJoin(encounter);
    const npc = preferRecruitable
      ? WorldService.findRecruitableNpcByTags(run, encounter.bindNpcTags)
      : WorldService.findNpcByTags(run, encounter.bindNpcTags, true);
    if (npc) {
      run.currentBoundNpcId = npc.id;
      if (npc.devilFruitId) {
        run.currentBoundFruitId = npc.devilFruitId;
      }
    }
  }

  if (encounter.bindCharacterId) {
    const npc = CharacterService.getCharacter(run, encounter.bindCharacterId);
    if (npc?.alive) {
      if (!encounterOffersCrewJoin(encounter) || CrewService.canOfferRecruitment(run, npc.id)) {
        run.currentBoundNpcId = npc.id;
      }
    }
  }

  if (!run.currentBoundFruitId && encounter.bindFruit) {
    if (encounter.bindFruit === "UNCLAIMED") {
      run.currentBoundFruitId = DevilFruitService.pickUnclaimed(run, rng, "bomu_bomu");
    } else {
      run.currentBoundFruitId = encounter.bindFruit;
    }
  }
}

function markDeath(run: RunState, cause: string): void {
  run.player.hp = 0;
  run.gameOver = true;
  run.deathCause = run.deathCause ?? cause;
}

function defaultSurrenderOutcome(run: RunState): EncounterOutcome {
  const berryLoss = Math.round(run.player.berries * SURRENDER_BERRY_LOSS_RATIO);
  return {
    text: "You yield. They take a cut of your purse, leave you a bruise, and let you crawl away. Alive is still a kind of victory.",
    berriesChange: berryLoss ? -berryLoss : 0,
    hpChange: -SURRENDER_HP_LOSS,
    deathCause: "Succumbed to injuries",
  };
}

function normalizeCombatRequest(run: RunState, outcome: EncounterOutcome): void {
  if (!outcome.combat) {
    return;
  }
  const combat = outcome.combat;
  combat.combatKind = combat.combatKind ?? "NORMAL";
  if (!isUnescapableRequest(combat)) {
    combat.canEscape = combat.canEscape !== false;
  }
  if (!combat.surrender) {
    combat.surrender = defaultSurrenderOutcome(run);
  }
}

function applyCombatHpFeedback(run: RunState): void {
  const hits = run.combat?.lastHits ?? [];
  const taken = hits.filter((hit) => hit.side === "PLAYER" && hit.kind === "HIT");
  const healed = hits.filter((hit) => hit.side === "PLAYER" && hit.kind === "HEAL");
  if (taken.length) {
    run.lastHpChange = -taken.reduce((sum, hit) => sum + hit.amount, 0);
  } else if (healed.length) {
    run.lastHpChange = healed.reduce((sum, hit) => sum + hit.amount, 0);
  }
}

function applyHp(run: RunState, change: number | undefined): void {
  if (!change) {
    return;
  }
  let amount = change;
  if (amount > 0) {
    const hasDoctor = run.crew.some((member) => member.role === "DOCTOR");
    const hasCook = run.crew.some((member) => member.role === "COOK");
    if (hasDoctor) {
      amount = Math.round(amount * 1.15);
    } else if (hasCook) {
      amount = Math.round(amount * 1.08);
    }
  }
  run.lastHpChange = amount;
  run.player.hp = clamp(run.player.hp + amount, 0, run.player.maxHp);
}

function applyMp(run: RunState, change: number | undefined): void {
  if (!change) {
    return;
  }
  MpService.ensurePlayer(run.player);
  const maxMp = run.player.maxMp ?? MpService.maxMpFor(run.player);
  run.player.mp = clamp((run.player.mp ?? 0) + change, 0, maxMp);
}

function syncCombatResources(run: RunState): void {
  if (!run.combat) {
    return;
  }
  run.player.hp = run.combat.playerCombatant.hp;
  run.player.mp = run.combat.playerCombatant.mp;
  for (const ally of run.combat.party?.allyCombatants ?? []) {
    const member = run.crew.find((entry) => entry.characterId === ally.id);
    if (!member) {
      continue;
    }
    member.hp = ally.hp;
    member.mp = ally.mp ?? member.mp;
  }
}

function touchMilestones(profile: ProfileSave, ids: string[] | undefined): void {
  if (!ids?.length) {
    return;
  }
  profile.progression.milestones = addUnique(profile.progression.milestones, ids);
}

function resolveCharacterId(run: RunState, characterId?: string): string | null {
  return characterId ?? run.currentBoundNpcId;
}

const RECRUIT_NPC_STUBS: Record<
  string,
  { name: string; faction: "MARINE" | "PIRATE" | "CIVILIAN" | "UNDERWORLD" }
> = {
  npc_milo_hunter: { name: "Milo", faction: "CIVILIAN" },
  npc_marine_hana: { name: "Hana", faction: "MARINE" },
  npc_dock_hand: { name: "Dock Hand", faction: "PIRATE" },
  npc_hunter_kira: { name: "Kira", faction: "CIVILIAN" },
  npc_cp_veyl: { name: "Veyl", faction: "UNDERWORLD" },
  npc_celestial_wannabe: { name: "Hopeful Sailor", faction: "CIVILIAN" },
  npc_celestial_attendant: { name: "Attendant", faction: "CIVILIAN" },
};

function ensureRecruitNpc(run: RunState, characterId: string): void {
  if (CharacterService.getCharacter(run, characterId)) return;
  const stub = RECRUIT_NPC_STUBS[characterId] ?? {
    name: characterId.replace(/^npc_/, "").replace(/_/g, " "),
    faction: "CIVILIAN" as const,
  };
  CharacterService.getOrCreateCharacter(run, {
    id: characterId,
    name: stub.name,
    faction: stub.faction,
    tags: ["recruit_stub"],
    joinInterest: 80,
    relationshipWithPlayer: 2,
  });
}

function applyStoryAndCharacterOutcomes(run: RunState, outcome: EncounterOutcome, lines: string[]): void {
  if (outcome.startStoryThread) {
    const thread = StoryThreadService.createThread(run, outcome.startStoryThread, {
      characterIds: run.currentBoundNpcId ? [run.currentBoundNpcId] : [],
    });
    if (thread) {
      lines.push(`${thread.title} — a new thread begins.`);
      if (thread.templateId === "red_fang_rivalry" && !run.worldProgressionFlags.first_rival) {
        run.worldProgressionFlags.first_rival = true;
      }
    }
  }
  if (outcome.advanceStoryThread) {
    StoryThreadService.advanceStage(run, outcome.advanceStoryThread);
  }
  if (outcome.resolveStoryThread) {
    StoryThreadService.resolve(run, outcome.resolveStoryThread);
  }
  if (outcome.failStoryThread) {
    StoryThreadService.fail(run, outcome.failStoryThread);
  }

  const memoryCharacterId = resolveCharacterId(run, outcome.addCharacterMemory?.characterId);
  if (outcome.addCharacterMemory && memoryCharacterId) {
    CharacterService.addMemory(
      run,
      memoryCharacterId,
      outcome.addCharacterMemory.type,
      outcome.addCharacterMemory.importance ?? 1,
      outcome.addCharacterMemory.note,
    );
    const greeting = CharacterService.memoryAwareGreeting(run, memoryCharacterId);
    if (greeting) {
      lines.push(greeting);
    }
  }

  const meetingId = resolveCharacterId(run, outcome.recordFirstMeeting?.characterId);
  if (outcome.recordFirstMeeting && meetingId) {
    CharacterService.recordFirstMeeting(run, meetingId);
  }

  const interestId = resolveCharacterId(run, outcome.modifyJoinInterest?.characterId);
  if (outcome.modifyJoinInterest && interestId) {
    CharacterService.modifyJoinInterest(run, interestId, outcome.modifyJoinInterest.amount);
  }

  if (outcome.offerRecruitment) {
    const offerId = resolveCharacterId(run, outcome.offerRecruitment.characterId);
    if (offerId) {
      if (!CrewService.canOfferRecruitment(run, offerId)) {
        lines.push(CrewService.alreadyOnTeamMessage(run, offerId));
      } else {
        CharacterService.modifyJoinInterest(run, offerId, 25);
        const character = CharacterService.getCharacter(run, offerId);
        if (character) {
          const party = AffiliationService.getCrewLabel(run).toLowerCase();
          lines.push(`${character.name} is considering joining your ${party}.`);
        }
      }
    }
  }

  const recruitId = resolveCharacterId(run, outcome.acceptRecruitment?.characterId);
  if (outcome.acceptRecruitment && recruitId) {
    if (!CrewService.canOfferRecruitment(run, recruitId)) {
      lines.push(CrewService.alreadyOnTeamMessage(run, recruitId));
    } else {
      ensureRecruitNpc(run, recruitId);
      const result = CrewService.resolveRecruitment(
        run,
        recruitId,
        outcome.acceptRecruitment.role ?? "FIGHTER",
        outcome.acceptRecruitment.membership,
      );
      lines.push(result.message);
    }
  }

  if (outcome.offerFactionRecruitment) {
    const msg = AffiliationService.offerRecruitment(run, {
      factionId: outcome.offerFactionRecruitment.factionId,
      rankId: outcome.offerFactionRecruitment.rankId,
      organizationId: outcome.offerFactionRecruitment.organizationId,
      source: outcome.offerFactionRecruitment.source ?? run.currentEncounterId ?? "encounter",
      benefits: outcome.offerFactionRecruitment.benefits,
      consequences: outcome.offerFactionRecruitment.consequences,
    });
    lines.push(msg);
  }
  if (outcome.joinFaction) {
    lines.push(
      AffiliationService.join(run, {
        factionId: outcome.joinFaction.factionId,
        rankId: outcome.joinFaction.rankId,
        organizationId: outcome.joinFaction.organizationId,
        asProspect: outcome.joinFaction.asProspect,
        note: outcome.joinFaction.note,
      }),
    );
  }
  if (outcome.setRole) {
    IdentityService.setRole(
      run,
      outcome.setRole.roleId,
      outcome.setRole.rankId,
      outcome.setRole.note,
    );
    lines.push(`Your path shifts: you are now known as a ${outcome.setRole.roleId.replace(/_/g, " ").toLowerCase()}.`);
  }
  if (outcome.setLegalStatus) {
    IdentityService.setLegalStatus(run, outcome.setLegalStatus.statusId, outcome.setLegalStatus.note);
    lines.push(`Legal standing: ${outcome.setLegalStatus.statusId.replace(/_/g, " ").toLowerCase()}.`);
  }
  if (outcome.tendencyChanges) {
    IdentityService.applyTendencyChanges(run, outcome.tendencyChanges);
    if (IdentityService.hasRole(run, "CELESTIAL_DRAGON")) {
      const compassion = outcome.tendencyChanges.compassion ?? 0;
      const entitlement = outcome.tendencyChanges.entitlement ?? 0;
      if (compassion > 0) {
        IdentityService.nudgeCelestial(run, { humanConnection: Math.round(compassion / 2), acceptance: -2 });
      }
      if (entitlement > 0) {
        IdentityService.nudgeCelestial(run, { privilegeLevel: Math.round(entitlement / 2), humanConnection: -2 });
      }
    }
  }
  if (outcome.leaveFaction) {
    lines.push(AffiliationService.leave(run, outcome.leaveFaction.mode, outcome.leaveFaction.note));
  }
  if (outcome.setIndependent) {
    lines.push(AffiliationService.setIndependent(run, outcome.setIndependent.note));
  }
  if (outcome.promoteRank) {
    lines.push(AffiliationService.promote(run));
  }
  if (outcome.demoteRank) {
    lines.push(AffiliationService.demote(run));
  }
  if (outcome.adjustLoyalty) {
    AffiliationService.adjustLoyalty(run, outcome.adjustLoyalty);
  }
  if (outcome.adjustInternalReputation) {
    AffiliationService.adjustInternalReputation(run, outcome.adjustInternalReputation);
  }
  if (outcome.issueFactionOrder) {
    const order = FactionMissionService.issueOrder(run, {
      title: outcome.issueFactionOrder.title,
      description: outcome.issueFactionOrder.description,
      factionId: outcome.issueFactionOrder.factionId,
      moralConflict: outcome.issueFactionOrder.moralConflict,
    });
    lines.push(`Order received: ${order.title}.`);
  }
  if (outcome.completeFactionOrder) {
    lines.push(
      FactionMissionService.completeOrder(
        run,
        outcome.completeFactionOrder.orderId,
        outcome.completeFactionOrder.success !== false,
      ),
    );
  }
  if (outcome.generateFactionMission) {
    const mission = FactionMissionService.generateMission(run, {
      title: outcome.generateFactionMission.title,
      description: outcome.generateFactionMission.description,
      factionId: outcome.generateFactionMission.factionId,
      moralConflict: outcome.generateFactionMission.moralConflict,
    });
    lines.push(`Mission available: ${mission.title}.`);
  }

  const bumpId = resolveCharacterId(run, outcome.bumpCharacterImportance?.characterId);
  if (outcome.bumpCharacterImportance && bumpId) {
    CharacterService.bumpImportance(run, bumpId, outcome.bumpCharacterImportance.amount);
  }

  if (outcome.grantWeaponId) {
    const granted = WeaponService.grantWeapon(run, outcome.grantWeaponId);
    if (granted) {
      const def = getWeapon(outcome.grantWeaponId);
      lines.push(`Found: ${def?.name ?? outcome.grantWeaponId}. Assign it from the crew screen or keep it in the backpack.`);
    }
  }
  if (outcome.discoverShop) {
    const island = IslandService.getCurrentIsland(run);
    if (island) {
      if (!island.knownShops) {
        island.knownShops = [];
      }
      if (!island.knownShops.includes(outcome.discoverShop)) {
        island.knownShops.push(outcome.discoverShop);
        lines.push(`You note the location of the ${shopLabel(outcome.discoverShop)}.`);
      }
      run.runFlags = addUnique(run.runFlags, [`known_shop_${outcome.discoverShop}`]);
    } else {
      run.runFlags = addUnique(run.runFlags, [`known_shop_${outcome.discoverShop}`]);
      lines.push(`You mark down a ${shopLabel(outcome.discoverShop)} for later.`);
    }
  }
  if (outcome.goToEncounter) {
    run.pendingEncounterId = outcome.goToEncounter;
  }
  if (outcome.seekRandomEncounter) {
    run.pendingSeekRandomEncounter = true;
  }
  if (outcome.adjustIslandPressure != null || outcome.adjustIslandTrust != null || outcome.adjustIslandDevelopment != null || outcome.adjustIslandProtection != null) {
    const island = IslandPressureService.ensureCurrent(run);
    if (island) {
      if (outcome.adjustIslandPressure) {
        IslandPressureService.adjustPressure(island, outcome.adjustIslandPressure);
      }
      if (outcome.adjustIslandTrust) {
        IslandPressureService.adjustTrust(island, outcome.adjustIslandTrust);
      }
      if (outcome.adjustIslandDevelopment) {
        IslandPressureService.adjustDevelopment(island, outcome.adjustIslandDevelopment);
      }
      if (outcome.adjustIslandProtection) {
        IslandPressureService.adjustProtection(island, outcome.adjustIslandProtection);
      }
    }
  }
  if (outcome.fundIslandProject) {
    lines.push(IslandPressureService.fundProject(run, outcome.fundIslandProject));
  }
  if (outcome.acceptIslandProtection) {
    lines.push(IslandPressureService.acceptProtection(run));
  }
  if (outcome.shipRepair || outcome.shipUpgradeSpeed) {
    const ship = VoyageService.ensureShip(run);
    if (outcome.shipRepair) {
      const before = ship.condition;
      ship.condition = Math.max(5, Math.min(100, ship.condition + outcome.shipRepair));
      if (outcome.shipRepair < 0) {
        lines.push(`Hull takes damage ${before}% → ${ship.condition}%.`);
      } else {
        lines.push(`Hull repaired ${before}% → ${ship.condition}%.`);
      }
    }
    if (outcome.shipUpgradeSpeed) {
      ship.speed = Math.round((ship.speed + outcome.shipUpgradeSpeed) * 10) / 10;
      lines.push(`${ship.name} sails faster (speed ${ship.speed}).`);
    }
  }
  if (outcome.clearAfflictions) {
    const targetId = run.pendingParticipantId ?? "player";
    AfflictionService.clearMedicalDots(run, targetId);
    lines.push("Toxins and fever ease under treatment.");
  }
  if (outcome.unlockFightingStyle) {
    WeaponService.unlockStyle(run, outcome.unlockFightingStyle);
  }
  if (outcome.setWorldProgressionFlag) {
    run.worldProgressionFlags[outcome.setWorldProgressionFlag] = true;
  }
  if (outcome.showIslandIntroduction) {
    const island = run.islands.find((entry) => entry.id === outcome.showIslandIntroduction);
    if (island) {
      const intro = IslandService.introductionText(island, island.region);
      lines.push(intro);
      island.introductionShown = true;
      run.currentIslandId = island.id;
    }
  }
}

function applyOutcome(
  profile: ProfileSave,
  outcome: EncounterOutcome,
  rng: RandomService,
  lines: string[],
): void {
  const run = requireRun(profile);

  if (outcome.text) {
    lines.push(interpolate(outcome.text, run));
  }

  if (outcome.randomTable?.length) {
    const picked = rng.pickWeighted(outcome.randomTable);
    applyOutcome(profile, picked.outcome, rng, lines);
  }

  if (outcome.skillCheck) {
    const actorId = run.pendingParticipantId ?? "player";
    const value = ProgressionService.getStats(run, actorId)[outcome.skillCheck.stat];
    const success = CombatEngine.skillCheck(value, outcome.skillCheck.difficulty, rng);
    const actorName = ProgressionService.getDisplayName(run, actorId);
    lines.push(`${actorName} attempts the check (${outcome.skillCheck.stat} ${value}).`);
    const branch = success ? outcome.skillCheck.success : outcome.skillCheck.failure;
    applyOutcome(profile, branch, rng, lines);
  }

  if (outcome.combat) {
    IslandPressureService.onHostileAction(run, 10);
    normalizeCombatRequest(run, outcome);
    const request = outcome.combat;
    if (needsBattleSetup(request)) {
      run.pendingBattleSetup = SparringService.createSetup(run, request);
      run.combat = null;
      return;
    }
    run.pendingBattleSetup = null;
    run.combat = CombatEngine.createFromRequest(run.player, request, rng, run);
    return;
  }

  applyHp(run, outcome.hpChange);
  applyMp(run, MpService.effectiveOutcomeMpChange(outcome));
  if (outcome.berriesChange) {
    run.player.berries = Math.max(0, run.player.berries + outcome.berriesChange);
  }
  if (outcome.bountyChange) {
    // Active Marines do not accrue personal bounty while serving.
    if (!AffiliationService.isPlayerMarine(run)) {
      run.player.bounty = Math.max(0, run.player.bounty + outcome.bountyChange);
      if (outcome.bountyChange > 0 && !run.worldProgressionFlags.first_bounty) {
        run.worldProgressionFlags.first_bounty = true;
      }
      IdentityService.syncLegalFromBounty(run);
      if (outcome.bountyChange > 0) {
        IdentityService.applyTendencyChanges(run, {
          criminality: Math.min(5, Math.round(outcome.bountyChange / 2000)),
        });
      }
    }
  }
  if (outcome.trainStat) {
    const trainee = run.pendingParticipantId ?? "player";
    const trained = TrainingService.apply(run, outcome.trainStat, rng, trainee);
    if (trained.text) {
      lines.push(trained.text);
    }
    const xpMsg = ProgressionService.grantExperience(
      run,
      trainee === run.player.id ? "player" : trainee,
      XP_REWARDS.TRAINING,
      "training",
    ).message;
    if (xpMsg) {
      lines.push(xpMsg);
    }
  }

  if (outcome.startAssignment) {
    const characterId =
      outcome.startAssignment.characterId ?? run.pendingParticipantId ?? "player";
    const started = CharacterScheduleService.startAssignment(run, {
      characterId,
      type: outcome.startAssignment.type,
      label: outcome.startAssignment.label,
      durationSlots: outcome.startAssignment.durationSlots,
      focus: outcome.startAssignment.focus,
      berriesCost: outcome.startAssignment.berriesCost,
      interruptible: outcome.startAssignment.interruptible,
    });
    lines.push(started.message);
  }

  if (outcome.grantExperience) {
    const xpMsg = ProgressionService.grantExperience(run, "player", outcome.grantExperience).message;
    if (xpMsg) {
      lines.push(xpMsg);
    }
  }

  if (outcome.grantKnowledgeCollectable) {
    const note = KnowledgeService.grantFromCollectable(run, profile, outcome.grantKnowledgeCollectable);
    lines.push(note);
  }

  if (outcome.addInformation) {
    run.runFlags = addUnique(run.runFlags, [`info_${outcome.addInformation}`]);
  }
  if (outcome.addNoise) {
    run.runFlags = addUnique(run.runFlags, ["encounter_noise"]);
  }

  run.player.stats = applyStatChanges(run.player.stats, outcome.statChanges);
  run.player.flags = addUnique(run.player.flags, outcome.addPlayerFlags);
  run.player.flags = removeValues(run.player.flags, outcome.removePlayerFlags);
  run.world.flags = addUnique(run.world.flags, outcome.addWorldFlags);
  run.runFlags = addUnique(run.runFlags, outcome.addRunFlags);
  if (outcome.addIslandDiscoveryFlags?.length) {
    const island = IslandService.getCurrentIsland(run);
    if (island) {
      const added = IslandService.addDiscoveryFlags(island, outcome.addIslandDiscoveryFlags);
      if (added.length) {
        lines.push(
          added.length === 1
            ? "A new lead appears on your mental map of this island."
            : "New leads etch themselves onto your sense of this island.",
        );
      }
    }
  }
  touchMilestones(profile, outcome.addMilestones);

  if (outcome.unlockLocation) {
    if (!profile.progression.unlockedStartingLocations.includes(outcome.unlockLocation)) {
      profile.progression.unlockedStartingLocations.push(outcome.unlockLocation);
    }
  }
  if (outcome.moveToLocation) {
    run.currentLocationId = outcome.moveToLocation;
    if (outcome.moveToLocation === "grand_line_entrance") {
      touchMilestones(profile, ["reached_grand_line"]);
    }
  }

  if (outcome.addInventory?.length) {
    ItemService.grantMany(run, outcome.addInventory, profile);
  }
  if (outcome.grantItemIds?.length) {
    for (const itemId of outcome.grantItemIds) {
      ItemService.grant(run, itemId, 1, profile);
      const def = getItemDefinition(itemId);
      if (def) {
        lines.push(`Added to Backpack: ${def.name}.`);
      }
      if (getKnowledgeCollectable(itemId)) {
        const note = KnowledgeService.grantFromCollectable(run, profile, itemId);
        if (note) {
          lines.push(note);
        }
      }
    }
  }
  if (outcome.removeInventoryIds?.length) {
    run.player.inventory = run.player.inventory.filter((item) => {
      const ids = outcome.removeInventoryIds ?? [];
      return !ids.includes(item.id) && !(item.itemId && ids.includes(item.itemId));
    });
  }

  if (outcome.discoverTechniques?.length) {
    for (const tech of outcome.discoverTechniques) {
      CollectionService.discoverTechnique(profile, tech.fruitId, tech.techniqueId);
    }
  }
  if (outcome.discoverLore?.length) {
    for (const lore of outcome.discoverLore) {
      if (lore.kind === "race") {
        RaceService.unlockLore(profile, lore.id, lore.entryId);
      } else {
        CollectionService.unlockLore(profile, lore.kind, lore.id, lore.entryId);
      }
    }
  }

  if (outcome.devilFruit) {
    const fruitId =
      outcome.devilFruit.fruitId === "BOUND" ? run.currentBoundFruitId : outcome.devilFruit.fruitId;
    const extra = DevilFruitService.resolveAction(run, outcome.devilFruit, rng);
    if (extra) {
      lines.push(interpolate(extra, run));
    }
    if (fruitId) {
      CollectionService.discoverFruit(profile, fruitId);
    }
    if (outcome.devilFruit.action === "EAT") {
      profile.statistics.fruitsEaten += 1;
      if (fruitId) {
        CollectionService.raiseFruitKnowledge(profile, fruitId, 2);
      }
    }
  }

  if (outcome.createNpc) {
    WorldService.upsertNpc(run, structuredClone(outcome.createNpc));
  }

  if (outcome.factionChanges?.length) {
    for (const change of outcome.factionChanges) {
      FactionService.modifyRelationship(run, change.factionId, change.amount, change.reason);
    }
  }

  if (outcome.raceDiscoveries?.length) {
    for (const discovery of outcome.raceDiscoveries) {
      RaceService.registerRaceDiscovery(
        profile,
        discovery.raceId,
        discovery.sourceId,
        discovery.amount ?? 1,
        run.id,
      );
    }
  }

  if (outcome.worldPowerChanges) {
    const power = run.world.worldPower;
    if (outcome.worldPowerChanges.worldGovernmentPower) {
      power.worldGovernmentPower = clamp(
        power.worldGovernmentPower + outcome.worldPowerChanges.worldGovernmentPower,
        0,
        100,
      );
    }
    if (outcome.worldPowerChanges.oppression) {
      power.oppression = clamp(power.oppression + outcome.worldPowerChanges.oppression, 0, 100);
    }
    if (outcome.worldPowerChanges.revolutionaryActivity) {
      power.revolutionaryActivity = clamp(
        power.revolutionaryActivity + outcome.worldPowerChanges.revolutionaryActivity,
        0,
        100,
      );
    }
  }

  if (outcome.worldNews) {
    WorldService.addNews(run, interpolate(outcome.worldNews, run));
  }

  applyStoryAndCharacterOutcomes(run, outcome, lines);

  if (run.player.hp <= 0) {
    markDeath(run, outcome.deathCause ?? "Succumbed to injuries");
  }
}

function refreshStats(profile: ProfileSave): void {
  const run = profile.activeRun;
  if (!run) {
    return;
  }
  profile.statistics.highestBounty = Math.max(profile.statistics.highestBounty, run.player.bounty);
  profile.statistics.longestRunDays = Math.max(profile.statistics.longestRunDays, run.day);
  profile.statistics.fruitsDiscovered = profile.collection.devilFruits.filter((item) => item.discovered).length;
  AchievementService.evaluate(profile);
}

function concludeCombat(profile: ProfileSave, rng: RandomService): ResolveResult {
  const run = requireRun(profile);
  const combat = run.combat;
  if (!combat?.finished || !combat.result) {
    return { profile, text: run.lastResultText ?? "", gameOver: run.gameOver };
  }
  const lines: string[] = [];
  if (combat.isFriendly) {
    SparringService.softenFriendlyDefeat(run, combat);
  }
  syncCombatResources(run);
  const pending = combat.pendingOutcome;
  const storyLine = StoryChainService.fireEvent(
    run,
    {
      kind: "battle_ended",
      islandId: run.currentIslandId ?? undefined,
      won: combat.result === "WIN",
      encounterId: run.currentEncounterId ?? undefined,
    },
    profile,
  );
  if (storyLine) {
    lines.push(storyLine);
  }
  if (combat.result === "WIN") {
    profile.statistics.combatWins += 1;
    if (combat.isFriendly) {
      const med = MedicalRecoveryService.resolveAfterBattle(run, combat);
      lines.push(...med);
      const sparLines = SparringService.applyFriendlyRewards(run, combat, true);
      lines.push(...sparLines);
      if (pending?.win) {
        applyOutcome(profile, pending.win, rng, lines);
      }
      run.combat = null;
      run.lastResultText = lines.filter(Boolean).join("\n\n");
      run.awaitingAdvance = true;
      refreshStats(profile);
      return { profile, text: run.lastResultText ?? "", gameOver: run.gameOver };
    }
    const medLines = MedicalRecoveryService.resolveAfterBattle(run, combat);
    lines.push(...medLines);
    lines.push(...MedicalRecoveryService.buildPostBattleDialogue(run, combat));
    WeaponService.onCombatWin(run);
    const masteryUnlock = WeaponMasteryService.applyUnlocks(run);
    if (masteryUnlock) {
      lines.push(masteryUnlock);
    }
    const narrativeLines: string[] = [];
    if (combat.party) {
      run.pendingBattleResult = BattleResultService.createFromCombat(run, combat);
    } else {
      const xpMsg = ProgressionService.grantCombatXp(run, combat.combatKind);
      if (xpMsg) {
        lines.push(xpMsg);
        run.lastFeedback = xpMsg;
      }
    }
    if (pending?.win) {
      applyOutcome(profile, pending.win, rng, narrativeLines);
    }
    if (run.pendingBattleResult) {
      // Keep finished combat mounted under the victory overlay until dismiss.
      run.lastResultText = [...lines, ...narrativeLines].filter(Boolean).join("\n\n") || null;
      run.awaitingAdvance = false;
    } else {
      run.combat = null;
      const text = [...lines, ...narrativeLines].filter(Boolean).join("\n\n") || (run.lastResultText ?? "");
      run.lastResultText = text;
      run.awaitingAdvance = true;
    }
    refreshStats(profile);
    return { profile, text: run.lastResultText ?? "", gameOver: run.gameOver };
  } else if (combat.result === "LOSE") {
    profile.statistics.combatLosses += 1;
    if (combat.isFriendly) {
      SparringService.softenFriendlyDefeat(run, combat);
      const med = MedicalRecoveryService.resolveAfterBattle(run, combat);
      lines.push(...med);
      const sparLines = SparringService.applyFriendlyRewards(run, combat, false);
      lines.push(...sparLines);
      if (pending?.lose) {
        // Friendly loses should not apply lethal hpChange from authored outcomes.
        const soft = { ...pending.lose, hpChange: Math.max(pending.lose.hpChange ?? 0, -4) };
        applyOutcome(profile, soft, rng, lines);
      }
      if (run.player.hp <= 0) {
        run.player.hp = 1;
      }
      run.combat = null;
      run.lastResultText = lines.filter(Boolean).join("\n\n");
      run.awaitingAdvance = true;
      refreshStats(profile);
      return { profile, text: run.lastResultText ?? "", gameOver: false };
    }
    // Hostile wipe of participating fighters → recovery, then check usable team.
    const medLines = MedicalRecoveryService.resolveAfterBattle(run, combat);
    lines.push(...medLines);
    const ended = RunEndResolutionService.ensureUsableTeamOrEnd(
      run,
      `Defeated by ${combat.enemies[0]?.name ?? "a stronger foe"}`,
    );
    if (ended) {
      lines.push("No one left to carry the run forward.");
    } else {
      lines.push("The fight is lost — but someone still standing can keep the voyage going.");
      MedicalRecoveryService.stabilizeCaptainIfCrewRemains(run);
    }
    if (pending?.lose && !ended) {
      const softLose = { ...pending.lose };
      // Avoid authored deathCause wiping a recoverable crew.
      delete softLose.deathCause;
      if ((softLose.hpChange ?? 0) < -15) {
        softLose.hpChange = -8;
      }
      applyOutcome(profile, softLose, rng, lines);
      MedicalRecoveryService.stabilizeCaptainIfCrewRemains(run);
      if (MedicalRecoveryService.shouldEndRunAfterWipe(run)) {
        markDeath(run, run.deathCause ?? `Defeated by ${combat.enemies[0]?.name ?? "a stronger foe"}`);
      }
    } else if (pending?.lose && ended) {
      applyOutcome(profile, pending.lose, rng, lines);
      markDeath(run, run.deathCause ?? `Defeated by ${combat.enemies[0]?.name ?? "a stronger foe"}`);
    } else if (ended) {
      markDeath(run, run.deathCause ?? `Defeated by ${combat.enemies[0]?.name ?? "a stronger foe"}`);
    }
  } else if (combat.result === "SURRENDER") {
    const medLines = MedicalRecoveryService.resolveAfterBattle(run, combat);
    lines.push(...medLines);
    if (pending?.surrender) {
      applyOutcome(profile, pending.surrender, rng, lines);
    } else {
      applyOutcome(profile, defaultSurrenderOutcome(run), rng, lines);
    }
    MedicalRecoveryService.stabilizeCaptainIfCrewRemains(run);
  } else if (pending?.escape) {
    // Escaping with KO'd allies: assume the crew retrieves them when possible.
    const medLines = MedicalRecoveryService.resolveAfterBattle(run, combat);
    lines.push(...medLines);
    if (medLines.some((line) => /knocked|recovering|hospital/i.test(line))) {
      lines.push("You haul the fallen with you as you break away.");
    }
    applyOutcome(profile, pending.escape, rng, lines);
  } else {
    const medLines = MedicalRecoveryService.resolveAfterBattle(run, combat);
    lines.push(...medLines);
    lines.push("You leave the fight behind.");
  }
  run.combat = null;
  const text = lines.filter(Boolean).join("\n\n") || (run.lastResultText ?? "");
  run.lastResultText = text;
  run.awaitingAdvance = true;
  refreshStats(profile);
  return { profile, text, gameOver: run.gameOver };
}

export const EncounterEngine = {
  getAvailableEncounters(run: RunState): Encounter[] {
    return ENCOUNTERS.filter((encounter) => {
      if (effectiveWeight(encounter, run) <= 0) {
        return false;
      }
      if (!conditionsMet(encounter.conditions, run)) {
        return false;
      }
      return availableChoices(encounter, run).length > 0;
    });
  },

  selectEncounter(run: RunState, rng = createRng(run.seed)): RunState {
    let pool = this.getAvailableEncounters(run).map((encounter) => ({
      encounter,
      weight: effectiveWeight(encounter, run),
    }));
    if (pool.length > 1 && run.currentEncounterId) {
      const withoutLast = pool.filter((item) => item.encounter.id !== run.currentEncounterId);
      if (withoutLast.length) {
        pool = withoutLast;
      }
    }
    // Prefer story/event content over facility hubs when seeking a random beat.
    const storyPool = pool.filter(
      (item) =>
        item.encounter.id !== ISLAND_HUB_ENCOUNTER_ID &&
        item.encounter.id !== AT_SEA_ENCOUNTER_ID &&
        !IslandService.isFacilityEncounter(item.encounter.id),
    );
    if (storyPool.length > 0) {
      pool = storyPool;
    }
    // While sailing, bias toward SEA category events.
    if ((run.activityMode ?? "ISLAND") === "SAILING") {
      const seaPool = pool.filter((item) => item.encounter.category === "SEA");
      if (seaPool.length > 0) {
        pool = seaPool;
      }
    }
    if (pool.length === 0) {
      pool = ENCOUNTERS.filter((encounter) => availableChoices(encounter, run).length > 0).map(
        (encounter) => ({ encounter, weight: Math.max(0.01, effectiveWeight(encounter, run)) }),
      );
    }
    const picked = rng.pickWeighted(pool);
    bindEncounter(run, picked.encounter, rng);
    run.currentEncounterId = picked.encounter.id;
    return run;
  },

  /** Enter or re-enter the Island State hub as the primary shore screen. */
  enterIslandHub(run: RunState, rng = createRng(run.seed)): RunState {
    run.activityMode = "ISLAND";
    IslandService.ensureAllIslandFacilities(run, rng);
    const island = IslandService.getCurrentIsland(run);
    if (island && !island.introductionShown) {
      const intro = IslandService.showIntroduction(run, island.id, island.region);
      if (intro) {
        run.lastFeedback = intro;
      }
    }
    const hub = getEncounterById(ISLAND_HUB_ENCOUNTER_ID);
    if (!hub) {
      return this.selectEncounter(run, rng);
    }
    bindEncounter(run, hub, rng);
    run.currentEncounterId = hub.id;
    run.dynamicEncounter = null;
    return run;
  },

  getCurrentEncounter(run: RunState): Encounter | null {
    if (run.dynamicEncounter && run.currentEncounterId === run.dynamicEncounter.id) {
      return run.dynamicEncounter;
    }
    if (!run.currentEncounterId) {
      return null;
    }
    return getEncounterById(run.currentEncounterId) ?? null;
  },

  getVisibleChoices(run: RunState): EncounterChoice[] {
    if (run.awaitingAdvance || run.combat) {
      return [];
    }
    const encounter = this.getCurrentEncounter(run);
    if (!encounter) {
      return [];
    }
    return availableChoices(encounter, run);
  },

  getPresentedChoices(run: RunState): PresentedEncounterChoice[] {
    if (run.awaitingAdvance || run.combat) {
      return [];
    }
    const encounter = this.getCurrentEncounter(run);
    if (!encounter) {
      return [];
    }
    return presentedChoices(encounter, run);
  },

  resolveChoice(profile: ProfileSave, choiceId: string, rng = createRng(requireRun(profile).seed)): ResolveResult {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    if (run.awaitingAdvance || run.combat) {
      return {
        profile: next,
        text: run.lastResultText ?? "The moment has already passed.",
        gameOver: run.gameOver,
      };
    }
    const encounter = this.getCurrentEncounter(run);
    if (!encounter) {
      return { profile: next, text: "There is no encounter.", gameOver: run.gameOver };
    }
    const presented = presentedChoices(encounter, run).find((entry) => entry.choice.id === choiceId);
    if (!presented) {
      return { profile: next, text: "That choice is no longer available.", gameOver: run.gameOver };
    }
    if (presented.lockReason) {
      return { profile: next, text: presented.lockReason, gameOver: run.gameOver };
    }
    const choice = presented.choice;
    let exploreIsland = IslandService.getCurrentIsland(run);
    if (encounter.id === "island_hub" && choice.id === "explore") {
      if (exploreIsland) {
        IslandService.recordExplore(exploreIsland);
      }
    }
    const { min: minParticipants } = participantBounds(choice);
    if (minParticipants > 0 || choiceNeedsParticipants(choice)) {
      const selected =
        run.pendingParticipantIds && run.pendingParticipantIds.length > 0
          ? run.pendingParticipantIds
          : run.pendingParticipantId
            ? [run.pendingParticipantId]
            : [];
      if (selected.length < minParticipants) {
        return {
          profile: next,
          text: `Select ${minParticipants} crew member${minParticipants === 1 ? "" : "s"} first.`,
          gameOver: run.gameOver,
        };
      }
      for (const id of selected) {
        if (!CharacterScheduleService.isAvailable(run, id)) {
          return {
            profile: next,
            text: "One of the selected characters is unavailable.",
            gameOver: run.gameOver,
          };
        }
      }
      run.pendingParticipantIds = selected;
      run.pendingParticipantId = selected[0] ?? null;
    }

    run.lastHpChange = null;
    run.lastFeedback = null;
    run.pendingTimeCost = resolveTimeCost(choice.timeCost ?? encounter.timeCost, 1, run.timeOfDay);

    const lines: string[] = [];
    applyOutcome(next, choice.outcome, rng, lines);
    if (encounter.id === "island_inn" && (choice.id === "room" || choice.id === "rest_free")) {
      const restStory = StoryChainService.fireEvent(
        run,
        {
          kind: "rest",
          islandId: run.currentIslandId ?? undefined,
          encounterId: encounter.id,
        },
        next,
      );
      if (restStory) {
        lines.push(restStory);
      }
    }
    if (encounter.id === "island_hub" && choice.id === "explore" && exploreIsland) {
      const flavor = DialogueService.exploreFlavor(run, exploreIsland);
      if (flavor) {
        lines.unshift(flavor);
      }
    }
    run.pendingParticipantId = null;
    run.pendingParticipantIds = [];
    const combat = next.activeRun?.combat;
    if (combat && !combat.finished) {
      run.lastResultText = lines.filter(Boolean).join("\n\n");
      refreshStats(next);
      return { profile: next, text: run.lastResultText, gameOver: run.gameOver };
    }
    const text = lines.filter(Boolean).join("\n\n");
    run.lastResultText = text;
    run.awaitingAdvance = true;
    refreshStats(next);
    return { profile: next, text, gameOver: run.gameOver };
  },

  applyCombatAction(
    profile: ProfileSave,
    action: Parameters<typeof CombatEngine.performAction>[1],
    rng = createRng(requireRun(profile).seed),
  ): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    if (!run.combat || run.combat.finished) {
      return next;
    }
    CombatEngine.syncCaptainVitals(run.combat, run.player, run);
    run.combat = CombatEngine.performAction(run.combat, action, rng, run);
    applyCombatHpFeedback(run);
    if (action.type === "TECHNIQUE" && run.player.devilFruitId && action.abilityId) {
      const unlockLine = DevilFruitCombatService.recordTechniqueUse(next, run, action.abilityId);
      if (unlockLine) {
        run.lastFeedback = unlockLine;
      }
      // Refresh abilities mid-fight when a new fruit skill unlocks / form-gated list changes.
      run.combat.playerCombatant.abilities = getAbilitiesForPlayer(run.player);
      run.combat.playerCombatant.stats = DevilFruitCombatService.effectiveStats(run.player);
    }
    if (action.type === "ATTACK" || action.type === "TECHNIQUE") {
      const masteryLine = WeaponMasteryService.recordCombatAction(next, run, action);
      if (masteryLine && !run.lastFeedback) {
        run.lastFeedback = masteryLine;
      } else if (masteryLine && run.lastFeedback && masteryLine.includes("learned")) {
        run.lastFeedback = `${run.lastFeedback} ${masteryLine}`;
      }
      run.combat.playerCombatant.abilities = getAbilitiesForPlayer(run.player);
    }
    syncCombatResources(run);
    // Leave finished combat mounted so the UI can play hit/defeat presentation first.
    refreshStats(next);
    return next;
  },

  resolveEnemyTurn(
    profile: ProfileSave,
    rng = createRng(requireRun(profile).seed),
  ): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    if (!run.combat || run.combat.finished || run.combat.activeSide !== "ENEMY") {
      return next;
    }
    CombatEngine.syncCaptainVitals(run.combat, run.player, run);
    run.combat = CombatEngine.resolveEnemyTurn(run.combat, rng, run);
    applyCombatHpFeedback(run);
    syncCombatResources(run);
    refreshStats(next);
    return next;
  },

  useCombatItem(
    profile: ProfileSave,
    itemId: string,
    targetCharacterId?: string,
    rng = createRng(requireRun(profile).seed),
  ): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    if (!run.combat || run.combat.finished) {
      return next;
    }
    CombatEngine.syncCaptainVitals(run.combat, run.player, run);
    const item = run.player.inventory.find(
      (entry) => entry.id === itemId || entry.itemId === itemId,
    );
    if (!item) {
      return next;
    }
    const defId = item.itemId || item.id;
    const targetId =
      targetCharacterId ??
      PartyCombatService.getActiveCombatant(run.combat)?.id ??
      run.player.id;
    const used = ItemService.useOnTarget(run, defId, targetId, "COMBAT");
    if (!used.ok) {
      if (used.message) {
        run.lastFeedback = used.message;
      }
      return next;
    }
    run.combat = CombatEngine.applyItemResult(run.combat, used, rng, run, targetId);
    applyCombatHpFeedback(run);
    if (used.message) {
      run.lastFeedback = used.message;
    }
    syncCombatResources(run);
    refreshStats(next);
    return next;
  },

  /** Confirm fighters (and optional wager) from pending battle setup, then start combat. */
  confirmBattleSetup(
    profile: ProfileSave,
    participantIds: string[],
    wager?: SparWager | null,
    rng = createRng(requireRun(profile).seed),
  ): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    const setup = run.pendingBattleSetup;
    if (!setup) {
      return next;
    }
    const request = {
      ...setup.request,
      participantIds,
      forcedParticipantIds: setup.forcedParticipantIds,
      lockParticipants: true,
      wager: wager ?? setup.wager ?? setup.request.wager ?? null,
      requireSetup: false,
    };
    if (request.isFriendly && request.sparKey) {
      const rematch = SparringService.canRematch(run, request.sparKey);
      if (!rematch.ok) {
        run.lastFeedback = rematch.reason;
        return next;
      }
    }
    run.pendingBattleSetup = null;
    run.combat = CombatEngine.createFromRequest(run.player, request, rng, run);
    refreshStats(next);
    return next;
  },

  cancelBattleSetup(profile: ProfileSave): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    run.pendingBattleSetup = null;
    run.lastResultText = "You back away from the challenge.";
    run.awaitingAdvance = true;
    return next;
  },

  /** Called after combat UI finishes hit/defeat presentation. */
  finishCombatPresentation(
    profile: ProfileSave,
    rng = createRng(requireRun(profile).seed),
  ): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    if (!run.combat?.finished) {
      return next;
    }
    concludeCombat(next, rng);
    refreshStats(next);
    return next;
  },

  /** Repair captain max HP/MP if an older combat snapshot used current HP as max. */
  syncCombatVitals(profile: ProfileSave): ProfileSave {
    const next = cloneProfile(profile);
    const run = next.activeRun;
    if (!run?.combat || run.combat.finished) {
      return next;
    }
    const before = run.combat.playerCombatant.maxHp;
    CombatEngine.syncCaptainVitals(run.combat, run.player, run);
    if (run.combat.playerCombatant.maxHp === before) {
      return profile;
    }
    return next;
  },

  completeEncounter(profile: ProfileSave, rng = createRng(requireRun(profile).seed)): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    const pendingEncounterId = run.pendingEncounterId ?? null;
    const chained = pendingEncounterId ? getEncounterById(pendingEncounterId) : null;
    const seekRandom = Boolean(run.pendingSeekRandomEncounter);
    run.pendingEncounterId = null;
    run.pendingSeekRandomEncounter = false;

    if (chained) {
      // Submenu / forced follow-up: spend time from the gate choice, skip XP & random pick.
      run.awaitingAdvance = false;
      run.lastResultText = null;
      run.lastFeedback = null;
      run.lastHpChange = null;
      const completed = WorldService.afterEncounter(run, rng);
      const storyPulse = StoryChainService.notifyTimeAndActivities(run, completed, next);
      if (storyPulse) {
        run.lastFeedback = storyPulse;
      }
      refreshStats(next);
      if (run.gameOver || run.player.hp <= 0) {
        markDeath(run, run.deathCause ?? "Lost at sea");
        WorldService.addNews(run, `${run.player.name} has fallen.`);
        next.statistics.deaths += 1;
        next.statistics.daysSurvivedTotal += run.day;
        refreshStats(next);
        return next;
      }
      bindEncounter(run, chained, rng);
      run.currentEncounterId = chained.id;
      return next;
    }

    const encounter = this.getCurrentEncounter(run);
    if (encounter) {
      EncounterHistoryService.recordEncounter(run, encounter, run.lastResultText ?? "completed");
    }
    run.encounterCount += 1;
    next.statistics.encountersCompleted += 1;
    const fromFacility = IslandService.isFacilityEncounter(encounter?.id);
    // Facility shopping/leave should not farm encounter XP; hub explore & story beats still grant it.
    const grantXp = !fromFacility || seekRandom;
    if (grantXp) {
      const xpMsg = ProgressionService.grantExperience(run, "player", XP_REWARDS.ENCOUNTER, "encounter").message;
      if (xpMsg) {
        run.lastFeedback = run.lastFeedback ? `${run.lastFeedback} ${xpMsg}` : xpMsg;
      }
    }
    if (run.storyThreads.some((thread) => thread.state === "RESOLVED" && thread.lastUpdatedDay === run.day)) {
      ProgressionService.grantExperience(run, "player", XP_REWARDS.STORY_RESOLVE, "story");
    }
    run.awaitingAdvance = false;
    run.lastResultText = null;
    run.lastFeedback = null;
    run.lastHpChange = null;
    const completed = WorldService.afterEncounter(run, rng);
    const storyPulse = StoryChainService.notifyTimeAndActivities(run, completed, next);
    if (storyPulse) {
      run.lastFeedback = storyPulse;
    }
    FactionService.checkRevolutionaryEmergence(next);
    refreshStats(next);
    if (run.gameOver || run.player.hp <= 0) {
      markDeath(run, run.deathCause ?? "Lost at sea");
      WorldService.addNews(run, `${run.player.name} has fallen.`);
      next.statistics.deaths += 1;
      next.statistics.daysSurvivedTotal += run.day;
      refreshStats(next);
      return next;
    }

    const activityMode = run.activityMode ?? "ISLAND";
    if (seekRandom) {
      this.selectEncounter(run, rng);
      return next;
    }
    if (activityMode === "SAILING" && run.activeVoyage) {
      VoyageService.resumeAfterEvent(run);
      return next;
    }
    if (activityMode === "ISLAND") {
      this.enterIslandHub(run, rng);
      StoryChainService.syncObjectives(run);
      return next;
    }
    this.selectEncounter(run, rng);
    return next;
  },

  useOutOfCombatItem(
    profile: ProfileSave,
    itemId: string,
    targetCharacterId?: string,
  ): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    if (run.combat && !run.combat.finished) {
      return next;
    }
    const targetId = targetCharacterId ?? run.player.id;
    const used = ItemService.useOnTarget(run, itemId, targetId, "OUT_OF_COMBAT");
    if (used.ok && used.message) {
      run.lastFeedback = used.message;
      if (used.hpHealed > 0 && (targetId === run.player.id || targetId === "player")) {
        run.lastHpChange = used.hpHealed;
      }
    } else if (used.message) {
      run.lastFeedback = used.message;
    }
    refreshStats(next);
    return next;
  },

  forceCombat(profile: ProfileSave, rng = createRng(requireRun(profile).seed)): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    run.combat = CombatEngine.createFromRequest(
      run.player,
      {
        enemyName: "Debug Sparring Partner",
        enemyStrength: Math.max(3, run.player.stats.strength),
        combatKind: "NORMAL",
        canEscape: true,
        canSurrender: true,
        win: { text: "The sparring dummy hits the deck." },
        lose: { text: "Even a dummy got a hit in.", hpChange: -8 },
        escape: { text: "You step out of the circle." },
        surrender: defaultSurrenderOutcome(run),
      },
      rng,
      run,
    );
    return next;
  },
};
