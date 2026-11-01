import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FIVE_HOUR_MS, forecast, SEVEN_DAY_MS, type WindowState, windowState } from "./usage-window.ts";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

Deno.test("windowState: null when the window is absent", () => {
  assertEquals(windowState(undefined, FIVE_HOUR_MS, NOW), null);
  assertEquals(windowState(null, FIVE_HOUR_MS, NOW), null);
});

Deno.test("windowState: current window", () => {
  assertEquals(windowState({ utilization: 31.4, resets_at: at(5 * DAY + 6 * HOUR) }, SEVEN_DAY_MS, NOW), {
    pct: 31,
    resetAt: new Date(NOW + 5 * DAY + 6 * HOUR),
    elapsedRatio: 1 - (5 * DAY + 6 * HOUR) / SEVEN_DAY_MS,
  });
});

Deno.test("windowState: missing utilization counts as 0", () => {
  assertEquals(windowState({ resets_at: at(HOUR) }, FIVE_HOUR_MS, NOW)?.pct, 0);
});

Deno.test("windowState: expired window has unknown usage and rolls the reset forward", () => {
  assertEquals(windowState({ utilization: 80, resets_at: at(-1 * HOUR) }, FIVE_HOUR_MS, NOW), {
    pct: null,
    resetAt: new Date(NOW + 4 * HOUR),
    elapsedRatio: 1 - (4 * HOUR) / FIVE_HOUR_MS,
  });
  // More than one whole window behind.
  assertEquals(
    windowState({ utilization: 80, resets_at: at(-11 * HOUR) }, FIVE_HOUR_MS, NOW)?.resetAt,
    new Date(NOW + 4 * HOUR),
  );
});

Deno.test("windowState: a reset exactly at now is not expired", () => {
  assertEquals(windowState({ utilization: 50, resets_at: at(0) }, FIVE_HOUR_MS, NOW), {
    pct: 50,
    resetAt: new Date(NOW),
    elapsedRatio: 1,
  });
});

Deno.test("windowState: unknown or invalid reset", () => {
  const expected = { pct: 12, resetAt: null, elapsedRatio: null };
  assertEquals(windowState({ utilization: 12 }, FIVE_HOUR_MS, NOW), expected);
  assertEquals(windowState({ utilization: 12, resets_at: "not-a-date" }, FIVE_HOUR_MS, NOW), expected);
});

Deno.test("windowState: elapsed ratio is clamped when the reset is further than one window", () => {
  assertEquals(windowState({ utilization: 1, resets_at: at(6 * HOUR) }, FIVE_HOUR_MS, NOW)?.elapsedRatio, 0);
});

// ── forecast ─────────────────────────────────────────

/** A weekly window `elapsed` into the week with `pct` used. */
const week = (pct: number | null, elapsed: number): WindowState => ({
  pct,
  resetAt: new Date(NOW + SEVEN_DAY_MS - elapsed),
  elapsedRatio: elapsed / SEVEN_DAY_MS,
});

Deno.test("forecast: runs out before the reset", () => {
  // 40% in 2 days is 20%/day: 60% left lasts 3 days, 2 days before the reset.
  assertEquals(forecast(week(40, 2 * DAY), SEVEN_DAY_MS, NOW), {
    kind: "runs-out",
    inMs: 3 * DAY,
    beforeResetMs: 2 * DAY,
  });
});

Deno.test("forecast: lasts until the reset", () => {
  // 20% in 2 days is 10%/day: 70% at the reset.
  const f = forecast(week(20, 2 * DAY), SEVEN_DAY_MS, NOW);
  assertEquals(f?.kind, "lasts");
  assertEquals(Math.round((f as { pctAtReset: number }).pctAtReset), 70);
});

Deno.test("forecast: running out exactly at the reset counts as lasting", () => {
  // 50% in 3.5 days reaches 100% exactly at the reset.
  assertEquals(forecast(week(50, 3.5 * DAY), SEVEN_DAY_MS, NOW)?.kind, "lasts");
});

Deno.test("forecast: none in the first 24 hours", () => {
  assertEquals(forecast(week(30, 23 * HOUR), SEVEN_DAY_MS, NOW), null);
  assertEquals(forecast(week(30, 24 * HOUR), SEVEN_DAY_MS, NOW)?.kind, "runs-out");
});

Deno.test("forecast: none without usage, at the limit, or with unknowns", () => {
  assertEquals(forecast(week(0, 2 * DAY), SEVEN_DAY_MS, NOW), null);
  assertEquals(forecast(week(100, 2 * DAY), SEVEN_DAY_MS, NOW), null);
  assertEquals(forecast(week(null, 2 * DAY), SEVEN_DAY_MS, NOW), null);
  assertEquals(forecast({ pct: 30, resetAt: null, elapsedRatio: null }, SEVEN_DAY_MS, NOW), null);
});
