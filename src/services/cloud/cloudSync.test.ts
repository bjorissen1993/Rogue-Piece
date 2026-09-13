import { describe, expect, it } from "vitest";

/** Mirrors server revision rule used by CloudSync. */
function canAcceptRevision(serverRevision: number, expectedRevision: number): boolean {
  return serverRevision === expectedRevision;
}

describe("cloud revision policy", () => {
  it("rejects stale client revisions", () => {
    expect(canAcceptRevision(42, 41)).toBe(false);
    expect(canAcceptRevision(41, 41)).toBe(true);
  });
});
