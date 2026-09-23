import {
  generatedLooksHistorical,
  masteryRankFromXp,
  masteryRankLabel,
  masteryRankMeets,
  mergeNamingBuffs,
  namingBuffsFor,
  namingPoolCategoryFor,
  namingPoolFor,
  stageTraitFor,
  stubSoulTraitFromHistory,
  WEAPON_SERVICE_GATES,
} from "../data/weaponProgression";
import { getWeapon } from "../data/weapons";
import type {
  InventoryItem,
  MasteryRank,
  RunState,
  WeaponNamingPath,
  WeaponProgression,
  WeaponSoulState,
} from "../models/types";
import type { RandomService } from "./RandomService";

export type NamingChoice = {
  path: WeaponNamingPath;
  adjective: string;
  label: string;
};

export type WeaponUsageHint = {
  fastHits?: number;
  heavyHits?: number;
  crits?: number;
  accurateHits?: number;
  blocks?: number;
  finishers?: number;
  bosses?: number;
};

function isWeaponItem(item: InventoryItem): boolean {
  return item.type === "WEAPON" || Boolean(item.weaponDefinitionId) || Boolean(item.generatedWeapon);
}

function catalogBaseName(item: InventoryItem): string {
  if (item.generatedWeapon?.name) {
    return item.generatedWeapon.name;
  }
  if (item.weaponDefinitionId) {
    return getWeapon(item.weaponDefinitionId)?.name ?? item.name;
  }
  return item.name;
}

export function defaultWeaponProgression(item: InventoryItem): WeaponProgression {
  const generated = item.generatedWeapon;
  const historical = generated ? generatedLooksHistorical(generated) : false;
  return {
    naming: {
      baseName: catalogBaseName(item),
      customNamed: false,
      historicalNamed: historical,
      stages: [],
      buffs: {},
    },
    wielderMastery: {},
    soul: { state: "DORMANT", trait: "NONE" },
    legacy: { status: "NONE", formerOwners: [], notes: [] },
    seastone: { mod: "NONE", functional: false },
    upgradeLevel: 0,
    advancedUpgradeLevel: 0,
    history: historical && generated?.namedId ? [`Historical Named Weapon (${generated.namedId}).`] : [],
  };
}

export const WeaponProgressionService = {
  ensure(item: InventoryItem): WeaponProgression {
    if (!item.weaponProgress) {
      item.weaponProgress = defaultWeaponProgression(item);
    }
    const progress = item.weaponProgress;
    if (!progress.naming.baseName) {
      progress.naming.baseName = catalogBaseName(item);
    }
    if (progress.naming.historicalNamed == null) {
      progress.naming.historicalNamed = item.generatedWeapon
        ? generatedLooksHistorical(item.generatedWeapon)
        : false;
    }
    progress.naming.stages ??= [];
    progress.naming.buffs ??= {};
    progress.wielderMastery ??= {};
    progress.soul ??= { state: "DORMANT", trait: "NONE" };
    progress.legacy ??= { status: "NONE", formerOwners: [], notes: [] };
    progress.seastone ??= { mod: "NONE", functional: false };
    progress.upgradeLevel ??= 0;
    progress.advancedUpgradeLevel ??= 0;
    progress.history ??= [];
    return progress;
  },

  migrateInventory(run: RunState): void {
    for (const item of run.player.inventory ?? []) {
      if (!isWeaponItem(item)) {
        continue;
      }
      this.ensure(item);
      if (item.name && item.weaponProgress) {
        item.name = this.displayName(item);
      }
    }
  },

  displayName(item: InventoryItem): string {
    const progress = item.weaponProgress ?? defaultWeaponProgression(item);
    const adjective = progress.naming.currentAdjective?.trim();
    const base = progress.naming.baseName?.trim() || catalogBaseName(item);
    if (adjective) {
      return `${adjective} ${base}`;
    }
    return base;
  },

  namingStage(item: InventoryItem): number {
    return this.ensure(item).naming.stages.length;
  },

  canSetBaseName(item: InventoryItem): { ok: boolean; reason: string } {
    const naming = this.ensure(item).naming;
    if (naming.historicalNamed) {
      return { ok: false, reason: "This Named Weapon already has a historical name." };
    }
    if (naming.customNamed) {
      return { ok: false, reason: "The base name is already sealed." };
    }
    return { ok: true, reason: "" };
  },

  setBaseName(item: InventoryItem, rawName: string): { ok: boolean; reason: string } {
    const check = this.canSetBaseName(item);
    if (!check.ok) {
      return check;
    }
    const name = rawName.trim();
    if (name.length < 2 || name.length > 28) {
      return { ok: false, reason: "Choose a name between 2 and 28 letters." };
    }
    if (!/^[\p{L}][\p{L}\s'-]*$/u.test(name)) {
      return { ok: false, reason: "Use letters, spaces, or a simple mark." };
    }
    const progress = this.ensure(item);
    progress.naming.baseName = name;
    progress.naming.customNamed = true;
    progress.history.push(`Named ${name}.`);
    item.name = this.displayName(item);
    return { ok: true, reason: `The weapon answers to ${this.displayName(item)}.` };
  },

  generateNamingChoices(
    item: InventoryItem,
    rng: RandomService,
    usage?: WeaponUsageHint,
  ): NamingChoice[] {
    const progress = this.ensure(item);
    const nextStage = (progress.naming.stages.length + 1) as 1 | 2 | 3;
    if (nextStage > 3) {
      return [];
    }
    const pool = namingPoolFor({
      category: item.generatedWeapon?.category,
      weaponType: item.generatedWeapon?.weaponType ?? getWeapon(item.weaponDefinitionId ?? "")?.weaponType,
      archetypeId: item.generatedWeapon?.archetypeId ?? item.weaponDefinitionId,
    });
    const used = new Set(progress.naming.stages.map((stage) => stage.adjective));
    const paths: WeaponNamingPath[] = ["AGILITY", "EFFICIENCY", "POWER"];
    return paths.map((path) => {
      const adjective = this.pickAdjective(pool, path, nextStage, used, usage, rng, progress);
      used.add(adjective);
      return {
        path,
        adjective,
        label: path === "AGILITY" ? "Agility / Speed" : path === "EFFICIENCY" ? "Mastery / Efficiency" : "Power",
      };
    });
  },

  pickAdjective(
    pool: ReturnType<typeof namingPoolFor>,
    path: WeaponNamingPath,
    stage: 1 | 2 | 3,
    used: Set<string>,
    usage: WeaponUsageHint | undefined,
    rng: RandomService,
    progress: WeaponProgression,
  ): string {
    const candidates = pool.filter((entry) => {
      if (entry.path !== path || used.has(entry.adjective)) {
        return false;
      }
      if (stage < 3 && entry.identity) {
        return false;
      }
      if (stage === 3 && !entry.identity && pool.some((row) => row.path === path && row.identity && !used.has(row.adjective))) {
        return rng.chance(0.35);
      }
      return true;
    });
    const fallback = pool.filter((entry) => entry.path === path && !used.has(entry.adjective));
    const list = candidates.length ? candidates : fallback.length ? fallback : pool.filter((entry) => entry.path === path);
    if (list.length === 0) {
      return path === "AGILITY" ? "Swift" : path === "EFFICIENCY" ? "Precise" : "Furious";
    }
    const weights = list.map((entry) => {
      let weight = 1;
      const prior = progress.naming.stages.filter((stage) => stage.path === path).length;
      weight += prior * 0.55;
      if (path === "AGILITY") {
        weight += (usage?.fastHits ?? 0) * 0.2;
      } else if (path === "EFFICIENCY") {
        weight += (usage?.crits ?? 0) * 0.15 + (usage?.accurateHits ?? 0) * 0.15;
      } else {
        weight += (usage?.heavyHits ?? 0) * 0.2 + (usage?.finishers ?? 0) * 0.25 + (usage?.bosses ?? 0) * 0.2;
      }
      if (stage === 3 && entry.identity) {
        weight += 1.4;
      }
      return Math.max(0.15, weight);
    });
    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = rng.next() * total;
    for (let i = 0; i < list.length; i += 1) {
      roll -= weights[i]!;
      if (roll <= 0) {
        return list[i]!.adjective;
      }
    }
    return list[list.length - 1]!.adjective;
  },

  applyNamingStage(
    item: InventoryItem,
    choice: Pick<NamingChoice, "path" | "adjective">,
  ): { ok: boolean; reason: string } {
    const progress = this.ensure(item);
    if (progress.naming.stages.length >= 3) {
      return { ok: false, reason: "Naming Evolution is complete." };
    }
    const stage = (progress.naming.stages.length + 1) as 1 | 2 | 3;
    const pool = namingPoolCategoryFor({
      category: item.generatedWeapon?.category,
      weaponType: item.generatedWeapon?.weaponType ?? getWeapon(item.weaponDefinitionId ?? "")?.weaponType,
      archetypeId: item.generatedWeapon?.archetypeId ?? item.weaponDefinitionId,
    });
    const add = namingBuffsFor(choice.path, stage, pool);
    progress.naming.buffs = mergeNamingBuffs(progress.naming.buffs, add);
    progress.naming.stages.push({ stage, path: choice.path, adjective: choice.adjective });
    progress.naming.currentAdjective = choice.adjective;
    if (stage === 3) {
      progress.naming.stageTrait = stageTraitFor(choice.adjective, choice.path);
      if (progress.soul.state === "DORMANT") {
        progress.soul.state = "STIRRING";
      }
    }
    progress.history.push(`Naming stage ${stage}: ${choice.adjective} (${choice.path}).`);
    item.name = this.displayName(item);
    return { ok: true, reason: `It is ${item.name} now.` };
  },

  addWielderXp(item: InventoryItem, characterId: string, amount = 1): number {
    const progress = this.ensure(item);
    const current = progress.wielderMastery[characterId] ?? { xp: 0 };
    current.xp += amount;
    progress.wielderMastery[characterId] = current;
    return current.xp;
  },

  wielderXp(item: InventoryItem, characterId: string): number {
    return this.ensure(item).wielderMastery[characterId]?.xp ?? 0;
  },

  wielderRank(item: InventoryItem, characterId: string): MasteryRank {
    return masteryRankFromXp(this.wielderXp(item, characterId));
  },

  wielderRankLabel(item: InventoryItem, characterId: string): string {
    return masteryRankLabel(this.wielderRank(item, characterId));
  },

  meetsGate(item: InventoryItem, characterId: string, required: MasteryRank): boolean {
    return masteryRankMeets(this.wielderRank(item, characterId), required);
  },

  gateReason(item: InventoryItem, characterId: string, required: MasteryRank): string | null {
    if (this.meetsGate(item, characterId, required)) {
      return null;
    }
    return `Requires ${masteryRankLabel(required)} mastery with this weapon (now ${this.wielderRankLabel(item, characterId)}).`;
  },

  noteOwner(item: InventoryItem, characterId: string, name?: string): void {
    const progress = this.ensure(item);
    if (!progress.legacy.formerOwners.includes(characterId)) {
      progress.legacy.formerOwners.push(characterId);
    }
    if (name) {
      progress.history.push(`Wielded by ${name}.`);
    }
  },

  setSoulState(item: InventoryItem, state: WeaponSoulState): void {
    const progress = this.ensure(item);
    progress.soul.state = state;
    if (state !== "DORMANT" && progress.soul.trait === "NONE") {
      progress.soul.trait = stubSoulTraitFromHistory(progress.history);
    }
  },

  markLegacy(item: InventoryItem, status: WeaponProgression["legacy"]["status"], note?: string): void {
    const progress = this.ensure(item);
    progress.legacy.status = status;
    if (note) {
      progress.legacy.notes.push(note);
    }
  },

  applyViewBuffs<T extends {
    name: string;
    damage: number;
    speed: number;
    accuracy: number;
    weight: number;
    critBonus?: number;
  }>(item: InventoryItem, view: T): T {
    const progress = item.weaponProgress;
    if (!progress) {
      return view;
    }
    const buffs = progress.naming.buffs;
    const upgrade = progress.upgradeLevel + progress.advancedUpgradeLevel * 2;
    return {
      ...view,
      name: this.displayName(item),
      damage: view.damage + (buffs.damage ?? 0) + upgrade,
      speed: view.speed + (buffs.speed ?? 0),
      accuracy: view.accuracy + (buffs.accuracy ?? 0),
      weight: Math.max(1, view.weight + (buffs.weight ?? 0)),
      critBonus: (view.critBonus ?? 0) + (buffs.critBonus ?? 0),
    };
  },

  identitySnapshot(item: InventoryItem, wielderId: string | null | undefined) {
    const progress = this.ensure(item);
    return {
      rarity: item.generatedWeapon?.rarity ?? getWeapon(item.weaponDefinitionId ?? "")?.rarity ?? "COMMON",
      wielderMastery: wielderId ? this.wielderRankLabel(item, wielderId) : "Unfamiliar",
      wielderMasteryRank: wielderId ? this.wielderRank(item, wielderId) : ("BEGINNER" as MasteryRank),
      namingStage: `${progress.naming.stages.length}/3`,
      currentName: this.displayName(item),
      soul: progress.soul.state.charAt(0) + progress.soul.state.slice(1).toLowerCase(),
      soulTrait: progress.soul.trait === "NONE" ? null : progress.soul.trait,
      devilFruit: progress.devilFruit?.fruitId ?? null,
      seastone: progress.seastone.mod === "NONE" ? "None" : progress.seastone.mod.replaceAll("_", " "),
      seastoneFunctional: progress.seastone.functional,
      legacy: progress.legacy.status === "NONE" ? "Not legacy" : progress.legacy.status.charAt(0) + progress.legacy.status.slice(1).toLowerCase(),
    };
  },
};

export { WEAPON_SERVICE_GATES };
