import { describe, expect, it } from "vitest";
import { ISLAND_HUB_FOCUS_ZOOM, resolveIslandHubMapFocus } from "./IslandHubMap";

describe("resolveIslandHubMapFocus", () => {
  it("stays null on fresh hub enter (no radial open)", () => {
    expect(resolveIslandHubMapFocus(false, null)).toBeNull();
    expect(resolveIslandHubMapFocus(false, { open: false, xPct: 40, yPct: 50 })).toBeNull();
  });

  it("stays null while editing even if a menu flag is open", () => {
    expect(resolveIslandHubMapFocus(true, { open: true, xPct: 40, yPct: 50 })).toBeNull();
  });

  it("returns focus only while a parent radial is open in play mode", () => {
    expect(resolveIslandHubMapFocus(false, { open: true, xPct: 40, yPct: 50 })).toEqual({
      xPct: 40,
      yPct: 50,
      scale: ISLAND_HUB_FOCUS_ZOOM,
    });
  });
});
