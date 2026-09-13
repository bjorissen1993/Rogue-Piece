import { useEffect, useState } from "react";
import { CloudApi, isCloudConfigured, signInWithGoogle } from "../../services/cloud/CloudApi";
import { CloudSync } from "../../services/cloud/CloudSyncService";
import type { AuthUser, CloudWorldSummary } from "../../services/cloud/types";
import type { ProfileSlot } from "../../models/types";
import { SaveService } from "../../services/SaveService";

type AccountPanelProps = {
  selectedSlot?: ProfileSlot | null;
};

function initialsFrom(user: AuthUser): string {
  const source = user.displayName ?? user.email ?? "?";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function AccountPanel({ selectedSlot = null }: AccountPanelProps) {
  const [user, setUser] = useState<AuthUser | null>(CloudSync.getUser());
  const [worlds, setWorlds] = useState<CloudWorldSummary[]>([]);
  const [status, setStatus] = useState(CloudSync.statusLabel(selectedSlot ?? 1));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const configured = isCloudConfigured();

  useEffect(() => {
    void CloudSync.refreshSession().then(setUser);
    return CloudSync.subscribe(() => {
      setUser(CloudSync.getUser());
      if (selectedSlot != null) {
        setStatus(CloudSync.statusLabel(selectedSlot));
      }
    });
  }, [selectedSlot]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    if (!user) {
      setWorlds([]);
      return;
    }
    void CloudApi.listWorlds()
      .then(setWorlds)
      .catch(() => setWorlds([]));
  }, [user]);

  if (!configured) {
    return (
      <section className="account-panel account-panel-dock">
        <p className="hud-kicker">Account</p>
        <p className="account-panel-copy">Guest mode — local saves only. Cloud API not configured.</p>
      </section>
    );
  }

  return (
    <section className="account-panel account-panel-dock">
      <p className="hud-kicker">Account</p>
      {!user ? (
        <>
          <p className="account-panel-copy">Play as Guest anytime. Sign in to sync your world across devices.</p>
          <button
            className="gold-btn account-google-btn"
            onClick={() => signInWithGoogle()}
            type="button"
          >
            Sign in with Google
          </button>
        </>
      ) : (
        <>
          <div className="account-user-row">
            {user.avatarUrl && !avatarBroken ? (
              <img
                alt=""
                className="account-avatar"
                referrerPolicy="no-referrer"
                src={user.avatarUrl}
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <span aria-hidden className="account-avatar account-avatar-fallback">
                {initialsFrom(user)}
              </span>
            )}
            <div>
              <p className="account-name">{user.displayName ?? user.email ?? "Captain"}</p>
              <p className="account-sync-status">Cloud: {status.toUpperCase()}</p>
            </div>
          </div>
          {message ? <p className="account-panel-copy">{message}</p> : null}
          {selectedSlot != null && selectedSlot !== "dev" ? (
            <button
              className="choice-btn"
              disabled={busy}
              onClick={async () => {
                const profile = SaveService.loadProfile(selectedSlot);
                if (!profile) {
                  setMessage("No local save in this slot.");
                  return;
                }
                setBusy(true);
                const result = await CloudSync.uploadNow(selectedSlot, profile);
                setBusy(false);
                setMessage(
                  result === "ok"
                    ? "Uploaded to cloud."
                    : result === "conflict"
                      ? "Conflict — a newer cloud save exists."
                      : "Cloud sync failed. Saved locally.",
                );
              }}
              type="button"
            >
              Force cloud save
            </button>
          ) : null}
          {worlds.length > 0 ? (
            <ul className="account-world-list">
              {worlds.map((world) => (
                <li key={world.id}>
                  <strong>{world.name}</strong>
                  <span>
                    rev {world.revision}
                    {world.preview.name ? ` · ${world.preview.name}` : ""}
                    {world.preview.day != null ? ` · Day ${world.preview.day}` : ""}
                    {world.preview.legacyCharacters != null
                      ? ` · Legacy ${world.preview.legacyCharacters}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="account-panel-copy">No cloud worlds yet.</p>
          )}
          <button
            className="ghost-btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await CloudSync.logout();
              setBusy(false);
              setMessage(null);
            }}
            type="button"
          >
            Sign out
          </button>
        </>
      )}
    </section>
  );
}
