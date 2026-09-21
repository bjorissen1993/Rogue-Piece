import type {
  AlignmentAxes,
  DialogueContext,
  DialogueMemory,
  HumorStyle,
  Island,
  IslandFacilityHotspot,
  PersonalityCore,
  PersonalityHumor,
  PersonalityProfile,
  PersonalitySocial,
  PersonalityValueId,
  RelationshipBand,
  RunState,
  SpeechProfile,
  WorldCharacter,
} from "../models/types";
import { CharacterService } from "./CharacterService";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { getMapLayoutAnchors } from "../data/islandMaps";
import { clamp } from "../utils/stats";

/** Phase 2: generation pipeline / LLM hook belongs behind this service, not in UI. */

const LOCAL_PATRON_PREFIX = "npc_local_";

function axis(value: number | undefined, fallback: number): number {
  return clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback, 0, 100);
}

function align(value: number | undefined, fallback: number): number {
  return clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback, -100, 100);
}

function localPatronId(islandId: string): string {
  return `${LOCAL_PATRON_PREFIX}${islandId}`;
}

function factionAlignment(faction: WorldCharacter["faction"]): AlignmentAxes {
  switch (faction) {
    case "MARINE":
      return { lawChaos: 45, goodEvil: 15 };
    case "CIVILIAN":
      return { lawChaos: 10, goodEvil: 20 };
    case "PIRATE":
      return { lawChaos: -35, goodEvil: 0 };
    case "UNDERWORLD":
      return { lawChaos: -25, goodEvil: 5 };
    default:
      return { lawChaos: 0, goodEvil: 0 };
  }
}

function inferFromPersonalityString(text: string | undefined): {
  core: Partial<PersonalityCore>;
  social: Partial<PersonalitySocial>;
  humor: Partial<PersonalityHumor>;
  speech: SpeechProfile;
  values: PersonalityValueId[];
} {
  const hay = (text ?? "").toLowerCase();
  const core: Partial<PersonalityCore> = {};
  const social: Partial<PersonalitySocial> = {};
  const humor: Partial<PersonalityHumor> = {};
  const speech: SpeechProfile = {};
  const values: PersonalityValueId[] = [];

  if (/cold|professional|stern/.test(hay)) {
    core.warmth = 28;
    speech.formality = 72;
    speech.directness = 70;
    humor.style = "dry";
    humor.intensity = 25;
  }
  if (/proud|theatrical|bold/.test(hay)) {
    core.pride = 78;
    social.extraversion = 72;
    humor.style = "playful";
    humor.intensity = 55;
    speech.confidence = 75;
  }
  if (/direct|fearless/.test(hay)) {
    core.impulsiveness = 68;
    speech.directness = 80;
    speech.formality = 28;
    values.push("freedom");
  }
  if (/observant|cautious|patient/.test(hay)) {
    core.impulsiveness = 28;
    core.curiosity = 72;
    speech.directness = 40;
    values.push("knowledge");
  }
  if (/eager/.test(hay)) {
    social.extraversion = 70;
    core.curiosity = 68;
    speech.optimism = 70;
  }
  if (/honor|honorable/.test(hay)) {
    values.push("honor");
    speech.formality = 62;
  }
  return { core, social, humor, speech, values };
}

function defaultSpeech(partial?: SpeechProfile): SpeechProfile {
  return {
    speechStyle: partial?.speechStyle,
    verbosity: axis(partial?.verbosity, 50),
    confidence: axis(partial?.confidence, 50),
    humor: axis(partial?.humor, 40),
    formality: axis(partial?.formality, 45),
    aggression: axis(partial?.aggression, 35),
    education: axis(partial?.education, 45),
    emotionalOpenness: axis(partial?.emotionalOpenness, 45),
    directness: axis(partial?.directness, 55),
    optimism: axis(partial?.optimism, 50),
    cynicism: axis(partial?.cynicism, 40),
    dialectFlavor: partial?.dialectFlavor,
  };
}

function defaultCore(partial?: Partial<PersonalityCore>): PersonalityCore {
  return {
    warmth: axis(partial?.warmth, 50),
    impulsiveness: axis(partial?.impulsiveness, 45),
    pride: axis(partial?.pride, 45),
    curiosity: axis(partial?.curiosity, 50),
    stubbornness: axis(partial?.stubbornness, 45),
  };
}

function defaultSocial(partial?: Partial<PersonalitySocial>): PersonalitySocial {
  return {
    extraversion: axis(partial?.extraversion, 50),
    trust: axis(partial?.trust, 50),
    loyalty: axis(partial?.loyalty, 55),
    statusSensitivity: axis(partial?.statusSensitivity, 40),
  };
}

function defaultHumor(partial?: Partial<PersonalityHumor>): PersonalityHumor {
  const style = partial?.style;
  const valid: HumorStyle[] = ["dry", "playful", "sarcastic", "warm", "grim", "none"];
  return {
    style: style && valid.includes(style) ? style : "dry",
    intensity: axis(partial?.intensity, 40),
  };
}

export const DialogueService = {
  migrateCharacter(character: WorldCharacter): WorldCharacter {
    const inferred = inferFromPersonalityString(character.personality);
    const existing = character.personalityProfile;
    const speech = defaultSpeech({
      ...inferred.speech,
      ...character.speechProfile,
      ...existing?.speech,
    });
    const alignmentBase = factionAlignment(character.faction);
    const profile: PersonalityProfile = {
      speech,
      core: defaultCore({ ...inferred.core, ...existing?.core }),
      social: defaultSocial({ ...inferred.social, ...existing?.social }),
      humor: defaultHumor({ ...inferred.humor, ...existing?.humor }),
      values:
        existing?.values?.length
          ? existing.values
          : inferred.values.length
            ? inferred.values
            : ["loyalty"],
      softSpots: existing?.softSpots,
      taboos: existing?.taboos,
      contradictions: existing?.contradictions,
      alignment: {
        lawChaos: align(existing?.alignment?.lawChaos, alignmentBase.lawChaos),
        goodEvil: align(existing?.alignment?.goodEvil, alignmentBase.goodEvil),
      },
      romanceDisposition: existing?.romanceDisposition ?? "reserved",
      quirks: existing?.quirks,
    };
    character.personalityProfile = profile;
    character.speechProfile = speech;
    character.dialogueMemory = {
      flags: [...(character.dialogueMemory?.flags ?? [])],
      lastTalkDay: character.dialogueMemory?.lastTalkDay,
      lastTopics: character.dialogueMemory?.lastTopics,
      talkCount: character.dialogueMemory?.talkCount ?? 0,
    };
    return character;
  },

  ensurePersonality(character: WorldCharacter): PersonalityProfile {
    this.migrateCharacter(character);
    return character.personalityProfile!;
  },

  relationshipBand(character: WorldCharacter): RelationshipBand {
    const score = character.relationshipWithPlayer ?? 0;
    const interest = character.joinInterest ?? 0;
    if (score <= -3 || (interest <= 15 && score < 0)) {
      return "hostile";
    }
    if (score <= -1) {
      return "wary";
    }
    if (interest >= 75 || score >= 4) {
      return "allied";
    }
    if (interest >= 50 || score >= 2) {
      return "friendly";
    }
    return "neutral";
  },

  hasFlag(character: WorldCharacter, flag: string): boolean {
    return Boolean(character.dialogueMemory?.flags.includes(flag));
  },

  addFlags(character: WorldCharacter, flags: string[]): DialogueMemory {
    this.migrateCharacter(character);
    const memory = character.dialogueMemory!;
    const set = new Set(memory.flags);
    for (const flag of flags) {
      if (flag.trim()) {
        set.add(flag.trim());
      }
    }
    memory.flags = Array.from(set);
    character.dialogueMemory = memory;
    return memory;
  },

  buildContext(
    run: RunState,
    character: WorldCharacter,
    partial?: Partial<DialogueContext>,
  ): DialogueContext {
    const relationship = partial?.relationship ?? this.relationshipBand(character);
    const firstTalk = (character.dialogueMemory?.talkCount ?? 0) < 1;
    return {
      situation: partial?.situation ?? (firstTalk ? "greeting" : "idle"),
      situationSeverity: axis(partial?.situationSeverity, 15),
      relationship,
      relationshipScore: character.relationshipWithPlayer ?? 0,
      topic: partial?.topic,
      emotionOverride: partial?.emotionOverride,
      speakerKnowledge: partial?.speakerKnowledge ?? character.knowledgeLevel ?? "KNOWN",
      claimKind: partial?.claimKind ?? "opinion",
      locationAnchorId: partial?.locationAnchorId,
      locationTags: partial?.locationTags,
      presentCrewIds: partial?.presentCrewIds,
      islandId: partial?.islandId ?? run.currentIslandId ?? undefined,
      hotspotId: partial?.hotspotId,
    };
  },

  humorAllowed(profile: PersonalityProfile, context: DialogueContext): boolean {
    if (profile.humor.style === "none" || profile.humor.intensity < 22) {
      return false;
    }
    if (context.situationSeverity >= 55) {
      return false;
    }
    if (context.situation === "crisis" || context.situation === "combat") {
      return false;
    }
    if (context.relationship === "hostile") {
      return false;
    }
    return true;
  },

  quirksAllowed(profile: PersonalityProfile, context: DialogueContext): boolean {
    if (!profile.quirks?.length) {
      return false;
    }
    if (context.situationSeverity >= 40) {
      return false;
    }
    if (context.relationship === "hostile" || context.relationship === "wary") {
      return false;
    }
    if (context.situation === "crisis" || context.situation === "combat" || context.situation === "secret") {
      return false;
    }
    return (context.islandId?.length ?? 0) % 4 === 0;
  },

  renderLine(character: WorldCharacter, context: DialogueContext): string {
    const profile = this.ensurePersonality(character);
    const name = character.epithet ? `${character.name} "${character.epithet}"` : character.name;
    const body = this.contentBody(character, context);
    const delivered = this.applyDelivery(body, profile, context);
    const hedge = this.knowledgeHedge(context);
    const prefix = `${name}: "`;
    const suffix = `"`;
    return `${prefix}${hedge}${delivered}${suffix}`;
  },

  performTalk(
    run: RunState,
    island: Island | null | undefined,
    hotspot?: IslandFacilityHotspot | null,
  ): { line: string; characterId: string } {
    const speaker = this.pickSpeaker(run, island);
    this.ensurePersonality(speaker);
    CharacterService.recordFirstMeeting(run, speaker.id);

    const anchors = island ? getMapLayoutAnchors(island, island.mapAssetId) : [];
    const bound = hotspot
      ? anchors.filter((a) => a.hotspotId === hotspot.hotspotId && a.aiPermission !== "never")
      : anchors.filter((a) => a.aiPermission === "auto");
    const usable = bound.length > 0 ? bound : anchors.filter((a) => a.aiPermission === "suggest");
    const anchor = usable[0];

    const presentCrewIds = (run.crew ?? [])
      .map((m) => m.characterId)
      .filter((id) => CharacterScheduleService.isAvailable(run, id));

    const context = this.buildContext(run, speaker, {
      situation: (speaker.dialogueMemory?.talkCount ?? 0) < 1 ? "greeting" : "idle",
      situationSeverity: 12,
      islandId: island?.id,
      hotspotId: hotspot?.hotspotId,
      topic: hotspot?.purpose || island?.name,
      locationAnchorId: anchor?.id,
      locationTags: anchor?.tags,
      presentCrewIds,
      claimKind: anchor ? "rumor" : "opinion",
    });

    const line = this.renderLine(speaker, context);
    const memory = this.addFlags(speaker, [
      "talked",
      island ? `talked_at_${island.id}` : "",
      context.topic ? `topic_${context.topic}` : "",
    ]);
    memory.talkCount = (memory.talkCount ?? 0) + 1;
    memory.lastTalkDay = run.day;
    memory.lastTopics = [
      ...(memory.lastTopics ?? []).slice(-4),
      context.topic ?? context.situation,
    ];
    speaker.dialogueMemory = memory;
    if ((speaker.relationshipWithPlayer ?? 0) < 2 && context.relationship !== "hostile") {
      speaker.relationshipWithPlayer = (speaker.relationshipWithPlayer ?? 0) + 0.15;
    }
    return { line, characterId: speaker.id };
  },

  exploreFlavor(run: RunState, island: Island): string {
    const anchors = getMapLayoutAnchors(island, island.mapAssetId).filter(
      (a) => a.aiPermission === "auto" || a.aiPermission === "suggest",
    );
    const auto = anchors.find((a) => a.aiPermission === "auto") ?? anchors[0];
    const speaker = this.peekLocalSpeaker(run, island);
    const context: DialogueContext = {
      situation: "explore",
      situationSeverity: 25,
      relationship: speaker ? this.relationshipBand(speaker) : "neutral",
      relationshipScore: speaker?.relationshipWithPlayer ?? 0,
      islandId: island.id,
      locationAnchorId: auto?.id,
      locationTags: auto?.tags,
      topic: auto?.description || island.biome,
      claimKind: auto ? "rumor" : "fact",
      speakerKnowledge: speaker?.knowledgeLevel ?? "RUMORED",
    };

    if (speaker) {
      this.ensurePersonality(speaker);
      CharacterService.recordFirstMeeting(run, speaker.id);
      this.addFlags(speaker, ["saw_player_explore", `explore_${island.id}`]);
      return this.renderLine(speaker, context);
    }

    if (auto?.description) {
      return `You notice ${auto.description.charAt(0).toLowerCase()}${auto.description.slice(1)}`;
    }
    const trait = island.cultureTags?.[0] || island.uniqueTraits?.[0] || island.biome;
    return `The ${island.settlementType.toLowerCase()} of ${island.name} feels ${trait ? String(trait).toLowerCase() : "watchful"} as you look around.`;
  },

  pickSpeaker(run: RunState, island: Island | null | undefined): WorldCharacter {
    const existing = this.peekLocalSpeaker(run, island);
    if (existing) {
      return existing;
    }
    if (!island) {
      const anyone = run.world.characters.find((c) => c.alive);
      if (anyone) {
        return anyone;
      }
    }
    return this.ensureLocalPatron(run, island);
  },

  peekLocalSpeaker(run: RunState, island: Island | null | undefined): WorldCharacter | undefined {
    const alive = run.world.characters.filter((c) => c.alive);
    if (island) {
      const patron = alive.find((c) => c.id === localPatronId(island.id));
      if (patron) {
        return patron;
      }
      const metHere = alive.find((c) => c.firstMetIslandId === island.id);
      if (metHere) {
        return metHere;
      }
    }
    const crewOnHand = (run.crew ?? [])
      .map((m) => alive.find((c) => c.id === m.characterId))
      .find((c): c is WorldCharacter => {
        if (!c) {
          return false;
        }
        return CharacterScheduleService.isAvailable(run, c.id);
      });
    if (crewOnHand) {
      return crewOnHand;
    }
    return alive.find((c) => c.tags?.includes("local") || c.tags?.includes("patron"));
  },

  ensureLocalPatron(run: RunState, island: Island | null | undefined): WorldCharacter {
    const islandId = island?.id ?? run.currentIslandId ?? "unknown";
    const id = localPatronId(islandId);
    const existing = run.world.characters.find((c) => c.id === id);
    if (existing) {
      this.ensurePersonality(existing);
      return existing;
    }
    const faction = islandFaction(island);
    const names: Record<WorldCharacter["faction"], string> = {
      CIVILIAN: island?.settlementType === "port" ? "Dockside Keel" : "Mira Venn",
      MARINE: "Sergeant Pell",
      PIRATE: "Rook Hale",
      UNDERWORLD: "Quiet Nara",
    };
    const created = CharacterService.getOrCreateCharacter(run, {
      id,
      name: names[faction],
      faction,
      personality:
        faction === "MARINE"
          ? "Cold and professional"
          : faction === "PIRATE"
            ? "Proud and theatrical"
            : "Observant and cautious",
      tags: ["local", "patron", island?.archetype ?? "island"],
      relationshipWithPlayer: 0,
      importance: 2,
    });
    created.firstMetIslandId = island?.id;
    this.ensurePersonality(created);
    return created;
  },

  contentBody(character: WorldCharacter, context: DialogueContext): string {
    const islandBit = context.islandId ? "around here" : "on these waters";
    const topic = context.topic?.trim();
    const tags = context.locationTags?.length ? context.locationTags[0] : null;
    const greetingMemory = character.memories
      ?.slice()
      .sort((a, b) => b.day - a.day)[0];

    if (context.relationship === "hostile") {
      return "You've got nerve showing your face. Say what you want and go.";
    }
    if (context.situation === "crisis" || context.situationSeverity >= 70) {
      return "Later. Right now we keep people breathing.";
    }
    if (context.situation === "combat") {
      return "Talk when the blades are down.";
    }
    if (context.situation === "explore") {
      if (topic && topic.length > 8) {
        return `${topic.charAt(0).toLowerCase() === topic.charAt(0) ? topic : topic.charAt(0).toLowerCase() + topic.slice(1)} is worth a closer look.`;
      }
      return tags
        ? `If you're poking around, start near the ${tags.replace(/_/g, " ")}.`
        : `Keep your eyes open ${islandBit}. The quiet spots lie.`;
    }
    if (greetingMemory && (context.situation === "greeting" || context.situation === "idle")) {
      if (greetingMemory.type === "HELPED" || greetingMemory.type === "PLAYER_SAVED_ME") {
        return "I still owe you for last time. What do you need?";
      }
      if (greetingMemory.type === "FOUGHT" || greetingMemory.type === "PLAYER_ATTACKED_ME") {
        return "We already settled one score. Don't make me start another.";
      }
      if (greetingMemory.type === "FOUGHT_TOGETHER") {
        return "Didn't think I'd see you on a peaceful street after all that.";
      }
    }
    if (context.situation === "greeting") {
      return topic
        ? `You're new to ${topic}. Watch how folks look at you before you talk loud.`
        : `First time ${islandBit}? Don't trust the first smile you get.`;
    }
    if (context.relationship === "friendly" || context.relationship === "allied") {
      return topic
        ? `If you're asking about ${topic}, I'll tell you what I can.`
        : "Good to see a familiar face. Ask, and I'll answer straight.";
    }
    if (context.situation === "business") {
      return "State your business. I haven't got all tide.";
    }
    if (context.presentCrewIds && context.presentCrewIds.length > 1) {
      return "Your crew's drawing looks. Might want this conversation quieter.";
    }
    return tags
      ? `People talk about the ${tags.replace(/_/g, " ")} if you listen long enough.`
      : `Nothing special to report ${islandBit} — unless you count the usual rumors.`;
  },

  applyDelivery(body: string, profile: PersonalityProfile, context: DialogueContext): string {
    let text = body;
    const formality = profile.speech.formality ?? 45;
    const directness = profile.speech.directness ?? 55;
    const warm = profile.core.warmth;
    const situationOverridesQuirk =
      context.situationSeverity >= 40 ||
      context.relationship === "hostile" ||
      context.situation === "crisis";

    if (context.relationship === "hostile") {
      text = text.replace(/I'll/g, "I'll").replace(/\.$/, ".");
    } else if (formality >= 68 && !situationOverridesQuirk) {
      text = text
        .replace(/\bDon't\b/g, "Do not")
        .replace(/\bdon't\b/g, "do not")
        .replace(/\bYou've\b/g, "You have")
        .replace(/\bI'll\b/g, "I will");
    } else if (formality <= 30 && directness >= 60) {
      text = text.replace(/\.$/, ".");
    }

    if (warm >= 70 && context.relationship !== "hostile" && context.situationSeverity < 50) {
      if (!text.startsWith("Good") && context.situation === "greeting") {
        text = `Welcome. ${text}`;
      }
    } else if (warm <= 28 && context.relationship !== "friendly") {
      text = text.replace(/\bGood to see a familiar face\. /, "");
    }

    if (DialogueService.humorAllowed(profile, context) && profile.humor.intensity >= 50) {
      if (profile.humor.style === "dry") {
        text += " Try not to look impressed.";
      } else if (profile.humor.style === "playful") {
        text += " Or surprise me — I like being wrong.";
      } else if (profile.humor.style === "warm") {
        text += " You'll be fine.";
      }
    }

    if (DialogueService.quirksAllowed(profile, context) && profile.quirks?.[0]) {
      text += ` ${profile.quirks[0]}`;
    }

    if (profile.speech.verbosity != null && profile.speech.verbosity <= 28 && text.length > 90) {
      const cut = text.slice(0, 88);
      const at = cut.lastIndexOf(" ");
      text = `${cut.slice(0, at > 40 ? at : 88)}.`;
    }

    return text.replace(/\s+/g, " ").trim();
  },

  knowledgeHedge(context: DialogueContext): string {
    if (context.claimKind === "rumor") {
      return "I heard ";
    }
    return "";
  },
};

function islandFaction(island: Island | null | undefined): WorldCharacter["faction"] {
  switch (island?.dominantFactionId) {
    case "MARINES":
    case "WORLD_GOVERNMENT":
      return "MARINE";
    case "PIRATES":
      return "PIRATE";
    case "REVOLUTIONARY_ARMY":
      return "UNDERWORLD";
    default:
      return "CIVILIAN";
  }
}
