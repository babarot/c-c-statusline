import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { usageItem } from "./usage.ts";
import type { RenderContext } from "./types.ts";
import type { UsageData } from "../usage.ts";
import { startOfLocalDay } from "../usage-today.ts";

// deno-lint-ignore no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

// Mid-month, so the extra usage reset ("Dec 1") is the same in every time zone.
const NOW = Date.parse("2026-11-15T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function render(
  usageData: UsageData | null,
  pace = false,
  forecast = false,
  todayBaseline: number | null = null,
): string | null {
  const ctx = {
    now: NOW,
    usageData,
    todayBaseline,
    options: { barStyle: "block", timeStyle: "relative", usage: { pace, forecast, today: todayBaseline !== null } },
  } as unknown as RenderContext;
  const out = usageItem.render(ctx);
  return out === null ? null : stripAnsi(out);
}

Deno.test("usageItem: hidden without usage data", () => {
  assertEquals(render(null), null);
});

Deno.test("usageItem: shows the 5-hour and weekly windows", () => {
  const out = render({
    five_hour: { utilization: 42.4, resets_at: at(2 * HOUR + 30 * MIN) },
    seven_day: { utilization: 15, resets_at: at(3 * DAY + 4 * HOUR) },
  });
  assertEquals(
    out,
    [
      "current ▰▰▰▰▱▱▱▱▱▱  42% ⟳ 2h 30m left",
      "weekly  ▰▰▱▱▱▱▱▱▱▱  15% ⟳ 3d 4h left",
    ].join("\n"),
  );
});

Deno.test("usageItem: no current line without a 5-hour window", () => {
  const out = render({
    seven_day: { utilization: 31, resets_at: at(6 * DAY + 11 * HOUR) },
  });
  assertEquals(out, "weekly  ▰▰▰▱▱▱▱▱▱▱  31% ⟳ 6d 11h left");
});

Deno.test("usageItem: stale label for an expired weekly window without a 5-hour window", () => {
  const out = render({
    seven_day: { utilization: 90, resets_at: at(-1 * DAY) },
    _fetched_at: NOW - (2 * DAY),
  });
  assertEquals(out, ["weekly  ▱▱▱▱▱▱▱▱▱▱   ?% ⟳ 6d left", "(stale: 48h ago)"].join("\n"));
});

Deno.test("usageItem: expired windows show ?% and roll the reset forward", () => {
  const out = render({
    five_hour: { utilization: 80, resets_at: at(-1 * HOUR) },
    seven_day: { utilization: 90, resets_at: at(-1 * DAY) },
  });
  assertEquals(
    out,
    [
      "current ▱▱▱▱▱▱▱▱▱▱   ?% ⟳ 4h left",
      "weekly  ▱▱▱▱▱▱▱▱▱▱   ?% ⟳ 6d left",
    ].join("\n"),
  );
});

Deno.test("usageItem: stale label when a window expired and data is old", () => {
  const out = render({
    five_hour: { utilization: 80, resets_at: at(-1 * HOUR) },
    seven_day: { utilization: 20, resets_at: at(2 * DAY) },
    _fetched_at: NOW - (90 * MIN),
  });
  assertEquals(
    out,
    [
      "current ▱▱▱▱▱▱▱▱▱▱   ?% ⟳ 4h left",
      "weekly  ▰▰▱▱▱▱▱▱▱▱  20% ⟳ 2d left",
      "(stale: 1h30m ago)",
    ].join("\n"),
  );
});

Deno.test("usageItem: no stale label while windows are current", () => {
  const out = render({
    five_hour: { utilization: 10, resets_at: at(1 * HOUR) },
    seven_day: { utilization: 20, resets_at: at(2 * DAY) },
    _fetched_at: NOW - (90 * MIN),
  });
  assertEquals(
    out,
    [
      "current ▰▱▱▱▱▱▱▱▱▱  10% ⟳ 1h left",
      "weekly  ▰▰▱▱▱▱▱▱▱▱  20% ⟳ 2d left",
    ].join("\n"),
  );
});

Deno.test("usageItem: extra usage lines when enabled and used", () => {
  const out = render({
    five_hour: { utilization: 0, resets_at: at(1 * HOUR) },
    seven_day: { utilization: 0, resets_at: at(2 * DAY) },
    extra_usage: { is_enabled: true, utilization: 24.68, used_credits: 1234, monthly_limit: 5000 },
  });
  assertEquals(
    out,
    [
      "current ▱▱▱▱▱▱▱▱▱▱   0% ⟳ 1h left",
      "weekly  ▱▱▱▱▱▱▱▱▱▱   0% ⟳ 2d left",
      "extra   ▰▰▰▱▱▱▱▱▱▱ $12.34/$50.00",
      "resets Dec 1",
    ].join("\n"),
  );
});

Deno.test("usageItem: no extra usage lines when disabled or unused", () => {
  const base = {
    five_hour: { utilization: 0, resets_at: at(1 * HOUR) },
    seven_day: { utilization: 0, resets_at: at(2 * DAY) },
  };
  const expected = [
    "current ▱▱▱▱▱▱▱▱▱▱   0% ⟳ 1h left",
    "weekly  ▱▱▱▱▱▱▱▱▱▱   0% ⟳ 2d left",
  ].join("\n");
  assertEquals(render({ ...base, extra_usage: { is_enabled: false, used_credits: 1234 } }), expected);
  assertEquals(render({ ...base, extra_usage: { is_enabled: true, used_credits: 0 } }), expected);
});

// ── pace ─────────────────────────────────────────────

Deno.test("usageItem pace: ahead of an even pace", () => {
  // 13h into the week (7.7%) with 31% used.
  const out = render({ seven_day: { utilization: 31, resets_at: at(6 * DAY + 11 * HOUR) } }, true);
  assertEquals(out, "weekly  ▰▰▰▱▱▱▱▱▱▱  31% (+23pt ahead) ⟳ 6d 11h left");
});

Deno.test("usageItem pace: on pace within 3 points", () => {
  const out = render({ seven_day: { utilization: 51, resets_at: at(3 * DAY + 12 * HOUR) } }, true);
  assertEquals(out, "weekly  ▰▰▰▰▰┃▱▱▱▱  51% (on pace) ⟳ 3d 12h left");
});

Deno.test("usageItem pace: under an even pace", () => {
  const out = render({ seven_day: { utilization: 10, resets_at: at(3 * DAY + 12 * HOUR) } }, true);
  assertEquals(out, "weekly  ▰▱▱▱▱┃▱▱▱▱  10% (-40pt under) ⟳ 3d 12h left");
});

Deno.test("usageItem pace: only on the weekly line", () => {
  const out = render({
    five_hour: { utilization: 42, resets_at: at(2 * HOUR + 30 * MIN) },
    seven_day: { utilization: 10, resets_at: at(3 * DAY + 12 * HOUR) },
  }, true);
  assertEquals(
    out,
    [
      "current ▰▰▰▰▱▱▱▱▱▱  42% ⟳ 2h 30m left",
      "weekly  ▰▱▱▱▱┃▱▱▱▱  10% (-40pt under) ⟳ 3d 12h left",
    ].join("\n"),
  );
});

Deno.test("usageItem pace: none when usage or reset is unknown", () => {
  assertEquals(render({ seven_day: { utilization: 90, resets_at: at(-1 * DAY) } }, true), "weekly  ▱▱▱▱▱▱▱▱▱▱   ?% ⟳ 6d left");
  assertEquals(render({ seven_day: { utilization: 31 } }, true), "weekly  ▰▰▰▱▱▱▱▱▱▱  31% ⟳ ");
  assertEquals(render({}, true), "weekly  ▱▱▱▱▱▱▱▱▱▱   0% ⟳ ");
});

// ── forecast ─────────────────────────────────────────

Deno.test("usageItem forecast: runs out before the reset", () => {
  // 2 days into the week with 40% used.
  const out = render({ seven_day: { utilization: 40, resets_at: at(5 * DAY) } }, false, true);
  assertEquals(
    out,
    ["weekly  ▰▰▰▰▱▱▱▱▱▱  40% ⟳ 5d left", "forecast runs out in 3d, 2d before reset"].join("\n"),
  );
});

Deno.test("usageItem forecast: lasts until the reset", () => {
  const out = render({ seven_day: { utilization: 20, resets_at: at(5 * DAY) } }, false, true);
  assertEquals(
    out,
    ["weekly  ▰▰▱▱▱▱▱▱▱▱  20% ⟳ 5d left", "forecast lasts until reset (~70% at reset)"].join("\n"),
  );
});

Deno.test("usageItem forecast: with pace, and before the stale and extra lines", () => {
  const out = render({
    seven_day: { utilization: 40, resets_at: at(5 * DAY) },
    extra_usage: { is_enabled: true, utilization: 10, used_credits: 500, monthly_limit: 5000 },
  }, true, true);
  assertEquals(
    out,
    [
      "weekly  ▰▰▰▰▱▱▱▱▱▱  40% (+11pt ahead) ⟳ 5d left",
      "forecast runs out in 3d, 2d before reset",
      "extra   ▰▱▱▱▱▱▱▱▱▱ $5.00/$50.00",
      "resets Dec 1",
    ].join("\n"),
  );
});

Deno.test("usageItem forecast: no line in the first 24 hours or when off", () => {
  const data = { seven_day: { utilization: 30, resets_at: at(6 * DAY + 2 * HOUR) } };
  assertEquals(render(data, false, true), "weekly  ▰▰▰▱▱▱▱▱▱▱  30% ⟳ 6d 2h left");
  assertEquals(render({ seven_day: { utilization: 40, resets_at: at(5 * DAY) } }), "weekly  ▰▰▰▰▱▱▱▱▱▱  40% ⟳ 5d left");
});

// ── today ────────────────────────────────────────────

// Resets 4 days after the start of today in local time, so the budget does not depend on the time zone.
const resetIn4Days = () => new Date(startOfLocalDay(NOW) + 4 * DAY).toISOString();
const lastLine = (s: string | null) => s?.split("\n").at(-1);

Deno.test("usageItem today: usage against the daily budget", () => {
  const out = render({ seven_day: { utilization: 29, resets_at: resetIn4Days() } }, false, false, 20);
  assertEquals(lastLine(out), "today   ▰▰▰▰▰▱▱▱▱▱ +9pt of 20.0pt budget");
});

Deno.test("usageItem today: over budget fills the bar", () => {
  const out = render({ seven_day: { utilization: 50, resets_at: resetIn4Days() } }, false, false, 20);
  assertEquals(lastLine(out), "today   ▰▰▰▰▰▰▰▰▰▰ +30pt of 20.0pt budget");
});

Deno.test("usageItem today: after the forecast line", () => {
  // Midday, 2 days into the week with 40% used; started the day at 30%.
  const out = render({ seven_day: { utilization: 40, resets_at: at(5 * DAY) } }, false, true, 30);
  const lines = out?.split("\n") ?? [];
  assertEquals(lines.length, 3);
  assertEquals(lines[1], "forecast runs out in 3d, 2d before reset");
  assertEquals(lines[2].startsWith("today   "), true);
});

Deno.test("usageItem today: no line without a baseline", () => {
  const out = render({ seven_day: { utilization: 29, resets_at: resetIn4Days() } });
  assertEquals(out?.split("\n").length, 1);
});
