import { FACTIONS, getFaction } from "../data/factions";
import type {
  ActiveConflict,
  FactionRelationChange,
  FactionRelationship,
  FactionRumor,
  FactionShift,
  FactionStatusLabel,
  FactionTrendLabel,
  FactionWorldEvent,
  FactionWorldState,
  KnowledgeLevel,
  NpcFaction,
  ProfileSave,
  RegionalInfluence,
  RelationFactionId,
  RunState,
  WorldCharacter,
  WorldHistoryEvent,
} from "../models/types";
import { clamp } from "../utils/stats";
import { createId, nowIso } from "../utils/ids";

const REVEAL_WG = 68;
const REVEAL_OPPRESSION = 55;
const REVEAL_ACTIVITY = 22;

const NPC_FACTION_MAP: Record<RelationFactionId, NpcFaction> = {
  MARINES: "MARINE",
  PIRATES: "PIRATE",
  WORLD_GOVERNMENT: "MARINE",
  CIVILIANS: "CIVILIAN",
  REVOLUTIONARY_ARMY: "UNDERWORLD",
};

export function relationshipStatus(value: number): string {
  if (value >= 60) return "Allied";
  if (value >= 25) return "Friendly";
  if (value >= 8) return "Warm";
  if (value > -8) return "Neutral";
  if (value > -25) return "Wary";
  if (value > -60) return "Hostile";
  return "Hunted";
}

export function influenceStatus(influence: number): FactionStatusLabel {
  if (influence <= 12) return "Collapsing";
  if (influence <= 28) return "Weak";
  if (influence <= 42) return "Recovering";
  if (influence <= 58) return "Stable";
  if (influence <= 72) return "Growing";
  if (influence <= 88) return "Powerful";
  return "Dominant";
}

export function influenceTrend(powerHistory: { day: number; influence: number }[]): FactionTrendLabel {
  if (powerHistory.length < 2) {
    return "Stable";
  }
  const recent = powerHistory.slice(-4);
  const delta = recent[recent.length - 1].influence - recent[0].influence;
  if (delta <= -10) return "Rapidly Falling";
  if (delta <= -3) return "Falling";
  if (delta >= 10) return "Rapidly Rising";
  if (delta >= 3) return "Rising";
  return "Stable";
}

export function knowledgeLabel(level: KnowledgeLevel): string {
  switch (level) {
    case "UNKNOWN":
      return "???";
    case "RUMORED":
      return "Rumored";
    case "KNOWN":
      return "Known";
    case "CONFIRMED":
      return "Confirmed";
  }
}

function pushNews(
  run: RunState,
  text: string,
  involvedFactions?: RelationFactionId[],
  importance = 1,
): void {
  const event: WorldHistoryEvent = {
    id: createId("news"),
    day: run.day,
    text,
    involvedFactions,
    importance,
  };
  run.world.history.push(event);
}

function row(run: RunState, factionId: RelationFactionId): FactionRelationship {
  let found = run.world.factions.find((item) => item.factionId === factionId);
  if (!found) {
    const def = getFaction(factionId);
    found = {
      factionId,
      value: def.startingValue,
      discovered: def.startingDiscovered,
      recentChanges: [],
    };
    run.world.factions.push(found);
  }
  return found;
}

function emptyPresence(overrides: Partial<RegionalInfluence> = {}): RegionalInfluence {
  return {
    eastBlue: 0,
    northBlue: 0,
    westBlue: 0,
    southBlue: 0,
    grandLine: 0,
    newWorld: 0,
    ...overrides,
  };
}

function makeCharacter(options: {
  id: string;
  name: string;
  relationFactionId: RelationFactionId;
  strength: number;
  bounty?: number;
  epithet?: string;
  rankTitle?: string;
  importance: number;
  knowledgeLevel: KnowledgeLevel;
  tags?: string[];
  alive?: boolean;
}): WorldCharacter {
  return {
    id: options.id,
    name: options.name,
    faction: NPC_FACTION_MAP[options.relationFactionId],
    raceId: "HUMAN",
    strength: options.strength,
    bounty: options.bounty ?? 0,
    devilFruitId: null,
    alive: options.alive ?? true,
    relationshipWithPlayer: 0,
    tags: ["faction_figure", ...(options.tags ?? [])],
    epithet: options.epithet,
    rankTitle: options.rankTitle,
    importance: options.importance,
    knowledgeLevel: options.knowledgeLevel,
    relationFactionId: options.relationFactionId,
  };
}

function history(dayPoints: Array<[number, number]>) {
  return dayPoints.map(([day, influence]) => ({ day, influence }));
}

function seedMarines(day: number): { state: FactionWorldState; characters: WorldCharacter[] } {
  const fleetAdmiral = makeCharacter({
    id: "fw_marine_fleet_admiral",
    name: "Harlan Voss",
    relationFactionId: "MARINES",
    strength: 18,
    epithet: "Iron Tide",
    rankTitle: "Fleet Admiral",
    importance: 95,
    knowledgeLevel: "CONFIRMED",
    tags: ["marine_leadership"],
  });
  const admiral = makeCharacter({
    id: "fw_marine_admiral_rhett",
    name: "Rhett Calder",
    relationFactionId: "MARINES",
    strength: 16,
    epithet: "Blue Guillotine",
    rankTitle: "Admiral",
    importance: 88,
    knowledgeLevel: "KNOWN",
    tags: ["marine_leadership"],
  });
  const vice = makeCharacter({
    id: "fw_marine_vice_mira",
    name: "Mira Holt",
    relationFactionId: "MARINES",
    strength: 13,
    rankTitle: "Vice Admiral",
    importance: 72,
    knowledgeLevel: "KNOWN",
  });
  const ghost = makeCharacter({
    id: "fw_marine_unknown_cipher",
    name: "Cipher Unit Lead",
    relationFactionId: "MARINES",
    strength: 14,
    rankTitle: "Intelligence Chief",
    importance: 80,
    knowledgeLevel: "UNKNOWN",
    tags: ["hidden"],
  });

  const events: FactionWorldEvent[] = [
    {
      id: createId("fe"),
      day: Math.max(1, day - 4),
      text: "Fleet Admiral Voss orders a sweep of East Blue smuggling lanes.",
      importance: 3,
      knowledgeLevel: "CONFIRMED",
    },
    {
      id: createId("fe"),
      day: Math.max(1, day - 2),
      text: "Admiral Calder sinks a pirate stronghold near the Calm Belt edge.",
      importance: 4,
      knowledgeLevel: "KNOWN",
    },
    {
      id: createId("fe"),
      day,
      text: "Marine recruitment posters appear in every major port.",
      importance: 2,
      knowledgeLevel: "CONFIRMED",
    },
  ];

  const shifts: FactionShift[] = [
    {
      id: createId("fs"),
      day: Math.max(1, day - 6),
      type: "PROMOTION",
      text: "Vice Admiral Holt elevated after the G-4 defense.",
      characterId: vice.id,
      knowledgeLevel: "KNOWN",
    },
    {
      id: createId("fs"),
      day: Math.max(1, day - 1),
      type: "EXPANSION",
      text: "A new branch opens on the Grand Line approach.",
      knowledgeLevel: "CONFIRMED",
    },
  ];

  const conflicts: ActiveConflict[] = [
    {
      id: createId("fc"),
      day: Math.max(1, day - 3),
      title: "Pirate purge in South Blue",
      againstFactionId: "PIRATES",
      region: "South Blue",
      intensity: 55,
      knowledgeLevel: "KNOWN",
    },
  ];

  const rumors: FactionRumor[] = [
    {
      id: createId("fr"),
      day: day,
      text: "Whispers say an Admiral will transfer to the New World soon.",
      reliability: "RUMORED",
    },
  ];

  return {
    characters: [fleetAdmiral, admiral, vice, ghost],
    state: {
      id: "MARINES",
      type: "MILITARY",
      influence: 62,
      discoveryState: "KNOWN",
      powerHistory: history([
        [Math.max(1, day - 8), 58],
        [Math.max(1, day - 5), 60],
        [Math.max(1, day - 2), 61],
        [day, 62],
      ]),
      leadership: [
        { role: "Fleet Admiral", characterId: fleetAdmiral.id, knowledgeLevel: "CONFIRMED" },
        { role: "Admiral", characterId: admiral.id, knowledgeLevel: "KNOWN" },
        { role: "Intelligence Chief", characterId: ghost.id, knowledgeLevel: "UNKNOWN" },
      ],
      majorFigures: [fleetAdmiral.id, admiral.id, vice.id],
      hierarchyCounts: [
        { role: "Admirals", filled: 2, capacity: 3 },
        { role: "Vice Admirals", filled: 11, capacity: 16 },
        { role: "Branch Captains", filled: 48, capacity: 60 },
      ],
      regionalInfluence: emptyPresence({
        eastBlue: 72,
        northBlue: 58,
        westBlue: 54,
        southBlue: 61,
        grandLine: 66,
        newWorld: 40,
      }),
      relationships: [
        { otherFactionId: "WORLD_GOVERNMENT", score: 78 },
        { otherFactionId: "PIRATES", score: -72 },
        { otherFactionId: "CIVILIANS", score: 35 },
        { otherFactionId: "REVOLUTIONARY_ARMY", score: -55 },
      ],
      shifts,
      conflicts,
      rumors,
      notableLosses: [
        {
          id: createId("fl"),
          day: Math.max(1, day - 12),
          nameHint: "Rear Admiral ???",
          role: "Rear Admiral",
          knowledgeLevel: "RUMORED",
        },
      ],
      events,
      lastUpdatedDay: day,
    },
  };
}

function seedPirates(day: number): { state: FactionWorldState; characters: WorldCharacter[] } {
  const yonko = makeCharacter({
    id: "fw_pirate_ember_queen",
    name: "Ashara Vale",
    relationFactionId: "PIRATES",
    strength: 19,
    bounty: 1_480_000_000,
    epithet: "Ember Queen",
    rankTitle: "Emperor",
    importance: 96,
    knowledgeLevel: "KNOWN",
    tags: ["pirate_emperor"],
  });
  const warlord = makeCharacter({
    id: "fw_pirate_two_coin",
    name: "Two-Coin Wren",
    relationFactionId: "PIRATES",
    strength: 14,
    bounty: 220_000_000,
    epithet: "Ledger Blade",
    rankTitle: "Warlord",
    importance: 78,
    knowledgeLevel: "CONFIRMED",
  });
  const rising = makeCharacter({
    id: "fw_pirate_nitro",
    name: "Nitro Vale",
    relationFactionId: "PIRATES",
    strength: 11,
    bounty: 48_000_000,
    epithet: "Powder Wake",
    rankTitle: "Captain",
    importance: 60,
    knowledgeLevel: "KNOWN",
  });
  const unknown = makeCharacter({
    id: "fw_pirate_shadow_broker",
    name: "Unknown Broker",
    relationFactionId: "PIRATES",
    strength: 12,
    bounty: 0,
    rankTitle: "Underworld Link",
    importance: 70,
    knowledgeLevel: "UNKNOWN",
  });

  return {
    characters: [yonko, warlord, rising, unknown],
    state: {
      id: "PIRATES",
      type: "CRIMINAL",
      influence: 48,
      discoveryState: "KNOWN",
      powerHistory: history([
        [Math.max(1, day - 8), 44],
        [Math.max(1, day - 5), 46],
        [Math.max(1, day - 2), 49],
        [day, 48],
      ]),
      leadership: [
        { role: "Emperor", characterId: yonko.id, knowledgeLevel: "KNOWN" },
        { role: "Warlord", characterId: warlord.id, knowledgeLevel: "CONFIRMED" },
        { role: "Shadow Broker", characterId: unknown.id, knowledgeLevel: "UNKNOWN" },
      ],
      majorFigures: [yonko.id, warlord.id, rising.id],
      hierarchyCounts: [
        { role: "Emperors", filled: 3, capacity: 4 },
        { role: "Warlords", filled: 5, capacity: 7 },
        { role: "Named Captains", filled: 120, capacity: 200 },
      ],
      regionalInfluence: emptyPresence({
        eastBlue: 38,
        northBlue: 42,
        westBlue: 51,
        southBlue: 47,
        grandLine: 68,
        newWorld: 74,
      }),
      relationships: [
        { otherFactionId: "MARINES", score: -70 },
        { otherFactionId: "WORLD_GOVERNMENT", score: -65 },
        { otherFactionId: "CIVILIANS", score: -20 },
        { otherFactionId: "REVOLUTIONARY_ARMY", score: 8 },
      ],
      shifts: [
        {
          id: createId("fs"),
          day: Math.max(1, day - 5),
          type: "POWER_SHIFT",
          text: "Ember Queen claims another New World island.",
          characterId: yonko.id,
          knowledgeLevel: "KNOWN",
        },
        {
          id: createId("fs"),
          day: Math.max(1, day - 1),
          type: "ALLIANCE",
          text: "Two crews swear a temporary non-aggression pact.",
          knowledgeLevel: "RUMORED",
        },
      ],
      conflicts: [
        {
          id: createId("fc"),
          day: Math.max(1, day - 2),
          title: "War for the Iron Current",
          againstFactionId: "MARINES",
          region: "Grand Line",
          intensity: 68,
          knowledgeLevel: "CONFIRMED",
        },
      ],
      rumors: [
        {
          id: createId("fr"),
          day,
          text: "A new Warlord seat may open if Wren disappears.",
          reliability: "RUMORED",
        },
        {
          id: createId("fr"),
          day: Math.max(1, day - 3),
          text: "Someone is buying Devil Fruits for an unnamed emperor.",
          reliability: "KNOWN",
        },
      ],
      notableLosses: [
        {
          id: createId("fl"),
          day: Math.max(1, day - 9),
          nameHint: "Captain Redwake",
          role: "Captain",
          knowledgeLevel: "CONFIRMED",
        },
      ],
      events: [
        {
          id: createId("fe"),
          day: Math.max(1, day - 4),
          text: "Bounty posters for Ember Queen are refreshed worldwide.",
          importance: 3,
          knowledgeLevel: "CONFIRMED",
        },
        {
          id: createId("fe"),
          day: Math.max(1, day - 1),
          text: "Powder Wake raids a Marine supply convoy.",
          importance: 3,
          knowledgeLevel: "KNOWN",
        },
        {
          id: createId("fe"),
          day,
          text: "Pirate flags thicken along the Grand Line approach.",
          importance: 2,
          knowledgeLevel: "CONFIRMED",
        },
      ],
      lastUpdatedDay: day,
    },
  };
}

function seedWorldGovernment(day: number): { state: FactionWorldState; characters: WorldCharacter[] } {
  const elder = makeCharacter({
    id: "fw_wg_elder_sable",
    name: "Elder Sable",
    relationFactionId: "WORLD_GOVERNMENT",
    strength: 20,
    epithet: "Silent Crown",
    rankTitle: "Elder",
    importance: 99,
    knowledgeLevel: "RUMORED",
    tags: ["wg_leadership"],
  });
  const agent = makeCharacter({
    id: "fw_wg_cipher_pol",
    name: "Agent Nine",
    relationFactionId: "WORLD_GOVERNMENT",
    strength: 15,
    rankTitle: "CP Director",
    importance: 85,
    knowledgeLevel: "KNOWN",
  });
  const envoy = makeCharacter({
    id: "fw_wg_envoy_lyn",
    name: "Envoy Lyn Marrow",
    relationFactionId: "WORLD_GOVERNMENT",
    strength: 9,
    rankTitle: "Celestial Envoy",
    importance: 70,
    knowledgeLevel: "CONFIRMED",
  });

  return {
    characters: [elder, agent, envoy],
    state: {
      id: "WORLD_GOVERNMENT",
      type: "GOVERNMENT",
      influence: 78,
      discoveryState: "KNOWN",
      powerHistory: history([
        [Math.max(1, day - 8), 74],
        [Math.max(1, day - 5), 76],
        [Math.max(1, day - 2), 77],
        [day, 78],
      ]),
      leadership: [
        { role: "Elder Council", characterId: elder.id, knowledgeLevel: "RUMORED" },
        { role: "CP Director", characterId: agent.id, knowledgeLevel: "KNOWN" },
        { role: "Celestial Envoy", characterId: envoy.id, knowledgeLevel: "CONFIRMED" },
      ],
      majorFigures: [elder.id, agent.id, envoy.id],
      hierarchyCounts: [
        { role: "Elders", filled: 5, capacity: 5 },
        { role: "CP Branches", filled: 8, capacity: 9 },
        { role: "Affiliated Kingdoms", filled: 160, capacity: 180 },
      ],
      regionalInfluence: emptyPresence({
        eastBlue: 70,
        northBlue: 74,
        westBlue: 72,
        southBlue: 68,
        grandLine: 80,
        newWorld: 62,
      }),
      relationships: [
        { otherFactionId: "MARINES", score: 82 },
        { otherFactionId: "PIRATES", score: -80 },
        { otherFactionId: "CIVILIANS", score: 10 },
        { otherFactionId: "REVOLUTIONARY_ARMY", score: -90 },
      ],
      shifts: [
        {
          id: createId("fs"),
          day: Math.max(1, day - 7),
          type: "IDEOLOGY_CHANGE",
          text: "Heavenly Tribute schedules are tightened.",
          knowledgeLevel: "CONFIRMED",
        },
        {
          id: createId("fs"),
          day: Math.max(1, day - 2),
          type: "EXPANSION",
          text: "A new Cipher Pol desk opens in West Blue.",
          knowledgeLevel: "KNOWN",
        },
      ],
      conflicts: [
        {
          id: createId("fc"),
          day: Math.max(1, day - 4),
          title: "Quiet war against resistance cells",
          againstFactionId: "REVOLUTIONARY_ARMY",
          region: "North Blue",
          intensity: 42,
          knowledgeLevel: "RUMORED",
        },
      ],
      rumors: [
        {
          id: createId("fr"),
          day,
          text: "An Elder has not been seen in public for weeks.",
          reliability: "RUMORED",
        },
      ],
      notableLosses: [],
      events: [
        {
          id: createId("fe"),
          day: Math.max(1, day - 5),
          text: "World Government seals another free port under 'security review'.",
          importance: 4,
          knowledgeLevel: "CONFIRMED",
        },
        {
          id: createId("fe"),
          day: Math.max(1, day - 2),
          text: "CP reports circulate about missing Devil Fruit cargo.",
          importance: 3,
          knowledgeLevel: "KNOWN",
        },
        {
          id: createId("fe"),
          day,
          text: "Affiliate kings renew oaths under heavier guard.",
          importance: 2,
          knowledgeLevel: "CONFIRMED",
        },
      ],
      lastUpdatedDay: day,
    },
  };
}

function seedCivilians(day: number): { state: FactionWorldState; characters: WorldCharacter[] } {
  const mayor = makeCharacter({
    id: "fw_civ_mayor_den",
    name: "Mayor Tessa Wren",
    relationFactionId: "CIVILIANS",
    strength: 3,
    rankTitle: "Port Mayor",
    importance: 65,
    knowledgeLevel: "CONFIRMED",
    tags: ["civilian_voice"],
  });
  const guild = makeCharacter({
    id: "fw_civ_guild_orin",
    name: "Orin Salt",
    relationFactionId: "CIVILIANS",
    strength: 4,
    epithet: "Harbor Voice",
    rankTitle: "Merchants' Guild Head",
    importance: 70,
    knowledgeLevel: "KNOWN",
  });
  const healer = makeCharacter({
    id: "fw_civ_healer_nala",
    name: "Nala Bright",
    relationFactionId: "CIVILIANS",
    strength: 2,
    rankTitle: "Clinic Elder",
    importance: 55,
    knowledgeLevel: "KNOWN",
  });

  return {
    characters: [mayor, guild, healer],
    state: {
      id: "CIVILIANS",
      type: "CIVILIAN",
      influence: 55,
      discoveryState: "KNOWN",
      powerHistory: history([
        [Math.max(1, day - 8), 57],
        [Math.max(1, day - 5), 56],
        [Math.max(1, day - 2), 54],
        [day, 55],
      ]),
      leadership: [
        { role: "Port Mayor", characterId: mayor.id, knowledgeLevel: "CONFIRMED" },
        { role: "Merchants' Guild", characterId: guild.id, knowledgeLevel: "KNOWN" },
        { role: "Clinic Elder", characterId: healer.id, knowledgeLevel: "KNOWN" },
      ],
      majorFigures: [mayor.id, guild.id, healer.id],
      regionalInfluence: emptyPresence({
        eastBlue: 80,
        northBlue: 62,
        westBlue: 58,
        southBlue: 64,
        grandLine: 40,
        newWorld: 22,
      }),
      relationships: [
        { otherFactionId: "MARINES", score: 30 },
        { otherFactionId: "PIRATES", score: -25 },
        { otherFactionId: "WORLD_GOVERNMENT", score: 5 },
        { otherFactionId: "REVOLUTIONARY_ARMY", score: 12 },
      ],
      shifts: [
        {
          id: createId("fs"),
          day: Math.max(1, day - 3),
          type: "DECLINE",
          text: "Trade caravans thin after tribute increases.",
          knowledgeLevel: "CONFIRMED",
        },
      ],
      conflicts: [
        {
          id: createId("fc"),
          day: Math.max(1, day - 1),
          title: "Port unrest over grain prices",
          region: "East Blue",
          intensity: 28,
          knowledgeLevel: "CONFIRMED",
        },
      ],
      rumors: [
        {
          id: createId("fr"),
          day,
          text: "Fishermen swear a resistance ship took refugees after dark.",
          reliability: "RUMORED",
        },
      ],
      notableLosses: [
        {
          id: createId("fl"),
          day: Math.max(1, day - 6),
          nameHint: "Harbor clerk ???",
          role: "Clerk",
          knowledgeLevel: "UNKNOWN",
        },
      ],
      events: [
        {
          id: createId("fe"),
          day: Math.max(1, day - 4),
          text: "Markets reopen under Marine watch.",
          importance: 2,
          knowledgeLevel: "CONFIRMED",
        },
        {
          id: createId("fe"),
          day: Math.max(1, day - 2),
          text: "Clinic Elder Bright treats wounded after a dock fight.",
          importance: 2,
          knowledgeLevel: "KNOWN",
        },
        {
          id: createId("fe"),
          day,
          text: "Civilian morale steadies as grain ships arrive.",
          importance: 3,
          knowledgeLevel: "CONFIRMED",
        },
      ],
      lastUpdatedDay: day,
      stability: 52,
      morale: 48,
    },
  };
}

function seedRevolutionaries(day: number): { state: FactionWorldState; characters: WorldCharacter[] } {
  const chief = makeCharacter({
    id: "fw_rev_chief_kael",
    name: "Kael Drift",
    relationFactionId: "REVOLUTIONARY_ARMY",
    strength: 17,
    epithet: "Broken Chain",
    rankTitle: "Army Chief",
    importance: 94,
    knowledgeLevel: "UNKNOWN",
    tags: ["revolutionary_leadership"],
  });
  const cell = makeCharacter({
    id: "fw_rev_cell_siri",
    name: "Siri Ash",
    relationFactionId: "REVOLUTIONARY_ARMY",
    strength: 12,
    rankTitle: "Cell Commander",
    importance: 75,
    knowledgeLevel: "RUMORED",
  });
  const quartermaster = makeCharacter({
    id: "fw_rev_qm_boro",
    name: "Boro Quill",
    relationFactionId: "REVOLUTIONARY_ARMY",
    strength: 8,
    rankTitle: "Quartermaster",
    importance: 60,
    knowledgeLevel: "UNKNOWN",
  });

  return {
    characters: [chief, cell, quartermaster],
    state: {
      id: "REVOLUTIONARY_ARMY",
      type: "REVOLUTIONARY",
      influence: 22,
      discoveryState: "UNKNOWN",
      powerHistory: history([
        [Math.max(1, day - 8), 16],
        [Math.max(1, day - 5), 18],
        [Math.max(1, day - 2), 20],
        [day, 22],
      ]),
      leadership: [
        { role: "Army Chief", characterId: chief.id, knowledgeLevel: "UNKNOWN" },
        { role: "Cell Commander", characterId: cell.id, knowledgeLevel: "RUMORED" },
        { role: "Quartermaster", characterId: quartermaster.id, knowledgeLevel: "UNKNOWN" },
      ],
      majorFigures: [chief.id, cell.id],
      hierarchyCounts: [
        { role: "Commanders", filled: 4, capacity: 8 },
        { role: "Active Cells", filled: 14, capacity: 30 },
      ],
      regionalInfluence: emptyPresence({
        eastBlue: 12,
        northBlue: 28,
        westBlue: 18,
        southBlue: 15,
        grandLine: 24,
        newWorld: 20,
      }),
      relationships: [
        { otherFactionId: "WORLD_GOVERNMENT", score: -88 },
        { otherFactionId: "MARINES", score: -60 },
        { otherFactionId: "PIRATES", score: 10 },
        { otherFactionId: "CIVILIANS", score: 35 },
      ],
      shifts: [
        {
          id: createId("fs"),
          day: Math.max(1, day - 4),
          type: "EXPANSION",
          text: "A new cell is rumored in North Blue.",
          knowledgeLevel: "RUMORED",
        },
      ],
      conflicts: [
        {
          id: createId("fc"),
          day: Math.max(1, day - 3),
          title: "Shadow campaign against tribute routes",
          againstFactionId: "WORLD_GOVERNMENT",
          region: "North Blue",
          intensity: 35,
          knowledgeLevel: "RUMORED",
        },
      ],
      rumors: [
        {
          id: createId("fr"),
          day,
          text: "Someone calling themselves Broken Chain left pamphlets in three ports.",
          reliability: "RUMORED",
        },
        {
          id: createId("fr"),
          day: Math.max(1, day - 2),
          text: "An unknown army may be gathering deserters.",
          reliability: "RUMORED",
        },
      ],
      notableLosses: [],
      events: [
        {
          id: createId("fe"),
          day: Math.max(1, day - 5),
          text: "Cipher Pol denies organized resistance exists.",
          importance: 2,
          knowledgeLevel: "CONFIRMED",
        },
        {
          id: createId("fe"),
          day: Math.max(1, day - 1),
          text: "A tribute barge vanishes without survivors.",
          importance: 3,
          knowledgeLevel: "RUMORED",
        },
      ],
      lastUpdatedDay: day,
    },
  };
}

function seedBundle(day: number): { states: FactionWorldState[]; characters: WorldCharacter[] } {
  const packs = [
    seedMarines(day),
    seedPirates(day),
    seedWorldGovernment(day),
    seedCivilians(day),
    seedRevolutionaries(day),
  ];
  return {
    states: packs.map((pack) => pack.state),
    characters: packs.flatMap((pack) => pack.characters),
  };
}

function ensureFactionWorldArray(run: RunState): FactionWorldState[] {
  if (!Array.isArray(run.world.factionWorld)) {
    run.world.factionWorld = [];
  }
  return run.world.factionWorld;
}

function worldRow(run: RunState, factionId: RelationFactionId): FactionWorldState {
  FactionService.ensureFactionWorld(run);
  const found = run.world.factionWorld.find((item) => item.id === factionId);
  if (!found) {
    throw new Error(`Missing faction world state: ${factionId}`);
  }
  return found;
}

function pushPowerPoint(state: FactionWorldState, day: number): void {
  const last = state.powerHistory[state.powerHistory.length - 1];
  if (last && last.day === day) {
    last.influence = state.influence;
    return;
  }
  state.powerHistory = [...state.powerHistory, { day, influence: state.influence }].slice(-24);
}

export const FactionService = {
  initialRelationships(): FactionRelationship[] {
    return FACTIONS.map((faction) => ({
      factionId: faction.id,
      value: faction.startingValue,
      discovered: faction.startingDiscovered,
      recentChanges: [],
    }));
  },

  seedFactionWorld(day = 1): { factionWorld: FactionWorldState[]; characters: WorldCharacter[] } {
    const seeded = seedBundle(day);
    return { factionWorld: seeded.states, characters: seeded.characters };
  },

  ensureFactionWorld(run: RunState): void {
    const list = ensureFactionWorldArray(run);
    if (list.length >= FACTIONS.length) {
      for (const rel of run.world.factions) {
        const world = list.find((item) => item.id === rel.factionId);
        if (!world) {
          continue;
        }
        if (rel.discovered && (world.discoveryState === "UNKNOWN" || world.discoveryState === "RUMORED")) {
          world.discoveryState = "DISCOVERED";
        }
      }
      return;
    }

    const seeded = this.seedFactionWorld(run.day || run.world.day || 1);
    for (const state of seeded.factionWorld) {
      if (!list.some((item) => item.id === state.id)) {
        list.push(state);
      }
    }
    for (const character of seeded.characters) {
      if (!run.world.characters.some((item) => item.id === character.id)) {
        run.world.characters.push(character);
      }
    }
    for (const rel of run.world.factions) {
      const world = list.find((item) => item.id === rel.factionId);
      if (!world) {
        continue;
      }
      if (rel.discovered) {
        world.discoveryState = world.discoveryState === "UNKNOWN" ? "DISCOVERED" : world.discoveryState;
        if (rel.factionId === "REVOLUTIONARY_ARMY") {
          world.discoveryState = "DISCOVERED";
        }
      }
    }
  },

  getWorldState(run: RunState, factionId: RelationFactionId): FactionWorldState {
    return worldRow(run, factionId);
  },

  getCharacter(run: RunState, characterId: string | null | undefined): WorldCharacter | undefined {
    if (!characterId) {
      return undefined;
    }
    return run.world.characters.find((item) => item.id === characterId);
  },

  getMajorFigures(run: RunState, factionId: RelationFactionId): WorldCharacter[] {
    const state = worldRow(run, factionId);
    return state.majorFigures
      .map((id) => this.getCharacter(run, id))
      .filter((item): item is WorldCharacter => Boolean(item));
  },

  getFactionEvents(run: RunState, factionId: RelationFactionId): FactionWorldEvent[] {
    const state = worldRow(run, factionId);
    const fromWorld = run.world.history
      .filter((event) => event.involvedFactions?.includes(factionId))
      .map(
        (event): FactionWorldEvent => ({
          id: event.id,
          day: event.day,
          text: event.text,
          importance: event.importance ?? 1,
          knowledgeLevel: "CONFIRMED",
        }),
      );
    return [...state.events, ...fromWorld].sort((a, b) => b.day - a.day || b.importance - a.importance);
  },

  modifyRelationship(
    run: RunState,
    factionId: RelationFactionId,
    amount: number,
    reason: string,
  ): void {
    const rel = row(run, factionId);
    if (!rel.discovered && factionId === "REVOLUTIONARY_ARMY") {
      return;
    }
    const change: FactionRelationChange = {
      amount,
      reason,
      day: run.day,
      at: nowIso(),
    };
    rel.value = clamp(rel.value + amount, -100, 100);
    rel.recentChanges = [...rel.recentChanges, change].slice(-8);
  },

  modifyInfluence(run: RunState, factionId: RelationFactionId, amount: number, reason?: string): void {
    const state = worldRow(run, factionId);
    state.influence = clamp(state.influence + amount, 0, 100);
    state.lastUpdatedDay = run.day;
    pushPowerPoint(state, run.day);
    if (reason) {
      const event: FactionWorldEvent = {
        id: createId("fe"),
        day: run.day,
        text: reason,
        importance: 2,
        knowledgeLevel: "CONFIRMED",
      };
      state.events = [...state.events, event].slice(-20);
    }
  },

  addShift(run: RunState, factionId: RelationFactionId, shift: Omit<FactionShift, "id">): void {
    const state = worldRow(run, factionId);
    state.shifts = [{ ...shift, id: createId("fs") }, ...state.shifts].slice(0, 20);
    state.lastUpdatedDay = run.day;
  },

  addRumor(run: RunState, factionId: RelationFactionId, text: string, reliability: KnowledgeLevel = "RUMORED"): void {
    const state = worldRow(run, factionId);
    state.rumors = [
      { id: createId("fr"), day: run.day, text, reliability },
      ...state.rumors,
    ].slice(0, 12);
    state.lastUpdatedDay = run.day;
  },

  addFactionEvent(
    run: RunState,
    factionId: RelationFactionId,
    text: string,
    importance = 2,
    knowledgeLevel: KnowledgeLevel = "KNOWN",
  ): void {
    const state = worldRow(run, factionId);
    state.events = [
      ...state.events,
      { id: createId("fe"), day: run.day, text, importance, knowledgeLevel },
    ].slice(-20);
    state.lastUpdatedDay = run.day;
    pushNews(run, text, [factionId], importance);
  },

  getRelationship(run: RunState, factionId: RelationFactionId): FactionRelationship {
    return row(run, factionId);
  },

  getRelationshipStatus(run: RunState, factionId: RelationFactionId): string {
    return relationshipStatus(row(run, factionId).value);
  },

  getRecentChanges(run: RunState, factionId: RelationFactionId): FactionRelationChange[] {
    return [...row(run, factionId).recentChanges].reverse();
  },

  isFactionDiscovered(run: RunState, factionId: RelationFactionId): boolean {
    return row(run, factionId).discovered;
  },

  discoverFaction(run: RunState, factionId: RelationFactionId): boolean {
    const rel = row(run, factionId);
    if (rel.discovered) {
      return false;
    }
    rel.discovered = true;
    this.ensureFactionWorld(run);
    const world = worldRow(run, factionId);
    world.discoveryState = "DISCOVERED";
    world.lastUpdatedDay = run.day;
    return true;
  },

  checkRevolutionaryEmergence(profile: ProfileSave): boolean {
    const run = profile.activeRun;
    if (!run) {
      return false;
    }
    this.ensureFactionWorld(run);
    const rel = row(run, "REVOLUTIONARY_ARMY");
    if (rel.discovered) {
      return false;
    }
    const power = run.world.worldPower;
    const world = worldRow(run, "REVOLUTIONARY_ARMY");
    if (
      power.worldGovernmentPower >= REVEAL_WG &&
      power.oppression >= REVEAL_OPPRESSION &&
      power.revolutionaryActivity >= REVEAL_ACTIVITY
    ) {
      rel.discovered = true;
      world.discoveryState = "DISCOVERED";
      world.lastUpdatedDay = run.day;
      run.world.flags = run.world.flags.includes("revolutionary_revealed")
        ? run.world.flags
        : [...run.world.flags, "revolutionary_revealed"];
      run.runFlags = run.runFlags.includes("revolutionary_revealed")
        ? run.runFlags
        : [...run.runFlags, "revolutionary_revealed"];
      pushNews(
        run,
        "NEW FACTION DISCOVERED — Revolutionary Army. Whispers of organized resistance are no longer whispers.",
        ["REVOLUTIONARY_ARMY"],
        5,
      );
      const rev = worldRow(run, "REVOLUTIONARY_ARMY");
      const revealEvent: FactionWorldEvent = {
        id: createId("fe"),
        day: run.day,
        text: "The Revolutionary Army steps from rumor into daylight.",
        importance: 5,
        knowledgeLevel: "CONFIRMED",
      };
      rev.events = [...rev.events, revealEvent].slice(-20);
      return true;
    }
    if (
      power.worldGovernmentPower >= REVEAL_WG - 8 &&
      power.oppression >= REVEAL_OPPRESSION - 10 &&
      !run.world.flags.includes("resistance_whispers")
    ) {
      run.world.flags.push("resistance_whispers");
      world.discoveryState = "RUMORED";
      this.addRumor(
        run,
        "REVOLUTIONARY_ARMY",
        "Whispers of organized resistance are spreading across the seas...",
      );
      pushNews(run, "Whispers of organized resistance are spreading across the seas...", [
        "REVOLUTIONARY_ARMY",
      ]);
    }
    return false;
  },

  syncFromWorldSimulation(
    run: RunState,
    deltas: Partial<Record<RelationFactionId, number>>,
    news?: string,
  ): void {
    this.ensureFactionWorld(run);
    for (const [factionId, amount] of Object.entries(deltas) as Array<[RelationFactionId, number]>) {
      if (!amount) {
        continue;
      }
      this.modifyInfluence(run, factionId, amount);
    }
    if (news) {
      pushNews(run, news, Object.keys(deltas) as RelationFactionId[], 2);
    }
  },
};
