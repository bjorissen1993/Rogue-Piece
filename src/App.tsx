import { GameStoreProvider, useGameStore } from "./stores/GameStore";
import { SaveSelect } from "./pages/SaveSelect";
import { ProfileMenu } from "./pages/ProfileMenu";
import { PlayMenu } from "./pages/PlayMenu";
import { NewRunFlow } from "./pages/NewRunFlow";
import { GamePage } from "./pages/GamePage";
import { GameOverPage } from "./pages/GameOverPage";
import { CollectionOverlay } from "./components/CollectionOverlay";
import { AchievementsOverlay } from "./components/AchievementsOverlay";
import { StatisticsOverlay } from "./components/StatisticsOverlay";
import { DebugOverlay } from "./components/DebugOverlay";
import { ConfirmModal } from "./components/ConfirmModal";

function ScreenRouter() {
  const {
    screen,
    overlay,
    profile,
    closeOverlay,
    confirmResetDev,
    cancelResetDev,
    resetDevProfile,
    debugGenerateRaceOffer,
    debugIncreasePity,
    debugForceCombat,
    debugGiveTestItem,
    debugHealPlayer,
    debugFactionInfluence,
    debugFactionEvent,
    debugDiscoverRevolutionary,
    debugFactionRumor,
  } = useGameStore();

  let page = <SaveSelect />;
  if (screen === "profileMenu") page = <ProfileMenu />;
  else if (screen === "playMenu") page = <PlayMenu />;
  else if (screen === "newRun") page = <NewRunFlow />;
  else if (screen === "game") page = <GamePage />;
  else if (screen === "gameOver") page = <GameOverPage />;

  const showProfileOverlays = profile && overlay && overlay !== "gameMenu" && overlay !== "inventory";

  return (
    <>
      {page}
      {showProfileOverlays && overlay === "collection" ? (
        <CollectionOverlay onClose={closeOverlay} profile={profile} />
      ) : null}
      {showProfileOverlays && overlay === "achievements" ? (
        <AchievementsOverlay onClose={closeOverlay} profile={profile} />
      ) : null}
      {showProfileOverlays && overlay === "statistics" ? (
        <StatisticsOverlay onClose={closeOverlay} profile={profile} />
      ) : null}
      {showProfileOverlays && overlay === "debug" && screen !== "game" ? (
        <DebugOverlay
          onClose={closeOverlay}
          onDiscoverRevolutionary={debugDiscoverRevolutionary}
          onFactionEvent={debugFactionEvent}
          onFactionInfluence={debugFactionInfluence}
          onFactionRumor={debugFactionRumor}
          onForceCombat={debugForceCombat}
          onGenerateOffer={debugGenerateRaceOffer}
          onGiveItem={debugGiveTestItem}
          onHeal={debugHealPlayer}
          onIncreasePity={debugIncreasePity}
          profile={profile}
        />
      ) : null}
      {confirmResetDev && screen !== "profileMenu" ? (
        <ConfirmModal
          title="Reset Development Profile?"
          body="This only clears the development profile. Normal save files are not touched."
          confirmLabel="Reset"
          onCancel={cancelResetDev}
          onConfirm={resetDevProfile}
        />
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <GameStoreProvider>
      <ScreenRouter />
    </GameStoreProvider>
  );
}
