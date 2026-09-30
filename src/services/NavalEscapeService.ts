import type { CombatRequest, RunState } from "../models/types";
import { IslandService } from "./IslandService";
import type { RandomService } from "./RandomService";

export const NavalEscapeService = {
  begin(run: RunState, toIslandId: string): string {
    const island = IslandService.getCurrentIsland(run);
    const blockade = island?.harborBlockade;
    if (!blockade) {
      return "The harbor is open.";
    }
    run.pendingNavalEscape = {
      toIslandId,
      factionId: blockade.factionId,
      ships: blockade.ships,
      distance: 0,
    };
    return `${blockade.factionId} ships bar the channel. Escape or fight through.`;
  },

  act(
    run: RunState,
    action: "sail" | "evade" | "cannon" | "bribe" | "sneak",
    rng: RandomService,
  ): { message: string; escaped?: boolean; toIslandId?: string; fight?: CombatRequest; failed?: boolean } {
    const chase = run.pendingNavalEscape;
    if (!chase) {
      return { message: "No pursuit." };
    }
    if (action === "bribe") {
      if (run.player.berries < 400) {
        return { message: "Not enough berries to buy a gap." };
      }
      run.player.berries -= 400;
      const ok = rng.chance(0.45);
      if (ok) {
        return this.finishEscape(run, "A purse opens a lane.");
      }
      return { message: "They take the berries and hold the line." };
    }
    if (action === "sneak") {
      const ok = rng.chance(run.timeOfDay === "NIGHT" ? 0.55 : 0.22);
      return ok ? this.finishEscape(run, "You slip the net in the dark.") : { message: "Lanterns catch the hull." };
    }
    if (action === "evade") {
      chase.distance += 2;
      if (chase.distance >= 5) {
        return this.finishEscape(run, "Open water. The pursuit falls astern.");
      }
      return { message: `You gain sea room (${chase.distance}/5).` };
    }
    if (action === "cannon") {
      chase.ships = Math.max(0, chase.ships - 1);
      if (chase.ships <= 0) {
        return this.finishEscape(run, "The last pursuer shears off.");
      }
      return { message: `${chase.ships} ship${chase.ships === 1 ? "" : "s"} still chase.` };
    }
    chase.distance += 1;
    if (chase.distance >= 5) {
      return this.finishEscape(run, "Full sail clears the blockade.");
    }
    if (rng.chance(0.35)) {
      return {
        message: "They close to board.",
        fight: {
          enemyName: `${chase.factionId === "MARINES" ? "Marine" : "Pirate"} boarding party`,
          enemyStrength: 8 + chase.ships,
          combatKind: "HIGH_RISK",
          canEscape: true,
          win: { text: "You throw them back and break for the open sea." },
          lose: { text: "The boarding party overruns the deck.", hpChange: -20 },
        },
      };
    }
    return { message: `The chase continues (${chase.distance}/5).` };
  },

  finishEscape(run: RunState, message: string): { message: string; escaped: boolean; toIslandId?: string } {
    const dest = run.pendingNavalEscape?.toIslandId;
    const island = IslandService.getCurrentIsland(run);
    if (island) {
      island.harborBlockade = null;
    }
    run.pendingNavalEscape = null;
    return { message, escaped: Boolean(dest), toIslandId: dest };
  },

  destination(run: RunState): string | null {
    return run.pendingNavalEscape?.toIslandId ?? null;
  },

  afterVictory(run: RunState): string | null {
    const dest = this.destination(run);
    this.finishEscape(run, "");
    return dest;
  },
};
