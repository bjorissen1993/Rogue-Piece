import { clamp } from "../utils/stats";
import type { RunState } from "../models/types";
import { AfflictionService } from "./AfflictionService";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { CrewService } from "./CrewService";
import { IslandPressureService } from "./IslandPressureService";
import { IslandService } from "./IslandService";
import { MpService } from "./MpService";
import { ProgressionService } from "./ProgressionService";

export const CLINIC_TREAT_COST = 80;
export const CLINIC_TREAT_HP = 28;
export const CLINIC_BED_COST = 150;
export const CLINIC_BED_SLOTS = 6;

export type ClinicCareResult = {
  ok: boolean;
  message: string;
};

function normalizeId(run: RunState, characterId: string): "player" | string {
  return characterId === run.player.id ? "player" : characterId;
}

function treatAmount(run: RunState): number {
  let amount = CLINIC_TREAT_HP;
  if (run.crew.some((member) => member.role === "DOCTOR")) {
    amount = Math.round(amount * 1.15);
  } else if (run.crew.some((member) => member.role === "COOK")) {
    amount = Math.round(amount * 1.08);
  }
  return amount;
}

export const ClinicCareService = {
  roster(run: RunState): string[] {
    const ids = ["player", ...run.crew.map((member) => member.characterId)];
    return ids.filter((id, index) => ids.indexOf(id) === index);
  },

  vitals(run: RunState, characterId: string): { hp: number; maxHp: number; name: string } {
    const id = normalizeId(run, characterId);
    if (id === "player") {
      return { hp: run.player.hp, maxHp: run.player.maxHp, name: run.player.name };
    }
    const vitals = CrewService.ensureMemberVitals(run, id);
    return {
      hp: vitals?.hp ?? 0,
      maxHp: vitals?.maxHp ?? 1,
      name: vitals?.name ?? ProgressionService.getDisplayName(run, id),
    };
  },

  patients(run: RunState): string[] {
    CharacterScheduleService.ensure(run);
    return (run.characterAssignments ?? [])
      .filter((entry) => entry.type === "HOSPITALIZED")
      .map((entry) => entry.characterId);
  },

  isHospitalized(run: RunState, characterId: string): boolean {
    const id = normalizeId(run, characterId);
    return CharacterScheduleService.getAssignment(run, id)?.type === "HOSPITALIZED";
  },

  treat(run: RunState, characterId: string): ClinicCareResult {
    const id = normalizeId(run, characterId);
    const name = ProgressionService.getDisplayName(run, id);
    if (run.player.berries < CLINIC_TREAT_COST) {
      run.lastFeedback = `Need ฿${CLINIC_TREAT_COST} for treatment.`;
      return { ok: false, message: run.lastFeedback };
    }
    run.player.berries -= CLINIC_TREAT_COST;
    const amount = treatAmount(run);
    if (id === "player") {
      run.lastHpChange = amount;
      run.player.hp = clamp(run.player.hp + amount, 0, run.player.maxHp);
      const mp = MpService.companionRestoreFromHpHeal(amount);
      if (mp > 0) {
        MpService.ensurePlayer(run.player);
        const maxMp = run.player.maxMp ?? MpService.maxMpFor(run.player);
        run.player.mp = clamp((run.player.mp ?? 0) + mp, 0, maxMp);
      }
    } else {
      CrewService.applyMemberHeal(run, id, amount, 0);
    }
    AfflictionService.clearMedicalDots(run, id);
    const island = IslandService.getCurrentIsland(run);
    if (island) {
      IslandPressureService.adjustTrust(island, 2);
    }
    run.lastFeedback = `The nurse cleans and wraps ${name}. Toxins and fever ease.`;
    return { ok: true, message: run.lastFeedback };
  },

  hospitalize(run: RunState, characterId: string): ClinicCareResult {
    const id = normalizeId(run, characterId);
    const name = ProgressionService.getDisplayName(run, id);
    if (this.isHospitalized(run, id)) {
      return { ok: false, message: `${name} is already in a clinic bed.` };
    }
    if (run.player.berries < CLINIC_BED_COST) {
      run.lastFeedback = `Need ฿${CLINIC_BED_COST} for a recovery bed.`;
      return { ok: false, message: run.lastFeedback };
    }
    const started = CharacterScheduleService.startAssignment(run, {
      characterId: id,
      type: "HOSPITALIZED",
      label: "Clinic recovery",
      durationSlots: CLINIC_BED_SLOTS,
      focus: "recovery",
      islandId: IslandService.getCurrentIsland(run)?.id,
    });
    if (!started.ok) {
      return { ok: false, message: started.message };
    }
    run.player.berries -= CLINIC_BED_COST;
    AfflictionService.clearMedicalDots(run, id);
    const island = IslandService.getCurrentIsland(run);
    if (island) {
      IslandPressureService.adjustTrust(island, 3);
      IslandPressureService.adjustPressure(island, -2);
    }
    run.lastFeedback = `${name} is settled into a clinic bed under a stern nurse.`;
    return { ok: true, message: run.lastFeedback };
  },

  fundWing(run: RunState): ClinicCareResult {
    const island = IslandService.getCurrentIsland(run);
    if (!island) {
      return { ok: false, message: "No island underfoot." };
    }
    if ((island.fundedProjects ?? []).includes("clinic_wing")) {
      return { ok: false, message: "Clinic wing is already funded here." };
    }
    if (run.player.berries < 180) {
      return { ok: false, message: "Need ฿180 to fund the clinic wing." };
    }
    const message = IslandPressureService.fundProject(run, "clinic_wing");
    run.lastFeedback = message;
    return { ok: true, message };
  },
};
