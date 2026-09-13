import { useEffect, useState } from "react";
import { CloudSync } from "../../services/cloud/CloudSyncService";
import { SaveService } from "../../services/SaveService";
import { useGameStore } from "../../stores/GameStore";

export function CloudConflictModal() {
  const { selectedSlot, profile, openProfile } = useGameStore();
  const [conflict, setConflict] = useState(CloudSync.getConflict());

  useEffect(() => CloudSync.subscribe(() => setConflict(CloudSync.getConflict())), []);

  if (!conflict || selectedSlot == null || !profile) {
    return null;
  }

  return (
    <div className="overlay-scrim">
      <section className="overlay-panel overlay-panel-narrow">
        <p className="overlay-eyebrow">CLOUD CONFLICT</p>
        <h2 className="font-display text-2xl text-gold">A newer cloud save exists</h2>
        <p className="mt-3 text-parchment-dim">
          Server revision {conflict.serverRevision} (you have {conflict.clientRevision}).
          {conflict.preview.name ? ` Cloud protagonist: ${conflict.preview.name}.` : ""}
        </p>
        <div className="mt-6 grid gap-3">
          <button
            className="gold-btn"
            onClick={async () => {
              const cloudProfile = await CloudSync.bindWorldToSlot(selectedSlot, conflict.worldId);
              SaveService.persist(cloudProfile);
              CloudSync.clearConflict();
              openProfile(selectedSlot);
            }}
            type="button"
          >
            Load Cloud Version
          </button>
          <button
            className="choice-btn"
            onClick={async () => {
              await CloudSync.resolveConflictKeepLocal(selectedSlot, profile);
            }}
            type="button"
          >
            Keep This Version
          </button>
          <button className="ghost-btn" onClick={() => CloudSync.clearConflict()} type="button">
            Decide Later
          </button>
        </div>
      </section>
    </div>
  );
}
