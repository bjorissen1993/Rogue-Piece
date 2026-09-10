import { XP_REWARDS } from "../game/constants";
import type { BattleResultReport, BattleXpSnapshot, CombatState, RunState } from "../models/types";
import { ProgressionService, xpToNextLevel } from "./ProgressionService";

function progressionId(run: RunState, combatantId: string): "player" | string {
  return combatantId === run.player.id ? "player" : combatantId;
}

function snapshotProgression(
  run: RunState,
  combatantId: string,
  xpEarned: number,
  participation: BattleXpSnapshot["participation"],
): BattleXpSnapshot {
  const id = progressionId(run, combatantId);
  const progression = ProgressionService.getProgression(run, id);
  const levelAfter = progression.level;
  const xpAfter = progression.experience;
  const xpNeededAfter = xpToNextLevel(levelAfter);
  return {
    characterId: combatantId,
    name: ProgressionService.getDisplayName(run, id),
    xpEarned,
    levelBefore: levelAfter,
    xpBefore: xpAfter,
    xpNeededBefore: xpNeededAfter,
    levelAfter,
    xpAfter,
    xpNeededAfter,
    leveledUp: false,
    participation,
  };
}

function captureBefore(run: RunState, combatantId: string): Pick<BattleXpSnapshot, "levelBefore" | "xpBefore" | "xpNeededBefore"> {
  const id = progressionId(run, combatantId);
  const progression = ProgressionService.getProgression(run, id);
  return {
    levelBefore: progression.level,
    xpBefore: progression.experience,
    xpNeededBefore: xpToNextLevel(progression.level),
  };
}

function sortPendingLevelUps(run: RunState, snapshotCharacterIds: string[]): void {
  if (!run.pendingLevelUps?.length) {
    return;
  }
  const order = new Map(snapshotCharacterIds.map((id, index) => [id, index]));
  const resolveId = (characterId: "player" | string) =>
    characterId === "player" ? run.player.id : characterId;

  run.pendingLevelUps.sort((a, b) => {
    const indexA = order.get(resolveId(a.characterId)) ?? Number.MAX_SAFE_INTEGER;
    const indexB = order.get(resolveId(b.characterId)) ?? Number.MAX_SAFE_INTEGER;
    if (indexA !== indexB) {
      return indexA - indexB;
    }
    return a.fromLevel - b.fromLevel;
  });
}

export const BattleResultService = {
  createFromCombat(run: RunState, combat: CombatState): BattleResultReport | null {
    const party = combat.party;
    if (!party || combat.result !== "WIN") {
      return null;
    }

    const base =
      combat.combatKind === "BOSS" || combat.combatKind === "HIGH_RISK"
        ? XP_REWARDS.COMBAT_BOSS
        : XP_REWARDS.COMBAT_WIN;

    const xpSnapshots: BattleXpSnapshot[] = [];
    const relevant = party.contributions.filter(
      (entry) => entry.participation === "ACTIVE" || entry.participation === "SUPPORT",
    );

    for (const contrib of relevant) {
      let multiplier = 0.4;
      if (contrib.participation === "ACTIVE") {
        multiplier = 1;
      } else if (contrib.participation === "SUPPORT") {
        multiplier = 0.75;
      }
      const amount = Math.round(base * multiplier);
      contrib.xpEarned = amount;
      if (amount <= 0) {
        continue;
      }

      const before = captureBefore(run, contrib.combatantId);
      const id = progressionId(run, contrib.combatantId);
      ProgressionService.grantExperience(run, id, amount, "combat victory");

      const after = ProgressionService.getProgression(run, id);
      xpSnapshots.push({
        characterId: contrib.combatantId,
        name: contrib.name,
        xpEarned: amount,
        ...before,
        levelAfter: after.level,
        xpAfter: after.experience,
        xpNeededAfter: xpToNextLevel(after.level),
        leveledUp: after.level > before.levelBefore,
        participation: contrib.participation,
      });
    }

    sortPendingLevelUps(
      run,
      xpSnapshots.map((entry) => entry.characterId),
    );

    return {
      outcome: combat.result,
      round: combat.round,
      enemyNames: combat.enemies.map((enemy) => enemy.name),
      threatLevel: combat.threatLevel,
      combatKind: combat.combatKind,
      contributions: party.contributions.map((entry) => ({ ...entry })),
      xpSnapshots,
    };
  },

  /** Fallback when combat ended without party tracking but XP was already granted. */
  fromGrantedXp(run: RunState, combat: CombatState): BattleResultReport | null {
    if (!combat.party || combat.result !== "WIN") {
      return null;
    }
    const xpSnapshots = combat.party.contributions
      .filter((entry) => entry.xpEarned > 0)
      .map((entry) => snapshotProgression(run, entry.combatantId, entry.xpEarned, entry.participation));

    return {
      outcome: combat.result,
      round: combat.round,
      enemyNames: combat.enemies.map((enemy) => enemy.name),
      threatLevel: combat.threatLevel,
      combatKind: combat.combatKind,
      contributions: combat.party.contributions.map((entry) => ({ ...entry })),
      xpSnapshots,
    };
  },
};
