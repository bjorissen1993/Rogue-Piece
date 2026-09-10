export type CombatAnimationType =
  | "MELEE_SLASH"
  | "MELEE_HEAVY"
  | "THRUST"
  | "PROJECTILE"
  | "AOE"
  | "HEAL"
  | "BUFF"
  | "DEBUFF"
  | "DEFEND"
  | "DODGE"
  | "IMPACT"
  | "OBSERVE";

export type CombatPresentationKind = "basic" | "technique" | "critical" | "round" | "start";

export const COMBAT_PRESENTATION_MS = {
  basic: 1000,
  technique: 1800,
  critical: 2400,
  round: 900,
  start: 1100,
} as const;

export interface CombatPresentationBeat {
  headline: string;
  subline?: string;
  kind: CombatPresentationKind;
  animation?: CombatAnimationType;
  actorId?: string;
  targetIds?: string[];
  amount?: number;
  amountKind?: "HIT" | "MISS" | "HEAL";
}

export function presentationDurationMs(kind: CombatPresentationKind, speed = 1): number {
  const base = COMBAT_PRESENTATION_MS[kind] ?? COMBAT_PRESENTATION_MS.basic;
  return Math.max(180, Math.round(base / Math.max(0.5, speed)));
}

export function beatsFromLogAndHits(
  entries: Array<{ text: string }>,
  hits: Array<{ combatantId: string; amount: number; kind: "HIT" | "MISS" | "HEAL" }>,
): CombatPresentationBeat[] {
  const beats: CombatPresentationBeat[] = [];
  for (const entry of entries) {
    const text = entry.text;
    const upper = text.toUpperCase();
    const isCrit = /critical/i.test(text);
    const isTech = /lands \(/i.test(text) || /uses /i.test(text);
    const kind: CombatPresentationKind = isCrit ? "critical" : isTech ? "technique" : "basic";
    let animation: CombatAnimationType | undefined;
    if (/slips|dodge|aside/i.test(text)) {
      animation = "DODGE";
    } else if (/guard|braces/i.test(text)) {
      animation = "DEFEND";
    } else if (/heals|recover/i.test(text)) {
      animation = "HEAL";
    } else if (/spots|observe|revealed|weak point/i.test(text)) {
      animation = "OBSERVE";
    } else if (isTech) {
      animation = animationForAbilityTags(undefined, text);
    } else if (/slam|heavy/i.test(text)) {
      animation = "MELEE_HEAVY";
    } else if (/strike|hit|damage/i.test(text)) {
      animation = "MELEE_SLASH";
    }
    const headline = upper.length > 72 ? `${upper.slice(0, 70)}…` : upper;
    beats.push({ headline, kind, animation });
  }
  if (!beats.length && hits.length) {
    for (const hit of hits) {
      beats.push({
        headline: hit.kind === "MISS" ? "MISS" : hit.kind === "HEAL" ? `+${hit.amount} HP` : `-${hit.amount}`,
        kind: "basic",
        animation: hit.kind === "MISS" ? "DODGE" : hit.kind === "HEAL" ? "HEAL" : "IMPACT",
        targetIds: [hit.combatantId],
        amount: hit.amount,
        amountKind: hit.kind,
      });
    }
  }
  return beats;
}

export function animationForAbilityTags(tags: string[] | undefined, name?: string): CombatAnimationType {
  const hay = `${(tags ?? []).join(" ")} ${name ?? ""}`.toLowerCase();
  if (hay.includes("aoe") || hay.includes("sweep") || hay.includes("crescent")) {
    return "AOE";
  }
  if (hay.includes("ranged") || hay.includes("shot") || hay.includes("projectile")) {
    return "PROJECTILE";
  }
  if (hay.includes("thrust") || hay.includes("impale")) {
    return "THRUST";
  }
  if (hay.includes("heal")) {
    return "HEAL";
  }
  if (hay.includes("buff")) {
    return "BUFF";
  }
  if (hay.includes("debuff")) {
    return "DEBUFF";
  }
  if (hay.includes("defensive") || hay.includes("defend") || hay.includes("parry")) {
    return "DEFEND";
  }
  if (hay.includes("heavy") || hay.includes("bash") || hay.includes("slam")) {
    return "MELEE_HEAVY";
  }
  return "MELEE_SLASH";
}
