/** Deterministic name → tag inference. Creator only names the zone/anchor. */

const KEYWORDS: Array<{ match: RegExp; tags: string[] }> = [
  { match: /harbor|dock|wharf|pier|port/i, tags: ["coastal", "ships", "cargo", "trade", "workers", "commercial", "faction-visible"] },
  { match: /marsh|swamp|wetland|bog/i, tags: ["wetland", "vegetation", "medicinal plants", "poison plants", "isolated", "difficult terrain", "fungi"] },
  { match: /ashen|ridge|volcan|lava|obsidian|crater/i, tags: ["rocky", "volcanic", "mineral-rich", "low vegetation", "hazardous"] },
  { match: /forest|wood|grove|thicket/i, tags: ["woodland", "isolated", "wildlife", "vegetation", "ambush-compatible", "natural"] },
  { match: /alley|backstreet|slum/i, tags: ["hidden", "urban", "low traffic", "criminal activity", "ambush-compatible"] },
  { match: /shore|coast|beach|strand/i, tags: ["coastal", "exposed", "wreckage-compatible", "fishing-compatible"] },
  { match: /path|road|trail/i, tags: ["travel", "ambush", "isolated"] },
  { match: /clearing|glade/i, tags: ["woodland", "open", "wildlife"] },
  { match: /market|bazaar|plaza/i, tags: ["commercial", "crowded", "public", "cargo", "trade"] },
  { match: /clinic|hospital|infirm/i, tags: ["medical", "public", "civilian"] },
  { match: /inn|tavern|bar/i, tags: ["crowded", "npc", "public"] },
  { match: /mine|quarry|cave/i, tags: ["rocky", "mineral-rich", "isolated", "hazardous"] },
  { match: /field|farm|orchard/i, tags: ["vegetation", "food", "civilian", "open"] },
  { match: /ruin|wreck|shipwreck/i, tags: ["wreckage-compatible", "historical", "isolated"] },
  { match: /watch|tower|fort|outpost/i, tags: ["strategic", "faction-visible", "guards"] },
  { match: /rocky|stone|cliff/i, tags: ["rocky", "exposed"] },
];

export function inferSemanticTags(name: string): string[] {
  const text = name.trim();
  if (!text) {
    return ["public"];
  }
  const tags = new Set<string>();
  for (const row of KEYWORDS) {
    if (row.match.test(text)) {
      for (const tag of row.tags) {
        tags.add(tag);
      }
    }
  }
  if (tags.size === 0) {
    tags.add("public");
    tags.add("natural");
  }
  return [...tags];
}

export const FACILITY_SEMANTIC_TAGS: Record<string, string[]> = {
  MARKET: ["commercial", "public", "crowded", "cargo", "trade"],
  HARBOR: ["coastal", "ships", "cargo", "public", "faction-visible", "trade"],
  INN: ["npc", "crowded", "public"],
  CLINIC: ["medical", "civilian", "public"],
  TRAINING_GROUNDS: ["public", "crowded"],
  TASK_BOARD: ["public", "official", "faction-visible"],
  LIBRARY: ["documents", "official", "historical"],
  SHIPYARD: ["ships", "cargo", "workers"],
  FISHING: ["coastal", "fishing-compatible", "cargo"],
  GATHER: ["natural", "vegetation", "isolated"],
  EXPLORE: ["isolated", "natural"],
};

export const ARCHETYPE_START_FACILITIES: Record<string, string[]> = {
  stolen_item: ["MARKET", "HARBOR"],
  lost_heirloom: ["MARKET", "INN"],
  supply_shortage: ["MARKET", "HARBOR"],
  local_dispute: ["MARKET", "INN"],
  debt_favor: ["MARKET", "INN"],
  escort: ["HARBOR", "INN"],
  smuggling: ["HARBOR", "MARKET"],
  recover_cargo: ["HARBOR", "MARKET"],
  shipwreck_investigation: ["HARBOR", "FISHING"],
  missing_person: ["INN", "MARKET"],
  family_matter: ["INN", "MARKET"],
  companion_request: ["INN", "TRAINING_GROUNDS"],
  rescue: ["CLINIC", "INN"],
  prisoner_rescue: ["INN", "HARBOR"],
  infiltration: ["HARBOR", "MARKET"],
  protect_location: ["MARKET", "HARBOR", "CLINIC"],
  faction_conflict: ["MARKET", "HARBOR"],
  bounty_hunt: ["TASK_BOARD", "TRAINING_GROUNDS", "MARKET"],
  rival_challenge: ["TRAINING_GROUNDS", "MARKET"],
  treasure_hunt: ["GATHER", "EXPLORE", "HARBOR"],
  monster_hunt: ["GATHER", "EXPLORE", "TRAINING_GROUNDS"],
  investigation: ["LIBRARY", "TASK_BOARD", "MARKET"],
  historical_investigation: ["LIBRARY", "MARKET"],
  legacy_discovery: ["LIBRARY", "INN"],
  recruitment_test: ["TRAINING_GROUNDS", "HARBOR"],
  moral_conflict: ["MARKET", "INN"],
  sabotage: ["HARBOR", "SHIPYARD"],
};
