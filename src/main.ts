import { parseArgs } from "@std/cli/parse-args";
import { VERSION } from "./version.ts";
import { setTheme } from "./colors.ts";
import { themeNames } from "./themes.ts";
import { renderStatusLine, defaultGitSymbols, parseGitSymbols } from "./render.ts";

const args = parseArgs(Deno.args, {
  boolean: ["help", "version", "debug"],
  string: ["bar-style", "path-style", "theme", "time-style", "ctx-format", "git-symbols"],
  default: { "bar-style": "dot", "path-style": "parent", "theme": "default", "time-style": "absolute", "ctx-format": "ctx {used}/{total} ({pct}%)", "git-symbols": "" },
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
  --ctx-format <format>                    Context format with placeholders (default: "ctx {used}/{total} ({pct}%)")
                                            Placeholders: {used}, {total}, {pct}
  --git-symbols <key=val,...>               Override git symbols (default: unstaged=*,staged=+,stash=$,untracked=%,ahead=↑,behind=↓)
                                            Example: --git-symbols "stash=-,untracked=?"
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

// Debug: dump raw JSON to file if --debug is set
if (args.debug) {
  const home = Deno.env.get("HOME") ?? "/tmp";
  await Deno.writeTextFile(`${home}/.claude/statusline-debug.json`, rawInput);
}

let data: Record<string, unknown>;
try {
  data = JSON.parse(rawInput);
} catch {
  console.log("Claude");
  Deno.exit(0);
}

const gitSymbols = { ...defaultGitSymbols, ...parseGitSymbols(args["git-symbols"]) };

const output = await renderStatusLine(data, {
  barStyle: args["bar-style"],
  pathStyle: args["path-style"],
  timeStyle: args["time-style"] as "absolute" | "relative",
  ctxFormat: args["ctx-format"],
  gitSymbols,
});

console.log(output);
