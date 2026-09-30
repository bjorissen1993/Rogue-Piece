import type { Island, IslandMapLayout, RunState } from "../models/types";

const STORAGE_KEY = "pirateRoguelike_authored_maps";

const PROFILE_KEYS = [
  "pirateRoguelike_dev_profile",
  "pirateRoguelike_profile_1",
  "pirateRoguelike_profile_2",
  "pirateRoguelike_profile_3",
  "pirateRoguelike_dev_save",
];

type AuthoredMaps = Record<string, IslandMapLayout>;

let memory: AuthoredMaps = {};

function cloneLayout(layout: IslandMapLayout): IslandMapLayout {
  return structuredClone(layout);
}

function read(): AuthoredMaps {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthoredMaps;
        if (parsed && typeof parsed === "object") {
          memory = parsed;
        }
      }
    } catch {
      /* keep memory */
    }
  }
  return memory;
}

function write(maps: AuthoredMaps): void {
  memory = maps;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
  }
}

/**
 * Map-editor layouts live outside the profile save.
 * Resetting a Development Profile must not wipe authored pins.
 */
export const AuthoredMapLayoutService = {
  get(mapAssetId: string | null | undefined): IslandMapLayout | null {
    if (!mapAssetId) {
      return null;
    }
    const layout = read()[mapAssetId];
    return layout?.hotspots?.length ? cloneLayout(layout) : null;
  },

  save(mapAssetId: string | null | undefined, layout: IslandMapLayout): void {
    if (!mapAssetId) {
      return;
    }
    const maps = read();
    maps[mapAssetId] = cloneLayout(layout);
    write(maps);
  },

  harvestFromIsland(island: Island): void {
    for (const [mapAssetId, layout] of Object.entries(island.mapLayouts ?? {})) {
      if (layout?.hotspots?.length) {
        this.save(mapAssetId, layout);
      }
    }
  },

  harvestFromRun(run: RunState | null | undefined): void {
    for (const island of run?.islands ?? []) {
      this.harvestFromIsland(island);
    }
  },

  clear(): void {
    memory = {};
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  },

  harvestFromStoredProfiles(): void {
    if (typeof localStorage === "undefined") {
      return;
    }
    for (const key of PROFILE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const profile = JSON.parse(raw) as { activeRun?: RunState };
        this.harvestFromRun(profile.activeRun);
      } catch {
        /* ignore broken slots */
      }
    }
  },

  applyToIsland(island: Island): void {
    if (Object.keys(read()).length === 0) {
      this.harvestFromStoredProfiles();
    }
    const mapAssetId = island.mapAssetId;
    if (!mapAssetId) {
      return;
    }
    island.mapLayouts = island.mapLayouts ?? {};
    const current = island.mapLayouts[mapAssetId];
    if (current?.hotspots?.length) {
      return;
    }
    const authored = this.get(mapAssetId);
    if (!authored) {
      return;
    }
    island.mapLayouts[mapAssetId] = authored;
    island.facilityHotspots = authored.hotspots;
  },
};
