import type { PlayerStats, StatName } from "../models/types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampStat(value: number): number {
  return clamp(value, 1, 20);
}

export function ensurePlayerStats(stats: Partial<PlayerStats> | PlayerStats | undefined): PlayerStats {
  const base = stats ?? {};
  return {
    strength: clampStat(base.strength ?? 1),
    defense: clampStat(base.defense ?? 1),
    speed: clampStat(base.speed ?? 1),
    willpower: clampStat(base.willpower ?? 1),
    charisma: clampStat(base.charisma ?? 1),
    intelligence: clampStat(
      base.intelligence ??
        Math.max(2, Math.round(((base.willpower ?? 2) + (base.charisma ?? 2)) / 2)),
    ),
  };
}

export function applyStatChanges(
  stats: PlayerStats,
  changes: Partial<PlayerStats> | undefined,
): PlayerStats {
  if (!changes) {
    return ensurePlayerStats(stats);
  }

  const next = ensurePlayerStats(stats);
  (Object.keys(changes) as StatName[]).forEach((stat) => {
    const delta = changes[stat];
    if (delta !== undefined) {
      next[stat] = clampStat(next[stat] + delta);
    }
  });
  return next;
}

export function addUnique(list: string[], items: string[] | undefined): string[] {
  if (!items?.length) {
    return list;
  }
  const next = [...list];
  for (const item of items) {
    if (!next.includes(item)) {
      next.push(item);
    }
  }
  return next;
}

export function removeValues(list: string[], items: string[] | undefined): string[] {
  if (!items?.length) {
    return list;
  }
  return list.filter((value) => !items.includes(value));
}
