import type {
  NarrativeArchetype,
  RelationFactionId,
  StoryThreadStageDefinition,
  StoryThreadType,
} from "../models/types";

export interface StoryThreadTemplate {
  id: string;
  type: StoryThreadType;
  title: string;
  maxStage: number;
  tags: string[];
  cooldownDays: number;
  involvedFactionIds?: RelationFactionId[];
  archetypes?: NarrativeArchetype[];
  stages?: StoryThreadStageDefinition[];
}

export const STORY_THREAD_TEMPLATES: StoryThreadTemplate[] = [
  {
    id: "red_fang_rivalry",
    type: "MAJOR",
    title: "The Red Fang Pirates",
    maxStage: 4,
    tags: ["rivalry", "pirates", "east_blue"],
    cooldownDays: 15,
    involvedFactionIds: ["PIRATES"],
    archetypes: ["rivalry", "revenge"],
    stages: [
      { kind: "HOOK", label: "A Red Fang scar crosses your path.", encounterTags: ["rivalry", "pirates"] },
      { kind: "DEVELOPMENT", label: "Their captain learns your name.", encounterTags: ["rivalry"] },
      { kind: "ESCALATION", label: "The feud draws blood.", encounterTags: ["rivalry", "combat"] },
      { kind: "CLIMAX", label: "Red Fang demands a reckoning.", encounterIds: ["red_fang_showdown"] },
    ],
  },
  {
    id: "bounty_hunter_milo",
    type: "MINOR",
    title: "Bounty Hunter Milo",
    maxStage: 3,
    tags: ["bounty_hunter", "pursuit"],
    cooldownDays: 10,
    archetypes: ["bounty_pursuit", "rivalry"],
    stages: [
      { kind: "HOOK", label: "Milo clocks your face against a poster.", encounterTags: ["bounty_hunter"] },
      {
        kind: "DEVELOPMENT",
        label: "A memory-tinged reunion — or a trap.",
        encounterTags: ["bounty_hunter", "dialogue"],
        encounterIds: ["milo_memory_reunion"],
      },
      { kind: "CLIMAX", label: "Milo chooses coin or conscience.", encounterTags: ["bounty_hunter"] },
    ],
  },
  {
    id: "fleet_captain_hook",
    type: "MINOR",
    title: "Fleet Captain's Report",
    maxStage: 2,
    tags: ["fleet", "captain"],
    cooldownDays: 8,
    archetypes: ["ship_conflict"],
  },
  {
    id: "fishman_exception",
    type: "MINOR",
    title: "An Exceptional Fish-Man",
    maxStage: 3,
    tags: ["fish_man", "recruitment"],
    cooldownDays: 12,
    archetypes: ["recruitment", "friendship"],
  },
  {
    id: "merged_threads",
    type: "MINOR",
    title: "Entangled Fates",
    maxStage: 4,
    tags: ["merged"],
    cooldownDays: 20,
    archetypes: ["mystery"],
    stages: [
      { kind: "COMPLICATION", label: "Two plots knot together." },
      { kind: "ESCALATION", label: "Shared enemies close in." },
      { kind: "CLIMAX", label: "One choice cuts both threads." },
      { kind: "AFTERMATH", label: "The seas remember the merge." },
    ],
  },
  {
    id: "cipher_pol_attachment",
    type: "MINOR",
    title: "Cipher Pol Attachment",
    maxStage: 3,
    tags: ["cipher_pol", "undercover"],
    cooldownDays: 14,
    involvedFactionIds: ["WORLD_GOVERNMENT"],
    archetypes: ["undercover_mission", "secret_organization"],
    stages: [
      { kind: "HOOK", label: "A handler assigns your partner.", encounterIds: ["cipher_pol_partner_briefing"] },
      { kind: "INVESTIGATION", label: "Silent work under gray badges.", encounterTags: ["cipher_pol"] },
      { kind: "CLIMAX", label: "The attachment ends — or deepens.", encounterTags: ["cipher_pol"] },
    ],
  },
  {
    id: "celestial_privilege_fracture",
    type: "MAJOR",
    title: "Cracks in Heaven",
    maxStage: 4,
    tags: ["celestial", "privilege"],
    cooldownDays: 25,
    involvedFactionIds: ["WORLD_GOVERNMENT"],
    archetypes: ["moral_dilemma", "hidden_lineage"],
    stages: [
      { kind: "HOOK", label: "A slave's eyes meet yours.", encounterIds: ["celestial_slave_gaze"] },
      { kind: "DEVELOPMENT", label: "Privilege or conscience.", encounterTags: ["celestial"] },
      { kind: "CLIMAX", label: "Heaven's protection wavers.", encounterTags: ["celestial"] },
      { kind: "AFTERMATH", label: "Exile — or deeper cruelty.", encounterTags: ["celestial"] },
    ],
  },
];

export function getStoryThreadTemplate(id: string): StoryThreadTemplate | undefined {
  return STORY_THREAD_TEMPLATES.find((template) => template.id === id);
}
