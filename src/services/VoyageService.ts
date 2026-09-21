import {
  AT_SEA_ENCOUNTER_ID,
  DEFAULT_SHIP_SPEED,
  DEFAULT_VOYAGE_DISTANCE,
  SEA_EVENT_CHANCE_PER_SLOT,
} from "../game/constants";
import type { ActiveVoyage, PlayerShip, ProfileSave, RunState } from "../models/types";
import { IslandService } from "./IslandService";
import { IslandPressureService } from "./IslandPressureService";
import type { RandomService } from "./RandomService";
import { createRng } from "./RandomService";
import { WorldService } from "./WorldService";
import { StoryChainService } from "./StoryChainService";

function cloneProfile(profile: ProfileSave): ProfileSave {
  return structuredClone(profile);
}

function requireRun(profile: ProfileSave): RunState {
  if (!profile.activeRun) {
    throw new Error("No active run");
  }
  return profile.activeRun;
}

function defaultShip(playerName: string): PlayerShip {
  return {
    name: `${playerName}'s Ship`,
    speed: DEFAULT_SHIP_SPEED,
    condition: 100,
  };
}

function estimateDistance(fromDanger: number, toDanger: number, rng: RandomService): number {
  const spread = Math.abs(fromDanger - toDanger);
  return Math.max(2, DEFAULT_VOYAGE_DISTANCE + spread + rng.nextInt(0, 1));
}

export type VoyageTickResult = {
  profile: ProfileSave;
  continueAuto: boolean;
  arrived: boolean;
  /** Caller should pick a sea/story encounter and pause auto-tick. */
  needsEvent: boolean;
};

export const VoyageService = {
  ensureShip(run: RunState): PlayerShip {
    if (!run.ship) {
      run.ship = defaultShip(run.player.name || "Captain");
    }
    if (!Number.isFinite(run.ship.speed) || run.ship.speed <= 0) {
      run.ship.speed = DEFAULT_SHIP_SPEED;
    }
    if (!Number.isFinite(run.ship.condition)) {
      run.ship.condition = 100;
    }
    return run.ship;
  },

  listDestinations(run: RunState): Array<{
    id: string;
    name: string;
    region: string;
    dangerLevel: number;
    archetype: string;
    distance: number;
    etaSlots: number;
    facilities: string[];
    lastVisitedDay: number | null;
    pressureLevel: number;
    trustLevel: number;
  }> {
    const current = IslandService.getCurrentIsland(run);
    const currentId = run.currentIslandId;
    const ship = this.ensureShip(run);
    return run.islands
      .filter((island) => island.id !== currentId)
      .map((island) => {
        IslandPressureService.ensure(island);
        const spread = Math.abs((current?.dangerLevel ?? 2) - island.dangerLevel);
        const distance = Math.max(2, DEFAULT_VOYAGE_DISTANCE + spread);
        return {
          id: island.id,
          name: island.name,
          region: island.region,
          dangerLevel: island.dangerLevel,
          archetype: island.archetype,
          distance,
          etaSlots: Math.max(1, Math.ceil(distance / Math.max(0.1, ship.speed))),
          facilities: IslandPressureService.facilityNames(island),
          lastVisitedDay: island.lastVisitedDay ?? null,
          pressureLevel: island.pressureLevel ?? 0,
          trustLevel: island.trustLevel ?? 0,
        };
      });
  },

  isVoyaging(run: RunState): boolean {
    return (run.activityMode ?? "ISLAND") === "SAILING" && Boolean(run.activeVoyage);
  },

  /** Begin a voyage from the current island to another known island. */
  beginVoyage(profile: ProfileSave, toIslandId: string, rng = createRng(requireRun(profile).seed)): ProfileSave {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    const ship = this.ensureShip(run);
    const from = IslandService.getCurrentIsland(run);
    const to = run.islands.find((island) => island.id === toIslandId);
    if (!from || !to || from.id === to.id) {
      run.lastFeedback = "No valid destination on the charts.";
      return next;
    }
    if (run.combat && !run.combat.finished) {
      return next;
    }

    const distance = estimateDistance(from.dangerLevel, to.dangerLevel, rng);
    const voyage: ActiveVoyage = {
      fromIslandId: from.id,
      toIslandId: to.id,
      toIslandName: to.name,
      distance,
      progress: 0,
      slotsElapsed: 0,
      pausedForEvent: false,
    };
    run.activeVoyage = voyage;
    run.voyageProgress = 0;
    run.activityMode = "SAILING";
    run.awaitingAdvance = false;
    run.lastResultText = null;
    run.pendingEncounterId = null;
    run.pendingSeekRandomEncounter = false;
    run.currentEncounterId = AT_SEA_ENCOUNTER_ID;
    run.dynamicEncounter = null;
    WorldService.addNews(run, `${run.player.name} sets sail from ${from.name} toward ${to.name}.`);
    run.lastFeedback = `${ship.name} casts off for ${to.name}.`;
    return next;
  },

  /** Clear voyage flags and mark landfall; caller should enterIslandHub. */
  applyArrival(run: RunState): string {
    const voyage = run.activeVoyage;
    const name = voyage?.toIslandName ?? "unknown shores";
    if (voyage) {
      run.currentIslandId = voyage.toIslandId;
      const island = run.islands.find((entry) => entry.id === voyage.toIslandId);
      if (island) {
        island.introductionShown = false;
      }
      WorldService.addNews(run, `${run.player.name} makes landfall at ${name}.`);
    }
    run.activeVoyage = null;
    run.voyageProgress = 0;
    run.activityMode = "ISLAND";
    run.lastFeedback = `Land ho — ${name}.`;
    IslandPressureService.onLandfall(run);
    StoryChainService.enqueueCrossMapArrival(run);
    return name;
  },

  /** Clear voyage and stay on current island; caller should enterIslandHub. */
  applyAbort(run: RunState): void {
    run.activeVoyage = null;
    run.voyageProgress = 0;
    run.activityMode = "ISLAND";
    run.lastFeedback = "You put back into harbor.";
  },

  /**
   * Advance one sailing time slot. May request a sea event or signal arrival.
   */
  tick(profile: ProfileSave, rng = createRng(requireRun(profile).seed)): VoyageTickResult {
    const next = cloneProfile(profile);
    const run = requireRun(next);
    const voyage = run.activeVoyage;
    if (!voyage || (run.activityMode ?? "ISLAND") !== "SAILING") {
      return { profile: next, continueAuto: false, arrived: false, needsEvent: false };
    }
    if (run.awaitingAdvance || (run.combat && !run.combat.finished) || voyage.pausedForEvent) {
      return { profile: next, continueAuto: false, arrived: false, needsEvent: false };
    }
    if (run.currentEncounterId && run.currentEncounterId !== AT_SEA_ENCOUNTER_ID) {
      return { profile: next, continueAuto: false, arrived: false, needsEvent: false };
    }

    const ship = this.ensureShip(run);
    const completed = WorldService.spendTime(run, 1, rng);
    const timeStory = StoryChainService.notifyTimeAndActivities(run, completed);
    if (timeStory) {
      run.lastFeedback = timeStory;
    }
    voyage.slotsElapsed += 1;
    const gain = ship.speed / Math.max(1, voyage.distance);
    voyage.progress = Math.min(1, voyage.progress + gain);
    run.voyageProgress = voyage.progress;
    run.currentEncounterId = AT_SEA_ENCOUNTER_ID;

    if (voyage.progress >= 1) {
      this.applyArrival(run);
      return { profile: next, continueAuto: false, arrived: true, needsEvent: false };
    }

    if (voyage.progress < 0.92 && rng.next() < SEA_EVENT_CHANCE_PER_SLOT) {
      voyage.pausedForEvent = true;
      const sailStory = StoryChainService.fireEvent(run, {
        kind: "sailing_event",
        islandId: voyage.toIslandId,
      });
      if (sailStory) {
        run.lastFeedback = sailStory;
      }
      return { profile: next, continueAuto: false, arrived: false, needsEvent: true };
    }

    return { profile: next, continueAuto: true, arrived: false, needsEvent: false };
  },

  /** After a sea event completes, resume open-water travel. */
  resumeAfterEvent(run: RunState): void {
    if (!run.activeVoyage) {
      return;
    }
    run.activeVoyage.pausedForEvent = false;
    run.activityMode = "SAILING";
    run.currentEncounterId = AT_SEA_ENCOUNTER_ID;
    run.dynamicEncounter = null;
    run.awaitingAdvance = false;
    run.lastResultText = null;
  },
};
