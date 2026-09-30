import {
  continuityMultiplier,
  TRAINING_BASE_EXP_PER_SLOT,
  TRAINING_CATEGORIES,
  TRAINING_EQUIPMENT,
  TRAINING_EXP_PER_STAT_POINT,
  trainingEquipmentBonus,
} from "../data/trainingGrounds";
import type { RunState, StatName, TrainingExpType, TrainingSession, WeaponType } from "../models/types";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { ProgressionService } from "./ProgressionService";
import { WeaponMasteryService } from "./WeaponMasteryService";
import { WeaponService } from "./WeaponService";

const STAT_CATEGORIES: TrainingExpType[] = [
  "strength",
  "defense",
  "speed",
  "willpower",
  "charisma",
  "intelligence",
];

function sessionKey(characterId: string, run: RunState): string {
  return characterId === run.player.id ? "player" : characterId;
}

export function trainingEfficiencyPercent(session: TrainingSession): number {
  const equipment = trainingEquipmentBonus(session.equipmentItemIds, session.category);
  return Math.round((session.continuityMultiplier * (1 + equipment)) * 100);
}

export function trainingEfficiencyBreakdown(session: TrainingSession): string[] {
  const equipment = trainingEquipmentBonus(session.equipmentItemIds, session.category);
  const lines = [`Continuity +${Math.round((session.continuityMultiplier - 1) * 100)}%`];
  for (const itemId of session.equipmentItemIds) {
    const def = TRAINING_EQUIPMENT.find((entry) => entry.itemId === itemId);
    if (def && def.categories.includes(session.category)) {
      lines.push(`${def.name} +${Math.round(def.bonus * 100)}%`);
    }
  }
  if (equipment === 0 && session.equipmentItemIds.length === 0) {
    lines.push("No training equipment");
  }
  return lines;
}

export const TrainingGroundsService = {
  ensure(run: RunState): TrainingSession[] {
    if (!run.trainingSessions) {
      run.trainingSessions = [];
    }
    return run.trainingSessions;
  },

  getSession(run: RunState, characterId: string): TrainingSession | null {
    const id = sessionKey(characterId, run);
    return this.ensure(run).find((entry) => entry.characterId === id) ?? null;
  },

  assignedEquipmentOwners(run: RunState): Map<string, string> {
    const map = new Map<string, string>();
    for (const session of this.ensure(run)) {
      for (const itemId of session.equipmentItemIds) {
        map.set(itemId, session.characterId);
      }
    }
    return map;
  },

  start(
    run: RunState,
    characterId: string,
    category: TrainingExpType,
    options?: { weaponType?: WeaponType; techniqueId?: string; equipmentItemIds?: string[] },
  ): { ok: boolean; message: string } {
    const id = sessionKey(characterId, run);
    if (this.getSession(run, id)) {
      return { ok: false, message: "That crewmate is already training." };
    }
    const owners = this.assignedEquipmentOwners(run);
    for (const itemId of options?.equipmentItemIds ?? []) {
      if (owners.has(itemId)) {
        return { ok: false, message: "That training gear is already assigned." };
      }
    }
    const label = TRAINING_CATEGORIES.find((entry) => entry.id === category)?.label ?? "Training";
    const assignment = CharacterScheduleService.startAssignment(run, {
      characterId: id,
      type: category === "weapon_mastery" ? "WEAPON_TRAINING" : category === "technique_mastery" ? "STYLE_TRAINING" : "TRAINING",
      label: `${label} Training`,
      durationSlots: 9999,
      focus: category,
      interruptible: true,
      metadata: { openEnded: true, trainingGrounds: true },
    });
    if (!assignment.ok) {
      return { ok: false, message: assignment.message };
    }
    this.ensure(run).push({
      characterId: id,
      category,
      weaponType: options?.weaponType,
      techniqueId: options?.techniqueId,
      startedDay: run.day,
      startedSlot: ["DAWN", "MORNING", "AFTERNOON", "EVENING", "NIGHT"].indexOf(run.timeOfDay),
      elapsedSlots: 0,
      pendingExp: {},
      equipmentItemIds: [...(options?.equipmentItemIds ?? [])],
      continuityMultiplier: 1,
    });
    const name = ProgressionService.getDisplayName(run, id);
    return { ok: true, message: `${name} begins ${label} training. Stop it whenever you choose.` };
  },

  assignEquipment(run: RunState, characterId: string, itemId: string): { ok: boolean; message: string } {
    const session = this.getSession(run, characterId);
    if (!session) {
      return { ok: false, message: "Start training before assigning gear." };
    }
    const owner = this.assignedEquipmentOwners(run).get(itemId);
    if (owner && owner !== session.characterId) {
      return { ok: false, message: "That training gear is already in use." };
    }
    if (!session.equipmentItemIds.includes(itemId)) {
      session.equipmentItemIds.push(itemId);
    }
    return { ok: true, message: "Training gear assigned." };
  },

  clearEquipment(run: RunState, characterId: string, itemId: string): void {
    const session = this.getSession(run, characterId);
    if (!session) {
      return;
    }
    session.equipmentItemIds = session.equipmentItemIds.filter((id) => id !== itemId);
  },

  tickAfterTimeAdvance(run: RunState, slots: number): void {
    if (slots <= 0) {
      return;
    }
    for (const session of this.ensure(run)) {
      for (let step = 0; step < slots; step += 1) {
        session.elapsedSlots += 1;
        session.continuityMultiplier = continuityMultiplier(session.elapsedSlots);
        const equipment = 1 + trainingEquipmentBonus(session.equipmentItemIds, session.category);
        const gained = TRAINING_BASE_EXP_PER_SLOT * session.continuityMultiplier * equipment;
        if (session.category === "sparring") {
          for (const key of [...STAT_CATEGORIES, "weapon_mastery", "technique_mastery"] as TrainingExpType[]) {
            const share = gained * 0.22;
            session.pendingExp[key] = (session.pendingExp[key] ?? 0) + share;
          }
        } else {
          session.pendingExp[session.category] = (session.pendingExp[session.category] ?? 0) + gained;
        }
      }
    }
  },

  stop(run: RunState, characterId: string): string {
    const id = sessionKey(characterId, run);
    const session = this.getSession(run, id);
    if (!session) {
      return CharacterScheduleService.interrupt(run, id, true);
    }
    const name = ProgressionService.getDisplayName(run, id);
    const notes = this.applyPendingExp(run, session);
    run.trainingSessions = this.ensure(run).filter((entry) => entry.characterId !== id);
    CharacterScheduleService.interrupt(run, id, true);
    const reward = notes.length ? ` ${notes.join(" ")}` : "";
    return `${name} stops training. Streak reset.${reward}`;
  },

  applyPendingExp(run: RunState, session: TrainingSession): string[] {
    const notes: string[] = [];
    const name = ProgressionService.getDisplayName(run, session.characterId);
    for (const [key, raw] of Object.entries(session.pendingExp)) {
      const amount = Math.floor(raw ?? 0);
      if (amount <= 0) {
        continue;
      }
      if (STAT_CATEGORIES.includes(key as TrainingExpType)) {
        const points = Math.floor(amount / TRAINING_EXP_PER_STAT_POINT);
        if (points > 0) {
          for (let i = 0; i < points; i += 1) {
            const line = CharacterScheduleService.applyStatGain(run, session.characterId, key as StatName);
            if (line) {
              notes.push(line);
            }
          }
        }
      }
      if (key === "weapon_mastery" && session.characterId === "player") {
        const weaponType = session.weaponType ?? "SWORD";
        WeaponService.addMastery(run, weaponType, Math.max(1, Math.floor(amount / 8)));
        const unlock = WeaponMasteryService.applyUnlocks(run);
        notes.push(`${weaponType} mastery improved.`);
        if (unlock) {
          notes.push(unlock);
        }
      }
    }
    if (!notes.length) {
      notes.push(`${name} keeps the practice earned so far.`);
    }
    return notes;
  },
};

export { TRAINING_CATEGORIES };
