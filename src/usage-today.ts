/**
 * Today's share of weekly usage. Weekly usage is a running total, so today's part
 * is the current value minus the value at the first render of the day, which is
 * kept in a file across renders and sessions.
 */
import { SEVEN_DAY_MS, type WindowState } from "./usage-window.ts";

const DAY_MS = 24 * 60 * 60_000;

/** Two reset times closer than this are the same week; sources round them differently. */
const SAME_RESET_TOLERANCE_MS = 60 * 60_000;

export interface TodayRecord {
  /** Local date the record is for, as YYYY-MM-DD. */
  date: string;
  /** Weekly reset time the record belongs to, as ISO 8601. */
  resetsAt: string;
  /** Weekly usage at the first render of the day (0-100). */
  pct: number;
}

/** Local midnight at the start of the day containing `now`. */
export function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The local date of `now` as YYYY-MM-DD. */
export function localDate(now: number): string {
  const d = new Date(now);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Decide today's baseline from the stored record and the current weekly window.
 * Returns the record to keep and whether it has to be written. Null when the
 * weekly usage or reset is unknown.
 *
 * - Same day and same week: keep the stored baseline.
 * - Same day, but the week has reset since: the new week started from 0.
 * - A new day, or no usable record: the current usage is the baseline.
 */
export function nextTodayRecord(
  stored: TodayRecord | null,
  week: WindowState,
  now: number,
): { record: TodayRecord; changed: boolean } | null {
  if (week.pct === null || week.resetAt === null) return null;
  const date = localDate(now);
  const resetsAt = week.resetAt.toISOString();

  if (stored && stored.date === date) {
    const storedReset = new Date(stored.resetsAt).getTime();
    if (Math.abs(storedReset - week.resetAt.getTime()) < SAME_RESET_TOLERANCE_MS) {
      return { record: stored, changed: false };
    }
    return { record: { date, resetsAt, pct: 0 }, changed: true };
  }
  return { record: { date, resetsAt, pct: week.pct }, changed: true };
}

export interface TodayUsage {
  /** Points of weekly usage used today. */
  used: number;
  /** Points that can be used today to spread what was left at the start of the day evenly to the reset. */
  budget: number;
}

/**
 * Today's usage against an even split of what was left at the start of the day
 * over the days until the reset. The day starts at local midnight, or at the week
 * start if the week began later today. On the last day the whole remainder is
 * today's budget.
 */
export function todayUsage(week: WindowState, baseline: number, now: number): TodayUsage | null {
  if (week.pct === null || week.resetAt === null) return null;
  const resetMs = week.resetAt.getTime();
  const dayStart = Math.max(startOfLocalDay(now), resetMs - SEVEN_DAY_MS);
  const daysLeft = (resetMs - dayStart) / DAY_MS;
  const remaining = Math.max(0, 100 - baseline);
  return {
    used: Math.max(0, week.pct - baseline),
    budget: remaining / Math.max(1, daysLeft),
  };
}

export function todayRecordPath(): string {
  const home = Deno.env.get("HOME") ?? "/tmp";
  return `${home}/.claude/statusline-usage-today.json`;
}

async function readRecord(path: string): Promise<TodayRecord | null> {
  try {
    const raw = JSON.parse(await Deno.readTextFile(path));
    if (
      typeof raw?.date === "string" && typeof raw?.resetsAt === "string" &&
      typeof raw?.pct === "number"
    ) {
      return { date: raw.date, resetsAt: raw.resetsAt, pct: raw.pct };
    }
  } catch { /* missing or broken: start over */ }
  return null;
}

/**
 * Run `fn` holding an exclusive OS lock (flock) on `lockPath`. The OS releases it
 * when the file is closed or the process exits, so a process that dies holding it
 * cannot leave it stuck. Null when the lock file cannot be opened.
 */
async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T | null> {
  let file: Deno.FsFile;
  try {
    file = await Deno.open(lockPath, { create: true, write: true });
  } catch {
    return null;
  }
  try {
    await file.lock(true);
    return await fn();
  } finally {
    file.close();
  }
}

/**
 * Load today's baseline, writing a new record when the day or week has changed.
 * Sessions render concurrently and may start a new day at the same moment, so a
 * change is made under a lock, re-reading the record first: the first session to
 * get there sets the baseline and the others keep it. The lock file stays next to
 * the record. Null when the weekly window
 * is unknown, or when a new record cannot be written: every render would then
 * take the current usage as the baseline and always show 0 for today.
 */
export async function loadTodayBaseline(
  week: WindowState,
  now: number,
  path: string = todayRecordPath(),
): Promise<number | null> {
  const next = nextTodayRecord(await readRecord(path), week, now);
  if (!next) return null;
  if (!next.changed) return next.record.pct;

  return await withLock(`${path}.lock`, async () => {
    const latest = nextTodayRecord(await readRecord(path), week, now);
    if (!latest) return null;
    if (latest.changed) {
      try {
        const tmp = `${path}.${Deno.pid}.tmp`;
        await Deno.writeTextFile(tmp, JSON.stringify(latest.record));
        await Deno.rename(tmp, path);
      } catch {
        return null;
      }
    }
    return latest.record.pct;
  });
}
