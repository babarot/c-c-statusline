import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatTokens, formatPath, formatResetTime } from "./format.ts";

// ── formatTokens ─────────────────────────────────────

Deno.test("formatTokens: returns raw number below 1k", () => {
  assertEquals(formatTokens(0), "0");
  assertEquals(formatTokens(1), "1");
  assertEquals(formatTokens(999), "999");
});

Deno.test("formatTokens: formats thousands as Nk", () => {
  assertEquals(formatTokens(1_000), "1k");
  assertEquals(formatTokens(1_499), "1k");
  assertEquals(formatTokens(1_500), "2k");
  assertEquals(formatTokens(50_000), "50k");
  assertEquals(formatTokens(999_999), "1000k");
});

Deno.test("formatTokens: formats millions with one decimal", () => {
  assertEquals(formatTokens(1_000_000), "1.0m");
  assertEquals(formatTokens(1_500_000), "1.5m");
  assertEquals(formatTokens(2_345_678), "2.3m");
  assertEquals(formatTokens(10_000_000), "10.0m");
});

// ── formatPath ───────────────────────────────────────

Deno.test("formatPath: parent style returns last two segments", () => {
  assertEquals(formatPath("/foo/bar/baz", "parent"), "bar/baz");
});

Deno.test("formatPath: basename style returns last segment", () => {
  assertEquals(formatPath("/foo/bar/baz", "basename"), "baz");
});

Deno.test("formatPath: full style returns tilde-replaced path", () => {
  const home = Deno.env.get("HOME") ?? "";
  if (home) {
    assertEquals(formatPath(`${home}/projects/app`, "full"), "~/projects/app");
  }
});

Deno.test("formatPath: full style preserves non-home path", () => {
  assertEquals(formatPath("/tmp/some/dir", "full"), "/tmp/some/dir");
});

Deno.test("formatPath: short style abbreviates intermediate dirs", () => {
  const home = Deno.env.get("HOME") ?? "";
  if (home) {
    const result = formatPath(`${home}/projects/myapp`, "short");
    // ~ stays as-is, then intermediate dirs abbreviated to first char, last two segments kept
    assertEquals(result, "~/projects/myapp");
  }
});

Deno.test("formatPath: short style for non-home path", () => {
  assertEquals(formatPath("/usr/local/bin", "short"), "/u/local/bin");
});

Deno.test("formatPath: parent style with single segment", () => {
  // "/only" splits to ["", "only"] → last two are "" and "only"
  assertEquals(formatPath("/only", "parent"), "/only");
});

// ── formatResetTime ──────────────────────────────────

Deno.test("formatResetTime: returns empty for null/undefined", () => {
  assertEquals(formatResetTime(null), "");
  assertEquals(formatResetTime(undefined), "");
  assertEquals(formatResetTime("null"), "");
});

Deno.test("formatResetTime: returns empty for invalid date", () => {
  assertEquals(formatResetTime("not-a-date"), "");
});

Deno.test("formatResetTime: time style formats hours and minutes", () => {
  // 2025-06-15T14:30:00 local
  const d = new Date(2025, 5, 15, 14, 30);
  const result = formatResetTime(d.toISOString(), "time", "absolute");
  assertEquals(result, "2:30pm");
});

Deno.test("formatResetTime: time style handles midnight", () => {
  const d = new Date(2025, 5, 15, 0, 5);
  const result = formatResetTime(d.toISOString(), "time", "absolute");
  assertEquals(result, "12:05am");
});

Deno.test("formatResetTime: time style handles noon", () => {
  const d = new Date(2025, 5, 15, 12, 0);
  const result = formatResetTime(d.toISOString(), "time", "absolute");
  assertEquals(result, "12:00pm");
});

Deno.test("formatResetTime: datetime style", () => {
  const d = new Date(2025, 0, 5, 9, 15);
  const result = formatResetTime(d.toISOString(), "datetime", "absolute");
  assertEquals(result, "Jan 5, 9:15am");
});

Deno.test("formatResetTime: date style (default)", () => {
  const d = new Date(2025, 11, 25, 10, 0);
  const result = formatResetTime(d.toISOString(), "date", "absolute");
  assertEquals(result, "Dec 25");
});

Deno.test("formatResetTime: relative style shows 'now' for past dates", () => {
  const past = new Date(Date.now() - 60_000);
  assertEquals(formatResetTime(past.toISOString(), "time", "relative"), "now");
});

Deno.test("formatResetTime: relative style formats future durations", () => {
  const future = new Date(Date.now() + 3 * 3600_000 + 30 * 60_000 + 15_000);
  const result = formatResetTime(future.toISOString(), "time", "relative");
  assertEquals(result, "3h 30m left");
});

Deno.test("formatResetTime: relative style shows days", () => {
  const future = new Date(Date.now() + 2 * 86_400_000 + 5 * 3600_000);
  const result = formatResetTime(future.toISOString(), "time", "relative");
  assertEquals(result, "2d 5h left");
});
