#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run --allow-net

import { rgb24 } from "jsr:@std/fmt@1/colors";

const blue = (s: string) => rgb24(s, 0x0099ff);
const green = (s: string) => rgb24(s, 0x00af50);
const red = (s: string) => rgb24(s, 0xff5555);
const yellow = (s: string) => rgb24(s, 0xe6c800);
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;

const log = (msg: string) => console.log(`  ${msg}`);
const success = (msg: string) => console.log(`  ${green("✓")} ${msg}`);
const warn = (msg: string) => console.log(`  ${yellow("!")} ${msg}`);
const fail = (msg: string) => console.error(`  ${red("✗")} ${msg}`);

const HOME = Deno.env.get("HOME") ?? "";
const CLAUDE_DIR = `${HOME}/.claude`;
const SETTINGS_FILE = `${CLAUDE_DIR}/settings.json`;
const BINARY_NAME = "c-c-statusline";
const BINARY_DEST = `${CLAUDE_DIR}/${BINARY_NAME}`;
const REPO = "babarot/c-c-statusline";

function detectPlatform(): { os: string; arch: string; asset: string } | null {
  const os = Deno.build.os;
  const arch = Deno.build.arch;

  const map: Record<string, Record<string, string>> = {
    darwin: {
      aarch64: `${BINARY_NAME}-darwin-arm64`,
      x86_64: `${BINARY_NAME}-darwin-x86_64`,
    },
    linux: {
      aarch64: `${BINARY_NAME}-linux-arm64`,
      x86_64: `${BINARY_NAME}-linux-x86_64`,
    },
  };

  const asset = map[os]?.[arch];
  if (!asset) return null;
  return { os, arch, asset };
}

async function getLatestRelease(): Promise<{ tag: string; assets: Record<string, string> }> {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    { headers: { Accept: "application/vnd.github.v3+json" } },
  );
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
  const data = await resp.json();

  const assets: Record<string, string> = {};
  for (const asset of data.assets) {
    assets[asset.name] = asset.browser_download_url;
  }
  return { tag: data.tag_name, assets };
}

async function downloadAndVerify(url: string, checksumUrl: string, assetName: string): Promise<Uint8Array> {
  // Download binary
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const binary = new Uint8Array(await resp.arrayBuffer());

  // Download checksums
  const csResp = await fetch(checksumUrl);
  if (!csResp.ok) {
    warn("Checksum file not found, skipping verification");
    return binary;
  }
  const checksumText = await csResp.text();

  // Find expected checksum
  const line = checksumText.split("\n").find((l) => l.includes(assetName));
  if (!line) {
    warn("Checksum entry not found, skipping verification");
    return binary;
  }
  const expectedHash = line.split(/\s+/)[0];

  // Verify
  const hashBuffer = await crypto.subtle.digest("SHA-256", binary);
  const actualHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (actualHash !== expectedHash) {
    throw new Error(`Checksum mismatch!\n  expected: ${expectedHash}\n  actual:   ${actualHash}`);
  }

  return binary;
}

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await Deno.readTextFile(SETTINGS_FILE));
  } catch {
    return {};
  }
}

async function writeSettings(settings: Record<string, unknown>) {
  await Deno.writeTextFile(
    SETTINGS_FILE,
    JSON.stringify(settings, null, 2) + "\n",
  );
}

async function uninstall() {
  console.log();
  console.log(`  ${blue("Claude Code Statusline Uninstaller")}`);
  console.log(`  ${dim("──────────────────────────────────")}`);
  console.log();

  const backup = BINARY_DEST + ".bak";

  try {
    await Deno.stat(backup);
    await Deno.rename(backup, BINARY_DEST);
    success(`Restored previous statusline from ${dim("backup")}`);
  } catch {
    try {
      await Deno.stat(BINARY_DEST);
      await Deno.remove(BINARY_DEST);
      success(`Removed ${dim(BINARY_NAME)}`);
    } catch {
      warn("No statusline binary found — nothing to remove");
    }
  }

  // Also try to clean up old statusline.ts
  try {
    await Deno.stat(`${CLAUDE_DIR}/statusline.ts`);
    await Deno.remove(`${CLAUDE_DIR}/statusline.ts`);
    success(`Removed old ${dim("statusline.ts")}`);
  } catch { /* not present */ }

  try {
    const settings = await readSettings();
    if (settings.statusLine) {
      delete settings.statusLine;
      await writeSettings(settings);
      success(`Removed statusLine from ${dim("settings.json")}`);
    } else {
      success("Settings already clean");
    }
  } catch {
    fail(`Could not parse ${SETTINGS_FILE} — fix it manually`);
    Deno.exit(1);
  }

  console.log();
  log(`${green("Done!")} Restart Claude Code to apply changes.`);
  console.log();
}

async function install(extraArgs: string[], initConfig: boolean) {
  console.log();
  console.log(`  ${blue("Claude Code Statusline Installer")}`);
  console.log(`  ${dim("────────────────────────────────")}`);
  console.log();

  // Detect platform
  const platform = detectPlatform();
  if (!platform) {
    fail(`Unsupported platform: ${Deno.build.os} ${Deno.build.arch}`);
    Deno.exit(1);
  }
  success(`Platform: ${platform.os}/${platform.arch}`);

  // Fetch latest release
  let release;
  try {
    release = await getLatestRelease();
  } catch (e) {
    fail(`Failed to fetch latest release: ${e}`);
    Deno.exit(1);
  }
  success(`Latest release: ${release.tag}`);

  const downloadUrl = release.assets[platform.asset];
  if (!downloadUrl) {
    fail(`No binary found for ${platform.asset}`);
    log(`  Available: ${Object.keys(release.assets).join(", ")}`);
    Deno.exit(1);
  }

  // Download and verify
  log(`Downloading ${dim(platform.asset)}...`);
  let binary;
  try {
    const checksumUrl = release.assets["checksums.txt"];
    binary = await downloadAndVerify(downloadUrl, checksumUrl, platform.asset);
  } catch (e) {
    fail(`${e}`);
    Deno.exit(1);
  }
  success("Downloaded and verified");

  // Create ~/.claude if needed
  try {
    await Deno.mkdir(CLAUDE_DIR, { recursive: true });
  } catch { /* exists */ }

  // Backup existing
  try {
    await Deno.stat(BINARY_DEST);
    await Deno.rename(BINARY_DEST, BINARY_DEST + ".bak");
    warn(`Backed up existing binary to ${dim(BINARY_NAME + ".bak")}`);
  } catch { /* no existing */ }

  // Write binary
  await Deno.writeFile(BINARY_DEST, binary, { mode: 0o755 });
  success(`Installed to ${dim(BINARY_DEST)}`);

  // Update settings.json
  let command = `"$HOME/.claude/${BINARY_NAME}"`;
  if (extraArgs.length > 0) {
    command += " " + extraArgs.join(" ");
  }

  const settings = await readSettings();
  const statusLineConfig = { type: "command", command };

  const existing = settings.statusLine as Record<string, string> | undefined;
  if (existing?.type === "command" && existing?.command === command) {
    success("Settings already configured");
  } else {
    settings.statusLine = statusLineConfig;
    await writeSettings(settings);
    success(`Updated ${dim("settings.json")}`);
  }

  if (initConfig) {
    const configPath = `${CLAUDE_DIR}/statusline.yaml`;
    try {
      await Deno.stat(configPath);
      warn(`Config already exists: ${dim(configPath)}`);
    } catch {
      const proc = new Deno.Command(BINARY_DEST, { args: ["--init-config"], stdout: "inherit", stderr: "inherit" });
      const { success: ok } = await proc.output();
      if (ok) {
        success(`Generated ${dim(configPath)}`);
      } else {
        warn("Failed to generate config file");
      }
    }
  }

  console.log();
  log(`${green("Done!")} Restart Claude Code to see your new status line.`);
  if (extraArgs.length > 0) {
    log(dim(`Options: ${extraArgs.join(" ")}`));
  }
  console.log();
}

// ── Main ────────────────────────────────────────────────

let isUninstall = false;
let isHelp = false;
let initConfig = false;
const extraArgs: string[] = [];
const valueFlags = new Set(["--bar-style", "--path-style", "--theme", "--time-style", "--ctx-format", "--vim-mode", "--model-name", "--git-symbols"]);

for (let i = 0; i < Deno.args.length; i++) {
  const arg = Deno.args[i];
  if (arg === "--help" || arg === "-h") {
    isHelp = true;
  } else if (arg === "--uninstall") {
    isUninstall = true;
  } else if (arg === "--init-config") {
    initConfig = true;
  } else if (valueFlags.has(arg) && Deno.args[i + 1]) {
    extraArgs.push(arg, Deno.args[++i]);
  } else {
    fail(`Unknown option: ${arg}`);
    Deno.exit(1);
  }
}

if (isHelp) {
  console.log(`
  ${blue("Claude Code Statusline")}

  ${dim("Usage:")}
    deno run -A install.ts [options]     Install with options
    deno run -A install.ts --uninstall   Uninstall

  ${dim("Options:")}
    --bar-style <dot|block|fill>              Bar style (default: dot)
    --path-style <parent|full|short|basename> Path style (default: parent)
    --theme <name>                            Color theme (default: default)
    --time-style <absolute|relative>          Time format (default: absolute)
    --ctx-format <format>                     Context display format
    --vim-mode <auto|always|off>              Vim mode display (default: auto)
    --model-name <on|off>                     Model name display (default: on)
    --git-symbols <key=val,...>               Override git symbols
    --init-config                             Generate ~/.claude/statusline.yaml
    --uninstall                               Remove statusline
    --help                                    Show this help
`);
  Deno.exit(0);
}

if (isUninstall) {
  await uninstall();
} else {
  await install(extraArgs, initConfig);
}
