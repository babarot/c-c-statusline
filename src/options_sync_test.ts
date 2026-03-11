import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OPTION_DEFAULTS } from "./config.ts";

const optionKeys = Object.keys(OPTION_DEFAULTS);

// git-symbols is a special case — it's a value flag in installers and parseArgs,
// but not in OPTION_DEFAULTS (handled separately). Include it in checks.
const allFlags = [...optionKeys, "git-symbols"];

async function readFile(path: string): Promise<string> {
  return await Deno.readTextFile(new URL(path, import.meta.url));
}

// ── main.ts: parseArgs string list ──────────────────────
Deno.test("main.ts parseArgs includes all option flags", async () => {
  const src = await readFile("./main.ts");
  const match = src.match(/string:\s*\[([^\]]+)\]/);
  if (!match) throw new Error("Could not find parseArgs string array in main.ts");
  const parsed = match[1];
  for (const key of allFlags) {
    assertEquals(parsed.includes(`"${key}"`), true, `parseArgs missing "${key}"`);
  }
});

// ── main.ts: help text ──────────────────────────────────
Deno.test("main.ts help text includes all option flags", async () => {
  const src = await readFile("./main.ts");
  for (const key of allFlags) {
    assertEquals(src.includes(`--${key}`), true, `help text missing "--${key}"`);
  }
});

// ── install.sh: help text and case pattern ──────────────
Deno.test("install.sh help text includes all option flags", async () => {
  const src = await readFile("../bin/install.sh");
  for (const key of allFlags) {
    assertEquals(src.includes(`--${key}`), true, `install.sh help missing "--${key}"`);
  }
});

Deno.test("install.sh case pattern includes all value flags", async () => {
  const src = await readFile("../bin/install.sh");
  const match = src.match(/--bar-style\|[^)]+\)/);
  if (!match) throw new Error("Could not find case pattern in install.sh");
  const pattern = match[0];
  for (const key of allFlags) {
    assertEquals(pattern.includes(`--${key}`), true, `install.sh case pattern missing "--${key}"`);
  }
});

// ── install.ts: help text and valueFlags ────────────────
Deno.test("install.ts help text includes all option flags", async () => {
  const src = await readFile("../bin/install.ts");
  for (const key of allFlags) {
    assertEquals(src.includes(`--${key}`), true, `install.ts help missing "--${key}"`);
  }
});

Deno.test("install.ts valueFlags includes all value flags", async () => {
  const src = await readFile("../bin/install.ts");
  const match = src.match(/valueFlags\s*=\s*new Set\(\[([^\]]+)\]\)/);
  if (!match) throw new Error("Could not find valueFlags in install.ts");
  const flags = match[1];
  for (const key of allFlags) {
    assertEquals(flags.includes(`"--${key}"`), true, `install.ts valueFlags missing "--${key}"`);
  }
});

// ── install.js: help text and valueFlags ────────────────
Deno.test("install.js help text includes all option flags", async () => {
  const src = await readFile("../bin/install.js");
  for (const key of allFlags) {
    assertEquals(src.includes(`--${key}`), true, `install.js help missing "--${key}"`);
  }
});

Deno.test("install.js valueFlags includes all value flags", async () => {
  const src = await readFile("../bin/install.js");
  const match = src.match(/valueFlags\s*=\s*\[([^\]]+)\]/);
  if (!match) throw new Error("Could not find valueFlags in install.js");
  const flags = match[1];
  for (const key of allFlags) {
    assertEquals(flags.includes(`"--${key}"`), true, `install.js valueFlags missing "--${key}"`);
  }
});
