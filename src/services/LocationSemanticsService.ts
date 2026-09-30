import { inferSemanticTags } from "../data/locationSemantics";
import type { Island, LocationAnchor, MapAnchorRegion } from "../models/types";
import { getMapLayoutAnchorRegions, getMapLayoutAnchors } from "../data/islandMaps";

/** Infer and cache semantic tags from creator-given names. Game logic validates; this never mutates quest state. */
export const LocationSemanticsService = {
  tagsForName(name: string): string[] {
    return inferSemanticTags(name);
  },

  refreshAnchor(anchor: LocationAnchor): LocationAnchor {
    const name = anchor.description.trim();
    if (anchor.semanticSourceName === name && anchor.semanticTags?.length) {
      return anchor;
    }
    anchor.semanticSourceName = name;
    anchor.semanticTags = inferSemanticTags(name);
    if (!anchor.tags.length) {
      anchor.tags = [...anchor.semanticTags];
    }
    return anchor;
  },

  refreshRegion(region: MapAnchorRegion): MapAnchorRegion {
    const name = region.name.trim();
    if (region.semanticSourceName === name && region.semanticTags?.length) {
      return region;
    }
    region.semanticSourceName = name;
    region.semanticTags = inferSemanticTags(name);
    return region;
  },

  refreshIsland(island: Island): void {
    const mapId = island.mapAssetId;
    for (const anchor of getMapLayoutAnchors(island, mapId)) {
      this.refreshAnchor(anchor);
    }
    for (const region of getMapLayoutAnchorRegions(island, mapId)) {
      this.refreshRegion(region);
    }
  },

  allIslandTags(island: Island): string[] {
    this.refreshIsland(island);
    const tags = new Set<string>(island.cultureTags ?? []);
    if (island.biome) {
      inferSemanticTags(island.biome).forEach((tag) => tags.add(tag));
    }
    for (const anchor of getMapLayoutAnchors(island, island.mapAssetId)) {
      for (const tag of anchor.semanticTags ?? inferSemanticTags(anchor.description)) {
        tags.add(tag);
      }
    }
    for (const region of getMapLayoutAnchorRegions(island, island.mapAssetId)) {
      for (const tag of region.semanticTags ?? inferSemanticTags(region.name)) {
        tags.add(tag);
      }
    }
    return [...tags];
  },
};
