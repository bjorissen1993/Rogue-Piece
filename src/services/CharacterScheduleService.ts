import { TIME_OF_DAY_ORDER } from "../game/constants";
import type {
  AssignmentCompletionReport,
  AssignmentType,
  CharacterAssignment,
  CrewStatus,
  ParticipantRequirement,
  RunState,
  StatName,
  TimeOfDay,
} from "../models/types";
import { CharacterService } from "./CharacterService";
import { ProgressionService } from "./ProgressionService";
import { WeaponService } from "./WeaponService";
import type { WeaponType } from "../models/types";

function slotIndex(timeOfDay: TimeOfDay): number {
  const index = TIME_OF_DAY_ORDER.indexOf(timeOfDay);
  return index >= 0 ? index : 1;
}

function compareSchedule(
  dayA: number,
  slotA: number,
  dayB: number,
  slotB: number,
): number {
  if (dayA !== dayB) {
    return dayA - dayB;
  }
  return slotA - slotB;
}

function statusFromAssignment(type: AssignmentType): CrewStatus {
  switch (type) {
    case "TRAINING":
    case "WEAPON_TRAINING":
    case "STYLE_TRAINING":
      return "Training";
    case "RECOVERING":
      return "Injured";
    case "HOSPITALIZED":
      return "Hospitalized";
    case "RESTING":
      return "Resting";
    case "ON_MISSION":
    case "HELPING":
      return "OnMission";
    case "PERSONAL_ACTIVITY":
      return "PersonalActivity";
    case "CAPTURED":
      return "Captured";
    case "MISSING":
      return "Missing";
    default:
      return "Unavailable";
  }
}

function formatReturn(assignment: CharacterAssignment): string {
  const slot = TIME_OF_DAY_ORDER[assignment.endSlot] ?? "MORNING";
  if (assignment.endDay === assignment.startDay) {
    return `later today (${slot.toLowerCase()})`;
  }
  return `Day ${assignment.endDay} · ${slot.charAt(0)}${slot.slice(1).toLowerCase()}`;
}

export const CharacterScheduleService = {
  ensure(run: RunState): CharacterAssignment[] {
    if (!run.characterAssignments) {
      run.characterAssignments = [];
    }
    if (!run.pendingAssignmentResults) {
      run.pendingAssignmentResults = [];
    }
    if (!run.characterTrainingToday) {
      run.characterTrainingToday = {};
    }
    return run.characterAssignments;
  },

  getAssignment(run: RunState, characterId: string): CharacterAssignment | null {
    this.ensure(run);
    return run.characterAssignments!.find((entry) => entry.characterId === characterId) ?? null;
  },

  isAvailable(run: RunState, characterId: string): boolean {
    if (characterId === "player" || characterId === run.player.id) {
      return !this.getAssignment(run, "player");
    }
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (!member) {
      return false;
    }
    if (member.status === "Injured" || member.status === "Hospitalized" || member.status === "Captured" || member.status === "Missing") {
      return false;
    }
    return !this.getAssignment(run, characterId);
  },

  availableCharacterIds(run: RunState): string[] {
    const ids: string[] = [];
    if (this.isAvailable(run, "player")) {
      ids.push("player");
    }
    for (const member of run.crew) {
      if (this.isAvailable(run, member.characterId)) {
        ids.push(member.characterId);
      }
    }
    return ids;
  },

  availableCount(run: RunState): number {
    return this.availableCharacterIds(run).length;
  },

  derivedStatus(run: RunState, characterId: string): CrewStatus {
    const assignment = this.getAssignment(run, characterId === run.player.id ? "player" : characterId);
    if (assignment) {
      return statusFromAssignment(assignment.type);
    }
    if (characterId === "player" || characterId === run.player.id) {
      return "Ready";
    }
    const member = run.crew.find((entry) => entry.characterId === characterId);
    return member?.status ?? "Ready";
  },

  scheduleEnd(
    run: RunState,
    durationSlots: number,
  ): { endDay: number; endSlot: number } {
    let day = run.day;
    let slot = slotIndex(run.timeOfDay);
    let remaining = Math.max(1, durationSlots);
    while (remaining > 0) {
      if (slot >= TIME_OF_DAY_ORDER.length - 1) {
        day += 1;
        slot = 0;
      } else {
        slot += 1;
      }
      remaining -= 1;
    }
    return { endDay: day, endSlot: slot };
  },

  startAssignment(
    run: RunState,
    input: {
      characterId: "player" | string;
      type: AssignmentType;
      label: string;
      durationSlots: number;
      focus?: string;
      locationId?: string;
      islandId?: string;
      berriesCost?: number;
      interruptible?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): { ok: boolean; message: string; assignment?: CharacterAssignment } {
    this.ensure(run);
    const characterId = input.characterId === run.player.id ? "player" : input.characterId;
    if (!this.isAvailable(run, characterId)) {
      return { ok: false, message: "That character is already occupied." };
    }
    if (input.berriesCost && run.player.berries < input.berriesCost) {
      return { ok: false, message: "Not enough berries." };
    }
    const end = this.scheduleEnd(run, input.durationSlots);
    const assignment: CharacterAssignment = {
      characterId,
      type: input.type,
      label: input.label,
      startDay: run.day,
      startSlot: slotIndex(run.timeOfDay),
      endDay: end.endDay,
      endSlot: end.endSlot,
      focus: input.focus,
      locationId: input.locationId ?? run.currentLocationId,
      islandId: input.islandId ?? run.currentIslandId ?? undefined,
      berriesCost: input.berriesCost,
      interruptible: input.interruptible ?? true,
      metadata: input.metadata,
    };
    if (input.berriesCost) {
      run.player.berries -= input.berriesCost;
    }
    run.characterAssignments!.push(assignment);
    this.syncMember(run, assignment);
    const name = ProgressionService.getDisplayName(run, characterId);
    return {
      ok: true,
      message: `${name} begins ${assignment.label}. Returns ${formatReturn(assignment)}.`,
      assignment,
    };
  },

  interrupt(run: RunState, characterId: string, keepProgress = true): string {
    this.ensure(run);
    const id = characterId === run.player.id ? "player" : characterId;
    const assignment = this.getAssignment(run, id);
    if (!assignment) {
      return "No active assignment.";
    }
    if (assignment.interruptible === false) {
      return "That assignment cannot be interrupted.";
    }
    run.characterAssignments = run.characterAssignments!.filter((entry) => entry.characterId !== id);
    this.clearMember(run, id);
    const name = ProgressionService.getDisplayName(run, id);
    const progressNote = keepProgress ? " Partial progress is kept." : "";
    return `${name}'s ${assignment.label} is interrupted.${progressNote}`;
  },

  /** Call after each time-slot advance (including day wraps). */
  tickAfterTimeAdvance(run: RunState): AssignmentCompletionReport[] {
    this.ensure(run);
    const completed: AssignmentCompletionReport[] = [];
    const nowDay = run.day;
    const nowSlot = slotIndex(run.timeOfDay);
    const remaining: CharacterAssignment[] = [];
    for (const assignment of run.characterAssignments!) {
      if (compareSchedule(nowDay, nowSlot, assignment.endDay, assignment.endSlot) >= 0) {
        completed.push(this.completeAssignment(run, assignment));
      } else {
        remaining.push(assignment);
      }
    }
    run.characterAssignments = remaining;
    if (completed.length) {
      run.pendingAssignmentResults = [...(run.pendingAssignmentResults ?? []), ...completed];
    }
    return completed;
  },

  completeAssignment(run: RunState, assignment: CharacterAssignment): AssignmentCompletionReport {
    this.clearMember(run, assignment.characterId);
    const name = ProgressionService.getDisplayName(run, assignment.characterId);
    const rewards: string[] = [];
    let summary = `${name} returns from ${assignment.label}.`;

    if (
      assignment.type === "TRAINING" ||
      assignment.type === "WEAPON_TRAINING" ||
      assignment.type === "STYLE_TRAINING"
    ) {
      const xp = 25 + Math.round((assignment.endDay - assignment.startDay) * 15);
      const grant = ProgressionService.grantExperience(run, assignment.characterId, xp, "training");
      if (grant.message) {
        rewards.push(grant.message);
      }
      if (assignment.focus && assignment.type === "TRAINING") {
        const stat = assignment.focus as StatName;
        const applied = this.applyStatGain(run, assignment.characterId, stat);
        if (applied) {
          rewards.push(applied);
        }
      }
      if (assignment.type === "WEAPON_TRAINING" && assignment.focus) {
        if (assignment.characterId === "player") {
          const weaponType = assignment.focus as WeaponType;
          WeaponService.addMastery(run, weaponType, 12 + (assignment.endDay - assignment.startDay) * 8);
          rewards.push(`${weaponType} mastery improved.`);
        }
      }
      summary = `${name} finishes ${assignment.label}.`;
    }

    if (assignment.type === "RECOVERING" || assignment.type === "HOSPITALIZED") {
      summary = `${name} is back on their feet after ${assignment.label.toLowerCase()}.`;
      if (assignment.characterId !== "player") {
        CharacterService.addMemory(run, assignment.characterId, "WAS_KNOCKED_OUT", 1, "Recovered");
      }
      if (assignment.characterId === "player") {
        run.player.hp = Math.max(run.player.hp, Math.round(run.player.maxHp * 0.6));
      }
    }

    return {
      characterId: assignment.characterId,
      label: assignment.label,
      type: assignment.type,
      summary,
      rewards,
    };
  },

  applyStatGain(run: RunState, characterId: string, stat: StatName): string | null {
    if (characterId === "player") {
      const current = run.player.stats[stat];
      if (current >= 20) {
        return null;
      }
      run.player.stats[stat] = Math.min(20, current + 1);
      return `${stat} +1 → ${run.player.stats[stat]}`;
    }
    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return null;
    }
    const stats = ProgressionService.getStats(run, characterId);
    if (stats[stat] >= 20) {
      return null;
    }
    stats[stat] = Math.min(20, stats[stat] + 1);
    character.crewStats = stats;
    if (stat === "strength") {
      character.strength = stats.strength;
    }
    return `${character.name}'s ${stat} +1 → ${stats[stat]}`;
  },

  syncMember(run: RunState, assignment: CharacterAssignment): void {
    if (assignment.characterId === "player") {
      return;
    }
    const member = run.crew.find((entry) => entry.characterId === assignment.characterId);
    if (!member) {
      return;
    }
    member.currentAssignment = assignment;
    member.status = statusFromAssignment(assignment.type);
    member.inActiveParty = false;
    member.inSupportSlot = false;
  },

  clearMember(run: RunState, characterId: string): void {
    if (characterId === "player") {
      return;
    }
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (!member) {
      return;
    }
    member.currentAssignment = null;
    if (
      member.status === "Training" ||
      member.status === "OnMission" ||
      member.status === "PersonalActivity" ||
      member.status === "Unavailable" ||
      member.status === "Resting" ||
      member.status === "Injured" ||
      member.status === "Hospitalized"
    ) {
      member.status = "Ready";
    }
  },

  scheduleEntries(run: RunState): Array<{
    characterId: string;
    name: string;
    status: CrewStatus;
    detail: string;
    available: boolean;
  }> {
    this.ensure(run);
    const rows = [
      {
        characterId: "player",
        name: run.player.name,
        status: this.derivedStatus(run, "player"),
        detail: this.getAssignment(run, "player")
          ? `${this.getAssignment(run, "player")!.label} · returns ${formatReturn(this.getAssignment(run, "player")!)}`
          : "Available",
        available: this.isAvailable(run, "player"),
      },
    ];
    for (const member of run.crew) {
      const assignment = this.getAssignment(run, member.characterId);
      rows.push({
        characterId: member.characterId,
        name: ProgressionService.getDisplayName(run, member.characterId),
        status: this.derivedStatus(run, member.characterId),
        detail: assignment
          ? `${assignment.label} · returns ${formatReturn(assignment)}`
          : "Available",
        available: this.isAvailable(run, member.characterId),
      });
    }
    return rows;
  },

  upcomingCompletions(run: RunState): Array<{ name: string; when: string; label: string }> {
    this.ensure(run);
    return [...run.characterAssignments!]
      .sort((a, b) => compareSchedule(a.endDay, a.endSlot, b.endDay, b.endSlot))
      .map((assignment) => ({
        name: ProgressionService.getDisplayName(run, assignment.characterId),
        label: assignment.label,
        when: formatReturn(assignment),
      }));
  },

  evaluateRequirements(
    run: RunState,
    requirements: ParticipantRequirement[] | undefined,
  ): { ok: boolean; reasons: string[] } {
    if (!requirements?.length) {
      return { ok: true, reasons: [] };
    }
    const reasons: string[] = [];
    const available = this.availableCharacterIds(run);
    for (const requirement of requirements) {
      if (requirement.type === "MIN_CREW") {
        if (available.length < requirement.count) {
          reasons.push(`Needs ${requirement.count} available crew (have ${available.length}).`);
        }
      } else if (requirement.type === "ROLE") {
        const match = run.crew.some(
          (member) =>
            member.role === requirement.role && this.isAvailable(run, member.characterId),
        );
        const captainOk =
          requirement.role === "CAPTAIN" && this.isAvailable(run, "player");
        if (!match && !captainOk) {
          reasons.push(`Needs available ${requirement.role.toLowerCase()}.`);
        }
      } else if (requirement.type === "STAT") {
        const ok = available.some((id) => {
          const stats = ProgressionService.getStats(run, id);
          return stats[requirement.stat] >= requirement.minimum;
        });
        if (!ok) {
          reasons.push(`Needs ${requirement.stat} ${requirement.minimum}+.`);
        }
      } else if (requirement.type === "AVAILABLE_CHARACTER") {
        if (!this.isAvailable(run, requirement.characterId)) {
          reasons.push("Required character unavailable.");
        }
      } else if (requirement.type === "RACE") {
        const ok = available.some((id) => {
          if (id === "player") {
            return run.player.raceId === requirement.raceId;
          }
          return CharacterService.getCharacter(run, id)?.raceId === requirement.raceId;
        });
        if (!ok) {
          reasons.push(`Needs available ${requirement.raceId} crewmate.`);
        }
      } else if (requirement.type === "FIGHTING_STYLE") {
        const ok = available.some((id) => {
          if (id === "player") {
            return run.player.activeCombatStyle === requirement.styleId;
          }
          return CharacterService.getCharacter(run, id)?.combatStyle === requirement.styleId;
        });
        if (!ok) {
          reasons.push("Needs matching fighting style.");
        }
      }
    }
    return { ok: reasons.length === 0, reasons };
  },

  qualitativeChance(statValue: number, difficulty: number): string {
    const delta = statValue - difficulty;
    if (delta <= -6) return "Very Poor";
    if (delta <= -3) return "Poor";
    if (delta <= -1) return "Risky";
    if (delta <= 1) return "Fair";
    if (delta <= 3) return "Good";
    if (delta <= 5) return "Very Good";
    return "Excellent";
  },
};
