import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { authRoutes } from "./auth/routes.js";
import { worldRoutes } from "./routes/worlds.js";
import { config, frontendBaseUrl } from "./lib/config.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return frontendBaseUrl();
      }
      return config.allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

/** Always-on probe — must not depend on DB. */
app.get("/health", (c) => c.json({ ok: true, service: "rogue-piece-api" }));

/** Browsers that land on the API host get sent back to the game. */
app.get("/", (c) => {
  const game = frontendBaseUrl();
  const accept = c.req.header("accept") ?? "";
  if (accept.includes("text/html")) {
    return c.html(apiLandingHtml(game), 200);
  }
  return c.redirect(game, 302);
});

app.route("/auth", authRoutes);
app.route("/api/worlds", worldRoutes);

app.notFound((c) => {
  const game = frontendBaseUrl();
  const accept = c.req.header("accept") ?? "";
  if (accept.includes("text/html")) {
    return c.html(apiLandingHtml(game, "This API route was not found."), 404);
  }
  return c.json({ error: "not_found", game }, 404);
});

app.onError((err, c) => {
  console.error(err);
  const game = frontendBaseUrl();
  const accept = c.req.header("accept") ?? "";
  if (accept.includes("text/html")) {
    return c.html(
      apiLandingHtml(game, "The API hit an error. Return to the game and try again."),
      500,
    );
  }
  return c.json({ error: "internal", message: err.message, game }, 500);
});

function apiLandingHtml(gameUrl: string, detail?: string): string {
  const safeGame = gameUrl.replace(/"/g, "&quot;");
  const safeDetail = (detail ?? "This is the Rogue Piece API — the game lives on the main site.")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#070b10" />
  <title>Rogue Piece API</title>
  <style>
    body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
      font-family: system-ui, sans-serif; background: #070b10; color: #e8d7b3; padding: 1.5rem; text-align: center; }
    a { display: inline-block; margin-top: 1.25rem; padding: 0.85rem 1.25rem; border-radius: 0.75rem;
      background: linear-gradient(180deg, #c5a059, #9a7a38); color: #1a140a; font-weight: 700; text-decoration: none; }
    p { max-width: 28rem; line-height: 1.45; color: #cbb892; }
  </style>
  <meta http-equiv="refresh" content="0;url=${safeGame}" />
</head>
<body>
  <div>
    <h1>Rogue Piece</h1>
    <p>${safeDetail}</p>
    <p>Redirecting to the game…</p>
    <a href="${safeGame}">Open Rogue Piece</a>
  </div>
</body>
</html>`;
}

serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) => {
  console.log(`Rogue Piece API listening on http://0.0.0.0:${info.port}`);
  console.log(`App URL: ${frontendBaseUrl()} | API URL: ${config.apiUrl}`);
});

export default app;
