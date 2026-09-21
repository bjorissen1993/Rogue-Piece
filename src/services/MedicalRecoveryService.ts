import type {
  CharacterRecoveryMeta,
  CombatKind,
  CombatState,
  CombatantState,
  CrewMember,
  KoSeverity,
  ProfileSave,
  RunState,
  WorldCharacter,
} from "../models/types";
import { TIME_OF_DAY_ORDER } from "../game/constants";
import { AfflictionService } from "./AfflictionService";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { CharacterService } from "./CharacterService";
import { CrewCombatService } from "./CrewCombatService";
import { IslandService } from "./IslandService";
import { PartyCombatService } from "./PartyCombatService";
import { ProgressionService } from "./ProgressionService";

const SLOTS_PER_DAY = TIME_OF_DAY_ORDER.length;

function daysToSlots(days: number): number {
  return Math.max(1, Math.round(days * SLOTS_PER_DAY));
}

function locationLabel(run: RunState): string {
  return IslandService.displayName(run, run.currentIslandId ?? run.currentLocationId);
}

/** Prefer a human place name; rewrite leftover raw island_* ids from older saves. */
function placeLabel(run: RunState, storedName?: string | null, fallbackId?: string | null): string {
  if (storedName && !/^island[_-]/i.test(storedName)) {
    return storedName;
  }
  return IslandService.displayName(run, fallbackId ?? storedName);
}

export const MedicalRecoveryService = {
  isKnockedOut(combatant: CombatantState): boolean {
    return combatant.hp <= 0 || combatant.condition === "KNOCKED_OUT";
  },

  markKnockedOut(combatant: CombatantState, overkill = 0): void {
    combatant.hp = 0;
    combatant.condition = "KNOCKED_OUT";
    combatant.overkillDamage = (combatant.overkillDamage ?? 0) + Math.max(0, overkill);
    combatant.defending = false;
  },

  knockedOutAllies(combat: CombatState): CombatantState[] {
    return PartyCombatService.allAllies(combat).filter((ally) => this.isKnockedOut(ally));
  },

  findCrewDoctor(run: RunState): { member: CrewMember; character: WorldCharacter } | null {
    for (const member of run.crew) {
      if (member.role !== "DOCTOR") continue;
      if (!CharacterScheduleService.isAvailable(run, member.characterId)) continue;
      const character = CharacterService.getCharacter(run, member.characterId);
      if (!character?.alive) continue;
      return { member, character };
    }
    return null;
  },

  estimateSeverity(options: {
    overkill: number;
    maxHp: number;
    defense: number;
    combatKind?: CombatKind;
    isFriendly?: boolean;
  }): KoSeverity {
    if (options.isFriendly) {
      return "MINOR";
    }
    let score = 0;
    const overkillRatio = options.maxHp > 0 ? options.overkill / options.maxHp : 0;
    score += overkillRatio * 4;
    if (options.combatKind === "BOSS" || options.combatKind === "HIGH_RISK") score += 2.5;
    if (options.combatKind === "ELITE") score += 1.5;
    if (options.defense <= 3) score += 1;
    if (options.defense >= 10) score -= 0.75;
    if (score < 1.2) return "MINOR";
    if (score < 2.5) return "MODERATE";
    if (score < 4) return "SEVERE";
    return "CRITICAL";
  },

  baseRecoveryDays(severity: KoSeverity): number {
    switch (severity) {
      case "MINOR":
        return 1;
      case "MODERATE":
        return 2;
      case "SEVERE":
        return 4;
      case "CRITICAL":
        return 6;
    }
  },

  doctorDayReduction(run: RunState, doctor: WorldCharacter): number {
    const int = doctor.crewStats?.intelligence ?? Math.max(2, Math.floor(doctor.strength / 2));
    let reduce = 1;
    if (int >= 6) reduce += 1;
    if (int >= 10) reduce += 1;
    if (run.player.inventory.some((item) => item.id === "medical_kit" || item.id === "strong_medicine")) {
      reduce += 1;
    }
    return reduce;
  },

  /** Shared crew memories for everyone who participated in the fight. */
  recordBattleMemories(run: RunState, combat: CombatState): void {
    if (combat.isFriendly || combat.combatKind === "SPARRING") {
      return;
    }
    const lost = combat.result === "LOSE";
    for (const ally of PartyCombatService.allAllies(combat)) {
      if (ally.id === run.player.id || ally.id === combat.playerCombatant.id) {
        continue;
      }
      CharacterService.addMemory(run, ally.id, "FOUGHT_TOGETHER", 2);
      if (lost) {
        CharacterService.addMemory(run, ally.id, "LOST_BATTLE_TOGETHER", 3);
      }
    }
  },

  /** Apply post-battle medical outcomes. Returns narrative lines. */
  resolveAfterBattle(run: RunState, combat: CombatState): string[] {
    const lines: string[] = [];
    this.recordBattleMemories(run, combat);

    const knocked = this.knockedOutAllies(combat);
    if (!knocked.length) {
      return lines;
    }

    if (combat.isFriendly || combat.combatKind === "SPARRING") {
      for (const ally of knocked) {
        ally.hp = Math.max(1, Math.round(ally.maxHp * 0.35));
        ally.condition = "ACTIVE";
        ally.overkillDamage = 0;
        if (ally.id === run.player.id || ally.id === combat.playerCombatant.id) {
          run.player.hp = ally.hp;
        }
        lines.push(`${ally.name} is winded from the spar — nothing lasting.`);
      }
      return lines;
    }

    const doctor = this.findCrewDoctor(run);
    if (doctor) {
      lines.push(`${doctor.character.name} moves among the fallen with practiced hands.`);
    } else {
      lines.push("Without a shipboard doctor, the wounded will need real care soon.");
    }

    for (const ally of knocked) {
      const severity = this.estimateSeverity({
        overkill: ally.overkillDamage ?? 0,
        maxHp: ally.maxHp,
        defense: ally.stats.defense,
        combatKind: combat.combatKind,
        isFriendly: false,
      });
      const result = this.beginRecovery(run, {
        characterId: ally.id === combat.playerCombatant.id ? "player" : ally.id,
        name: ally.name,
        severity,
        overkill: ally.overkillDamage ?? 0,
        combatKind: combat.combatKind,
        doctor,
      });
      lines.push(...result.lines);

      // Stabilize HP for run continuation (not fight-ready).
      const stabilize = Math.max(1, Math.round(ally.maxHp * (severity === "CRITICAL" ? 0.15 : 0.25)));
      if (ally.id === combat.playerCombatant.id || ally.id === run.player.id) {
        run.player.hp = stabilize;
        ally.hp = stabilize;
      } else {
        ally.hp = stabilize;
      }
      ally.condition = "KNOCKED_OUT";
    }

    return lines;
  },

  beginRecovery(
    run: RunState,
    input: {
      characterId: "player" | string;
      name: string;
      severity: KoSeverity;
      overkill?: number;
      combatKind?: CombatKind;
      doctor?: { member: CrewMember; character: WorldCharacter } | null;
    },
  ): { lines: string[]; days: number; hospitalized: boolean } {
    const lines: string[] = [];
    const characterId = input.characterId === run.player.id ? "player" : input.characterId;
    let days = this.baseRecoveryDays(input.severity);
    const doctor = input.doctor === undefined ? this.findCrewDoctor(run) : input.doctor;
    let treatedBy: string | null = null;
    let hospitalized = input.severity === "CRITICAL" || (input.severity === "SEVERE" && !doctor);

    if (doctor) {
      const reduce = this.doctorDayReduction(run, doctor.character);
      days = Math.max(1, days - reduce);
      treatedBy = doctor.member.characterId;
      hospitalized = input.severity === "CRITICAL" && days >= 5;
    }

    // Clear prior assignment if somehow still Ready with leftover schedule.
    const existing = CharacterScheduleService.getAssignment(run, characterId);
    if (existing) {
      CharacterScheduleService.interrupt(run, characterId, true);
    }

    const meta: CharacterRecoveryMeta = {
      severity: input.severity,
      daysRemaining: days,
      treatedByCharacterId: treatedBy,
      needsExternalCare: !doctor && !hospitalized,
      causeCombatKind: input.combatKind,
      overkill: input.overkill,
      hospitalizedLocationId: hospitalized ? run.currentLocationId : undefined,
      hospitalizedLocationName: hospitalized ? locationLabel(run) : undefined,
    };

    const type = hospitalized ? ("HOSPITALIZED" as const) : ("RECOVERING" as const);
    const label = hospitalized
      ? `Hospitalized · ${locationLabel(run)} (${days}d)`
      : treatedBy
        ? `Recovering · treated aboard (${days}d)`
        : `Recovering · needs care (${days}d)`;

    // Force start even if previously "unavailable" due to Injured flag — clear first.
    if (characterId !== "player") {
      const member = run.crew.find((entry) => entry.characterId === characterId);
      if (member) {
        member.status = "Ready";
        member.currentAssignment = null;
      }
    }
    CharacterScheduleService.ensure(run);
    run.characterAssignments = (run.characterAssignments ?? []).filter(
      (entry) => entry.characterId !== characterId,
    );

    const started = CharacterScheduleService.startAssignment(run, {
      characterId,
      type,
      label,
      durationSlots: daysToSlots(days),
      locationId: run.currentLocationId,
      islandId: run.currentIslandId ?? undefined,
      interruptible: false,
      metadata: meta as unknown as Record<string, unknown>,
    });

    if (!started.ok) {
      // Fallback: mark injured without schedule if start failed.
      if (characterId !== "player") {
        const member = run.crew.find((entry) => entry.characterId === characterId);
        if (member) {
          member.status = hospitalized ? "Hospitalized" : "Injured";
        }
      }
      lines.push(`${input.name} is badly hurt (${input.severity.toLowerCase()}).`);
      return { lines, days, hospitalized };
    }

    const formationId = characterId === "player" ? run.player.id : characterId;
    CrewCombatService.parkUnavailableMember(run, formationId);

    // Hospital / ship doctor clears toxins; untreated recovery may leave a lingering DoT.
    if (hospitalized || treatedBy) {
      AfflictionService.clearMedicalDots(run, characterId);
    } else if (input.severity === "MODERATE" || input.severity === "SEVERE") {
      AfflictionService.apply(run, characterId, "SICKNESS", { days: Math.max(2, days) });
      lines.push(`${input.name} looks feverish — infection may linger without care.`);
    } else if ((input.overkill ?? 0) >= 8) {
      AfflictionService.apply(run, characterId, "POISON", { days: 2 });
      lines.push(`${input.name}'s wounds look poisoned — find a doctor soon.`);
    }

    if (characterId !== "player") {
      CharacterService.addMemory(run, characterId, "WAS_KNOCKED_OUT", 3, `${input.severity} KO`);
      if (hospitalized) {
        CharacterService.addMemory(
          run,
          characterId,
          "WAS_HOSPITALIZED",
          4,
          placeLabel(run, meta.hospitalizedLocationName, run.currentIslandId),
        );
      }
      if (input.combatKind === "BOSS") {
        CharacterService.addMemory(run, characterId, "RECOVERED_AFTER_BOSS_FIGHT", 3);
      }
      if (treatedBy) {
        CharacterService.addMemory(
          run,
          characterId,
          "HELPED",
          2,
          `Treated by ${doctor?.character.name ?? "crew doctor"}`,
        );
      }
    }

    if (hospitalized) {
      lines.push(
        `${input.name} needs a bed — hospitalized at ${placeLabel(run, meta.hospitalizedLocationName, run.currentIslandId)} (~${days} days).`,
      );
    } else if (treatedBy) {
      lines.push(
        `${input.name} is recovering aboard under ${doctor!.character.name}'s care (${days} day${days === 1 ? "" : "s"}).`,
      );
    } else {
      lines.push(
        `${input.name} is recovering (${days} day${days === 1 ? "" : "s"}) — find a clinic if wounds worsen.`,
      );
    }

    return { lines, days, hospitalized };
  },

  /** After hostile wipe: true if the run should end (no usable fighters left). */
  shouldEndRunAfterWipe(run: RunState): boolean {
    return CharacterScheduleService.availableCount(run) <= 0;
  },

  /** Stabilize captain so advance doesn't double-kill when survivors remain. */
  stabilizeCaptainIfCrewRemains(run: RunState): void {
    if (this.shouldEndRunAfterWipe(run)) {
      return;
    }
    if (run.player.hp <= 0) {
      run.player.hp = Math.max(1, Math.round(run.player.maxHp * 0.2));
    }
  },

  recoverySummary(run: RunState, characterId: string): string | null {
    const id = characterId === run.player.id ? "player" : characterId;
    const assignment = CharacterScheduleService.getAssignment(run, id);
    if (!assignment || (assignment.type !== "RECOVERING" && assignment.type !== "HOSPITALIZED")) {
      return null;
    }
    const meta = assignment.metadata as CharacterRecoveryMeta | undefined;
    const daysLeft = Math.max(1, assignment.endDay - run.day + (assignment.endSlot > 0 ? 1 : 0));
    const days = meta?.daysRemaining ?? daysLeft;
    if (assignment.type === "HOSPITALIZED") {
      return `HOSPITALIZED · ${placeLabel(run, meta?.hospitalizedLocationName, assignment.islandId ?? assignment.locationId)} · ~${days}d`;
    }
    const doc = meta?.treatedByCharacterId
      ? ProgressionService.getDisplayName(run, meta.treatedByCharacterId)
      : null;
    return doc ? `RECOVERING · ${days}d · treated by ${doc}` : `RECOVERING · ${days}d`;
  },

  buildPostBattleDialogue(run: RunState, combat: CombatState): string[] {
    const knocked = this.knockedOutAllies(combat).filter((ally) => ally.id !== run.player.id);
    if (!knocked.length || combat.isFriendly) return [];
    const doctor = this.findCrewDoctor(run);
    const first = knocked[0]!;
    if (doctor) {
      return [
        `${doctor.character.name}: "${first.name} took a bad hit. I've got them — but they're not fighting again today."`,
      ];
    }
    return [`Someone on the crew: "${first.name} is down. We need a clinic before this gets worse."`];
  },

  /** Merge profile-persistent survivors into a new run's world. */
  injectPersistentCharacters(profile: ProfileSave, run: RunState): void {
    for (const record of profile.persistentCharacters ?? []) {
      if (record.survivalStatus === "DEAD") continue;
      const existing = run.world.characters.find((entry) => entry.id === record.character.id);
      const snapshot = structuredClone(record.character);
      // New protagonist is a different person — do not inherit prior personal rapport.
      snapshot.relationshipWithPlayer = 0;
      snapshot.joinInterest = Math.min(snapshot.joinInterest ?? 0, 20);
      if (existing) {
        existing.memories = [...(existing.memories ?? []), ...(snapshot.memories ?? [])];
        existing.tags = [...new Set([...(existing.tags ?? []), ...(snapshot.tags ?? [])])];
        existing.alive = snapshot.alive;
        existing.combatStyle = existing.combatStyle ?? snapshot.combatStyle;
        existing.weaponIds = [
          ...new Set([...(existing.weaponIds ?? []), ...(snapshot.weaponIds ?? [])]),
        ];
        existing.unlockedTechniques = [
          ...new Set([
            ...(existing.unlockedTechniques ?? []),
            ...(snapshot.unlockedTechniques ?? []),
          ]),
        ];
        existing.personality = existing.personality ?? snapshot.personality;
        existing.crewRole = existing.crewRole ?? snapshot.crewRole;
        existing.relationshipWithPlayer = 0;
        existing.joinInterest = Math.min(existing.joinInterest ?? 0, 20);
        continue;
      }
      run.world.characters.push(snapshot);
    }
  },
};
