import type { ProfileSave, ProfileSlot } from "../../models/types";
import { CloudApi, isCloudConfigured } from "./CloudApi";
import type { AuthUser, CloudSlotMeta, CloudSyncStatus, SaveConflictPayload } from "./types";

const META_KEY = "roguepiece_cloud_meta_v1";
const DEBOUNCE_MS = 2500;

type MetaMap = Partial<Record<string, CloudSlotMeta>>;

type Listener = () => void;

function slotKey(slot: ProfileSlot): string {
  return String(slot);
}

function readMetaMap(): MetaMap {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MetaMap;
  } catch {
    return {};
  }
}

function writeMetaMap(map: MetaMap): void {
  localStorage.setItem(META_KEY, JSON.stringify(map));
}

function defaultMeta(): CloudSlotMeta {
  return {
    worldId: null,
    revision: 0,
    lastSyncedAt: null,
    status: isCloudConfigured() ? "offline" : "guest",
    pendingUpload: false,
  };
}

class CloudSyncController {
  private user: AuthUser | null = null;
  private listeners = new Set<Listener>();
  private timers = new Map<string, number>();
  private conflict: (SaveConflictPayload & { worldId: string; slot: ProfileSlot }) | null = null;
  private simulateFailure = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  getUser(): AuthUser | null {
    return this.user;
  }

  getConflict() {
    return this.conflict;
  }

  getMeta(slot: ProfileSlot): CloudSlotMeta {
    return readMetaMap()[slotKey(slot)] ?? defaultMeta();
  }

  setSimulateFailure(value: boolean): void {
    this.simulateFailure = value;
  }

  private setMeta(slot: ProfileSlot, patch: Partial<CloudSlotMeta>): CloudSlotMeta {
    const map = readMetaMap();
    const next = { ...this.getMeta(slot), ...patch };
    map[slotKey(slot)] = next;
    writeMetaMap(map);
    this.emit();
    return next;
  }

  async refreshSession(): Promise<AuthUser | null> {
    if (!isCloudConfigured()) {
      this.user = null;
      this.emit();
      return null;
    }
    try {
      this.user = await CloudApi.me();
    } catch {
      this.user = null;
    }
    this.emit();
    return this.user;
  }

  async logout(): Promise<void> {
    try {
      await CloudApi.logout();
    } finally {
      this.user = null;
      this.emit();
    }
  }

  statusLabel(slot: ProfileSlot): CloudSyncStatus {
    if (!isCloudConfigured()) return "guest";
    if (!this.user) return "guest";
    return this.getMeta(slot).status;
  }

  /** Schedule a debounced cloud upload after a local persist. */
  scheduleUpload(slot: ProfileSlot, profile: ProfileSave): void {
    if (!isCloudConfigured() || !this.user) return;
    if (profile.profileType === "DEVELOPMENT") return;

    this.setMeta(slot, { pendingUpload: true, status: "syncing" });
    const key = slotKey(slot);
    const existing = this.timers.get(key);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      void this.uploadNow(slot, profile);
    }, DEBOUNCE_MS);
    this.timers.set(key, timer);
  }

  async uploadNow(slot: ProfileSlot, profile: ProfileSave): Promise<"ok" | "error" | "conflict"> {
    if (!isCloudConfigured() || !this.user) return "error";
    if (this.simulateFailure) {
      this.setMeta(slot, {
        status: "error",
        lastError: "Simulated cloud failure",
        pendingUpload: true,
      });
      return "error";
    }

    this.setMeta(slot, { status: "syncing", pendingUpload: true });
    const meta = this.getMeta(slot);
    try {
      if (!meta.worldId) {
        const created = await CloudApi.createWorld({
          profile,
          localSlot: String(slot),
          name: profile.activeRun?.player.name ?? `World ${slot}`,
        });
        this.setMeta(slot, {
          worldId: created.id,
          revision: created.revision,
          lastSyncedAt: new Date().toISOString(),
          status: "synced",
          pendingUpload: false,
          lastError: undefined,
        });
        this.conflict = null;
        this.emit();
        return "ok";
      }

      const updated = await CloudApi.updateWorld(meta.worldId, {
        profile,
        expectedRevision: meta.revision,
        localSlot: String(slot),
      });
      this.setMeta(slot, {
        worldId: updated.id,
        revision: updated.revision,
        lastSyncedAt: new Date().toISOString(),
        status: "synced",
        pendingUpload: false,
        lastError: undefined,
      });
      this.conflict = null;
      this.emit();
      return "ok";
    } catch (err) {
      const conflict = (err as { conflict?: SaveConflictPayload; status?: number }).conflict;
      if (conflict) {
        this.conflict = { ...conflict, worldId: meta.worldId!, slot };
        this.setMeta(slot, { status: "conflict", pendingUpload: true, lastError: conflict.message });
        this.emit();
        return "conflict";
      }
      const message = err instanceof Error ? err.message : "Cloud sync failed";
      this.setMeta(slot, { status: "error", pendingUpload: true, lastError: message });
      return "error";
    }
  }

  async bindWorldToSlot(slot: ProfileSlot, worldId: string): Promise<ProfileSave> {
    const world = await CloudApi.getWorld(worldId);
    this.setMeta(slot, {
      worldId: world.id,
      revision: world.revision,
      lastSyncedAt: new Date().toISOString(),
      status: "synced",
      pendingUpload: false,
    });
    return world.profile as ProfileSave;
  }

  /** Keep local version: force overwrite cloud by adopting server revision first then rewriting. */
  async resolveConflictKeepLocal(slot: ProfileSlot, profile: ProfileSave): Promise<void> {
    const conflict = this.conflict;
    if (!conflict) return;
    this.setMeta(slot, { revision: conflict.serverRevision });
    this.conflict = null;
    await this.uploadNow(slot, profile);
  }

  clearConflict(): void {
    this.conflict = null;
    this.emit();
  }
}

export const CloudSync = new CloudSyncController();
