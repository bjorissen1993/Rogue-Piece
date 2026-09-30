import {
  GATHER_ATTEMPTS,
  GATHER_CATEGORY_WEIGHTS,
  GATHER_CONTAINER_LOOT,
  GATHER_CONTAINERS,
  GATHER_EQUIPMENT,
  GATHER_FOOD,
  GATHER_RESOURCES,
  GATHER_RICHNESS_ORDER,
  GATHER_SLOT_COUNT,
  GATHER_UNUSUAL,
  type GatherResourceDef,
} from "../data/gather";
import { getMapLayoutAnchorRegions } from "../data/islandMaps";
import { getItemDefinition } from "../data/items";
import type {
  GatherRichness,
  GatherRoster,
  GatherSlot,
  GatherSlotCategory,
  GatherZoneState,
  Island,
  IslandFacilityHotspot,
  ProfileSave,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { ItemService } from "./ItemService";
import { IslandService } from "./IslandService";
import { LocationSemanticsService } from "./LocationSemanticsService";
import { QuestDirectorService } from "./QuestDirectorService";
import { createRng, type RandomService } from "./RandomService";
import { WorldService } from "./WorldService";

function pickCategory(rng: RandomService): GatherSlotCategory {
  const roll = rng.next() * 100;
  let cursor = 0;
  const rows: Array<[GatherSlotCategory, number]> = [
    ["RESOURCE", GATHER_CATEGORY_WEIGHTS.resource],
    ["FOOD", GATHER_CATEGORY_WEIGHTS.food],
    ["ITEM", GATHER_CATEGORY_WEIGHTS.item],
    ["INFORMATION", GATHER_CATEGORY_WEIGHTS.information],
    ["EQUIPMENT", GATHER_CATEGORY_WEIGHTS.equipment],
    ["SPECIAL", GATHER_CATEGORY_WEIGHTS.special],
  ];
  for (const [category, weight] of rows) {
    cursor += weight;
    if (roll <= cursor) {
      return category;
    }
  }
  return "RESOURCE";
}

function poolFor(category: GatherSlotCategory): GatherResourceDef[] {
  if (category === "RESOURCE") {
    return GATHER_RESOURCES;
  }
  if (category === "FOOD") {
    return GATHER_FOOD;
  }
  return GATHER_UNUSUAL.filter((row) => row.category === category);
}

function ownedKits(run: RunState) {
  const owned = new Set((run.player.inventory ?? []).map((row) => row.itemId));
  return GATHER_EQUIPMENT.filter((kit) => owned.has(kit.itemId));
}

function detectionFor(run: RunState): Set<string> {
  const tags = new Set<string>();
  for (const kit of ownedKits(run)) {
    for (const tag of kit.detection) {
      tags.add(tag);
    }
  }
  if ((run.player.stats?.intelligence ?? 0) >= 10) {
    tags.add("documents");
  }
  return tags;
}

function extractionBonus(run: RunState, detection: string[]): number {
  let bonus = 0;
  for (const kit of ownedKits(run)) {
    if (kit.bonus > 0 && kit.extract.some((tag) => detection.includes(tag))) {
      bonus += kit.bonus;
    }
  }
  return bonus;
}

function zoneKey(island: Island | undefined, hotspot: IslandFacilityHotspot | undefined, zoneName: string): string {
  return `${island?.id ?? "isle"}:${hotspot?.hotspotId ?? zoneName}`;
}

function ensureZones(island: Island): GatherZoneState[] {
  island.gatherZones = island.gatherZones ?? [];
  return island.gatherZones;
}

function zoneState(island: Island | undefined, key: string, day: number): GatherZoneState {
  if (!island) {
    return { zoneKey: key, richness: "NORMAL", gatherCount: 0, lastGatherDay: day };
  }
  const rows = ensureZones(island);
  let row = rows.find((entry) => entry.zoneKey === key);
  if (!row) {
    row = { zoneKey: key, richness: "RICH", gatherCount: 0, lastGatherDay: day };
    rows.push(row);
  }
  return row;
}

function stepRichness(current: GatherRichness, delta: number): GatherRichness {
  const index = Math.max(0, Math.min(GATHER_RICHNESS_ORDER.length - 1, GATHER_RICHNESS_ORDER.indexOf(current) + delta));
  return GATHER_RICHNESS_ORDER[index] ?? current;
}

function chooseDef(
  category: GatherSlotCategory,
  tags: string[],
  richness: GatherRichness,
  rng: RandomService,
): GatherResourceDef {
  let pool = poolFor(category === "RESOURCE" ? "RESOURCE" : category);
  const compatible = pool.filter((row) => row.tags.some((tag) => tags.includes(tag)));
  pool = compatible.length ? compatible : pool;
  if (richness === "DEPLETED" || richness === "SPARSE") {
    const common = pool.filter((row) => row.rarity === "COMMON" || row.rarity === "UNCOMMON");
    if (common.length && (richness === "DEPLETED" || rng.chance(0.7))) {
      pool = common;
    }
  }
  if (richness === "DEPLETED") {
    pool = pool.filter((row) => row.category === "RESOURCE" || row.category === "FOOD");
    if (!pool.length) {
      pool = GATHER_RESOURCES.filter((row) => row.rarity === "COMMON");
    }
  }
  return pool[rng.nextInt(0, Math.max(0, pool.length - 1))] ?? GATHER_RESOURCES[0]!;
}

export const GatherService = {
  begin(run: RunState, hotspot?: IslandFacilityHotspot): GatherRoster {
    const island = IslandService.getCurrentIsland(run);
    const zoneName =
      hotspot?.purpose?.trim() ||
      getMapLayoutAnchorRegions(island, island?.mapAssetId).find((region) => region.name)?.name ||
      island?.name ||
      "Island edge";
    const tags = LocationSemanticsService.tagsForName(zoneName);
    if (island?.biome) {
      tags.push(...LocationSemanticsService.tagsForName(island.biome));
    }
    const key = zoneKey(island, hotspot, zoneName);
    const zone = zoneState(island, key, run.day);
    const rng = createRng(`${run.seed}:gather:${run.day}:${run.timeOfDay}:${key}:${zone.gatherCount}`);
    const detected = detectionFor(run);
    const attempts = zone.richness === "DEPLETED" ? 2 : GATHER_ATTEMPTS;
    const slots: GatherSlot[] = [];
    for (let index = 0; index < GATHER_SLOT_COUNT; index += 1) {
      const unusual = index === GATHER_SLOT_COUNT - 1 && zone.richness !== "DEPLETED";
      const category = unusual ? pickCategory(rng) : "RESOURCE";
      const chosen = chooseDef(category === "RESOURCE" && index < 6 ? "RESOURCE" : category, tags, zone.richness, rng);
      const revealed = chosen.detection.some((tag) => detected.has(tag));
      const container = GATHER_CONTAINERS.has(chosen.itemId);
      const extra = zone.richness === "RICH" && rng.chance(0.3) ? 1 : 0;
      slots.push({
        id: createId("gslot"),
        itemId: chosen.itemId,
        quantity: 1 + (rng.chance(0.25) ? 1 : 0) + extra,
        category: chosen.category,
        rarity: chosen.rarity,
        hidden: !revealed,
        revealedByEquipment: revealed,
        sourceContext: zoneName,
        container,
        contents: container ? GATHER_CONTAINER_LOOT[chosen.itemId] : undefined,
        trace: chosen.category === "INFORMATION" ? "investigation" : undefined,
      });
    }
    if ((run.player.stats?.intelligence ?? 0) >= 8) {
      const hidden = slots.find((slot) => slot.hidden);
      if (hidden) {
        hidden.hidden = false;
      }
    }
    const roster: GatherRoster = {
      id: createId("gather"),
      zoneName,
      zoneKey: key,
      hotspotId: hotspot?.hotspotId,
      richness: zone.richness,
      attempts,
      remaining: attempts,
      slots,
      collected: [],
    };
    run.pendingGather = roster;
    return roster;
  },

  pick(run: RunState, slotId: string): string {
    const roster = run.pendingGather;
    if (!roster || roster.remaining <= 0) {
      return "No more gather attempts.";
    }
    const slot = roster.slots.find((row) => row.id === slotId);
    if (!slot) {
      return "That patch is empty.";
    }
    if (slot.taken) {
      return "Already taken.";
    }
    const def = GATHER_RESOURCES.concat(GATHER_FOOD, GATHER_UNUSUAL).find((row) => row.itemId === slot.itemId);
    const bonus = extractionBonus(run, def?.detection ?? []);
    slot.extractionBonus = bonus;
    slot.hidden = false;
    slot.taken = true;
    roster.remaining -= 1;

    if (slot.container && slot.contents?.length) {
      const canOpen = ownedKits(run).some((kit) => kit.extract.includes("containers")) || (run.player.stats?.intelligence ?? 0) >= 8;
      if (canOpen) {
        for (const inner of slot.contents) {
          const qty = inner.quantity + bonus;
          roster.collected.push({ itemId: inner.itemId, quantity: qty });
        }
        const names = slot.contents.map((row) => getItemDefinition(row.itemId)?.name ?? row.itemId).join(", ");
        roster.lastMessage = `You open the ${getItemDefinition(slot.itemId)?.name ?? "container"}: ${names}.`;
        if (slot.contents.some((row) => row.itemId === "torn_document")) {
          QuestDirectorService.onWorldEvent(run, "investigation");
        }
        return roster.lastMessage;
      }
    }

    roster.collected.push({ itemId: slot.itemId, quantity: slot.quantity + bonus });
    const name = getItemDefinition(slot.itemId)?.name ?? slot.itemId;
    roster.lastMessage = `Collected ${name} x${slot.quantity + bonus}${bonus ? " (extraction)" : ""}.`;
    if (slot.trace) {
      QuestDirectorService.onWorldEvent(run, slot.trace);
      run.world.history.push({
        id: createId("news"),
        day: run.day,
        text: `A find at ${roster.zoneName} points to a local ${slot.trace.replaceAll("_", " ")}.`,
      });
      roster.lastMessage = `${roster.lastMessage} A trail opens.`;
    }
    return roster.lastMessage;
  },

  finish(run: RunState, profile?: ProfileSave): string {
    const roster = run.pendingGather;
    if (!roster) {
      return "";
    }
    const rng = createRng(`${run.seed}:gather-end:${run.day}:${roster.id}`);
    WorldService.spendTime(run, 1, rng);
    for (const row of roster.collected) {
      ItemService.grant(run, row.itemId, row.quantity, profile);
    }
    const island = IslandService.getCurrentIsland(run);
    if (island && roster.zoneKey) {
      const zone = zoneState(island, roster.zoneKey, run.day);
      zone.gatherCount += 1;
      zone.lastGatherDay = run.day;
      if (zone.gatherCount >= 6) {
        zone.richness = "DEPLETED";
      } else if (zone.gatherCount >= 4) {
        zone.richness = "SPARSE";
      } else if (zone.gatherCount >= 2) {
        zone.richness = "NORMAL";
      }
    }
    const summary = roster.collected.length
      ? `Gathered ${roster.collected.length} find${roster.collected.length === 1 ? "" : "s"} at ${roster.zoneName}.`
      : `You leave ${roster.zoneName} empty-handed.`;
    run.pendingGather = null;
    run.lastFeedback = summary;
    return summary;
  },

  tickZones(run: RunState): void {
    for (const island of run.islands ?? []) {
      for (const zone of island.gatherZones ?? []) {
        if (run.day - zone.lastGatherDay < 2) {
          continue;
        }
        if (zone.richness === "RICH") {
          continue;
        }
        zone.richness = stepRichness(zone.richness, 1);
        zone.gatherCount = Math.max(0, zone.gatherCount - 1);
        zone.lastGatherDay = run.day;
      }
    }
  },
};
