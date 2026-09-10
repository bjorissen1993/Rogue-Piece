import type { OriginDefinition } from "../models/types";

export const ORIGINS: OriginDefinition[] = [
  {
    id: "STREET_KID",
    name: "Street Kid",
    description: "You grew up running alleys and rooftops. Fast, hungry, and used to disappearing.",
    raceIds: ["HUMAN"],
    stats: { strength: 2, defense: 2, speed: 4, willpower: 3, charisma: 2, intelligence: 4 },
    berries: 500,
  },
  {
    id: "DOJO_STUDENT",
    name: "Dojo Student",
    description: "Years of drills left you sturdy and sharp. Money is tight, but your fists are not.",
    raceIds: ["HUMAN"],
    stats: { strength: 4, defense: 3, speed: 2, willpower: 3, charisma: 2, intelligence: 4 },
    berries: 250,
  },
  {
    id: "SAILOR",
    name: "Sailor",
    description: "A working deckhand with steady hands, a little coin, and no fear of the horizon.",
    raceIds: ["HUMAN"],
    stats: { strength: 3, defense: 3, speed: 3, willpower: 3, charisma: 3, intelligence: 4 },
    berries: 750,
  },
  {
    id: "FISHMAN_WARRIOR",
    name: "Fish-Man Warrior",
    description: "Trained in Fish-Man Karate. The surface world has never been kind, and you remember.",
    raceIds: ["FISH_MAN"],
    stats: { strength: 5, defense: 3, speed: 3, willpower: 3, charisma: 1, intelligence: 3 },
    berries: 400,
  },
  {
    id: "DEEP_FISHER",
    name: "Deep Fisher",
    description: "You hauled nets in black water. Patience, lungs, and a hook that does not miss.",
    raceIds: ["FISH_MAN"],
    stats: { strength: 4, defense: 2, speed: 4, willpower: 3, charisma: 2, intelligence: 4 },
    berries: 550,
  },
  {
    id: "REEF_SINGER",
    name: "Reef Singer",
    description: "Songs of the deep follow you. Surface folk call it charm. You call it breathing.",
    raceIds: ["MERFOLK"],
    stats: { strength: 2, defense: 2, speed: 4, willpower: 3, charisma: 4, intelligence: 4 },
    berries: 600,
  },
  {
    id: "CURRENT_GUIDE",
    name: "Current Guide",
    description: "You read tides the way others read maps.",
    raceIds: ["MERFOLK"],
    stats: { strength: 3, defense: 2, speed: 5, willpower: 3, charisma: 3, intelligence: 4 },
    berries: 500,
  },
  {
    id: "MINK_GUARDIAN",
    name: "Guardian",
    description: "You kept a grove and a people. Electro answers when you close a fist.",
    raceIds: ["MINK"],
    stats: { strength: 4, defense: 3, speed: 4, willpower: 3, charisma: 2, intelligence: 4 },
    berries: 450,
  },
  {
    id: "MINK_TRADER",
    name: "Sea-Cat Trader",
    description: "Pelts, rumors, and a smile full of sharp teeth.",
    raceIds: ["MINK"],
    stats: { strength: 3, defense: 2, speed: 4, willpower: 2, charisma: 4, intelligence: 4 },
    berries: 700,
  },
  {
    id: "GIANT_WARRIOR",
    name: "Warrior of Elbaph",
    description: "Axe, saga, and a shadow that covers a street.",
    raceIds: ["GIANT"],
    stats: { strength: 6, defense: 4, speed: 1, willpower: 4, charisma: 2, intelligence: 4 },
    berries: 300,
  },
  {
    id: "GIANT_WANDERER",
    name: "Wandering Giant",
    description: "The Blues are small. You keep ducking for doorways anyway.",
    raceIds: ["GIANT"],
    stats: { strength: 5, defense: 4, speed: 2, willpower: 3, charisma: 3, intelligence: 4 },
    berries: 400,
  },
  {
    id: "SKYPIEAN",
    name: "Skypiean",
    description: "Born under a sun that sits too close. Prayer, cloud, and a mild disdain for dirt.",
    raceIds: ["SKY_PERSON"],
    stats: { strength: 2, defense: 2, speed: 3, willpower: 4, charisma: 4, intelligence: 5 },
    berries: 500,
  },
  {
    id: "SHANDIAN",
    name: "Shandian",
    description: "A warrior of the forest in the sky. The land was taken. The fight was not.",
    raceIds: ["SKY_PERSON"],
    stats: { strength: 4, defense: 3, speed: 4, willpower: 4, charisma: 2, intelligence: 4 },
    berries: 350,
  },
  {
    id: "BIRKAN",
    name: "Birkan",
    description: "From a ruined sky island of soldiers and thunder. Discipline is all that is left.",
    raceIds: ["SKY_PERSON"],
    stats: { strength: 4, defense: 3, speed: 3, willpower: 5, charisma: 2, intelligence: 5 },
    berries: 400,
  },
  {
    id: "LONGARM_BOXER",
    name: "Longarm Boxer",
    description: "Extra joints, extra reach, extra grudges.",
    raceIds: ["LONGARM"],
    stats: { strength: 4, defense: 3, speed: 3, willpower: 3, charisma: 2, intelligence: 4 },
    berries: 400,
  },
  {
    id: "LONGLEG_KICKER",
    name: "Longleg Kicker",
    description: "You settle arguments with a shin from another postal code.",
    raceIds: ["LONGLEG"],
    stats: { strength: 4, defense: 2, speed: 4, willpower: 3, charisma: 2, intelligence: 4 },
    berries: 400,
  },
  {
    id: "SNAKENECK_SCHOLAR",
    name: "Snakeneck Scholar",
    description: "You read over people's shoulders. They rarely like it.",
    raceIds: ["SNAKENECK"],
    stats: { strength: 2, defense: 2, speed: 3, willpower: 4, charisma: 4, intelligence: 5 },
    berries: 550,
  },
  {
    id: "THREE_EYE_SEEKER",
    name: "Seeker",
    description: "The third eye is not awake. You still look for the words that might open it.",
    raceIds: ["THREE_EYE"],
    stats: { strength: 2, defense: 2, speed: 3, willpower: 5, charisma: 3, intelligence: 5 },
    berries: 450,
  },
  {
    id: "TONTATTA_SCOUT",
    name: "Tontatta Scout",
    description: "Small enough to vanish. Strong enough to steal a sword.",
    raceIds: ["TONTATTA"],
    stats: { strength: 3, defense: 1, speed: 5, willpower: 3, charisma: 3, intelligence: 4 },
    berries: 300,
  },
  {
    id: "ANCIENT_BLOOD",
    name: "Forgotten Blood",
    description: "Even other giants stare. You have learned to duck history as well as doorframes.",
    raceIds: ["ANCIENT_GIANT"],
    stats: { strength: 7, defense: 5, speed: 1, willpower: 4, charisma: 1, intelligence: 4 },
    berries: 200,
  },
  {
    id: "BUCCANEER_EXILE",
    name: "Exiled Blood",
    description: "The Government wrote your people out of the ledgers. You are still here.",
    raceIds: ["BUCCANEER"],
    stats: { strength: 6, defense: 4, speed: 2, willpower: 4, charisma: 2, intelligence: 4 },
    berries: 250,
  },
  {
    id: "LUNARIAN_EMBER",
    name: "Last Ember",
    description: "A plume of fire and a reason to never be seen. Survival is the only tradition left.",
    raceIds: ["LUNARIAN"],
    stats: { strength: 4, defense: 5, speed: 3, willpower: 5, charisma: 1, intelligence: 4 },
    berries: 200,
  },
];

export function getOrigin(id: string): OriginDefinition | undefined {
  return ORIGINS.find((origin) => origin.id === id);
}

export function requireOrigin(id: string): OriginDefinition {
  const origin = getOrigin(id);
  if (!origin) {
    throw new Error(`Unknown origin: ${id}`);
  }
  return origin;
}

export function originsForRace(raceId: string): OriginDefinition[] {
  return ORIGINS.filter((origin) => origin.raceIds.includes(raceId));
}

export const ORIGIN_LABELS: Record<string, string> = Object.fromEntries(
  ORIGINS.map((origin) => [origin.id, origin.name]),
);
