export function createId(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createSeed(): string {
  return crypto.randomUUID();
}
