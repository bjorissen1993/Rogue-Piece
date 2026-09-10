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
  | "OBSERVE"
  | "DEFEAT";

export type CombatPresentationKind = "basic" | "technique" | "critical" | "round" | "start" | "defeat";

export const COMBAT_PRESENTATION_MS = {
  basic: 1100,
  technique: 1600,
  critical: 2000,
  round: 900,
  start: 1100,
  defeat: 1500,
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
  const hitTargets = hits.filter((hit) => hit.kind === "HIT").map((hit) => hit.combatantId);
  const missTargets = hits.filter((hit) => hit.kind === "MISS").map((hit) => hit.combatantId);
  const healTargets = hits.filter((hit) => hit.kind === "HEAL").map((hit) => hit.combatantId);

  for (const entry of entries) {
    const text = entry.text;
    const upper = text.toUpperCase();
    const isCrit = /critical/i.test(text);
    const isTech = /lands \(/i.test(text) || /uses /i.test(text);
    const kind: CombatPresentationKind = isCrit ? "critical" : isTech ? "technique" : "basic";
    let animation: CombatAnimationType | undefined;
    let targetIds: string[] | undefined;
    let amount: number | undefined;
    let amountKind: "HIT" | "MISS" | "HEAL" | undefined;

    if (/slips|dodge|aside|miss/i.test(text)) {
      animation = "DODGE";
      targetIds = missTargets.length ? missTargets : undefined;
      amountKind = "MISS";
    } else if (/guard|braces|block/i.test(text)) {
      animation = "DEFEND";
      targetIds = hitTargets.length ? hitTargets : undefined;
      amountKind = "HIT";
      amount = hits.find((hit) => hit.kind === "HIT")?.amount;
    } else if (/heals|recover/i.test(text)) {
      animation = "HEAL";
      targetIds = healTargets.length ? healTargets : undefined;
      amountKind = "HEAL";
      amount = hits.find((hit) => hit.kind === "HEAL")?.amount;
    } else if (/spots|observe|revealed|weak point/i.test(text)) {
      animation = "OBSERVE";
    } else if (isTech) {
      animation = animationForAbilityTags(undefined, text);
      targetIds = hitTargets.length ? hitTargets : undefined;
      amountKind = hitTargets.length ? "HIT" : undefined;
      amount = hits.find((hit) => hit.kind === "HIT")?.amount;
    } else if (/slam|heavy/i.test(text)) {
      animation = "MELEE_HEAVY";
      targetIds = hitTargets.length ? hitTargets : undefined;
      amountKind = "HIT";
      amount = hits.find((hit) => hit.kind === "HIT")?.amount;
    } else if (/strike|hit|damage|attack/i.test(text)) {
      animation = "MELEE_SLASH";
      targetIds = hitTargets.length ? hitTargets : undefined;
      amountKind = "HIT";
      amount = hits.find((hit) => hit.kind === "HIT")?.amount;
    }

    const headline = upper.length > 72 ? `${upper.slice(0, 70)}…` : upper;
    beats.push({ headline, kind, animation, targetIds, amount, amountKind });
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

export function defeatBeats(
  combatants: Array<{ id: string; name: string; hp: number }>,
  hits: Array<{ combatantId: string; kind: "HIT" | "MISS" | "HEAL" }>,
): CombatPresentationBeat[] {
  const struck = new Set(hits.filter((hit) => hit.kind === "HIT").map((hit) => hit.combatantId));
  return combatants
    .filter((entry) => entry.hp <= 0 && struck.has(entry.id))
    .map((entry) => ({
      headline: `${entry.name.toUpperCase()} DEFEATED`,
      subline: "They fall.",
      kind: "defeat" as const,
      animation: "DEFEAT" as const,
      targetIds: [entry.id],
    }));
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
