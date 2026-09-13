/** Client ↔ API contract for cloud worlds (full ProfileSave blobs). */

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastLoginAt: string;
};

export type CloudWorldSummary = {
  id: string;
  name: string;
  localSlot: string | null;
  saveVersion: number;
  revision: number;
  lastPlayedAt: string;
  updatedAt: string;
  preview: {
    hasActiveRun: boolean;
    name?: string;
    day?: number;
    bounty?: number;
    runsStarted?: number;
    legacyCharacters?: number;
    legacyYear?: number;
  };
};

export type CloudWorldDetail = {
  id: string;
  name: string;
  localSlot: string | null;
  saveVersion: number;
  revision: number;
  updatedAt: string;
  lastPlayedAt: string;
  profile: unknown;
};

export type CloudSyncStatus =
  | "guest"
  | "offline"
  | "syncing"
  | "synced"
  | "error"
  | "conflict";

export type CloudSlotMeta = {
  worldId: string | null;
  revision: number;
  lastSyncedAt: string | null;
  status: CloudSyncStatus;
  lastError?: string;
  pendingUpload: boolean;
};

export type SaveConflictPayload = {
  error: "conflict";
  message: string;
  serverRevision: number;
  clientRevision: number;
  serverUpdatedAt: string;
  preview: CloudWorldSummary["preview"];
};
