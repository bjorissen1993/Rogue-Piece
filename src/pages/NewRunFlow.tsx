import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChoiceWheel, CHOICE_WHEEL_ICON_SIZE, WHEEL_ANIM_MS, type ChoiceWheelOption } from "../components/ChoiceWheel";
import { HudArt } from "../components/HudIcons";
import { StatIcon } from "../components/StatIcon";
import type { StatName } from "../models/types";
import { LOCATIONS } from "../data/locations";
import { useIsMobile } from "../hooks/useMediaQuery";
import { originsForRace } from "../data/origins";
import { HUMAN_RACE_ID, RACES, getRace, raceArtSrc } from "../data/races";
import { RaceService } from "../services/RaceService";
import { useGameStore } from "../stores/GameStore";

const ORIGIN_STAT_ORDER: StatName[] = [
  "strength",
  "defense",
  "speed",
  "willpower",
  "charisma",
  "intelligence",
];

function originRowSizes(count: number): number[] {
  if (count <= 0) {
    return [];
  }
  if (count <= 3) {
    return [count];
  }
  const full = Math.floor(count / 3);
  const rest = count % 3;
  if (rest === 0) {
    return Array.from({ length: full }, () => 3);
  }
  if (rest === 2) {
    return [...Array.from({ length: full }, () => 3), 2];
  }
  return [...Array.from({ length: full - 1 }, () => 3), 2, 2];
}

function chunkOrigins<T>(items: T[]): T[][] {
  const sizes = originRowSizes(items.length);
  const rows: T[][] = [];
  let index = 0;
  for (const size of sizes) {
    rows.push(items.slice(index, index + size));
    index += size;
  }
  return rows;
}

function raceAvailabilityLabel(offered: boolean, playable: boolean): string {
  if (offered) {
    return "Playable";
  }
  return playable ? "Not offered this voyage" : "Locked";
}

function raceDisplayName(name: string, unlocked: boolean): string {
  return unlocked ? name : "???";
}

function raceTitleFontSize(name: string): string {
  const units = Math.max(name.length, 5);
  const scale = Math.min(1, 5 / units);
  return `calc(clamp(9.25rem, 16vw, 12.75rem) * ${scale})`;
}

function RaceNameFit({ name }: { name: string }) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const fontSize = raceTitleFontSize(name);

  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) {
      return;
    }

    const fit = () => {
      el.style.fontSize = fontSize;
      const available = el.clientWidth;
      if (available <= 0) {
        return;
      }
      if (el.scrollWidth > available + 1) {
        const current = Number.parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.max(22, current * (available / el.scrollWidth))}px`;
      }
      const block = el.parentElement;
      if (block) {
        block.style.fontSize = getComputedStyle(el).fontSize;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [fontSize, name]);

  return (
    <span className="race-choice-titleblock">
      <span className="race-choice-name" ref={nameRef} style={{ fontSize }}>
        {name}
      </span>
    </span>
  );
}

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
  const offeredIds = useMemo(() => {
    const ids = new Set(raceOffers.map((item) => item.id));
    ids.add(HUMAN_RACE_ID);
    return ids;
  }, [raceOffers]);
  const playableIds = useMemo(
    () => new Set(profile ? RaceService.getPlayableRaces(profile).map((item) => item.id) : [HUMAN_RACE_ID]),
    [profile],
  );
  const race = getRace(selectedRaceId);
  const validName = characterName.trim().length >= 2 && characterName.trim().length <= 24;
  const isDevProfile = profile?.profileType === "DEVELOPMENT";
  const [focusedRaceId, setFocusedRaceId] = useState(selectedRaceId);
  const [titleRaceId, setTitleRaceId] = useState(selectedRaceId);
  const [leavingRaceId, setLeavingRaceId] = useState<string | null>(null);
  const focusedRace = getRace(focusedRaceId) ?? race;
  const titleRace = getRace(titleRaceId) ?? focusedRace;
  const leavingRace = leavingRaceId ? getRace(leavingRaceId) : undefined;
  const focusedOffered = offeredIds.has(focusedRaceId);
  const isMobile = useIsMobile();
  const artSize = CHOICE_WHEEL_ICON_SIZE * 3;
  const leaveTimer = useRef<number>(0);

  const pickRace = useCallback(
    (raceId: string) => {
      if (!offeredIds.has(raceId)) {
        return;
      }
      setSelectedRaceId(raceId);
      const first = originsForRace(raceId)[0];
      if (first) {
        setSelectedOriginId(first.id);
      }
    },
    [offeredIds, setSelectedOriginId, setSelectedRaceId],
  );

  const handleRaceFocus = useCallback(
    (option: ChoiceWheelOption | null) => {
      if (!option) {
        return;
      }
      if (option.id !== titleRaceId) {
        setLeavingRaceId(titleRaceId);
        setTitleRaceId(option.id);
        window.clearTimeout(leaveTimer.current);
        leaveTimer.current = window.setTimeout(() => setLeavingRaceId(null), WHEEL_ANIM_MS);
      }
      setFocusedRaceId(option.id);
      pickRace(option.id);
    },
    [pickRace, titleRaceId],
  );

  const raceOptions = useMemo<ChoiceWheelOption[]>(
    () =>
      RACES.map((item) => {
        const offered = offeredIds.has(item.id);
        const playable = playableIds.has(item.id);
        return {
          id: item.id,
          title: item.name,
          costLabel: raceAvailabilityLabel(offered, playable),
          hint: item.description,
          disabled: !offered,
          selected: selectedRaceId === item.id,
          icon: (
            <HudArt
              className={item.id === "TONTATTA" ? "is-tontatta-art" : undefined}
              size={artSize}
              src={raceArtSrc(item.id)}
            />
          ),
          onConfirm: () => pickRace(item.id),
        };
      }),
    [artSize, offeredIds, pickRace, playableIds, selectedRaceId],
  );

  if (!profile) {
    return null;
  }

  return (
    <div
      className={`screen-shell screen-select${newRunStep === "race" ? " is-race-step" : ""}${newRunStep === "origin" ? " is-origin-step" : ""}`}
    >
      <header className="new-run-heading">
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
        <p className="new-run-lede mt-2 max-w-2xl text-parchment-dim">
          {newRunStep === "race"
            ? isDevProfile
              ? "Development profile — every race is unlocked. Browse the gallery and pick one."
              : "Human is always offered. Other slots are a limited draw from races this profile has made playable."
            : newRunStep === "origin"
              ? `${race?.name ?? "This race"} does not share backgrounds with every other people.`
              : newRunStep === "location"
                ? "Location is not cosmetic. It chooses the waters you sail."
                : "The papers will need a name."}
        </p>
      </header>

      {newRunStep === "race" ? (
        <div className="race-choice-stage">
          <div className="race-choice-hero">
            <ChoiceWheel
              alignFocus="center"
              className="race-choice-wheel"
              onFocusChange={handleRaceFocus}
              onHoverHint={() => undefined}
              options={raceOptions}
              showBadges={false}
              showConfirmButton={false}
              showFocusLabel={false}
              stepRem={isMobile ? 12 : 31}
              tripleFocus
            />
            <div className="race-choice-titles">
              {leavingRace ? (
                <div className="race-choice-title-slot is-leave" key={`leave-${leavingRace.id}`}>
                  <RaceNameFit name={raceDisplayName(leavingRace.name, playableIds.has(leavingRace.id))} />
                </div>
              ) : null}
              {titleRace ? (
                <div className="race-choice-title-slot is-enter" key={`enter-${titleRace.id}`}>
                  <RaceNameFit name={raceDisplayName(titleRace.name, playableIds.has(titleRace.id))} />
                </div>
              ) : null}
            </div>
          </div>
          {focusedRace ? (
            <p className="race-choice-caption" key={focusedRace.id}>
              {focusedOffered
                ? focusedRace.description
                : playableIds.has(focusedRace.id)
                  ? "Playable, but not among this voyage's offered slots."
                  : "Not yet made playable on this profile."}
            </p>
          ) : null}
        </div>
      ) : null}

      {newRunStep === "origin" ? (
        <div className="origin-choice-board">
          {chunkOrigins(origins).map((row) => (
            <div className="origin-choice-row" key={row.map((item) => item.id).join("-")}>
              {row.map((item) => (
                <button
                  className={`origin-choice-card ${selectedOriginId === item.id ? "is-selected" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedOriginId(item.id)}
                  type="button"
                >
                  <h2 className="origin-choice-card-title">{item.name}</h2>
                  <p className="origin-choice-card-copy">{item.description}</p>
                  <ul className="origin-choice-stats">
                    {ORIGIN_STAT_ORDER.map((stat) => (
                      <li key={stat}>
                        <StatIcon showTooltip size={36} stat={stat} />
                        {item.stats[stat]}
                      </li>
                    ))}
                  </ul>
                  <p className="origin-choice-berries">Starting purse · ฿{item.berries}</p>
                </button>
              ))}
            </div>
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

      <div className="new-run-actions mt-8 flex gap-3">
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
            disabled={newRunStep === "race" && !focusedOffered}
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
