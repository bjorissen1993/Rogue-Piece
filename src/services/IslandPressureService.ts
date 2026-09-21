import type { Island, IslandFacilityId, RunState } from "../models/types";
import { IslandService } from "./IslandService";

export type IslandProjectId = "clinic_wing" | "harbor_lights" | "militia_watch";

const PROJECT_LABELS: Record<IslandProjectId, string> = {
  clinic_wing: "Clinic wing",
  harbor_lights: "Harbor lights",
  militia_watch: "Militia watch",
};

const PROJECT_COST: Record<IslandProjectId, number> = {
  clinic_wing: 180,
  harbor_lights: 220,
  militia_watch: 260,
};

function clamp01to100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export const IslandPressureService = {
  ensure(island: Island): void {
    island.pressureLevel = island.pressureLevel ?? 0;
    island.developmentLevel = island.developmentLevel ?? 0;
    island.protectionLevel = island.protectionLevel ?? 0;
    island.trustLevel = island.trustLevel ?? 0;
    island.daysAshore = island.daysAshore ?? 0;
    island.visitCount = island.visitCount ?? 0;
    island.lastVisitedDay = island.lastVisitedDay ?? null;
    island.fundedProjects = island.fundedProjects ?? [];
    island.protectionOffered = island.protectionOffered ?? false;
  },

  ensureCurrent(run: RunState): Island | undefined {
    const island = IslandService.getCurrentIsland(run);
    if (island) {
      this.ensure(island);
    }
    return island;
  },

  /** Call when the player makes landfall on an island. */
  onLandfall(run: RunState): string[] {
    const island = this.ensureCurrent(run);
    if (!island) {
      return [];
    }
    island.visitCount = (island.visitCount ?? 0) + 1;
    island.lastVisitedDay = run.day;
    island.daysAshore = 0;
    // Returning to a known island: slight trust bump, pressure softens.
    if ((island.visitCount ?? 0) > 1) {
      this.adjustTrust(island, 2);
      this.adjustPressure(island, -4);
    }
    return [];
  },

  /** Tick while ashore: time + notoriety slowly raise attention. */
  tickAshore(run: RunState, slots: number): string[] {
    if ((run.activityMode ?? "ISLAND") !== "ISLAND" || slots <= 0) {
      return [];
    }
    const island = this.ensureCurrent(run);
    if (!island) {
      return [];
    }
    const lines: string[] = [];
    island.daysAshore = (island.daysAshore ?? 0) + slots / 5;
    const bountyFactor = Math.min(12, Math.floor(run.player.bounty / 25_000));
    const timeFactor = Math.min(8, Math.floor((island.daysAshore ?? 0) * 2));
    const trustEase = Math.floor((island.trustLevel ?? 0) / 25);
    const protectionEase = Math.floor((island.protectionLevel ?? 0) / 20);
    const delta = Math.max(0, 1 + bountyFactor + timeFactor - trustEase - protectionEase);
    const before = island.pressureLevel ?? 0;
    this.adjustPressure(island, delta * Math.max(1, Math.round(slots * 0.5)));
    const after = island.pressureLevel ?? 0;
    if (before < 40 && after >= 40) {
      lines.push(`Word of your stay spreads across ${island.name}.`);
    } else if (before < 70 && after >= 70) {
      lines.push(`${island.name} is on edge — patrols thicken and doors latch early.`);
    } else if (before < 90 && after >= 90) {
      lines.push(`Open hostility gathers at ${island.name}. Staying longer invites a reckoning.`);
    }
    this.maybeOfferProtection(run, island, lines);
    return lines;
  },

  /** Loud actions (combat, crime, explore trouble) spike pressure. */
  onHostileAction(run: RunState, amount = 8): void {
    const island = this.ensureCurrent(run);
    if (!island) {
      return;
    }
    this.adjustPressure(island, amount);
    this.adjustTrust(island, -Math.ceil(amount / 4));
  },

  onHelpfulAction(run: RunState, amount = 4): void {
    const island = this.ensureCurrent(run);
    if (!island) {
      return;
    }
    this.adjustTrust(island, amount);
    this.adjustPressure(island, -Math.ceil(amount / 2));
  },

  adjustPressure(island: Island, delta: number): void {
    this.ensure(island);
    island.pressureLevel = clamp01to100((island.pressureLevel ?? 0) + delta);
  },

  adjustTrust(island: Island, delta: number): void {
    this.ensure(island);
    island.trustLevel = clamp01to100((island.trustLevel ?? 0) + delta);
  },

  adjustDevelopment(island: Island, delta: number): void {
    this.ensure(island);
    island.developmentLevel = clamp01to100((island.developmentLevel ?? 0) + delta);
  },

  adjustProtection(island: Island, delta: number): void {
    this.ensure(island);
    island.protectionLevel = clamp01to100((island.protectionLevel ?? 0) + delta);
  },

  /** Combat / danger encounter weight bias from local pressure (not day-gated bosses). */
  encounterWeightMultiplier(run: RunState, isCombatHeavy: boolean): number {
    const island = IslandService.getCurrentIsland(run);
    if (!island || (run.activityMode ?? "ISLAND") !== "ISLAND") {
      return 1;
    }
    this.ensure(island);
    const p = island.pressureLevel ?? 0;
    if (!isCombatHeavy) {
      if (p >= 70) return 0.85;
      return 1;
    }
    if (p < 25) return 0.85;
    if (p < 50) return 1.05;
    if (p < 75) return 1.25;
    return 1.55;
  },

  fundProject(run: RunState, projectId: IslandProjectId): string {
    const island = this.ensureCurrent(run);
    if (!island) {
      return "No island underfoot.";
    }
    const funded = island.fundedProjects ?? [];
    if (funded.includes(projectId)) {
      return `${PROJECT_LABELS[projectId]} is already funded here.`;
    }
    const cost = PROJECT_COST[projectId];
    if (run.player.berries < cost) {
      return `Need ฿${cost} to fund ${PROJECT_LABELS[projectId]}.`;
    }
    run.player.berries -= cost;
    island.fundedProjects = [...funded, projectId];
    this.adjustTrust(island, 8);
    this.adjustDevelopment(island, projectId === "militia_watch" ? 4 : 10);
    if (projectId === "militia_watch") {
      this.adjustProtection(island, 12);
    }
    if (projectId === "clinic_wing") {
      this.adjustPressure(island, -6);
    }
    if (projectId === "harbor_lights") {
      this.adjustPressure(island, -4);
    }
    return `You fund the ${PROJECT_LABELS[projectId]} on ${island.name}.`;
  },

  acceptProtection(run: RunState): string {
    const island = this.ensureCurrent(run);
    if (!island) {
      return "No island underfoot.";
    }
    if ((island.trustLevel ?? 0) < 55) {
      return "The locals do not trust you enough yet.";
    }
    island.protectionOffered = true;
    this.adjustProtection(island, 18);
    this.adjustPressure(island, -10);
    this.adjustTrust(island, 5);
    return `A crew of rough locals offers to watch ${island.name} in your name. Protection holds — for now.`;
  },

  maybeOfferProtection(run: RunState, island: Island, lines: string[]): void {
    if (island.protectionOffered) {
      return;
    }
    if ((island.trustLevel ?? 0) >= 60 && (island.pressureLevel ?? 0) >= 45) {
      run.runFlags = Array.from(new Set([...(run.runFlags ?? []), "island_protection_offer"]));
      lines.push(`Trusted locals hint they could keep ${island.name} safer — if you accept their protection.`);
    }
  },

  summary(island: Island | undefined): string {
    if (!island) {
      return "Unknown shores.";
    }
    this.ensure(island);
    return `Pressure ${island.pressureLevel} · Trust ${island.trustLevel} · Dev ${island.developmentLevel} · Guard ${island.protectionLevel}`;
  },

  facilityNames(island: Island | undefined): string[] {
    return IslandService.listUnlockedFacilities(island).map((facility) => facility.name);
  },

  hasFacility(island: Island | undefined, id: IslandFacilityId): boolean {
    return IslandService.hasFacility(island, id);
  },
};
