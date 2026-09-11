import {
  MAX_MAJOR_THREADS,
  MAX_MINOR_THREADS,
  STORY_THREAD_COOLDOWN_DAYS,
} from "../game/constants";
import { getStoryThreadTemplate } from "../data/storyThreads";
import type {
  NarrativeArchetype,
  RunState,
  StoryThread,
  StoryThreadStageKind,
  StoryThreadState,
  StoryThreadType,
} from "../models/types";
import { createId } from "../utils/ids";
import { IdentityService } from "./IdentityService";

function countActiveByType(run: RunState, type: StoryThreadType): number {
  const activeStates: StoryThreadState[] = [
    "DISCOVERED",
    "ACTIVE",
    "ESCALATING",
    "CLIMAX_READY",
  ];
  return run.storyThreads.filter(
    (thread) => thread.type === type && activeStates.includes(thread.state),
  ).length;
}

function isOnCooldown(run: RunState, templateId: string): boolean {
  const resolved = run.storyThreads
    .filter((thread) => thread.templateId === templateId)
    .sort((a, b) => b.lastUpdatedDay - a.lastUpdatedDay)[0];
  if (!resolved?.cooldownUntilDay) {
    return false;
  }
  return run.day < resolved.cooldownUntilDay;
}

function stageKindFor(thread: StoryThread, stage: number): StoryThreadStageKind | undefined {
  const template = getStoryThreadTemplate(thread.templateId);
  const fromTemplate = template?.stages?.[stage]?.kind;
  if (fromTemplate) return fromTemplate;
  if (stage <= 0) return "HOOK";
  if (stage >= (thread.maxStage ?? 3) - 1) return "CLIMAX";
  if (stage === 1) return "DEVELOPMENT";
  return "ESCALATION";
}

export const StoryThreadService = {
  getActiveThreads(run: RunState): StoryThread[] {
    const activeStates: StoryThreadState[] = [
      "DISCOVERED",
      "ACTIVE",
      "ESCALATING",
      "CLIMAX_READY",
    ];
    return run.storyThreads.filter((thread) => activeStates.includes(thread.state));
  },

  getThreadByTemplate(run: RunState, templateId: string): StoryThread | undefined {
    return run.storyThreads.find(
      (thread) =>
        thread.templateId === templateId &&
        !["RESOLVED", "FAILED", "ABANDONED"].includes(thread.state),
    );
  },

  canSpawnNewMajor(run: RunState, templateId: string): boolean {
    if (isOnCooldown(run, templateId)) {
      return false;
    }
    if (this.getThreadByTemplate(run, templateId)) {
      return false;
    }
    return countActiveByType(run, "MAJOR") < MAX_MAJOR_THREADS;
  },

  canSpawnNewMinor(run: RunState, templateId: string): boolean {
    if (isOnCooldown(run, templateId)) {
      return false;
    }
    if (this.getThreadByTemplate(run, templateId)) {
      return false;
    }
    return countActiveByType(run, "MINOR") < MAX_MINOR_THREADS;
  },

  createThread(
    run: RunState,
    templateId: string,
    options?: {
      characterIds?: string[];
      islandIds?: string[];
      metadata?: Record<string, unknown>;
    },
  ): StoryThread | null {
    const template = getStoryThreadTemplate(templateId);
    if (!template) {
      return null;
    }
    if (template.type === "MAJOR" && !this.canSpawnNewMajor(run, templateId)) {
      return null;
    }
    if (template.type === "MINOR" && !this.canSpawnNewMinor(run, templateId)) {
      return null;
    }

    const archetypes = template.archetypes ?? [];
    const thread: StoryThread = {
      id: createId("thread"),
      type: template.type,
      templateId,
      title: template.title,
      state: "DISCOVERED",
      stage: 0,
      maxStage: template.maxStage,
      stageKind: stageKindFor({ maxStage: template.maxStage, templateId } as StoryThread, 0),
      startedDay: run.day,
      lastUpdatedDay: run.day,
      involvedCharacterIds: options?.characterIds ?? [],
      involvedFactionIds: template.involvedFactionIds ?? [],
      involvedIslandIds: options?.islandIds ?? [run.currentLocationId],
      tags: [...template.tags],
      archetypes: archetypes.length ? [...archetypes] : undefined,
      history: [
        {
          day: run.day,
          stage: 0,
          text: `${template.title} enters your story.`,
        },
      ],
      metadata: options?.metadata,
    };
    // Recompute with full thread for template stage lookup
    thread.stageKind = stageKindFor(thread, 0);
    run.storyThreads.push(thread);
    return thread;
  },

  advanceStage(run: RunState, templateId: string, note?: string): StoryThread | null {
    const thread = this.getThreadByTemplate(run, templateId);
    if (!thread) {
      return null;
    }
    thread.stage += 1;
    thread.lastUpdatedDay = run.day;
    thread.stageKind = stageKindFor(thread, thread.stage);
    if (thread.stage === 1) {
      thread.state = "ACTIVE";
    } else if (thread.stage >= (thread.maxStage ?? 3) - 1) {
      thread.state = "CLIMAX_READY";
    } else if (thread.stage > 1) {
      thread.state = "ESCALATING";
    }
    const template = getStoryThreadTemplate(templateId);
    const stageLabel = template?.stages?.[thread.stage]?.label;
    thread.history.push({
      day: run.day,
      stage: thread.stage,
      text: note ?? stageLabel ?? `The story of ${thread.title} deepens.`,
    });
    return thread;
  },

  resolve(run: RunState, templateId: string, note?: string): StoryThread | null {
    const thread = this.getThreadByTemplate(run, templateId);
    if (!thread) {
      return null;
    }
    thread.state = "RESOLVED";
    thread.stageKind = "RESOLUTION";
    thread.lastUpdatedDay = run.day;
    const template = getStoryThreadTemplate(templateId);
    const cooldown = template?.cooldownDays ?? STORY_THREAD_COOLDOWN_DAYS;
    thread.cooldownUntilDay = run.day + cooldown;
    thread.history.push({
      day: run.day,
      stage: thread.stage,
      text: note ?? `${thread.title} reaches a conclusion.`,
    });
    return thread;
  },

  fail(run: RunState, templateId: string, note?: string): StoryThread | null {
    const thread = this.getThreadByTemplate(run, templateId);
    if (!thread) {
      return null;
    }
    thread.state = "FAILED";
    thread.lastUpdatedDay = run.day;
    const template = getStoryThreadTemplate(templateId);
    thread.cooldownUntilDay = run.day + (template?.cooldownDays ?? STORY_THREAD_COOLDOWN_DAYS);
    thread.history.push({
      day: run.day,
      stage: thread.stage,
      text: note ?? `${thread.title} ends badly.`,
    });
    return thread;
  },

  /**
   * Prefer encounters that continue active threads / match next-stage tags.
   */
  contextScore(run: RunState, encounter: {
    id: string;
    narrativeThemes?: string[];
    storyThreadTemplateId?: string;
    narrativeArchetypes?: NarrativeArchetype[];
    bindCharacterId?: string;
  }): number {
    let score = 1;
    const active = this.getActiveThreads(run);
    IdentityService.ensure(run);
    const themes = encounter.narrativeThemes ?? [];

    if (encounter.storyThreadTemplateId) {
      const thread = this.getThreadByTemplate(run, encounter.storyThreadTemplateId);
      if (thread) {
        score *= 2.2;
        const template = getStoryThreadTemplate(thread.templateId);
        const nextStage = template?.stages?.[thread.stage + 1] ?? template?.stages?.[thread.stage];
        if (nextStage?.encounterIds?.includes(encounter.id)) {
          score *= 1.8;
        }
        if (nextStage?.encounterTags?.length && themes.length) {
          const overlap = nextStage.encounterTags.filter((tag) => themes.includes(tag));
          if (overlap.length) score *= 1.35;
        }
      } else {
        score *= 0.2;
      }
    }

    for (const thread of active) {
      if (encounter.bindCharacterId && thread.involvedCharacterIds.includes(encounter.bindCharacterId)) {
        score *= 1.45;
      }
      if (themes.some((tag) => thread.tags.includes(tag))) {
        score *= 1.15;
      }
      if (
        encounter.narrativeArchetypes?.length &&
        thread.archetypes?.some((arch) => encounter.narrativeArchetypes!.includes(arch))
      ) {
        score *= 1.2;
      }
      if (thread.involvedIslandIds.includes(run.currentLocationId) || thread.involvedIslandIds.includes(run.currentIslandId ?? "")) {
        score *= 1.1;
      }
    }

    const identity = IdentityService.get(run);
    if (identity.roleId === "BOUNTY_HUNTER" && themes.includes("bounty_hunter")) {
      score *= 1.25;
    }
    if (identity.legalStatusId === "WANTED" && themes.includes("wanted")) {
      score *= 1.15;
    }

    return score;
  },

  /**
   * Propose merging two active threads that share character, island, or faction context.
   * Returns a new merged thread or null if incompatible.
   */
  proposeMerge(run: RunState, threadIdA: string, threadIdB: string): StoryThread | null {
    const a = run.storyThreads.find((thread) => thread.id === threadIdA);
    const b = run.storyThreads.find((thread) => thread.id === threadIdB);
    if (!a || !b) return null;
    if (["RESOLVED", "FAILED", "ABANDONED"].includes(a.state)) return null;
    if (["RESOLVED", "FAILED", "ABANDONED"].includes(b.state)) return null;

    const sharedCharacters = a.involvedCharacterIds.filter((id) => b.involvedCharacterIds.includes(id));
    const sharedIslands = a.involvedIslandIds.filter((id) => b.involvedIslandIds.includes(id));
    const sharedFactions = a.involvedFactionIds.filter((id) => b.involvedFactionIds.includes(id));
    if (!sharedCharacters.length && !sharedIslands.length && !sharedFactions.length) {
      return null;
    }

    a.state = "ABANDONED";
    b.state = "ABANDONED";
    a.lastUpdatedDay = run.day;
    b.lastUpdatedDay = run.day;

    const merged: StoryThread = {
      id: createId("thread"),
      type: a.type === "MAJOR" || b.type === "MAJOR" ? "MAJOR" : "MINOR",
      templateId: "merged_threads",
      title: `${a.title} / ${b.title}`,
      state: "ACTIVE",
      stage: Math.max(a.stage, b.stage),
      maxStage: Math.max(a.maxStage ?? 3, b.maxStage ?? 3) + 1,
      stageKind: "COMPLICATION",
      startedDay: Math.min(a.startedDay, b.startedDay),
      lastUpdatedDay: run.day,
      involvedCharacterIds: Array.from(new Set([...a.involvedCharacterIds, ...b.involvedCharacterIds])),
      involvedFactionIds: Array.from(new Set([...a.involvedFactionIds, ...b.involvedFactionIds])),
      involvedIslandIds: Array.from(new Set([...a.involvedIslandIds, ...b.involvedIslandIds])),
      tags: Array.from(new Set([...a.tags, ...b.tags, "merged"])),
      archetypes: Array.from(new Set([...(a.archetypes ?? []), ...(b.archetypes ?? [])])),
      mergedFromThreadIds: [a.id, b.id],
      history: [
        {
          day: run.day,
          stage: Math.max(a.stage, b.stage),
          text: `Two stories collide: ${a.title} and ${b.title} become one.`,
        },
      ],
      metadata: { mergeStub: true },
    };
    run.storyThreads.push(merged);
    return merged;
  },

  clearCooldowns(run: RunState): void {
    for (const thread of run.storyThreads) {
      thread.cooldownUntilDay = undefined;
    }
  },
};

export function defaultStoryThreads(): StoryThread[] {
  return [];
}
