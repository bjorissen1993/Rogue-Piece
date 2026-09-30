import type { CombatRequest, IslandFacilityHotspot, RelationFactionId, RunState } from "../models/types";
import { ProgressionService } from "./ProgressionService";
import { IslandPressureService } from "./IslandPressureService";
import { IslandService } from "./IslandService";
import { QuestDirectorService } from "./QuestDirectorService";
import { FactionDiplomacyService } from "./FactionDiplomacyService";
import { TrainingGroundsService } from "./TrainingGroundsService";
import { GeneratedLocationService } from "./GeneratedLocationService";
import type { RandomService } from "./RandomService";

const OCCUPY_CANDIDATES = ["MARKET", "TRAINING_GROUNDS", "CLINIC", "INN", "HARBOR"];

function occupyingFaction(run: RunState): RelationFactionId {
  return FactionDiplomacyService.get(run, "MARINES", "PIRATES") > 0 ? "PIRATES" : "MARINES";
}

export const IslandOccupationService = {
  occupyingFaction,

  tick(run: RunState, slots: number, rng: RandomService): string[] {
    const island = IslandPressureService.ensureCurrent(run);
    if (!island || slots <= 0) {
      return [];
    }
    const lines: string[] = [];
    const faction = occupyingFaction(run);
    IslandPressureService.adjustLocalPressure(island, faction, Math.max(1, Math.round(slots * 1.4)));
    const local = IslandPressureService.localPressure(island, faction);
    const band = IslandPressureService.pressureBand(Math.max(island.pressureLevel ?? 0, local));

    if ((band === "HIGH" || band === "SEVERE" || band === "CRITICAL") && rng.chance(band === "HIGH" ? 0.18 : 0.32)) {
      const taken = new Set((island.occupations ?? []).filter((row) => row.state !== "AVAILABLE").map((row) => row.hotspotId));
      const target = GeneratedLocationService.pickEventTarget(island, {
        prefer: "economic",
        includeFacilities: OCCUPY_CANDIDATES,
        occupied: taken,
      });
      if (target) {
        IslandPressureService.occupyFacility(run, target.hotspotId, faction);
        QuestDirectorService.onWorldEvent(run, "protect_location");
        lines.push(`${target.label} is occupied by ${faction.toLowerCase()}.`);
      }
    }

    if ((band === "HIGH" || band === "SEVERE" || band === "CRITICAL") && rng.chance(0.2)) {
      const fragile = GeneratedLocationService.pickDestroyTarget(island);
      if (fragile) {
        GeneratedLocationService.destroy(run, island, fragile);
        lines.push(`${fragile.name} is wrecked in the fighting.`);
      }
    }

    if (band === "CRITICAL") {
      island.harborBlockade = island.harborBlockade ?? {
        factionId: faction,
        ships: 2 + (local >= 95 ? 1 : 0),
        sinceDay: run.day,
      };
      QuestDirectorService.onWorldEvent(run, "faction_conflict");
      lines.push(`${island.name}'s harbor is under blockade.`);
    }

    if (!run.pendingIslandEvent && (band === "MEDIUM" || band === "HIGH" || band === "SEVERE" || band === "CRITICAL")) {
      const chance = band === "MEDIUM" ? 0.12 : band === "HIGH" ? 0.22 : band === "SEVERE" ? 0.34 : 0.5;
      if (rng.chance(chance)) {
        const training = TrainingGroundsService.ensure(run)[0];
        const patrolAt =
          GeneratedLocationService.pickEventTarget(island, {
            prefer: "strategic",
            includeFacilities: training ? ["TRAINING_GROUNDS", "MARKET", "HARBOR"] : ["MARKET", "HARBOR"],
          })?.hotspotId ?? (training ? "TRAINING_GROUNDS" : "MARKET");
        run.pendingIslandEvent = {
          kind: "PATROL",
          factionId: faction,
          hotspotId: patrolAt,
          label: `${faction === "MARINES" ? "Marine" : "Pirate"} patrol cuts across your path.`,
          day: run.day,
        };
        if (training) {
          lines.push(`${ProgressionService.getDisplayName(run, training.characterId)}'s training is interrupted.`);
          TrainingGroundsService.stop(run, training.characterId);
        }
      }
    }
    return lines;
  },

  occupationForHotspot(run: RunState, hotspot: IslandFacilityHotspot) {
    const island = IslandService.getCurrentIsland(run);
    if (!island) {
      return undefined;
    }
    return (
      IslandPressureService.occupationFor(island, hotspot.hotspotId) ??
      IslandPressureService.occupationFor(island, hotspot.facilityId)
    );
  },

  hasBlockade(run: RunState): boolean {
    return Boolean(IslandService.getCurrentIsland(run)?.harborBlockade);
  },

  combatRequest(factionId: RelationFactionId, strength: number): CombatRequest {
    const marine = factionId === "MARINES";
    const enemyName = marine ? "Marine occupation squad" : "Pirate occupation crew";
    return {
      enemyName,
      enemyStrength: strength,
      combatKind: "NORMAL",
      canEscape: true,
      enemyFamily: marine ? "MARINE" : "PIRATE",
      win: { text: `You drive back the ${enemyName.toLowerCase()}.` },
      lose: { text: "They beat you back.", hpChange: -12 },
      escape: { text: "You break contact." },
    };
  },

  actPatrol(
    run: RunState,
    action: "fight" | "escape" | "hide" | "talk",
    rng: RandomService,
  ): { message: string; startFight?: boolean } {
    const event = run.pendingIslandEvent;
    if (!event || event.kind !== "PATROL") {
      return { message: "The street is clear." };
    }
    const island = IslandPressureService.ensureCurrent(run);
    const band = IslandPressureService.pressureBand(island?.pressureLevel ?? 0);
    const tight = band === "SEVERE" || band === "CRITICAL";
    if (action === "talk") {
      run.pendingIslandEvent = null;
      return { message: "You talk them into looking the other way." };
    }
    if (action === "hide") {
      const ok = rng.chance(tight ? 0.28 : 0.6);
      run.pendingIslandEvent = null;
      return { message: ok ? "You stay out of sight." : "They find you.", startFight: !ok };
    }
    if (action === "escape") {
      const ok = rng.chance(tight ? 0.22 : 0.7);
      run.pendingIslandEvent = null;
      return { message: ok ? "You break away." : "They cut you off.", startFight: !ok };
    }
    run.pendingIslandEvent = null;
    return { message: event.label, startFight: true };
  },

  act(
    run: RunState,
    hotspotId: string,
    action: "fight" | "scout" | "sneak" | "negotiate" | "leave",
    rng: RandomService,
  ): { message: string; startFight?: boolean; liberated?: boolean; infiltrate?: boolean } {
    const island = IslandPressureService.ensureCurrent(run);
    if (!island) {
      return { message: "No island underfoot." };
    }
    const occ =
      IslandPressureService.occupationFor(island, hotspotId) ??
      island.occupations?.find((row) => row.hotspotId === hotspotId);
    if (!occ || occ.state === "AVAILABLE") {
      return { message: "The place is open." };
    }
    const faction = occ.factionId ?? occupyingFaction(run);
    if (action === "leave") {
      return { message: "You back away." };
    }
    if (action === "scout") {
      return { message: `${occ.state.replaceAll("_", " ")} by ${faction}. Pressure stays.` };
    }
    if (action === "sneak") {
      const ok = rng.chance((island.pressureLevel ?? 50) < 70 ? 0.55 : 0.28);
      if (!ok) {
        IslandPressureService.adjustLocalPressure(island, faction, 8);
        this.markOccupationFight(run, occ.hotspotId, faction);
      }
      return { message: ok ? "You slip past the watch." : "The watch spots you.", startFight: !ok, infiltrate: ok };
    }
    if (action === "negotiate") {
      const ok = rng.chance((island.trustLevel ?? 0) > 40 ? 0.4 : 0.15);
      if (ok) {
        IslandPressureService.liberateFacility(run, occ.hotspotId);
        return { message: "They stand down — for now.", liberated: true };
      }
      IslandPressureService.adjustLocalPressure(island, faction, 4);
      return { message: "Talk fails. They want you gone or in irons." };
    }
    IslandPressureService.adjustLocalPressure(island, faction, 10);
    FactionDiplomacyService.modify(run, "CIVILIANS", faction, faction === "MARINES" ? 4 : -2);
    this.markOccupationFight(run, occ.hotspotId, faction);
    return { message: `You move on the ${faction.toLowerCase()} occupation.`, startFight: true };
  },

  markOccupationFight(run: RunState, hotspotId: string, factionId: RelationFactionId): void {
    run.pendingIslandEvent = {
      kind: "OCCUPATION",
      factionId,
      hotspotId,
      label: `${hotspotId.replaceAll("_", " ")} occupation`,
      day: run.day,
    };
  },

  afterOccupationVictory(run: RunState): string | null {
    const event = run.pendingIslandEvent;
    if (event?.kind !== "OCCUPATION" || !event.hotspotId) {
      return null;
    }
    IslandPressureService.liberateFacility(run, event.hotspotId);
    run.pendingIslandEvent = null;
    return `${event.hotspotId.replaceAll("_", " ")} is free again.`;
  },
};
