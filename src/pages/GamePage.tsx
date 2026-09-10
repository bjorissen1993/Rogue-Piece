import { useEffect, useState } from "react";
import { BattleResultFlow } from "../components/BattleResultFlow";
import { CombatView } from "../components/CombatView";
import { CrewOverlay } from "../components/CrewOverlay";
import { DebugOverlay } from "../components/DebugOverlay";
import { EncounterView } from "../components/EncounterView";
import { FactionTubes } from "../components/FactionTubes";
import { InventoryOverlay } from "../components/InventoryOverlay";
import { PlayerHud } from "../components/PlayerHud";
import { RunBar } from "../components/RunBar";
import { WorldNewsStrip } from "../components/WorldNewsStrip";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { LootDispositionModal, peekLootDisposition } from "../components/LootDispositionModal";
import { TechniqueOpportunityOverlay } from "../components/TechniqueOpportunityOverlay";
import { ProgressionService } from "../services/ProgressionService";
import { IslandService } from "../services/IslandService";
import { EncounterEngine } from "../services/EncounterEngine";
import { AffiliationService } from "../services/AffiliationService";
import { interpolate } from "../utils/text";
import { useGameStore } from "../stores/GameStore";

export function GamePage() {
  const {
    profile,
    overlay,
    openOverlay,
    closeOverlay,
    choose,
    continueResult,
    dismissBattleResult,
    combatAction,
    resolveEnemyTurn,
    useCombatItem,
    useInventoryItem,
    confirmLevelUp,
    selectTechnique,
    fruitInventoryAction,
    resolveLootBackpack,
    resolveLootAssign,
    assignStashWeapon,
    assignStashFruit,
    dismissFeedback,
    returnToProfileMenu,
    requestResetDev,
    debugGenerateRaceOffer,
    debugIncreasePity,
    debugForceCombat,
    debugGiveTestItem,
    debugHealPlayer,
    debugFactionInfluence,
    debugFactionEvent,
    debugDiscoverRevolutionary,
    debugFactionRumor,
    debugGenerateStoryThread,
    debugAdvanceStoryThread,
    debugResolveStoryThread,
    debugGenerateCharacter,
    debugForceJoinInterest,
    debugGiveWeapon,
    debugGiveRandomWeapon,
    debugEquipSelectedWeapon,
    debugPrintEquippedWeaponState,
    debugSetPlayerHp,
    debugDamagePlayer,
    debugGiveDriedMeat,
    debugGiveMedicine,
    debugOpenFoodShop,
    debugOpenClinic,
    debugGenerateSupplySearch,
    debugGenerateTraining,
    debugSetTimeSlots,
    debugSpawnEasyFight,
    debugSpawnStandardFight,
    debugSpawnDeadlyFight,
    debugSpawnTwoEnemyFight,
    debugSpawnFourEnemyFight,
    debugSpawnBossFight,
    debugSpawnBossAddsFight,
    debugSetDay,
    debugShowDifficulty,
    debugShowInitiative,
    debugForceKnownCharacter,
    debugGiveDevilFruit,
    debugAddQuestItem,
    debugRecruitTestCrew,
    debugEquipToCrew,
    debugAddMastery,
    debugGenerateIslandName,
    debugSetTimeWeather,
    debugClearCooldowns,
    debugGiveXp,
    debugLevelUp,
    debugStatPoint,
    debugTechniquePoint,
    debugGenerateChestEncounter,
    debugJoinFaction,
    debugSetIndependent,
    debugPromote,
    debugDemote,
    debugAddFactionReputation,
    debugTriggerRecruitmentOffer,
    debugDesert,
    debugSwitchFaction,
    debugGenerateFactionMission,
    debugGenerateFactionOrder,
    debugSetAuthority,
    debugTogglePolicy,
    debugForcePolicyViolation,
    debugSetRaceKnowledge,
    debugAutoParty,
    debugShowCombatCalc,
    debugGenerateFleetStory,
    debugFeedback,
  } = useGameStore();
  const [inventoryFocusId, setInventoryFocusId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const run = profile?.activeRun;
  const lastFeedback = run?.lastFeedback ?? null;
  const lastHpChange = run?.lastHpChange ?? null;
  const playerHp = run?.player.hp ?? 0;

  useEffect(() => {
    if (!lastFeedback) {
      return;
    }
    setToast(lastFeedback);
    const hide = window.setTimeout(() => setToast(null), 3200);
    const clear = window.setTimeout(() => dismissFeedback(), 3400);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(clear);
    };
  }, [dismissFeedback, lastFeedback, lastHpChange, playerHp]);

  if (!profile || !run) {
    return null;
  }

  const isDev = profile.profileType === "DEVELOPMENT";
  const crewLabel = AffiliationService.getCrewLabel(run);
  const encounter = EncounterEngine.getCurrentEncounter(run);
  const presented = EncounterEngine.getPresentedChoices(run);
  const choices = presented.map((entry) => entry.choice);
  const lockReasons = Object.fromEntries(
    presented.filter((entry) => entry.lockReason).map((entry) => [entry.choice.id, entry.lockReason!]),
  );
  const description = encounter ? interpolate(encounter.description, run) : "The horizon waits.";
  const resultText = run.awaitingAdvance ? run.lastResultText : null;
  const island = IslandService.getCurrentIsland(run);
  const pendingLevelUp = ProgressionService.peekPendingLevelUp(run);
  const pendingTechnique = run.pendingTechniqueChoice;

  return (
    <div className="game-shell">
      <RunBar isDev={isDev} onMenu={() => openOverlay("gameMenu")} run={run} />
      <PlayerHud
        onCrew={() => openOverlay("crew")}
        onInventory={(itemId) => {
          setInventoryFocusId(itemId ?? null);
          openOverlay("inventory");
        }}
        run={run}
      />
      <main className="game-main">
        {run.combat && !run.combat.finished ? (
          <CombatView
            combat={run.combat}
            items={run.player.inventory}
            onAction={(type, abilityId, targetId) => combatAction({ type, abilityId, targetId })}
            onResolveEnemyTurn={resolveEnemyTurn}
            onUseItem={useCombatItem}
          />
        ) : (
          <EncounterView
            backgroundContext={{
              timeOfDay: run.timeOfDay,
              weather: run.currentWeather ?? "CLEAR",
              islandType: island?.archetype,
              biome: island?.biome,
              dangerLevel: island?.dangerLevel,
            }}
            choices={choices}
            description={description}
            encounter={encounter}
            gameOver={run.gameOver}
            isDev={isDev}
            lockReasons={lockReasons}
            onChoose={choose}
            onContinue={continueResult}
            player={run.player}
            resultText={resultText}
            run={run}
            timeOfDay={run.timeOfDay}
          />
        )}
      </main>
      <FactionTubes run={run} />
      <WorldNewsStrip run={run} />
      {toast ? <p className="feedback-toast">{toast}</p> : null}

      {run.pendingBattleResult ? (
        <BattleResultFlow
          onComplete={dismissBattleResult}
          onConfirmLevelUp={confirmLevelUp}
          pendingLevelUp={pendingLevelUp}
          report={run.pendingBattleResult}
          run={run}
        />
      ) : null}

      {overlay === "gameMenu" ? (
        <div className="overlay-scrim">
          <section className="overlay-panel overlay-panel-narrow">
            <h2 className="font-display text-3xl text-gold">Menu</h2>
            <div className="mt-6 grid gap-3">
              <button className="choice-btn" onClick={closeOverlay} type="button">
                Resume
              </button>
              <button className="choice-btn" onClick={() => openOverlay("crew")} type="button">
                {crewLabel}
              </button>
              <button className="choice-btn" onClick={() => openOverlay("collection")} type="button">
                Collection
              </button>
              <button className="choice-btn" onClick={() => openOverlay("achievements")} type="button">
                Achievements
              </button>
              <button className="choice-btn" onClick={() => openOverlay("statistics")} type="button">
                Statistics
              </button>
              {isDev ? (
                <>
                  <button className="choice-btn" onClick={() => openOverlay("debug")} type="button">
                    Debug
                  </button>
                  <button className="ghost-btn" onClick={requestResetDev} type="button">
                    Reset Development Profile
                  </button>
                </>
              ) : null}
              <button className="ghost-btn" onClick={returnToProfileMenu} type="button">
                Return to Profile
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {overlay === "inventory" ? (
        <InventoryOverlay
          inCombat={Boolean(run.combat && !run.combat.finished)}
          initialSelectedId={inventoryFocusId}
          key={inventoryFocusId ?? "backpack"}
          onClose={closeOverlay}
          onFruitAction={fruitInventoryAction}
          onUse={(itemId) => {
            useInventoryItem(itemId);
          }}
          run={run}
        />
      ) : null}
      {overlay === "crew" ? (
        <CrewOverlay
          onAssignStashFruit={assignStashFruit}
          onAssignStashWeapon={assignStashWeapon}
          onClose={closeOverlay}
          run={run}
        />
      ) : null}

      {peekLootDisposition(run) && !run.combat ? (
        <LootDispositionModal
          onAssign={resolveLootAssign}
          onBackpack={resolveLootBackpack}
          pending={peekLootDisposition(run)!}
          run={run}
        />
      ) : null}

      {pendingLevelUp && !run.combat && !run.pendingBattleResult ? (
        <div className="overlay-scrim">
          <LevelUpOverlay
            key={`${pendingLevelUp.characterId}-${pendingLevelUp.fromLevel}-${pendingLevelUp.toLevel}`}
            onConfirm={confirmLevelUp}
            pending={pendingLevelUp}
            run={run}
          />
        </div>
      ) : null}

      {pendingTechnique && !pendingLevelUp && !run.combat ? (
        <div className="overlay-scrim">
          <TechniqueOpportunityOverlay onSelect={selectTechnique} pending={pendingTechnique} run={run} />
        </div>
      ) : null}

      {overlay === "debug" && isDev ? (
        <DebugOverlay
          debugFeedback={debugFeedback}
          onAddMastery={debugAddMastery}
          onAddQuestItem={debugAddQuestItem}
          onAdvanceStoryThread={debugAdvanceStoryThread}
          onClearCooldowns={debugClearCooldowns}
          onGenerateChestEncounter={debugGenerateChestEncounter}
          onJoinFaction={debugJoinFaction}
          onSetIndependent={debugSetIndependent}
          onPromote={debugPromote}
          onDemote={debugDemote}
          onAddFactionReputation={debugAddFactionReputation}
          onTriggerRecruitmentOffer={debugTriggerRecruitmentOffer}
          onDesert={debugDesert}
          onSwitchFaction={debugSwitchFaction}
          onGenerateFactionMission={debugGenerateFactionMission}
          onGenerateFactionOrder={debugGenerateFactionOrder}
          onGiveXp={debugGiveXp}
          onLevelUp={debugLevelUp}
          onStatPoint={debugStatPoint}
          onTechniquePoint={debugTechniquePoint}
          onClose={closeOverlay}
          onDiscoverRevolutionary={debugDiscoverRevolutionary}
          onEquipToCrew={debugEquipToCrew}
          onFactionEvent={debugFactionEvent}
          onFactionInfluence={debugFactionInfluence}
          onFactionRumor={debugFactionRumor}
          onForceCombat={debugForceCombat}
          onForceJoinInterest={debugForceJoinInterest}
          onGenerateCharacter={debugGenerateCharacter}
          onGenerateIslandName={debugGenerateIslandName}
          onGenerateOffer={debugGenerateRaceOffer}
          onGenerateStoryThread={debugGenerateStoryThread}
          onGiveDevilFruit={debugGiveDevilFruit}
          onGiveItem={debugGiveTestItem}
          onGiveRandomWeapon={debugGiveRandomWeapon}
          onGiveWeapon={debugGiveWeapon}
          onEquipSelectedWeapon={debugEquipSelectedWeapon}
          onPrintEquippedWeaponState={debugPrintEquippedWeaponState}
          onSetPlayerHp={debugSetPlayerHp}
          onDamagePlayer={debugDamagePlayer}
          onGiveDriedMeat={debugGiveDriedMeat}
          onGiveMedicineItem={debugGiveMedicine}
          onOpenFoodShop={debugOpenFoodShop}
          onOpenClinic={debugOpenClinic}
          onGenerateSupplySearch={debugGenerateSupplySearch}
          onGenerateTraining={debugGenerateTraining}
          onSetTimeSlots={debugSetTimeSlots}
          onSpawnEasyFight={debugSpawnEasyFight}
          onSpawnStandardFight={debugSpawnStandardFight}
          onSpawnDeadlyFight={debugSpawnDeadlyFight}
          onSpawnTwoEnemyFight={debugSpawnTwoEnemyFight}
          onSpawnFourEnemyFight={debugSpawnFourEnemyFight}
          onSpawnBossFight={debugSpawnBossFight}
          onSpawnBossAddsFight={debugSpawnBossAddsFight}
          onSetDay={debugSetDay}
          onShowDifficulty={debugShowDifficulty}
          onShowInitiative={debugShowInitiative}
          onForceKnownCharacter={debugForceKnownCharacter}
          onHeal={debugHealPlayer}
          onIncreasePity={debugIncreasePity}
          onRecruitTestCrew={debugRecruitTestCrew}
          onResolveStoryThread={debugResolveStoryThread}
          onSetTimeWeather={debugSetTimeWeather}
          onSetAuthority={debugSetAuthority}
          onTogglePolicy={debugTogglePolicy}
          onForcePolicyViolation={debugForcePolicyViolation}
          onSetRaceKnowledge={debugSetRaceKnowledge}
          onAutoParty={debugAutoParty}
          onShowCombatCalc={debugShowCombatCalc}
          onGenerateFleetStory={debugGenerateFleetStory}
          profile={profile}
        />
      ) : null}
    </div>
  );
}
