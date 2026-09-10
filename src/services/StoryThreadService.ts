import {
  MAX_MAJOR_THREADS,
  MAX_MINOR_THREADS,
  STORY_THREAD_COOLDOWN_DAYS,
} from "../game/constants";
import { getStoryThreadTemplate } from "../data/storyThreads";
import type {
  RunState,
  StoryThread,
  StoryThreadState,
  StoryThreadType,
} from "../models/types";
import { createId } from "../utils/ids";

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

    const thread: StoryThread = {
      id: createId("thread"),
      type: template.type,
      templateId,
      title: template.title,
      state: "DISCOVERED",
      stage: 0,
      maxStage: template.maxStage,
      startedDay: run.day,
      lastUpdatedDay: run.day,
      involvedCharacterIds: options?.characterIds ?? [],
      involvedFactionIds: template.involvedFactionIds ?? [],
      involvedIslandIds: options?.islandIds ?? [run.currentLocationId],
      tags: [...template.tags],
      history: [
        {
          day: run.day,
          stage: 0,
          text: `${template.title} enters your story.`,
        },
      ],
      metadata: options?.metadata,
    };
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
    if (thread.stage === 1) {
      thread.state = "ACTIVE";
    } else if (thread.stage >= (thread.maxStage ?? 3) - 1) {
      thread.state = "CLIMAX_READY";
    } else if (thread.stage > 1) {
      thread.state = "ESCALATING";
    }
    thread.history.push({
      day: run.day,
      stage: thread.stage,
      text: note ?? `The story of ${thread.title} deepens.`,
    });
    return thread;
  },

  resolve(run: RunState, templateId: string, note?: string): StoryThread | null {
    const thread = this.getThreadByTemplate(run, templateId);
    if (!thread) {
      return null;
    }
    thread.state = "RESOLVED";
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

  clearCooldowns(run: RunState): void {
    for (const thread of run.storyThreads) {
      thread.cooldownUntilDay = undefined;
    }
  },
};

export function defaultStoryThreads(): StoryThread[] {
  return [];
}
