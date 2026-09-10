export const PIRATE_NAMES = [
  "Rook Danner",
  "Kaba Fuse",
  "Nitro Vale",
  "Cinder Brix",
  "Pakk Redwake",
  "Jori Gale",
];

export const MARINE_NAMES = [
  "Lieutenant Calden",
  "Commander Voss",
  "Ensign Rhea",
  "Captain Holt",
];

export const UNDERWORLD_NAMES = [
  "Whisper Kade",
  "Madam Silk",
  "Gray Ledger",
  "Two-Coin Wren",
];

export const STARTING_NPCS = [
  {
    id: "npc_captain_rourke",
    name: "Captain Rourke",
    faction: "MARINE" as const,
    strength: 8,
    bounty: 0,
    devilFruitId: null,
    alive: true,
    relationshipWithPlayer: 0,
    tags: ["marine_officer"],
  },
  {
    id: "npc_old_den",
    name: "Old Man Den",
    faction: "CIVILIAN" as const,
    strength: 1,
    bounty: 0,
    devilFruitId: null,
    alive: true,
    relationshipWithPlayer: 0,
    tags: ["harbor_gossip"],
  },
  {
    id: "npc_whisper_kade",
    name: "Whisper Kade",
    faction: "UNDERWORLD" as const,
    strength: 4,
    bounty: 1200,
    devilFruitId: null,
    alive: true,
    relationshipWithPlayer: 0,
    tags: ["broker"],
  },
];
