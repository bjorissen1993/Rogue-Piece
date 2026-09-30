import type { GeneratedLocationKind, LocationMaturity, LocationWorldValue } from "../models/types";

export const GROWTH_DAYS_TO_DEVELOPING = 3;
export const GROWTH_DAYS_TO_ESTABLISHED = 5;

export const KIND_STAGE_NAMES: Record<GeneratedLocationKind, Record<LocationMaturity, string>> = {
  camp: { NEW: "Wayside camp", DEVELOPING: "Wayside settlement", ESTABLISHED: "Wayside village" },
  fishing_camp: { NEW: "Fishing camp", DEVELOPING: "Fishing settlement", ESTABLISHED: "Fishing village" },
  outpost: { NEW: "Outpost", DEVELOPING: "Watch post", ESTABLISHED: "Watchtower" },
  trading: { NEW: "Trading stall", DEVELOPING: "Trading post", ESTABLISHED: "Trading hall" },
  clinic: { NEW: "Field clinic", DEVELOPING: "Clinic wing", ESTABLISHED: "Infirmary" },
  workshop: { NEW: "Workshop", DEVELOPING: "Open workshop", ESTABLISHED: "Craft hall" },
  settlement: { NEW: "Settlement", DEVELOPING: "Settlement", ESTABLISHED: "Village" },
  village: { NEW: "Village", DEVELOPING: "Village", ESTABLISHED: "Village" },
};

export const FACILITY_EVENT_VALUE: Record<string, { economic: number; strategic: number; civilian: number }> = {
  MARKET: { economic: 6, strategic: 2, civilian: 4 },
  HARBOR: { economic: 5, strategic: 5, civilian: 3 },
  INN: { economic: 2, strategic: 1, civilian: 5 },
  CLINIC: { economic: 1, strategic: 2, civilian: 6 },
  TRAINING_GROUNDS: { economic: 1, strategic: 4, civilian: 2 },
  TASK_BOARD: { economic: 1, strategic: 3, civilian: 2 },
  LIBRARY: { economic: 1, strategic: 2, civilian: 3 },
  SHIPYARD: { economic: 4, strategic: 4, civilian: 2 },
};

export function inferLocationKind(name: string): GeneratedLocationKind {
  const text = name.toLowerCase();
  if (/village/.test(text)) {
    return "village";
  }
  if (/settlement/.test(text)) {
    return "settlement";
  }
  if (/fish/.test(text)) {
    return "fishing_camp";
  }
  if (/clinic|infirm|hospital/.test(text)) {
    return "clinic";
  }
  if (/workshop|forge|smith/.test(text)) {
    return "workshop";
  }
  if (/trad|bazaar|stall/.test(text)) {
    return "trading";
  }
  if (/watch|tower|outpost|fort/.test(text)) {
    return "outpost";
  }
  return "camp";
}

export function valueFromName(name: string): LocationWorldValue {
  const kind = inferLocationKind(name);
  const value: LocationWorldValue = {
    developmentValue: 2,
    strategicValue: 1,
    economicValue: 1,
    civilianValue: 1,
    factionValue: 0,
    vulnerability: 70,
  };
  if (kind === "clinic") {
    value.civilianValue = 5;
    value.developmentValue = 5;
    value.vulnerability = 55;
  } else if (kind === "outpost") {
    value.strategicValue = 6;
    value.factionValue = 4;
    value.vulnerability = 50;
  } else if (kind === "trading" || kind === "fishing_camp") {
    value.economicValue = 5;
    value.civilianValue = 3;
    value.developmentValue = 4;
  } else if (kind === "workshop") {
    value.economicValue = 3;
    value.developmentValue = 4;
  } else if (kind === "settlement" || kind === "village") {
    value.developmentValue = 8;
    value.civilianValue = 5;
    value.economicValue = 4;
    value.vulnerability = 40;
  }
  return value;
}

export function stageName(kind: GeneratedLocationKind, maturity: LocationMaturity): string {
  return KIND_STAGE_NAMES[kind][maturity];
}

export function eventScore(
  economic: number,
  strategic: number,
  civilian = 0,
  prefer: "economic" | "strategic" | "vulnerable" | "any" = "any",
  vulnerability = 0,
): number {
  if (prefer === "economic") {
    return economic * 3 + strategic + civilian;
  }
  if (prefer === "strategic") {
    return strategic * 3 + economic + civilian;
  }
  if (prefer === "vulnerable") {
    return vulnerability + economic + strategic;
  }
  return economic + strategic + civilian;
}
