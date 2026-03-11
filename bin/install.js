#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");
const BINARY_NAME = "c-c-statusline";
const BINARY_DEST = path.join(CLAUDE_DIR, BINARY_NAME);
const REPO = "babarot/c-c-statusline";

const blue = "\x1b[38;2;0;153;255m";
const green = "\x1b[38;2;0;175;80m";
const red = "\x1b[38;2;255;85;85m";
const yellow = "\x1b[38;2;230;200;0m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";

const log = (msg) => console.log(`  ${msg}`);
const success = (msg) => console.log(`  ${green}✓${reset} ${msg}`);
const warn = (msg) => console.log(`  ${yellow}!${reset} ${msg}`);
const fail = (msg) => console.error(`  ${red}✗${reset} ${msg}`);

function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();

  const osMap = { darwin: "darwin", linux: "linux" };
  const archMap = { arm64: "arm64", x64: "x86_64" };

  const osName = osMap[platform];
  const archName = archMap[arch];
  if (!osName || !archName) return null;

  return {
    os: osName,
    arch: archName,
    asset: `${BINARY_NAME}-${osName}-${archName}`,
  };
}

async function getLatestRelease() {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    { headers: { Accept: "application/vnd.github.v3+json" } },
  );
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
  const data = await resp.json();

  const assets = {};
  for (const asset of data.assets) {
    assets[asset.name] = asset.browser_download_url;
  }
  return { tag: data.tag_name, assets };
}

async function downloadAndVerify(url, checksumUrl, assetName) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const binary = Buffer.from(await resp.arrayBuffer());

  if (!checksumUrl) {
    warn("Checksum file not found, skipping verification");
    return binary;
  }

  const csResp = await fetch(checksumUrl);
  if (!csResp.ok) {
    warn("Checksum file not found, skipping verification");
    return binary;
  }
  const checksumText = await csResp.text();

  const line = checksumText.split("\n").find((l) => l.includes(assetName));
  if (!line) {
    warn("Checksum entry not found, skipping verification");
    return binary;
  }
  const expectedHash = line.split(/\s+/)[0];

  const actualHash = crypto.createHash("sha256").update(binary).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `Checksum mismatch!\n  expected: ${expectedHash}\n  actual:   ${actualHash}`,
    );
  }

  return binary;
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
}

async function uninstall() {
  console.log();
  console.log(`  ${blue}Claude Code Statusline Uninstaller${reset}`);
  console.log(`  ${dim}──────────────────────────────────${reset}`);
  console.log();

  const backup = BINARY_DEST + ".bak";

  if (fs.existsSync(backup)) {
    fs.renameSync(backup, BINARY_DEST);
    success(`Restored previous statusline from ${dim}backup${reset}`);
  } else if (fs.existsSync(BINARY_DEST)) {
    fs.unlinkSync(BINARY_DEST);
    success(`Removed ${dim}${BINARY_NAME}${reset}`);
  } else {
    warn("No statusline binary found — nothing to remove");
  }

  // Clean up old statusline.ts
  const oldTs = path.join(CLAUDE_DIR, "statusline.ts");
  if (fs.existsSync(oldTs)) {
    fs.unlinkSync(oldTs);
    success(`Removed old ${dim}statusline.ts${reset}`);
  }

  try {
    const settings = readSettings();
    if (settings.statusLine) {
      delete settings.statusLine;
      writeSettings(settings);
      success(`Removed statusLine from ${dim}settings.json${reset}`);
    } else {
      success("Settings already clean");
    }
  } catch {
    fail(`Could not parse ${SETTINGS_FILE} — fix it manually`);
    process.exit(1);
  }

  console.log();
  log(`${green}Done!${reset} Restart Claude Code to apply changes.`);
  console.log();
}

async function install(extraArgs, initConfig) {
  console.log();
  console.log(`  ${blue}Claude Code Statusline Installer${reset}`);
  console.log(`  ${dim}────────────────────────────────${reset}`);
  console.log();

  const platform = detectPlatform();
  if (!platform) {
    fail(`Unsupported platform: ${os.platform()} ${os.arch()}`);
    process.exit(1);
  }
  success(`Platform: ${platform.os}/${platform.arch}`);

  let release;
  try {
    release = await getLatestRelease();
  } catch (e) {
    fail(`Failed to fetch latest release: ${e}`);
    process.exit(1);
  }
  success(`Latest release: ${release.tag}`);

  const downloadUrl = release.assets[platform.asset];
  if (!downloadUrl) {
    fail(`No binary found for ${platform.asset}`);
    log(`  Available: ${Object.keys(release.assets).join(", ")}`);
    process.exit(1);
  }

  log(`Downloading ${dim}${platform.asset}${reset}...`);
  let binary;
  try {
    binary = await downloadAndVerify(
      downloadUrl,
      release.assets["checksums.txt"],
      platform.asset,
    );
  } catch (e) {
    fail(`${e}`);
    process.exit(1);
  }
  success("Downloaded and verified");

  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  if (fs.existsSync(BINARY_DEST)) {
    fs.renameSync(BINARY_DEST, BINARY_DEST + ".bak");
    warn(`Backed up existing binary to ${dim}${BINARY_NAME}.bak${reset}`);
  }

  fs.writeFileSync(BINARY_DEST, binary, { mode: 0o755 });
  success(`Installed to ${dim}${BINARY_DEST}${reset}`);

  let command = `"$HOME/.claude/${BINARY_NAME}"`;
  if (extraArgs.length > 0) {
    command += " " + extraArgs.join(" ");
  }

  const settings = readSettings();
  const statusLineConfig = { type: "command", command };

  const existing = settings.statusLine;
  if (existing?.type === "command" && existing?.command === command) {
    success("Settings already configured");
  } else {
    settings.statusLine = statusLineConfig;
    writeSettings(settings);
    success(`Updated ${dim}settings.json${reset}`);
  }

  if (initConfig) {
    const configPath = path.join(CLAUDE_DIR, "statusline.yaml");
    if (fs.existsSync(configPath)) {
      warn(`Config already exists: ${dim}${configPath}${reset}`);
    } else {
      const { execFileSync } = require("child_process");
      try {
        execFileSync(BINARY_DEST, ["--init-config"], { stdio: "inherit" });
        success(`Generated ${dim}${configPath}${reset}`);
      } catch {
        warn("Failed to generate config file");
      }
    }
  }

  console.log();
  log(`${green}Done!${reset} Restart Claude Code to see your new status line.`);
  if (extraArgs.length > 0) {
    log(`${dim}Options: ${extraArgs.join(" ")}${reset}`);
  }
  console.log();
}

// ── Main ────────────────────────────────────────────────

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`
  ${blue}Claude Code Statusline${reset}

  ${dim}Usage:${reset}
    npx @babarot/c-c-statusline              Install with defaults
    npx @babarot/c-c-statusline --uninstall   Uninstall

  ${dim}Options:${reset}
    --bar-style <dot|block|fill>              Bar style (default: dot)
    --path-style <parent|full|short|basename> Path style (default: parent)
    --theme <name>                            Color theme (default: default)
    --time-style <absolute|relative>          Time format (default: absolute)
    --ctx-format <format>                     Context display format
    --vim-mode <auto|always|off>              Vim mode display (default: auto)
    --git-symbols <key=val,...>               Override git symbols
    --init-config                             Generate ~/.claude/statusline.yaml
    --uninstall                               Remove statusline
    --help                                    Show this help
`);
  process.exit(0);
}

if (argv.includes("--uninstall")) {
  uninstall();
} else {
  const extraArgs = [];
  const initConfig = argv.includes("--init-config");
  const valueFlags = ["--bar-style", "--path-style", "--theme", "--time-style", "--ctx-format", "--vim-mode", "--git-symbols"];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--init-config") continue;
    if (valueFlags.includes(argv[i]) && argv[i + 1]) {
      extraArgs.push(argv[i], argv[++i]);
    } else {
      fail(`Unknown option: ${argv[i]}`);
      process.exit(1);
    }
  }
  install(extraArgs, initConfig);
}
