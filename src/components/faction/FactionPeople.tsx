import type { KnowledgeLevel, WorldCharacter } from "../../models/types";
import { knowledgeLabel } from "../../services/FactionService";

export function KnowledgeBadge({ level }: { level: KnowledgeLevel }) {
  return <span className={`knowledge-badge knowledge-${level.toLowerCase()}`}>{knowledgeLabel(level)}</span>;
}

export function CharacterMiniCard({
  character,
  role,
  knowledgeLevel,
  onSelect,
}: {
  character?: WorldCharacter;
  role?: string;
  knowledgeLevel: KnowledgeLevel;
  onSelect?: (character: WorldCharacter) => void;
}) {
  const unknown = knowledgeLevel === "UNKNOWN" || !character;
  const title = unknown ? "???" : character.name;
  const subtitle = unknown
    ? role ?? "Unknown figure"
    : [character.rankTitle, character.epithet ? `"${character.epithet}"` : null].filter(Boolean).join(" · ") ||
      role ||
      "Figure";

  return (
    <button
      className={`character-mini-card ${unknown ? "is-unknown" : ""}`}
      disabled={unknown || !onSelect}
      onClick={() => character && onSelect?.(character)}
      type="button"
    >
      <div className="character-mini-top">
        <p className="character-mini-name font-display">{title}</p>
        <KnowledgeBadge level={knowledgeLevel} />
      </div>
      <p className="character-mini-sub">{subtitle}</p>
      {!unknown && character ? (
        <p className="character-mini-meta">
          Strength {character.strength}
          {character.bounty > 0 ? ` · Bounty ${character.bounty.toLocaleString()}` : ""}
          {!character.alive ? " · Deceased" : ""}
        </p>
      ) : (
        <p className="character-mini-meta">Identity not confirmed</p>
      )}
    </button>
  );
}
