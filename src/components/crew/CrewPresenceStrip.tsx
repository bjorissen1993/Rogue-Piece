import { useState } from "react";
import type { RunState } from "../../models/types";
import { CharacterScheduleService } from "../../services/CharacterScheduleService";
import { CrewBadgeDetailPanel, CrewPresenceBadge } from "./CrewPresenceBadge";

type CrewPresenceStripProps = {
  run: RunState;
  compact?: boolean;
};

export function CrewPresenceStrip({ run, compact = false }: CrewPresenceStripProps) {
  const [detailId, setDetailId] = useState<string | null>(null);
  CharacterScheduleService.ensure(run);
  const available = [
    { id: "player", ok: CharacterScheduleService.isAvailable(run, "player") },
    ...run.crew.map((member) => ({
      id: member.characterId,
      ok: CharacterScheduleService.isAvailable(run, member.characterId),
    })),
  ];
  const present = available.filter((entry) => entry.ok);
  const absent = available.filter((entry) => !entry.ok);

  return (
    <>
      <section className="crew-presence-strip" aria-label="Crew presence">
        <div className="crew-presence-group">
          <p className="crew-presence-label">
            Available Crew · {present.length}/{available.length}
          </p>
          <div className="crew-presence-row">
            {present.map((entry) => (
              <CrewPresenceBadge
                characterId={entry.id}
                compact={compact}
                key={entry.id}
                onOpenDetail={setDetailId}
                run={run}
                showDetailOnClick
              />
            ))}
          </div>
        </div>
        {absent.length ? (
          <div className="crew-presence-group is-unavailable-group">
            <p className="crew-presence-label">Unavailable</p>
            <div className="crew-presence-row">
              {absent.map((entry) => (
                <CrewPresenceBadge
                  characterId={entry.id}
                  compact={compact}
                  key={entry.id}
                  onOpenDetail={setDetailId}
                  run={run}
                  showDetailOnClick
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
      {detailId ? (
        <CrewBadgeDetailPanel characterId={detailId} onClose={() => setDetailId(null)} run={run} />
      ) : null}
    </>
  );
}
