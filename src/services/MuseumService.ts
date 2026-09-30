import type { LegacyCharacterRecord, ProfileSave } from "../models/types";
import { LegacyService } from "./LegacyService";

/** Only deceased / historical people. No living descendants. No ??? placeholders. */
export const MuseumService = {
  exhibits(profile: ProfileSave): LegacyCharacterRecord[] {
    return LegacyService.ensure(profile)
      .characters.filter((row) => row.status === "DEAD" || row.historical)
      .sort((a, b) => b.importanceScore - a.importanceScore);
  },

  markHistorical(profile: ProfileSave, characterId: string): void {
    const record = LegacyService.getCharacter(profile, characterId);
    if (!record || record.status !== "DEAD") {
      return;
    }
    record.historical = true;
  },
};
