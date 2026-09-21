import {
  BATTLE_ROW_SLOTS,
  CORE_CREW_CAP,
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
import { CharacterScheduleService } from "./CharacterScheduleService";

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

function scheduleIdFor(run: RunState, characterId: string): string {
  return characterId === run.player.id ? "player" : characterId;
}

function isBattleAvailable(run: RunState, characterId: string): boolean {
  return CharacterScheduleService.isAvailable(run, scheduleIdFor(run, characterId));
}

function emptyFormation(): Array<string | null> {
  return Array.from({ length: CORE_CREW_CAP }, () => null);
}

function rosterCharacterIds(run: RunState): string[] {
  return [run.player.id, ...run.crew.map((member) => member.characterId)];
}

function defaultPartyConfig(run: RunState): ActivePartyConfig {
  const ready = run.crew.filter((m) => CharacterScheduleService.isAvailable(run, m.characterId));
  return {
    formationSlots: emptyFormation(),
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

/**
 * Pack available members first (preserving their relative order), then unavailable /
 * hospitalized directly after them, then empty slots. Used for initial layout and
 * roster joins — never while the player is freely rearranging formation.
 */
function packAvailableThenUnavailable(run: RunState, slots: Array<string | null>): Array<string | null> {
  const available: string[] = [];
  const unavailable: string[] = [];
  const seen = new Set<string>();
  const roster = new Set(rosterCharacterIds(run));

  for (const id of slots) {
    if (!id || seen.has(id) || !roster.has(id)) {
      continue;
    }
    seen.add(id);
    if (isBattleAvailable(run, id)) {
      available.push(id);
    } else {
      unavailable.push(id);
    }
  }

  const next = emptyFormation();
  [...available, ...unavailable].forEach((id, index) => {
    next[index] = id;
  });
  return next;
}

/** Insert a roster id right after the last available member (shifts the rest right). */
function insertAfterLastAvailable(run: RunState, slots: Array<string | null>, id: string): void {
  let lastAvailable = -1;
  for (let i = 0; i < slots.length; i += 1) {
    const slotId = slots[i];
    if (slotId && isBattleAvailable(run, slotId)) {
      lastAvailable = i;
    }
  }
  const insertAt = Math.min(Math.max(lastAvailable + 1, 0), slots.length - 1);
  // Drop the trailing empty so we can shift right without overflowing.
  let free = -1;
  for (let i = slots.length - 1; i >= insertAt; i -= 1) {
    if (slots[i] == null) {
      free = i;
      break;
    }
  }
  if (free < 0) {
    const empty = slots.findIndex((slot) => slot == null);
    if (empty >= 0) {
      slots[empty] = id;
    }
    return;
  }
  for (let i = free; i > insertAt; i -= 1) {
    slots[i] = slots[i - 1] ?? null;
  }
  slots[insertAt] = id;
}

/** Move one member to sit immediately after the last available crewmate. */
function reparkMemberAfterAvailable(run: RunState, slots: Array<string | null>, characterId: string): void {
  const from = slots.indexOf(characterId);
  if (from >= 0) {
    slots[from] = null;
  }
  insertAfterLastAvailable(run, slots, characterId);
}

function buildInitialFormation(run: RunState, config: ActivePartyConfig): Array<string | null> {
  const slots = emptyFormation();
  const used = new Set<string>();
  let cursor = 0;
  const place = (id: string) => {
    if (used.has(id) || cursor >= CORE_CREW_CAP) {
      return;
    }
    slots[cursor] = id;
    used.add(id);
    cursor += 1;
  };

  // Prefer previous active line, captain first when migrating old saves.
  place(run.player.id);
  for (const id of config.activeFighterIds) {
    place(id);
  }
  for (const member of run.crew) {
    place(member.characterId);
  }
  return packAvailableThenUnavailable(run, slots);
}

function syncDerivedFighters(run: RunState, config: ActivePartyConfig): void {
  const slots = config.formationSlots ?? emptyFormation();
  const battleRow = slots.slice(0, BATTLE_ROW_SLOTS).filter((id): id is string => Boolean(id));
  const availableBattle = battleRow.filter((id) => isBattleAvailable(run, id));
  config.activeFighterIds = availableBattle
    .filter((id) => id !== run.player.id)
    .slice(0, MAX_ACTIVE_FIGHTERS);
  config.supportSlotIds = (config.supportSlotIds ?? [])
    .filter(
      (id) =>
        id !== run.player.id &&
        isBattleAvailable(run, id) &&
        !config.activeFighterIds.includes(id) &&
        !battleRow.includes(id),
    )
    .slice(0, MAX_SUPPORT_SLOTS);
}

export const CrewCombatService = {
  ensurePartyConfig(run: RunState): ActivePartyConfig {
    if (!run.activeParty) {
      run.activeParty = defaultPartyConfig(run);
    }
    const config = run.activeParty;
    const rosterIds = new Set(rosterCharacterIds(run));

    if (!config.formationSlots || config.formationSlots.length !== CORE_CREW_CAP) {
      config.formationSlots = buildInitialFormation(run, config);
    } else {
      // Drop ids that left the roster. Newcomers insert after the last available member.
      // Do NOT re-pack on every ensure — that glued unavailable crew to the leader on drag.
      config.formationSlots = config.formationSlots.map((id) =>
        id && rosterIds.has(id) ? id : null,
      );
      const present = new Set(config.formationSlots.filter(Boolean) as string[]);
      for (const id of rosterIds) {
        if (present.has(id)) {
          continue;
        }
        insertAfterLastAvailable(run, config.formationSlots, id);
      }

      // Repair empty battle row left by the old "unavailable follows leader" bug.
      const battleEmpty = config.formationSlots.slice(0, BATTLE_ROW_SLOTS).every((id) => !id);
      const hasMembers = config.formationSlots.some(Boolean);
      if (battleEmpty && hasMembers) {
        config.formationSlots = packAvailableThenUnavailable(run, config.formationSlots);
      }
    }

    syncDerivedFighters(run, config);

    for (const member of run.crew) {
      member.inActiveParty = config.activeFighterIds.includes(member.characterId);
      member.inSupportSlot = config.supportSlotIds.includes(member.characterId);
      if (!member.aiMode) {
        member.aiMode = "BALANCED";
      }
    }
    return config;
  },

  getFormationSlots(run: RunState): Array<string | null> {
    return [...(this.ensurePartyConfig(run).formationSlots ?? emptyFormation())];
  },

  /** True when the captain occupies an active-row slot (may still be unavailable). */
  captainInActiveRow(run: RunState): boolean {
    const slots = this.ensurePartyConfig(run).formationSlots ?? emptyFormation();
    return slots.slice(0, BATTLE_ROW_SLOTS).includes(run.player.id);
  },

  moveFormationMember(run: RunState, fromIndex: number, toIndex: number): boolean {
    const config = this.ensurePartyConfig(run);
    const slots = [...(config.formationSlots ?? emptyFormation())];
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= CORE_CREW_CAP ||
      toIndex >= CORE_CREW_CAP ||
      fromIndex === toIndex
    ) {
      return false;
    }
    const fromId = slots[fromIndex];
    if (!fromId) {
      return false;
    }
    const toId = slots[toIndex];
    slots[toIndex] = fromId;
    slots[fromIndex] = toId ?? null;
    // Player arrangement wins — do not auto-drag unavailable members along with the leader.
    config.formationSlots = slots;
    syncDerivedFighters(run, config);
    for (const member of run.crew) {
      member.inActiveParty = config.activeFighterIds.includes(member.characterId);
      member.inSupportSlot = config.supportSlotIds.includes(member.characterId);
    }
    return true;
  },

  setActiveFighters(run: RunState, ids: string[]): void {
    const config = this.ensurePartyConfig(run);
    const slots = emptyFormation();
    let cursor = 0;
    const place = (id: string) => {
      if (cursor >= CORE_CREW_CAP || slots.includes(id)) {
        return;
      }
      slots[cursor] = id;
      cursor += 1;
    };
    place(run.player.id);
    for (const id of ids.slice(0, MAX_ACTIVE_FIGHTERS)) {
      place(id);
    }
    for (const member of run.crew) {
      place(member.characterId);
    }
    config.formationSlots = packAvailableThenUnavailable(run, slots);
    syncDerivedFighters(run, config);
    this.ensurePartyConfig(run);
  },

  /** After a crewmate becomes hospitalized/unavailable, park them after the last available member. */
  parkUnavailableMember(run: RunState, characterId: string): void {
    const config = this.ensurePartyConfig(run);
    const slots = [...(config.formationSlots ?? emptyFormation())];
    if (!slots.includes(characterId) && !rosterCharacterIds(run).includes(characterId)) {
      return;
    }
    if (isBattleAvailable(run, characterId)) {
      return;
    }
    reparkMemberAfterAvailable(run, slots, characterId);
    config.formationSlots = slots;
    syncDerivedFighters(run, config);
  },

  setSupportSlots(run: RunState, ids: string[]): void {
    const config = this.ensurePartyConfig(run);
    config.supportSlotIds = ids.slice(0, MAX_SUPPORT_SLOTS);
    this.ensurePartyConfig(run);
  },

  initCombatParty(
    run: RunState,
    combat: CombatState,
    options?: {
      participantIds?: string[];
      forcedParticipantIds?: string[];
      lockParticipants?: boolean;
      maxAllies?: number;
      maxPlayerFighters?: number;
      allowCaptainSitOut?: boolean;
    },
  ): CombatPartyState {
    const config = this.ensurePartyConfig(run);
    const readyCrew = run.crew.filter((member) =>
      CharacterScheduleService.isAvailable(run, member.characterId),
    );
    const maxPlayerFighters =
      options?.maxPlayerFighters ??
      (options?.maxAllies !== undefined ? options.maxAllies + 1 : BATTLE_ROW_SLOTS);
    const playerId = run.player.id;
    const forced = options?.forcedParticipantIds ?? [];
    const chosen = options?.participantIds ?? [];

    let fighterIds: string[] = [];
    let includeCaptain = true;

    if (forced.length || chosen.length || options?.lockParticipants) {
      const selected = [...new Set([...forced, ...chosen])];
      includeCaptain = selected.includes(playerId);
      if (!options?.allowCaptainSitOut && selected.length === 0) {
        includeCaptain = true;
      }
      if (selected.length === 0 && options?.lockParticipants) {
        includeCaptain = true;
      }
      const crewLimit = Math.max(0, includeCaptain ? maxPlayerFighters - 1 : maxPlayerFighters);
      fighterIds = selected
        .filter((id) => id !== playerId)
        .filter((id) => readyCrew.some((member) => member.characterId === id) || forced.includes(id))
        .slice(0, crewLimit);
      if (!options?.lockParticipants) {
        for (const member of readyCrew) {
          if (fighterIds.length >= crewLimit) break;
          if (!fighterIds.includes(member.characterId)) {
            fighterIds.push(member.characterId);
          }
        }
      }
    } else {
      const battleRow = (config.formationSlots ?? emptyFormation())
        .slice(0, BATTLE_ROW_SLOTS)
        .filter((id): id is string => Boolean(id));
      const availableRow = battleRow.filter((id) => isBattleAvailable(run, id));
      includeCaptain = availableRow.includes(playerId);
      if (!includeCaptain && availableRow.length === 0 && options?.allowCaptainSitOut !== true) {
        // Nobody available in the active row — fall back to captain if they can fight.
        includeCaptain = isBattleAvailable(run, playerId);
      }
      const crewLimit = Math.max(0, includeCaptain ? maxPlayerFighters - 1 : maxPlayerFighters);
      fighterIds = availableRow
        .filter((id) => id !== playerId)
        .filter((id) => readyCrew.some((member) => member.characterId === id))
        .slice(0, crewLimit);
      // Do not auto-fill from bench — formation is intentional.
    }

    combat.playerCombatant.participating = includeCaptain;
    if (!includeCaptain && combat.activeCombatantId === playerId) {
      combat.activeCombatantId = fighterIds[0] ?? playerId;
    }

    config.activeFighterIds = fighterIds;
    config.supportSlotIds = options?.lockParticipants
      ? []
      : config.supportSlotIds.filter(
          (id) =>
            readyCrew.some((member) => member.characterId === id) && !config.activeFighterIds.includes(id),
        );

    if (!options?.lockParticipants && config.supportSlotIds.length < MAX_SUPPORT_SLOTS) {
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

    config.activeFighterIds = fighterIds;
    for (const member of run.crew) {
      member.inActiveParty = fighterIds.includes(member.characterId);
      member.inSupportSlot = config.supportSlotIds.includes(member.characterId);
    }
    const party: CombatPartyState = {
      activeFighterIds: [...fighterIds],
      supportSlotIds: options?.lockParticipants ? [] : [...config.supportSlotIds],
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
          participation: includeCaptain ? "ACTIVE" : "CORE",
        },
      ],
    };

    for (const characterId of fighterIds) {
      const character = CharacterService.getCharacter(run, characterId);
      const member = run.crew.find((entry) => entry.characterId === characterId);
      if (!character || !member) {
        continue;
      }
      const hp = CrewService.estimatedHp(character, member);
      const stats = character.crewStats ?? statsFromStrength(character.strength);
      const maxMp = MpService.maxMpForStats(stats);
      const vitals = CrewService.ensureMemberVitals(run, characterId);
      const abilities = getAbilitiesForCrewmember(run, characterId);
      party.allyCombatants.push({
        id: characterId,
        name: character.name,
        side: "PLAYER",
        hp: vitals?.hp ?? hp.hp,
        maxHp: vitals?.maxHp ?? hp.maxHp,
        mp: vitals?.mp ?? maxMp,
        maxMp: vitals?.maxMp ?? maxMp,
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
        level: member.progression?.level ?? 1,
        participating: true,
      });
      contributionFor(party, characterId, character.name, "PLAYER", "ACTIVE");
    }

    if (!options?.lockParticipants) {
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
      combatKind === "BOSS" || combatKind === "HIGH_RISK" || combatKind === "ELITE"
        ? XP_REWARDS.COMBAT_BOSS
        : XP_REWARDS.COMBAT_WIN;
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
