import type { ProfileSave, RunState } from "../models/types";
import { createId } from "../utils/ids";

export const WorldNewsService = {
  ensure(run: RunState) {
    run.world.scheduledNews = run.world.scheduledNews ?? [];
    return run.world.scheduledNews;
  },

  schedule(run: RunState, day: number, text: string, importance = 3): void {
    this.ensure(run).push({ day, text, importance });
  },

  /** Queue staggered fate headlines from the last run — revealed over days, not at start. */
  scheduleRunAftermath(run: RunState, profile: ProfileSave): void {
    const last = profile.runEndHistory?.at(-1);
    if (!last) {
      return;
    }
    this.schedule(run, run.day + 1, `Word spreads: ${last.captainName} was last seen near ${last.locationId}.`, 4);
    this.schedule(run, run.day + 4, `Rumors disagree on ${last.captainName}'s fate after the fighting.`, 3);
    const captured = last.survivors.filter((row) => row.fate === "SURVIVED_HOSPITAL" || row.fate === "SURVIVED_RECOVERING");
    if (captured[0]) {
      this.schedule(run, run.day + 7, `${captured[0].name} is said to be held or healing after the voyage ended.`, 3);
    }
    const missing = last.survivors.find((row) => row.fate === "MISSING" || row.fate === "SURVIVED_ABSENT");
    if (missing) {
      this.schedule(run, run.day + 10, `${missing.name} has not been seen since the crew scattered.`, 3);
    }
  },

  flushDue(run: RunState): string[] {
    const queue = this.ensure(run);
    const due = queue.filter((row) => row.day <= run.day);
    run.world.scheduledNews = queue.filter((row) => row.day > run.day);
    for (const row of due) {
      run.world.history.push({
        id: createId("news"),
        day: run.day,
        text: row.text,
        importance: row.importance,
      });
    }
    return due.map((row) => row.text);
  },
};
