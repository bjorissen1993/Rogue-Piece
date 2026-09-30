import type { ProfileSave } from "../models/types";
import { MuseumService } from "../services/MuseumService";
import { OverlayFrame } from "./OverlayFrame";

type MuseumOverlayProps = {
  profile: ProfileSave;
  onClose: () => void;
};

export function MuseumOverlay({ profile, onClose }: MuseumOverlayProps) {
  const exhibits = MuseumService.exhibits(profile);
  return (
    <OverlayFrame elevate eyebrow="History" onClose={onClose} title="Museum">
      {exhibits.length === 0 ? (
        <p className="facility-detail-copy">
          No confirmed historical records yet. The living are not exhibits.
        </p>
      ) : (
        <ul className="museum-grid">
          {exhibits.map((row) => (
            <li className="museum-card" key={row.characterId}>
              <span className="museum-card-kicker">
                {row.status}
                {row.deathYear ? ` · ${row.deathYear}` : ""}
              </span>
              <strong>{row.character.name}</strong>
              {row.postRunFate ? <span>{row.postRunFate}</span> : null}
              {row.careerNotes?.[0] ? <p>{row.careerNotes[0]}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </OverlayFrame>
  );
}
