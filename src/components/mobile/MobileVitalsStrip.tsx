import type { RunState } from "../../models/types";
import { MpService } from "../../services/MpService";
import { ProgressionService } from "../../services/ProgressionService";
import { HpBar } from "../HpBar";
import { ResourceBar } from "../ResourceBar";

type MobileVitalsStripProps = {
  run: RunState;
  onOpenCharacter: () => void;
};

/** Compact always-visible character summary for the mobile shell. */
export function MobileVitalsStrip({ run, onOpenCharacter }: MobileVitalsStripProps) {
  const { player } = run;
  const progression = ProgressionService.getProgression(run, "player");
  const xp = ProgressionService.xpProgress(progression);

  return (
    <button className="mobile-vitals-strip" onClick={onOpenCharacter} type="button">
      <div className="mobile-vitals-identity">
        <strong className="font-display">{player.name}</strong>
        <span>LV {progression.level}</span>
      </div>
      <div className="mobile-vitals-bars">
        <HpBar hp={player.hp} maxHp={player.maxHp} />
        <ResourceBar
          current={player.mp ?? MpService.maxMpFor(player)}
          kind="mp"
          max={player.maxMp ?? MpService.maxMpFor(player)}
        />
        <ResourceBar current={xp.current} kind="xp" label="XP" max={xp.needed} />
      </div>
    </button>
  );
}
