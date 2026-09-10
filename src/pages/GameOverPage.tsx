import { getDevilFruit } from "../data/devilFruits";
import { getRace } from "../data/races";
import { ORIGIN_LABELS } from "../data/origins";
import { formatBerries, formatBounty } from "../utils/text";
import { useGameStore } from "../stores/GameStore";

export function GameOverPage() {
  const { profile, acknowledgeGameOver } = useGameStore();
  const run = profile?.activeRun;
  if (!profile || !run) {
    return null;
  }

  const fruit = run.player.devilFruitId
    ? getDevilFruit(run.player.devilFruitId)
    : run.player.inventory.find((item) => item.type === "DEVIL_FRUIT");
  const race = getRace(run.player.raceId);

  return (
    <div className="menu-screen game-over-screen">
      <div className="menu-screen-bg" aria-hidden="true" />
      <article className="game-over-panel panel relative z-1">
        <p className="hud-kicker">The sea takes its cut</p>
        <h1 className="font-display mt-3 text-6xl text-hp">Game Over</h1>
        <p className="mt-4 text-xl text-parchment">
          {run.deathCause ?? "Lost at sea"}
        </p>
        <p className="mt-2 text-parchment-dim">
          {run.player.name}, {race?.name ?? "Human"}
        </p>
        <div className="game-over-grid">
          <p>
            <span className="text-gold">Origin</span>
            <br />
            {ORIGIN_LABELS[run.player.origin] ?? run.player.origin}
          </p>
          <p>
            <span className="text-gold">Days</span>
            <br />
            {run.day}
          </p>
          <p>
            <span className="text-gold">Highest bounty</span>
            <br />
            {formatBounty(run.player.bounty)}
          </p>
          <p>
            <span className="text-gold">Encounters</span>
            <br />
            {run.encounterCount}
          </p>
          <p>
            <span className="text-gold">Final berries</span>
            <br />
            {formatBerries(run.player.berries)}
          </p>
          <p>
            <span className="text-gold">Devil Fruit</span>
            <br />
            {fruit?.name ?? "None"}
          </p>
        </div>
        <p className="mt-6 text-sm text-parchment-dim">
          The run ends. Collection, races, and achievements stay with this profile.
        </p>
        <button className="gold-btn mt-8 min-w-56" onClick={acknowledgeGameOver} type="button">
          Return to Profile
        </button>
      </article>
    </div>
  );
}
