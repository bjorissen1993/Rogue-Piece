import { getItemDefinition } from "../data/items";
import { getWeapon } from "../data/weapons";
import { TIME_COST, TIME_OF_DAY_ORDER } from "../game/constants";
import type {
  BackgroundContext,
  ChoiceRisk,
  ChoiceRiskLevel,
  ChoiceVariant,
  Encounter,
  EncounterChoice,
  EncounterOutcome,
  PlayerStats,
  StatName,
  TimeCostId,
  TimeOfDay,
} from "../models/types";
import { STAT_LABELS } from "./text";

const STAT_HINT: Record<StatName, string> = {
  strength: "This option depends on physical power.",
  defense: "This option depends on holding the line.",
  speed: "This option depends on haste and timing.",
  willpower: "This option depends on grit and nerve.",
  charisma: "This option depends on words and presence.",
  intelligence: "This option depends on analysis and problem-solving.",
};

const RISK_LABEL: Record<ChoiceRisk, string> = {
  LOW: "Low risk",
  MODERATE: "Difficulty: Moderate",
  HIGH: "High risk",
  DEADLY: "Deadly",
};

/** Strip trailing "(N berries)" / similar when the footer already shows COST ฿N. */
function stripRedundantBerryCost(label: string): string {
  return label
    .replace(/\s*\(\s*[\d.,]+\s*berr(?:y|ies)\s*\)\s*$/i, "")
    .replace(/\s*\(\s*฿\s*[\d.,]+\s*\)\s*$/i, "")
    .replace(/\s*[-–—]\s*[\d.,]+\s*berr(?:y|ies)\s*$/i, "")
    .trim();
}

function fromText(text: string): { label: string; stat?: StatName } {
  const match = text.match(/^(.*?)\s*\((Strength|Defense|Speed|Willpower|Charisma)\)\s*$/i);
  if (!match) {
    return { label: text };
  }
  const raw = match[2]!.toLowerCase();
  const stat = raw as StatName;
  return { label: match[1]!.trim(), stat };
}

export function choiceLabel(choice: EncounterChoice): string {
  const label = fromText(choice.text).label;
  const berries = choice.outcome.berriesChange ?? 0;
  // Footer already shows COST ฿N for berry spends — avoid duplicating in the title.
  if (berries < 0) {
    return stripRedundantBerryCost(label);
  }
  return label;
}

function inferStatFromOutcome(choice: EncounterChoice): StatName | undefined {
  if (choice.outcome.skillCheck?.stat) {
    return choice.outcome.skillCheck.stat;
  }
  return undefined;
}

const STAT_ORDER: StatName[] = [
  "strength",
  "defense",
  "speed",
  "willpower",
  "charisma",
  "intelligence",
];

export function choiceStat(choice: EncounterChoice): StatName | undefined {
  if (choice.checkStat) {
    return choice.checkStat;
  }
  const fromOutcome = inferStatFromOutcome(choice);
  if (fromOutcome) {
    return fromOutcome;
  }
  const fromLabel = fromText(choice.text).stat;
  if (fromLabel) {
    return fromLabel;
  }
  const variant = choiceVariant(choice);
  if (variant === "fight") return "strength";
  if (variant === "parley") return "charisma";
  if (variant === "escape") return "speed";
  return undefined;
}

function statsFromChanges(changes: Partial<PlayerStats> | undefined, direction: "gain" | "lose"): StatName[] {
  if (!changes) {
    return [];
  }
  return STAT_ORDER.filter((stat) => {
    const value = changes[stat];
    if (value == null || value === 0) {
      return false;
    }
    return direction === "gain" ? value > 0 : value < 0;
  });
}

export function choiceGainStats(choice: EncounterChoice): StatName[] {
  const found = new Set<StatName>(statsFromChanges(choice.outcome.statChanges, "gain"));
  if (choice.outcome.trainStat) {
    found.add(choice.outcome.trainStat);
  }
  return STAT_ORDER.filter((stat) => found.has(stat));
}

export function choiceLoseStats(choice: EncounterChoice): StatName[] {
  return statsFromChanges(choice.outcome.statChanges, "lose");
}

export function choiceFocusStat(choice: EncounterChoice): StatName | undefined {
  const gainStats = choiceGainStats(choice);
  if (choice.outcome.skillCheck?.stat) {
    return choice.outcome.skillCheck.stat;
  }
  if (choice.checkStat === "willpower" || choice.checkStat === "charisma") {
    return choice.checkStat;
  }
  if (choice.checkStat && !gainStats.includes(choice.checkStat)) {
    return choice.checkStat;
  }
  if (gainStats.length > 0) {
    return undefined;
  }
  return choiceStat(choice);
}

export function choiceVariant(choice: EncounterChoice): ChoiceVariant {
  if (choice.visual?.variant) {
    return choice.visual.variant;
  }
  if (choice.outcome.trainStat) {
    return "train";
  }
  const hay = `${choice.id} ${choice.text}`.toLowerCase();
  if (/(fight|challenge|attack|strike|test them)/.test(hay)) return "fight";
  if (/(talk|parley|negotiate|listen|ask)/.test(hay)) return "parley";
  if (/(run|escape|flee|hide|distance|hooks|leave|walk away|depart)/.test(hay)) return "escape";
  if (/(steal|rob|hit the|loot)/.test(hay)) return "steal";
  if (/(help|donate|feed|heal)/.test(hay)) return "help";
  if (/(train|drill|practice|dojo)/.test(hay)) return "train";
  return "default";
}

export type EncounterActionName =
  | "fight"
  | "parley"
  | "escape"
  | "help"
  | "steal"
  | "train"
  | "cutRope"
  | "keepDistance"
  | "search"
  | "stealth"
  | "track"
  | "treasure"
  | "explore"
  | "rest"
  | "join"
  | "joinTemporarily"
  | "default";

const GENERIC_CHOICE_ICON = "/icons/explore.png";
const CHOICE_DISTANCE_ICON = "/icons/keep-distance.png";

const FORBIDDEN_DIAMOND_ICONS = new Set([
  "strength",
  "defense",
  "speed",
  "willpower",
  "charisma",
  "escape",
  "attack",
  "technique",
  "defend",
  "observe",
  "item",
]);

const CHOICE_ICON_ALIASES: Record<string, string> = {
  parley: "talk",
  steal: "treasure",
  train: "explore",
  "keep-your-distance": "keep-distance",
  "join-temp": "join-temporarily",
  gain_strength: "gain-strength",
  "gain-strength": "gain-strength",
  gain_defense: "gain-defense",
  "gain-defense": "gain-defense",
  gain_speed: "gain-speed",
  "gain-speed": "gain-speed",
  gain_willpower: "gain-willpower",
  "gain-willpower": "gain-willpower",
  gain_charisma: "gain-charisma",
  "gain-charisma": "gain-charisma",
  training_skip: "rest",
  "training-skip": "rest",
  "not-today": "rest",
};

const CHOICE_DIAMOND_BY_ACTION: Record<EncounterActionName, string> = {
  fight: "/icons/fight.png",
  parley: "/icons/talk.png",
  escape: CHOICE_DISTANCE_ICON,
  help: "/icons/help.png",
  steal: "/icons/treasure.png",
  cutRope: "/icons/cut-rope.png",
  keepDistance: CHOICE_DISTANCE_ICON,
  search: "/icons/search.png",
  stealth: "/icons/stealth.png",
  track: "/icons/track.png",
  treasure: "/icons/treasure.png",
  explore: "/icons/explore.png",
  rest: "/icons/rest.png",
  join: "/icons/join.png",
  joinTemporarily: "/icons/join-temporarily.png",
  train: GENERIC_CHOICE_ICON,
  default: GENERIC_CHOICE_ICON,
};

export const STAT_ACCENT: Record<StatName, string> = {
  strength: "#e0703a",
  defense: "#5b9ad8",
  speed: "#e0c45a",
  willpower: "#9b6ad4",
  charisma: "#d4b36a",
  intelligence: "#5eb8a8",
};

function iconSlug(raw: string): string {
  return raw
    .replace(/^.*[/\\]/, "")
    .toLowerCase()
    .replace(/\.(png|svg|webp|jpg|jpeg)$/, "");
}

export function choiceIconSrc(icon?: string): string | undefined {
  if (!icon) {
    return undefined;
  }
  const slug = iconSlug(icon);
  if (FORBIDDEN_DIAMOND_ICONS.has(slug)) {
    return undefined;
  }
  const aliased = CHOICE_ICON_ALIASES[slug] ?? slug.replace(/_/g, "-");
  if (FORBIDDEN_DIAMOND_ICONS.has(aliased) || aliased === "escape") {
    return CHOICE_DISTANCE_ICON;
  }
  if (icon.startsWith("/") || icon.startsWith("http")) {
    return /(?:^|[/\\])escape\.(?:png|svg|webp|jpg|jpeg)$/i.test(icon) ? CHOICE_DISTANCE_ICON : icon;
  }
  return `/icons/${aliased}.png`;
}

export function choiceDiamondSrc(choice: EncounterChoice): string {
  const src = choiceIconSrc(choice.visual?.icon) ?? CHOICE_DIAMOND_BY_ACTION[choiceAction(choice)] ?? GENERIC_CHOICE_ICON;
  return /(?:^|[/\\])escape\.(?:png|svg|webp|jpg|jpeg)$/i.test(src) ? CHOICE_DISTANCE_ICON : src;
}

export function choiceAction(choice: EncounterChoice): EncounterActionName {
  if (choice.outcome.trainStat) {
    return "train";
  }
  const hay = `${choice.id} ${choice.text} ${choice.flavour ?? ""}`.toLowerCase();
  if (/(train|drill|practice|dojo)/.test(hay)) {
    return "train";
  }
  if (/(cut the hooks|axes to rope|cut .*rope|cut .*hooks)/.test(hay)) {
    return "cutRope";
  }
  if (
    choice.id === "leave" ||
    choice.id === "run" ||
    choice.id === "flee" ||
    /(keep (your )?distance|get out of range|avoid them|get away|sail off|walk away|\bflee\b|\brun\b|\bleave\b|depart)/.test(
      hay,
    )
  ) {
    return "keepDistance";
  }
  if (/(keep your head down|take shelter|slip past|sneak|stealth|scatter into sand)/.test(hay)) {
    return "stealth";
  }
  if (/\bhide\b/.test(hay) && !/hidden/.test(hay)) {
    return "stealth";
  }
  if (choice.id === "rest" || /(rest on|ride it out|let the day pass)/.test(hay)) {
    return "rest";
  }
  if (choice.id === "explore" || /(explore inland|ride the current|take the chart)/.test(hay)) {
    return "explore";
  }
  if (/(measure|footprint|track|follow the|trail)/.test(hay)) {
    return "track";
  }
  if (
    choice.id === "read" ||
    choice.id === "watch" ||
    /(search|inspect|study|watch the room|copy the mural)/.test(hay)
  ) {
    return "search";
  }
  if (
    choice.id === "bet" ||
    choice.id === "steal" ||
    /(steal|rob|loot|hit the|salvage|open the hidden|crack the|cause a scene|buy the lot|pull it aboard)/.test(hay)
  ) {
    return "treasure";
  }
  if (
    choice.id === "help" ||
    choice.id === "gift" ||
    /(donate|feed|heal|accept (their )?thanks|take the help)/.test(hay)
  ) {
    return "help";
  }
  if (choice.id === "join" || /(join them temporarily|join temporarily)/.test(hay)) {
    return "joinTemporarily";
  }
  if (/(^join\b|join (them|the |their|crew)|sail with|enlist)/.test(hay)) {
    return "join";
  }
  if (/(bribe|pay for|pay them|call out)/.test(hay)) {
    return "parley";
  }
  const variant = choiceVariant(choice);
  if (variant === "fight") return "fight";
  if (variant === "parley") return "parley";
  if (variant === "escape") return "keepDistance";
  if (variant === "help") return "help";
  if (variant === "steal") return "treasure";
  if (variant === "train") return "train";
  return "default";
}

export type EncounterMood = "explore" | "fight" | "talk" | "mystery" | "settle";

export function encounterMood(encounter: Encounter | null, hasResult: boolean): EncounterMood {
  if (hasResult) {
    return "settle";
  }
  if (!encounter) {
    return "explore";
  }

  const overlay = encounter.visual?.overlay?.toLowerCase() ?? "";
  const variant = encounter.visual?.variant;
  const category = (encounter.category ?? "").toLowerCase();
  const tags = encounter.bindNpcTags?.join(" ") ?? "";
  const hay = `${encounter.id} ${encounter.title} ${category} ${tags}`.toLowerCase();

  if (variant === "fight" || overlay === "fire") {
    return "fight";
  }
  if (overlay === "tavern" || variant === "parley") {
    return "talk";
  }
  if (overlay === "fog" || overlay === "shadow") {
    return "mystery";
  }
  if (category === "training") {
    return "explore";
  }
  if (/boarding|authority|ambush|duel|patrol|sea king|the deep/.test(hay)) {
    return "fight";
  }
  if (encounter.choices.some((choice) => Boolean(choice.outcome.combat))) {
    return "fight";
  }
  if (encounter.fruitEncounter || /mystery|ruin|shrine|secret|discovery/.test(hay)) {
    return "mystery";
  }
  if (overlay === "sea" || overlay === "light" || category === "flotsam") {
    return "explore";
  }
  if (overlay === "dark") {
    return "mystery";
  }
  return "explore";
}

export function encounterCategory(encounter: Encounter): string {
  if (encounter.category) {
    return encounter.category;
  }
  if (encounter.fruitEncounter) return "Devil Fruit";
  return "Encounter";
}

export function encounterOverlay(encounter: Encounter): string {
  return encounter.visual?.overlay?.toLowerCase() ?? "default";
}

export function statHint(stat: StatName): string {
  return STAT_HINT[stat];
}

export function riskLabel(choice: EncounterChoice): string | null {
  if (!choice.risk) {
    return null;
  }
  if (choice.advantage) {
    return "Advantage";
  }
  return RISK_LABEL[choice.risk];
}

export type RiskTone = "low" | "medium" | "high" | "deadly" | "advantage";

export function riskTone(choice: EncounterChoice): RiskTone | null {
  if (choice.advantage) {
    return "advantage";
  }
  if (!choice.risk) {
    return null;
  }
  if (choice.risk === "LOW") return "low";
  if (choice.risk === "MODERATE") return "medium";
  if (choice.risk === "HIGH") return "high";
  return "deadly";
}

const RISK_LEVEL_BY_CHOICE: Record<ChoiceRisk, ChoiceRiskLevel> = {
  LOW: "SAFE",
  MODERATE: "FAIR",
  HIGH: "RISKY",
  DEADLY: "DANGEROUS",
};

export function choiceRiskLevel(choice: EncounterChoice): ChoiceRiskLevel | null {
  if (choice.presentation?.riskLevel) {
    return choice.presentation.riskLevel;
  }
  if (!choice.risk) {
    return null;
  }
  return RISK_LEVEL_BY_CHOICE[choice.risk];
}

export function riskShortLabel(choice: EncounterChoice): string | null {
  return choiceRiskLevel(choice);
}

export function clockFromTimeOfDay(time: TimeOfDay | undefined): string {
  switch (time) {
    case "DAWN":
      return "05:30";
    case "MORNING":
      return "09:30";
    case "AFTERNOON":
      return "14:00";
    case "EVENING":
      return "18:30";
    case "NIGHT":
      return "22:00";
    default:
      return "09:30";
  }
}

export function relativeDayLabel(eventDay: number, currentDay: number): string {
  const delta = currentDay - eventDay;
  if (delta <= 0) return "Today";
  if (delta === 1) return "1 day ago";
  return `${delta} days ago`;
}

export function choiceCountClass(count: number): string {
  if (count <= 1) return "choice-grid choice-grid-1";
  if (count === 2) return "choice-grid choice-grid-2";
  if (count === 3) return "choice-grid choice-grid-3";
  if (count === 4) return "choice-grid choice-grid-4";
  if (count === 5) return "choice-grid choice-grid-5 choice-grid-compact";
  if (count === 6) return "choice-grid choice-grid-6 choice-grid-compact";
  return "choice-grid choice-grid-many choice-grid-compact";
}

export function remainingSlotsToday(timeOfDay: TimeOfDay | undefined): number {
  const index = TIME_OF_DAY_ORDER.indexOf(timeOfDay ?? "DAWN");
  if (index < 0) {
    return TIME_OF_DAY_ORDER.length;
  }
  return TIME_OF_DAY_ORDER.length - index;
}

export function resolveTimeCost(
  cost: TimeCostId | number | undefined,
  fallback: number = TIME_COST.SLOT,
  timeOfDay?: TimeOfDay,
): number {
  if (cost == null) {
    return fallback;
  }
  if (typeof cost === "number") {
    return Math.max(0, cost);
  }
  if (cost === "DAY") {
    return remainingSlotsToday(timeOfDay);
  }
  return TIME_COST[cost] ?? fallback;
}

export function timeOfDayLabel(time: TimeOfDay | undefined): string {
  switch (time) {
    case "DAWN":
      return "Dawn";
    case "MORNING":
      return "Morning";
    case "AFTERNOON":
      return "Afternoon";
    case "EVENING":
      return "Evening";
    case "NIGHT":
      return "Night";
    default:
      return "Morning";
  }
}

export type ChoiceFactTone = "gain" | "loss" | "neutral";

export type ChoiceFact = {
  kind: "time" | "cost" | "gain-berries" | "hp" | "bounty" | "item";
  label: string;
  tone: ChoiceFactTone;
};

export type ChoiceMechanicSummary = {
  gainStats: StatName[];
  loseStats: StatName[];
  facts: ChoiceFact[];
  focusStat?: StatName;
};

export type ChoicePrimaryEffect =
  | { kind: "gain-stat"; stats: StatName[] }
  | { kind: "lose-stat"; stats: StatName[] }
  | { kind: "fact"; fact: ChoiceFact };

const PRIMARY_FACT_ORDER: ChoiceFact["kind"][] = ["cost", "gain-berries", "hp", "bounty", "item", "time"];

export function choicePrimaryEffect(summary: ChoiceMechanicSummary): ChoicePrimaryEffect | null {
  if (summary.gainStats.length > 0) {
    return { kind: "gain-stat", stats: summary.gainStats };
  }
  if (summary.loseStats.length > 0) {
    return { kind: "lose-stat", stats: summary.loseStats };
  }
  for (const kind of PRIMARY_FACT_ORDER) {
    const fact = summary.facts.find((entry) => entry.kind === kind);
    if (fact) {
      return { kind: "fact", fact };
    }
  }
  return null;
}

function signedAmount(amount: number, prefix: string): string {
  const abs = Math.abs(amount).toLocaleString();
  return amount > 0 ? `${prefix}+${abs}` : `${prefix}−${abs}`;
}

function berryAmount(amount: number): string {
  return `฿${Math.abs(amount).toLocaleString()}`;
}

function itemNamesFromOutcome(outcome: EncounterOutcome): string[] {
  const names: string[] = [];
  if (outcome.grantItemIds?.length) {
    for (const itemId of outcome.grantItemIds) {
      const def = getItemDefinition(itemId);
      if (def) {
        names.push(def.name);
      }
    }
  }
  if (outcome.addInventory?.length) {
    for (const item of outcome.addInventory) {
      names.push(item.name);
    }
  }
  if (outcome.grantWeaponId) {
    const weapon = getWeapon(outcome.grantWeaponId);
    if (weapon) {
      names.push(weapon.name);
    }
  }
  return names;
}

export function choiceTimeCostId(
  choice: EncounterChoice,
  encounter?: Encounter | null,
): TimeCostId | number | undefined {
  return choice.timeCost ?? encounter?.timeCost;
}

export function choiceTimeLabel(
  choice: EncounterChoice,
  encounter?: Encounter | null,
  timeOfDay?: TimeOfDay,
): string | null {
  const cost = choiceTimeCostId(choice, encounter);
  if (cost == null || cost === "BRIEF" || cost === 0) {
    return null;
  }
  if (cost === "SLOT" || cost === 1) {
    return "Time: 1 slot";
  }
  if (cost === "LONG" || cost === 2) {
    if (timeOfDay) {
      const fromIndex = TIME_OF_DAY_ORDER.indexOf(timeOfDay);
      const toIndex = fromIndex + TIME_COST.LONG;
      if (fromIndex >= 0 && toIndex < TIME_OF_DAY_ORDER.length) {
        return `Time: ${timeOfDayLabel(timeOfDay)} → ${timeOfDayLabel(TIME_OF_DAY_ORDER[toIndex])}`;
      }
    }
    return "Time: 2 slots";
  }
  if (cost === "DAY") {
    return "Time: rest of the day";
  }
  if (typeof cost === "number") {
    return cost === 1 ? "Time: 1 slot" : `Time: ${cost} slots`;
  }
  return null;
}

export function choiceMechanicSummary(
  choice: EncounterChoice,
  encounter?: Encounter | null,
  timeOfDay?: TimeOfDay,
): ChoiceMechanicSummary {
  const outcome = choice.outcome;
  const gainStats = choiceGainStats(choice);
  const loseStats = choiceLoseStats(choice);
  const facts: ChoiceFact[] = [];
  const timeLabel = choiceTimeLabel(choice, encounter, timeOfDay);
  if (timeLabel) {
    facts.push({ kind: "time", label: timeLabel, tone: "neutral" });
  }

  const berries = outcome.berriesChange ?? 0;
  if (berries < 0) {
    facts.push({ kind: "cost", label: `Cost: ${berryAmount(berries)}`, tone: "loss" });
  } else if (berries > 0) {
    facts.push({ kind: "gain-berries", label: `Gain: ${berryAmount(berries)}`, tone: "gain" });
  }

  const hp = outcome.hpChange ?? 0;
  if (hp) {
    facts.push({
      kind: "hp",
      label: signedAmount(hp, "HP "),
      tone: hp > 0 ? "gain" : "loss",
    });
  }

  const bounty = outcome.bountyChange ?? 0;
  if (bounty) {
    const abs = Math.abs(bounty).toLocaleString();
    facts.push({
      kind: "bounty",
      label: bounty > 0 ? `Bounty +฿${abs}` : `Bounty −฿${abs}`,
      tone: bounty > 0 ? "gain" : "loss",
    });
  }

  for (const name of itemNamesFromOutcome(outcome)) {
    facts.push({ kind: "item", label: `Added to Backpack: ${name}`, tone: "gain" });
  }

  const derivedCoversCost = facts.some((fact) => fact.kind === "time" || fact.kind === "cost" || fact.kind === "hp");
  if (!derivedCoversCost && !gainStats.length && choice.costLabel) {
    facts.push({ kind: "cost", label: choice.costLabel, tone: "neutral" });
  }

  return {
    gainStats,
    loseStats,
    facts,
    focusStat: choiceFocusStat(choice),
  };
}

export function choiceAccentStat(choice: EncounterChoice): StatName | undefined {
  const accent = choice.visual?.accent?.toLowerCase();
  if (accent && STAT_ORDER.includes(accent as StatName)) {
    return accent as StatName;
  }
  const gains = choiceGainStats(choice);
  if (gains.length > 0) {
    return gains[0];
  }
  if (choice.checkStat) {
    return choice.checkStat;
  }
  return choiceStat(choice);
}

export function choiceAccentColor(choice: EncounterChoice): string | undefined {
  const accent = choice.visual?.accent;
  if (accent && !STAT_ORDER.includes(accent.toLowerCase() as StatName)) {
    return accent;
  }
  const stat = choiceAccentStat(choice);
  return stat ? STAT_ACCENT[stat] : undefined;
}

const ACTION_PRIMARY_LABEL: Record<EncounterActionName, string> = {
  fight: "FIGHT",
  parley: "TALK",
  escape: "ESCAPE",
  help: "HELP",
  steal: "SEARCH THE AREA",
  train: "TRAIN",
  cutRope: "CUT THE ROPE",
  keepDistance: "KEEP YOUR DISTANCE",
  search: "SEARCH THE AREA",
  stealth: "STAY HIDDEN",
  track: "TRACK",
  treasure: "SEARCH THE AREA",
  explore: "EXPLORE",
  rest: "REST",
  join: "JOIN",
  joinTemporarily: "JOIN TEMPORARILY",
  default: "",
};

export type ChoicePrimaryDisplay =
  | { kind: "gain-stat"; verb: string; stats: StatName[] }
  | { kind: "lose-stat"; verb: string; stats: StatName[] }
  | { kind: "label"; text: string; stats?: StatName[]; tone: ChoiceFactTone };

function choiceHasMechanicalPrimary(choice: EncounterChoice): boolean {
  const outcome = choice.outcome;
  if (choiceGainStats(choice).length > 0 || choiceLoseStats(choice).length > 0) {
    return true;
  }
  if ((outcome.hpChange ?? 0) > 0) {
    return true;
  }
  if ((outcome.berriesChange ?? 0) > 0) {
    return true;
  }
  if ((outcome.bountyChange ?? 0) > 0) {
    return true;
  }
  if (itemNamesFromOutcome(outcome).length > 0) {
    return true;
  }
  if (outcome.combat || outcome.skillCheck) {
    return true;
  }
  return false;
}

export function choicePrimaryResult(choice: EncounterChoice): ChoicePrimaryDisplay | null {
  if (!choiceHasMechanicalPrimary(choice)) {
    return null;
  }

  const custom = choice.presentation?.primaryLabel?.trim();
  const gainStats = choiceGainStats(choice);
  const loseStats = choiceLoseStats(choice);
  const hp = choice.outcome.hpChange ?? 0;
  const berries = choice.outcome.berriesChange ?? 0;

  if (custom) {
    return {
      kind: "label",
      text: custom.toUpperCase(),
      stats: gainStats.length ? gainStats : undefined,
      tone: gainStats.length ? "gain" : loseStats.length ? "loss" : "neutral",
    };
  }
  if (gainStats.length > 0) {
    return { kind: "gain-stat", verb: "GAIN", stats: gainStats };
  }
  if (loseStats.length > 0) {
    return { kind: "lose-stat", verb: "LOSE", stats: loseStats };
  }
  if (hp > 0) {
    return { kind: "label", text: `RECOVER ${hp} HP`, tone: "gain" };
  }
  if (berries > 0) {
    return { kind: "label", text: `GAIN ฿${berries.toLocaleString()}`, tone: "gain" };
  }
  const itemNames = itemNamesFromOutcome(choice.outcome);
  if (itemNames.length === 1) {
    return { kind: "label", text: `GAIN ${itemNames[0]!.toUpperCase()}`, tone: "gain" };
  }
  if (itemNames.length > 1) {
    return { kind: "label", text: "GAIN SUPPLIES", tone: "gain" };
  }
  if (choice.outcome.combat) {
    return { kind: "label", text: "FIGHT", tone: "neutral" };
  }
  const checkStat = choice.outcome.skillCheck?.stat ?? choice.checkStat;
  if (checkStat) {
    return {
      kind: "label",
      text: "TEST",
      stats: [checkStat],
      tone: "neutral",
    };
  }
  const action = choiceAction(choice);
  if (action === "keepDistance") {
    const hay = `${choice.id} ${choice.text}`.toLowerCase();
    if (/\b(escape|flee|run)\b/.test(hay) && !/keep/.test(hay)) {
      return { kind: "label", text: "ESCAPE", tone: "neutral" };
    }
  }
  const fromAction = ACTION_PRIMARY_LABEL[action];
  if (fromAction) {
    return { kind: "label", text: fromAction, tone: "neutral" };
  }
  // Never echo the choice title in the body — costs/risk already cover the rest.
  return null;
}

export type ChoiceCostKind = "time" | "berries" | "hp" | "focus" | "risk" | "free" | "bounty";

export type ChoiceCostItem = {
  kind: ChoiceCostKind;
  label: string;
  value: string;
  tone: ChoiceFactTone;
  stat?: StatName;
};

export function choiceCostItems(
  choice: EncounterChoice,
  encounter?: Encounter | null,
  timeOfDay?: TimeOfDay,
  isDev = false,
): ChoiceCostItem[] {
  const items: ChoiceCostItem[] = [];
  const costId = choiceTimeCostId(choice, encounter);
  if (costId != null && costId !== "BRIEF" && costId !== 0) {
    if (costId === "DAY") {
      items.push({ kind: "time", label: "TIME", value: "DAY", tone: "neutral" });
    } else {
      const slots = resolveTimeCost(costId, 0, timeOfDay);
      if (slots > 0) {
        items.push({
          kind: "time",
          label: "TIME",
          value: slots === 1 ? "1 TIME SLOT" : `${slots} TIME SLOTS`,
          tone: "neutral",
        });
      }
    }
  }

  const berries = choice.outcome.berriesChange ?? 0;
  if (berries < 0) {
    items.push({
      kind: "berries",
      label: "COST",
      value: `฿${Math.abs(berries).toLocaleString()}`,
      tone: "loss",
    });
  }

  const hp = choice.outcome.hpChange ?? 0;
  if (hp < 0) {
    items.push({
      kind: "hp",
      label: "HP",
      value: `−${Math.abs(hp)}`,
      tone: "loss",
    });
  }

  const focus = choiceFocusStat(choice);
  if (focus) {
    items.push({
      kind: "focus",
      label: "FOCUS",
      value: STAT_LABELS[focus].toUpperCase(),
      tone: "neutral",
      stat: focus,
    });
  }

  const risk = choiceRiskLevel(choice);
  if (risk) {
    const difficulty = choice.outcome.skillCheck?.difficulty;
    items.push({
      kind: "risk",
      label: "RISK",
      value: isDev && difficulty != null ? `${risk} ${difficulty}` : risk,
      tone: risk === "RISKY" || risk === "DANGEROUS" ? "loss" : "neutral",
    });
  }

  const bounty = choice.outcome.bountyChange ?? 0;
  if (bounty < 0) {
    items.push({
      kind: "bounty",
      label: "BOUNTY",
      value: `−฿${Math.abs(bounty).toLocaleString()}`,
      tone: "loss",
    });
  }

  if (items.length === 0) {
    items.push({ kind: "free", label: "NO COST", value: "FREE", tone: "neutral" });
  }
  return items;
}

const BACKGROUND_BY_OVERLAY: Record<string, string> = {
  sea: "/backgrounds/sea.png",
  tavern: "/backgrounds/tavern.png",
  dark: "/backgrounds/city.png",
  fire: "/backgrounds/city.png",
  fog: "/backgrounds/jungle.png",
  shadow: "/backgrounds/tavern.png",
  light: "/backgrounds/village.png",
};

const BACKGROUND_BY_BIOME: Record<string, string> = {
  tropical: "/backgrounds/beach.png",
  jungle: "/backgrounds/jungle.png",
  desert: "/backgrounds/beach.png",
  fishing: "/backgrounds/village.png",
  trading: "/backgrounds/city.png",
  pirate: "/backgrounds/tavern.png",
  marine: "/backgrounds/city.png",
};

const BACKGROUND_BY_ARCHETYPE: Record<string, string> = {
  TROPICAL: "/backgrounds/beach.png",
  JUNGLE: "/backgrounds/jungle.png",
  DESERT: "/backgrounds/beach.png",
  PIRATE_HAVEN: "/backgrounds/tavern.png",
  MARINE_FORTRESS: "/backgrounds/city.png",
  FISHING: "/backgrounds/village.png",
  TRADING: "/backgrounds/city.png",
};

export function getBackgroundForContext(context: BackgroundContext): string {
  if (context.weather === "STORM") {
    return "/backgrounds/sea.png";
  }
  if (context.timeOfDay === "NIGHT" && context.encounterType === "COMBAT") {
    return "/backgrounds/shadow.png";
  }
  if (context.timeOfDay === "NIGHT" || context.timeOfDay === "EVENING") {
    if (context.encounterType === "WEIRD" || context.encounterType === "STORY") {
      return "/backgrounds/shadow.png";
    }
    return "/backgrounds/tavern.png";
  }
  if (context.islandType && BACKGROUND_BY_ARCHETYPE[context.islandType]) {
    return BACKGROUND_BY_ARCHETYPE[context.islandType]!;
  }
  if (context.biome && BACKGROUND_BY_BIOME[context.biome.toLowerCase()]) {
    return BACKGROUND_BY_BIOME[context.biome.toLowerCase()]!;
  }
  if (context.encounterType === "COMBAT" || context.encounterType === "STORY") {
    return "/backgrounds/battle.png";
  }
  if (context.encounterType === "SOCIAL" || context.encounterType === "CREW") {
    return "/backgrounds/village.png";
  }
  if (context.encounterType === "EXPLORATION") {
    return "/backgrounds/jungle.png";
  }
  if (context.encounterType === "SEA") {
    return "/backgrounds/sea.png";
  }
  if (context.encounterType === "TRAINING") {
    return "/backgrounds/training-dojo.png";
  }
  return "/backgrounds/beach.png";
}

export function encounterBackground(encounter: Encounter | null, context?: BackgroundContext): string | undefined {
  if (!encounter) {
    return getBackgroundForContext(context ?? { timeOfDay: "MORNING", weather: "CLEAR" });
  }
  if (encounter.visual?.background) {
    return encounter.visual.background;
  }
  const overlay = encounter.visual?.overlay?.toLowerCase();
  if (overlay === "DARK" && context?.timeOfDay !== "NIGHT") {
    return getBackgroundForContext({
      ...context,
      encounterType: (encounter.category as BackgroundContext["encounterType"]) ?? undefined,
    });
  }
  if (overlay && BACKGROUND_BY_OVERLAY[overlay]) {
    if (overlay === "dark" && (context?.timeOfDay === "MORNING" || context?.timeOfDay === "DAWN" || context?.timeOfDay === "AFTERNOON")) {
      return getBackgroundForContext(context ?? {});
    }
    return BACKGROUND_BY_OVERLAY[overlay];
  }
  if (context) {
    return getBackgroundForContext({
      ...context,
      encounterType: (encounter.category as BackgroundContext["encounterType"]) ?? context.encounterType,
    });
  }
  const hay = `${encounter.id} ${encounter.title} ${encounter.category ?? ""}`.toLowerCase();
  if (/tavern|gambling|den|auction|back room|alley/.test(hay)) return "/backgrounds/tavern.png";
  if (/village|hungry|thanks|shrine/.test(hay)) return "/backgrounds/village.png";
  if (/jungle|cove|inland|deserted|mink|wolf|district/.test(hay)) return "/backgrounds/jungle.png";
  if (/beach|shore|ashore|gang|footprint|tide/.test(hay)) return "/backgrounds/beach.png";
  if (/sea|storm|crate|patrol|king|boarding|coo|current|mountain|hold|cache|convoy/.test(hay)) {
    return "/backgrounds/sea.png";
  }
  return "/backgrounds/city.png";
}
