import { Hono } from "hono";
import { randomBytes } from "node:crypto";
import {
  clearSessionCookie,
  createSession,
  exchangeGoogleCode,
  readSessionCookie,
  setSessionCookie,
  signOAuthState,
  upsertGoogleUser,
  userFromSessionToken,
  verifyOAuthState,
  destroySession,
} from "./session.js";
import { config, frontendBaseUrl } from "../lib/config.js";

export const authRoutes = new Hono();

function redirectToGame(pathQuery: string): string {
  const base = frontendBaseUrl();
  if (!pathQuery) {
    return base;
  }
  return pathQuery.startsWith("?") ? `${base}${pathQuery}` : `${base}/${pathQuery.replace(/^\//, "")}`;
}

authRoutes.get("/me", async (c) => {
  const user = await userFromSessionToken(readSessionCookie(c));
  if (!user) {
    return c.json({ user: null }, 200);
  }
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt,
    },
  });
});

authRoutes.get("/google", async (c) => {
  try {
    if (!config.googleClientId) {
      return c.redirect(redirectToGame("?authError=missing_google_client"));
    }
    const nonce = randomBytes(16).toString("hex");
    const state = await signOAuthState(nonce);
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: `${config.apiUrl}/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (err) {
    console.error("[auth/google]", err);
    const message = err instanceof Error ? err.message : "auth_start_failed";
    return c.redirect(redirectToGame(`?authError=${encodeURIComponent(message)}`));
  }
});

authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  if (error) {
    return c.redirect(redirectToGame(`?authError=${encodeURIComponent(error)}`));
  }
  if (!code || !state || !(await verifyOAuthState(state))) {
    return c.redirect(redirectToGame("?authError=invalid_state"));
  }
  try {
    const profile = await exchangeGoogleCode(code);
    const user = await upsertGoogleUser(profile);
    const token = await createSession(user.id);
    setSessionCookie(c, token);
    return c.redirect(redirectToGame("?auth=ok"));
  } catch (err) {
    console.error("[auth/google/callback]", err);
    const message = err instanceof Error ? err.message : "auth_failed";
    return c.redirect(redirectToGame(`?authError=${encodeURIComponent(message)}`));
  }
});

authRoutes.post("/logout", async (c) => {
  const token = readSessionCookie(c);
  await destroySession(token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});
