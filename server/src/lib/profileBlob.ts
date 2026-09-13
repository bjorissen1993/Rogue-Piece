export type ProfileBlob = {
  version: number;
  id: string;
  profileType: string;
  activeRun: unknown;
  progression?: unknown;
  legacy?: unknown;
  [key: string]: unknown;
};

export function validateProfileSave(
  value: unknown,
): { ok: true; value: ProfileBlob } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "not_object" };
  }
  const data = value as ProfileBlob;
  if (typeof data.version !== "number" || data.version < 2) {
    return { ok: false, reason: "bad_version" };
  }
  if (typeof data.id !== "string" || !data.id) {
    return { ok: false, reason: "bad_id" };
  }
  if (!data.profileType) {
    return { ok: false, reason: "bad_profile_type" };
  }
  if (!("activeRun" in data)) {
    return { ok: false, reason: "missing_active_run" };
  }
  if (!data.progression) {
    return { ok: false, reason: "missing_progression" };
  }
  return { ok: true, value: data };
}

export function summarizeProfile(value: unknown): {
  hasActiveRun: boolean;
  name?: string;
  day?: number;
  bounty?: number;
  runsStarted?: number;
  legacyCharacters?: number;
  legacyYear?: number;
} {
  if (!value || typeof value !== "object") {
    return { hasActiveRun: false };
  }
  const data = value as {
    activeRun?: { player?: { name?: string; bounty?: number }; day?: number; gameOver?: boolean } | null;
    statistics?: { runsStarted?: number };
    legacy?: { characters?: unknown[]; timeline?: { year?: number } };
  };
  const run = data.activeRun && !data.activeRun.gameOver ? data.activeRun : null;
  return {
    hasActiveRun: Boolean(run),
    name: run?.player?.name,
    day: run?.day,
    bounty: run?.player?.bounty,
    runsStarted: data.statistics?.runsStarted,
    legacyCharacters: data.legacy?.characters?.length,
    legacyYear: data.legacy?.timeline?.year,
  };
}

/** Pure conflict rule for tests. */
export function canAcceptRevision(serverRevision: number, expectedRevision: number): boolean {
  return serverRevision === expectedRevision;
}
