import { ACHIEVEMENTS } from "../data/achievements";
import { DEVIL_FRUITS } from "../data/devilFruits";
import { ITEMS } from "../data/items";
import { startingLocationIds } from "../data/locations";
import { RACES } from "../data/races";
import type {
  CollectionKnowledge,
  LegacyGameState,
  ProfileSave,
  ProfileSlot,
  ProfileStatistics,
  ProfileType,
  RaceOfferPity,
  RaceProgress,
  RunState,
  SavePreview,
} from "../models/types";
import { SAVE_VERSION } from "../game/constants";
import { createEmptyProfile, emptyPity, emptyStatistics } from "../game/profileFactory";
import { getRace } from "../data/races";
import { AffiliationService } from "./AffiliationService";
import { AuthorityService, defaultAuthority, defaultStandingOrders } from "./AuthorityService";
import { CrewCombatService } from "./CrewCombatService";
import { CrewService } from "./CrewService";
import { FleetService } from "./FleetService";
import { RaceService } from "./RaceService";
import { FactionMissionService } from "./FactionMissionService";
import { FactionService } from "./FactionService";
import { WeaponService } from "./WeaponService";
import { MpService } from "./MpService";
import { ProgressionService } from "./ProgressionService";
import { ensurePlayerStats } from "../utils/stats";
import { nowIso } from "../utils/ids";

const PROFILE_KEYS: Record<Exclude<ProfileSlot, "dev">, string> = {
  1: "pirateRoguelike_profile_1",
  2: "pirateRoguelike_profile_2",
  3: "pirateRoguelike_profile_3",
};

const DEV_KEY = "pirateRoguelike_dev_profile";
const LAST_PROFILE_KEY = "pirateRoguelike_last_profile";

const LEGACY_KEYS: Record<Exclude<ProfileSlot, "dev">, string> = {
  1: "pirateRoguelike_save_1",
  2: "pirateRoguelike_save_2",
  3: "pirateRoguelike_save_3",
};
const LEGACY_DEV_KEY = "pirateRoguelike_dev_save";

export const NORMAL_SLOTS: Array<1 | 2 | 3> = [1, 2, 3];

function keyFor(slot: ProfileSlot): string {
  return slot === "dev" ? DEV_KEY : PROFILE_KEYS[slot];
}

function profileTypeFor(slot: ProfileSlot): ProfileType {
  return slot === "dev" ? "DEVELOPMENT" : "NORMAL";
}

function profileIdFor(slot: ProfileSlot): string {
  return slot === "dev" ? "dev" : `slot_${slot}`;
}

function readRaw(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeProfile(key: string, profile: ProfileSave): ProfileSave {
  const next: ProfileSave = { ...profile, updatedAt: nowIso() };
  if (next.activeRun) {
    next.activeRun = { ...next.activeRun, updatedAt: next.updatedAt };
  }
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

function isProfileSave(value: unknown): value is ProfileSave {
  if (!value || typeof value !== "object") {
    return false;
  }
  const data = value as ProfileSave;
  return (
    typeof data.version === "number" &&
    data.version >= 2 &&
    data.version <= SAVE_VERSION &&
    Boolean(data.progression) &&
    "activeRun" in data &&
    Boolean(data.profileType)
  );
}

function emptyRaceProgress(): RaceProgress[] {
  return RACES.map((race) => ({
    raceId: race.id,
    known: race.defaultKnown,
    playable: race.defaultPlayable,
    discoveryProgress: race.defaultPlayable ? race.requiredDiscoveryProgress ?? 0 : 0,
    requiredDiscoveryProgress: race.requiredDiscoveryProgress,
    discoverySources: [],
    knowledgeLevel: race.defaultKnown ? 1 : 0,
    unlockedEntries: race.defaultKnown ? ["intro"] : [],
  }));
}

function knowledgeFrom(
  existing: Partial<CollectionKnowledge> | undefined,
  id: string,
): CollectionKnowledge {
  const discovered = Boolean(existing?.discovered);
  return {
    id,
    discovered,
    discoveredAt: existing?.discoveredAt,
    knowledgeLevel: existing?.knowledgeLevel ?? (discovered ? 1 : 0),
    unlockedEntries: existing?.unlockedEntries ?? (discovered ? ["intro"] : []),
    discoveredTechniques: existing?.discoveredTechniques ?? [],
  };
}

function emptyCollection(): { devilFruits: CollectionKnowledge[]; items: CollectionKnowledge[] } {
  return {
    devilFruits: DEVIL_FRUITS.map((fruit) => knowledgeFrom(undefined, fruit.id)),
    items: ITEMS.map((item) => knowledgeFrom(undefined, item.id)),
  };
}

function defaultAchievements(): ProfileSave["achievements"] {
  return ACHIEVEMENTS.map((achievement) => ({ id: achievement.id, unlocked: false }));
}

function ensureProfileShape(profile: ProfileSave): ProfileSave {
  const races = emptyRaceProgress();
  for (const existing of profile.progression?.races ?? []) {
    const index = races.findIndex((race) => race.raceId === existing.raceId);
    if (index >= 0) {
      const merged = { ...races[index], ...existing };
      const known = merged.known;
      races[index] = {
        ...merged,
        knowledgeLevel: existing.knowledgeLevel ?? (known ? Math.max(1, existing.discoveryProgress || 1) : 0),
        unlockedEntries: existing.unlockedEntries ?? (known ? ["intro"] : []),
      };
    }
  }
  const collection = emptyCollection();
  for (const entry of profile.collection?.devilFruits ?? []) {
    const found = collection.devilFruits.find((item) => item.id === entry.id);
    if (found) {
      Object.assign(found, knowledgeFrom(entry, entry.id));
    }
  }
  for (const entry of profile.collection?.items ?? []) {
    const found = collection.items.find((item) => item.id === entry.id);
    if (found) {
      Object.assign(found, knowledgeFrom(entry, entry.id));
    }
  }
  const achievements = defaultAchievements();
  for (const existing of profile.achievements ?? []) {
    const found = achievements.find((item) => item.id === existing.id);
    if (found) {
      found.unlocked = existing.unlocked;
      found.unlockedAt = existing.unlockedAt;
    }
  }
  const stats = { ...emptyStatistics(), ...profile.statistics };
  const unlocked = profile.progression?.unlockedStartingLocations?.length
    ? [...new Set([...startingLocationIds(), ...profile.progression.unlockedStartingLocations])]
    : startingLocationIds();

  const pity: RaceOfferPity[] = emptyPity();
  for (const existing of profile.raceOfferPity ?? []) {
    const found = pity.find((item) => item.raceId === existing.raceId);
    if (found) {
      found.missedOffers = existing.missedOffers ?? 0;
      found.pityBonus = existing.pityBonus ?? 0;
    }
  }

  let activeRun = profile.activeRun ?? null;
  if (activeRun) {
    activeRun = {
      ...activeRun,
      deathCause: activeRun.deathCause,
      player: {
        ...activeRun.player,
        inventory: (activeRun.player.inventory ?? []).map((item) => ({
          ...item,
          itemId: item.itemId || item.id,
          quantity: item.quantity ?? 1,
        })),
      },
      timeOfDay: activeRun.timeOfDay ?? "MORNING",
      pendingTimeCost: activeRun.pendingTimeCost ?? 0,
      trainingToday: activeRun.trainingToday ?? {},
      lastFeedback: activeRun.lastFeedback ?? null,
      lastHpChange: activeRun.lastHpChange ?? null,
      combat: activeRun.combat
        ? {
            ...activeRun.combat,
            lastHits: activeRun.combat.lastHits ?? [],
            canSurrender: activeRun.combat.canSurrender ?? false,
            escapeAttempts: activeRun.combat.escapeAttempts ?? 0,
            guaranteedEscape: activeRun.combat.guaranteedEscape ?? false,
            threatLevel: activeRun.combat.threatLevel ?? "FAIR",
            combatKind: activeRun.combat.combatKind ?? "NORMAL",
            unescapableReason: activeRun.combat.unescapableReason ?? null,
            party: activeRun.combat.party,
            lastCombatResult: activeRun.combat.lastCombatResult,
          }
        : null,
    };
    activeRun = migrateRunState(activeRun);
  }

  return ensureProfileShapeContinue(profile, activeRun, races, collection, achievements, stats, unlocked, pity);
}

function ensureProfileShapeContinue(
  profile: ProfileSave,
  activeRun: ProfileSave["activeRun"],
  races: ProfileSave["progression"]["races"],
  collection: ProfileSave["collection"],
  achievements: ProfileSave["achievements"],
  stats: ProfileStatistics,
  unlocked: string[],
  pity: RaceOfferPity[],
): ProfileSave {
  return {
    ...profile,
    version: SAVE_VERSION,
    progression: {
      races,
      unlockedStartingLocations: unlocked,
      milestones: profile.progression?.milestones ?? [],
    },
    statistics: stats,
    collection,
    achievements,
    raceOfferPity: pity,
    activeRun,
  };
}

function migrateRunState(run: RunState): RunState {
  const next: RunState = {
    ...run,
    encounterHistory: run.encounterHistory ?? [],
    storyThreads: run.storyThreads ?? [],
    crew: (run.crew ?? []).map((member) => ProgressionService.migrateCrewMember({
      ...member,
      status: member.status ?? (member.membership === "TEMPORARY" || member.membership === "GUEST" ? "Temporary" : "Ready"),
    })),
    islands: (run.islands ?? []).map((island) => ({
      ...island,
      knownShops: island.knownShops ?? [],
    })),
    usedIslandNames: run.usedIslandNames ?? [],
    worldProgressionFlags: run.worldProgressionFlags ?? {},
    currentWeather: run.currentWeather ?? "CLEAR",
    currentIslandId: run.currentIslandId ?? null,
    lastEncounterCategory: run.lastEncounterCategory ?? null,
    pendingLevelUps: run.pendingLevelUps ?? [],
    pendingTechniqueChoice: run.pendingTechniqueChoice ?? null,
    pendingEncounterId: run.pendingEncounterId ?? null,
    characterAssignments: run.characterAssignments ?? [],
    characterTrainingToday: run.characterTrainingToday ?? {},
    pendingAssignmentResults: run.pendingAssignmentResults ?? [],
    pendingParticipantId: run.pendingParticipantId ?? null,
    pendingParticipantIds: run.pendingParticipantIds ?? [],
    trainingToday: run.trainingToday ?? {},
    runKnowledge: run.runKnowledge ?? [],
    factionMissions: run.factionMissions ?? [],
    factionOrders: run.factionOrders ?? [],
    activeParty: run.activeParty ?? CrewService.defaultActiveParty(),
    apprentices: run.apprentices ?? [],
    fleet: run.fleet ?? [],
    authority: run.authority ?? defaultAuthority(),
    standingOrders: run.standingOrders ?? defaultStandingOrders(),
    policyIncidents: run.policyIncidents ?? [],
    raceKnowledge: run.raceKnowledge,
    player: {
      ...run.player,
      equipment: run.player.equipment ?? WeaponService.defaultEquipment(),
      weaponMastery: run.player.weaponMastery ?? WeaponService.defaultMastery(),
      activeCombatStyle: run.player.activeCombatStyle ?? null,
      unlockedStyles: run.player.unlockedStyles ?? [],
      progression: run.player.progression ?? ProgressionService.defaultProgression(),
      unlockedTechniques: run.player.unlockedTechniques ?? [],
      title: run.player.title ?? "Independent Sailor",
      inventory: (run.player.inventory ?? []).map((item) => ({
        ...item,
        itemId: item.itemId || item.id,
        quantity: item.quantity ?? 1,
      })),
    },
    world: {
      ...run.world,
      characters: (run.world.characters ?? []).map((character) =>
        ProgressionService.migrateCharacter({
          ...character,
          memories: character.memories ?? [],
          joinInterest: character.joinInterest ?? 0,
        }),
      ),
    },
  };
  WeaponService.migrateInventoryWeapons(next);
  next.player.stats = ensurePlayerStats(next.player.stats);
  next.runKnowledge = next.runKnowledge ?? [];
  const withFactions = migrateRunFactions(next);
  AffiliationService.ensure(withFactions);
  AuthorityService.ensure(withFactions);
  FleetService.ensure(withFactions);
  RaceService.ensureRunKnowledge(withFactions);
  CrewCombatService.ensurePartyConfig(withFactions);
  FactionMissionService.ensure(withFactions);
  MpService.ensurePlayer(withFactions.player);
  return withFactions;
}

function migrateRunFactions(run: RunState): RunState {
  const factions = [...run.world.factions];
  for (const faction of FactionService.initialRelationships()) {
    if (!factions.some((item) => item.factionId === faction.factionId)) {
      factions.push({ ...faction, recentChanges: [] });
    }
  }
  const next: RunState = {
    ...run,
    world: {
      ...run.world,
      factions,
      factionWorld: run.world.factionWorld ?? [],
    },
  };
  FactionService.ensureFactionWorld(next);
  return next;
}

function migrateLegacyRun(legacy: LegacyGameState): RunState {
  const player = legacy.player;
  return {
    id: `run_${legacy.saveId}`,
    seed: legacy.seed,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    player: {
      ...player,
      raceId: player.raceId ?? "HUMAN",
      origin: player.origin || "SAILOR",
      inventory: player.inventory ?? [],
      flags: player.flags ?? [],
    },
    world: {
      day: legacy.world.day,
      devilFruits: legacy.world.devilFruits ?? [],
      characters: legacy.world.characters ?? [],
      history: legacy.world.history ?? [],
      flags: legacy.world.flags ?? [],
      factions: legacy.world.factions ?? [],
      factionWorld: legacy.world.factionWorld ?? [],
      worldPower: legacy.world.worldPower ?? {
        worldGovernmentPower: 45,
        oppression: 28,
        revolutionaryActivity: 6,
      },
      lastDevilFruitDiscoveryDay: legacy.world.lastDevilFruitDiscoveryDay ?? null,
    },
    day: legacy.world.day,
    timeOfDay: "MORNING",
    pendingTimeCost: 0,
    trainingToday: {},
    currentLocationId: "east_blue_port",
    currentEncounterId: legacy.currentEncounterId,
    encounterCount: legacy.encounterCount,
    runFlags: [],
    gameOver: legacy.gameOver,
    currentBoundFruitId: legacy.currentBoundFruitId,
    currentBoundNpcId: legacy.currentBoundNpcId,
    lastResultText: legacy.lastResultText,
    lastFeedback: null,
    lastHpChange: null,
    awaitingAdvance: legacy.awaitingAdvance,
    combat: null,
    deathCause: undefined,
    encounterHistory: [],
    storyThreads: [],
    crew: [],
    islands: [],
    usedIslandNames: [],
    worldProgressionFlags: {},
    currentWeather: "CLEAR",
    currentIslandId: null,
    lastEncounterCategory: null,
  };
}

function migrateV1(legacy: LegacyGameState, slot: ProfileSlot): ProfileSave {
  const profile = createEmptyProfile(profileIdFor(slot), profileTypeFor(slot));
  profile.createdAt = legacy.createdAt || profile.createdAt;
  const run = migrateLegacyRun(legacy);
  if (!legacy.world.factions?.length) {
    run.world.factions = FactionService.initialRelationships();
  }
  const seen = run.player.flags.filter((flag) => flag.startsWith("seen_fruit_"));
  for (const flag of seen) {
    const fruitId = flag.replace("seen_fruit_", "");
    const entry = profile.collection.devilFruits.find((item) => item.id === fruitId);
    if (entry) {
      entry.discovered = true;
      entry.discoveredAt = legacy.updatedAt;
    }
  }
  profile.statistics.runsStarted = 1;
  profile.statistics.highestBounty = run.player.bounty;
  profile.statistics.encountersCompleted = run.encounterCount;
  profile.statistics.longestRunDays = run.day;
  profile.statistics.fruitsDiscovered = profile.collection.devilFruits.filter((item) => item.discovered).length;
  if (run.player.devilFruitId) {
    profile.statistics.fruitsEaten = 1;
  }
  if (legacy.gameOver) {
    profile.statistics.deaths = 1;
    profile.statistics.daysSurvivedTotal = run.day;
    profile.activeRun = null;
  } else {
    profile.activeRun = run;
  }
  return ensureProfileShape(profile);
}

function parseStored(slot: ProfileSlot, raw: unknown): ProfileSave | null {
  if (!raw) {
    return null;
  }
  if (isProfileSave(raw)) {
    if (raw.profileType !== profileTypeFor(slot)) {
      return null;
    }
    return ensureProfileShape(raw);
  }
  const legacy = raw as LegacyGameState;
  if (legacy && typeof legacy === "object" && legacy.player && legacy.world) {
    if (slot === "dev") {
      try {
        return migrateV1(legacy, slot);
      } catch {
        return null;
      }
    }
    return migrateV1(legacy, slot);
  }
  return null;
}

function loadSlot(slot: ProfileSlot): ProfileSave | null {
  try {
    const current = parseStored(slot, readRaw(keyFor(slot)));
    if (current) {
      return current;
    }
    const legacyKey = slot === "dev" ? LEGACY_DEV_KEY : LEGACY_KEYS[slot];
    const migrated = parseStored(slot, readRaw(legacyKey));
    if (migrated) {
      const saved = writeProfile(keyFor(slot), migrated);
      localStorage.removeItem(legacyKey);
      return saved;
    }
    return null;
  } catch (error) {
    console.error(`Failed to load profile slot ${String(slot)}`, error);
    return null;
  }
}

function previewFrom(slot: ProfileSlot, profile: ProfileSave | null): SavePreview {
  if (!profile) {
    return { slot, empty: true, profileType: profileTypeFor(slot), hasActiveRun: false };
  }
  const run = profile.activeRun;
  const race = run ? getRace(run.player.raceId) : undefined;
  return {
    slot,
    empty: false,
    profileType: profile.profileType,
    hasActiveRun: Boolean(run) && !run?.gameOver,
    name: run?.player.name,
    day: run?.day,
    bounty: run?.player.bounty,
    raceName: race?.name,
    runsStarted: profile.statistics.runsStarted,
    updatedAt: profile.updatedAt,
  };
}

export const SaveService = {
  slotKey(slot: ProfileSlot): string {
    return keyFor(slot);
  },

  loadProfile(slot: ProfileSlot): ProfileSave | null {
    const profile = loadSlot(slot);
    if (profile) {
      this.setLastUsed(slot);
    }
    return profile;
  },

  getOrCreateProfile(slot: ProfileSlot): ProfileSave {
    const existing = loadSlot(slot);
    if (existing) {
      this.setLastUsed(slot);
      return existing;
    }
    const created = createEmptyProfile(profileIdFor(slot), profileTypeFor(slot));
    const saved = writeProfile(keyFor(slot), created);
    this.setLastUsed(slot);
    return saved;
  },

  saveProfile(slot: ProfileSlot, profile: ProfileSave): ProfileSave {
    const stamped: ProfileSave = {
      ...profile,
      id: profileIdFor(slot),
      profileType: profileTypeFor(slot),
    };
    const saved = writeProfile(keyFor(slot), stamped);
    this.setLastUsed(slot);
    return saved;
  },

  persist(profile: ProfileSave): ProfileSave {
    const slot = this.slotFromProfile(profile);
    return this.saveProfile(slot, profile);
  },

  deleteProfile(slot: ProfileSlot): void {
    localStorage.removeItem(keyFor(slot));
    if (slot !== "dev") {
      localStorage.removeItem(LEGACY_KEYS[slot]);
    } else {
      localStorage.removeItem(LEGACY_DEV_KEY);
    }
    if (this.getLastUsed() === slot) {
      localStorage.removeItem(LAST_PROFILE_KEY);
    }
  },

  resetDevelopmentProfile(): ProfileSave {
    localStorage.removeItem(DEV_KEY);
    localStorage.removeItem(LEGACY_DEV_KEY);
    return this.getOrCreateProfile("dev");
  },

  slotFromProfile(profile: ProfileSave): ProfileSlot {
    if (profile.profileType === "DEVELOPMENT" || profile.id === "dev") {
      return "dev";
    }
    if (profile.id === "slot_2") return 2;
    if (profile.id === "slot_3") return 3;
    return 1;
  },

  getLastUsed(): ProfileSlot | null {
    const raw = localStorage.getItem(LAST_PROFILE_KEY);
    if (raw === "1" || raw === "2" || raw === "3") {
      return Number(raw) as 1 | 2 | 3;
    }
    if (raw === "dev") {
      return "dev";
    }
    return null;
  },

  setLastUsed(slot: ProfileSlot): void {
    localStorage.setItem(LAST_PROFILE_KEY, String(slot));
  },

  listProfiles(): SavePreview[] {
    return NORMAL_SLOTS.map((slot) => previewFrom(slot, loadSlot(slot)));
  },

  developmentPreview(): SavePreview {
    return previewFrom("dev", loadSlot("dev"));
  },

  hasProfile(slot: ProfileSlot): boolean {
    return loadSlot(slot) !== null;
  },
};

export type { ProfileStatistics };
