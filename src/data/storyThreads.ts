import type { StoryThreadType } from "../models/types";

export interface StoryThreadTemplate {
  id: string;
  type: StoryThreadType;
  title: string;
  maxStage: number;
  tags: string[];
  cooldownDays: number;
  involvedFactionIds?: Array<"MARINES" | "PIRATES" | "WORLD_GOVERNMENT" | "CIVILIANS" | "REVOLUTIONARY_ARMY">;
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
  },
  {
    id: "bounty_hunter_milo",
    type: "MINOR",
    title: "Bounty Hunter Milo",
    maxStage: 3,
    tags: ["bounty_hunter", "pursuit"],
    cooldownDays: 10,
  },
  {
    id: "fleet_captain_hook",
    type: "MINOR",
    title: "Fleet Captain's Report",
    maxStage: 2,
    tags: ["fleet", "captain"],
    cooldownDays: 8,
  },
  {
    id: "fishman_exception",
    type: "MINOR",
    title: "An Exceptional Fish-Man",
    maxStage: 3,
    tags: ["fish_man", "recruitment"],
    cooldownDays: 12,
  },
];

export function getStoryThreadTemplate(id: string): StoryThreadTemplate | undefined {
  return STORY_THREAD_TEMPLATES.find((template) => template.id === id);
}
