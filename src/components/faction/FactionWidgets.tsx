import type { KnowledgeLevel, RelationFactionId, RunState, WorldCharacter, RegionalInfluence } from "../../models/types";
import {
  FactionService,
  relationshipStatus,
  influenceStatus,
  influenceTrend,
} from "../../services/FactionService";
import { getFaction } from "../../data/factions";
import { FACTION_ART, HudArt } from "../HudIcons";
import { CharacterMiniCard, KnowledgeBadge } from "./FactionPeople";

type FactionHeaderProps = {
  factionId: RelationFactionId;
  run: RunState;
};

export function FactionHeader({ factionId, run }: FactionHeaderProps) {
  const def = getFaction(factionId);
  const world = FactionService.getWorldState(run, factionId);
  const status = influenceStatus(world.influence);
  const trend = influenceTrend(world.powerHistory);

  return (
    <header className="faction-dossier-header">
      <div className="faction-dossier-logo-wrap" aria-hidden>
        <HudArt className="faction-dossier-logo" size={148} src={FACTION_ART[factionId]} />
      </div>
      <div className="faction-dossier-titleblock">
        <p className="overlay-eyebrow">World Intelligence</p>
        <h2 className="faction-dossier-name font-display text-gold">{def.name}</h2>
        <p className="faction-dossier-kind">{def.kind.replaceAll("_", " ")}</p>
        <div className="faction-dossier-pills">
          <span className="faction-pill">{status}</span>
          <span className="faction-pill">{trend}</span>
          <span className="faction-pill">Influence {world.influence}</span>
        </div>
      </div>
    </header>
  );
}

export function InfluenceBar({ value, label = "Influence" }: { value: number; label?: string }) {
  return (
    <div className="influence-bar-block">
      <div className="influence-bar-labels">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="influence-bar-track">
        <div className="influence-bar-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function TrendChart({
  points,
}: {
  points: Array<{ day: number; influence: number }>;
}) {
  if (points.length === 0) {
    return <p className="text-parchment-dim">No power history yet.</p>;
  }
  const max = Math.max(...points.map((point) => point.influence), 1);
  return (
    <div className="trend-chart" role="img" aria-label="Influence over recent days">
      {points.map((point) => (
        <div className="trend-col" key={`${point.day}-${point.influence}`}>
          <div className="trend-bar-wrap">
            <div className="trend-bar" style={{ height: `${(point.influence / max) * 100}%` }} />
          </div>
          <span className="trend-day">D{point.day}</span>
        </div>
      ))}
    </div>
  );
}

export function PlayerRelationshipPanel({
  run,
  factionId,
}: {
  run: RunState;
  factionId: RelationFactionId;
}) {
  const rel = FactionService.getRelationship(run, factionId);
  const changes = FactionService.getRecentChanges(run, factionId);
  return (
    <section className="faction-panel">
      <h3 className="collection-heading">Your Standing</h3>
      <p className="faction-history-score text-gold">
        {rel.value > 0 ? "+" : ""}
        {rel.value} — {relationshipStatus(rel.value)}
      </p>
      <h4 className="faction-subhead">Your History</h4>
      {changes.length === 0 ? (
        <p className="text-parchment-dim">No recent interactions recorded.</p>
      ) : (
        <ul className="faction-history-list">
          {changes.map((change, index) => (
            <li key={`${change.at}-${index}`}>
              <span className={change.amount >= 0 ? "text-good" : "text-bad"}>
                {change.amount >= 0 ? "+" : ""}
                {change.amount}
              </span>{" "}
              — {change.reason}
              <span className="faction-history-day">Day {change.day}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PresenceBars({ presence }: { presence: RegionalInfluence }) {
  const labels: Record<keyof RegionalInfluence, string> = {
    eastBlue: "East Blue",
    northBlue: "North Blue",
    westBlue: "West Blue",
    southBlue: "South Blue",
    grandLine: "Grand Line",
    newWorld: "New World",
  };
  return (
    <div className="presence-bars">
      {(Object.keys(labels) as Array<keyof RegionalInfluence>).map((key) => (
        <div className="presence-row" key={key}>
          <span>{labels[key]}</span>
          <div className="influence-bar-track">
            <div className="influence-bar-fill is-region" style={{ width: `${presence[key]}%` }} />
          </div>
          <span className="presence-val">{presence[key]}</span>
        </div>
      ))}
    </div>
  );
}

export function RelationsList({
  run,
  factionId,
}: {
  run: RunState;
  factionId: RelationFactionId;
}) {
  const world = FactionService.getWorldState(run, factionId);
  return (
    <ul className="relations-list">
      {world.relationships.map((relation) => {
        const other = getFaction(relation.otherFactionId);
        const known =
          relation.otherFactionId !== "REVOLUTIONARY_ARMY" ||
          FactionService.isFactionDiscovered(run, "REVOLUTIONARY_ARMY");
        return (
          <li key={relation.otherFactionId}>
            <span>{known ? other.name : "Unknown Organization"}</span>
            <span className={relation.score >= 0 ? "text-good" : "text-bad"}>
              {relation.score > 0 ? "+" : ""}
              {relation.score}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function EventFeed({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; day: number; text: string; badge?: KnowledgeLevel }>;
}) {
  return (
    <section className="faction-panel">
      <h3 className="collection-heading">{title}</h3>
      {items.length === 0 ? (
        <p className="text-parchment-dim">Nothing recorded.</p>
      ) : (
        <ul className="faction-history-list">
          {items.map((item) => (
            <li key={item.id}>
              {item.badge ? <KnowledgeBadge level={item.badge} /> : null} {item.text}
              <span className="faction-history-day">Day {item.day}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LeadershipPreview({
  run,
  factionId,
  onSelect,
}: {
  run: RunState;
  factionId: RelationFactionId;
  onSelect?: (character: WorldCharacter) => void;
}) {
  const world = FactionService.getWorldState(run, factionId);
  return (
    <div className="leadership-grid">
      {world.leadership.map((seat) => (
        <CharacterMiniCard
          character={FactionService.getCharacter(run, seat.characterId)}
          key={`${seat.role}-${seat.characterId ?? "none"}`}
          knowledgeLevel={seat.knowledgeLevel}
          onSelect={onSelect}
          role={seat.role}
        />
      ))}
    </div>
  );
}
