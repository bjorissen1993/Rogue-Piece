import type { AuthUser } from "./cloud/types";

/** Comma-separated Google emails that may see the Development/Sandbox profile in production builds. */
function allowlist(): string[] {
  const raw = import.meta.env.VITE_DEV_ACCESS_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Development profile is for the game author only.
 * - Vite `npm run dev`: always allowed (local work).
 * - Production builds: only when signed in with an email from `VITE_DEV_ACCESS_EMAILS`.
 */
export function canAccessDevelopmentProfile(user: AuthUser | null | undefined): boolean {
  if (import.meta.env.DEV) return true;
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return allowlist().includes(email);
}
