import { describe, expect, it } from "vitest";
import { canAcceptRevision, summarizeProfile, validateProfileSave } from "./profileBlob.js";

describe("profileBlob", () => {
  it("accepts a minimal ProfileSave-shaped document", () => {
    const result = validateProfileSave({
      version: 17,
      id: "slot_1",
      profileType: "NORMAL",
      progression: {},
      activeRun: null,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing progression", () => {
    const result = validateProfileSave({
      version: 17,
      id: "slot_1",
      profileType: "NORMAL",
      activeRun: null,
    });
    expect(result.ok).toBe(false);
  });

  it("summarizes active run and legacy counts", () => {
    const summary = summarizeProfile({
      activeRun: { player: { name: "Bowie", bounty: 100 }, day: 12, gameOver: false },
      statistics: { runsStarted: 3 },
      legacy: { characters: [{}, {}], timeline: { year: 1547 } },
    });
    expect(summary).toMatchObject({
      hasActiveRun: true,
      name: "Bowie",
      day: 12,
      runsStarted: 3,
      legacyCharacters: 2,
      legacyYear: 1547,
    });
  });
});

describe("revision conflicts", () => {
  it("allows matching revisions only", () => {
    expect(canAcceptRevision(41, 41)).toBe(true);
    expect(canAcceptRevision(42, 41)).toBe(false);
  });
});
