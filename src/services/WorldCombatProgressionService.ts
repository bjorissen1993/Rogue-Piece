import type { CombatKind, CombatRequest, RunState } from "../models/types";
import { MAX_ACTIVE_FIGHTERS } from "../game/constants";
import type { RandomService } from "./RandomService";

export type WorldThreatTier = 1 | 2 | 3 | 4 | 5 | 6;

export type ExtraEnemySpec = {
  name: string;
  strength: number;
  hp: number;
  formation: "FRONT" | "BACK";
};

const BANDS: Array<{ maxDay: number; tier: WorldThreatTier; label: string }> = [
  { maxDay: 10, tier: 1, label: "Local threats" },
  { maxDay: 25, tier: 2, label: "Experienced fighters" },
  { maxDay: 50, tier: 3, label: "Regional threats" },
  { maxDay: 80, tier: 4, label: "Major sea threats" },
  { maxDay: 120, tier: 5, label: "Powerful world actors" },
  { maxDay: Number.POSITIVE_INFINITY, tier: 6, label: "Legendary threats" },
];

const SUPPORT_ARCHETYPES: Record<WorldThreatTier, string[]> = {
  1: ["Marine Recruit", "Bandit", "Rookie Pirate", "Bounty Thug"],
  2: ["Marine Rifleman", "Harbor Thug", "Veteran Deckhand", "Local Hunter"],
  3: ["Marine Medic", "Elite Bounty Hunter", "Pirate Officer", "Special Agent"],
  4: ["Marine Captain", "Veteran Pirate", "Cipher Pol Scout", "Famous Mercenary"],
  5: ["Elite Marine", "Notorious Captain", "Government Assassin", "Revolutionary Cell"],
  6: ["Vice Admiral Guard", "Emperor Crew Elite", "CP0 Shadow", "Warlord Retainer"],
};

function activePartySize(run: RunState): number {
  const fighters = run.activeParty?.activeFighterIds.filter(Boolean).length ?? 0;
  return Math.min(1 + fighters, 1 + MAX_ACTIVE_FIGHTERS);
}

function notorietyScore(run: RunState): number {
  const bounty = run.player.bounty ?? 0;
  const loyalty = run.player.affiliation?.reputationWithinFaction ?? 0;
  return bounty / 20000 + loyalty / 25;
}

export const WorldCombatProgressionService = {
  dayBandLabel(day: number): string {
    return BANDS.find((band) => day <= band.maxDay)?.label ?? "Legendary threats";
  },

  worldThreatTier(run: RunState): WorldThreatTier {
    const fromDay = BANDS.find((band) => run.day <= band.maxDay)?.tier ?? 6;
    const wg = run.world.worldPower?.worldGovernmentPower ?? 0;
    const seaShift = run.currentLocationId?.toLowerCase().includes("grand") ? 1 : 0;
    const notoriety = notorietyScore(run) >= 8 ? 1 : 0;
    return Math.min(6, Math.max(1, fromDay + seaShift + (wg > 70 ? 1 : 0) + notoriety)) as WorldThreatTier;
  },

  explainDifficulty(run: RunState): string {
    const tier = this.worldThreatTier(run);
    return [
      `Day ${run.day} · ${this.dayBandLabel(run.day)}`,
      `World threat tier ${tier}`,
      `Party size ${activePartySize(run)}`,
      `Bounty ${run.player.bounty ?? 0}`,
      `Notoriety ${notorietyScore(run).toFixed(1)}`,
    ].join("\n");
  },

  knownCharacterEligibility(run: RunState): { eligible: boolean; reasons: string[]; names: string[] } {
    const reasons: string[] = [];
    if (run.day >= 25) {
      reasons.push("Day threshold reached");
    }
    if ((run.player.bounty ?? 0) >= 50_000) {
      reasons.push("Bounty has drawn attention");
    }
    if ((run.player.affiliation?.reputationWithinFaction ?? 0) >= 40) {
      reasons.push("Faction standing is notable");
    }
    if (run.worldProgressionFlags?.grandLine || run.currentLocationId === "reverse_mountain") {
      reasons.push("Grand Line proximity");
    }
    const eligible = reasons.length >= 2 || (run.day >= 50 && reasons.length >= 1);
    const names = eligible
      ? ["A well-known Marine officer", "A famous swordsman", "A Government agent"]
      : [];
    return { eligible, reasons, names };
  },

  shouldAddMinions(kind: CombatKind | undefined): boolean {
    return kind !== "BOSS" && kind !== "DUEL";
  },

  desiredEnemyCount(run: RunState, request: CombatRequest): number {
    if (request.enemyCount) {
      return Math.max(1, Math.min(4, request.enemyCount));
    }
    if (!this.shouldAddMinions(request.combatKind)) {
      return 1;
    }
    const tier = this.worldThreatTier(run);
    const party = activePartySize(run);
    let count = 1;
    if (tier >= 2 && party >= 2) {
      count = 2;
    }
    if (tier >= 3 && party >= 3) {
      count = 3;
    }
    if (tier >= 5 && party >= 4) {
      count = 4;
    }
    if (request.combatKind === "HIGH_RISK" && count < 2) {
      count = 2;
    }
    return Math.min(4, count);
  },

  additionalEnemies(run: RunState, request: CombatRequest, rng: RandomService): ExtraEnemySpec[] {
    if (request.extraEnemies?.length) {
      return request.extraEnemies.slice(0, 3).map((entry, index) => ({
        name: entry.name,
        strength: entry.strength,
        hp: entry.hp ?? Math.max(10, Math.round((request.enemyHp ?? 22 + request.enemyStrength * 5) * 0.55)),
        formation: entry.formation ?? (index === 0 ? "FRONT" : "BACK"),
      }));
    }
    const desired = this.desiredEnemyCount(run, request);
    const extras = desired - 1;
    if (extras <= 0) {
      return [];
    }
    const tier = this.worldThreatTier(run);
    const pool = SUPPORT_ARCHETYPES[tier];
    const result: ExtraEnemySpec[] = [];
    for (let i = 0; i < extras; i += 1) {
      const name = pool[rng.nextInt(0, pool.length - 1)] ?? "Marine Recruit";
      const strength = Math.max(2, Math.round(request.enemyStrength * (0.45 + i * 0.08)));
      result.push({
        name,
        strength,
        hp: Math.max(10, Math.round((request.enemyHp ?? 22 + request.enemyStrength * 5) * 0.55)),
        formation: i === 0 ? "FRONT" : "BACK",
      });
    }
    return result;
  },
};
