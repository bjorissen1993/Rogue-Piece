import type { Context } from "hono";
import { readSessionCookie, userFromSessionToken } from "./session.js";

export async function requireUser(c: Context): Promise<{ userId: string } | Response> {
  const user = await userFromSessionToken(readSessionCookie(c));
  if (!user) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return { userId: user.id };
}
