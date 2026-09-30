import { FACTIONS } from "../data/factions";
import type { FactionPairRelation, RelationFactionId, RunState } from "../models/types";

function pairKey(a: RelationFactionId, b: RelationFactionId): string {
  return [a, b].sort().join(":");
}

const DEFAULT_PAIRS: Array<[RelationFactionId, RelationFactionId, number]> = [
  ["MARINES", "PIRATES", -40],
  ["WORLD_GOVERNMENT", "PIRATES", -55],
  ["WORLD_GOVERNMENT", "REVOLUTIONARY_ARMY", -70],
  ["MARINES", "REVOLUTIONARY_ARMY", -50],
  ["CIVILIANS", "MARINES", 20],
  ["CIVILIANS", "REVOLUTIONARY_ARMY", 15],
  ["CIVILIANS", "PIRATES", -10],
  ["CIVILIANS", "WORLD_GOVERNMENT", 5],
  ["MARINES", "WORLD_GOVERNMENT", 60],
  ["PIRATES", "REVOLUTIONARY_ARMY", 5],
];

export function factionRelationBand(value: number): "Hostile" | "Tense" | "Neutral" | "Friendly" | "Allied" {
  if (value <= -60) {
    return "Hostile";
  }
  if (value <= -20) {
    return "Tense";
  }
  if (value < 20) {
    return "Neutral";
  }
  if (value < 60) {
    return "Friendly";
  }
  return "Allied";
}

export const FactionDiplomacyService = {
  ensure(run: RunState): FactionPairRelation[] {
    if (!run.world.factionMatrix || run.world.factionMatrix.length === 0) {
      run.world.factionMatrix = DEFAULT_PAIRS.map(([a, b, value]) => ({ a, b, value }));
    }
    return run.world.factionMatrix;
  },

  get(run: RunState, a: RelationFactionId, b: RelationFactionId): number {
    if (a === b) {
      return 100;
    }
    const key = pairKey(a, b);
    const row = this.ensure(run).find((entry) => pairKey(entry.a, entry.b) === key);
    return row?.value ?? 0;
  },

  modify(run: RunState, a: RelationFactionId, b: RelationFactionId, delta: number): number {
    if (a === b) {
      return 100;
    }
    const matrix = this.ensure(run);
    const key = pairKey(a, b);
    let row = matrix.find((entry) => pairKey(entry.a, entry.b) === key);
    if (!row) {
      row = { a, b, value: 0 };
      matrix.push(row);
    }
    row.value = Math.max(-100, Math.min(100, row.value + delta));
    return row.value;
  },

  areHostile(run: RunState, a: RelationFactionId, b: RelationFactionId): boolean {
    return this.get(run, a, b) <= -60;
  },

  ids(): RelationFactionId[] {
    return FACTIONS.map((faction) => faction.id);
  },
};
