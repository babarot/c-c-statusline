import type { GitInfo, GitSymbols } from "../git.ts";
import type { UsageData } from "../usage.ts";

/** Pre-fetched data shared across all status items. */
export interface RenderContext {
  /** Raw JSON from Claude Code stdin. */
  data: Record<string, unknown>;
  /** Resolved render options. */
  options: RenderOptions;
  /** Git repository information. */
  gitInfo: GitInfo;
  /** Thinking effort level ("high" | "low" | "default"). */
  effort: string;
  /** API usage / rate limit data (null if unavailable). */
  usageData: UsageData | null;
  /** Update check result. */
  updateInfo: { available: boolean; latest: string } | null;
  /** Formatted session duration (e.g. "5m", "1h23m"), empty if unavailable. */
  sessionDuration: string;
}

export interface RenderOptions {
  barStyle: string;
  pathStyle: string;
  timeStyle: "absolute" | "relative";
  ctxFormat: string;
  gitSymbols: GitSymbols;
  vimMode: "auto" | "always" | "off";
  modelName: "on" | "off";
}

/** A single status line display item. */
export interface StatusItem {
  /** Unique identifier for this item. */
  id: string;
  /** Render the item. Return null to skip display. */
  render(ctx: RenderContext): string | null;
}
