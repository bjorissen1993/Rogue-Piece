import type { GeneratedQuestOutcome, QuestArchetypeId } from "../models/types";

export const QUEST_EXPIRE_DAYS = 8;

export const QUEST_NPC_NAMES = [
  "Mira Salt",
  "Tobin Reed",
  "Sera Finch",
  "Hale Crowe",
  "Nim Barrel",
  "Lina Voss",
];

const trust = (success: GeneratedQuestOutcome, fail: GeneratedQuestOutcome, expire: GeneratedQuestOutcome) => ({
  success,
  fail,
  expire,
});

export const QUEST_OUTCOMES: Record<
  QuestArchetypeId,
  { success: GeneratedQuestOutcome; fail: GeneratedQuestOutcome; expire: GeneratedQuestOutcome }
> = {
  missing_person: trust(
    { berries: 80, trust: 8, pressure: -4, relationship: 12, news: "A missing islander was found and brought home.", settleNpc: true, followUp: "family_matter" },
    { trust: -6, pressure: 6, relationship: -8, news: "A search ended without the missing islander." },
    { trust: -4, pressure: 4, news: "A missing-person trail went cold." },
  ),
  stolen_item: trust(
    { berries: 60, itemId: "travel_rations", itemQty: 1, trust: 6, relationship: 10, news: "A stolen heirloom was returned to its owner.", settleNpc: true },
    { trust: -5, pressure: 5, relationship: -6, news: "A theft went unanswered." },
    { trust: -3, pressure: 3, news: "An heirloom search was abandoned." },
  ),
  escort: trust(
    { berries: 70, trust: 5, relationship: 10, news: "A traveler reached the next dock in one piece.", settleNpc: true },
    { trust: -4, pressure: 4, relationship: -8, news: "An escort never arrived." },
    { trust: -2, news: "An escort request timed out." },
  ),
  investigation: trust(
    { berries: 50, trust: 4, pressure: -3, relationship: 8, news: "A local mystery was traced to its source.", settleNpc: true, followUp: "historical_investigation" },
    { pressure: 5, relationship: -4, news: "A mystery stayed unsolved." },
    { news: "A rumor faded before anyone followed it." },
  ),
  bounty_hunt: trust(
    { berries: 120, trust: 3, pressure: -6, factionId: "MARINES", factionDelta: 6, relationship: 6, news: "A bounty was closed on this island.", settleNpc: true },
    { pressure: 8, factionId: "MARINES", factionDelta: -4, news: "A bounty hunt went badly." },
    { pressure: 4, news: "A posted bounty expired." },
  ),
  rescue: trust(
    { berries: 100, trust: 10, pressure: -6, relationship: 14, news: "Someone was pulled out of a bad situation alive.", settleNpc: true },
    { trust: -8, pressure: 8, relationship: -10, news: "A rescue failed." },
    { trust: -5, pressure: 5, news: "A cry for rescue went unanswered." },
  ),
  faction_conflict: trust(
    { berries: 90, trust: 5, pressure: -8, factionId: "MARINES", factionDelta: 8, relationship: 8, news: "A street confrontation was settled before it became a riot.", settleNpc: true },
    { trust: -8, pressure: 10, factionId: "MARINES", factionDelta: -8, news: "Faction tension boiled over." },
    { pressure: 6, factionId: "MARINES", factionDelta: -4, news: "A brewing faction clash was ignored." },
  ),
  sabotage: trust(
    { berries: 85, pressure: -4, factionId: "PIRATES", factionDelta: 6, relationship: 4, news: "A sabotage job was finished quietly.", settleNpc: true },
    { pressure: 10, factionId: "MARINES", factionDelta: -6, news: "A sabotage attempt was exposed." },
    { pressure: 4, news: "A sabotage window closed." },
  ),
  smuggling: trust(
    { berries: 95, itemId: "rice_ball", itemQty: 1, factionId: "PIRATES", factionDelta: 5, relationship: 6, news: "A crate reached the next dock without a stamp.", settleNpc: true },
    { trust: -4, pressure: 6, factionId: "MARINES", factionDelta: -5, news: "A smuggling run was intercepted." },
    { news: "A smuggling contact moved on." },
  ),
  treasure_hunt: trust(
    { berries: 140, itemId: "bandage", itemQty: 1, trust: 3, relationship: 6, news: "A marked cache was dug up and split.", settleNpc: true },
    { pressure: 3, relationship: -3, news: "A treasure trail went dry." },
    { news: "A map scrap blew away." },
  ),
  lost_heirloom: trust(
    { berries: 45, trust: 7, relationship: 12, news: "A family heirloom was placed back in the right hands.", settleNpc: true },
    { trust: -4, relationship: -6, news: "An heirloom stayed lost." },
    { trust: -2, news: "An heirloom search was dropped." },
  ),
  protect_location: trust(
    { berries: 75, trust: 8, pressure: -8, relationship: 8, news: "A threatened place was held through the night.", settleNpc: true },
    { trust: -8, pressure: 10, news: "A defended place was overrun." },
    { pressure: 6, news: "A watch request went unanswered." },
  ),
  recover_cargo: trust(
    { berries: 80, itemId: "travel_rations", itemQty: 1, trust: 4, relationship: 8, news: "Lost cargo was hauled back to the harbor.", settleNpc: true },
    { trust: -3, pressure: 4, news: "A cargo recovery failed." },
    { news: "Wrecked cargo was written off." },
  ),
  recruitment_test: trust(
    { berries: 40, relationship: 10, news: "A local test was passed and a name was remembered.", settleNpc: true },
    { relationship: -6, news: "A recruitment test was failed in public." },
    { news: "A recruiter left without a verdict." },
  ),
  companion_request: trust(
    { berries: 35, relationship: 14, news: "Someone asked to travel and was not left waiting.", settleNpc: true, followUp: "debt_favor" },
    { relationship: -8, news: "A companion request was refused badly." },
    { news: "A would-be companion found another crew." },
  ),
  rival_challenge: trust(
    { berries: 55, relationship: 6, factionId: "PIRATES", factionDelta: 3, news: "A rival challenge ended without a street war.", settleNpc: true },
    { relationship: -8, pressure: 5, news: "A rival challenge ended in humiliation." },
    { news: "A promised challenge never happened." },
  ),
  moral_conflict: trust(
    { berries: 50, trust: 6, relationship: 8, news: "A moral dispute was settled in the open.", settleNpc: true },
    { trust: -6, pressure: 6, relationship: -6, news: "A moral dispute split the street." },
    { trust: -3, news: "A moral dispute was left to rot." },
  ),
  legacy_discovery: trust(
    { berries: 70, trust: 4, relationship: 8, news: "A buried name was brought back into the island's story.", settleNpc: true, followUp: "historical_investigation" },
    { news: "A legacy lead led nowhere." },
    { news: "An old name stayed buried." },
  ),
  historical_investigation: trust(
    { berries: 55, trust: 4, relationship: 7, news: "Old records were read and a quiet truth surfaced.", settleNpc: true },
    { news: "The records stayed locked." },
    { news: "An archive request expired." },
  ),
  prisoner_rescue: trust(
    { berries: 110, trust: 6, pressure: -5, factionId: "MARINES", factionDelta: -6, relationship: 12, news: "A prisoner was taken out of a locked room alive.", settleNpc: true },
    { trust: -6, pressure: 10, factionId: "MARINES", factionDelta: -4, news: "A prisoner rescue failed." },
    { pressure: 5, news: "A cell door stayed shut." },
  ),
  infiltration: trust(
    { berries: 90, pressure: -4, factionId: "MARINES", factionDelta: -5, relationship: 5, news: "Someone walked a restricted hall and left with what they came for.", settleNpc: true },
    { pressure: 10, factionId: "MARINES", factionDelta: -8, news: "An infiltration was blown." },
    { news: "A restricted window closed." },
  ),
  supply_shortage: trust(
    { berries: 65, itemId: "rice_ball", itemQty: 2, trust: 8, pressure: -6, relationship: 8, news: "A shortage was broken and the stalls opened again.", settleNpc: true },
    { trust: -6, pressure: 8, news: "A shortage worsened." },
    { trust: -3, pressure: 4, news: "A shortage was left to the next tide." },
  ),
  local_dispute: trust(
    { berries: 40, trust: 6, pressure: -4, relationship: 8, news: "A street dispute was talked down.", settleNpc: true },
    { trust: -5, pressure: 6, relationship: -5, news: "A street dispute turned ugly." },
    { pressure: 3, news: "A street dispute cooled without a verdict." },
  ),
  monster_hunt: trust(
    { berries: 120, trust: 4, pressure: -10, relationship: 6, news: "A local hunt was closed and the woods quieted.", settleNpc: true },
    { trust: -4, pressure: 10, news: "A hunt failed and the woods grew worse." },
    { pressure: 6, news: "A known threat was left to fester." },
  ),
  debt_favor: trust(
    { berries: 45, trust: 5, relationship: 12, news: "A owed favor was paid in full.", settleNpc: true },
    { trust: -4, relationship: -8, news: "A favor was left unpaid." },
    { relationship: -4, news: "A debt was forgotten." },
  ),
  family_matter: trust(
    { berries: 50, trust: 7, relationship: 10, news: "A family matter was settled without a public scene.", settleNpc: true },
    { trust: -5, relationship: -6, news: "A family matter ended badly." },
    { trust: -2, news: "A family matter was left unfinished." },
  ),
  shipwreck_investigation: trust(
    { berries: 85, itemId: "bandage", itemQty: 1, trust: 4, pressure: -3, relationship: 7, news: "A wreck was read and the missing pieces named.", settleNpc: true, followUp: "recover_cargo" },
    { pressure: 5, news: "A wreck kept its secrets." },
    { news: "A wreck was claimed by the tide." },
  ),
};

export function outcomeRewardLabels(outcome: GeneratedQuestOutcome): string[] {
  const labels: string[] = [];
  if (outcome.berries) {
    labels.push(`${outcome.berries} berries`);
  }
  if (outcome.itemId) {
    labels.push(outcome.itemId.replace(/_/g, " "));
  }
  if (outcome.trust) {
    labels.push("local trust");
  }
  if (outcome.settleNpc) {
    labels.push("a resident contact");
  }
  return labels.length ? labels : ["local standing"];
}
