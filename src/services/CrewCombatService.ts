import {
  MAX_ACTIVE_FIGHTERS,
  MAX_SUPPORT_SLOTS,
  XP_REWARDS,
} from "../game/constants";
import type {
  ActivePartyConfig,
  CombatContribution,
  CombatPartyState,
  CombatState,
  CrewAiMode,
  CrewRole,
  CrewSupportAbility,
  RunState,
} from "../models/types";
import { getAbilitiesForCrewmember } from "../data/abilities";
import { clamp } from "../utils/stats";
import { CharacterService } from "./CharacterService";
import { MpService } from "./MpService";
import { rollCombatResult, statsFromStrength } from "./CombatCalculationService";
import type { RandomService } from "./RandomService";
import { CrewService } from "./CrewService";
import { ProgressionService } from "./ProgressionService";

export const SUPPORT_ABILITIES: CrewSupportAbility[] = [
  {
    id: "doctor_field_medicine",
    role: "DOCTOR",
    name: "Field Medicine",
    description: "Restore a small amount of HP to the lowest ally at combat start.",
    trigger: "COMBAT_START",
  },
  {
    id: "navigator_escape",
    role: "NAVIGATOR",
    name: "Escape Route",
    description: "Boost escape chance on the first escape attempt.",
    trigger: "ESCAPE_ATTEMPT",
  },
  {
    id: "sniper_covering_fire",
    role: "SNIPER",
    name: "Covering Fire",
    description: "Chip the enemy at turn start for minor damage.",
    trigger: "TURN_START",
  },
];

function defaultPartyConfig(run: RunState): ActivePartyConfig {
  const ready = run.crew.filter((m) => m.status !== "Injured" && m.status !== "Captured");
  return {
    activeFighterIds: ready.slice(0, MAX_ACTIVE_FIGHTERS).map((m) => m.characterId),
    supportSlotIds: ready.slice(MAX_ACTIVE_FIGHTERS, MAX_ACTIVE_FIGHTERS + MAX_SUPPORT_SLOTS).map((m) => m.characterId),
  };
}

function contributionFor(
  party: CombatPartyState,
  combatantId: string,
  name: string,
  side: CombatPartyState["contributions"][number]["side"],
  participation: CombatContribution["participation"],
): CombatContribution {
  const existing = party.contributions.find((entry) => entry.combatantId === combatantId);
  if (existing) {
    return existing;
  }
  const entry: CombatContribution = {
    combatantId,
    name,
    side,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    xpEarned: 0,
    participation,
  };
  party.contributions.push(entry);
  return entry;
}

function pickAiAction(mode: CrewAiMode): "ATTACK" | "DEFEND" | "SUPPORT" {
  switch (mode) {
    case "AGGRESSIVE":
      return "ATTACK";
    case "DEFENSIVE":
      return "DEFEND";
    case "SUPPORT":
      return "SUPPORT";
    case "BALANCED":
    default:
      return Math.random() < 0.7 ? "ATTACK" : "DEFEND";
  }
}

export const CrewCombatService = {
  ensurePartyConfig(run: RunState): ActivePartyConfig {
    if (!run.activeParty) {
      run.activeParty = defaultPartyConfig(run);
    }
    run.activeParty.activeFighterIds = run.activeParty.activeFighterIds.slice(0, MAX_ACTIVE_FIGHTERS);
    run.activeParty.supportSlotIds = run.activeParty.supportSlotIds.slice(0, MAX_SUPPORT_SLOTS);
    for (const member of run.crew) {
      member.inActiveParty = run.activeParty.activeFighterIds.includes(member.characterId);
      member.inSupportSlot = run.activeParty.supportSlotIds.includes(member.characterId);
      if (!member.aiMode) {
        member.aiMode = "BALANCED";
      }
    }
    return run.activeParty;
  },

  setActiveFighters(run: RunState, ids: string[]): void {
    const config = this.ensurePartyConfig(run);
    config.activeFighterIds = ids.slice(0, MAX_ACTIVE_FIGHTERS);
    this.ensurePartyConfig(run);
  },

  setSupportSlots(run: RunState, ids: string[]): void {
    const config = this.ensurePartyConfig(run);
    config.supportSlotIds = ids.slice(0, MAX_SUPPORT_SLOTS);
    this.ensurePartyConfig(run);
  },

  initCombatParty(run: RunState, combat: CombatState): CombatPartyState {
    const config = this.ensurePartyConfig(run);
    const readyCrew = run.crew.filter((member) => member.status !== "Injured" && member.status !== "Captured");
    config.activeFighterIds = readyCrew.slice(0, MAX_ACTIVE_FIGHTERS).map((member) => member.characterId);
    config.supportSlotIds = config.supportSlotIds.filter((id) =>
      readyCrew.some((member) => member.characterId === id),
    );
    if (config.supportSlotIds.length < MAX_SUPPORT_SLOTS) {
      const reserve = readyCrew
        .filter((member) => !config.activeFighterIds.includes(member.characterId))
        .map((member) => member.characterId);
      for (const id of reserve) {
        if (config.supportSlotIds.length >= MAX_SUPPORT_SLOTS) {
          break;
        }
        if (!config.supportSlotIds.includes(id)) {
          config.supportSlotIds.push(id);
        }
      }
    }
    this.ensurePartyConfig(run);
    const party: CombatPartyState = {
      activeFighterIds: [...config.activeFighterIds],
      supportSlotIds: [...config.supportSlotIds],
      allyCombatants: [],
      supportInterventionUsed: false,
      contributions: [
        {
          combatantId: run.player.id,
          name: run.player.name,
          side: "PLAYER",
          damageDealt: 0,
          damageTaken: 0,
          healingDone: 0,
          xpEarned: 0,
          participation: "ACTIVE",
        },
      ],
    };

    for (const characterId of config.activeFighterIds) {
      const character = CharacterService.getCharacter(run, characterId);
      const member = run.crew.find((entry) => entry.characterId === characterId);
      if (!character || !member) {
        continue;
      }
      const hp = CrewService.estimatedHp(character);
      const stats = character.crewStats ?? statsFromStrength(character.strength);
      const maxMp = MpService.maxMpForStats(stats);
      const abilities = getAbilitiesForCrewmember(run, characterId);
      party.allyCombatants.push({
        id: characterId,
        name: character.name,
        side: "PLAYER",
        hp: hp.hp,
        maxHp: hp.maxHp,
        mp: maxMp,
        maxMp,
        stats,
        defending: false,
        observed: false,
        revealed: true,
        nextActionHint: null,
        intendedAction: "ATTACK",
        weakPointDiscovered: false,
        accuracyBonus: 0,
        dodgeBonus: 0,
        statusEffects: [],
        abilities,
      });
      contributionFor(party, characterId, character.name, "PLAYER", "ACTIVE");
    }

    for (const characterId of config.supportSlotIds) {
      const character = CharacterService.getCharacter(run, characterId);
      if (character) {
        contributionFor(party, characterId, character.name, "PLAYER", "SUPPORT");
      }
    }

    for (const member of run.crew) {
      if (
        !config.activeFighterIds.includes(member.characterId) &&
        !config.supportSlotIds.includes(member.characterId)
      ) {
        const character = CharacterService.getCharacter(run, member.characterId);
        if (character) {
          contributionFor(party, member.characterId, character.name, "PLAYER", "CORE");
        }
      }
    }

    combat.party = party;
    return party;
  },

  triggerSupportAbilities(combat: CombatState, run: RunState, trigger: CrewSupportAbility["trigger"], rng: RandomService): string[] {
    const party = combat.party;
    if (!party) {
      return [];
    }
    const lines: string[] = [];
    for (const characterId of party.supportSlotIds) {
      const member = run.crew.find((entry) => entry.characterId === characterId);
      const ability = SUPPORT_ABILITIES.find((entry) => entry.role === member?.role && entry.trigger === trigger);
      if (!ability) {
        continue;
      }
      if (ability.id === "doctor_field_medicine" && trigger === "COMBAT_START") {
        const allies = [combat.playerCombatant, ...party.allyCombatants].filter((ally) => ally.hp > 0);
        const target = allies.reduce<typeof allies[number] | null>((lowest, ally) => {
          if (!lowest) {
            return ally;
          }
          return ally.hp / ally.maxHp < lowest.hp / lowest.maxHp ? ally : lowest;
        }, null);
        if (!target) {
          continue;
        }
        const heal = 6 + Math.floor(rng.nextInt(2, 5));
        target.hp = clamp(target.hp + heal, 0, target.maxHp);
        const character = CharacterService.getCharacter(run, characterId);
        const contrib = contributionFor(
          party,
          characterId,
          character?.name ?? ability.name,
          "PLAYER",
          "SUPPORT",
        );
        contrib.healingDone += heal;
        lines.push(`${character?.name ?? "Support"} — ${ability.name}: +${heal} HP to ${target.name}.`);
      }
      if (ability.id === "sniper_covering_fire" && trigger === "TURN_START") {
        const enemy = combat.enemies.find((entry) => entry.hp > 0);
        if (enemy) {
          const chip = rng.nextInt(2, 5);
          enemy.hp = clamp(enemy.hp - chip, 0, enemy.maxHp);
          const contrib = contributionFor(party, characterId, ability.name, "PLAYER", "SUPPORT");
          contrib.damageDealt += chip;
          lines.push(`${ability.name}: ${chip} chip damage on ${enemy.name}.`);
        }
      }
    }
    return lines;
  },

  /** Loyal crewmate blocks one hit per battle (stub). */
  trySupportIntervention(
    combat: CombatState,
    run: RunState,
    incomingDamage: number,
    targetId?: string,
  ): number {
    const party = combat.party;
    if (!party || party.supportInterventionUsed || incomingDamage <= 0) {
      return incomingDamage;
    }
    const loyal = run.crew.find(
      (member) =>
        party.supportSlotIds.includes(member.characterId) &&
        (CharacterService.getCharacter(run, member.characterId)?.relationshipWithPlayer ?? 0) >= 4,
    );
    if (!loyal) {
      return incomingDamage;
    }
    party.supportInterventionUsed = true;
    const blocked = Math.min(incomingDamage, Math.round(incomingDamage * 0.6));
    const character = CharacterService.getCharacter(run, loyal.characterId);
    if (character && party) {
      const contrib = contributionFor(party, loyal.characterId, character.name, "PLAYER", "SUPPORT");
      contrib.damageTaken += blocked;
    }
    combat.log.push({
      id: `clog-${combat.log.length}`,
      round: combat.round,
      text: `${character?.name ?? "A crewmate"} intervenes for ${targetId ? "an ally" : "you"}! Damage reduced by ${blocked}.`,
    });
    return incomingDamage - blocked;
  },

  navigatorEscapeBonus(combat: CombatState, run: RunState): number {
    const party = combat.party;
    if (!party) {
      return 0;
    }
    const hasNav = party.supportSlotIds.some((id) => {
      const member = run.crew.find((entry) => entry.characterId === id);
      return member?.role === "NAVIGATOR";
    });
    return hasNav && combat.escapeAttempts === 0 ? 0.12 : 0;
  },

  allyTurn(combat: CombatState, run: RunState, rng: RandomService): string[] {
    const party = combat.party;
    if (!party) {
      return [];
    }
    const enemy = combat.enemies.find((entry) => entry.hp > 0);
    if (!enemy) {
      return [];
    }
    const lines: string[] = [];
    for (const ally of party.allyCombatants.filter((entry) => entry.hp > 0)) {
      const member = run.crew.find((entry) => entry.characterId === ally.id);
      const mode = member?.aiMode ?? "BALANCED";
      const action = pickAiAction(mode);
      if (action === "DEFEND") {
        ally.defending = true;
        lines.push(`${ally.name} braces.`);
        continue;
      }
      if (action === "SUPPORT") {
        combat.playerCombatant.dodgeBonus += 4;
        lines.push(`${ally.name} covers you.`);
        continue;
      }
      const result = rollCombatResult({
        attacker: ally,
        defender: enemy,
        rng,
      });
      if (result.dodged) {
        lines.push(`${ally.name} misses.`);
      } else {
        enemy.hp = clamp(enemy.hp - result.damage, 0, enemy.maxHp);
        const contrib = contributionFor(party, ally.id, ally.name, "PLAYER", "ACTIVE");
        contrib.damageDealt += result.damage;
        lines.push(`${ally.name} hits for ${result.damage}.${result.crit ? " Critical!" : ""}`);
      }
    }
    return lines;
  },

  recordPlayerDamage(combat: CombatState, amount: number): void {
    const party = combat.party;
    if (!party) {
      return;
    }
    const contrib = contributionFor(party, combat.playerCombatant.id, combat.playerCombatant.name, "PLAYER", "ACTIVE");
    contrib.damageTaken += amount;
  },

  distributeXp(run: RunState, combat: CombatState, combatKind?: string): string {
    const party = combat.party;
    const base =
      combatKind === "BOSS" || combatKind === "HIGH_RISK" ? XP_REWARDS.COMBAT_BOSS : XP_REWARDS.COMBAT_WIN;
    if (!party) {
      return ProgressionService.grantCombatXp(run, combatKind);
    }

    const lines: string[] = [];
    for (const contrib of party.contributions) {
      let multiplier = 0.4;
      if (contrib.participation === "ACTIVE") {
        multiplier = 1;
      } else if (contrib.participation === "SUPPORT") {
        multiplier = 0.75;
      }
      const amount = Math.round(base * multiplier);
      contrib.xpEarned = amount;
      if (contrib.combatantId === run.player.id) {
        const result = ProgressionService.grantExperience(run, "player", amount, "combat victory");
        lines.push(result.message);
      } else if (run.crew.some((member) => member.characterId === contrib.combatantId)) {
        ProgressionService.grantExperience(run, contrib.combatantId, amount, "combat victory");
      }
    }

    party.postBattleSummary = this.formatContributionSummary(party);
    return [lines[0] ?? "Combat XP awarded.", party.postBattleSummary].filter(Boolean).join("\n");
  },

  formatContributionSummary(party: CombatPartyState): string {
    const rows = party.contributions
      .filter((entry) => entry.damageDealt > 0 || entry.damageTaken > 0 || entry.healingDone > 0)
      .map(
        (entry) =>
          `${entry.name}: ${entry.damageDealt} dealt, ${entry.damageTaken} taken` +
          (entry.healingDone ? `, ${entry.healingDone} healed` : "") +
          ` · ${entry.xpEarned} XP (${entry.participation.toLowerCase()})`,
      );
    return rows.length ? `Battle contributions:\n${rows.join("\n")}` : "";
  },

  supportAbilityForRole(role: CrewRole): CrewSupportAbility | undefined {
    return SUPPORT_ABILITIES.find((entry) => entry.role === role);
  },
};

// Re-export for CombatEngine observe scaling
export { observeBonuses } from "./CombatCalculationService";
