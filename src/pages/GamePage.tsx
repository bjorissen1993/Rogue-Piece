import { useCallback, useEffect, useRef, useState } from "react";
import { AssignmentResultOverlay } from "../components/AssignmentResultOverlay";
import { BattleResultFlow } from "../components/BattleResultFlow";
import { CombatView } from "../components/CombatView";
import { CrewOverlay } from "../components/CrewOverlay";
import { DebugOverlay } from "../components/DebugOverlay";
import { EncounterView } from "../components/EncounterView";
import { FactionTubes } from "../components/FactionTubes";
import { InventoryOverlay } from "../components/InventoryOverlay";
import { PlayerHud } from "../components/PlayerHud";
import { RunBar } from "../components/RunBar";
import { TimeDetailOverlay } from "../components/TimeDetailOverlay";
import { WorldNewsStrip } from "../components/WorldNewsStrip";
import { BattleSetupOverlay } from "../components/BattleSetupOverlay";
import { WeaponShopOverlay } from "../components/WeaponShopOverlay";
import { HarborOverlay, VoyageProgressBar } from "../components/HarborOverlay";
import { IslandHubMap } from "../components/IslandHubMap";
import { TaskBoardOverlay } from "../components/TaskBoardOverlay";
import { ItemMarketOverlay } from "../components/ItemMarketOverlay";
import { WeaponShopService } from "../services/WeaponShopService";
import { ItemMarketService } from "../services/ItemMarketService";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { LootDispositionModal, peekLootDisposition } from "../components/LootDispositionModal";
import { TechniqueOpportunityOverlay } from "../components/TechniqueOpportunityOverlay";
import { BottomSheet } from "../components/mobile/BottomSheet";
import { MobileBottomNav, type MobileNavId } from "../components/mobile/MobileBottomNav";
import { MobileTopChrome } from "../components/mobile/MobileTopChrome";
import { OverlayFrame } from "../components/OverlayFrame";
import { ProgressionService } from "../services/ProgressionService";
import { IslandService } from "../services/IslandService";
import { EncounterEngine } from "../services/EncounterEngine";
import { VoyageService } from "../services/VoyageService";
import { AffiliationService } from "../services/AffiliationService";
import { DevilFruitCombatService } from "../services/DevilFruitCombatService";
import { interpolate } from "../utils/text";
import { useGameStore } from "../stores/GameStore";
import { useDocumentClass } from "../hooks/useDocumentClass";
import { useIsMobile } from "../hooks/useMediaQuery";
import type { ZoanFormId } from "../models/types";
import { relativeDayLabel } from "../utils/presentation";
import { HudArt, HudIcon, newsArtSrc, newsGlyphName } from "../components/HudIcons";
import { AT_SEA_ENCOUNTER_ID, ISLAND_HUB_ENCOUNTER_ID, VOYAGE_AUTO_TICK_MS } from "../game/constants";

export function GamePage() {
  const {
    profile,
    overlay,
    openOverlay,
    closeOverlay,
    choose,
    talkToLocalNpcs,
    fireStoryTrigger,
    resetStoryChain,
    completeFishing,
    buyMarketItem,
    sellMarketItem,
    buyClinicItem,
    sellClinicItem,
    saveIslandFacilityHotspots,
    consumeIslandHotspot,
    restoreIslandProbe,
    setIslandMapAsset,
    ensureIslandHubMaps,
    continueResult,
    beginVoyage,
    tickVoyage,
    dismissAssignmentResults,
    dismissBattleResult,
    finishCombatPresentation,
    syncCombatVitals,
    ensureWeaponShop,
    buyWeaponShopListing,
    sellWeaponShopOwned,
    upgradeOwnedWeapon,
    applyOwnedWeaponSeastone,
    bindOwnedWeaponFruit,
    renameOwnedWeapon,
    applyOwnedWeaponNaming,
    destroyOwnedWeaponHost,
    refreshWeaponShop,
    ensureItemMarket,
    buyItemMarketListing,
    refreshItemMarket,
    acceptFactionMission,
    resolveFactionMission,
    postFactionMissionWork,
    ensureTaskBoard,
    confirmBattleSetup,
    cancelBattleSetup,
    combatAction,
    resolveEnemyTurn,
    useCombatItem,
    useInventoryItem,
    sellInventoryItem,
    confirmLevelUp,
    selectTechnique,
    fruitInventoryAction,
    giveFruitToCrew,
    resolveLootBackpack,
    resolveLootAssign,
    assignStashWeapon,
    assignStashFruit,
    equipWeapon,
    unequipWeapon,
    setZoanForm,
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
    debugOpenWeaponShop,
    debugRefreshWeaponShop,
    debugOpenClinic,
    debugGenerateSupplySearch,
    debugGenerateTraining,
    debugStartCrewTraining,
    debugEndCrewTraining,
    debugAdvanceTimeSlot,
    debugAdvanceDay,
    debugGenerateCrewRequirement,
    debugGenerateCharacterChoice,
    debugGenerateRuinedMechanism,
    debugGiveKnowledgeCollectable,
    debugSetIntelligence,
    debugClearRunKnowledge,
    debugSetTimeSlots,
    debugSpawnEasyFight,
    debugSpawnStandardFight,
    debugSpawnDeadlyFight,
    debugSpawnTwoEnemyFight,
    debugSpawnFourEnemyFight,
    debugSpawnBossFight,
    debugSpawnBossAddsFight,
    debugSpawnSeaKing,
    debugSpawnDuel,
    debugSpawnSkirmish,
    debugSpawnFriendlySpar,
    debugLegacyAdvanceYear,
    debugLegacyAdvanceDecade,
    debugLegacyPromoteCrew,
    debugLegacyGenerateChild,
    debugLegacyGenerateApprentice,
    debugLegacyInspect,
    debugLegacyForceEncounter,
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
    debugSetIdentityRole,
    debugSetLegalStatus,
    debugNudgeTendency,
    debugBecomeCelestial,
    debugLoseCelestialPrivilege,
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
  const [mobileNav, setMobileNav] = useState<MobileNavId>("game");
  const [characterSheetOpen, setCharacterSheetOpen] = useState(false);
  const [factionsSheetOpen, setFactionsSheetOpen] = useState(false);
  const [newsArchiveOpen, setNewsArchiveOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [hubListFallback, setHubListFallback] = useState(false);
  const [hubMapEditing, setHubMapEditing] = useState(false);
  const [hubToolsHost, setHubToolsHost] = useState<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const run = profile?.activeRun;
  const onHubMapEditingChange = useCallback((editing: boolean) => {
    setHubMapEditing(editing);
  }, []);
  const lastFeedback = run?.lastFeedback ?? null;
  const lastHpChange = run?.lastHpChange ?? null;
  const playerHp = run?.player.hp ?? 0;

  const pauseBackgroundMotion =
    overlay != null ||
    characterSheetOpen ||
    factionsSheetOpen ||
    newsArchiveOpen ||
    moreSheetOpen ||
    Boolean(run?.pendingBattleResult) ||
    Boolean(run?.pendingBattleSetup) ||
    Boolean(run?.pendingLevelUps?.length) ||
    Boolean(run?.pendingTechniqueChoice) ||
    Boolean(run?.pendingAssignmentResults?.length) ||
    (run?.currentEncounterId === "weapon_smith" && !run.awaitingAdvance) ||
    (run?.currentEncounterId === "island_harbor" && !run.awaitingAdvance);

  useDocumentClass("overlay-open", pauseBackgroundMotion);

  useEffect(() => {
    setHubListFallback(false);
    setHubMapEditing(false);
  }, [run?.currentIslandId, run?.currentEncounterId]);

  useEffect(() => {
    if (hubListFallback) {
      setHubMapEditing(false);
    }
  }, [hubListFallback]);

  useEffect(() => {
    if (run?.currentEncounterId === ISLAND_HUB_ENCOUNTER_ID && !run.awaitingAdvance) {
      ensureIslandHubMaps();
    }
  }, [run?.currentEncounterId, run?.currentIslandId, run?.awaitingAdvance, ensureIslandHubMaps]);

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

  useEffect(() => {
    if (!run?.combat || run.combat.finished) {
      return;
    }
    if (run.combat.playerCombatant.maxHp === run.player.maxHp) {
      return;
    }
    syncCombatVitals();
  }, [run?.combat, run?.player.maxHp, run?.player.hp, syncCombatVitals]);

  useEffect(() => {
    if (run?.currentEncounterId === "weapon_smith" && !run.awaitingAdvance) {
      ensureWeaponShop();
    }
  }, [run?.currentEncounterId, run?.awaitingAdvance, run?.currentIslandId, run?.day, ensureWeaponShop]);

  useEffect(() => {
    if (!run || run.awaitingAdvance) {
      return;
    }
    if (run.currentEncounterId === "island_black_market") {
      ensureItemMarket("BLACK_MARKET");
    } else if (run.currentEncounterId === "island_auction_house") {
      ensureItemMarket("AUCTION");
    } else if (run.currentEncounterId === "island_task_board") {
      ensureTaskBoard();
    }
  }, [
    run?.currentEncounterId,
    run?.awaitingAdvance,
    run?.currentIslandId,
    run?.day,
    ensureItemMarket,
    ensureTaskBoard,
  ]);

  useEffect(() => {
    if (!run) {
      return;
    }
    const sailing =
      (run.activityMode ?? "ISLAND") === "SAILING" &&
      Boolean(run.activeVoyage) &&
      !run.activeVoyage?.pausedForEvent &&
      run.currentEncounterId === AT_SEA_ENCOUNTER_ID &&
      !run.awaitingAdvance &&
      !run.combat &&
      !overlay;
    if (!sailing) {
      return;
    }
    const id = window.setInterval(() => tickVoyage(), VOYAGE_AUTO_TICK_MS);
    return () => window.clearInterval(id);
  }, [
    run?.activityMode,
    run?.activeVoyage,
    run?.activeVoyage?.pausedForEvent,
    run?.activeVoyage?.progress,
    run?.activeVoyage?.slotsElapsed,
    run?.currentEncounterId,
    run?.awaitingAdvance,
    run?.combat,
    overlay,
    tickVoyage,
  ]);

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
  const pendingLevelUpCount = run.pendingLevelUps?.length ?? 0;
  const pendingTechnique = run.pendingTechniqueChoice;
  const standaloneLevelUpTotal = useRef(0);
  if (pendingLevelUpCount > standaloneLevelUpTotal.current) {
    standaloneLevelUpTotal.current = pendingLevelUpCount;
  }
  if (pendingLevelUpCount === 0) {
    standaloneLevelUpTotal.current = 0;
  }
  const standaloneQueueTotal = standaloneLevelUpTotal.current;
  const standaloneQueueIndex =
    standaloneQueueTotal > 1 ? standaloneQueueTotal - pendingLevelUpCount + 1 : undefined;

  const weaponShopStock = (() => {
    if (encounter?.id !== "weapon_smith" || resultText) return null;
    const theme = island?.weaponShopTheme;
    if (theme) {
      return WeaponShopService.getStock(run, WeaponShopService.shopKey(run.currentIslandId, theme));
    }
    const shops = Object.values(run.weaponShops ?? {});
    return shops.find((entry) => run.day < entry.refreshOnDay) ?? shops[0] ?? null;
  })();

  const blackMarketStock =
    encounter?.id === "island_black_market" && !resultText
      ? ItemMarketService.getStock(
          run,
          ItemMarketService.shopKey(run.currentIslandId, "BLACK_MARKET"),
        )
      : null;
  const auctionStock =
    encounter?.id === "island_auction_house" && !resultText
      ? ItemMarketService.getStock(run, ItemMarketService.shopKey(run.currentIslandId, "AUCTION"))
      : null;

  const showIslandHubMap =
    encounter?.id === ISLAND_HUB_ENCOUNTER_ID &&
    Boolean(island) &&
    !resultText &&
    !hubListFallback &&
    !run.combat &&
    !run.pendingBattleSetup;

  const showHubMapTools = showIslandHubMap && isDev && !isMobile;

  return (
    <div
      className={`game-shell is-no-left-hud${showIslandHubMap ? " is-island-hub-map" : ""}${
        isMobile ? " is-mobile" : ""
      }`}
    >
        {isMobile ? (
          <MobileTopChrome
            isDev={isDev}
            onOpenCharacter={() => {
              setMobileNav("game");
              setCharacterSheetOpen(true);
            }}
            onOpenTime={() => openOverlay("time")}
            run={run}
          />
        ) : (
          <RunBar
            hubMapEditing={hubMapEditing}
            isDev={isDev}
            onHubToolsHost={setHubToolsHost}
            onMenu={() => openOverlay("gameMenu")}
            onOpenFactions={() => setFactionsSheetOpen(true)}
            onOpenTime={() => openOverlay("time")}
            run={run}
            showHubMapTools={showHubMapTools}
          />
        )}
        <main className="game-main">
          {run.combat ? (
            <CombatView
              combat={run.combat}
              currentZoanForm={run.player.zoanForm ?? "HUMAN"}
              items={run.player.inventory}
              onAction={(type, abilityId, targetId, targetIds) =>
                combatAction({ type, abilityId, targetId, targetIds })
              }
              onFinishPresentation={finishCombatPresentation}
              onResolveEnemyTurn={resolveEnemyTurn}
              onSetZoanForm={(formId) => setZoanForm(formId as ZoanFormId)}
              onUseItem={useCombatItem}
              zoanForms={
                DevilFruitCombatService.isZoan(run.player.devilFruitId)
                  ? DevilFruitCombatService.availableForms(run.player.devilFruitId).map((form) => ({
                      id: form.id,
                      label: form.label,
                      description: form.description,
                    }))
                  : undefined
              }
            />
          ) : run.pendingBattleSetup ? (
            <BattleSetupOverlay
              onCancel={cancelBattleSetup}
              onConfirm={confirmBattleSetup}
              run={run}
              setup={run.pendingBattleSetup}
            />
          ) : run.activityMode === "SAILING" &&
            run.activeVoyage &&
            run.currentEncounterId === AT_SEA_ENCOUNTER_ID &&
            !resultText ? (
            <VoyageProgressBar
              day={run.day}
              shipName={VoyageService.ensureShip(run).name}
              timeOfDay={run.timeOfDay}
              voyage={run.activeVoyage}
            />
          ) : showIslandHubMap && island ? (
            <IslandHubMap
              choices={choices}
              editing={hubMapEditing}
              island={island}
              isDev={isDev}
              lockReasons={lockReasons}
              onChangeMapAsset={isDev ? setIslandMapAsset : undefined}
              onChoose={choose}
              onEditingChange={onHubMapEditingChange}
              onOpenCrew={() => openOverlay("crew")}
              onOpenInventory={() => {
                setInventoryFocusId(null);
                openOverlay("inventory");
              }}
              onRequestListFallback={() => setHubListFallback(true)}
              onSaveHotspots={saveIslandFacilityHotspots}
              onConsumeHotspot={consumeIslandHotspot}
              onRestoreHotspot={restoreIslandProbe}
              onTalkNpcs={talkToLocalNpcs}
              onStoryTrigger={fireStoryTrigger}
              onResetStoryChain={resetStoryChain}
              onFinishFishing={completeFishing}
              onBuyMarketItem={buyMarketItem}
              onSellMarketItem={sellMarketItem}
              onBuyClinicItem={buyClinicItem}
              onSellClinicItem={sellClinicItem}
              onEnsureWeaponShop={ensureWeaponShop}
              onBuyWeaponShopItem={buyWeaponShopListing}
              onSellWeaponShopItem={sellWeaponShopOwned}
              onUpgradeWeapon={upgradeOwnedWeapon}
              onApplyWeaponSeastone={applyOwnedWeaponSeastone}
              onBindWeaponFruit={bindOwnedWeaponFruit}
              onRenameWeapon={renameOwnedWeapon}
              onApplyWeaponNaming={applyOwnedWeaponNaming}
              onDestroyWeaponHost={destroyOwnedWeaponHost}
              run={run}
              toolsHost={showHubMapTools ? hubToolsHost : null}
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
        {!isMobile ? <WorldNewsStrip run={run} /> : null}
        {isMobile ? (
          <MobileBottomNav
            active={mobileNav}
            hidden={Boolean(run.combat)}
            onSelect={(id) => {
              setMobileNav(id);
              setCharacterSheetOpen(false);
              setFactionsSheetOpen(false);
              setMoreSheetOpen(false);
              if (id === "game") {
                return;
              }
              if (id === "crew") {
                openOverlay("crew");
                return;
              }
              if (id === "bag") {
                setInventoryFocusId(null);
                openOverlay("inventory");
                return;
              }
              if (id === "factions") {
                setFactionsSheetOpen(true);
                return;
              }
              if (id === "more") {
                setMoreSheetOpen(true);
              }
            }}
          />
        ) : null}
        {toast ? <p className="feedback-toast">{toast}</p> : null}

      {isMobile ? (
        <BottomSheet
          eyebrow="CAPTAIN"
          onClose={() => setCharacterSheetOpen(false)}
          open={characterSheetOpen}
          size="tall"
          title={run.player.name}
        >
          <PlayerHud
            onCrew={() => {
              setCharacterSheetOpen(false);
              openOverlay("crew");
            }}
            onInventory={(itemId) => {
              setCharacterSheetOpen(false);
              setInventoryFocusId(itemId ?? null);
              openOverlay("inventory");
            }}
            run={run}
            showPackLinks
            variant="sheet"
          />
        </BottomSheet>
      ) : characterSheetOpen ? (
        <OverlayFrame
          elevate
          eyebrow={AffiliationService.getLeaderLabel(run)}
          onClose={() => setCharacterSheetOpen(false)}
          title={run.player.name}
        >
          <PlayerHud
            onCrew={() => {
              setCharacterSheetOpen(false);
              openOverlay("crew");
            }}
            onInventory={(itemId) => {
              setCharacterSheetOpen(false);
              setInventoryFocusId(itemId ?? null);
              openOverlay("inventory");
            }}
            run={run}
            showPackLinks={false}
            variant="sheet"
          />
        </OverlayFrame>
      ) : null}

      <BottomSheet
        eyebrow="STANDING"
        onClose={() => {
          setFactionsSheetOpen(false);
          if (isMobile) {
            setMobileNav("game");
          }
        }}
        open={isMobile && factionsSheetOpen}
        size="full"
        title="Factions"
      >
        <FactionTubes run={run} />
      </BottomSheet>

      {!isMobile && factionsSheetOpen ? (
        <OverlayFrame
          elevate
          eyebrow="STANDING"
          onClose={() => setFactionsSheetOpen(false)}
          title="Faction Standing"
        >
          <FactionTubes run={run} />
        </OverlayFrame>
      ) : null}

      {isMobile ? (
        <BottomSheet
          eyebrow="SHIP"
          onClose={() => {
            setMoreSheetOpen(false);
            setMobileNav("game");
          }}
          open={moreSheetOpen}
          title="More"
        >
          <div className="mobile-more-list">
            <button
              className="choice-btn"
              onClick={() => {
                setMoreSheetOpen(false);
                openOverlay("time");
              }}
              type="button"
            >
              Day &amp; Schedule
            </button>
            <button
              className="choice-btn"
              onClick={() => {
                setMoreSheetOpen(false);
                setNewsArchiveOpen(true);
              }}
              type="button"
            >
              World News
            </button>
            <button
              className="choice-btn"
              onClick={() => {
                setMoreSheetOpen(false);
                setCharacterSheetOpen(true);
              }}
              type="button"
            >
              Character Sheet
            </button>
            <button
              className="choice-btn"
              onClick={() => {
                setMoreSheetOpen(false);
                openOverlay("gameMenu");
              }}
              type="button"
            >
              Menu
            </button>
            {isDev ? (
              <button
                className="ghost-btn"
                onClick={() => {
                  setMoreSheetOpen(false);
                  openOverlay("debug");
                }}
                type="button"
              >
                Dev Tools
              </button>
            ) : null}
          </div>
        </BottomSheet>
      ) : null}

      {isMobile && newsArchiveOpen ? (
        <OverlayFrame eyebrow="TIDINGS" onClose={() => setNewsArchiveOpen(false)} title="World News">
          <div className="overlay-scroll news-archive">
            {[...run.world.history].reverse().length === 0 ? (
              <p className="text-parchment-dim">The sea has not written anything yet.</p>
            ) : (
              <ul>
                {[...run.world.history].reverse().map((event) => {
                  const art = newsArtSrc(event.text);
                  return (
                    <li key={event.id}>
                      {art ? (
                        <HudArt size={18} src={art} />
                      ) : (
                        <HudIcon name={newsGlyphName(event.text)} size={18} />
                      )}
                      <div>
                        <p>{event.text}</p>
                        <time>{relativeDayLabel(event.day, run.day)}</time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </OverlayFrame>
      ) : null}

      {encounter?.id === "weapon_smith" && !resultText ? (
        weaponShopStock ? (
          <WeaponShopOverlay
            isDev={isDev}
            onBuy={buyWeaponShopListing}
            onLeave={() => choose("leave")}
            onRefresh={() => refreshWeaponShop()}
            onSell={sellWeaponShopOwned}
            run={run}
            stock={weaponShopStock}
          />
        ) : (
          <div className="overlay-scrim">
            <section className="overlay-panel overlay-panel-narrow">
              <p className="weapon-shop-empty">The shopkeep is still setting out the racks…</p>
            </section>
          </div>
        )
      ) : null}

      {encounter?.id === "island_harbor" && !resultText ? (
        <HarborOverlay
          onDepart={beginVoyage}
          onLeave={() => choose("leave")}
          onOpenCrew={() => openOverlay("crew")}
          onOpenInventory={() => {
            setInventoryFocusId(null);
            openOverlay("inventory");
          }}
          run={run}
        />
      ) : null}

      {encounter?.id === "island_task_board" && !resultText ? (
        <TaskBoardOverlay
          onAccept={acceptFactionMission}
          onLeave={() => choose("leave")}
          onPostWork={postFactionMissionWork}
          onResolve={resolveFactionMission}
          run={run}
        />
      ) : null}

      {encounter?.id === "island_black_market" && !resultText ? (
        blackMarketStock ? (
          <ItemMarketOverlay
            isDev={isDev}
            onBuy={(listingId) => buyItemMarketListing("BLACK_MARKET", listingId)}
            onLeave={() => choose("leave")}
            onRefresh={() => refreshItemMarket("BLACK_MARKET")}
            run={run}
            stock={blackMarketStock}
          />
        ) : (
          <div className="overlay-scrim">
            <section className="overlay-panel overlay-panel-narrow">
              <p className="weapon-shop-empty">Stalls are still being set…</p>
            </section>
          </div>
        )
      ) : null}

      {encounter?.id === "island_auction_house" && !resultText ? (
        auctionStock ? (
          <ItemMarketOverlay
            isDev={isDev}
            onBuy={(listingId) => buyItemMarketListing("AUCTION", listingId)}
            onLeave={() => choose("leave")}
            onRefresh={() => refreshItemMarket("AUCTION")}
            run={run}
            stock={auctionStock}
          />
        ) : (
          <div className="overlay-scrim">
            <section className="overlay-panel overlay-panel-narrow">
              <p className="weapon-shop-empty">Lots are still being unveiled…</p>
            </section>
          </div>
        )
      ) : null}

      {run.pendingBattleResult ? (
        <BattleResultFlow
          onComplete={dismissBattleResult}
          onConfirmLevelUp={confirmLevelUp}
          pendingLevelUp={pendingLevelUp}
          pendingLevelUpCount={pendingLevelUpCount}
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
              <button
                className="choice-btn"
                onClick={() => {
                  closeOverlay();
                  setCharacterSheetOpen(true);
                }}
                type="button"
              >
                Stats
              </button>
              <button
                className="choice-btn"
                onClick={() => {
                  setInventoryFocusId(null);
                  openOverlay("inventory");
                }}
                type="button"
              >
                Backpack
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
              <button className="choice-btn" onClick={() => openOverlay("settings")} type="button">
                Settings
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

      {overlay === "time" ? <TimeDetailOverlay onClose={closeOverlay} run={run} /> : null}

      {(run.pendingAssignmentResults?.length ?? 0) > 0 &&
      !run.combat &&
      !run.pendingBattleResult &&
      !pendingLevelUp ? (
        <AssignmentResultOverlay onDismiss={dismissAssignmentResults} run={run} />
      ) : null}

      {overlay === "inventory" ? (
        <InventoryOverlay
          inCombat={Boolean(run.combat && !run.combat.finished)}
          initialSelectedId={inventoryFocusId}
          key={inventoryFocusId ?? "backpack"}
          onClose={closeOverlay}
          onEquipWeapon={equipWeapon}
          onFruitAction={fruitInventoryAction}
          onGiveFruitToCrew={giveFruitToCrew}
          onUnequipWeapon={unequipWeapon}
          onSell={sellInventoryItem}
          onUse={(itemId, targetCharacterId) => {
            useInventoryItem(itemId, targetCharacterId);
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
            queueIndex={standaloneQueueTotal > 1 ? standaloneQueueIndex : undefined}
            queueTotal={standaloneQueueTotal > 1 ? standaloneQueueTotal : undefined}
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
          onSetIdentityRole={debugSetIdentityRole}
          onSetLegalStatus={debugSetLegalStatus}
          onNudgeTendency={debugNudgeTendency}
          onBecomeCelestial={debugBecomeCelestial}
          onLoseCelestialPrivilege={debugLoseCelestialPrivilege}
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
          onOpenWeaponShop={debugOpenWeaponShop}
          onRefreshWeaponShop={debugRefreshWeaponShop}
          onOpenClinic={debugOpenClinic}
          onGenerateSupplySearch={debugGenerateSupplySearch}
          onGenerateTraining={debugGenerateTraining}
          onStartCrewTraining={debugStartCrewTraining}
          onEndCrewTraining={debugEndCrewTraining}
          onAdvanceTimeSlot={debugAdvanceTimeSlot}
          onAdvanceDaySlot={debugAdvanceDay}
          onGenerateCrewRequirement={debugGenerateCrewRequirement}
          onGenerateCharacterChoice={debugGenerateCharacterChoice}
          onGenerateRuinedMechanism={debugGenerateRuinedMechanism}
          onGiveKnowledgeCollectable={debugGiveKnowledgeCollectable}
          onSetIntelligence={debugSetIntelligence}
          onClearRunKnowledge={debugClearRunKnowledge}
          onSetTimeSlots={debugSetTimeSlots}
          onSpawnEasyFight={debugSpawnEasyFight}
          onSpawnStandardFight={debugSpawnStandardFight}
          onSpawnDeadlyFight={debugSpawnDeadlyFight}
          onSpawnTwoEnemyFight={debugSpawnTwoEnemyFight}
          onSpawnFourEnemyFight={debugSpawnFourEnemyFight}
          onSpawnBossFight={debugSpawnBossFight}
          onSpawnBossAddsFight={debugSpawnBossAddsFight}
          onSpawnSeaKing={debugSpawnSeaKing}
          onSpawnDuel={debugSpawnDuel}
          onSpawnSkirmish={debugSpawnSkirmish}
          onSpawnFriendlySpar={debugSpawnFriendlySpar}
          onLegacyAdvanceYear={debugLegacyAdvanceYear}
          onLegacyAdvanceDecade={debugLegacyAdvanceDecade}
          onLegacyPromoteCrew={debugLegacyPromoteCrew}
          onLegacyGenerateChild={debugLegacyGenerateChild}
          onLegacyGenerateApprentice={debugLegacyGenerateApprentice}
          onLegacyInspect={debugLegacyInspect}
          onLegacyForceEncounter={debugLegacyForceEncounter}
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
