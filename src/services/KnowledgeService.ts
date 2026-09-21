import type {
  KnowledgeCategory,
  KnowledgeStage,
  ProfileSave,
  RunKnowledgeEntry,
  RunState,
} from "../models/types";

export type KnowledgeCollectableDef = {
  id: string;
  name: string;
  description: string;
  subjectId: string;
  category: KnowledgeCategory;
  stageGranted: KnowledgeStage;
  label: string;
};

export const KNOWLEDGE_COLLECTABLES: KnowledgeCollectableDef[] = [
  {
    id: "ancient_gear_diagram",
    name: "Ancient Gear Diagram",
    description: "A brittle page mapping gear teeth and release rings.",
    subjectId: "ancient_gear_system",
    category: "MYSTERIES",
    stageGranted: "FAMILIAR",
    label: "Ancient Gear System",
  },
  {
    id: "marine_field_manual",
    name: "Marine Field Manual",
    description: "Formation notes and rifleman drills.",
    subjectId: "marine_formations",
    category: "COMBAT",
    stageGranted: "LIMITED",
    label: "Marine Formations",
  },
  {
    id: "ancient_navigation_journal",
    name: "Ancient Navigation Journal",
    description: "A sailor's log of a hidden current.",
    subjectId: "hidden_current",
    category: "NAVIGATION",
    stageGranted: "FAMILIAR",
    label: "Hidden Current",
  },
  {
    id: "wanted_poster_scrap",
    name: "Wanted Poster Scrap",
    description: "Half a face and a bounty number that still means something.",
    subjectId: "bounty_board_codes",
    category: "FACTIONS",
    stageGranted: "RUMORED",
    label: "Bounty Board Codes",
  },
  {
    id: "coral_charm",
    name: "Coral Charm",
    description: "A fish-man keepsake that warms conversation under the waves.",
    subjectId: "fishman_customs",
    category: "RACES",
    stageGranted: "LIMITED",
    label: "Fish-Man Customs",
  },
  {
    id: "old_bounty_ledger",
    name: "Old Bounty Ledger",
    description: "Names crossed out in three different inks.",
    subjectId: "hunter_networks",
    category: "FACTIONS",
    stageGranted: "FAMILIAR",
    label: "Hunter Networks",
  },
];

export function getKnowledgeCollectable(id: string): KnowledgeCollectableDef | undefined {
  return KNOWLEDGE_COLLECTABLES.find((entry) => entry.id === id);
}

function stageRank(stage: KnowledgeStage): number {
  const order: KnowledgeStage[] = [
    "UNKNOWN",
    "RUMORED",
    "LIMITED",
    "FAMILIAR",
    "WELL_KNOWN",
    "EXPERT",
  ];
  return order.indexOf(stage);
}

export const KnowledgeService = {
  ensure(run: RunState): void {
    if (!run.runKnowledge) {
      run.runKnowledge = [];
    }
  },

  get(run: RunState, subjectId: string): RunKnowledgeEntry | null {
    this.ensure(run);
    return run.runKnowledge!.find((entry) => entry.subjectId === subjectId) ?? null;
  },

  hasAtLeast(run: RunState, subjectId: string, stage: KnowledgeStage): boolean {
    const entry = this.get(run, subjectId);
    if (!entry) {
      return false;
    }
    return stageRank(entry.stage) >= stageRank(stage);
  },

  grantFromCollectable(run: RunState, profile: ProfileSave | null, collectableId: string): string {
    this.ensure(run);
    const def = getKnowledgeCollectable(collectableId);
    if (!def) {
      return "Unknown knowledge collectable.";
    }
    if (profile) {
      if (!profile.collection.knowledge) {
        profile.collection.knowledge = [];
      }
      let meta = profile.collection.knowledge.find((entry) => entry.id === collectableId);
      if (!meta) {
        meta = {
          id: collectableId,
          discovered: true,
          knowledgeLevel: 1,
          unlockedEntries: [],
          discoveredTechniques: [],
          discoveredAt: new Date().toISOString(),
        };
        profile.collection.knowledge.push(meta);
      } else {
        meta.discovered = true;
        meta.knowledgeLevel = Math.max(meta.knowledgeLevel, 1);
      }
    }

    const existing = this.get(run, def.subjectId);
    if (!existing) {
      run.runKnowledge!.push({
        subjectId: def.subjectId,
        category: def.category,
        stage: def.stageGranted,
        label: def.label,
        sourceCollectableIds: [def.id],
        note: def.description,
      });
      return `Recorded knowledge: ${def.label}.`;
    }
    if (stageRank(def.stageGranted) > stageRank(existing.stage)) {
      existing.stage = def.stageGranted;
    }
    existing.sourceCollectableIds = [
      ...new Set([...(existing.sourceCollectableIds ?? []), def.id]),
    ];
    return `Updated knowledge: ${def.label}.`;
  },

  clearRunKnowledge(run: RunState): void {
    run.runKnowledge = [];
  },

  /** Qualitative interpretation based on Intelligence once knowledge exists. */
  interpret(run: RunState, subjectId: string, intelligence: number): string | null {
    const entry = this.get(run, subjectId);
    if (!entry) {
      return null;
    }
    if (intelligence <= 3) {
      return `You recognize something about ${entry.label}, but the details stay foggy.`;
    }
    if (intelligence <= 7) {
      return `Using ${entry.label}, you piece together a workable approach.`;
    }
    return `With ${entry.label} and sharp analysis, you see the full implication — including the trap if forced.`;
  },
};
