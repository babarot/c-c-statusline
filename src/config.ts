import { parse, stringify } from "@std/yaml";
import { type GitSymbols, defaultGitSymbols } from "./git.ts";

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

export interface Config {
  options?: OptionsConfig;
}

const CONFIG_FILENAME = "statusline.yaml";

function getConfigPath(): string {
  const home = Deno.env.get("HOME") ?? "";
  return `${home}/.claude/${CONFIG_FILENAME}`;
}

export const CONFIG_PATH = getConfigPath();

export async function loadConfig(): Promise<Config> {
  try {
    const text = await Deno.readTextFile(CONFIG_PATH);
    const parsed = parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed as Config;
    }
    return {};
  } catch {
    return {};
  }
}

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

export interface MergedConfig {
  defaults: Record<string, string>;
  configGitSymbols: Partial<GitSymbols>;
}

export async function mergeDefaults(): Promise<MergedConfig> {
  const config = await loadConfig();
  const opts = config.options ?? {};
  const defaults: Record<string, string> = { ...OPTION_DEFAULTS, "git-symbols": "" };
  for (const key of Object.keys(OPTION_DEFAULTS)) {
    const configVal = opts[key as keyof OptionDefaults];
    if (configVal !== undefined && configVal !== null) {
      defaults[key] = String(configVal);
    }
  }
  if (typeof opts["git-symbols"] === "string") {
    defaults["git-symbols"] = opts["git-symbols"];
  }
  return { defaults, configGitSymbols: resolveGitSymbolsFromConfig(config) };
}

export async function generateConfig(defaults: OptionDefaults): Promise<void> {
  try {
    await Deno.stat(CONFIG_PATH);
    console.error(`Already exists: ${CONFIG_PATH}`);
    Deno.exit(1);
  } catch {
    // File doesn't exist — proceed
  }

  const config = {
    options: {
      "bar-style": defaults["bar-style"],
      "path-style": defaults["path-style"],
      "theme": defaults.theme,
      "time-style": defaults["time-style"],
      "ctx-format": defaults["ctx-format"],
      "vim-mode": defaults["vim-mode"],
      "model-name": defaults["model-name"],
    },
  };

  const yaml = stringify(config, { lineWidth: -1 });
  const gitSymbolsComment = [
    "  # git-symbols:",
    `  #   unstaged: "${defaultGitSymbols.unstaged}"`,
    `  #   staged: "${defaultGitSymbols.staged}"`,
    `  #   stash: "${defaultGitSymbols.stash}"`,
    `  #   untracked: "${defaultGitSymbols.untracked}"`,
    `  #   ahead: "${defaultGitSymbols.ahead}"`,
    `  #   behind: "${defaultGitSymbols.behind}"`,
    "",
  ].join("\n");

  await Deno.writeTextFile(CONFIG_PATH, yaml + gitSymbolsComment);
  console.log(`Created ${CONFIG_PATH}`);
}
