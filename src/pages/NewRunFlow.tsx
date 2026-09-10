import { useMemo } from "react";
import { LOCATIONS } from "../data/locations";
import { originsForRace } from "../data/origins";
import { getRace } from "../data/races";
import { useGameStore } from "../stores/GameStore";

export function NewRunFlow() {
  const {
    profile,
    newRunStep,
    setNewRunStep,
    raceOffers,
    selectedRaceId,
    setSelectedRaceId,
    selectedOriginId,
    setSelectedOriginId,
    selectedLocationId,
    setSelectedLocationId,
    characterName,
    setCharacterName,
    launchRun,
    openPlay,
  } = useGameStore();

  const origins = useMemo(() => originsForRace(selectedRaceId), [selectedRaceId]);
  const locations = useMemo(
    () =>
      LOCATIONS.filter((location) =>
        profile?.progression.unlockedStartingLocations.includes(location.id),
      ),
    [profile],
  );
  const race = getRace(selectedRaceId);
  const validName = characterName.trim().length >= 2 && characterName.trim().length <= 24;

  if (!profile) {
    return null;
  }

  return (
    <div className="screen-shell screen-select">
      <p className="hud-kicker">New Run</p>
      <h1 className="font-display mt-2 text-4xl text-gold">
        {newRunStep === "race"
          ? "Choose Race"
          : newRunStep === "origin"
            ? "Choose Origin"
            : newRunStep === "location"
              ? "Starting Location"
              : "Name"}
      </h1>
      <p className="mt-2 max-w-2xl text-parchment-dim">
        {newRunStep === "race"
          ? "Human is always offered. Other slots are a limited draw from races this profile has made playable."
          : newRunStep === "origin"
            ? `${race?.name ?? "This race"} does not share backgrounds with every other people.`
            : newRunStep === "location"
              ? "Location is not cosmetic. It chooses the waters you sail."
              : "The papers will need a name."}
      </p>

      {newRunStep === "race" ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {raceOffers.map((item) => (
            <button
              className={`select-card panel p-4 ${selectedRaceId === item.id ? "is-selected" : ""}`}
              key={item.id}
              onClick={() => {
                setSelectedRaceId(item.id);
                const first = originsForRace(item.id)[0];
                if (first) {
                  setSelectedOriginId(first.id);
                }
              }}
              type="button"
            >
              <p className="font-display text-2xl">{item.name}</p>
              <p className="mt-2 text-sm text-parchment-dim">{item.description}</p>
            </button>
          ))}
        </div>
      ) : null}

      {newRunStep === "origin" ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {origins.map((item) => (
            <button
              className={`select-card panel p-4 ${selectedOriginId === item.id ? "is-selected" : ""}`}
              key={item.id}
              onClick={() => setSelectedOriginId(item.id)}
              type="button"
            >
              <p className="font-display text-2xl">{item.name}</p>
              <p className="mt-2 text-sm text-parchment-dim">{item.description}</p>
              <p className="mt-3 text-xs text-gold">
                Str {item.stats.strength} · Def {item.stats.defense} · Spd {item.stats.speed} · Will{" "}
                {item.stats.willpower} · Cha {item.stats.charisma}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {newRunStep === "location" ? (
        <div className="mt-6 grid gap-3">
          {locations.map((item) => (
            <button
              className={`select-card panel p-4 ${selectedLocationId === item.id ? "is-selected" : ""}`}
              key={item.id}
              onClick={() => setSelectedLocationId(item.id)}
              type="button"
            >
              <p className="font-display text-2xl">{item.name}</p>
              <p className="text-xs text-gold">{item.regionId.replace("_", " ")}</p>
              <p className="mt-2 text-sm text-parchment-dim">{item.description}</p>
            </button>
          ))}
        </div>
      ) : null}

      {newRunStep === "name" ? (
        <label className="mt-8 block max-w-md text-sm text-gold">
          Name
          <input
            className="mt-2 w-full rounded-xl border border-gold/30 bg-ink px-4 py-3 text-parchment outline-none focus:border-gold"
            maxLength={24}
            onChange={(event) => setCharacterName(event.target.value)}
            placeholder="Your name on the sea"
            value={characterName}
          />
        </label>
      ) : null}

      <div className="mt-8 flex gap-3">
        <button
          className="ghost-btn"
          onClick={() => {
            if (newRunStep === "race") {
              openPlay();
            } else if (newRunStep === "origin") {
              setNewRunStep("race");
            } else if (newRunStep === "location") {
              setNewRunStep("origin");
            } else {
              setNewRunStep("location");
            }
          }}
          type="button"
        >
          Back
        </button>
        {newRunStep === "name" ? (
          <button className="gold-btn" disabled={!validName} onClick={launchRun} type="button">
            Start Journey
          </button>
        ) : (
          <button
            className="gold-btn"
            onClick={() => {
              if (newRunStep === "race") {
                const first = originsForRace(selectedRaceId)[0];
                if (first) {
                  setSelectedOriginId(first.id);
                }
                setNewRunStep("origin");
              } else if (newRunStep === "origin") {
                setNewRunStep("location");
              } else {
                setNewRunStep("name");
              }
            }}
            type="button"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
