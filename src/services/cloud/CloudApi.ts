import type { AuthUser, CloudWorldDetail, CloudWorldSummary, SaveConflictPayload } from "./types";

/**
 * Cloud is ON unless VITE_API_URL is explicitly "off".
 * - unset / empty in DEV → same-origin (`/auth`, `/api`) via Vite proxy → localhost:3001
 * - unset / empty in PROD → production API host (never relative — Hostnet SPA would swallow /auth)
 * - full URL → call that API host directly
 */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
const CLOUD_DISABLED = RAW_API === "off" || RAW_API === "0" || RAW_API === "false";
const PRODUCTION_API_FALLBACK = "https://api.roguepiece.freakydev.com";

function resolveApiBase(): string | null {
  if (CLOUD_DISABLED) {
    return null;
  }
  const cleaned = RAW_API.replace(/\/$/, "");
  if (cleaned) {
    return cleaned;
  }
  if (import.meta.env.DEV) {
    return "";
  }
  return PRODUCTION_API_FALLBACK;
}

const API_BASE = resolveApiBase();

export function isCloudConfigured(): boolean {
  return API_BASE !== null;
}

/** Absolute Google OAuth start URL (required on mobile — relative /auth hits the SPA). */
export function googleSignInUrl(): string {
  if (API_BASE === null) {
    return "#";
  }
  if (API_BASE === "") {
    return "/auth/google";
  }
  return `${API_BASE}/auth/google`;
}

/** Start Google OAuth (full-page redirect). Prefer navigating via <a href> on mobile. */
export function signInWithGoogle(): void {
  if (!isCloudConfigured()) {
    throw new Error("Cloud API is not configured (set VITE_API_URL or leave it empty for the Vite proxy).");
  }
  const url = googleSignInUrl();
  window.location.assign(url);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (API_BASE === null) {
    throw new Error("Cloud API is not configured");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message ?? (data as { error?: string }).error ?? res.statusText);
    (err as Error & { status?: number; body?: unknown }).status = res.status;
    (err as Error & { status?: number; body?: unknown }).body = data;
    throw err;
  }
  return data;
}

export const CloudApi = {
  async me(): Promise<AuthUser | null> {
    if (API_BASE === null) return null;
    const data = await api<{ user: AuthUser | null }>("/auth/me");
    return data.user;
  },

  async logout(): Promise<void> {
    if (API_BASE === null) return;
    await api("/auth/logout", { method: "POST" });
  },

  async listWorlds(): Promise<CloudWorldSummary[]> {
    const data = await api<{ worlds: CloudWorldSummary[] }>("/api/worlds");
    return data.worlds;
  },

  async getWorld(id: string): Promise<CloudWorldDetail> {
    const data = await api<{ world: CloudWorldDetail }>(`/api/worlds/${id}`);
    return data.world;
  },

  async createWorld(input: {
    profile: unknown;
    name?: string;
    localSlot?: string | null;
  }): Promise<CloudWorldDetail> {
    const data = await api<{ world: CloudWorldDetail }>("/api/worlds", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data.world;
  },

  async updateWorld(
    id: string,
    input: {
      profile: unknown;
      expectedRevision: number;
      name?: string;
      localSlot?: string | null;
    },
  ): Promise<CloudWorldDetail> {
    try {
      const data = await api<{ world: CloudWorldDetail }>(`/api/worlds/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      return data.world;
    } catch (err) {
      const e = err as Error & { status?: number; body?: SaveConflictPayload };
      if (e.status === 409 && e.body?.error === "conflict") {
        throw Object.assign(new Error("conflict"), { conflict: e.body, status: 409 });
      }
      throw err;
    }
  },

  async deleteWorld(id: string): Promise<void> {
    await api(`/api/worlds/${id}`, { method: "DELETE" });
  },
};
