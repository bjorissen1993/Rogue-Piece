import { useGameStore } from "../stores/GameStore";
import { formatBounty } from "../utils/text";

export function SaveSelect() {
  const { saves, devPreview, openProfile } = useGameStore();

  return (
    <div className="screen-shell screen-select">
      <p className="hud-kicker text-center">Save Files</p>
      <h1 className="font-display mt-2 text-center text-5xl text-gold">Rogue Piece</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-parchment-dim">
        A profile is permanent. A run is one life. Pick a file.
      </p>
      <div className="mx-auto mt-8 grid w-full max-w-4xl gap-4">
        {saves.map((save) => (
          <button className="panel select-card w-full p-5" key={save.slot} onClick={() => openProfile(save.slot)} type="button">
            <p className="text-sm text-gold">Save File {save.slot}</p>
            {save.empty ? (
              <p className="font-display text-2xl">Empty Profile</p>
            ) : (
              <>
                <p className="font-display text-2xl">
                  {save.hasActiveRun ? save.name : "No active run"}
                </p>
                <p className="text-sm text-parchment-dim">
                  {save.runsStarted ?? 0} runs
                  {save.hasActiveRun
                    ? ` · Day ${save.day} · ${formatBounty(save.bounty ?? 0)}`
                    : ""}
                </p>
              </>
            )}
          </button>
        ))}
        <button className="panel select-card w-full p-5" onClick={() => openProfile("dev")} type="button">
          <p className="text-sm text-gold">Sandbox</p>
          <p className="font-display text-2xl">Development Profile</p>
          <p className="text-sm text-parchment-dim">
            {devPreview.empty
              ? "Separate file. Never writes to normal saves."
              : `${devPreview.runsStarted ?? 0} runs · fully separate storage`}
          </p>
        </button>
      </div>
    </div>
  );
}
