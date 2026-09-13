import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { worlds } from "../db/schema.js";
import { requireUser } from "../auth/requireUser.js";
import { config } from "../lib/config.js";
import { summarizeProfile, validateProfileSave } from "../lib/profileBlob.js";

const putBody = z.object({
  expectedRevision: z.number().int().positive(),
  name: z.string().min(1).max(120).optional(),
  localSlot: z.string().max(16).nullable().optional(),
  profile: z.unknown(),
});

const createBody = z.object({
  name: z.string().min(1).max(120).optional(),
  localSlot: z.string().max(16).nullable().optional(),
  profile: z.unknown(),
});

export const worldRoutes = new Hono();

worldRoutes.get("/", async (c) => {
  const auth = await requireUser(c);
  if (auth instanceof Response) return auth;

  const rows = await db
    .select()
    .from(worlds)
    .where(eq(worlds.userId, auth.userId))
    .orderBy(desc(worlds.lastPlayedAt));

  return c.json({
    worlds: rows.map((row) => ({
      id: row.id,
      name: row.name,
      localSlot: row.localSlot,
      saveVersion: row.saveVersion,
      revision: row.revision,
      lastPlayedAt: row.lastPlayedAt,
      updatedAt: row.updatedAt,
      preview: summarizeProfile(row.profileJson),
    })),
  });
});

worldRoutes.post("/", async (c) => {
  const auth = await requireUser(c);
  if (auth instanceof Response) return auth;

  const raw = await c.req.json();
  const parsed = createBody.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }

  const bytes = Buffer.byteLength(JSON.stringify(parsed.data.profile), "utf8");
  if (bytes > config.maxProfileBytes) {
    return c.json({ error: "payload_too_large", maxBytes: config.maxProfileBytes }, 413);
  }

  const profile = validateProfileSave(parsed.data.profile);
  if (!profile.ok) {
    return c.json({ error: "invalid_profile", reason: profile.reason }, 400);
  }

  const run = profile.value.activeRun as { player?: { name?: string } } | null;
  const now = new Date();
  const [row] = await db
    .insert(worlds)
    .values({
      userId: auth.userId,
      name: parsed.data.name ?? run?.player?.name ?? "World",
      localSlot: parsed.data.localSlot ?? null,
      saveVersion: profile.value.version,
      revision: 1,
      profileJson: profile.value,
      createdAt: now,
      updatedAt: now,
      lastPlayedAt: now,
    })
    .returning();

  return c.json(
    {
      world: {
        id: row.id,
        name: row.name,
        localSlot: row.localSlot,
        saveVersion: row.saveVersion,
        revision: row.revision,
        updatedAt: row.updatedAt,
        lastPlayedAt: row.lastPlayedAt,
        profile: row.profileJson,
      },
    },
    201,
  );
});

worldRoutes.get("/:id", async (c) => {
  const auth = await requireUser(c);
  if (auth instanceof Response) return auth;
  const id = c.req.param("id");

  const rows = await db
    .select()
    .from(worlds)
    .where(and(eq(worlds.id, id), eq(worlds.userId, auth.userId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({
    world: {
      id: row.id,
      name: row.name,
      localSlot: row.localSlot,
      saveVersion: row.saveVersion,
      revision: row.revision,
      updatedAt: row.updatedAt,
      lastPlayedAt: row.lastPlayedAt,
      profile: row.profileJson,
    },
  });
});

worldRoutes.put("/:id", async (c) => {
  const auth = await requireUser(c);
  if (auth instanceof Response) return auth;
  const id = c.req.param("id");

  const raw = await c.req.json();
  const parsed = putBody.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
  }

  const bytes = Buffer.byteLength(JSON.stringify(parsed.data.profile), "utf8");
  if (bytes > config.maxProfileBytes) {
    return c.json({ error: "payload_too_large", maxBytes: config.maxProfileBytes }, 413);
  }

  const profile = validateProfileSave(parsed.data.profile);
  if (!profile.ok) {
    return c.json({ error: "invalid_profile", reason: profile.reason }, 400);
  }

  const existing = await db
    .select()
    .from(worlds)
    .where(and(eq(worlds.id, id), eq(worlds.userId, auth.userId)))
    .limit(1);
  const row = existing[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  if (row.revision !== parsed.data.expectedRevision) {
    return c.json(
      {
        error: "conflict",
        message: "A newer cloud save exists.",
        serverRevision: row.revision,
        clientRevision: parsed.data.expectedRevision,
        serverUpdatedAt: row.updatedAt,
        preview: summarizeProfile(row.profileJson),
      },
      409,
    );
  }

  const now = new Date();
  const nextRevision = row.revision + 1;
  const [updated] = await db
    .update(worlds)
    .set({
      name: parsed.data.name ?? row.name,
      localSlot: parsed.data.localSlot === undefined ? row.localSlot : parsed.data.localSlot,
      saveVersion: profile.value.version,
      revision: nextRevision,
      profileJson: profile.value,
      updatedAt: now,
      lastPlayedAt: now,
    })
    .where(and(eq(worlds.id, id), eq(worlds.userId, auth.userId), eq(worlds.revision, row.revision)))
    .returning();

  if (!updated) {
    return c.json({ error: "conflict", message: "Revision changed during write." }, 409);
  }

  return c.json({
    world: {
      id: updated.id,
      name: updated.name,
      localSlot: updated.localSlot,
      saveVersion: updated.saveVersion,
      revision: updated.revision,
      updatedAt: updated.updatedAt,
      lastPlayedAt: updated.lastPlayedAt,
      profile: updated.profileJson,
    },
  });
});

worldRoutes.delete("/:id", async (c) => {
  const auth = await requireUser(c);
  if (auth instanceof Response) return auth;
  const id = c.req.param("id");

  const deleted = await db
    .delete(worlds)
    .where(and(eq(worlds.id, id), eq(worlds.userId, auth.userId)))
    .returning({ id: worlds.id });

  if (!deleted[0]) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ ok: true });
});
