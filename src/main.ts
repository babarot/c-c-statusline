import { parseArgs } from "@std/cli/parse-args";
import { VERSION } from "./version.ts";
import { setTheme } from "./colors.ts";
import { themeNames } from "./themes.ts";
import { renderStatusLine, defaultGitSymbols, parseGitSymbols } from "./render.ts";
import { loadConfig, generateConfig, resolveGitSymbolsFromConfig, type OptionDefaults } from "./config.ts";

const DEFAULTS: OptionDefaults = {
  "bar-style": "dot",
  "path-style": "parent",
  "theme": "default",
  "time-style": "absolute",
  "ctx-format": "ctx {used}/{total} ({pct}%)",
};

const config = await loadConfig();
const opts = config.options ?? {};

// Config file values override built-in defaults; CLI flags override both.
const mergedDefaults: Record<string, string> = { ...DEFAULTS, "git-symbols": "" };
for (const key of Object.keys(DEFAULTS)) {
  const configVal = opts[key as keyof OptionDefaults];
  if (configVal !== undefined && configVal !== null) {
    mergedDefaults[key] = String(configVal);
  }
}
// If config has git-symbols as string, pass it through to CLI defaults
if (typeof opts["git-symbols"] === "string") {
  mergedDefaults["git-symbols"] = opts["git-symbols"];
}

const args = parseArgs(Deno.args, {
  boolean: ["help", "version", "debug", "init"],
  string: ["bar-style", "path-style", "theme", "time-style", "ctx-format", "git-symbols"],
  default: mergedDefaults,
  alias: { h: "help", v: "version" },
});

if (args.init) {
  await generateConfig(DEFAULTS);
  Deno.exit(0);
}

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
  --init                                    Generate ~/.claude/statusline.yaml with defaults
  -h, --help                                Show this help
  -v, --version                             Show version

Config file:
  ~/.claude/statusline.yaml — YAML config loaded as defaults.
  CLI flags override config values. Generate with --init.

  Example (~/.claude/statusline.yaml):
    options:
      bar-style: block
      path-style: short
      theme: tokyo-night-storm
      time-style: relative
      git-symbols:
        stash: "-"
        untracked: "?"

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

setTheme(args.theme as string);

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

// Merge: defaults → config YAML map → CLI flag string
const configGitSymbols = resolveGitSymbolsFromConfig(config);
const cliGitSymbols = parseGitSymbols(args["git-symbols"] as string);
const gitSymbols = { ...defaultGitSymbols, ...configGitSymbols, ...cliGitSymbols };

const output = await renderStatusLine(data, {
  barStyle: args["bar-style"] as string,
  pathStyle: args["path-style"] as string,
  timeStyle: args["time-style"] as "absolute" | "relative",
  ctxFormat: args["ctx-format"] as string,
  gitSymbols,
});

console.log(output);
