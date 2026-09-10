import type {
  AuthorityState,
  PlayerAuthority,
  PolicyIncident,
  RunState,
  StandingOrder,
} from "../models/types";
import { createId } from "../utils/ids";
import { clamp } from "../utils/stats";
import { CharacterService } from "./CharacterService";
import { WorldService } from "./WorldService";

function stateForScore(score: number): AuthorityState {
  if (score >= 85) return "LEGENDARY";
  if (score >= 65) return "FEARED";
  if (score >= 45) return "TRUSTED";
  if (score >= 25) return "RESPECTED";
  return "QUESTIONED";
}

export function defaultAuthority(): PlayerAuthority {
  return { score: 35, state: "RESPECTED" };
}

export function defaultStandingOrders(): StandingOrder[] {
  return [
    {
      id: "no_pillage",
      label: "No Pillaging",
      description: "Avoid looting civilian settlements.",
      kind: "GUIDELINE",
      active: true,
      effects: { reputationModifier: 5, grievanceChance: 0.08 },
    },
    {
      id: "protect_crew",
      label: "Protect the Crew",
      description: "Never abandon a crewmate in danger.",
      kind: "HARD",
      active: true,
      effects: { grievanceChance: 0.15 },
    },
    {
      id: "share_loot",
      label: "Share Loot Fairly",
      description: "Divide spoils among active fighters.",
      kind: "GUIDELINE",
      active: false,
      effects: { reputationModifier: 3, grievanceChance: 0.05 },
    },
  ];
}

export const AuthorityService = {
  ensure(run: RunState): PlayerAuthority {
    if (!run.authority) {
      run.authority = defaultAuthority();
    }
    run.authority.state = stateForScore(run.authority.score);
    if (!run.standingOrders?.length) {
      run.standingOrders = defaultStandingOrders();
    }
    if (!run.policyIncidents) {
      run.policyIncidents = [];
    }
    return run.authority;
  },

  get(run: RunState): PlayerAuthority {
    return this.ensure(run);
  },

  adjust(run: RunState, amount: number, reason?: string): void {
    const auth = this.ensure(run);
    auth.score = clamp(auth.score + amount, 0, 100);
    auth.state = stateForScore(auth.score);
    if (reason && Math.abs(amount) >= 5) {
      WorldService.addNews(run, `${reason} (${amount >= 0 ? "+" : ""}${amount} authority).`);
    }
  },

  setScore(run: RunState, score: number): void {
    const auth = this.ensure(run);
    auth.score = clamp(score, 0, 100);
    auth.state = stateForScore(auth.score);
  },

  toggleOrder(run: RunState, orderId: string): boolean {
    this.ensure(run);
    const order = run.standingOrders!.find((entry) => entry.id === orderId);
    if (!order) {
      return false;
    }
    order.active = !order.active;
    return order.active;
  },

  activeOrders(run: RunState): StandingOrder[] {
    this.ensure(run);
    return run.standingOrders!.filter((entry) => entry.active);
  },

  /** Light simulation hook — may spawn a grievance / incident stub. */
  checkPolicyViolations(run: RunState, rng: () => number): PolicyIncident | null {
    this.ensure(run);
    const active = this.activeOrders(run);
    if (!active.length || !run.crew.length) {
      return null;
    }
    const order = active[Math.floor(rng() * active.length)]!;
    const chance = order.effects?.grievanceChance ?? 0.05;
    if (rng() > chance) {
      return null;
    }
    const member = run.crew[Math.floor(rng() * run.crew.length)]!;
    const character = CharacterService.getCharacter(run, member.characterId);
    const incident: PolicyIncident = {
      id: createId("policy"),
      day: run.day,
      orderId: order.id,
      characterId: member.characterId,
      description: `${character?.name ?? "A crewmate"} objects to "${order.label}" — a confrontation brews.`,
      resolved: false,
    };
    run.policyIncidents!.push(incident);
    member.grievances = [...(member.grievances ?? []), order.id];
    this.adjust(run, order.kind === "HARD" ? -8 : -3);
    return incident;
  },

  forceViolation(run: RunState, orderId?: string): PolicyIncident {
    this.ensure(run);
    const order =
      run.standingOrders!.find((entry) => entry.id === orderId) ?? run.standingOrders![0]!;
    const member = run.crew[0];
    const incident: PolicyIncident = {
      id: createId("policy"),
      day: run.day,
      orderId: order.id,
      characterId: member?.characterId,
      description: `Policy violation: "${order.label}" — crew morale shaken.`,
      resolved: false,
    };
    run.policyIncidents!.push(incident);
    this.adjust(run, -10);
    return incident;
  },

  stateLabel(state: AuthorityState): string {
    return state.charAt(0) + state.slice(1).toLowerCase();
  },
};
