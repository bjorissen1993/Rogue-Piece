import type {
  PersistentCharacterRecord,
  ProfileSave,
  RunEndEvent,
  RunEndSurvivorRecord,
  RunState,
  WorldCharacter,
} from "../models/types";
import { createId, nowIso } from "../utils/ids";
import { CharacterScheduleService } from "./CharacterScheduleService";
import { CharacterService } from "./CharacterService";
import { MedicalRecoveryService } from "./MedicalRecoveryService";
import { PartyCombatService } from "./PartyCombatService";

function upsertPersistent(profile: ProfileSave, record: PersistentCharacterRecord): void {
  if (!profile.persistentCharacters) {
    profile.persistentCharacters = [];
  }
  const index = profile.persistentCharacters.findIndex(
    (entry) => entry.character.id === record.character.id,
  );
  if (index >= 0) {
    const prev = profile.persistentCharacters[index]!;
    profile.persistentCharacters[index] = {
      ...record,
      priorCrewCaptainNames: [
        ...new Set([...(prev.priorCrewCaptainNames ?? []), ...(record.priorCrewCaptainNames ?? [])]),
      ],
      character: {
        ...prev.character,
        ...record.character,
        memories: [...(prev.character.memories ?? []), ...(record.character.memories ?? [])],
        tags: [...new Set([...(prev.character.tags ?? []), ...(record.character.tags ?? [])])],
        unlockedTechniques: [
          ...new Set([
            ...(prev.character.unlockedTechniques ?? []),
            ...(record.character.unlockedTechniques ?? []),
          ]),
        ],
        weaponIds: [
          ...new Set([...(prev.character.weaponIds ?? []), ...(record.character.weaponIds ?? [])]),
        ],
      },
    };
  } else {
    profile.persistentCharacters.push(record);
  }
}

function cloneCharacter(character: WorldCharacter): WorldCharacter {
  return structuredClone(character);
}

export const RunEndResolutionService = {
  /**
   * Call when a run is about to end (game over). Records survivors who were
   * hospitalized / recovering / absent, attaches crew-loss memories, archives the event.
   */
  resolve(profile: ProfileSave): RunEndEvent | null {
    const run = profile.activeRun;
    if (!run) return null;

    const presentIds = new Set<string>();
    if (run.combat) {
      for (const ally of PartyCombatService.allAllies(run.combat)) {
        presentIds.add(ally.id === run.combat.playerCombatant.id ? "player" : ally.id);
      }
    } else {
      presentIds.add("player");
      for (const member of run.crew) {
        if (member.inActiveParty !== false) {
          presentIds.add(member.characterId);
        }
      }
    }

    const survivors: RunEndSurvivorRecord[] = [];
    const absentIds: string[] = [];

    for (const member of run.crew) {
      const character = CharacterService.getCharacter(run, member.characterId);
      if (!character || !character.alive) continue;

      const assignment = CharacterScheduleService.getAssignment(run, member.characterId);
      const wasPresent = presentIds.has(member.characterId);
      let fate: RunEndSurvivorRecord["fate"] = "DEFEATED";
      let note: string | undefined;

      if (assignment?.type === "HOSPITALIZED") {
        fate = "SURVIVED_HOSPITAL";
        note = `Left recovering at ${assignment.locationId ?? run.currentLocationId}`;
        CharacterService.addMemory(
          run,
          member.characterId,
          "WAS_LEFT_RECOVERING",
          5,
          note,
        );
        CharacterService.addMemory(run, member.characterId, "SURVIVED_RUN_LOSS", 5);
        CharacterService.addMemory(
          run,
          member.characterId,
          "CREW_DIED_WHILE_I_RECOVERED",
          5,
          `Crew under ${run.player.name} was lost on day ${run.day}`,
        );
        CharacterService.addMemory(
          run,
          member.characterId,
          "LOST_ENTIRE_CREW",
          4,
          run.player.name,
        );
        CharacterService.addMemory(run, member.characterId, "PRIOR_CREW_WIPED", 5);
        character.relationshipWithPlayer = Math.max(-20, (character.relationshipWithPlayer ?? 0) - 2);
      } else if (assignment?.type === "RECOVERING" && !wasPresent) {
        fate = "SURVIVED_RECOVERING";
        note = "Was recovering away from the final fight";
        CharacterService.addMemory(run, member.characterId, "SURVIVED_RUN_LOSS", 4);
        CharacterService.addMemory(run, member.characterId, "CREW_DIED_WHILE_I_RECOVERED", 4);
        CharacterService.addMemory(run, member.characterId, "PRIOR_CREW_WIPED", 4);
      } else if (
        assignment?.type === "ON_MISSION" ||
        assignment?.type === "MISSING" ||
        member.status === "Missing" ||
        (!wasPresent && CharacterScheduleService.isAvailable(run, member.characterId) === false)
      ) {
        if (!wasPresent) {
          fate = "SURVIVED_ABSENT";
          absentIds.push(member.characterId);
          CharacterService.addMemory(run, member.characterId, "SURVIVED_RUN_LOSS", 3);
          CharacterService.addMemory(run, member.characterId, "CREW_FOUGHT_WITHOUT_ME", 3);
          CharacterService.addMemory(run, member.characterId, "PRIOR_CREW_WIPED", 3);
        }
      } else if (!wasPresent) {
        fate = "SURVIVED_ABSENT";
        absentIds.push(member.characterId);
        CharacterService.addMemory(run, member.characterId, "SURVIVED_RUN_LOSS", 3);
        CharacterService.addMemory(run, member.characterId, "PRIOR_CREW_WIPED", 3);
      }

      if (fate === "DEFEATED") {
        survivors.push({
          characterId: member.characterId,
          name: character.name,
          fate: "DEFEATED",
          locationId: run.currentLocationId,
          note: wasPresent ? "Present for the final defeat" : note,
        });
        continue;
      }

      survivors.push({
        characterId: member.characterId,
        name: character.name,
        fate,
        locationId: assignment?.locationId ?? run.currentLocationId,
        note,
      });

      const record: PersistentCharacterRecord = {
        character: cloneCharacter(character),
        survivalStatus: "ALIVE",
        lastKnownLocationId: assignment?.locationId ?? run.currentLocationId,
        lastKnownIslandId: assignment?.islandId ?? run.currentIslandId ?? undefined,
        lastKnownLocationName: run.currentLocationId,
        priorCrewCaptainNames: [run.player.name],
        updatedAt: nowIso(),
      };
      upsertPersistent(profile, record);
    }

    const enemyName = run.combat?.enemies[0]?.name;
    const worldNews = `${run.player.name}'s crew is said to have fallen near ${run.currentLocationId}${
      enemyName ? ` after clashing with ${enemyName}` : ""
    }.`;

    run.world.history = run.world.history ?? [];
    run.world.history.push({
      id: createId("hist"),
      day: run.day,
      text: worldNews,
      importance: 4,
    });

    const event: RunEndEvent = {
      id: createId("runend"),
      day: run.day,
      locationId: run.currentLocationId,
      captainName: run.player.name,
      cause: run.deathCause ?? "Crew wiped out",
      enemyName,
      combatKind: run.combat?.combatKind,
      presentCharacterIds: [...presentIds],
      absentCharacterIds: absentIds,
      survivors,
      worldNews,
      createdAt: nowIso(),
    };

    for (const record of profile.persistentCharacters ?? []) {
      if (survivors.some((entry) => entry.characterId === record.character.id && entry.fate.startsWith("SURVIVED"))) {
        record.lastRunEndId = event.id;
      }
    }

    if (!profile.runEndHistory) {
      profile.runEndHistory = [];
    }
    profile.runEndHistory.push(event);
    if (profile.runEndHistory.length > 40) {
      profile.runEndHistory = profile.runEndHistory.slice(-40);
    }

    return event;
  },

  /** True when hospitalized crew should survive a wipe that ends the run. */
  hospitalizedSurvivors(run: RunState): string[] {
    return (run.characterAssignments ?? [])
      .filter((entry) => entry.type === "HOSPITALIZED" && entry.characterId !== "player")
      .map((entry) => entry.characterId);
  },

  ensureUsableTeamOrEnd(run: RunState, cause: string): boolean {
    MedicalRecoveryService.stabilizeCaptainIfCrewRemains(run);
    if (MedicalRecoveryService.shouldEndRunAfterWipe(run)) {
      run.gameOver = true;
      run.deathCause = run.deathCause ?? cause;
      run.player.hp = 0;
      return true;
    }
    return false;
  },
};
