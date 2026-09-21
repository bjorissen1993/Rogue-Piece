import { describe, expect, it } from "vitest";
import { splitCharacterDisplayName } from "./text";

describe("splitCharacterDisplayName", () => {
  it("keeps simple names without a title", () => {
    expect(splitCharacterDisplayName("Ren")).toEqual({ name: "Ren" });
    expect(splitCharacterDisplayName("Bowie")).toEqual({ name: "Bowie" });
  });

  it("splits of-the epithets from the display name", () => {
    expect(splitCharacterDisplayName("Mika of the Coast")).toEqual({
      name: "Mika",
      title: "of the Coast",
    });
  });

  it("prefers an explicit epithet field", () => {
    expect(splitCharacterDisplayName("Mika", "The Hammer")).toEqual({
      name: "Mika",
      title: "The Hammer",
    });
  });

  it("splits quoted nicknames", () => {
    expect(splitCharacterDisplayName('Ash "Red Fang"')).toEqual({
      name: "Ash",
      title: "Red Fang",
    });
  });

  it("splits the-style titles", () => {
    expect(splitCharacterDisplayName("Kael the Quiet")).toEqual({
      name: "Kael",
      title: "the Quiet",
    });
  });
});
