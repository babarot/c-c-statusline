import { getOAuthToken } from "./oauth.ts";

const CACHE_DIR = "/tmp/claude";
const CACHE_FILE = `${CACHE_DIR}/statusline-usage-cache.json`;
const CACHE_MAX_AGE = 120;

export interface UsageData {
  five_hour?: { utilization?: number; resets_at?: string };
  seven_day?: { utilization?: number; resets_at?: string };
  extra_usage?: {
    is_enabled?: boolean;
    utilization?: number;
    used_credits?: number;
    monthly_limit?: number;
  };
  /** Epoch ms when data was fetched from the API (added by cache layer). */
  _fetched_at?: number;
}

export async function fetchUsageData(): Promise<UsageData | null> {
  // Check cache
  try {
    const stat = await Deno.stat(CACHE_FILE);
    if (stat.mtime) {
      const age = (Date.now() - stat.mtime.getTime()) / 1000;
      if (age < CACHE_MAX_AGE) {
        return JSON.parse(await Deno.readTextFile(CACHE_FILE));
      }
    }
  } catch { /* no cache or expired */ }

  // Fetch fresh data
  const token = await getOAuthToken();
  if (token) {
    try {
      const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "anthropic-beta": "oauth-2025-04-20",
          "User-Agent": "claude-code/2.1.34",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.five_hour) {
          data._fetched_at = Date.now();
          try {
            await Deno.mkdir(CACHE_DIR, { recursive: true });
            await Deno.writeTextFile(CACHE_FILE, JSON.stringify(data));
          } catch { /* ignore */ }
          return data as UsageData;
        }
      }
    } catch { /* fetch failed */ }
  }

  // Fall back to stale cache — inject _fetched_at from mtime if missing
  try {
    const data = JSON.parse(await Deno.readTextFile(CACHE_FILE)) as UsageData;
    if (!data._fetched_at) {
      try {
        const stat = await Deno.stat(CACHE_FILE);
        if (stat.mtime) data._fetched_at = stat.mtime.getTime();
      } catch { /* ignore */ }
    }
    return data;
  } catch {
    return null;
  }
}
