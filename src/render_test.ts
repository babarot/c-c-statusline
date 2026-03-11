import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGitSymbols, defaultGitSymbols } from "./render.ts";

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

// ── defaultGitSymbols ────────────────────────────────

Deno.test("defaultGitSymbols has all required keys", () => {
  assertEquals(defaultGitSymbols.unstaged, "*");
  assertEquals(defaultGitSymbols.staged, "+");
  assertEquals(defaultGitSymbols.stash, "$");
  assertEquals(defaultGitSymbols.untracked, "%");
  assertEquals(defaultGitSymbols.ahead, "↑");
  assertEquals(defaultGitSymbols.behind, "↓");
});
