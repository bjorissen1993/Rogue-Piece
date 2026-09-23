import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptyProfile } from "../game/createGame";
import { RACES, raceArtSrc } from "../data/races";
import { RaceService } from "./RaceService";
import { createRng } from "./RandomService";

describe("Development race offers", () => {
  it("unlocks every race on the Development profile and keeps Normal limited", () => {
    const dev = createEmptyProfile("dev", "DEVELOPMENT");
    const normal = createEmptyProfile("slot_1", "NORMAL");
    expect(RaceService.getPlayableRaces(dev)).toHaveLength(RACES.length);
    expect(RaceService.isPlayable(dev, "LUNARIAN")).toBe(true);
    expect(RaceService.rollRaceOffers(dev, createRng("dev-races")).offers).toHaveLength(RACES.length);

    const normalPlayable = RaceService.getPlayableRaces(normal);
    expect(normalPlayable.some((race) => race.id === "HUMAN")).toBe(true);
    expect(normalPlayable.length).toBeLessThan(RACES.length);
    expect(RaceService.isPlayable(normal, "LUNARIAN")).toBe(false);
  });

  it("maps each race id to authoring art under /icons/Races", () => {
    for (const race of RACES) {
      expect(raceArtSrc(race.id)).toMatch(/^\/icons\/Races\/Race_.+\.png$/);
    }
    expect(raceArtSrc("FISH_MAN")).toBe("/icons/Races/Race_Fishmen.png");
    expect(raceArtSrc("SKY_PERSON")).toBe("/icons/Races/Race_SkyPeople.png");
    expect(raceArtSrc("THREE_EYE")).toBe("/icons/Races/Race_ThreeEyed.png");
    expect(raceArtSrc("TONTATTA")).toBe("/icons/Races/Race_TontattaDwarf.png");
  });

  it("has a public icon file for every mapped race portrait", () => {
    for (const race of RACES) {
      const file = raceArtSrc(race.id).replace(/^\//, "");
      expect(existsSync(resolve(process.cwd(), "public", file))).toBe(true);
    }
  });
});
