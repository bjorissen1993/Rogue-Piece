import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { authRoutes } from "./auth/routes.js";
import { worldRoutes } from "./routes/worlds.js";
import { config } from "./lib/config.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return config.appUrl;
      return config.allowedOrigins.includes(origin) ? origin : "";
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "rogue-piece-api" }));
app.route("/auth", authRoutes);
app.route("/api/worlds", worldRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal", message: err.message }, 500);
});

serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) => {
  console.log(`Rogue Piece API listening on http://0.0.0.0:${info.port}`);
});

export default app;
