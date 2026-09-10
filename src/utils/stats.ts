import type { PlayerStats, StatName } from "../models/types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampStat(value: number): number {
  return clamp(value, 1, 20);
}

export function applyStatChanges(
  stats: PlayerStats,
  changes: Partial<PlayerStats> | undefined,
): PlayerStats {
  if (!changes) {
    return stats;
  }

  const next = { ...stats };
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
