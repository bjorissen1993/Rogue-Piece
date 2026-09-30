import { QUEST_OUTCOMES } from "../data/questOutcomes";
import type {
  GeneratedQuestOutcome,
  GeneratedQuestResult,
  QuestArchetypeId,
  RunState,
  StoryChain,
  StoryThread,
} from "../models/types";
import { createId } from "../utils/ids";
import { CharacterService } from "./CharacterService";
import { FactionService } from "./FactionService";
import { GeneratedLocationService } from "./GeneratedLocationService";
import { IslandPressureService } from "./IslandPressureService";
import { IslandService } from "./IslandService";
import { ItemService } from "./ItemService";
import { NpcResidencyService } from "./NpcResidencyService";

function director(run: RunState) {
  if (!run.world.generatedQuestState) {
    run.world.generatedQuestState = {
      capacity: 3,
      activeGeneratedQuestIds: [],
      lastGenerationDay: 0,
      recentArchetypes: [],
    };
  }
  return run.world.generatedQuestState;
}

function archetypeIdOf(thread: StoryThread): QuestArchetypeId | null {
  const fromMeta = thread.metadata?.archetypeId;
  if (typeof fromMeta === "string" && fromMeta in QUEST_OUTCOMES) {
    return fromMeta as QuestArchetypeId;
  }
  const fromTemplate = thread.templateId.replace(/^generated:/, "");
  if (fromTemplate in QUEST_OUTCOMES) {
    return fromTemplate as QuestArchetypeId;
  }
  return null;
}

function outcomeFor(thread: StoryThread, result: GeneratedQuestResult): GeneratedQuestOutcome {
  const stored = thread.metadata?.outcome;
  if (result === "success" && stored && typeof stored === "object") {
    return stored as GeneratedQuestOutcome;
  }
  const archetype = archetypeIdOf(thread);
  if (!archetype) {
    return { trust: result === "success" ? 3 : -2 };
  }
  return QUEST_OUTCOMES[archetype][result];
}

function findGeneratedByChain(run: RunState, chainId: string): StoryThread | undefined {
  return (run.storyThreads ?? []).find(
    (thread) => thread.metadata?.source === "GENERATED" && thread.metadata?.chainId === chainId,
  );
}

export const QuestOutcomeService = {
  findByChain(run: RunState, chain: StoryChain): StoryThread | undefined {
    return findGeneratedByChain(run, chain.id);
  },

  apply(
    run: RunState,
    thread: StoryThread,
    result: GeneratedQuestResult,
    options?: { skipSharedEffects?: boolean },
  ): string[] {
    if (thread.state === "RESOLVED" || thread.state === "FAILED" || thread.state === "ABANDONED") {
      return [];
    }
    const outcome = outcomeFor(thread, result);
    const lines: string[] = [];
    const island =
      (thread.involvedIslandIds[0]
        ? (run.islands ?? []).find((row) => row.id === thread.involvedIslandIds[0])
        : null) ?? IslandService.getCurrentIsland(run);

    if (outcome.berries) {
      run.player.berries = Math.max(0, run.player.berries + outcome.berries);
      lines.push(`${outcome.berries >= 0 ? "+" : ""}${outcome.berries} berries.`);
    }
    if (outcome.itemId) {
      ItemService.grant(run, outcome.itemId, outcome.itemQty ?? 1);
      lines.push("A small reward changes hands.");
    }
    if (island && outcome.trust) {
      IslandPressureService.adjustTrust(island, outcome.trust);
    }
    if (island && outcome.pressure) {
      IslandPressureService.adjustPressure(island, outcome.pressure);
    }

    if (!options?.skipSharedEffects) {
      if (outcome.news) {
        run.world.history.push({
          id: createId("news"),
          day: run.day,
          text: outcome.news,
        });
        lines.push(outcome.news);
      }
      if (outcome.factionId && outcome.factionDelta) {
        FactionService.modifyRelationship(
          run,
          outcome.factionId,
          outcome.factionDelta,
          thread.title,
        );
      }
      const npcId = thread.involvedCharacterIds[0];
      if (npcId && outcome.relationship) {
        const npc = CharacterService.getCharacter(run, npcId);
        if (npc) {
          npc.relationshipWithPlayer += outcome.relationship;
          CharacterService.addMemory(
            run,
            npcId,
            outcome.relationship >= 0 ? "HELPED" : "BETRAYED",
            2,
            thread.title,
          );
        }
      }
    }

    const npcId = thread.involvedCharacterIds[0];
    const npc = npcId ? CharacterService.getCharacter(run, npcId) : undefined;
    if (result === "success" && outcome.settleNpc && npc && island) {
      NpcResidencyService.settleAfterQuest(run, npc, island);
    } else if (result !== "success" && npc && npc.residencyStatus === "VISITOR") {
      npc.residencyStatus = "LEFT_ISLAND";
    }

    thread.state = result === "success" ? "RESOLVED" : "FAILED";
    thread.lastUpdatedDay = run.day;
    thread.history = [
      ...thread.history,
      {
        day: run.day,
        stage: thread.stage,
        text:
          result === "success"
            ? `The ${thread.title.toLowerCase()} is settled.`
            : result === "expire"
              ? `The ${thread.title.toLowerCase()} went unanswered.`
              : `The ${thread.title.toLowerCase()} failed.`,
      },
    ];
    thread.metadata = {
      ...thread.metadata,
      resolvedResult: result,
      followUp: result === "success" ? outcome.followUp : undefined,
    };

    if (island) {
      GeneratedLocationService.evaluateAfterQuest(run, island, thread.id);
    }

    const state = director(run);
    state.activeGeneratedQuestIds = state.activeGeneratedQuestIds.filter((id) => id !== thread.id);
    return lines;
  },

  onChainCompleted(run: RunState, chain: StoryChain): string[] {
    const thread = findGeneratedByChain(run, chain.id);
    if (!thread) {
      return [];
    }
    return this.apply(run, thread, "success", { skipSharedEffects: true });
  },
};
