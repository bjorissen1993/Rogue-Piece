import { useEffect } from "react";
import { ConfirmModal } from "../components/ConfirmModal";
import { AccountPanel } from "../components/account/AccountPanel";
import { useAuthUser } from "../hooks/useAuthUser";
import { canAccessDevelopmentProfile } from "../services/DevAccess";
import { useGameStore } from "../stores/GameStore";

export function ProfileMenu() {
  const {
    profile,
    selectedSlot,
    openPlay,
    openOverlay,
    goProfileSelect,
    requestResetDev,
    confirmResetDev,
    cancelResetDev,
    resetDevProfile,
  } = useGameStore();
  const user = useAuthUser();

  useEffect(() => {
    if (profile?.profileType === "DEVELOPMENT" && !canAccessDevelopmentProfile(user)) {
      goProfileSelect();
    }
  }, [profile, user, goProfileSelect]);

  if (!profile) {
    return null;
  }

  if (profile.profileType === "DEVELOPMENT" && !canAccessDevelopmentProfile(user)) {
    return null;
  }

  const isDev = profile.profileType === "DEVELOPMENT";
  const run = profile.activeRun && !profile.activeRun.gameOver ? profile.activeRun : null;

  return (
    <div className="menu-screen">
      <div className="menu-screen-bg" aria-hidden="true" />
      <AccountPanel selectedSlot={selectedSlot} />
      <div className="menu-screen-content">
        <p className="hud-kicker">
          {isDev ? "Development Profile" : `Save File ${selectedSlot}`}
        </p>
        <h1 className="font-display menu-title text-gold">Rogue Piece</h1>
        <p className="menu-subtitle text-parchment-dim">
          {run
            ? `${run.player.name} still sails. Day ${run.day}.`
            : "No active run. Progression stays with this profile."}
        </p>
        <div className="menu-actions">
          <button className="gold-btn menu-play" onClick={openPlay} type="button">
            Play
          </button>
          <div className="menu-gap" />
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
              <div className="menu-gap" />
              <button className="choice-btn" onClick={() => openOverlay("debug")} type="button">
                Debug
              </button>
              <button className="ghost-btn" onClick={requestResetDev} type="button">
                Reset Development Profile
              </button>
            </>
          ) : null}
          <button className="ghost-btn" onClick={goProfileSelect} type="button">
            Back to Saves
          </button>
        </div>
      </div>
      {confirmResetDev ? (
        <ConfirmModal
          title="Reset Development Profile?"
          body="This only clears the development profile. Normal save files are not touched."
          confirmLabel="Reset"
          onCancel={cancelResetDev}
          onConfirm={resetDevProfile}
        />
      ) : null}
    </div>
  );
}
