import type { QuestArchetype } from "../models/types";

/** Structural templates for the Quest Director — not prewritten quests. */
export const QUEST_ARCHETYPES: QuestArchetype[] = [
  { id: "missing_person", label: "Missing Person", tags: ["isolated", "investigation", "npc"], size: "standard" },
  { id: "stolen_item", label: "Stolen Item", tags: ["commercial", "cargo", "public"], size: "standard" },
  { id: "escort", label: "Escort", tags: ["coastal", "ships", "crowded"], size: "standard" },
  { id: "investigation", label: "Investigation", tags: ["documents", "official", "public"], size: "standard" },
  { id: "bounty_hunt", label: "Bounty Hunt", tags: ["ambush-compatible", "faction-visible"], size: "standard" },
  { id: "rescue", label: "Rescue", tags: ["restricted", "guards"], size: "standard" },
  { id: "faction_conflict", label: "Faction Conflict", tags: ["faction-controlled", "public"], size: "chain" },
  { id: "sabotage", label: "Sabotage", tags: ["restricted", "high-security"], size: "standard" },
  { id: "smuggling", label: "Smuggling", tags: ["cargo", "ships", "coastal"], size: "standard" },
  { id: "treasure_hunt", label: "Treasure Hunt", tags: ["natural", "isolated"], size: "standard" },
  { id: "lost_heirloom", label: "Lost Heirloom", tags: ["npc", "investigation"], size: "small" },
  { id: "protect_location", label: "Protect Location", tags: ["public", "faction-visible"], size: "standard" },
  { id: "recover_cargo", label: "Recover Cargo", tags: ["cargo", "ships", "coastal"], size: "standard" },
  { id: "recruitment_test", label: "Recruitment Test", tags: ["crowded", "public"], size: "small" },
  { id: "companion_request", label: "Companion Request", tags: ["npc"], size: "small" },
  { id: "rival_challenge", label: "Rival Challenge", tags: ["public"], size: "small" },
  { id: "moral_conflict", label: "Moral Conflict", tags: ["crowded", "official"], size: "standard" },
  { id: "legacy_discovery", label: "Legacy Discovery", tags: ["historical", "documents"], size: "chain" },
  { id: "historical_investigation", label: "Historical Investigation", tags: ["documents", "official"], size: "standard" },
  { id: "prisoner_rescue", label: "Prisoner Rescue", tags: ["restricted", "guards"], size: "chain" },
  { id: "infiltration", label: "Infiltration", tags: ["high-security", "restricted"], size: "standard" },
  { id: "supply_shortage", label: "Supply Shortage", tags: ["commercial", "cargo", "crowded"], size: "standard" },
  { id: "local_dispute", label: "Local Dispute", tags: ["public", "crowded"], size: "small" },
  { id: "monster_hunt", label: "Monster Hunt", tags: ["wildlife", "natural", "isolated"], size: "standard" },
  { id: "debt_favor", label: "Debt / Favor", tags: ["npc", "commercial"], size: "small" },
  { id: "family_matter", label: "Family Matter", tags: ["npc"], size: "standard" },
  { id: "shipwreck_investigation", label: "Shipwreck Investigation", tags: ["coastal", "ships", "cargo"], size: "standard" },
];

export const DEFAULT_GENERATED_QUEST_CAPACITY = 3;
