import { VERSION } from "./version.ts";

const REPO = "babarot/c-c-statusline";
const BINARY_NAME = "c-c-statusline";
const CACHE_DIR = "/tmp/claude";
const UPDATE_CACHE_FILE = `${CACHE_DIR}/statusline-update-cache.json`;
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60; // 6 hours in seconds

interface UpdateCache {
  latest: string;
  checked_at: number;
}

function detectPlatform(): { os: string; arch: string } {
  const os = Deno.build.os === "darwin" ? "darwin" : "linux";
  const arch = Deno.build.arch === "aarch64" ? "arm64" : "x86_64";
  return { os, arch };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchLatestTag(): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.tag_name ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if an update is available. Uses a cache to avoid
 * hitting the GitHub API on every render (6-hour TTL).
 */
export async function checkForUpdate(): Promise<{ available: boolean; latest: string } | null> {
  // Check cache first
  try {
    const text = await Deno.readTextFile(UPDATE_CACHE_FILE);
    const cache: UpdateCache = JSON.parse(text);
    const age = (Date.now() - cache.checked_at) / 1000;
    if (age < UPDATE_CHECK_INTERVAL) {
      return {
        available: compareVersions(cache.latest, VERSION) > 0,
        latest: cache.latest,
      };
    }
  } catch { /* no cache or invalid */ }

  // Fetch from GitHub
  const latest = await fetchLatestTag();
  if (!latest) return null;

  // Write cache
  try {
    await Deno.mkdir(CACHE_DIR, { recursive: true });
    const cache: UpdateCache = { latest, checked_at: Date.now() };
    await Deno.writeTextFile(UPDATE_CACHE_FILE, JSON.stringify(cache));
  } catch { /* ignore */ }

  return {
    available: compareVersions(latest, VERSION) > 0,
    latest,
  };
}

/**
 * Self-upgrade: download the latest binary and replace the current one.
 */
export async function performUpgrade(): Promise<void> {
  const tag = await fetchLatestTag();
  if (!tag) {
    console.error("Failed to fetch latest release from GitHub.");
    Deno.exit(1);
  }

  if (compareVersions(tag, VERSION) <= 0) {
    console.log(`Already up to date (${VERSION}).`);
    Deno.exit(0);
  }

  console.log(`Upgrading: ${VERSION} → ${tag}`);

  const { os, arch } = detectPlatform();
  const assetName = `${BINARY_NAME}-${os}-${arch}`;
  const baseUrl = `https://github.com/${REPO}/releases/download/${tag}`;

  // Download binary
  console.log(`Downloading ${assetName}...`);
  const binResp = await fetch(`${baseUrl}/${assetName}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!binResp.ok) {
    console.error(`Failed to download binary: ${binResp.status}`);
    Deno.exit(1);
  }
  const binData = new Uint8Array(await binResp.arrayBuffer());

  // Verify checksum
  let checksumVerified = false;
  try {
    const csResp = await fetch(`${baseUrl}/checksums.txt`, {
      signal: AbortSignal.timeout(5000),
    });
    if (csResp.ok) {
      const csText = await csResp.text();
      const line = csText.split("\n").find((l) => l.includes(assetName));
      if (line) {
        const expected = line.trim().split(/\s+/)[0];
        const digest = await crypto.subtle.digest("SHA-256", binData);
        const actual = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (actual !== expected) {
          console.error(`Checksum mismatch!\n  expected: ${expected}\n  actual:   ${actual}`);
          Deno.exit(1);
        }
        checksumVerified = true;
      }
    }
  } catch { /* checksum fetch failed */ }

  if (checksumVerified) {
    console.log("Checksum verified.");
  } else {
    console.log("Warning: checksum verification skipped.");
  }

  // Find current binary path
  const binaryPath = Deno.execPath();

  // Backup existing binary
  try {
    await Deno.rename(binaryPath, `${binaryPath}.bak`);
  } catch {
    console.error(`Failed to backup current binary at ${binaryPath}`);
    Deno.exit(1);
  }

  // Write new binary
  try {
    await Deno.writeFile(binaryPath, binData, { mode: 0o755 });
  } catch (err) {
    // Restore backup on failure
    try {
      await Deno.rename(`${binaryPath}.bak`, binaryPath);
    } catch { /* can't restore either */ }
    console.error(`Failed to write new binary: ${err}`);
    Deno.exit(1);
  }

  // Clean up backup
  try {
    await Deno.remove(`${binaryPath}.bak`);
  } catch { /* ignore */ }

  // Clear update cache so notification disappears
  try {
    await Deno.remove(UPDATE_CACHE_FILE);
  } catch { /* ignore */ }

  console.log(`Successfully upgraded to ${tag}.`);
}
