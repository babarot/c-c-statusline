import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  loadTodayBaseline,
  localDate,
  nextTodayRecord,
  startOfLocalDay,
  type TodayRecord,
  todayUsage,
} from "./usage-today.ts";
import type { WindowState } from "./usage-window.ts";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const DAY_START = startOfLocalDay(NOW);

const week = (pct: number | null, resetMs: number): WindowState => ({
  pct,
  resetAt: new Date(resetMs),
  elapsedRatio: 0.5,
});
const RESET = DAY_START + 4 * DAY;

// ── nextTodayRecord ──────────────────────────────────

Deno.test("nextTodayRecord: first render of the day takes the current usage", () => {
  assertEquals(nextTodayRecord(null, week(20, RESET), NOW), {
    record: { date: localDate(NOW), resetsAt: new Date(RESET).toISOString(), pct: 20 },
    changed: true,
  });
});

Deno.test("nextTodayRecord: keeps the baseline for the rest of the day", () => {
  const stored: TodayRecord = { date: localDate(NOW), resetsAt: new Date(RESET).toISOString(), pct: 20 };
  assertEquals(nextTodayRecord(stored, week(29, RESET), NOW), { record: stored, changed: false });
  // The same reset rounded differently by another source is still the same week.
  assertEquals(nextTodayRecord(stored, week(29, RESET + 1000), NOW)?.changed, false);
});

Deno.test("nextTodayRecord: a new day takes the current usage", () => {
  const stored: TodayRecord = { date: localDate(NOW - DAY), resetsAt: new Date(RESET).toISOString(), pct: 5 };
  assertEquals(nextTodayRecord(stored, week(20, RESET), NOW)?.record.pct, 20);
});

Deno.test("nextTodayRecord: the week resetting today restarts from 0", () => {
  const stored: TodayRecord = { date: localDate(NOW), resetsAt: new Date(NOW - HOUR).toISOString(), pct: 90 };
  assertEquals(nextTodayRecord(stored, week(4, NOW + 7 * DAY - HOUR), NOW), {
    record: { date: localDate(NOW), resetsAt: new Date(NOW + 7 * DAY - HOUR).toISOString(), pct: 0 },
    changed: true,
  });
});

Deno.test("nextTodayRecord: null when weekly usage or reset is unknown", () => {
  assertEquals(nextTodayRecord(null, week(null, RESET), NOW), null);
  assertEquals(nextTodayRecord(null, { pct: 20, resetAt: null, elapsedRatio: null }, NOW), null);
});

// ── todayUsage ───────────────────────────────────────

Deno.test("todayUsage: splits what was left at the start of the day over the days to the reset", () => {
  // 80% left at the start of the day, 4 days to the reset.
  assertEquals(todayUsage(week(29, RESET), 20, NOW), { used: 9, budget: 20 });
});

Deno.test("todayUsage: the whole remainder on the last day", () => {
  assertEquals(todayUsage(week(70, DAY_START + 12 * HOUR + 1), 60, NOW), { used: 10, budget: 40 });
});

Deno.test("todayUsage: a week that started today counts from its start", () => {
  // Placed relative to local midnight so it is the same day in every time zone.
  const now = DAY_START + 10 * HOUR;
  const reset = DAY_START + 3 * HOUR + 7 * DAY; // the week started at 03:00 today
  assertEquals(todayUsage(week(7, reset), 0, now), { used: 7, budget: 100 / 7 });
});

Deno.test("todayUsage: never negative", () => {
  assertEquals(todayUsage(week(18, RESET), 20, NOW)?.used, 0);
});

// ── loadTodayBaseline ────────────────────────────────

Deno.test("loadTodayBaseline: writes the first value of the day and keeps it", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/today.json`;
  try {
    assertEquals(await loadTodayBaseline(week(20, RESET), NOW, path), 20);
    assertEquals(await loadTodayBaseline(week(29, RESET), NOW + HOUR, path), 20);
    assertEquals(JSON.parse(await Deno.readTextFile(path)).pct, 20);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("loadTodayBaseline: starts over from a broken file", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/today.json`;
  try {
    await Deno.writeTextFile(path, "{not json");
    assertEquals(await loadTodayBaseline(week(20, RESET), NOW, path), 20);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("loadTodayBaseline: null when the record cannot be written", async () => {
  assertEquals(await loadTodayBaseline(week(20, RESET), NOW, "/nonexistent-dir/today.json"), null);
});

Deno.test("loadTodayBaseline: concurrent first renders agree on one baseline", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/today.json`;
  try {
    // Two sessions start the day at once, one with a staler value.
    const [a, b] = await Promise.all([
      loadTodayBaseline(week(20, RESET), NOW, path),
      loadTodayBaseline(week(40, RESET), NOW, path),
    ]);
    const stored = JSON.parse(await Deno.readTextFile(path)).pct;
    assertEquals(a, stored);
    assertEquals(b, stored);
    assertEquals(await loadTodayBaseline(week(45, RESET), NOW + HOUR, path), stored);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("loadTodayBaseline: waits for a lock held elsewhere", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/today.json`;
  try {
    const held = await Deno.open(`${path}.lock`, { create: true, write: true });
    await held.lock(true);
    const pending = loadTodayBaseline(week(20, RESET), NOW, path);
    // While the lock is held, nothing is written.
    await new Promise((r) => setTimeout(r, 50));
    assertEquals(await Deno.stat(path).then(() => true, () => false), false);
    held.close();
    assertEquals(await pending, 20);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
