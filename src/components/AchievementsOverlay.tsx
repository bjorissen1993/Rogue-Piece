import { useState } from "react";
import { ACHIEVEMENTS } from "../data/achievements";
import type { ProfileSave } from "../models/types";
import { OverlayFrame } from "./OverlayFrame";

type AchievementsOverlayProps = {
  profile: ProfileSave;
  onClose: () => void;
};

function isHidden(achievement: (typeof ACHIEVEMENTS)[number]): boolean {
  return Boolean(achievement.hiddenUntilUnlocked || achievement.hidden);
}

export function AchievementsOverlay({ profile, onClose }: AchievementsOverlayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(ACHIEVEMENTS[0]?.id ?? null);
  const selected = ACHIEVEMENTS.find((item) => item.id === selectedId);
  const selectedRow = selected ? profile.achievements.find((item) => item.id === selected.id) : undefined;
  const selectedUnlocked = Boolean(selectedRow?.unlocked);
  const selectedHidden = selected ? isHidden(selected) && !selectedUnlocked : false;

  return (
    <OverlayFrame eyebrow="LEDGER" title="Achievements" onClose={onClose}>
      <div className="split-overlay">
        <div className="split-pane">
          <ul className="split-grid ledger-grid">
          {ACHIEVEMENTS.map((achievement) => {
            const row = profile.achievements.find((item) => item.id === achievement.id);
            const unlocked = Boolean(row?.unlocked);
            const hidden = isHidden(achievement) && !unlocked;
            return (
              <li key={achievement.id}>
                <button
                  className={`select-card collection-card w-full ${selectedId === achievement.id ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}`}
                  onClick={(event) => {
                    setSelectedId(achievement.id);
                    event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                  }}
                  type="button"
                >
                  <p className="collection-card-title font-display text-xl">{hidden ? "???" : achievement.name}</p>
                  <p className="collection-card-subtitle text-xs text-gold">
                    {unlocked ? "Unlocked" : hidden ? "Hidden Achievement" : "Locked"}
                  </p>
                </button>
              </li>
            );
          })}
          </ul>
        </div>
        <aside className="detail-panel panel">
          {!selected ? (
            <p className="text-parchment-dim">Select an achievement.</p>
          ) : selectedHidden ? (
            <>
              <h3 className="font-display text-3xl">Hidden Achievement</h3>
              <p className="mt-3 text-parchment-dim">Requirement unknown.</p>
            </>
          ) : selectedUnlocked ? (
            <>
              <p className="hud-kicker">Unlocked</p>
              <h3 className="font-display mt-2 text-3xl">{selected.name}</h3>
              <p className="mt-3 text-parchment-dim">{selected.description}</p>
              {selectedRow?.unlockedAt ? (
                <p className="mt-4 text-sm text-gold">
                  Unlocked {new Date(selectedRow.unlockedAt).toLocaleDateString()}
                </p>
              ) : null}
              {selected.rewards?.length ? (
                <p className="mt-3 text-sm text-gold">
                  Reward: {selected.rewards.map((reward) => reward.type.replaceAll("_", " ").toLowerCase()).join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="hud-kicker">Locked</p>
              <h3 className="font-display mt-2 text-3xl">{selected.name}</h3>
              <p className="mt-3 text-parchment-dim">Requirement unknown.</p>
            </>
          )}
        </aside>
      </div>
    </OverlayFrame>
  );
}
