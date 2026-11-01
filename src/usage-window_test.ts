import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FIVE_HOUR_MS, SEVEN_DAY_MS, windowState } from "./usage-window.ts";

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
