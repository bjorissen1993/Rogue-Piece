import { useEffect, useState, type CSSProperties } from "react";
import { getDevilFruit } from "../data/devilFruits";
import { getLocation, getRegionName } from "../data/locations";
import { ORIGIN_LABELS } from "../data/origins";
import { getRace } from "../data/races";
import type { RunState, StatName } from "../models/types";
import { primaryMasteryDisplay, weaponDisplayName, WeaponService } from "../services/WeaponService";
import { MpService } from "../services/MpService";
import { ProgressionService } from "../services/ProgressionService";
import { AffiliationService } from "../services/AffiliationService";
import { statHint } from "../utils/presentation";
import { formatHudAmount, STAT_LABELS } from "../utils/text";
import { HudIcon } from "./HudIcons";
import { HpBar } from "./HpBar";
import { ResourceBar } from "./ResourceBar";
import { StatIcon } from "./StatIcon";

type PlayerHudProps = {
  run: RunState;
  onInventory: (itemId?: string) => void;
  onCrew: () => void;
};

const STATS: StatName[] = ["strength", "defense", "speed", "willpower", "charisma", "intelligence"];

export function PlayerHud({ run, onInventory, onCrew }: PlayerHudProps) {
  const { player } = run;
  const fruit = player.devilFruitId ? getDevilFruit(player.devilFruitId) : undefined;
  const packedFruit = player.inventory.find((item) => item.type === "DEVIL_FRUIT");
  const race = getRace(player.raceId);
  const location = getLocation(run.currentLocationId);
  const packed = player.inventory.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const mastery = primaryMasteryDisplay(player);
  const progression = ProgressionService.getProgression(run, "player");
  const xp = ProgressionService.xpProgress(progression);
  const crewLabel = AffiliationService.getCrewLabel(run);
  const leaderLabel = AffiliationService.getLeaderLabel(run);
  const [hit, setHit] = useState(false);

  useEffect(() => {
    if (!run.lastHpChange) {
      return;
    }
    setHit(true);
    const timer = window.setTimeout(() => setHit(false), 520);
    return () => window.clearTimeout(timer);
  }, [run.lastHpChange, player.hp]);

  return (
    <aside className={`player-hud ${hit ? "is-hit" : ""}`}>
      <p className="hud-kicker">{leaderLabel}</p>
      <h2 className="player-name font-display">{player.name}</h2>
      <p className="player-line">
        {race?.name ?? "Human"} – {ORIGIN_LABELS[player.origin] ?? player.origin}
      </p>
      <p className="player-origin">{location ? getRegionName(location.regionId) : "Unknown seas"}</p>

      <div className="player-vitals">
        <HpBar flash={hit && (run.lastHpChange ?? 0) < 0} heal={hit && (run.lastHpChange ?? 0) > 0} hp={player.hp} maxHp={player.maxHp} />
        <ResourceBar
          current={player.mp ?? MpService.maxMpFor(player)}
          kind="mp"
          max={player.maxMp ?? MpService.maxMpFor(player)}
        />
        <ResourceBar
          current={xp.current}
          kind="xp"
          label={`LV ${progression.level}`}
          max={xp.needed}
        />
      </div>

      <p className="player-meta">
        Devil Fruit: <span>{fruit?.name ?? packedFruit?.name ?? "None"}</span>
      </p>
      <p className="player-meta">
        Weapon: <span>{weaponDisplayName(player)}</span>
        {mastery ? (
          <span>
            {" "}
            · {WeaponService.rankLabel(mastery.rank)} {mastery.type.toLowerCase()}
          </span>
        ) : null}
      </p>
      <p className="player-meta">
        <HudIcon className="run-glyph-coin" name="coin" size={14} />
        Berries: <span>{formatHudAmount(player.berries)}</span>
      </p>

      <ul className="stat-list">
        {STATS.map((stat) => {
          const tip = `${STAT_LABELS[stat]} — ${statHint(stat)}`;
          return (
            <li
              className="stat-row icon-tip"
              key={stat}
              style={{ "--tip": `"${tip}"` } as CSSProperties}
              title={tip}
            >
              <StatIcon showTooltip={false} size={36} stat={stat} />
              <span className="stat-label">{STAT_LABELS[stat]}</span>
              <span className="stat-orb">{player.stats[stat]}</span>
            </li>
          );
        })}
      </ul>

      <div className="backpack-preview hud-pack-row">
        <button className="backpack-btn" onClick={() => onInventory()} type="button">
          <HudIcon name="pouch" size={28} />
          Backpack
          <span className="backpack-count">{packed}</span>
        </button>
        <button className="backpack-btn crew-btn" onClick={onCrew} type="button">
          <HudIcon name="anchor" size={28} />
          {crewLabel}
          <span className="backpack-count">{run.crew.length}</span>
        </button>
      </div>
    </aside>
  );
}
