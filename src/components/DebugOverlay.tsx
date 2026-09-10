import { HUMAN_RACE_ID } from "../data/races";
import { getFaction } from "../data/factions";
import { getLocation, getRegionName } from "../data/locations";
import type { CareerFactionId, ProfileSave, RelationFactionId, TimeOfDay } from "../models/types";
import { AffiliationService } from "../services/AffiliationService";
import { EncounterHistoryService } from "../services/EncounterHistoryService";
import { RaceService } from "../services/RaceService";
import { StoryThreadService } from "../services/StoryThreadService";
import { debugCombatSnapshot } from "../services/ThreatService";
import { OverlayFrame } from "./OverlayFrame";

type DebugOverlayProps = {
  profile: ProfileSave;
  onClose: () => void;
  onGenerateOffer?: () => void;
  onIncreasePity?: () => void;
  onForceCombat?: () => void;
  onGiveItem?: () => void;
  onHeal?: () => void;
  onFactionInfluence?: (factionId: RelationFactionId, amount: number) => void;
  onFactionEvent?: (factionId: RelationFactionId) => void;
  onDiscoverRevolutionary?: () => void;
  onFactionRumor?: (factionId: RelationFactionId) => void;
  onGenerateStoryThread?: () => void;
  onAdvanceStoryThread?: () => void;
  onResolveStoryThread?: () => void;
  onGenerateCharacter?: () => void;
  onForceJoinInterest?: () => void;
  onGiveWeapon?: () => void;
  onGiveRandomWeapon?: () => void;
  onEquipSelectedWeapon?: () => void;
  onPrintEquippedWeaponState?: () => void;
  onSetPlayerHp?: (hp: number) => void;
  onDamagePlayer?: (amount: number) => void;
  onGiveDriedMeat?: () => void;
  onGiveMedicineItem?: () => void;
  onOpenFoodShop?: () => void;
  onOpenClinic?: () => void;
  onGenerateSupplySearch?: () => void;
  onGenerateTraining?: () => void;
  onSetTimeSlots?: (time: TimeOfDay) => void;
  onSpawnEasyFight?: () => void;
  onSpawnStandardFight?: () => void;
  onSpawnDeadlyFight?: () => void;
  onSpawnTwoEnemyFight?: () => void;
  onSpawnFourEnemyFight?: () => void;
  onSpawnBossFight?: () => void;
  onSpawnBossAddsFight?: () => void;
  onSetDay?: (day: number) => void;
  onShowDifficulty?: () => void;
  onShowInitiative?: () => void;
  onForceKnownCharacter?: () => void;
  onGiveDevilFruit?: () => void;
  onAddQuestItem?: () => void;
  onRecruitTestCrew?: () => void;
  onEquipToCrew?: () => void;
  onAddMastery?: () => void;
  onGenerateIslandName?: () => void;
  onSetTimeWeather?: (time: TimeOfDay, weather: "CLEAR" | "STORM" | "FOG") => void;
  onClearCooldowns?: () => void;
  onGiveXp?: () => void;
  onLevelUp?: () => void;
  onStatPoint?: () => void;
  onTechniquePoint?: () => void;
  onGenerateChestEncounter?: () => void;
  onJoinFaction?: (factionId: CareerFactionId) => void;
  onSetIndependent?: () => void;
  onPromote?: () => void;
  onDemote?: () => void;
  onAddFactionReputation?: (amount: number) => void;
  onTriggerRecruitmentOffer?: (factionId: CareerFactionId) => void;
  onDesert?: () => void;
  onSwitchFaction?: (factionId: CareerFactionId) => void;
  onGenerateFactionMission?: () => void;
  onGenerateFactionOrder?: () => void;
  onSetAuthority?: (score: number) => void;
  onTogglePolicy?: (orderId: string) => void;
  onForcePolicyViolation?: () => void;
  onSetRaceKnowledge?: (raceId: string) => void;
  onAutoParty?: () => void;
  onShowCombatCalc?: () => void;
  onGenerateFleetStory?: () => void;
  debugFeedback?: string | null;
};

export function DebugOverlay({
  profile,
  onClose,
  onGenerateOffer,
  onIncreasePity,
  onForceCombat,
  onGiveItem,
  onHeal,
  onFactionInfluence,
  onFactionEvent,
  onDiscoverRevolutionary,
  onFactionRumor,
  onGenerateStoryThread,
  onAdvanceStoryThread,
  onResolveStoryThread,
  onGenerateCharacter,
  onForceJoinInterest,
  onGiveWeapon,
  onGiveRandomWeapon,
  onEquipSelectedWeapon,
  onPrintEquippedWeaponState,
  onSetPlayerHp,
  onDamagePlayer,
  onGiveDriedMeat,
  onGiveMedicineItem,
  onOpenFoodShop,
  onOpenClinic,
  onGenerateSupplySearch,
  onGenerateTraining,
  onSetTimeSlots,
  onSpawnEasyFight,
  onSpawnStandardFight,
  onSpawnDeadlyFight,
  onSpawnTwoEnemyFight,
  onSpawnFourEnemyFight,
  onSpawnBossFight,
  onSpawnBossAddsFight,
  onSetDay,
  onShowDifficulty,
  onShowInitiative,
  onForceKnownCharacter,
  onGiveDevilFruit,
  onAddQuestItem,
  onRecruitTestCrew,
  onEquipToCrew,
  onAddMastery,
  onGenerateIslandName,
  onSetTimeWeather,
  onClearCooldowns,
  onGiveXp,
  onLevelUp,
  onStatPoint,
  onTechniquePoint,
  onGenerateChestEncounter,
  onJoinFaction,
  onSetIndependent,
  onPromote,
  onDemote,
  onAddFactionReputation,
  onTriggerRecruitmentOffer,
  onDesert,
  onSwitchFaction,
  onGenerateFactionMission,
  onGenerateFactionOrder,
  onSetAuthority,
  onTogglePolicy,
  onForcePolicyViolation,
  onSetRaceKnowledge,
  onAutoParty,
  onShowCombatCalc,
  onGenerateFleetStory,
  debugFeedback,
}: DebugOverlayProps) {
  const run = profile.activeRun;
  const location = run ? getLocation(run.currentLocationId) : undefined;
  const revolutionary = run
    ? run.world.factions.find((item) => item.factionId === "REVOLUTIONARY_ARMY")
    : undefined;
  const snapshot = run ? debugCombatSnapshot(run) : null;
  const playable = RaceService.getPlayableRaces(profile).filter((race) => race.id !== HUMAN_RACE_ID);
  const debugFaction: RelationFactionId = "MARINES";
  const activeThreads = run ? StoryThreadService.getActiveThreads(run) : [];
  const affiliation = run ? AffiliationService.summary(run) : null;

  return (
    <OverlayFrame eyebrow="DEVELOPMENT" title="Debug" onClose={onClose}>
      <div className="debug-grid">
        <div>profile type: {profile.profileType}</div>
        <div>profile id: {profile.id}</div>
        <div>save version: {profile.version}</div>
        {run ? (
          <>
            <div>run id: {run.id}</div>
            <div>seed: {run.seed}</div>
            <div>current encounter: {run.currentEncounterId ?? "none"}</div>
            <div>encounter count: {run.encounterCount}</div>
            <div>encounter history: {run.encounterHistory.length}</div>
            <div>story threads: {run.storyThreads.length} active {activeThreads.length}</div>
            <div>crew: {run.crew.length} · core cap 10</div>
            <div>
              authority: {run.authority?.score ?? "—"} ({run.authority?.state ?? "—"}) · fleet{" "}
              {run.fleet?.length ?? 0}
            </div>
            <div>
              active party: {(run.activeParty?.activeFighterIds ?? []).length} fighters · support{" "}
              {(run.activeParty?.supportSlotIds ?? []).length}
            </div>
            <div>islands: {run.islands.length}</div>
            <div>
              affiliation: {affiliation?.factionLabel ?? "—"} · {affiliation?.rankLabel ?? "—"} ·{" "}
              {affiliation?.status ?? "—"}
            </div>
            <div>
              loyalty: {affiliation?.loyalty ?? "—"} · internal rep:{" "}
              {affiliation?.reputationWithin ?? "—"}
            </div>
            <div>title: {run.player.title}</div>
            <div>day: {run.day}</div>
            <div>time: {run.timeOfDay} · weather: {run.currentWeather ?? "CLEAR"}</div>
            <div>
              location: {location?.name ?? run.currentLocationId} (
              {location ? getRegionName(location.regionId) : "?"})
            </div>
            <div>player flags: {run.player.flags.join(", ") || "—"}</div>
            <div>world flags: {run.world.flags.join(", ") || "—"}</div>
            <div>run flags: {run.runFlags.join(", ") || "—"}</div>
            <div>progression: {Object.keys(run.worldProgressionFlags).filter((k) => run.worldProgressionFlags[k]).join(", ") || "—"}</div>
            <div>WG power: {run.world.worldPower.worldGovernmentPower}</div>
            <div>oppression: {run.world.worldPower.oppression}</div>
            <div>revolutionary activity: {run.world.worldPower.revolutionaryActivity}</div>
            <div>
              Revolutionary:{" "}
              {revolutionary?.discovered
                ? `${getFaction("REVOLUTIONARY_ARMY").name} revealed (${revolutionary.value})`
                : "hidden"}
            </div>
            <div>factionWorld entries: {run.world.factionWorld?.length ?? 0}</div>
            <div>threat: {snapshot?.threatLevel ?? "—"}</div>
            <div>player power: {snapshot?.playerPower ?? "—"}</div>
            <div>enemy power: {snapshot?.enemyPower ?? "—"}</div>
            <div>escape base: {snapshot?.escapeBase != null ? `${snapshot.escapeBase}%` : "—"}</div>
            <div>escape pity: {snapshot?.escapePity != null ? `+${snapshot.escapePity}%` : "—"}</div>
            <div>escape total: {snapshot?.escapeTotal != null ? `${snapshot.escapeTotal}%` : "—"}</div>
          </>
        ) : (
          <div>no active run</div>
        )}
        {debugFeedback ? <div className="mt-2 text-gold">{debugFeedback}</div> : null}
        <div className="mt-3 font-display text-gold">Race offer pity</div>
        {playable.map((race) => {
          const pity = RaceService.getPity(profile, race.id);
          return (
            <div key={race.id}>
              {race.name}: missed {pity.missedOffers}/{race.hardPityAfterMisses} · bonus {pity.pityBonus}
            </div>
          );
        })}
        {run && run.encounterHistory.length > 0 ? (
          <>
            <div className="mt-3 font-display text-gold">Recent encounters</div>
            {EncounterHistoryService.formatHistory(run, 5).map((line) => (
              <div key={line}>{line}</div>
            ))}
          </>
        ) : null}
      </div>
      <div className="debug-actions">
        {onGenerateStoryThread ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateStoryThread} type="button">
            Generate StoryThread
          </button>
        ) : null}
        {onAdvanceStoryThread ? (
          <button className="choice-btn" disabled={!run} onClick={onAdvanceStoryThread} type="button">
            Advance StoryThread
          </button>
        ) : null}
        {onResolveStoryThread ? (
          <button className="choice-btn" disabled={!run} onClick={onResolveStoryThread} type="button">
            Resolve StoryThread
          </button>
        ) : null}
        {onGenerateCharacter ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateCharacter} type="button">
            Generate Character
          </button>
        ) : null}
        {onForceJoinInterest ? (
          <button className="choice-btn" disabled={!run} onClick={onForceJoinInterest} type="button">
            Force Join Interest
          </button>
        ) : null}
        {onGiveWeapon ? (
          <button className="choice-btn" disabled={!run} onClick={onGiveWeapon} type="button">
            Give Weapon Without Equipping
          </button>
        ) : null}
        {onGiveRandomWeapon ? (
          <button className="choice-btn" disabled={!run} onClick={onGiveRandomWeapon} type="button">
            Give Random Weapon (No Equip)
          </button>
        ) : null}
        {onEquipSelectedWeapon ? (
          <button className="choice-btn" disabled={!run} onClick={onEquipSelectedWeapon} type="button">
            Equip Selected Weapon
          </button>
        ) : null}
        {onPrintEquippedWeaponState ? (
          <button className="choice-btn" disabled={!run} onClick={onPrintEquippedWeaponState} type="button">
            Print Equipped Weapon State
          </button>
        ) : null}
        {onSetPlayerHp ? (
          <>
            <button className="choice-btn" disabled={!run} onClick={() => onSetPlayerHp(10)} type="button">
              Set HP 10
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetPlayerHp(50)} type="button">
              Set HP 50
            </button>
          </>
        ) : null}
        {onDamagePlayer ? (
          <button className="choice-btn" disabled={!run} onClick={() => onDamagePlayer(20)} type="button">
            Damage Player (−20)
          </button>
        ) : null}
        {onGiveDriedMeat ? (
          <button className="choice-btn" disabled={!run} onClick={onGiveDriedMeat} type="button">
            Give Dried Meat
          </button>
        ) : null}
        {onGiveMedicineItem ? (
          <button className="choice-btn" disabled={!run} onClick={onGiveMedicineItem} type="button">
            Give Medicine
          </button>
        ) : null}
        {onOpenFoodShop ? (
          <button className="choice-btn" disabled={!run} onClick={onOpenFoodShop} type="button">
            Open Food Shop
          </button>
        ) : null}
        {onOpenClinic ? (
          <button className="choice-btn" disabled={!run} onClick={onOpenClinic} type="button">
            Open Clinic
          </button>
        ) : null}
        {onGenerateSupplySearch ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateSupplySearch} type="button">
            Generate Supply Search
          </button>
        ) : null}
        {onGenerateTraining ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateTraining} type="button">
            Generate Training Day
          </button>
        ) : null}
        {onSetTimeSlots ? (
          <>
            <button className="choice-btn" disabled={!run} onClick={() => onSetTimeSlots("DAWN")} type="button">
              Set Time: Dawn
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetTimeSlots("AFTERNOON")} type="button">
              Set Time: Afternoon
            </button>
          </>
        ) : null}
        {onSpawnEasyFight ? (
          <button className="choice-btn" disabled={!run} onClick={onSpawnEasyFight} type="button">
            Spawn Easy Fight
          </button>
        ) : null}
        {onSpawnStandardFight ? (
          <button className="choice-btn" disabled={!run} onClick={onSpawnStandardFight} type="button">
            Spawn Standard Fight
          </button>
        ) : null}
        {onSpawnDeadlyFight ? (
          <button className="choice-btn" disabled={!run} onClick={onSpawnDeadlyFight} type="button">
            Spawn Deadly Fight
          </button>
        ) : null}
        {onSpawnTwoEnemyFight ? (
          <button className="choice-btn" disabled={!run} onClick={onSpawnTwoEnemyFight} type="button">
            Generate 2 Enemy Fight
          </button>
        ) : null}
        {onSpawnFourEnemyFight ? (
          <button className="choice-btn" disabled={!run} onClick={onSpawnFourEnemyFight} type="button">
            Generate 4 Enemy Fight
          </button>
        ) : null}
        {onSpawnBossFight ? (
          <button className="choice-btn" disabled={!run} onClick={onSpawnBossFight} type="button">
            Generate Boss Fight
          </button>
        ) : null}
        {onSpawnBossAddsFight ? (
          <button className="choice-btn" disabled={!run} onClick={onSpawnBossAddsFight} type="button">
            Generate Boss + Adds
          </button>
        ) : null}
        {onSetDay ? (
          <>
            <button className="choice-btn" disabled={!run} onClick={() => onSetDay(1)} type="button">
              Set Day 1
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetDay(25)} type="button">
              Set Day 25
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetDay(50)} type="button">
              Set Day 50
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetDay(100)} type="button">
              Set Day 100
            </button>
          </>
        ) : null}
        {onShowDifficulty ? (
          <button className="choice-btn" disabled={!run} onClick={onShowDifficulty} type="button">
            Show Difficulty Calculation
          </button>
        ) : null}
        {onShowInitiative ? (
          <button className="choice-btn" disabled={!run} onClick={onShowInitiative} type="button">
            Show Turn Initiative
          </button>
        ) : null}
        {onForceKnownCharacter ? (
          <button className="choice-btn" disabled={!run} onClick={onForceKnownCharacter} type="button">
            Show Known Character Eligibility
          </button>
        ) : null}
        {onGiveDevilFruit ? (
          <button className="choice-btn" disabled={!run} onClick={onGiveDevilFruit} type="button">
            Give Devil Fruit
          </button>
        ) : null}
        {onAddQuestItem ? (
          <button className="choice-btn" disabled={!run} onClick={onAddQuestItem} type="button">
            Add Quest Item
          </button>
        ) : null}
        {onRecruitTestCrew ? (
          <button className="choice-btn" disabled={!run} onClick={onRecruitTestCrew} type="button">
            Recruit Test Crew
          </button>
        ) : null}
        {onEquipToCrew ? (
          <button className="choice-btn" disabled={!run} onClick={onEquipToCrew} type="button">
            Equip to Crew
          </button>
        ) : null}
        {onAddMastery ? (
          <button className="choice-btn" disabled={!run} onClick={onAddMastery} type="button">
            Set Mastery (+5)
          </button>
        ) : null}
        {onGenerateIslandName ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateIslandName} type="button">
            Generate Island
          </button>
        ) : null}
        {onSetTimeWeather ? (
          <>
            <button className="choice-btn" disabled={!run} onClick={() => onSetTimeWeather("MORNING", "CLEAR")} type="button">
              Morning / Clear
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetTimeWeather("NIGHT", "STORM")} type="button">
              Night / Storm
            </button>
          </>
        ) : null}
        {onClearCooldowns ? (
          <button className="choice-btn" disabled={!run} onClick={onClearCooldowns} type="button">
            Clear Cooldowns
          </button>
        ) : null}
        {onGiveXp ? (
          <button className="choice-btn" disabled={!run} onClick={onGiveXp} type="button">
            Give XP
          </button>
        ) : null}
        {onLevelUp ? (
          <button className="choice-btn" disabled={!run} onClick={onLevelUp} type="button">
            Level Up
          </button>
        ) : null}
        {onStatPoint ? (
          <button className="choice-btn" disabled={!run} onClick={onStatPoint} type="button">
            Stat Point
          </button>
        ) : null}
        {onTechniquePoint ? (
          <button className="choice-btn" disabled={!run} onClick={onTechniquePoint} type="button">
            Technique Point
          </button>
        ) : null}
        {onGenerateChestEncounter ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateChestEncounter} type="button">
            Generate Chest Encounter
          </button>
        ) : null}
        {onJoinFaction ? (
          <>
            <button className="choice-btn" disabled={!run} onClick={() => onJoinFaction("MARINES")} type="button">
              Join Marines
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onJoinFaction("PIRATES")} type="button">
              Join Pirates
            </button>
            <button
              className="choice-btn"
              disabled={!run}
              onClick={() => onJoinFaction("REVOLUTIONARY_ARMY")}
              type="button"
            >
              Join Revolutionaries
            </button>
            <button
              className="choice-btn"
              disabled={!run}
              onClick={() => onJoinFaction("WORLD_GOVERNMENT")}
              type="button"
            >
              Join World Government
            </button>
            <button
              className="choice-btn"
              disabled={!run}
              onClick={() => onJoinFaction("BOUNTY_HUNTER")}
              type="button"
            >
              Become Bounty Hunter
            </button>
          </>
        ) : null}
        {onSetIndependent ? (
          <button className="choice-btn" disabled={!run} onClick={onSetIndependent} type="button">
            Set Independent
          </button>
        ) : null}
        {onPromote ? (
          <button className="choice-btn" disabled={!run} onClick={onPromote} type="button">
            Promote
          </button>
        ) : null}
        {onDemote ? (
          <button className="choice-btn" disabled={!run} onClick={onDemote} type="button">
            Demote
          </button>
        ) : null}
        {onAddFactionReputation ? (
          <button className="choice-btn" disabled={!run} onClick={() => onAddFactionReputation(15)} type="button">
            Add Faction Reputation
          </button>
        ) : null}
        {onTriggerRecruitmentOffer ? (
          <button
            className="choice-btn"
            disabled={!run}
            onClick={() => onTriggerRecruitmentOffer("MARINES")}
            type="button"
          >
            Trigger Recruitment Offer
          </button>
        ) : null}
        {onDesert ? (
          <button className="choice-btn" disabled={!run} onClick={onDesert} type="button">
            Desert
          </button>
        ) : null}
        {onSwitchFaction ? (
          <button className="choice-btn" disabled={!run} onClick={() => onSwitchFaction("PIRATES")} type="button">
            Switch Faction (→ Pirates)
          </button>
        ) : null}
        {onGenerateFactionMission ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateFactionMission} type="button">
            Generate Faction Mission
          </button>
        ) : null}
        {onGenerateFactionOrder ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateFactionOrder} type="button">
            Generate Faction Order
          </button>
        ) : null}
        {onShowCombatCalc ? (
          <button className="choice-btn" disabled={!run} onClick={onShowCombatCalc} type="button">
            Show Combat Calc
          </button>
        ) : null}
        {onAutoParty ? (
          <button className="choice-btn" disabled={!run} onClick={onAutoParty} type="button">
            Auto Assign Party/Support
          </button>
        ) : null}
        {onSetAuthority ? (
          <>
            <button className="choice-btn" disabled={!run} onClick={() => onSetAuthority(80)} type="button">
              Set Authority 80
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetAuthority(15)} type="button">
              Set Authority 15
            </button>
          </>
        ) : null}
        {onTogglePolicy ? (
          <button className="choice-btn" disabled={!run} onClick={() => onTogglePolicy("no_pillage")} type="button">
            Toggle No Pillaging Policy
          </button>
        ) : null}
        {onForcePolicyViolation ? (
          <button className="choice-btn" disabled={!run} onClick={onForcePolicyViolation} type="button">
            Force Policy Violation
          </button>
        ) : null}
        {onSetRaceKnowledge ? (
          <>
            <button className="choice-btn" disabled={!run} onClick={() => onSetRaceKnowledge("FISH_MAN")} type="button">
              Set Fish-Man Knowledge
            </button>
            <button className="choice-btn" disabled={!run} onClick={() => onSetRaceKnowledge("MINK")} type="button">
              Set Mink Knowledge
            </button>
          </>
        ) : null}
        {onGenerateFleetStory ? (
          <button className="choice-btn" disabled={!run} onClick={onGenerateFleetStory} type="button">
            Generate Fleet Story Stub
          </button>
        ) : null}
        {onGenerateOffer ? (
          <button className="choice-btn" onClick={onGenerateOffer} type="button">
            Generate New Race Offer
          </button>
        ) : null}
        {onIncreasePity ? (
          <button className="choice-btn" onClick={onIncreasePity} type="button">
            Increase Race Pity
          </button>
        ) : null}
        {onForceCombat ? (
          <button className="choice-btn" disabled={!run} onClick={onForceCombat} type="button">
            Force Combat Encounter
          </button>
        ) : null}
        {onGiveItem ? (
          <button className="choice-btn" disabled={!run} onClick={onGiveItem} type="button">
            Give Test Item
          </button>
        ) : null}
        {onHeal ? (
          <button className="choice-btn" disabled={!run} onClick={onHeal} type="button">
            Heal Player
          </button>
        ) : null}
        {onFactionInfluence ? (
          <>
            <button
              className="choice-btn"
              disabled={!run}
              onClick={() => onFactionInfluence(debugFaction, 5)}
              type="button"
            >
              Marines Influence +5
            </button>
            <button
              className="choice-btn"
              disabled={!run}
              onClick={() => onFactionInfluence(debugFaction, -5)}
              type="button"
            >
              Marines Influence -5
            </button>
          </>
        ) : null}
        {onFactionEvent ? (
          <button
            className="choice-btn"
            disabled={!run}
            onClick={() => onFactionEvent(debugFaction)}
            type="button"
          >
            Generate Marines Event
          </button>
        ) : null}
        {onFactionRumor ? (
          <button
            className="choice-btn"
            disabled={!run}
            onClick={() => onFactionRumor(debugFaction)}
            type="button"
          >
            Generate Marines Rumor
          </button>
        ) : null}
        {onDiscoverRevolutionary ? (
          <button className="choice-btn" disabled={!run} onClick={onDiscoverRevolutionary} type="button">
            Discover Revolutionary
          </button>
        ) : null}
      </div>
    </OverlayFrame>
  );
}
