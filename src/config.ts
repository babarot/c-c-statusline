import { parse, stringify } from "@std/yaml";
import { type GitSymbols, defaultGitSymbols } from "./git.ts";

// ── Legacy config types (backward compat) ──────────────

export interface OptionsConfig {
  "bar-style"?: string;
  "path-style"?: string;
  theme?: string;
  "time-style"?: string;
  "ctx-format"?: string;
  "vim-mode"?: string;
  "model-name"?: string;
  "git-symbols"?: Partial<GitSymbols> | string;
}

/** @deprecated Use FullConfig instead. Kept for test compat. */
export interface Config {
  options?: OptionsConfig;
}

// ── New config types ───────────────────────────────────

export interface ItemsConfig {
  context?: { format?: string };
  git?: { "path-style"?: string; symbols?: Partial<GitSymbols> };
  vim?: { mode?: string };
  usage?: { "bar-style"?: string; "time-style"?: string };
  [key: string]: unknown;
}

export interface FullConfig {
  theme?: string;
  lines?: string[][];
  items?: ItemsConfig;
  /** Legacy flat options (takes precedence over items if both present). */
  options?: OptionsConfig;
}

export const DEFAULT_LINES: string[][] = [
  ["model", "context", "git", "duration", "effort", "vim", "update"],
  ["usage"],
];

/** All known item IDs. */
export const KNOWN_ITEMS = new Set([
  "model", "context", "git", "duration", "effort", "vim", "update", "usage",
]);

// ── Config path ────────────────────────────────────────

const CONFIG_FILENAME = "statusline.yaml";

function getConfigPath(): string {
  const home = Deno.env.get("HOME") ?? "";
  return `${home}/.claude/${CONFIG_FILENAME}`;
}

export const CONFIG_PATH = getConfigPath();

// ── Config loading ─────────────────────────────────────

export async function loadConfig(): Promise<FullConfig> {
  try {
    const text = await Deno.readTextFile(CONFIG_PATH);
    const parsed = parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed as FullConfig;
    }
    return {};
  } catch {
    return {};
  }
}

// ── Lines resolution ───────────────────────────────────

export function resolveLines(config: FullConfig): string[][] {
  if (config.lines && Array.isArray(config.lines)) {
    // Filter out unknown item IDs
    return config.lines.map(
      (line) => line.filter((id) => KNOWN_ITEMS.has(id)),
    );
  }
  return DEFAULT_LINES;
}

// ── Option defaults ────────────────────────────────────

export interface OptionDefaults {
  "bar-style": string;
  "path-style": string;
  theme: string;
  "time-style": string;
  "ctx-format": string;
  "vim-mode": string;
  "model-name": string;
}

export const OPTION_DEFAULTS: OptionDefaults = {
  "bar-style": "dot",
  "path-style": "parent",
  "theme": "default",
  "time-style": "absolute",
  "ctx-format": "ctx {used}/{total} ({pct}%)",
  "vim-mode": "auto",
  "model-name": "on",
};

// ── Git symbols from config ────────────────────────────

export function resolveGitSymbolsFromConfig(config: Config): Partial<GitSymbols> {
  const raw = config.options?.["git-symbols"];
  if (!raw) return {};
  if (typeof raw === "object") {
    const result: Partial<GitSymbols> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (key in defaultGitSymbols) {
        result[key as keyof GitSymbols] = String(val);
      }
    }
    return result;
  }
  return {};
}

function resolveGitSymbolsFromItems(items: ItemsConfig): Partial<GitSymbols> {
  const raw = items.git?.symbols;
  if (!raw || typeof raw !== "object") return {};
  const result: Partial<GitSymbols> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key in defaultGitSymbols) {
      result[key as keyof GitSymbols] = String(val);
    }
  }
  return result;
}

// ── Merge defaults ─────────────────────────────────────

export interface MergedConfig {
  defaults: Record<string, string>;
  configGitSymbols: Partial<GitSymbols>;
  lines: string[][];
}

export async function mergeDefaults(): Promise<MergedConfig> {
  const config = await loadConfig();
  const items = config.items ?? {};
  const opts = config.options ?? {};

  const defaults: Record<string, string> = { ...OPTION_DEFAULTS, "git-symbols": "" };

  // Apply new items config first
  if (items.usage?.["bar-style"]) defaults["bar-style"] = String(items.usage["bar-style"]);
  if (items.usage?.["time-style"]) defaults["time-style"] = String(items.usage["time-style"]);
  if (items.git?.["path-style"]) defaults["path-style"] = String(items.git["path-style"]);
  if (items.context?.format) defaults["ctx-format"] = String(items.context.format);
  if (items.vim?.mode) defaults["vim-mode"] = String(items.vim.mode);

  // Apply theme from top-level or legacy
  if (config.theme) defaults["theme"] = String(config.theme);

  // Apply legacy options (overrides items if both present)
  for (const key of Object.keys(OPTION_DEFAULTS)) {
    const configVal = opts[key as keyof OptionDefaults];
    if (configVal !== undefined && configVal !== null) {
      defaults[key] = String(configVal);
    }
  }
  if (typeof opts["git-symbols"] === "string") {
    defaults["git-symbols"] = opts["git-symbols"];
  }

  // Git symbols: items config, then legacy overrides
  let configGitSymbols = resolveGitSymbolsFromItems(items);
  const legacySymbols = resolveGitSymbolsFromConfig({ options: opts });
  if (Object.keys(legacySymbols).length > 0) {
    configGitSymbols = { ...configGitSymbols, ...legacySymbols };
  }

  // Lines
  const lines = resolveLines(config);

  return { defaults, configGitSymbols, lines };
}

// ── Config generation ──────────────────────────────────

export async function generateConfig(defaults: OptionDefaults): Promise<void> {
  try {
    await Deno.stat(CONFIG_PATH);
    console.error(`Already exists: ${CONFIG_PATH}`);
    Deno.exit(1);
  } catch {
    // File doesn't exist — proceed
  }

  const config = {
    theme: defaults.theme,
    lines: DEFAULT_LINES,
    items: {
      context: {
        format: defaults["ctx-format"],
      },
      git: {
        "path-style": defaults["path-style"],
        // symbols: { unstaged: "*", staged: "+", ... }
      },
      vim: {
        mode: defaults["vim-mode"],
      },
      usage: {
        "bar-style": defaults["bar-style"],
        "time-style": defaults["time-style"],
      },
    },
  };

  const yaml = stringify(config, { lineWidth: -1 });
  const gitSymbolsComment = [
    "    # symbols:",
    `    #   unstaged: "${defaultGitSymbols.unstaged}"`,
    `    #   staged: "${defaultGitSymbols.staged}"`,
    `    #   stash: "${defaultGitSymbols.stash}"`,
    `    #   untracked: "${defaultGitSymbols.untracked}"`,
    `    #   ahead: "${defaultGitSymbols.ahead}"`,
    `    #   behind: "${defaultGitSymbols.behind}"`,
    "",
  ].join("\n");

  // Insert git symbols comment after the git section's path-style line
  const lines = yaml.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    result.push(line);
    if (line.trim().startsWith("path-style:")) {
      result.push(gitSymbolsComment);
    }
  }

  await Deno.writeTextFile(CONFIG_PATH, result.join("\n"));
  console.log(`Created ${CONFIG_PATH}`);
}
