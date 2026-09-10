import type { Ability, Player, PlayerStats } from "../models/types";

const MP_BASE = 8;
const MP_PER_WILL = 3;
const MP_REGEN_PER_ROUND = 3;

export const MpService = {
  maxMpForStats(stats: PlayerStats): number {
    return MP_BASE + stats.willpower * MP_PER_WILL;
  },

  maxMpFor(player: Player): number {
    return this.maxMpForStats(player.stats);
  },

  ensurePlayer(player: Player): void {
    const maxMp = this.maxMpFor(player);
    player.maxMp = maxMp;
    if (player.mp == null || player.mp > maxMp) {
      player.mp = maxMp;
    }
  },

  abilityMpCost(ability: Ability): number {
    if (ability.mpCost != null) {
      return ability.mpCost;
    }
    return Math.max(2, Math.ceil(ability.power / 2));
  },

  regenPerRound(): number {
    return MP_REGEN_PER_ROUND;
  },
};
