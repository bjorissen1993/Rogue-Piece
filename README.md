# Rogue Piece

Text/choice roguelike set in a generated pirate era. Devil Fruits and old seats of power are unclaimed again. The run decides who gets them.

## Run (local guest play)

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Guest saves live in the browser via localStorage. Use **Development Profile** for a separate sandbox that never overwrites normal slots (local `npm run dev` only, or production when your Google email is in `VITE_DEV_ACCESS_EMAILS`).

## Cloud saves + Google auth (optional)

The game can run fully as Guest. Cloud sync requires the API server and PostgreSQL.

### 1. Environment

Copy `.env.example` to `.env` (frontend) and `server/.env` (API), then fill Google OAuth credentials.

- Frontend needs `VITE_API_URL` (empty = same-origin via Vite proxy to `:3001`, or `"off"` for guest-only).
- API needs `DATABASE_URL`, `APP_URL`, `API_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

Google Cloud Console:

- Authorized JavaScript origins: `http://localhost:5173`, `https://roguepiece.freakydev.com`
- Authorized redirect URIs:
  - `http://localhost:3001/auth/google/callback`
  - `https://api.roguepiece.freakydev.com/auth/google/callback`

Local `API_URL` / `PORT` must be `http://localhost:3001` so the redirect URI matches Google Console.

### 2. Database

```bash
npm run db:up
npm install --prefix server
npm run db:migrate
```

### 3. API + frontend

```bash
npm run dev:api
npm run dev
```

Sign in with Google from the save select / profile menu. Authenticated play debounces cloud uploads of the full **ProfileSave** blob (active run + legacy + collection + meta). Revisions prevent silent multi-device overwrites.

## Production (Hostnet + Railway)

| Piece | Where |
|-------|--------|
| Game SPA (`dist/`) | **Hostnet** → `https://roguepiece.freakydev.com` |
| API (`server/`) | **Railway** → `https://api.roguepiece.freakydev.com` |
| Postgres | **Railway Postgres** plugin |

### A. Railway (API + DB)

1. Create a Railway project and add a **Postgres** plugin.
2. Add a service from this repo with **Root Directory = `server`** (uses [`server/railway.toml`](server/railway.toml)).
3. Set variables (see [`server/.env.production.example`](server/.env.production.example)):

```env
APP_URL=https://roguepiece.freakydev.com
API_URL=https://api.roguepiece.freakydev.com
CORS_ORIGINS=https://roguepiece.freakydev.com
AUTH_SECRET=<long-random-string>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

**Important:** `APP_URL` must be the **game** site (`https://roguepiece.freakydev.com`), never the API host. After Google login the API redirects players back to `APP_URL`. If `APP_URL` points at the API, mobile users get stuck on a blank API page.

`PORT` is injected by Railway; the API listens on `0.0.0.0`.

4. Attach custom domain `api.roguepiece.freakydev.com` and create the CNAME at Hostnet DNS as Railway shows.
5. Run migrations once against production DB (from your machine):

```bash
cd server
DATABASE_URL="<railway-postgres-url>" npm run db:migrate
```

6. Smoke: `https://api.roguepiece.freakydev.com/health` → `{ "ok": true, ... }`.

### B. Hostnet (static SPA)

1. DNS: `roguepiece` → Hostnet webspace; SSL on.
2. Build the frontend (copy [`.env.production.example`](.env.production.example) → `.env.production` and fill emails if needed):

```bash
npm run build:web
```

Or without a file:

```bash
# PowerShell
$env:VITE_API_URL="https://api.roguepiece.freakydev.com"; npm run build:web
```

3. Upload the **contents** of `dist/` (including `.htaccess`) into the document root of `roguepiece.freakydev.com`.

### C. Google Console

- Origin: `https://roguepiece.freakydev.com`
- Redirect: `https://api.roguepiece.freakydev.com/auth/google/callback`

### D. Smoke test

1. Open the game → **Sign in with Google**.
2. Play / **Force cloud save**.
3. Incognito or another browser → sign in → confirm the world loads.

Do not run the Vite dev server in production.
