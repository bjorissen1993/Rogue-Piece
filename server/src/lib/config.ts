export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function env(name: string, fallback?: string): string {
  return process.env[name] ?? fallback ?? "";
}

const rawAppUrl = requireEnv("APP_URL").replace(/\/$/, "");
const rawApiUrl = requireEnv("API_URL").replace(/\/$/, "");

/** Public game site — never the API host. */
export function frontendBaseUrl(): string {
  if (!rawAppUrl || rawAppUrl === rawApiUrl || /\/\/api\./i.test(rawAppUrl)) {
    console.warn(
      "[config] APP_URL looks like the API host; falling back to https://roguepiece.freakydev.com",
    );
    return "https://roguepiece.freakydev.com";
  }
  return rawAppUrl;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  appUrl: rawAppUrl,
  apiUrl: rawApiUrl,
  databaseUrl: requireEnv("DATABASE_URL"),
  authSecret: requireEnv("AUTH_SECRET"),
  googleClientId: requireEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  cookieName: "rp_session",
  sessionDays: 30,
  maxProfileBytes: 2_500_000,
  allowedOrigins: (process.env.CORS_ORIGINS ?? process.env.APP_URL ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
};
