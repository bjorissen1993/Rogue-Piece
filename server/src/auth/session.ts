import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db } from "../db/client.js";
import { sessions, users, type UserRow } from "../db/schema.js";
import { config, frontendBaseUrl } from "../lib/config.js";

const secret = () => new TextEncoder().encode(config.authSecret);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return token;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function userFromSessionToken(token: string | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  return row.user;
}

export function setSessionCookie(c: Context, token: string): void {
  const secure = config.apiUrl.startsWith("https") || frontendBaseUrl().startsWith("https");
  setCookie(c, config.cookieName, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    path: "/",
    maxAge: config.sessionDays * 24 * 60 * 60,
  });
}

export function clearSessionCookie(c: Context): void {
  const secure = config.apiUrl.startsWith("https") || frontendBaseUrl().startsWith("https");
  deleteCookie(c, config.cookieName, {
    path: "/",
    secure,
    sameSite: secure ? "None" : "Lax",
  });
}

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, config.cookieName);
}

/** Short-lived signed state for OAuth CSRF. */
export async function signOAuthState(nonce: string): Promise<string> {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function verifyOAuthState(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}

export type GoogleProfile = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: `${config.apiUrl}/auth/google/callback`,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!tokens.access_token) {
    throw new Error("Google token response missing access_token");
  }
  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`Google userinfo failed: ${profileRes.status}`);
  }
  const profile = (await profileRes.json()) as GoogleProfile;
  if (!profile.sub) {
    throw new Error("Google profile missing sub");
  }
  return profile;
}

export async function upsertGoogleUser(profile: GoogleProfile): Promise<UserRow> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.googleAccountId, profile.sub))
    .limit(1);
  const now = new Date();
  if (existing[0]) {
    const [updated] = await db
      .update(users)
      .set({
        email: profile.email ?? existing[0].email,
        displayName: profile.name ?? existing[0].displayName,
        avatarUrl: profile.picture ?? existing[0].avatarUrl,
        updatedAt: now,
        lastLoginAt: now,
      })
      .where(eq(users.id, existing[0].id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(users)
    .values({
      googleAccountId: profile.sub,
      email: profile.email,
      displayName: profile.name,
      avatarUrl: profile.picture,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })
    .returning();
  return created;
}
