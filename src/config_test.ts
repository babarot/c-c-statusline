import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveGitSymbolsFromConfig, resolveLines, DEFAULT_LINES, KNOWN_ITEMS, type Config, type FullConfig } from "./config.ts";

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

// ── resolveLines ────────────────────────────────────────

Deno.test("resolveLines: returns DEFAULT_LINES when no lines in config", () => {
  assertEquals(resolveLines({}), DEFAULT_LINES);
});

Deno.test("resolveLines: returns DEFAULT_LINES when lines is undefined", () => {
  const config: FullConfig = { theme: "default" };
  assertEquals(resolveLines(config), DEFAULT_LINES);
});

Deno.test("resolveLines: uses custom lines from config", () => {
  const config: FullConfig = {
    lines: [
      ["git", "model"],
      ["usage"],
    ],
  };
  assertEquals(resolveLines(config), [["git", "model"], ["usage"]]);
});

Deno.test("resolveLines: filters out unknown item IDs", () => {
  const config: FullConfig = {
    lines: [
      ["model", "unknown_item", "git"],
      ["usage", "fake"],
    ],
  };
  assertEquals(resolveLines(config), [["model", "git"], ["usage"]]);
});

Deno.test("resolveLines: handles empty lines array", () => {
  const config: FullConfig = { lines: [] };
  assertEquals(resolveLines(config), []);
});

Deno.test("resolveLines: handles single line with all items", () => {
  const config: FullConfig = {
    lines: [["model", "context", "git", "duration", "effort", "vim", "update", "usage"]],
  };
  assertEquals(resolveLines(config), [["model", "context", "git", "duration", "effort", "vim", "update", "usage"]]);
});

// ── DEFAULT_LINES & KNOWN_ITEMS ─────────────────────────

Deno.test("DEFAULT_LINES contains only known items", () => {
  for (const line of DEFAULT_LINES) {
    for (const id of line) {
      assertEquals(KNOWN_ITEMS.has(id), true, `DEFAULT_LINES contains unknown item "${id}"`);
    }
  }
});

Deno.test("KNOWN_ITEMS covers all items in DEFAULT_LINES", () => {
  const allIds = new Set(DEFAULT_LINES.flat());
  for (const id of allIds) {
    assertEquals(KNOWN_ITEMS.has(id), true, `Item "${id}" not in KNOWN_ITEMS`);
  }
});

// ── resolveGitLinkFromItems ────────────────────────────

import { DEFAULT_GIT_LINK, resolveGitLinkFromItems, type ItemsConfig } from "./config.ts";

Deno.test("resolveGitLinkFromItems: returns defaults when no link config", () => {
  assertEquals(resolveGitLinkFromItems({}), DEFAULT_GIT_LINK);
});

Deno.test("resolveGitLinkFromItems: returns defaults when git section has no link", () => {
  const items: ItemsConfig = { git: { "path-style": "parent" } };
  assertEquals(resolveGitLinkFromItems(items), DEFAULT_GIT_LINK);
});

Deno.test("resolveGitLinkFromItems: reads enabled only, fills defaults elsewhere", () => {
  const items: ItemsConfig = { git: { link: { enabled: true } } };
  assertEquals(resolveGitLinkFromItems(items), {
    enabled: true,
    template: DEFAULT_GIT_LINK.template,
    remote: DEFAULT_GIT_LINK.remote,
  });
});

Deno.test("resolveGitLinkFromItems: full override", () => {
  const items: ItemsConfig = {
    git: {
      link: {
        enabled: true,
        template: "https://gitlab.example/{owner}/{repo}/-/tree/{branch}",
        remote: "upstream",
      },
    },
  };
  assertEquals(resolveGitLinkFromItems(items), {
    enabled: true,
    template: "https://gitlab.example/{owner}/{repo}/-/tree/{branch}",
    remote: "upstream",
  });
});

Deno.test("resolveGitLinkFromItems: empty template falls back to default", () => {
  const items: ItemsConfig = {
    git: { link: { enabled: true, template: "" } },
  };
  assertEquals(resolveGitLinkFromItems(items).template, DEFAULT_GIT_LINK.template);
});

Deno.test("resolveGitLinkFromItems: empty remote falls back to default", () => {
  const items: ItemsConfig = {
    git: { link: { enabled: true, remote: "" } },
  };
  assertEquals(resolveGitLinkFromItems(items).remote, DEFAULT_GIT_LINK.remote);
});
