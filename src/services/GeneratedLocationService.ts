import {
  eventScore,
  FACILITY_EVENT_VALUE,
  GROWTH_DAYS_TO_DEVELOPING,
  GROWTH_DAYS_TO_ESTABLISHED,
  inferLocationKind,
  stageName,
  valueFromName,
} from "../data/locationGrowth";
import {
  createPalettePlacement,
  getMapLayoutAnchors,
  getMapLayoutHotspots,
  getMapLayoutStoryChains,
  setMapLayoutHotspots,
} from "../data/islandMaps";
import type {
  GeneratedLocation,
  Island,
  LocationMaturity,
  LocationWorldValue,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { IslandPressureService } from "./IslandPressureService";
import { NpcResidencyService } from "./NpcResidencyService";

const PERSISTENT_NAMES = /clinic|outpost|watchtower|workshop|trading|fishing camp|settlement|village/i;

function clampValue(value: LocationWorldValue): LocationWorldValue {
  const cap = (n: number) => Math.max(0, Math.min(20, Math.round(n)));
  return {
    developmentValue: cap(value.developmentValue),
    strategicValue: cap(value.strategicValue),
    economicValue: cap(value.economicValue),
    civilianValue: cap(value.civilianValue),
    factionValue: cap(value.factionValue),
    vulnerability: Math.max(10, Math.min(95, Math.round(value.vulnerability))),
  };
}

export type LocationEventPrefer = "economic" | "strategic" | "vulnerable" | "any";

export const GeneratedLocationService = {
  ensure(island: Island): GeneratedLocation[] {
    island.generatedLocations = island.generatedLocations ?? [];
    return island.generatedLocations;
  },

  living(island: Island): GeneratedLocation[] {
    return this.ensure(island).filter((row) => !row.destroyed);
  },

  placeTemporary(
    island: Island,
    options: { name: string; xPct: number; yPct: number; anchorId?: string; questId?: string; chainId?: string },
  ): GeneratedLocation {
    const pin = createPalettePlacement("QUEST", options.xPct, options.yPct, { mode: "always" }, undefined, undefined, {
      purpose: options.name,
      notes: "generated-temporary",
    });
    const hotspots = [...getMapLayoutHotspots(island, island.mapAssetId), pin];
    const anchors = getMapLayoutAnchors(island, island.mapAssetId);
    const chains = getMapLayoutStoryChains(island, island.mapAssetId);
    if (options.anchorId) {
      const anchor = anchors.find((row) => row.id === options.anchorId);
      if (anchor) {
        anchor.occupancy = "OCCUPIED_TEMPORARY";
        anchor.generatedLocationId = pin.hotspotId;
      }
    }
    setMapLayoutHotspots(island, island.mapAssetId, hotspots, undefined, {
      locationAnchors: anchors,
      storyChains: chains,
    });
    const location: GeneratedLocation = {
      id: createId("gloc"),
      islandId: island.id,
      hotspotId: pin.hotspotId,
      name: options.name,
      persistence: "TEMPORARY",
      maturity: "NEW",
      kind: inferLocationKind(options.name),
      value: valueFromName(options.name),
      anchorId: options.anchorId,
      questId: options.questId,
      chainId: options.chainId,
    };
    this.ensure(island).push(location);
    return location;
  },

  evaluateAfterQuest(run: RunState, island: Island, questId: string): void {
    for (const location of this.ensure(island).filter((row) => row.questId === questId && !row.destroyed)) {
      if (PERSISTENT_NAMES.test(location.name) || location.value.developmentValue >= 8) {
        this.promotePersistent(run, island, location);
        continue;
      }
      this.removeTemporary(run, island, location);
    }
  },

  promotePersistent(run: RunState, island: Island, location: GeneratedLocation): void {
    location.persistence = "PERSISTENT";
    location.maturity = "NEW";
    location.kind = location.kind ?? inferLocationKind(location.name);
    location.foundedDay = run.day;
    location.lastGrowthDay = run.day;
    location.value = clampValue({
      ...location.value,
      vulnerability: Math.min(90, location.value.vulnerability + 10),
    });
    location.name = stageName(location.kind, "NEW");
    const anchor = getMapLayoutAnchors(island, island.mapAssetId).find((row) => row.id === location.anchorId);
    if (anchor) {
      anchor.occupancy = "CONVERTED_PERSISTENT";
    }
    this.syncHotspotName(island, location);
  },

  tickGrowth(run: RunState, island: Island): string[] {
    const lines: string[] = [];
    IslandPressureService.ensure(island);
    for (const location of this.living(island).filter((row) => row.persistence === "PERSISTENT")) {
      location.kind = location.kind ?? inferLocationKind(location.name);
      location.foundedDay ??= run.day;
      location.lastGrowthDay ??= location.foundedDay;
      location.value = clampValue({
        ...location.value,
        developmentValue: location.value.developmentValue + 1,
      });
      const waited = run.day - (location.lastGrowthDay ?? run.day);
      if (location.maturity === "NEW" && waited >= GROWTH_DAYS_TO_DEVELOPING && location.value.developmentValue >= 5) {
        lines.push(...this.advanceMaturity(run, island, location, "DEVELOPING"));
      } else if (
        location.maturity === "DEVELOPING" &&
        waited >= GROWTH_DAYS_TO_ESTABLISHED &&
        location.value.developmentValue >= 10
      ) {
        lines.push(...this.advanceMaturity(run, island, location, "ESTABLISHED"));
      }
    }
    return lines;
  },

  advanceMaturity(run: RunState, island: Island, location: GeneratedLocation, next: LocationMaturity): string[] {
    const kind = location.kind ?? inferLocationKind(location.name);
    location.maturity = next;
    location.kind = next === "ESTABLISHED" && (kind === "camp" || kind === "settlement") ? "village" : kind;
    location.name = stageName(location.kind, next);
    location.lastGrowthDay = run.day;
    if (next === "DEVELOPING") {
      location.value = clampValue({
        ...location.value,
        developmentValue: location.value.developmentValue + 3,
        economicValue: location.value.economicValue + 2,
        civilianValue: location.value.civilianValue + 2,
        vulnerability: location.value.vulnerability - 12,
      });
      IslandPressureService.adjustDevelopment(island, 4);
      IslandPressureService.adjustTrust(island, 3);
      IslandPressureService.adjustPressure(island, -2);
    } else {
      location.value = clampValue({
        ...location.value,
        developmentValue: location.value.developmentValue + 5,
        economicValue: location.value.economicValue + 3,
        civilianValue: location.value.civilianValue + 3,
        strategicValue: location.value.strategicValue + (kind === "outpost" ? 3 : 1),
        vulnerability: location.value.vulnerability - 20,
      });
      IslandPressureService.adjustDevelopment(island, 8);
      IslandPressureService.adjustTrust(island, 5);
      IslandPressureService.adjustPressure(island, -4);
      if (kind === "outpost") {
        IslandPressureService.adjustProtection(island, 8);
      }
    }
    this.syncHotspotName(island, location);
    const line =
      next === "DEVELOPING"
        ? `${location.name} takes hold on ${island.name}.`
        : `${location.name} is now a fixture of ${island.name}.`;
    run.world.history.push({ id: createId("news"), day: run.day, text: line });
    return [line];
  },

  locationScore(location: GeneratedLocation, prefer: LocationEventPrefer = "any"): number {
    return eventScore(
      location.value.economicValue,
      location.value.strategicValue,
      location.value.civilianValue,
      prefer,
      location.value.vulnerability,
    );
  },

  facilityScore(facilityId: string, prefer: LocationEventPrefer = "any"): number {
    const row = FACILITY_EVENT_VALUE[facilityId] ?? { economic: 1, strategic: 1, civilian: 1 };
    return eventScore(row.economic, row.strategic, row.civilian, prefer);
  },

  pickEventTarget(
    island: Island,
    options: {
      prefer?: LocationEventPrefer;
      includeFacilities?: string[];
      occupied?: Set<string>;
      onlyGenerated?: boolean;
      maturity?: LocationMaturity[];
    } = {},
  ): { hotspotId: string; label: string; generated?: GeneratedLocation } | null {
    const prefer = options.prefer ?? "any";
    const occupied = options.occupied ?? new Set();
    const ranked: Array<{ hotspotId: string; label: string; score: number; generated?: GeneratedLocation }> = [];
    for (const location of this.living(island)) {
      if (options.maturity && !options.maturity.includes(location.maturity)) {
        continue;
      }
      const id = location.hotspotId;
      if (occupied.has(id)) {
        continue;
      }
      ranked.push({
        hotspotId: id,
        label: location.name,
        score: this.locationScore(location, prefer),
        generated: location,
      });
    }
    if (!options.onlyGenerated) {
      for (const facilityId of options.includeFacilities ?? []) {
        if (occupied.has(facilityId)) {
          continue;
        }
        ranked.push({
          hotspotId: facilityId,
          label: facilityId.replaceAll("_", " "),
          score: this.facilityScore(facilityId, prefer),
        });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked[0];
    return top ? { hotspotId: top.hotspotId, label: top.label, generated: top.generated } : null;
  },

  pickDestroyTarget(island: Island): GeneratedLocation | null {
    const picked = this.pickEventTarget(island, {
      prefer: "vulnerable",
      onlyGenerated: true,
      maturity: ["NEW", "DEVELOPING"],
    });
    return picked?.generated ?? null;
  },

  syncHotspotName(island: Island, location: GeneratedLocation): void {
    const hotspots = getMapLayoutHotspots(island, island.mapAssetId).map((row) =>
      row.hotspotId === location.hotspotId ? { ...row, purpose: location.name } : row,
    );
    setMapLayoutHotspots(island, island.mapAssetId, hotspots, undefined, {
      locationAnchors: getMapLayoutAnchors(island, island.mapAssetId),
      storyChains: getMapLayoutStoryChains(island, island.mapAssetId),
    });
  },

  removeTemporary(run: RunState, island: Island, location: GeneratedLocation): void {
    const hotspots = getMapLayoutHotspots(island, island.mapAssetId).filter((row) => row.hotspotId !== location.hotspotId);
    const anchors = getMapLayoutAnchors(island, island.mapAssetId);
    const anchor = anchors.find((row) => row.id === location.anchorId);
    if (anchor) {
      anchor.occupancy = "AVAILABLE";
      anchor.generatedLocationId = undefined;
    }
    setMapLayoutHotspots(island, island.mapAssetId, hotspots, undefined, {
      locationAnchors: anchors,
      storyChains: getMapLayoutStoryChains(island, island.mapAssetId),
    });
    island.generatedLocations = this.ensure(island).filter((row) => row.id !== location.id);
    NpcResidencyService.relocateFrom(run, island, location.hotspotId);
  },

  destroy(run: RunState, island: Island, location: GeneratedLocation, ruinedDays = 3): void {
    location.destroyed = true;
    location.ruinedUntilDay = run.day + ruinedDays;
    IslandPressureService.adjustDevelopment(island, location.maturity === "ESTABLISHED" ? -8 : -3);
    IslandPressureService.adjustTrust(island, location.maturity === "ESTABLISHED" ? -6 : -2);
    IslandPressureService.adjustPressure(island, 6);
    NpcResidencyService.relocateFrom(run, island, location.hotspotId);
  },

  tickRuins(run: RunState, island: Island): void {
    for (const location of [...this.ensure(island)]) {
      if (location.destroyed && (location.ruinedUntilDay ?? 0) <= run.day) {
        this.removeTemporary(run, island, location);
      }
    }
  },
};
