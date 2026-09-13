import type {
  BattleFormat,
  CombatRequest,
  CombatState,
  PendingBattleSetup,
  RunState,
  SparWager,
  SparWagerType,
} from "../models/types";
import { XP_REWARDS } from "../game/constants";
import { CharacterService } from "./CharacterService";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { BATTLE_FORMATS, formatForKind } from "./EncounterCompositionService";
import { ProgressionService } from "./ProgressionService";
import { WeaponService } from "./WeaponService";
import { createId } from "../utils/ids";

const SPAR_COOLDOWN_DAYS = 2;
const MAX_SPAR_GAINS_PER_KEY = 4;

export const SparringService = {
  cooldownDays: SPAR_COOLDOWN_DAYS,

  availableWagers(run: RunState, relationship = 50): SparWager[] {
    const wagers: SparWager[] = [
      { type: "NONE", label: "No stakes — just training." },
      { type: "PRIDE", label: "Pride and bragging rights." },
    ];
    if (run.player.berries >= 200 && relationship >= 20) {
      wagers.push({ type: "BERRIES", berries: 200, label: "฿200 on the winner." });
    }
    if (run.player.berries >= 1000 && relationship >= 40) {
      wagers.push({ type: "BERRIES", berries: 1000, label: "฿1,000 says we win." });
    }
    if (relationship >= 35) {
      wagers.push({ type: "TRAINING", label: "Winner gets technique advice." });
    }
    if (relationship >= 50) {
      wagers.push({ type: "INFORMATION", label: "Winner gets a rumor." });
      wagers.push({ type: "FAVOR", label: "Loser owes a favor." });
    }
    if (relationship >= 25) {
      wagers.push({ type: "MEAL", label: "Loser buys the next meal." });
    }
    return wagers;
  },

  canRematch(run: RunState, sparKey: string): { ok: boolean; reason: string } {
    const entry = run.sparHistory?.[sparKey];
    if (!entry) {
      return { ok: true, reason: "" };
    }
    if (run.day - entry.lastDay < SPAR_COOLDOWN_DAYS) {
      return { ok: false, reason: `Too soon — wait until day ${entry.lastDay + SPAR_COOLDOWN_DAYS}.` };
    }
    return { ok: true, reason: "" };
  },

  sparMultiplier(run: RunState, sparKey: string | null | undefined): number {
    if (!sparKey) return 1;
    const count = run.sparHistory?.[sparKey]?.count ?? 0;
    if (count <= 0) return 1;
    if (count === 1) return 0.7;
    if (count === 2) return 0.45;
    if (count >= MAX_SPAR_GAINS_PER_KEY) return 0.15;
    return 0.3;
  },

  buildFriendlyRequest(options: {
    enemyName: string;
    enemyStrength: number;
    format?: BattleFormat;
    wager?: SparWager | null;
    opponentCharacterId?: string | null;
    forcedParticipantIds?: string[];
    requireSetup?: boolean;
  }): CombatRequest {
    const format = options.format ?? {
      ...BATTLE_FORMATS.DUEL_1V1,
      isFriendly: true,
      stakesAllowed: true,
      label: "Friendly Match",
      playerChoosesParticipants: true,
    };
    const wager = options.wager ?? { type: "NONE" as SparWagerType, label: "No stakes" };
    const sparKey = `spar:${options.opponentCharacterId ?? options.enemyName}:${format.id}`;
    return {
      enemyName: options.enemyName,
      enemyStrength: options.enemyStrength,
      enemyHp: 18 + options.enemyStrength * 4,
      combatKind: "SPARRING",
      enemyFamily: "TRAINING",
      enemyRole: "NORMAL",
      compositionTemplateId: "TRAINING_DUMMY",
      enemyCount: format.maxEnemies,
      battleFormat: format,
      isFriendly: true,
      wager,
      opponentCharacterId: options.opponentCharacterId ?? null,
      sparKey,
      forcedParticipantIds: options.forcedParticipantIds,
      requireSetup: options.requireSetup ?? format.playerChoosesParticipants,
      canEscape: false,
      canSurrender: false,
      win: {
        text: `You win the friendly match against ${options.enemyName}.`,
      },
      lose: {
        text: `${options.enemyName} takes the match — but nobody is hurt for real.`,
        hpChange: -2,
      },
    };
  },

  createSetup(_run: RunState, request: CombatRequest): PendingBattleSetup {
    const format = request.battleFormat ?? formatForKind(request.combatKind, request.isFriendly);
    return {
      request,
      format,
      forcedParticipantIds: request.forcedParticipantIds ?? [],
      opponentLabel: request.enemyName,
      wager: request.wager ?? null,
      opponentCharacterId: request.opponentCharacterId ?? null,
    };
  },

  eligibleParticipants(run: RunState): Array<{
    id: string;
    name: string;
    available: boolean;
    reason?: string;
    level: number;
    hpLabel: string;
  }> {
    const list: Array<{
      id: string;
      name: string;
      available: boolean;
      reason?: string;
      level: number;
      hpLabel: string;
    }> = [
      {
        id: run.player.id,
        name: run.player.name,
        available: true,
        level: run.player.progression?.level ?? 1,
        hpLabel: `${run.player.hp}/${run.player.maxHp}`,
      },
    ];
    for (const member of run.crew) {
      const character = CharacterService.getCharacter(run, member.characterId);
      if (!character) continue;
      const available = CharacterScheduleService.isAvailable(run, member.characterId);
      list.push({
        id: member.characterId,
        name: character.name,
        available,
        reason: available ? undefined : member.status ?? "Unavailable",
        level: member.progression?.level ?? 1,
        hpLabel: available ? "Ready" : member.status ?? "Busy",
      });
    }
    return list;
  },

  settleWager(run: RunState, combat: CombatState, won: boolean): string[] {
    const lines: string[] = [];
    const wager = combat.wager;
    if (!wager || wager.type === "NONE") {
      return lines;
    }
    if (wager.type === "BERRIES" && wager.berries) {
      if (won) {
        run.player.berries += wager.berries;
        lines.push(`You collect ฿${wager.berries} from the wager.`);
      } else {
        run.player.berries = Math.max(0, run.player.berries - wager.berries);
        lines.push(`You pay ฿${wager.berries} — a debt of pride, paid in coin.`);
      }
    } else if (wager.type === "MEAL") {
      lines.push(won ? "They owe you a meal." : "You owe them a meal.");
    } else if (wager.type === "TRAINING") {
      lines.push(won ? "They share a tip about footwork." : "They offer advice after beating you.");
    } else if (wager.type === "INFORMATION") {
      lines.push(won ? "They share a dockside rumor." : "No rumor — you lost the wager.");
    } else if (wager.type === "FAVOR") {
      lines.push(won ? "They owe you a favor." : "You owe them a favor.");
    } else if (wager.type === "PRIDE") {
      lines.push(won ? "Respect earned." : "Pride dented — respect still intact.");
    }

    const npcId = combat.opponentCharacterId;
    if (npcId) {
      // Settled wagers count as kept terms; broken wagers are applied elsewhere when refused.
      CharacterService.addMemory(run, npcId, "PLAYER_KEPT_WAGER", 2);
    }
    return lines;
  },

  applyFriendlyRewards(run: RunState, combat: CombatState, won: boolean): string[] {
    const lines: string[] = [];
    const mult = this.sparMultiplier(run, combat.sparKey);
    const baseXp = Math.round((won ? XP_REWARDS.COMBAT_WIN : Math.round(XP_REWARDS.COMBAT_WIN * 0.55)) * mult);
    const xpMsg = ProgressionService.grantExperience(run, "player", baseXp, "sparring").message;
    if (xpMsg) lines.push(xpMsg);

    if (mult >= 0.3) {
      WeaponService.onCombatWin(run);
      lines.push(won ? "Weapon mastery inches forward." : "Even in defeat, your form sharpens a little.");
    } else {
      lines.push("You've sparred this opponent too often — gains have dwindled.");
    }

    const npcId = combat.opponentCharacterId;
    if (npcId) {
      CharacterService.addMemory(run, npcId, "SPARRED_WITH_PLAYER", 2);
      CharacterService.addMemory(run, npcId, won ? "LOST_TO_PLAYER" : "DEFEATED_PLAYER", 3);
      const character = CharacterService.getCharacter(run, npcId);
      if (character) {
        character.relationshipWithPlayer = Math.max(
          -100,
          Math.min(100, (character.relationshipWithPlayer ?? 0) + (won ? 2 : 3)),
        );
        const spars = (run.sparHistory?.[combat.sparKey ?? ""]?.count ?? 0) + 1;
        if (spars >= 3) {
          CharacterService.addMemory(run, npcId, "FRIENDLY_RIVAL", 4);
          lines.push(`${character.name} is becoming a friendly rival.`);
        }
      }
    }

    if (combat.sparKey) {
      if (!run.sparHistory) run.sparHistory = {};
      const prev = run.sparHistory[combat.sparKey];
      run.sparHistory[combat.sparKey] = {
        count: (prev?.count ?? 0) + 1,
        lastDay: run.day,
      };
    }

    lines.push(...this.settleWager(run, combat, won));
    return lines;
  },

  /** Soften lethal lose outcome for friendly fights before conclude. */
  softenFriendlyDefeat(run: RunState, combat: CombatState): void {
    if (!combat.isFriendly) return;
    if (run.player.hp <= 0) {
      run.player.hp = 1;
    }
    if (combat.playerCombatant.hp <= 0) {
      combat.playerCombatant.hp = 1;
    }
  },
};

export function needsBattleSetup(request: CombatRequest): boolean {
  if (request.requireSetup) return true;
  const format = request.battleFormat ?? formatForKind(request.combatKind, request.isFriendly);
  if (request.forcedParticipantIds?.length && !format.playerChoosesParticipants) {
    return false;
  }
  return format.playerChoosesParticipants;
}

export function makeSparId(): string {
  return createId("spar");
}
