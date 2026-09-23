import { getRaceDiscoveryProfile } from "../data/raceDiscovery";
import { RACE_OFFER_COUNT } from "../game/constants";
import { HUMAN_RACE_ID, RACES, getRace, requireRace } from "../data/races";
import { loreForRace } from "../data/collectionLore";
import type {
  EncounterTier,
  ProfileSave,
  RaceDefinition,
  RaceDiscoveryState,
  RaceKnowledge,
  RaceOfferPity,
  RaceProgress,
  RunState,
  WorldCharacter,
} from "../models/types";
import type { RandomService } from "./RandomService";
import { StoryThreadService } from "./StoryThreadService";

const TIER_ORDER: EncounterTier[] = ["EARLY", "MID", "LATE", "LEGENDARY"];

function progressFor(profile: ProfileSave, raceId: string): RaceProgress | undefined {
  return profile.progression.races.find((entry) => entry.raceId === raceId);
}

function emptyPity(raceId: string): RaceOfferPity {
  return { raceId, missedOffers: 0, pityBonus: 0 };
}

function pityFor(profile: ProfileSave, raceId: string): RaceOfferPity {
  const existing = profile.raceOfferPity.find((entry) => entry.raceId === raceId);
  if (existing) {
    return existing;
  }
  const created = emptyPity(raceId);
  profile.raceOfferPity.push(created);
  return created;
}

function pityStep(race: RaceDefinition): number {
  return Math.max(8, Math.round(28 - Math.min(race.selectionWeight, 24)));
}

function syncRaceKnowledge(row: RaceProgress): void {
  let level = row.knowledgeLevel ?? 0;
  if (row.known) {
    level = Math.max(level, 1);
  }
  if (row.discoveryProgress >= 2 || row.discoverySources.length >= 2) {
    level = Math.max(level, 2);
  }
  if (row.playable || row.discoveryProgress >= 3) {
    level = Math.max(level, 3);
  }
  if (row.discoveryProgress >= 4 || row.discoverySources.length >= 3) {
    level = Math.max(level, 4);
  }
  row.knowledgeLevel = level;
  const unlocked = new Set(row.unlockedEntries ?? []);
  for (const entry of loreForRace(row.raceId)) {
    if (entry.minLevel <= level) {
      unlocked.add(entry.id);
    }
  }
  row.unlockedEntries = [...unlocked];
}

function ensureRaceRow(profile: ProfileSave, raceId: string): RaceProgress {
  const existing = progressFor(profile, raceId);
  if (existing) {
    existing.knowledgeLevel ??= 0;
    existing.unlockedEntries ??= [];
    return existing;
  }
  const race = requireRace(raceId);
  const created: RaceProgress = {
    raceId,
    known: race.defaultKnown,
    playable: race.defaultPlayable,
    discoveryProgress: 0,
    requiredDiscoveryProgress: race.requiredDiscoveryProgress,
    discoverySources: [],
    knowledgeLevel: race.defaultKnown ? 1 : 0,
    unlockedEntries: race.defaultKnown ? ["intro"] : [],
  };
  profile.progression.races.push(created);
  syncRaceKnowledge(created);
  return created;
}

function effectiveWeight(race: RaceDefinition, pity: RaceOfferPity): number {
  return Math.max(0.01, race.selectionWeight + pity.pityBonus);
}

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

function tierAtLeast(current: EncounterTier, required: EncounterTier): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}

function defaultRunKnowledge(raceId: string): RaceKnowledge {
  const race = getRace(raceId);
  return {
    raceId,
    discoveryState: race?.defaultKnown ? "KNOWN" : "UNKNOWN",
    encounterExposure: 0,
    culturalKnowledge: race?.defaultKnown ? 1 : 0,
    relationshipExposure: 0,
    normalRecruitmentUnlocked: race?.defaultPlayable ?? false,
    playableUnlockProgress: 0,
  };
}

function discoveryStateFor(row: RaceKnowledge): RaceDiscoveryState {
  if (row.playableUnlockProgress >= 4 || row.culturalKnowledge >= 4) {
    return "KNOWN";
  }
  if (row.culturalKnowledge >= 3) {
    return "UNDERSTOOD";
  }
  if (row.encounterExposure >= 1) {
    return "ENCOUNTERED";
  }
  if (row.discoveryState === "RUMORED" || row.culturalKnowledge >= 1) {
    return "RUMORED";
  }
  return row.discoveryState;
}

export const RaceService = {
  ensureRunKnowledge(run: RunState): RaceKnowledge[] {
    if (!run.raceKnowledge) {
      run.raceKnowledge = RACES.map((race) => defaultRunKnowledge(race.id));
    }
    for (const race of RACES) {
      if (!run.raceKnowledge.some((entry) => entry.raceId === race.id)) {
        run.raceKnowledge.push(defaultRunKnowledge(race.id));
      }
    }
    return run.raceKnowledge;
  },

  getRunKnowledge(run: RunState, raceId: string): RaceKnowledge {
    this.ensureRunKnowledge(run);
    return run.raceKnowledge!.find((entry) => entry.raceId === raceId) ?? defaultRunKnowledge(raceId);
  },

  registerRunEncounter(run: RunState, raceId: string, amount = 1): void {
    const row = this.getRunKnowledge(run, raceId);
    row.encounterExposure += amount;
    if (row.discoveryState === "UNKNOWN") {
      row.discoveryState = "ENCOUNTERED";
    } else {
      row.discoveryState = discoveryStateFor(row);
    }
    const profile = getRaceDiscoveryProfile(raceId);
    if (profile && row.culturalKnowledge < profile.culturalThreshold) {
      row.culturalKnowledge += 0.5;
    }
    row.discoveryState = discoveryStateFor(row);
    this.syncRecruitmentUnlock(run, raceId);
  },

  addCulturalKnowledge(run: RunState, raceId: string, amount = 1): void {
    const row = this.getRunKnowledge(run, raceId);
    row.culturalKnowledge += amount;
    row.discoveryState = discoveryStateFor(row);
    this.syncRecruitmentUnlock(run, raceId);
  },

  syncRecruitmentUnlock(run: RunState, raceId: string): void {
    const row = this.getRunKnowledge(run, raceId);
    const profile = getRaceDiscoveryProfile(raceId);
    if (!profile?.recruitmentLockedUntilCultural) {
      row.normalRecruitmentUnlocked = row.culturalKnowledge >= (profile?.culturalThreshold ?? 1);
      return;
    }
    row.normalRecruitmentUnlocked = row.culturalKnowledge >= profile.culturalThreshold;
  },

  canRecruitCharacter(run: RunState, character: WorldCharacter): boolean {
    const raceId = character.raceId ?? "HUMAN";
    if (raceId === HUMAN_RACE_ID) {
      return true;
    }
    const row = this.getRunKnowledge(run, raceId);
    const profile = getRaceDiscoveryProfile(raceId);
    if (profile?.storyThreadOverride) {
      const thread = StoryThreadService.getThreadByTemplate(run, profile.storyThreadOverride);
      if (thread && (thread.state === "ACTIVE" || thread.state === "CLIMAX_READY")) {
        return true;
      }
    }
    return row.normalRecruitmentUnlocked;
  },

  getEncounterWeight(run: RunState, raceId: string): number {
    const race = getRace(raceId);
    if (!race) {
      return 0;
    }
    const profile = getRaceDiscoveryProfile(raceId);
    const tier = runTier(run);
    if (profile?.encounterTierGate && !tierAtLeast(tier, profile.encounterTierGate)) {
      return profile.rumorOnlyUntilTier && !tierAtLeast(tier, profile.rumorOnlyUntilTier)
        ? race.worldEncounterWeight * 0.15
        : 0;
    }
    const knowledge = this.getRunKnowledge(run, raceId);
    const exposureBoost = 1 + knowledge.encounterExposure * 0.05;
    const tierBoost = 1 + TIER_ORDER.indexOf(tier) * 0.08;
    return race.worldEncounterWeight * exposureBoost * tierBoost;
  },

  hasCrewRace(run: RunState, raceId: string, minCount = 1): boolean {
    let count = run.player.raceId === raceId ? 1 : 0;
    for (const member of run.crew) {
      const character = run.world.characters.find((entry) => entry.id === member.characterId);
      if (character?.raceId === raceId) {
        count += 1;
      }
    }
    return count >= minCount;
  },

  setRunKnowledge(
    run: RunState,
    raceId: string,
    patch: Partial<RaceKnowledge>,
  ): RaceKnowledge {
    const row = this.getRunKnowledge(run, raceId);
    Object.assign(row, patch);
    row.discoveryState = discoveryStateFor(row);
    this.syncRecruitmentUnlock(run, raceId);
    return row;
  },

  getPlayableRaces(profile: ProfileSave): RaceDefinition[] {
    if (profile.profileType === "DEVELOPMENT") {
      return [...RACES];
    }
    return RACES.filter((race) => {
      const row = progressFor(profile, race.id);
      return row?.playable || race.defaultPlayable;
    });
  },

  getPity(profile: ProfileSave, raceId: string): RaceOfferPity {
    return pityFor(profile, raceId);
  },

  getRaceOffers(profile: ProfileSave, rng: RandomService): RaceDefinition[] {
    return this.rollRaceOffers(profile, rng).offers;
  },

  rollRaceOffers(
    profile: ProfileSave,
    rng: RandomService,
  ): { offers: RaceDefinition[]; profile: ProfileSave } {
    if (profile.profileType === "DEVELOPMENT") {
      return { offers: [...RACES], profile };
    }
    profile.raceOfferPity ??= [];
    const playable = this.getPlayableRaces(profile);
    const human = playable.find((race) => race.id === HUMAN_RACE_ID) ?? getRace(HUMAN_RACE_ID);
    const others = playable.filter((race) => race.id !== HUMAN_RACE_ID);
    const slots = Math.max(0, RACE_OFFER_COUNT - 1);

    const forced: RaceDefinition[] = others
      .filter((race) => {
        const pity = pityFor(profile, race.id);
        return pity.missedOffers >= race.hardPityAfterMisses;
      })
      .sort((a, b) => pityFor(profile, b.id).missedOffers - pityFor(profile, a.id).missedOffers)
      .slice(0, slots);

    const remainingSlots = Math.max(0, slots - forced.length);
    const remainingPool = others
      .filter((race) => !forced.some((item) => item.id === race.id))
      .map((race) => ({
        ...race,
        weight: effectiveWeight(race, pityFor(profile, race.id)),
      }));
    const picked = remainingSlots > 0 && remainingPool.length
      ? rng.sampleWeighted(remainingPool, Math.min(remainingSlots, remainingPool.length))
      : [];

    const offered = human ? [human, ...forced, ...picked] : [...forced, ...picked];
    const offeredIds = new Set(offered.map((race) => race.id));

    for (const race of others) {
      const pity = pityFor(profile, race.id);
      if (offeredIds.has(race.id)) {
        pity.missedOffers = 0;
        pity.pityBonus = 0;
      } else {
        pity.missedOffers += 1;
        pity.pityBonus += pityStep(race);
      }
    }

    return { offers: offered, profile };
  },

  increaseAllPity(profile: ProfileSave, amount = 1): void {
    for (const race of this.getPlayableRaces(profile)) {
      if (race.id === HUMAN_RACE_ID) {
        continue;
      }
      const pity = pityFor(profile, race.id);
      pity.missedOffers += amount;
      pity.pityBonus += pityStep(race) * amount;
    }
  },

  registerRaceDiscovery(
    profile: ProfileSave,
    raceId: string,
    sourceId: string,
    amount = 1,
    runId?: string,
  ): boolean {
    if (raceId === HUMAN_RACE_ID) {
      return false;
    }
    const race = getRace(raceId);
    if (!race) {
      return false;
    }
    const row = ensureRaceRow(profile, raceId);
    if (row.discoverySources.includes(sourceId)) {
      syncRaceKnowledge(row);
      return false;
    }
    row.discoverySources.push(sourceId);
    row.discoveryProgress += amount;
    if (!row.known) {
      row.known = true;
      row.firstDiscoveredRunId = runId;
    }
    const required = row.requiredDiscoveryProgress;
    if (required !== null && row.discoveryProgress >= required) {
      row.playable = true;
    }
    syncRaceKnowledge(row);
    return true;
  },

  unlockLore(profile: ProfileSave, raceId: string, entryId: string): void {
    const row = ensureRaceRow(profile, raceId);
    if (!row.unlockedEntries.includes(entryId)) {
      row.unlockedEntries.push(entryId);
    }
    const lore = loreForRace(raceId).find((entry) => entry.id === entryId);
    if (lore) {
      row.knowledgeLevel = Math.max(row.knowledgeLevel, lore.minLevel);
    }
    row.known = true;
    syncRaceKnowledge(row);
  },

  unlockRace(profile: ProfileSave, raceId: string, sourceId = "unlock"): void {
    const row = ensureRaceRow(profile, raceId);
    row.known = true;
    row.playable = true;
    if (row.requiredDiscoveryProgress !== null) {
      row.discoveryProgress = Math.max(row.discoveryProgress, row.requiredDiscoveryProgress);
    }
    if (!row.discoverySources.includes(sourceId)) {
      row.discoverySources.push(sourceId);
    }
    syncRaceKnowledge(row);
  },

  getRaceEncounterWeight(raceId: string): number {
    return getRace(raceId)?.worldEncounterWeight ?? 0;
  },

  getProgress(profile: ProfileSave, raceId: string): RaceProgress | undefined {
    return progressFor(profile, raceId);
  },

  isPlayable(profile: ProfileSave, raceId: string): boolean {
    if (profile.profileType === "DEVELOPMENT") {
      return Boolean(getRace(raceId));
    }
    return Boolean(progressFor(profile, raceId)?.playable);
  },

  visibleLore(profile: ProfileSave, raceId: string) {
    const row = progressFor(profile, raceId);
    const all = loreForRace(raceId);
    if (!row?.known) {
      return [];
    }
    return all.filter(
      (entry) => entry.minLevel <= row.knowledgeLevel || row.unlockedEntries.includes(entry.id),
    );
  },
};
