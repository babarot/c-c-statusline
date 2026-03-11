import { parseArgs } from "@std/cli/parse-args";
import { VERSION } from "./version.ts";
import { setTheme } from "./colors.ts";
import { themeNames } from "./themes.ts";
import { renderStatusLine } from "./render.ts";

const args = parseArgs(Deno.args, {
  boolean: ["help", "version"],
  string: ["bar-style", "path-style", "theme", "time-style", "ctx-label"],
  default: { "bar-style": "dot", "path-style": "parent", "theme": "default", "time-style": "absolute", "ctx-label": "ctx" },
  alias: { h: "help", v: "version" },
});

if (args.help) {
  console.log(`c-c-statusline v${VERSION}

A Deno-powered status line for Claude Code CLI.

Usage:
  Pipe Claude Code JSON into stdin:
    echo '{"model":...}' | c-c-statusline [options]

Options:
  --bar-style <dot|block|fill>              Bar style (default: dot)
  --path-style <parent|full|short|basename> Path style (default: parent)
  --theme <name>                            Color theme (default: default)
  --time-style <absolute|relative>          Reset time format (default: absolute)
  --ctx-label <ctx|unicode|minimal>        Context window label (default: ctx)
  -h, --help                                Show this help
  -v, --version                             Show version

Themes: ${themeNames.join(", ")}`);
  Deno.exit(0);
}

if (args.version) {
  console.log(VERSION);
  Deno.exit(0);
}

// Read stdin
const buf = new Uint8Array(65536);
const chunks: Uint8Array[] = [];

while (true) {
  const n = await Deno.stdin.read(buf);
  if (n === null) break;
  chunks.push(buf.slice(0, n));
}

const rawInput = new TextDecoder().decode(
  chunks.length === 1
    ? chunks[0]
    : new Uint8Array(chunks.reduce((a, c) => [...a, ...c], [] as number[])),
);

if (!rawInput.trim()) {
  console.log("Claude");
  Deno.exit(0);
}

setTheme(args.theme);

let data: Record<string, unknown>;
try {
  data = JSON.parse(rawInput);
} catch {
  console.log("Claude");
  Deno.exit(0);
}

const output = await renderStatusLine(data, {
  barStyle: args["bar-style"],
  pathStyle: args["path-style"],
  timeStyle: args["time-style"] as "absolute" | "relative",
  ctxLabel: args["ctx-label"] as "ctx" | "unicode" | "minimal",
});

console.log(output);
