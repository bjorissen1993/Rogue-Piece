import type {
  Encounter,
  FamilyLineage,
  FightingStyleLineage,
  LegacyAppearanceHeritage,
  LegacyCharacterRecord,
  LegacyCharacterStatus,
  LegacyEvent,
  LegacyEventVisibility,
  LegacyPersistenceTier,
  MentorshipLineage,
  ProfileSave,
  RunState,
  WorldCharacter,
  WorldLegacyState,
  WorldTimeline,
  CrewRole,
} from "../models/types";
import { createId, nowIso } from "../utils/ids";
import { CharacterService } from "./CharacterService";
import type { RandomService } from "./RandomService";
import { createRng } from "./RandomService";
import { BATTLE_FORMATS } from "./EncounterCompositionService";

const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;

const HAIR = ["black", "brown", "auburn", "blond", "silver", "dark green", "blue-black"];
const EYES = ["brown", "hazel", "grey", "green", "blue", "amber"];
const SKIN = ["fair", "tan", "olive", "deep", "sun-weathered"];
const CHILD_FIRST = [
  "Kael",
  "Rin",
  "Sera",
  "Jun",
  "Tomi",
  "Nami",
  "Rolan",
  "Vex",
  "Lio",
  "Mira",
  "Kenji",
  "Asha",
];

function defaultTimeline(): WorldTimeline {
  return { year: 1520, month: 1, day: 1, totalDays: 0 };
}

export function emptyLegacyState(): WorldLegacyState {
  return {
    timeline: defaultTimeline(),
    characters: [],
    events: [],
    families: [],
    mentorships: [],
    styleLineages: [],
    items: [],
    betweenRunDaysDefault: 90,
  };
}

function clampMonthDay(timeline: WorldTimeline): void {
  while (timeline.day > DAYS_PER_MONTH) {
    timeline.day -= DAYS_PER_MONTH;
    timeline.month += 1;
  }
  while (timeline.month > MONTHS_PER_YEAR) {
    timeline.month -= MONTHS_PER_YEAR;
    timeline.year += 1;
  }
  while (timeline.day < 1) {
    timeline.month -= 1;
    timeline.day += DAYS_PER_MONTH;
  }
  while (timeline.month < 1) {
    timeline.year -= 1;
    timeline.month += MONTHS_PER_YEAR;
  }
}

function ageYears(record: LegacyCharacterRecord, timeline: WorldTimeline): number {
  return Math.max(0, timeline.year - record.birthYear);
}

function pick<T>(rng: RandomService, list: T[]): T {
  return list[rng.nextInt(0, list.length - 1)]!;
}

function surnameFrom(name: string): string | null {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts[parts.length - 1] ?? null;
  }
  const ofMatch = name.match(/\bof the (.+)$/i);
  if (ofMatch?.[1]) {
    return ofMatch[1];
  }
  return null;
}

function heritageFromParent(
  parent: LegacyCharacterRecord,
  rng: RandomService,
): LegacyAppearanceHeritage {
  const base = parent.appearanceHeritage ?? {};
  return {
    hairColor: rng.chance(0.65) ? base.hairColor ?? pick(rng, HAIR) : pick(rng, HAIR),
    eyeColor: rng.chance(0.55) ? base.eyeColor ?? pick(rng, EYES) : pick(rng, EYES),
    skinTone: rng.chance(0.75) ? base.skinTone ?? pick(rng, SKIN) : pick(rng, SKIN),
    heightTendency: rng.chance(0.5)
      ? base.heightTendency ?? pick(rng, ["SHORT", "AVERAGE", "TALL"] as const)
      : pick(rng, ["SHORT", "AVERAGE", "TALL"] as const),
    buildTendency: rng.chance(0.5)
      ? base.buildTendency ?? pick(rng, ["SLIGHT", "AVERAGE", "STOUT", "ATHLETIC"] as const)
      : pick(rng, ["SLIGHT", "AVERAGE", "STOUT", "ATHLETIC"] as const),
    notes: [
      ...(base.notes ?? []).slice(0, 2),
      `Resembles ${parent.character.name} in bearing`,
    ],
  };
}

export const LegacyService = {
  ensure(profile: ProfileSave): WorldLegacyState {
    if (!profile.legacy) {
      profile.legacy = emptyLegacyState();
    }
    this.migrateFromPersistent(profile);
    return profile.legacy;
  },

  /** Fold older survivor records into Legacy without inventing history. */
  migrateFromPersistent(profile: ProfileSave): void {
    const legacy = profile.legacy ?? emptyLegacyState();
    profile.legacy = legacy;
    for (const entry of profile.persistentCharacters ?? []) {
      if (legacy.characters.some((c) => c.characterId === entry.character.id)) {
        continue;
      }
      const status: LegacyCharacterStatus =
        entry.survivalStatus === "DEAD"
          ? "DEAD"
          : entry.survivalStatus === "MISSING"
            ? "MISSING"
            : "ACTIVE";
      legacy.characters.push({
        characterId: entry.character.id,
        tier: "LEGACY",
        character: structuredClone(entry.character),
        birthYear: Math.max(1400, legacy.timeline.year - 22),
        status,
        lastKnownLocationId: entry.lastKnownLocationId,
        lastKnownIslandId: entry.lastKnownIslandId,
        priorCrewCaptainNames: entry.priorCrewCaptainNames ?? [],
        parentIds: [],
        childIds: [],
        mentorId: null,
        apprenticeIds: [],
        fightingStyleIds: entry.character.combatStyle ? [entry.character.combatStyle] : [],
        appearanceHeritage: {},
        careerNotes: [],
        importanceScore: 40,
        lastSimulatedTotalDays: legacy.timeline.totalDays,
        lastRunEndId: entry.lastRunEndId,
        updatedAt: entry.updatedAt ?? nowIso(),
      });
    }
  },

  getCharacter(profile: ProfileSave, characterId: string): LegacyCharacterRecord | null {
    return this.ensure(profile).characters.find((c) => c.characterId === characterId) ?? null;
  },

  ageOf(profile: ProfileSave, characterId: string): number | null {
    const record = this.getCharacter(profile, characterId);
    if (!record) return null;
    return ageYears(record, this.ensure(profile).timeline);
  },

  recordEvent(
    profile: ProfileSave,
    input: {
      eventType: string;
      summary: string;
      characterIds?: string[];
      locationId?: string;
      factionIds?: string[];
      runId?: string;
      importance?: number;
      visibility?: LegacyEventVisibility;
      storyThreadIds?: string[];
      knowledgeTags?: string[];
      consequences?: string[];
    },
  ): LegacyEvent {
    const legacy = this.ensure(profile);
    const t = legacy.timeline;
    const event: LegacyEvent = {
      id: createId("legEvt"),
      worldTotalDays: t.totalDays,
      year: t.year,
      month: t.month,
      day: t.day,
      eventType: input.eventType,
      summary: input.summary,
      characterIds: input.characterIds ?? [],
      locationId: input.locationId,
      factionIds: input.factionIds,
      runId: input.runId,
      importance: input.importance ?? 2,
      visibility: input.visibility ?? "LOCAL",
      storyThreadIds: input.storyThreadIds,
      knowledgeTags: input.knowledgeTags,
      consequences: input.consequences,
    };
    legacy.events.push(event);
    if (legacy.events.length > 400) {
      legacy.events = legacy.events
        .slice()
        .sort((a, b) => b.importance - a.importance || b.worldTotalDays - a.worldTotalDays)
        .slice(0, 400);
    }
    return event;
  },

  advanceDays(profile: ProfileSave, days: number, rng = createRng(`legacy_adv_${days}`)): string[] {
    const legacy = this.ensure(profile);
    const lines: string[] = [];
    const amount = Math.max(0, Math.floor(days));
    if (!amount) return lines;
    legacy.timeline.totalDays += amount;
    legacy.timeline.day += amount;
    clampMonthDay(legacy.timeline);
    lines.push(
      `World time advances ${amount} day${amount === 1 ? "" : "s"} → Y${legacy.timeline.year}-M${legacy.timeline.month}-D${legacy.timeline.day}.`,
    );
    lines.push(...this.simulateOffscreen(profile, rng));
    return lines;
  },

  advanceYears(profile: ProfileSave, years: number, rng = createRng(`legacy_y_${years}`)): string[] {
    return this.advanceDays(profile, Math.max(0, Math.floor(years)) * DAYS_PER_YEAR, rng);
  },

  promote(
    profile: ProfileSave,
    character: WorldCharacter,
    options?: {
      tier?: LegacyPersistenceTier;
      birthYear?: number;
      locationId?: string;
      captainName?: string;
      importanceBonus?: number;
    },
  ): LegacyCharacterRecord {
    const legacy = this.ensure(profile);
    const existing = legacy.characters.find((c) => c.characterId === character.id);
    if (existing) {
      existing.character = structuredClone(character);
      existing.tier = "LEGACY";
      existing.importanceScore = Math.max(
        existing.importanceScore,
        50 + (options?.importanceBonus ?? 0),
      );
      if (options?.captainName) {
        existing.priorCrewCaptainNames = [
          ...new Set([...(existing.priorCrewCaptainNames ?? []), options.captainName]),
        ];
      }
      if (options?.locationId) {
        existing.lastKnownLocationId = options.locationId;
      }
      existing.updatedAt = nowIso();
      return existing;
    }
    const record: LegacyCharacterRecord = {
      characterId: character.id,
      tier: options?.tier ?? "LEGACY",
      character: structuredClone(character),
      birthYear: options?.birthYear ?? legacy.timeline.year - 20,
      status: character.alive === false ? "DEAD" : "ACTIVE",
      lastKnownLocationId: options?.locationId,
      priorCrewCaptainNames: options?.captainName ? [options.captainName] : [],
      parentIds: [],
      childIds: [],
      mentorId: null,
      apprenticeIds: [],
      fightingStyleIds: character.combatStyle ? [character.combatStyle] : [],
      appearanceHeritage: {
        hairColor: pick(createRng(character.id), HAIR),
        eyeColor: pick(createRng(`${character.id}_eye`), EYES),
        skinTone: pick(createRng(`${character.id}_skin`), SKIN),
        heightTendency: "AVERAGE",
        buildTendency: "ATHLETIC",
      },
      careerNotes: [],
      importanceScore: 50 + (options?.importanceBonus ?? 0),
      lastSimulatedTotalDays: legacy.timeline.totalDays,
      updatedAt: nowIso(),
    };
    legacy.characters.push(record);
    return record;
  },

  /** Core crew and important survivors → LEGACY at run end. */
  harvestRunEnd(profile: ProfileSave): void {
    const run = profile.activeRun;
    if (!run) return;
    const legacy = this.ensure(profile);
    for (const member of run.crew) {
      const character = CharacterService.getCharacter(run, member.characterId);
      if (!character) continue;
      const record = this.promote(profile, character, {
        tier: "LEGACY",
        locationId: run.currentLocationId,
        captainName: run.player.name,
        importanceBonus: 25,
        birthYear: legacy.timeline.year - 18 - Math.floor((character.strength ?? 4) / 2),
      });
      CharacterService.addMemory(run, member.characterId, "FORMER_CREWMATE", 4, run.player.name);
      if (!character.memories?.some((m) => m.type === "FORMER_CREWMATE")) {
        record.character.memories = [
          ...(record.character.memories ?? []),
          {
            type: "FORMER_CREWMATE",
            day: run.day,
            importance: 4,
            note: run.player.name,
          },
        ];
      }
      this.recordEvent(profile, {
        eventType: "CREW_SERVICE",
        summary: `${character.name} sailed under ${run.player.name}.`,
        characterIds: [character.id],
        locationId: run.currentLocationId,
        runId: run.id,
        importance: 3,
        visibility: "LOCAL",
      });
      if (character.combatStyle) {
        this.ensureStyleLineage(profile, character.combatStyle, character.id, character.name);
      }
    }

    // Sync survivors already written to persistentCharacters
    for (const entry of profile.persistentCharacters ?? []) {
      this.promote(profile, entry.character, {
        locationId: entry.lastKnownLocationId,
        captainName: entry.priorCrewCaptainNames?.[0],
        importanceBonus: 15,
      });
      const rec = this.getCharacter(profile, entry.character.id);
      if (rec && entry.lastRunEndId) {
        rec.lastRunEndId = entry.lastRunEndId;
      }
    }

    this.recordEvent(profile, {
      eventType: "RUN_END",
      summary: run.deathCause
        ? `Voyage of ${run.player.name} ended: ${run.deathCause}`
        : `Voyage of ${run.player.name} ended.`,
      characterIds: run.crew.map((m) => m.characterId),
      locationId: run.currentLocationId,
      runId: run.id,
      importance: 5,
      visibility: "PUBLIC",
      knowledgeTags: ["crew_loss", "history"],
    });
  },

  ensureStyleLineage(
    profile: ProfileSave,
    styleId: string,
    characterId: string,
    displayHint?: string,
  ): FightingStyleLineage {
    const legacy = this.ensure(profile);
    let lineage = legacy.styleLineages.find((s) => s.styleId === styleId);
    if (!lineage) {
      lineage = {
        id: createId("styleLin"),
        styleId,
        displayName: displayHint ? `${displayHint}'s ${styleId}` : styleId,
        founderId: characterId,
        masterIds: [characterId],
        practitionerIds: [characterId],
        reputation: 1,
      };
      legacy.styleLineages.push(lineage);
      this.recordEvent(profile, {
        eventType: "STYLE_FOUNDATION",
        summary: `Fighting style lineage begins: ${lineage.displayName}.`,
        characterIds: [characterId],
        importance: 3,
        visibility: "RUMORED",
        knowledgeTags: ["fighting_style", styleId],
      });
    } else if (!lineage.practitionerIds.includes(characterId)) {
      lineage.practitionerIds.push(characterId);
      lineage.reputation += 1;
    }
    const rec = this.getCharacter(profile, characterId);
    if (rec && !rec.fightingStyleIds?.includes(styleId)) {
      rec.fightingStyleIds = [...(rec.fightingStyleIds ?? []), styleId];
    }
    return lineage;
  },

  simulateOffscreen(profile: ProfileSave, rng: RandomService): string[] {
    const legacy = this.ensure(profile);
    const lines: string[] = [];
    for (const record of legacy.characters) {
      if (record.tier === "BACKGROUND") continue;
      if (record.status === "DEAD") continue;
      const elapsed = legacy.timeline.totalDays - record.lastSimulatedTotalDays;
      if (elapsed < DAYS_PER_YEAR) continue;
      record.lastSimulatedTotalDays = legacy.timeline.totalDays;
      const age = ageYears(record, legacy.timeline);

      if (record.status === "ACTIVE" && age >= 55 && rng.chance(0.35)) {
        record.status = "RETIRED";
        record.careerNotes = [...(record.careerNotes ?? []), "Retired from active adventuring"];
        record.character.memories = [
          ...(record.character.memories ?? []),
          {
            type: "RETIRED_AFTER_BATTLE",
            day: 0,
            importance: 3,
            note: `Retired around year ${legacy.timeline.year}`,
          },
        ];
        this.recordEvent(profile, {
          eventType: "RETIREMENT",
          summary: `${record.character.name} retires from the open sea.`,
          characterIds: [record.characterId],
          importance: 3,
          visibility: "LOCAL",
        });
        lines.push(`${record.character.name} has retired.`);
      }

      if (
        record.tier === "LEGACY" &&
        record.status === "ACTIVE" &&
        age >= 28 &&
        age <= 48 &&
        (record.childIds?.length ?? 0) < 2 &&
        rng.chance(0.22)
      ) {
        const child = this.generateChild(profile, record.characterId, rng);
        if (child) {
          lines.push(`${record.character.name} has a child: ${child.character.name}.`);
        }
      }

      if (
        record.tier === "LEGACY" &&
        (record.status === "ACTIVE" || record.status === "RETIRED") &&
        age >= 30 &&
        (record.apprenticeIds?.length ?? 0) < 2 &&
        rng.chance(0.18)
      ) {
        const apprentice = this.generateApprentice(profile, record.characterId, rng);
        if (apprentice) {
          lines.push(`${record.character.name} takes ${apprentice.character.name} as an apprentice.`);
        }
      }

      if (age >= 85 && rng.chance(0.4)) {
        this.killCharacter(profile, record.characterId, "Old age");
        lines.push(`${record.character.name} has passed away.`);
      }

      record.updatedAt = nowIso();
    }
    return lines;
  },

  generateChild(
    profile: ProfileSave,
    parentId: string,
    rng = createRng(`child_${parentId}`),
  ): LegacyCharacterRecord | null {
    const legacy = this.ensure(profile);
    const parent = this.getCharacter(profile, parentId);
    if (!parent || parent.status === "DEAD") return null;
    if ((parent.childIds?.length ?? 0) >= 3) return null;

    const first = pick(rng, CHILD_FIRST);
    const family = surnameFrom(parent.character.name);
    const childName = family
      ? rng.chance(0.55)
        ? `${first} of the ${family}`
        : `${first} ${family}`
      : first;
    const heritage = heritageFromParent(parent, rng);
    const styleId = parent.fightingStyleIds?.[0] ?? parent.character.combatStyle ?? undefined;
    const childNpc: WorldCharacter = {
      id: createId("legChild"),
      name: childName,
      faction: parent.character.faction,
      raceId: parent.character.raceId ?? "HUMAN",
      strength: Math.max(3, Math.min(12, (parent.character.strength ?? 5) + rng.nextInt(-2, 2))),
      bounty: 0,
      devilFruitId: null,
      alive: true,
      relationshipWithPlayer: 0,
      tags: ["legacy_descendant", `child_of_${parent.characterId}`],
      personality: pick(rng, [
        "Impatient and sharp-tongued",
        "Quietly proud",
        "Eager to prove themselves",
        "Reluctant about family fame",
        "Curious and restless",
      ]),
      goals: pick(rng, [
        ["Surpass their parent"],
        ["Find their own path"],
        ["Learn the old stories"],
        ["Reject the family trade"],
      ]),
      combatStyle: rng.chance(0.55) ? styleId : pick(rng, ["brawler", "swordsmanship", "black_leg"]),
      memories: [
        {
          type: "IS_DESCENDANT_OF",
          day: 0,
          importance: 5,
          note: parent.character.name,
        },
      ],
      importance: 3,
    };

    const child = this.promote(profile, childNpc, {
      tier: "LEGACY",
      birthYear: legacy.timeline.year - rng.nextInt(16, 22),
      locationId: parent.lastKnownLocationId,
      importanceBonus: 10,
    });
    child.appearanceHeritage = heritage;
    child.parentIds = [parent.characterId];
    parent.childIds = [...(parent.childIds ?? []), child.characterId];

    let familyLine = legacy.families.find((f) => f.memberIds.includes(parent.characterId));
    if (!familyLine) {
      familyLine = {
        id: createId("fam"),
        rootIds: [parent.characterId],
        memberIds: [parent.characterId, child.characterId],
        familyName: family ?? parent.character.name,
      };
      legacy.families.push(familyLine);
    } else if (!familyLine.memberIds.includes(child.characterId)) {
      familyLine.memberIds.push(child.characterId);
    }

    if (child.character.combatStyle) {
      this.ensureStyleLineage(profile, child.character.combatStyle, child.characterId, child.character.name);
    }

    this.recordEvent(profile, {
      eventType: "CHILD_BORN",
      summary: `${child.character.name} is born into the line of ${parent.character.name}.`,
      characterIds: [parent.characterId, child.characterId],
      importance: 4,
      visibility: "PRIVATE",
      knowledgeTags: ["family", "descendant"],
    });
    return child;
  },

  generateApprentice(
    profile: ProfileSave,
    mentorId: string,
    rng = createRng(`appr_${mentorId}`),
  ): LegacyCharacterRecord | null {
    const legacy = this.ensure(profile);
    const mentor = this.getCharacter(profile, mentorId);
    if (!mentor || mentor.status === "DEAD") return null;
    if ((mentor.apprenticeIds?.length ?? 0) >= 3) return null;

    const first = pick(rng, CHILD_FIRST);
    const styleId =
      mentor.fightingStyleIds?.[0] ?? mentor.character.combatStyle ?? "swordsmanship";
    const apprenticeNpc: WorldCharacter = {
      id: createId("legAppr"),
      name: first,
      faction: mentor.character.faction,
      raceId: "HUMAN",
      strength: Math.max(4, (mentor.character.strength ?? 6) - rng.nextInt(1, 3)),
      bounty: 0,
      devilFruitId: null,
      alive: true,
      relationshipWithPlayer: 0,
      tags: ["legacy_apprentice", `student_of_${mentor.characterId}`],
      personality: pick(rng, [
        "Disciplined and earnest",
        "Hot-headed mimic",
        "Thoughtful observer",
      ]),
      combatStyle: styleId,
      memories: [
        {
          type: "TRAINED_BY_MASTER",
          day: 0,
          importance: 4,
          note: mentor.character.name,
        },
        {
          type: "IS_APPRENTICE_OF",
          day: 0,
          importance: 5,
          note: mentor.character.name,
        },
      ],
      importance: 2,
    };

    const apprentice = this.promote(profile, apprenticeNpc, {
      tier: "LEGACY",
      birthYear: legacy.timeline.year - rng.nextInt(17, 25),
      locationId: mentor.lastKnownLocationId,
      importanceBonus: 8,
    });
    apprentice.mentorId = mentor.characterId;
    mentor.apprenticeIds = [...(mentor.apprenticeIds ?? []), apprentice.characterId];
    mentor.character.memories = [
      ...(mentor.character.memories ?? []),
      {
        type: "TAUGHT_APPRENTICE",
        day: 0,
        importance: 3,
        note: apprentice.character.name,
      },
    ];

    let mentorship = legacy.mentorships.find((m) => m.founderId === mentor.characterId || m.chain.includes(mentor.characterId));
    if (!mentorship) {
      mentorship = {
        id: createId("ment"),
        styleId,
        founderId: mentor.characterId,
        chain: [mentor.characterId, apprentice.characterId],
      };
      legacy.mentorships.push(mentorship);
    } else if (!mentorship.chain.includes(apprentice.characterId)) {
      mentorship.chain.push(apprentice.characterId);
    }

    this.ensureStyleLineage(profile, styleId, apprentice.characterId, mentor.character.name);
    this.recordEvent(profile, {
      eventType: "APPRENTICESHIP",
      summary: `${mentor.character.name} takes ${apprentice.character.name} as apprentice (${styleId}).`,
      characterIds: [mentor.characterId, apprentice.characterId],
      importance: 3,
      visibility: "LOCAL",
      knowledgeTags: ["mentor", "fighting_style", styleId],
    });
    return apprentice;
  },

  killCharacter(profile: ProfileSave, characterId: string, cause: string): void {
    const record = this.getCharacter(profile, characterId);
    if (!record || record.status === "DEAD") return;
    const legacy = this.ensure(profile);
    record.status = "DEAD";
    record.deathYear = legacy.timeline.year;
    record.character.alive = false;
    record.careerNotes = [...(record.careerNotes ?? []), `Died: ${cause}`];
    this.recordEvent(profile, {
      eventType: "DEATH",
      summary: `${record.character.name} dies (${cause}).`,
      characterIds: [characterId],
      importance: 4,
      visibility: "PUBLIC",
      knowledgeTags: ["history", "death"],
      consequences: ["posthumous_legacy"],
    });
  },

  retireCharacter(profile: ProfileSave, characterId: string): void {
    const record = this.getCharacter(profile, characterId);
    if (!record || record.status === "DEAD") return;
    record.status = "RETIRED";
    this.recordEvent(profile, {
      eventType: "RETIREMENT",
      summary: `${record.character.name} steps back from the voyage life.`,
      characterIds: [characterId],
      importance: 2,
      visibility: "LOCAL",
    });
  },

  /**
   * Inject living legacy characters into a new run world.
   * New protagonist does NOT inherit personal knowledge of them.
   */
  injectIntoRun(profile: ProfileSave, run: RunState): void {
    const legacy = this.ensure(profile);
    for (const record of legacy.characters) {
      if (record.tier === "BACKGROUND") continue;
      if (record.status === "DEAD") {
        // Keep dead figures in world only as non-alive historical refs when important
        if (record.importanceScore < 40) continue;
      }
      const existing = run.world.characters.find((c) => c.id === record.characterId);
      const snapshot = structuredClone(record.character);
      // Strip personal relationship with prior protagonists for the new captain.
      snapshot.relationshipWithPlayer = 0;
      snapshot.joinInterest = Math.min(snapshot.joinInterest ?? 0, 15);
      if (record.status === "DEAD") {
        snapshot.alive = false;
      }
      if (existing) {
        existing.memories = [...(existing.memories ?? []), ...(snapshot.memories ?? [])];
        existing.tags = [...new Set([...(existing.tags ?? []), ...(snapshot.tags ?? [])])];
        existing.personality = existing.personality ?? snapshot.personality;
        existing.combatStyle = existing.combatStyle ?? snapshot.combatStyle;
        existing.alive = snapshot.alive;
      } else {
        run.world.characters.push(snapshot);
      }
    }
  },

  /** Between-run time jump when starting a new voyage. */
  onNewRun(profile: ProfileSave, rng = createRng(`newrun_${profile.statistics.runsStarted}`)): string[] {
    const legacy = this.ensure(profile);
    const days = legacy.betweenRunDaysDefault;
    return this.advanceDays(profile, days, rng);
  },

  eventsForCharacter(profile: ProfileSave, characterId: string): LegacyEvent[] {
    return this.ensure(profile)
      .events.filter((e) => e.characterIds.includes(characterId))
      .sort((a, b) => b.worldTotalDays - a.worldTotalDays);
  },

  dialogueHints(profile: ProfileSave, characterId: string): string[] {
    const record = this.getCharacter(profile, characterId);
    if (!record) return [];
    const hints: string[] = [];
    const age = ageYears(record, this.ensure(profile).timeline);
    hints.push(`Age ~${age}`);
    if (record.status === "RETIRED") hints.push("Retired from the sea");
    if (record.status === "DEAD") hints.push("Deceased — history only");
    for (const captain of record.priorCrewCaptainNames ?? []) {
      hints.push(`Once sailed under ${captain}`);
    }
    for (const mem of record.character.memories ?? []) {
      if (mem.type === "PRIOR_CREW_WIPED" || mem.type === "CREW_DIED_WHILE_I_RECOVERED") {
        hints.push("Survived a crew that never came back");
      }
      if (mem.type === "IS_DESCENDANT_OF" && mem.note) {
        hints.push(`Child of ${mem.note}`);
      }
      if (mem.type === "TRAINED_BY_MASTER" && mem.note) {
        hints.push(`Trained by ${mem.note}`);
      }
    }
    for (const event of this.eventsForCharacter(profile, characterId).slice(0, 4)) {
      if (event.visibility === "PRIVATE") continue;
      hints.push(event.summary);
    }
    return hints;
  },

  familyTree(profile: ProfileSave, characterId: string): FamilyLineage | null {
    return (
      this.ensure(profile).families.find((f) => f.memberIds.includes(characterId)) ?? null
    );
  },

  mentorChain(profile: ProfileSave, characterId: string): MentorshipLineage | null {
    return (
      this.ensure(profile).mentorships.find((m) => m.chain.includes(characterId)) ?? null
    );
  },

  livingEncounterCandidates(profile: ProfileSave): LegacyCharacterRecord[] {
    return this.ensure(profile).characters.filter(
      (c) => c.tier !== "BACKGROUND" && c.status !== "DEAD" && c.character.alive !== false,
    );
  },

  summarize(profile: ProfileSave): string {
    const legacy = this.ensure(profile);
    const t = legacy.timeline;
    return [
      `World date: Y${t.year}-M${t.month}-D${t.day} (day ${t.totalDays})`,
      `Legacy characters: ${legacy.characters.length}`,
      `Events: ${legacy.events.length}`,
      `Families: ${legacy.families.length}`,
      `Mentorships: ${legacy.mentorships.length}`,
      `Style lineages: ${legacy.styleLineages.length}`,
    ].join("\n");
  },

  /**
   * Build a one-off meeting encounter for a living Legacy NPC.
   * New protagonist has no automatic personal history with them.
   */
  buildMeetingEncounter(profile: ProfileSave, characterId: string): Encounter | null {
    const record = this.getCharacter(profile, characterId);
    if (!record || record.status === "DEAD") return null;
    const name = record.character.name;
    const hints = this.dialogueHints(profile, characterId);
    const age = this.ageOf(profile, characterId) ?? 20;
    const canRecruit =
      record.status === "ACTIVE" && age < 50 && (record.character.joinInterest ?? 0) < 100;
    const canTrain = age >= 28 || record.status === "RETIRED";
    const historyBeat =
      hints.find((h) => /crew|survived|sailed|trained|child/i.test(h)) ??
      "They look like someone who has lived more than one life.";

    return {
      id: `legacy_meet_${characterId}`,
      title: name,
      category: "SOCIAL",
      tier: "MID",
      visual: { overlay: "LIGHT", background: "/backgrounds/port.png", variant: "parley" },
      description: `You cross paths with ${name}. The world seems to know them better than you do.`,
      weight: 0,
      bindCharacterId: characterId,
      regions: ["EAST_BLUE", "SOUTH_BLUE", "WEST_BLUE", "NORTH_BLUE", "GRAND_LINE"],
      dialogueBeats: [
        {
          speakerId: characterId,
          line: historyBeat.includes("Survived")
            ? "I woke up once and nobody came back. I still check the horizon for ghosts."
            : `People keep asking if I remember the old days. Depends who's asking.`,
        },
      ],
      choices: [
        {
          id: "ask_past",
          text: "Ask about their past",
          outcome: {
            text: `${name} shares a piece of their history:\n${hints.slice(0, 3).join("\n") || "They give little away."}`,
            addCharacterMemory: {
              characterId,
              type: "SHARED_SECRET",
              importance: 2,
              note: "Asked about the past",
            },
          },
        },
        {
          id: "ask_world",
          text: "Ask what the seas are like these days",
          outcome: {
            text: `${name} sketches routes, rumors, and old faction scars. Your map of the world grows sharper.`,
          },
        },
        ...(canTrain
          ? [
              {
                id: "ask_train",
                text: "Ask them to train you",
                timeCost: "LONG" as const,
                outcome: {
                  text: `${name} puts you through drills shaped by decades.`,
                  trainStat: "strength" as const,
                },
              },
            ]
          : []),
        {
          id: "spar",
          text: "Ask for a friendly spar",
          visual: { variant: "fight" as const },
          outcome: {
            text: `${name} grins. "Let's see what the new blood can do."`,
            combat: {
              enemyName: name,
              enemyStrength: Math.max(5, record.character.strength ?? 6),
              combatKind: "SPARRING" as const,
              isFriendly: true,
              requireSetup: true,
              enemyCount: 1,
              battleFormat: {
                ...BATTLE_FORMATS.DUEL_1V1,
                isFriendly: true,
                stakesAllowed: true,
                label: "Friendly Match",
                playerChoosesParticipants: true,
              },
              wager: { type: "NONE" as const, label: "Just training" },
              canEscape: false,
              canSurrender: false,
              win: { text: `${name} nods, impressed.` },
              lose: { text: `${name} helps you up. "Again, sometime."`, hpChange: -2 },
            },
          },
        },
        ...(canRecruit
          ? [
              {
                id: "ask_join",
                text: "Ask them to sail with you",
                outcome: {
                  text:
                    age > 40
                      ? `${name} shakes their head. "I've got my own road. Temporary help, maybe — not a permanent berth."`
                      : `${name} considers the offer carefully.`,
                  ...(age <= 40
                    ? {
                        acceptRecruitment: {
                          characterId,
                          role: (record.character.crewRole ?? "FIGHTER") as CrewRole,
                          membership: "ALLY" as const,
                        },
                      }
                    : {}),
                },
              },
            ]
          : []),
        {
          id: "leave",
          text: "Part ways",
          outcome: {
            text: `You leave ${name} to their own course.`,
          },
        },
      ],
    };
  },
};
