import { createPortal } from "react-dom";
import type { CrewStatus, PlayerStats, RunState } from "../../models/types";
import { CharacterScheduleService } from "../../services/CharacterScheduleService";
import { ProgressionService } from "../../services/ProgressionService";

export type CrewPresenceBadgeProps = {
  run: RunState;
  characterId: string;
  selected?: boolean;
  disabled?: boolean;
  disableReason?: string;
  compact?: boolean;
  showDetailOnClick?: boolean;
  onSelect?: (characterId: string) => void;
  onOpenDetail?: (characterId: string) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function statusLabel(status: CrewStatus): string {
  switch (status) {
    case "Training":
      return "Training";
    case "OnMission":
      return "On mission";
    case "PersonalActivity":
      return "Busy";
    case "Injured":
      return "Recovering";
    case "Hospitalized":
      return "Hospitalized";
    case "Resting":
      return "Resting";
    case "Captured":
      return "Captured";
    case "Missing":
      return "Missing";
    case "Unavailable":
      return "Unavailable";
    default:
      return "Available";
  }
}

export function CrewPresenceBadge({
  run,
  characterId,
  selected = false,
  disabled = false,
  disableReason,
  compact = false,
  showDetailOnClick = false,
  onSelect,
  onOpenDetail,
}: CrewPresenceBadgeProps) {
  const id = characterId === run.player.id ? "player" : characterId;
  const name = ProgressionService.getDisplayName(run, id);
  const available = CharacterScheduleService.isAvailable(run, id);
  const status = CharacterScheduleService.derivedStatus(run, id);
  const assignment = CharacterScheduleService.getAssignment(run, id);
  const blocked = disabled || !available;
  const title = [
    name,
    statusLabel(status),
    assignment ? assignment.label : null,
    disableReason,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      aria-pressed={selected}
      className={[
        "crew-presence-badge",
        compact ? "is-compact" : "",
        selected ? "is-selected" : "",
        blocked ? "is-disabled" : "",
        available ? "is-available" : "is-unavailable",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={blocked && !showDetailOnClick}
      onClick={() => {
        if (showDetailOnClick && onOpenDetail) {
          onOpenDetail(id);
          return;
        }
        if (blocked) {
          return;
        }
        onSelect?.(id);
      }}
      title={title}
      type="button"
    >
      <span className="crew-presence-badge-mark" aria-hidden="true">
        {initials(name)}
      </span>
      <span className="crew-presence-badge-meta">
        <span className="crew-presence-badge-name">{name}</span>
        {!compact ? (
          <span className="crew-presence-badge-status">
            {available
              ? "Available"
              : assignment
                ? `${statusLabel(status)} · returns later`
                : statusLabel(status)}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function CrewBadgeDetailPanel({
  run,
  characterId,
  onClose,
}: {
  run: RunState;
  characterId: string;
  onClose: () => void;
}) {
  const id = characterId === run.player.id ? "player" : characterId;
  const name = ProgressionService.getDisplayName(run, id);
  const stats: PlayerStats = ProgressionService.getStats(run, id);
  const status = CharacterScheduleService.derivedStatus(run, id);
  const assignment = CharacterScheduleService.getAssignment(run, id);
  const progression = ProgressionService.getProgression(run, id);
  const level = progression?.level ?? 1;

  return createPortal(
    <div className="overlay-scrim crew-badge-detail-scrim" onClick={onClose} role="presentation">
      <section
        className="overlay-panel overlay-panel-narrow crew-badge-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="overlay-head">
          <div>
            <p className="overlay-eyebrow">Crew</p>
            <h2 className="font-display text-3xl text-gold">{name}</h2>
          </div>
          <button className="ghost-btn py-2" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="overlay-body crew-badge-detail-body">
          <p>Level {level}</p>
          <ul className="crew-badge-stat-list">
            <li>Strength {stats.strength}</li>
            <li>Defense {stats.defense}</li>
            <li>Speed {stats.speed}</li>
            <li>Willpower {stats.willpower}</li>
            <li>Charisma {stats.charisma}</li>
            <li>Intelligence {stats.intelligence}</li>
          </ul>
          <p>
            Status: {statusLabel(status)}
            {assignment ? ` — ${assignment.label}` : ""}
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
