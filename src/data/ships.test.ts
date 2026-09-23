import { describe, expect, it } from "vitest";
import { DEFAULT_SHIP_CARGO_CAPACITY, DEFAULT_SHIP_HULL_ID } from "../game/constants";
import { MAP_CHILD_ACTIONS } from "./islandMaps";
import {
  shipArtSrc,
  shipCargoCapacity,
  shipCargoUsed,
  shipOverlayOpensHold,
  shipScreenTabForChild,
  SHIP_ART_SRC,
} from "./ships";

describe("Ship screen helpers", () => {
  it("maps hull ids to /icons/Ships art and falls back to Ship1", () => {
    expect(DEFAULT_SHIP_HULL_ID).toBe("Ship1");
    expect(shipArtSrc()).toBe("/icons/Ships/Ship1.png");
    expect(shipArtSrc("Ship1")).toBe(SHIP_ART_SRC.Ship1);
    expect(shipArtSrc("Ship3")).toBe("/icons/Ships/Ship3.png");
    expect(shipArtSrc({ name: "X", speed: 1, condition: 100 })).toBe(SHIP_ART_SRC.Ship1);
    expect(shipArtSrc({ name: "X", speed: 1, condition: 100, hullId: "Ship4" })).toBe(
      SHIP_ART_SRC.Ship4,
    );
    expect(shipArtSrc("not-a-hull")).toBe(SHIP_ART_SRC.Ship1);
  });

  it("counts hold load against cargo capacity", () => {
    expect(shipCargoUsed([])).toBe(0);
    expect(
      shipCargoUsed([
        { id: "a", name: "Rope", type: "MATERIAL", description: "", quantity: 3 },
        { id: "b", name: "Rum", type: "CONSUMABLE", description: "" },
      ]),
    ).toBe(4);
    expect(shipCargoCapacity({ name: "X", speed: 1, condition: 100 })).toBe(
      DEFAULT_SHIP_CARGO_CAPACITY,
    );
    expect(shipCargoCapacity({ name: "X", speed: 1, condition: 100, cargoCapacity: 12 })).toBe(12);
  });

  it("Harbor Ship opens the vessel tab; Cargo focuses the hold", () => {
    expect(MAP_CHILD_ACTIONS.HARBOR_SHIP.resolve).toEqual({ type: "overlay", overlay: "ship" });
    expect(MAP_CHILD_ACTIONS.HARBOR_CARGO.resolve).toEqual({
      type: "overlay",
      overlay: "ship",
      focus: "cargo",
    });
    expect(MAP_CHILD_ACTIONS.HARBOR_DEPART.resolve).toEqual({
      type: "hub_choice",
      choiceId: "harbor",
    });
    expect(MAP_CHILD_ACTIONS.HARBOR_INVENTORY.resolve).toEqual({
      type: "overlay",
      overlay: "inventory",
    });
    expect(shipScreenTabForChild("HARBOR_SHIP")).toBe("vessel");
    expect(shipScreenTabForChild("HARBOR_CARGO")).toBe("cargo");
    expect(shipOverlayOpensHold(undefined)).toBe("vessel");
    expect(shipOverlayOpensHold("cargo")).toBe("cargo");
  });
});
