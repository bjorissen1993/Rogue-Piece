import { loreForFruit, loreForRace, techniquesForFruit } from "../data/collectionLore";
import { itemIdFromName } from "../data/items";
import type { CollectionKnowledge, ProfileSave } from "../models/types";
import { nowIso } from "../utils/ids";

function emptyKnowledge(id: string): CollectionKnowledge {
  return {
    id,
    discovered: false,
    knowledgeLevel: 0,
    unlockedEntries: [],
    discoveredTechniques: [],
  };
}

function ensureEntry(entries: CollectionKnowledge[], id: string): CollectionKnowledge {
  const existing = entries.find((item) => item.id === id);
  if (existing) {
    existing.knowledgeLevel ??= existing.discovered ? 1 : 0;
    existing.unlockedEntries ??= [];
    existing.discoveredTechniques ??= [];
    return existing;
  }
  const created = emptyKnowledge(id);
  entries.push(created);
  return created;
}

function markDiscovered(entry: CollectionKnowledge): boolean {
  const first = !entry.discovered;
  entry.discovered = true;
  entry.knowledgeLevel = Math.max(entry.knowledgeLevel, 1);
  if (!entry.unlockedEntries.includes("intro")) {
    entry.unlockedEntries.push("intro");
  }
  if (first) {
    entry.discoveredAt = nowIso();
  }
  return first;
}

export const CollectionService = {
  discoverFruit(profile: ProfileSave, fruitId: string): boolean {
    const entry = ensureEntry(profile.collection.devilFruits, fruitId);
    const changed = markDiscovered(entry);
    if (changed) {
      profile.statistics.fruitsDiscovered = profile.collection.devilFruits.filter(
        (item) => item.discovered,
      ).length;
    }
    return changed;
  },

  raiseFruitKnowledge(profile: ProfileSave, fruitId: string, level: number): void {
    const entry = ensureEntry(profile.collection.devilFruits, fruitId);
    markDiscovered(entry);
    entry.knowledgeLevel = Math.max(entry.knowledgeLevel, level);
    for (const lore of loreForFruit(fruitId)) {
      if (lore.minLevel <= entry.knowledgeLevel && !entry.unlockedEntries.includes(lore.id)) {
        entry.unlockedEntries.push(lore.id);
      }
    }
  },

  discoverItem(profile: ProfileSave, itemId: string): boolean {
    const entry = ensureEntry(profile.collection.items, itemId);
    return markDiscovered(entry);
  },

  discoverItemByName(profile: ProfileSave, name: string): boolean {
    const id = itemIdFromName(name);
    if (!id) {
      return false;
    }
    return this.discoverItem(profile, id);
  },

  discoverTechnique(profile: ProfileSave, fruitId: string, techniqueId: string): boolean {
    this.discoverFruit(profile, fruitId);
    const entry = ensureEntry(profile.collection.devilFruits, fruitId);
    if (entry.discoveredTechniques.includes(techniqueId)) {
      return false;
    }
    const known = techniquesForFruit(fruitId).some((item) => item.id === techniqueId);
    if (!known) {
      return false;
    }
    entry.discoveredTechniques.push(techniqueId);
    this.raiseFruitKnowledge(profile, fruitId, 2);
    return true;
  },

  unlockLore(
    profile: ProfileSave,
    kind: "race" | "fruit" | "item",
    id: string,
    entryId: string,
  ): void {
    if (kind === "race") {
      const row = profile.progression.races.find((item) => item.raceId === id);
      if (!row) {
        return;
      }
      row.known = true;
      if (!row.unlockedEntries.includes(entryId)) {
        row.unlockedEntries.push(entryId);
      }
      const lore = loreForRace(id).find((item) => item.id === entryId);
      if (lore) {
        row.knowledgeLevel = Math.max(row.knowledgeLevel ?? 0, lore.minLevel);
      }
      return;
    }
    const list = kind === "fruit" ? profile.collection.devilFruits : profile.collection.items;
    const entry = ensureEntry(list, id);
    markDiscovered(entry);
    if (!entry.unlockedEntries.includes(entryId)) {
      entry.unlockedEntries.push(entryId);
    }
    if (kind === "fruit") {
      const lore = loreForFruit(id).find((item) => item.id === entryId);
      if (lore) {
        entry.knowledgeLevel = Math.max(entry.knowledgeLevel, lore.minLevel);
      }
    }
  },

  isFruitDiscovered(profile: ProfileSave, fruitId: string): boolean {
    return Boolean(profile.collection.devilFruits.find((item) => item.id === fruitId)?.discovered);
  },

  fruitKnowledge(profile: ProfileSave, fruitId: string): CollectionKnowledge | undefined {
    return profile.collection.devilFruits.find((item) => item.id === fruitId);
  },

  itemKnowledge(profile: ProfileSave, itemId: string): CollectionKnowledge | undefined {
    return profile.collection.items.find((item) => item.id === itemId);
  },

  visibleFruitLore(profile: ProfileSave, fruitId: string) {
    const entry = this.fruitKnowledge(profile, fruitId);
    if (!entry?.discovered) {
      return [];
    }
    return loreForFruit(fruitId).filter(
      (lore) => lore.minLevel <= entry.knowledgeLevel || entry.unlockedEntries.includes(lore.id),
    );
  },
};
