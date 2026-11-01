import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { usageItem } from "./usage.ts";
import type { RenderContext } from "./types.ts";
import type { UsageData } from "../usage.ts";

// deno-lint-ignore no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

// Mid-month, so the extra usage reset ("Dec 1") is the same in every time zone.
const NOW = Date.parse("2026-11-15T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function render(usageData: UsageData | null): string | null {
  const ctx = {
    now: NOW,
    usageData,
    options: { barStyle: "block", timeStyle: "relative" },
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

Deno.test("usageItem: missing 5-hour window renders as 0% with no reset", () => {
  const out = render({
    seven_day: { utilization: 31, resets_at: at(6 * DAY + 11 * HOUR) },
  });
  assertEquals(
    out,
    [
      "current ▱▱▱▱▱▱▱▱▱▱   0% ⟳ ",
      "weekly  ▰▰▰▱▱▱▱▱▱▱  31% ⟳ 6d 11h left",
    ].join("\n"),
  );
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
