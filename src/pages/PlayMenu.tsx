import { ConfirmModal } from "../components/ConfirmModal";
import { useGameStore } from "../stores/GameStore";

export function PlayMenu() {
  const {
    profile,
    continueRun,
    requestNewRun,
    startNewRunFlow,
    confirmNewRun,
    cancelNewRunConfirm,
    returnToProfileMenu,
  } = useGameStore();

  if (!profile) {
    return null;
  }

  const active = profile.activeRun && !profile.activeRun.gameOver ? profile.activeRun : null;

  return (
    <div className="menu-screen">
      <div className="menu-screen-bg" aria-hidden="true" />
      <div className="menu-screen-content">
        <p className="hud-kicker">Play</p>
        <h1 className="font-display mt-4 text-6xl text-gold">The Sea</h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-parchment-dim">
          {active
            ? `${active.player.name} is still out there. Continue, or end that life for a new one.`
            : "No active run. Begin a new journey."}
        </p>
        <div className="menu-actions">
          {active ? (
            <button className="gold-btn menu-play" onClick={continueRun} type="button">
              Continue Run
            </button>
          ) : null}
          <button className={active ? "choice-btn" : "gold-btn menu-play"} onClick={requestNewRun} type="button">
            New Run
          </button>
          <button className="ghost-btn" onClick={returnToProfileMenu} type="button">
            Back
          </button>
        </div>
      </div>
      {confirmNewRun ? (
        <ConfirmModal
          title="Start a new run?"
          body="Starting a new run will end your current run."
          cancelLabel="Cancel"
          confirmLabel="Start New Run"
          onCancel={cancelNewRunConfirm}
          onConfirm={startNewRunFlow}
        />
      ) : null}
    </div>
  );
}
