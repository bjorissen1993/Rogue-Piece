import type {
  CareerFactionId,
  FactionMission,
  FactionOrder,
  RunState,
} from "../models/types";
import { createId } from "../utils/ids";
import { AffiliationService } from "./AffiliationService";
import { FactionService } from "./FactionService";
import { ProgressionService } from "./ProgressionService";
import { careerToRelationFaction } from "../data/ranks";

function ensureLists(run: RunState): void {
  run.factionMissions = run.factionMissions ?? [];
  run.factionOrders = run.factionOrders ?? [];
}

export const FactionMissionService = {
  ensure(run: RunState): void {
    ensureLists(run);
  },

  listMissions(run: RunState): FactionMission[] {
    ensureLists(run);
    return run.factionMissions ?? [];
  },

  listOrders(run: RunState): FactionOrder[] {
    ensureLists(run);
    return run.factionOrders ?? [];
  },

  generateMission(
    run: RunState,
    options: {
      title: string;
      description: string;
      factionId?: CareerFactionId;
      moralConflict?: boolean;
    },
  ): FactionMission {
    ensureLists(run);
    const aff = AffiliationService.get(run);
    const factionId =
      options.factionId ??
      (aff.primaryFactionId && AffiliationService.isActiveMember(aff)
        ? aff.primaryFactionId
        : "MARINES");
    const mission: FactionMission = {
      id: createId("fmission"),
      factionId,
      title: options.title,
      description: options.description,
      status: "AVAILABLE",
      offeredDay: run.day,
      moralConflict: options.moralConflict,
      rewards: {
        reputationWithin: options.moralConflict ? 8 : 12,
        factionStanding: options.moralConflict ? 2 : 5,
        berries: 200,
        xp: 20,
      },
    };
    run.factionMissions!.push(mission);
    return mission;
  },

  issueOrder(
    run: RunState,
    options: {
      title: string;
      description: string;
      factionId?: CareerFactionId;
      moralConflict?: boolean;
    },
  ): FactionOrder {
    ensureLists(run);
    const aff = AffiliationService.get(run);
    const factionId =
      options.factionId ??
      (aff.primaryFactionId && AffiliationService.isActiveMember(aff)
        ? aff.primaryFactionId
        : "MARINES");
    const order: FactionOrder = {
      id: createId("forder"),
      factionId,
      title: options.title,
      description: options.description,
      status: "ISSUED",
      moralConflict: options.moralConflict,
      issuedDay: run.day,
    };
    run.factionOrders!.push(order);
    return order;
  },

  completeOrder(run: RunState, orderId?: string, success = true): string {
    ensureLists(run);
    const order =
      (orderId
        ? run.factionOrders!.find((entry) => entry.id === orderId)
        : undefined) ??
      [...run.factionOrders!]
        .reverse()
        .find((entry) => entry.status === "ISSUED" || entry.status === "ACCEPTED");
    if (!order) {
      return "No active faction order.";
    }
    order.status = success ? "COMPLETED" : "REFUSED";
    if (success) {
      AffiliationService.adjustInternalReputation(run, order.moralConflict ? 6 : 10);
      AffiliationService.adjustLoyalty(run, order.moralConflict ? -5 : 4);
      const relation = careerToRelationFaction(order.factionId);
      if (relation) {
        FactionService.modifyRelationship(
          run,
          relation,
          order.moralConflict ? 1 : 4,
          `Completed order: ${order.title}`,
        );
      }
      ProgressionService.grantExperience(run, "player", 15, "faction order");
      return `Order completed: ${order.title}.`;
    }
    AffiliationService.adjustLoyalty(run, -12);
    AffiliationService.adjustInternalReputation(run, -5);
    const relation = careerToRelationFaction(order.factionId);
    if (relation) {
      FactionService.modifyRelationship(run, relation, -6, `Refused order: ${order.title}`);
    }
    return `Order refused: ${order.title}. Command will remember.`;
  },

  /** Ensure the task board has a few open notices to accept. */
  ensureBoardStock(run: RunState): void {
    ensureLists(run);
    const templates = [
      {
        title: "Escort the carts",
        description: "Guard a merchant caravan to the next ridge and back.",
      },
      {
        title: "Dockside watch",
        description: "Walk the pier at dusk and discourage cutpurses.",
      },
      {
        title: "Quiet delivery",
        description: "Carry a sealed crate inland. Do not open it.",
        moralConflict: true,
      },
    ];
    for (const template of templates) {
      const openCount = (run.factionMissions ?? []).filter(
        (mission) => mission.status === "AVAILABLE" || mission.status === "ACTIVE",
      ).length;
      if (openCount >= 3) {
        break;
      }
      const already = (run.factionMissions ?? []).some(
        (mission) =>
          mission.title === template.title &&
          (mission.status === "AVAILABLE" || mission.status === "ACTIVE"),
      );
      if (already) {
        continue;
      }
      this.generateMission(run, template);
    }
  },

  activateMission(run: RunState, missionId: string): string {
    ensureLists(run);
    const mission = run.factionMissions!.find((entry) => entry.id === missionId);
    if (!mission) {
      return "Mission not found.";
    }
    mission.status = "ACTIVE";
    return `Mission accepted: ${mission.title}.`;
  },

  resolveMission(run: RunState, missionId: string, success = true): string {
    ensureLists(run);
    const mission = run.factionMissions!.find((entry) => entry.id === missionId);
    if (!mission) {
      return "Mission not found.";
    }
    mission.status = success ? "COMPLETED" : "FAILED";
    if (success && mission.rewards) {
      if (mission.rewards.reputationWithin) {
        AffiliationService.adjustInternalReputation(run, mission.rewards.reputationWithin);
      }
      const relation = careerToRelationFaction(mission.factionId);
      if (relation && mission.rewards.factionStanding) {
        FactionService.modifyRelationship(
          run,
          relation,
          mission.rewards.factionStanding,
          `Mission: ${mission.title}`,
        );
      }
      if (mission.rewards.berries) {
        run.player.berries += mission.rewards.berries;
      }
      if (mission.rewards.xp) {
        ProgressionService.grantExperience(run, "player", mission.rewards.xp, "faction mission");
      }
      AffiliationService.adjustLoyalty(run, 3);
      return `Mission completed: ${mission.title}.`;
    }
    AffiliationService.adjustLoyalty(run, -6);
    return `Mission failed: ${mission.title}.`;
  },
};
