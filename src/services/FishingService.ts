import { getEncounterById } from "../data/encounters";
import { FISH_CATCH_ITEM_IDS, rollFishCatch } from "../data/fishing";
import type { CombatRequest, ProfileSave, RunState } from "../models/types";
import { CombatEngine } from "./CombatEngine";
import { IslandPressureService } from "./IslandPressureService";
import { ItemService } from "./ItemService";
import { createRng } from "./RandomService";
import { StoryChainService } from "./StoryChainService";
import { WorldService } from "./WorldService";

export const SEA_KING_HOOK_LINE = "You've hooked a Sea King. The line goes taut.";

export type FishingSessionResult = {
  caught: boolean;
  attempted: boolean;
  elapsedMs: number;
  greenHits: number;
  goldHits: number;
  grayHits: number;
  timeLeftMs: number;
  redHits?: number;
  seaKingHooked?: boolean;
};

function seaKingCombatRequest(): CombatRequest | null {
  const fight = getEncounterById("sea_king")?.choices.find((choice) => choice.id === "fight");
  const combat = fight?.outcome.combat;
  return combat ? structuredClone(combat) : null;
}

export const FishingService = {
  countCaughtFish(run: RunState): number {
    return FISH_CATCH_ITEM_IDS.reduce((sum, id) => sum + ItemService.countOwned(run, id), 0);
  },

  applySession(run: RunState, result: FishingSessionResult, profile?: ProfileSave): string {
    if (!result.attempted) {
      return "";
    }
    const rng = createRng(`${run.seed}:fishing:${run.day}:${run.timeOfDay}:${run.player.inventory.length}`);
    WorldService.spendTime(run, 1, rng);
    if (result.seaKingHooked) {
      const request = seaKingCombatRequest();
      StoryChainService.markSeaKingHooked(run);
      if (request) {
        IslandPressureService.onHostileAction(run, 10);
        run.pendingBattleSetup = null;
        run.combat = CombatEngine.createFromRequest(run.player, request, rng, run);
      }
      run.lastFeedback = SEA_KING_HOOK_LINE;
      StoryChainService.syncObjectives(run);
      return run.lastFeedback;
    }
    if (!result.caught) {
      run.lastFeedback = "The fish slipped the hook. A time slot passed.";
      StoryChainService.syncObjectives(run);
      return run.lastFeedback;
    }
    const rolled = rollFishCatch(
      {
        greenHits: result.greenHits,
        goldHits: result.goldHits,
        grayHits: result.grayHits,
        timeLeftMs: result.timeLeftMs,
      },
      rng.next(),
    );
    ItemService.grant(run, rolled.tier.id, 1, profile);
    run.lastFeedback = `You reeled in a ${rolled.tier.name}. A time slot passed.`;
    StoryChainService.syncObjectives(run);
    return run.lastFeedback;
  },
};
