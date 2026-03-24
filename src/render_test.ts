import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGitSymbols, defaultGitSymbols } from "./git.ts";
import { convertStdinRateLimits } from "./render.ts";

// ── parseGitSymbols ──────────────────────────────────

Deno.test("parseGitSymbols: parses single pair", () => {
  assertEquals(parseGitSymbols("unstaged=!"), { unstaged: "!" });
});

Deno.test("parseGitSymbols: parses multiple pairs", () => {
  const result = parseGitSymbols("unstaged=!,staged=+,ahead=⬆");
  assertEquals(result, { unstaged: "!", staged: "+", ahead: "⬆" });
});

Deno.test("parseGitSymbols: ignores unknown keys", () => {
  const result = parseGitSymbols("unknown=x,unstaged=!");
  assertEquals(result, { unstaged: "!" });
});

Deno.test("parseGitSymbols: handles empty string", () => {
  assertEquals(parseGitSymbols(""), {});
});

Deno.test("parseGitSymbols: handles malformed input without =", () => {
  assertEquals(parseGitSymbols("noequals"), {});
});

Deno.test("parseGitSymbols: allows empty value", () => {
  assertEquals(parseGitSymbols("unstaged="), { unstaged: "" });
});

Deno.test("parseGitSymbols: handles value with = in it", () => {
  // split("=", 2) should keep only first =
  assertEquals(parseGitSymbols("unstaged=a=b"), { unstaged: "a" });
});

// ── convertStdinRateLimits ────────────────────────────

Deno.test("convertStdinRateLimits: converts both windows", () => {
  const result = convertStdinRateLimits({
    five_hour: { used_percentage: 42.5, resets_at: 1738425600 },
    seven_day: { used_percentage: 15.0, resets_at: 1738857600 },
  });
  assertEquals(result.five_hour?.utilization, 42.5);
  assertEquals(result.five_hour?.resets_at, "2025-02-01T16:00:00.000Z");
  assertEquals(result.seven_day?.utilization, 15.0);
  assertEquals(result.seven_day?.resets_at, "2025-02-06T16:00:00.000Z");
  assertEquals(result.extra_usage, undefined);
});

Deno.test("convertStdinRateLimits: handles missing windows", () => {
  const result = convertStdinRateLimits({});
  assertEquals(result.five_hour, undefined);
  assertEquals(result.seven_day, undefined);
});

Deno.test("convertStdinRateLimits: handles partial data", () => {
  const result = convertStdinRateLimits({
    five_hour: { used_percentage: 10 },
  });
  assertEquals(result.five_hour?.utilization, 10);
  assertEquals(result.five_hour?.resets_at, undefined);
  assertEquals(result.seven_day, undefined);
});

// ── defaultGitSymbols ────────────────────────────────

Deno.test("defaultGitSymbols has all required keys", () => {
  assertEquals(defaultGitSymbols.unstaged, "*");
  assertEquals(defaultGitSymbols.staged, "+");
  assertEquals(defaultGitSymbols.stash, "$");
  assertEquals(defaultGitSymbols.untracked, "%");
  assertEquals(defaultGitSymbols.ahead, "↑");
  assertEquals(defaultGitSymbols.behind, "↓");
});
