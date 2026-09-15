import { useMemo, useState } from "react";
import type { RelationFactionId, RunState, WorldCharacter } from "../../models/types";
import {
  FactionService,
  influenceStatus,
  influenceTrend,
} from "../../services/FactionService";
import { OverlayFrame } from "../OverlayFrame";
import { CharacterMiniCard } from "./FactionPeople";
import {
  EventFeed,
  FactionHeader,
  InfluenceBar,
  LeadershipPreview,
  PlayerRelationshipPanel,
  PresenceBars,
  RelationsList,
  TrendChart,
} from "./FactionWidgets";

type FactionOverviewProps = {
  run: RunState;
  factionId: RelationFactionId;
  onClose: () => void;
};

type TabId = "overview" | "people" | "activity" | "world" | "history";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
  { id: "world", label: "World" },
  { id: "history", label: "History" },
];

export function FactionOverview({ run, factionId, onClose }: FactionOverviewProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [selected, setSelected] = useState<WorldCharacter | null>(null);

  const world = FactionService.getWorldState(run, factionId);
  const isCivilian = world.type === "CIVILIAN";
  const status = influenceStatus(world.influence);
  const trend = influenceTrend(world.powerHistory);
  const events = useMemo(() => FactionService.getFactionEvents(run, factionId), [run, factionId]);
  const majorFigures = FactionService.getMajorFigures(run, factionId);

  const onSelectCharacter = (character: WorldCharacter) => {
    setSelected(character);
  };

  return (
    <OverlayFrame elevate eyebrow="Faction Dossier" onClose={onClose}>
      <div className="faction-overview">
        <FactionHeader factionId={factionId} run={run} />

        <div className="faction-overview-tabs mb-3 flex shrink-0 flex-wrap gap-2">
          {TABS.map((entry) => (
            <button
              className={`tab-btn ${tab === entry.id ? "is-selected" : ""}`}
              key={entry.id}
              onClick={() => setTab(entry.id)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="faction-overview-body overlay-scroll">
          {tab === "overview" ? (
            <div className="faction-overview-grid">
              <section className="faction-panel">
                <h3 className="collection-heading">Status</h3>
                <InfluenceBar value={world.influence} />
                {isCivilian ? (
                  <>
                    <InfluenceBar label="Stability" value={world.stability ?? 50} />
                    <InfluenceBar label="Morale" value={world.morale ?? 50} />
                  </>
                ) : null}
                <p className="faction-status-line">
                  <strong>{status}</strong> · {trend}
                </p>
                <p className="text-parchment-dim">
                  {isCivilian
                    ? "Civilian networks measure stability and morale more than military hierarchy."
                    : "Influence reflects this run's current power projection across the seas."}
                </p>
              </section>

              <section className="faction-panel">
                <h3 className="collection-heading">
                  {isCivilian ? "Community Voices" : "Leadership"}
                </h3>
                <LeadershipPreview factionId={factionId} onSelect={onSelectCharacter} run={run} />
              </section>

              <EventFeed
                items={events.slice(0, 5).map((event) => ({
                  id: event.id,
                  day: event.day,
                  text: event.text,
                  badge: event.knowledgeLevel,
                }))}
                title="Major Events"
              />

              <PlayerRelationshipPanel factionId={factionId} run={run} />
            </div>
          ) : null}

          {tab === "people" ? (
            <div className="faction-overview-grid">
              <section className="faction-panel">
                <h3 className="collection-heading">
                  {isCivilian ? "Notable Civilians" : "Leadership"}
                </h3>
                <LeadershipPreview factionId={factionId} onSelect={onSelectCharacter} run={run} />
                {!isCivilian && world.hierarchyCounts?.length ? (
                  <div className="hierarchy-counts">
                    {world.hierarchyCounts.map((row) => (
                      <div key={row.role}>
                        <span>{row.role}</span>
                        <span>
                          {row.filled}/{row.capacity}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="faction-panel">
                <h3 className="collection-heading">Major Figures</h3>
                <div className="leadership-grid">
                  {majorFigures.map((character) => (
                    <CharacterMiniCard
                      character={character}
                      key={character.id}
                      knowledgeLevel={character.knowledgeLevel ?? "KNOWN"}
                      onSelect={onSelectCharacter}
                      role={character.rankTitle}
                    />
                  ))}
                </div>
              </section>

              <section className="faction-panel">
                <h3 className="collection-heading">Notable Losses</h3>
                {world.notableLosses.length === 0 ? (
                  <p className="text-parchment-dim">No confirmed losses on file.</p>
                ) : (
                  <ul className="faction-history-list">
                    {world.notableLosses.map((loss) => (
                      <li key={loss.id}>
                        {loss.knowledgeLevel === "UNKNOWN" ? "???" : loss.nameHint}
                        {loss.role ? ` · ${loss.role}` : ""}
                        <span className="faction-history-day">Day {loss.day}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}

          {tab === "activity" ? (
            <div className="faction-overview-grid">
              <EventFeed
                items={events.map((event) => ({
                  id: event.id,
                  day: event.day,
                  text: event.text,
                  badge: event.knowledgeLevel,
                }))}
                title="Events"
              />
              <EventFeed
                items={world.shifts.map((shift) => ({
                  id: shift.id,
                  day: shift.day,
                  text: `${shift.type.replaceAll("_", " ")} — ${shift.text}`,
                  badge: shift.knowledgeLevel,
                }))}
                title="Shifts"
              />
              <EventFeed
                items={world.conflicts.map((conflict) => ({
                  id: conflict.id,
                  day: conflict.day,
                  text: `${conflict.title}${conflict.region ? ` (${conflict.region})` : ""} · intensity ${conflict.intensity}`,
                  badge: conflict.knowledgeLevel,
                }))}
                title="Conflicts"
              />
              <EventFeed
                items={world.rumors.map((rumor) => ({
                  id: rumor.id,
                  day: rumor.day,
                  text: rumor.text,
                  badge: rumor.reliability,
                }))}
                title="Rumors"
              />
            </div>
          ) : null}

          {tab === "world" ? (
            <div className="faction-overview-grid">
              <section className="faction-panel">
                <h3 className="collection-heading">
                  {isCivilian ? "Regional Stability" : "Regional Presence"}
                </h3>
                <PresenceBars presence={world.regionalInfluence} />
              </section>
              <section className="faction-panel">
                <h3 className="collection-heading">Faction Relations</h3>
                <RelationsList factionId={factionId} run={run} />
              </section>
              <section className="faction-panel">
                <h3 className="collection-heading">Influence</h3>
                <InfluenceBar value={world.influence} />
                {isCivilian ? (
                  <>
                    <InfluenceBar label="Stability" value={world.stability ?? 50} />
                    <InfluenceBar label="Morale" value={world.morale ?? 50} />
                  </>
                ) : null}
              </section>
            </div>
          ) : null}

          {tab === "history" ? (
            <div className="faction-overview-grid">
              <section className="faction-panel">
                <h3 className="collection-heading">Power History</h3>
                <TrendChart points={world.powerHistory} />
              </section>
              <EventFeed
                items={world.shifts.map((shift) => ({
                  id: shift.id,
                  day: shift.day,
                  text: shift.text,
                  badge: shift.knowledgeLevel,
                }))}
                title="Leadership & Power Shifts"
              />
              <PlayerRelationshipPanel factionId={factionId} run={run} />
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className="faction-char-toast">
            <p className="font-display text-gold">{selected.name}</p>
            <p className="text-parchment-dim">
              {selected.rankTitle ?? "Figure"}
              {selected.epithet ? ` · "${selected.epithet}"` : ""}
            </p>
            <p className="text-sm text-parchment-dim">Character Dossier coming later.</p>
            <button className="ghost-btn py-2" onClick={() => setSelected(null)} type="button">
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </OverlayFrame>
  );
}
