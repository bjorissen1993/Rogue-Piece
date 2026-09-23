export const FISH_CATCH_ITEM_IDS = ["fish", "fish_fine", "fish_prime", "fish_golden"] as const;

export type FishCatchItemId = (typeof FISH_CATCH_ITEM_IDS)[number];

export type FishCatchRarity = "common" | "uncommon" | "rare" | "legendary";

export type FishCatchTier = {
  id: FishCatchItemId;
  name: string;
  rarity: FishCatchRarity;
};

export const FISH_CATCH_TIERS: readonly FishCatchTier[] = [
  { id: "fish", name: "Common Catch", rarity: "common" },
  { id: "fish_fine", name: "Choice Catch", rarity: "uncommon" },
  { id: "fish_prime", name: "Prime Catch", rarity: "rare" },
  { id: "fish_golden", name: "Golden Catch", rarity: "legendary" },
];

export const FISHING_HITS_TO_CATCH = 3;
export const FISHING_TIME_SLOTS = 1;
/** Fight clock. Green/gold refill toward this cap; at 0 the fish leaves. */
export const FISHING_TIMER_MS = 10000;
export const FISHING_GREEN_BONUS_MS = 2000;
export const FISHING_GOLD_BONUS_MS = 3200;
export const FISHING_RED_BONUS_MS = FISHING_GOLD_BONUS_MS;

export function applyFishingTimerBonus(timeLeftMs: number, gold: boolean): number {
  const bonus = gold ? FISHING_GOLD_BONUS_MS : FISHING_GREEN_BONUS_MS;
  return Math.min(FISHING_TIMER_MS, Math.max(0, timeLeftMs) + bonus);
}

export function applyFishingRedTimerBonus(timeLeftMs: number): number {
  return Math.min(FISHING_TIMER_MS, Math.max(0, timeLeftMs) + FISHING_RED_BONUS_MS);
}

export type FishingArc = {
  start: number;
  width: number;
};

export type FishingGaugeZones = {
  greens: [FishingArc, FishingArc];
  gold: FishingArc;
  red?: FishingArc;
};

export function normalizeFishingDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function fishingArcContains(angle: number, arc: FishingArc): boolean {
  const delta = normalizeFishingDeg(angle - arc.start);
  return delta <= arc.width;
}

export function fishingArcsOverlap(a: FishingArc, b: FishingArc, pad = 0): boolean {
  const wideA = { start: a.start - pad, width: a.width + pad * 2 };
  const wideB = { start: b.start - pad, width: b.width + pad * 2 };
  return (
    fishingArcContains(b.start, wideA) ||
    fishingArcContains(b.start + b.width, wideA) ||
    fishingArcContains(a.start, wideB) ||
    fishingArcContains(a.start + a.width, wideB)
  );
}

function placeArc(width: number, placed: FishingArc[], pad: number): FishingArc {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const next = { start: Math.random() * 360, width };
    if (!placed.some((arc) => fishingArcsOverlap(arc, next, pad))) {
      return next;
    }
  }
  return { start: Math.random() * 360, width };
}

export function rollFishingZones(
  hitIndex: number,
  options?: { includeRed?: boolean },
): FishingGaugeZones {
  const greenWidth = Math.max(30, 44 - hitIndex * 5);
  const goldWidth = Math.max(12, 16 - hitIndex);
  const pad = 10;
  const first = placeArc(greenWidth, [], pad);
  const second = placeArc(greenWidth, [first], pad);
  const gold = placeArc(goldWidth, [first, second], pad);
  const red = options?.includeRed ? placeArc(goldWidth, [first, second, gold], pad) : undefined;
  return { greens: [first, second], gold, red };
}

export function isFishCatchItem(itemId: string): boolean {
  return (FISH_CATCH_ITEM_IDS as readonly string[]).includes(itemId);
}

export type FishingCatchStats = {
  greenHits: number;
  goldHits: number;
  grayHits: number;
  timeLeftMs: number;
};

export const FISHING_GREEN_MULT = 0.35;
export const FISHING_GOLD_MULT = 0.75;
export const FISHING_TIMER_MULT = 0.9;
export const FISHING_GRAY_MULT = 0.28;
export const FISHING_MULT_MIN = 0.25;
export const FISHING_MULT_MAX = 3.5;

export function computeFishingMultiplier(stats: FishingCatchStats): number {
  const green = Math.max(0, stats.greenHits) * FISHING_GREEN_MULT;
  const gold = Math.max(0, stats.goldHits) * FISHING_GOLD_MULT;
  const timer = Math.max(0, Math.min(1, stats.timeLeftMs / FISHING_TIMER_MS)) * FISHING_TIMER_MULT;
  const gray = Math.max(0, stats.grayHits) * FISHING_GRAY_MULT;
  const raw = 1 + green + gold + timer - gray;
  return Math.round(Math.max(FISHING_MULT_MIN, Math.min(FISHING_MULT_MAX, raw)) * 100) / 100;
}

export type FishRarityWeight = {
  tier: FishCatchTier;
  weight: number;
};

export function fishingRarityWeights(multiplier: number): FishRarityWeight[] {
  const m = Math.max(FISHING_MULT_MIN, Math.min(FISHING_MULT_MAX, multiplier));
  return [
    { tier: FISH_CATCH_TIERS[0]!, weight: Math.max(4, 64 - m * 18) },
    { tier: FISH_CATCH_TIERS[1]!, weight: Math.max(5, 16 + m * 7) },
    { tier: FISH_CATCH_TIERS[2]!, weight: Math.max(0.8, -2 + m * 11) },
    { tier: FISH_CATCH_TIERS[3]!, weight: m < 1.15 ? 0 : (m - 1.15) * 10 },
  ];
}

export function rollFishCatch(
  stats: FishingCatchStats,
  roll: number,
): { tier: FishCatchTier; multiplier: number } {
  const multiplier = computeFishingMultiplier(stats);
  const weights = fishingRarityWeights(multiplier).filter((entry) => entry.weight > 0);
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return { tier: entry.tier, multiplier };
    }
  }
  return { tier: weights[weights.length - 1]!.tier, multiplier };
}
