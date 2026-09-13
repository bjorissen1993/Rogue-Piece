import { useEffect, useState } from "react";
import { MusicService, type AudioSettings } from "../services/MusicService";
import { OverlayFrame } from "./OverlayFrame";

type SettingsOverlayProps = {
  onClose: () => void;
};

export function SettingsOverlay({ onClose }: SettingsOverlayProps) {
  const [settings, setSettings] = useState<AudioSettings>(() => MusicService.getSettings());

  useEffect(() => MusicService.subscribe(setSettings), []);

  useEffect(() => {
    MusicService.unlock();
  }, []);

  const volumePercent = Math.round(settings.volume * 100);

  return (
    <OverlayFrame eyebrow="OPTIONS" title="Settings" onClose={onClose}>
      <section className="settings-section">
        <h3 className="settings-heading font-display">Music</h3>
        <p className="settings-copy">
          Ambient seas for exploration, battle themes when combat starts.
        </p>

        <label className="settings-toggle">
          <input
            checked={!settings.muted}
            onChange={(event) => MusicService.setMuted(!event.target.checked)}
            type="checkbox"
          />
          <span>Music {settings.muted ? "Off" : "On"}</span>
        </label>

        <label className="settings-slider">
          <span className="settings-slider-label">
            Volume <strong>{volumePercent}%</strong>
          </span>
          <input
            aria-label="Music volume"
            disabled={settings.muted}
            max={100}
            min={0}
            onChange={(event) => MusicService.setVolume(Number(event.target.value) / 100)}
            type="range"
            value={volumePercent}
          />
        </label>
      </section>
    </OverlayFrame>
  );
}
