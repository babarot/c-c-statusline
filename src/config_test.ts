import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveGitSymbolsFromConfig, type Config } from "./config.ts";

Deno.test("resolveGitSymbolsFromConfig: returns empty for no config", () => {
  assertEquals(resolveGitSymbolsFromConfig({}), {});
});

Deno.test("resolveGitSymbolsFromConfig: returns empty for no git-symbols", () => {
  const config: Config = { options: { "bar-style": "dot" } };
  assertEquals(resolveGitSymbolsFromConfig(config), {});
});

Deno.test("resolveGitSymbolsFromConfig: parses object symbols", () => {
  const config: Config = {
    options: {
      "git-symbols": {
        unstaged: "!",
        staged: "✓",
      },
    },
  };
  assertEquals(resolveGitSymbolsFromConfig(config), {
    unstaged: "!",
    staged: "✓",
  });
});

Deno.test("resolveGitSymbolsFromConfig: ignores unknown keys in object", () => {
  const config: Config = {
    options: {
      "git-symbols": {
        unstaged: "!",
        invalid: "x",
      } as Record<string, string>,
    },
  };
  assertEquals(resolveGitSymbolsFromConfig(config), { unstaged: "!" });
});

Deno.test("resolveGitSymbolsFromConfig: converts non-string values to string", () => {
  const config: Config = {
    options: {
      "git-symbols": {
        ahead: 42,
      } as unknown as Record<string, string>,
    },
  };
  assertEquals(resolveGitSymbolsFromConfig(config), { ahead: "42" });
});

Deno.test("resolveGitSymbolsFromConfig: returns empty for string input", () => {
  // The function only handles object, not string format
  const config: Config = {
    options: {
      "git-symbols": "unstaged=!" as unknown as Record<string, string>,
    },
  };
  assertEquals(resolveGitSymbolsFromConfig(config), {});
});
