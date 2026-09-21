import type { AfflictionKind, CharacterAffliction, RunState } from "../models/types";
import { CrewService } from "./CrewService";
import { ProgressionService } from "./ProgressionService";

const DEFAULT_DAYS = 3;

function normalizeId(run: RunState, characterId: string): "player" | string {
  return characterId === run.player.id ? "player" : characterId;
}

function listFor(run: RunState, characterId: string): CharacterAffliction[] {
  const id = normalizeId(run, characterId);
  if (id === "player") {
    return run.player.afflictions ?? [];
  }
  const member = run.crew.find((entry) => entry.characterId === id);
  return member?.afflictions ?? [];
}

function writeList(run: RunState, characterId: string, list: CharacterAffliction[]): void {
  const id = normalizeId(run, characterId);
  if (id === "player") {
    run.player.afflictions = list.length ? list : undefined;
    return;
  }
  const member = run.crew.find((entry) => entry.characterId === id);
  if (member) {
    member.afflictions = list.length ? list : undefined;
  }
}

function defaultDamagePerDay(maxHp: number): number {
  return Math.max(2, Math.round(maxHp * 0.04));
}

function maxHpFor(run: RunState, characterId: string): number {
  const id = normalizeId(run, characterId);
  if (id === "player") {
    return Math.max(1, run.player.maxHp);
  }
  const vitals = CrewService.ensureMemberVitals(run, id);
  return vitals?.maxHp ?? 20;
}

function kindLabel(kind: AfflictionKind): string {
  return kind === "POISON" ? "Poisoned" : "Sick";
}

export const AfflictionService = {
  list(run: RunState, characterId: string): CharacterAffliction[] {
    return listFor(run, characterId);
  },

  /** Active poison / sickness DoT, if any (one badge covers both). */
  activeDot(run: RunState, characterId: string): CharacterAffliction | null {
    return (
      listFor(run, characterId).find(
        (entry) =>
          (entry.kind === "POISON" || entry.kind === "SICKNESS") && entry.daysRemaining > 0,
      ) ?? null
    );
  },

  isAfflicted(run: RunState, characterId: string): boolean {
    return Boolean(this.activeDot(run, characterId));
  },

  apply(
    run: RunState,
    characterId: string,
    kind: AfflictionKind,
    options?: { days?: number; damagePerDay?: number; label?: string },
  ): CharacterAffliction {
    const id = normalizeId(run, characterId);
    const maxHp = maxHpFor(run, id);
    const next: CharacterAffliction = {
      kind,
      daysRemaining: Math.max(1, options?.days ?? DEFAULT_DAYS),
      damagePerDay: Math.max(1, options?.damagePerDay ?? defaultDamagePerDay(maxHp)),
      label: options?.label,
    };
    const others = listFor(run, id).filter((entry) => entry.kind !== kind);
    writeList(run, id, [...others, next]);
    return next;
  },

  clear(run: RunState, characterId: string, kind?: AfflictionKind): void {
    const id = normalizeId(run, characterId);
    if (!kind) {
      writeList(run, id, []);
      return;
    }
    writeList(
      run,
      id,
      listFor(run, id).filter((entry) => entry.kind !== kind),
    );
  },

  /** Hospital / ship doctor clears toxins and infection. */
  clearMedicalDots(run: RunState, characterId: string): void {
    const id = normalizeId(run, characterId);
    writeList(
      run,
      id,
      listFor(run, id).filter((entry) => entry.kind !== "POISON" && entry.kind !== "SICKNESS"),
    );
  },

  badgeTip(run: RunState, characterId: string): string | null {
    const dot = this.activeDot(run, characterId);
    if (!dot) {
      return null;
    }
    const label = dot.label ?? kindLabel(dot.kind);
    const days = Math.max(1, dot.daysRemaining);
    const dayWord = days === 1 ? "day" : "days";
    return `${label}\n${dot.damagePerDay} HP / day · ${days} ${dayWord} left`;
  },

  /** Apply daily DoT damage and decrement remaining days. Returns log lines. */
  tickDaily(run: RunState): string[] {
    const lines: string[] = [];
    const targets: Array<"player" | string> = [
      "player",
      ...run.crew.map((member) => member.characterId),
    ];

    for (const characterId of targets) {
      const list = listFor(run, characterId);
      if (!list.length) {
        continue;
      }
      const kept: CharacterAffliction[] = [];
      const name = ProgressionService.getDisplayName(run, characterId);

      for (const affliction of list) {
        if (affliction.daysRemaining <= 0) {
          continue;
        }
        if (affliction.kind === "POISON" || affliction.kind === "SICKNESS") {
          const dealt = this.applyDamage(run, characterId, affliction.damagePerDay);
          if (dealt > 0) {
            lines.push(
              `${name} suffers ${dealt} HP from ${kindLabel(affliction.kind).toLowerCase()}.`,
            );
          }
        }
        const remaining = affliction.daysRemaining - 1;
        if (remaining > 0) {
          kept.push({ ...affliction, daysRemaining: remaining });
        } else {
          lines.push(`${name} recovers from ${kindLabel(affliction.kind).toLowerCase()}.`);
        }
      }
      writeList(run, characterId, kept);
    }

    return lines;
  },

  applyDamage(run: RunState, characterId: string, amount: number): number {
    const id = normalizeId(run, characterId);
    const dmg = Math.max(0, Math.round(amount));
    if (dmg <= 0) {
      return 0;
    }
    if (id === "player") {
      const before = run.player.hp;
      run.player.hp = Math.max(1, before - dmg);
      return before - run.player.hp;
    }
    const vitals = CrewService.ensureMemberVitals(run, id);
    const member = run.crew.find((entry) => entry.characterId === id);
    if (!vitals || !member || member.hp == null) {
      return 0;
    }
    const before = member.hp;
    member.hp = Math.max(1, before - dmg);
    return before - member.hp;
  },
};
