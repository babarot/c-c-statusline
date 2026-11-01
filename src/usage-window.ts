/** Pure calculations on a single rate limit window (5-hour, weekly). */

export const FIVE_HOUR_MS = 5 * 60 * 60_000;
export const SEVEN_DAY_MS = 7 * 24 * 60 * 60_000;

/** A rate limit window as it appears in UsageData. */
export interface UsageWindow {
  utilization?: number;
  resets_at?: string;
}

export interface WindowState {
  /** Rounded utilization (0-100), or null when the window has expired and its usage is unknown. */
  pct: number | null;
  /** Next reset. An expired reset is rolled forward by whole windows. Null when unknown. */
  resetAt: Date | null;
  /** How far the window has run, 0..1. Null when the reset is unknown. */
  elapsedRatio: number | null;
}

/**
 * Compute the state of a window at `now`. Returns null when the window is absent.
 * A window whose reset is in the past has rolled over since the data was taken,
 * so its usage is unknown and its reset moves to the next boundary.
 */
export function windowState(
  w: UsageWindow | undefined | null,
  windowMs: number,
  now: number,
): WindowState | null {
  if (!w) return null;

  const t = w.resets_at ? new Date(w.resets_at).getTime() : NaN;
  if (isNaN(t)) {
    return { pct: Math.round(w.utilization ?? 0), resetAt: null, elapsedRatio: null };
  }

  const expired = t < now;
  const resetMs = expired ? t + Math.ceil((now - t) / windowMs) * windowMs : t;
  const elapsed = 1 - (resetMs - now) / windowMs;
  return {
    pct: expired ? null : Math.round(w.utilization ?? 0),
    resetAt: new Date(resetMs),
    elapsedRatio: Math.min(1, Math.max(0, elapsed)),
  };
}
