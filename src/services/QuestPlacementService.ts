import { ARCHETYPE_START_FACILITIES, FACILITY_SEMANTIC_TAGS } from "../data/locationSemantics";
import {
  getMapLayoutAnchorRegions,
  getMapLayoutAnchors,
} from "../data/islandMaps";
import type {
  Island,
  IslandFacilityHotspot,
  LocationAnchor,
  QuestArchetypeId,
} from "../models/types";
import { LocationSemanticsService } from "./LocationSemanticsService";
import { IslandService } from "./IslandService";

export type QuestPlacement =
  | { kind: "icon"; hotspot: IslandFacilityHotspot }
  | { kind: "persistent"; hotspot: IslandFacilityHotspot }
  | { kind: "anchor"; anchor: LocationAnchor; hotspot?: IslandFacilityHotspot }
  | { kind: "adapt" };

function overlap(wanted: string[], have: string[]): number {
  const set = new Set(have);
  return wanted.filter((tag) => set.has(tag)).length;
}

function freeAnchor(anchor: LocationAnchor, regionAllows: boolean): boolean {
  if (!regionAllows) {
    return false;
  }
  return (anchor.occupancy ?? "AVAILABLE") === "AVAILABLE";
}

/**
 * Resolve a location for one quest node against the current island layout.
 * Does not invent volcanoes or other missing context.
 */
export const QuestPlacementService = {
  resolveStart(island: Island, archetypeId: QuestArchetypeId, wantedTags: string[]): QuestPlacement {
    LocationSemanticsService.refreshIsland(island);
    const hotspots = IslandService.resolveHotspots(island, null, true);
    const preferred = ARCHETYPE_START_FACILITIES[archetypeId] ?? ["MARKET", "INN", "HARBOR"];
    for (const facilityId of preferred) {
      const hotspot = hotspots.find((row) => row.facilityId === facilityId && !row.hidden);
      if (hotspot) {
        return { kind: "icon", hotspot };
      }
    }
    const persistents = [...(island.generatedLocations ?? [])]
      .filter((row) => !row.destroyed && row.persistence === "PERSISTENT")
      .sort(
        (a, b) =>
          b.value.economicValue + b.value.civilianValue + b.value.strategicValue -
          (a.value.economicValue + a.value.civilianValue + a.value.strategicValue),
      );
    const persistent = persistents[0];
    if (persistent) {
      const hotspot = hotspots.find((row) => row.hotspotId === persistent.hotspotId);
      if (hotspot) {
        return { kind: "persistent", hotspot };
      }
    }
    return this.resolveFallback(island, wantedTags, hotspots);
  },

  resolveBeat(island: Island, wantedTags: string[]): QuestPlacement {
    LocationSemanticsService.refreshIsland(island);
    const hotspots = IslandService.resolveHotspots(island, null, true);
    let best: { hotspot: IslandFacilityHotspot; score: number } | null = null;
    for (const hotspot of hotspots) {
      const tags = FACILITY_SEMANTIC_TAGS[hotspot.facilityId] ?? [];
      const score = overlap(wantedTags, tags);
      if (score > 0 && (!best || score > best.score)) {
        best = { hotspot, score };
      }
    }
    if (best) {
      return { kind: "icon", hotspot: best.hotspot };
    }
    return this.resolveFallback(island, wantedTags, hotspots);
  },

  resolveFallback(island: Island, wantedTags: string[], hotspots: IslandFacilityHotspot[]): QuestPlacement {
    const regions = getMapLayoutAnchorRegions(island, island.mapAssetId);
    const anchors = getMapLayoutAnchors(island, island.mapAssetId);
    let bestAnchor: { anchor: LocationAnchor; score: number } | null = null;
    for (const anchor of anchors) {
      const region = regions.find((row) =>
        row.points.some((point) => {
          const bound = hotspots.find((hot) => hot.hotspotId === anchor.hotspotId);
          return bound
            ? Math.abs(bound.xPct - point.xPct) < 40 && Math.abs(bound.yPct - point.yPct) < 40
            : false;
        }),
      );
      const allowed = region?.generatedPinsAllowed !== false;
      if (!freeAnchor(anchor, allowed)) {
        continue;
      }
      const tags = anchor.semanticTags ?? LocationSemanticsService.tagsForName(anchor.description);
      const score = overlap(wantedTags, tags) || (wantedTags.length === 0 ? 1 : 0);
      if (score > 0 && (!bestAnchor || score > bestAnchor.score)) {
        bestAnchor = { anchor, score };
      }
    }
    if (bestAnchor) {
      const bound = hotspots.find((row) => row.hotspotId === bestAnchor!.anchor.hotspotId);
      return { kind: "anchor", anchor: bestAnchor.anchor, hotspot: bound };
    }
    const anyFree = anchors.find((anchor) => (anchor.occupancy ?? "AVAILABLE") === "AVAILABLE");
    if (anyFree) {
      return {
        kind: "anchor",
        anchor: anyFree,
        hotspot: hotspots.find((row) => row.hotspotId === anyFree.hotspotId),
      };
    }
    const fallback = hotspots.find((row) =>
      ["MARKET", "HARBOR", "INN"].includes(row.facilityId),
    );
    if (fallback) {
      return { kind: "icon", hotspot: fallback };
    }
    return { kind: "adapt" };
  },
};
