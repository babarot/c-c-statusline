import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatSessionDuration } from "./session.ts";

Deno.test("returns empty string for undefined", () => {
  assertEquals(formatSessionDuration(undefined), "");
});

Deno.test("returns empty string for invalid date", () => {
  assertEquals(formatSessionDuration("not-a-date"), "");
});

Deno.test("returns empty string for future start time", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  assertEquals(formatSessionDuration(future), "");
});

Deno.test("formats seconds when < 60s", () => {
  const now = Date.now();
  const start = new Date(now - 45_000).toISOString();
  const result = formatSessionDuration(start);
  // Allow slight timing variance
  const num = parseInt(result);
  assertEquals(num >= 44 && num <= 46, true, `expected ~45s, got ${result}`);
  assertEquals(result.endsWith("s"), true);
});

Deno.test("formats minutes when >= 60s", () => {
  const start = new Date(Date.now() - 5 * 60_000).toISOString();
  const result = formatSessionDuration(start);
  assertEquals(result, "5m");
});

Deno.test("formats hours and minutes when >= 3600s", () => {
  const start = new Date(Date.now() - (2 * 3600_000 + 15 * 60_000)).toISOString();
  const result = formatSessionDuration(start);
  assertEquals(result, "2h15m");
});

Deno.test("formats exact hour boundary", () => {
  const start = new Date(Date.now() - 3600_000).toISOString();
  const result = formatSessionDuration(start);
  assertEquals(result, "1h0m");
});
