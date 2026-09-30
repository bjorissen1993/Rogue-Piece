import type { CrewRole, RoleProficiency, RoleProficiencyTier, RunState } from "../models/types";

const TIER_XP: Array<{ tier: RoleProficiencyTier; xp: number }> = [
  { tier: "NONE", xp: 0 },
  { tier: "NOVICE", xp: 8 },
  { tier: "COMPETENT", xp: 24 },
  { tier: "SKILLED", xp: 48 },
  { tier: "EXPERT", xp: 80 },
  { tier: "MASTER", xp: 120 },
];

function tierFor(xp: number): RoleProficiencyTier {
  let current: RoleProficiencyTier = "NONE";
  for (const row of TIER_XP) {
    if (xp >= row.xp) {
      current = row.tier;
    }
  }
  return current;
}

/** Role EXP only from doing the job — not from Training Grounds. */
export const RoleProficiencyService = {
  get(run: RunState, characterId: string, role: CrewRole): RoleProficiency {
    const member = run.crew.find((entry) => entry.characterId === characterId);
    const existing = member?.roleProficiency?.find((row) => row.role === role);
    return existing ?? { role, xp: 0, tier: "NONE" };
  },

  grant(run: RunState, characterId: string, role: CrewRole, xp: number, reason: string): string | null {
    if (xp <= 0) {
      return null;
    }
    const member = run.crew.find((entry) => entry.characterId === characterId);
    if (!member) {
      return null;
    }
    member.roleProficiency = member.roleProficiency ?? [];
    let row = member.roleProficiency.find((entry) => entry.role === role);
    if (!row) {
      row = { role, xp: 0, tier: "NONE" };
      member.roleProficiency.push(row);
    }
    row.xp += xp;
    const next = tierFor(row.xp);
    const changed = next !== row.tier;
    row.tier = next;
    if (!changed) {
      return null;
    }
    return `${reason} · ${role} is now ${next.toLowerCase()}.`;
  },
};
