import { dim } from "./colors.ts";
import { getGitInfo } from "./git.ts";
import { formatSessionDuration } from "./session.ts";
import { readEffortLevel } from "./effort.ts";
import { fetchUsageData } from "./usage.ts";
import { checkForUpdate } from "./upgrade.ts";
import type { UsageData } from "./usage.ts";
import type { RenderOptions, RenderContext, StatusItem } from "./items/types.ts";
import { DEFAULT_LINES } from "./config.ts";

import { modelItem } from "./items/model.ts";
import { contextItem } from "./items/context.ts";
import { gitStatusItem } from "./items/git-status.ts";
import { durationItem } from "./items/duration.ts";
import { effortItem } from "./items/effort.ts";
import { vimItem } from "./items/vim.ts";
import { updateItem } from "./items/update.ts";
import { usageItem } from "./items/usage.ts";

export type { RenderOptions };

/** Registry of all available status items, keyed by id. */
const itemRegistry: Record<string, StatusItem> = {
  model: modelItem,
  context: contextItem,
  git: gitStatusItem,
  duration: durationItem,
  effort: effortItem,
  vim: vimItem,
  update: updateItem,
  usage: usageItem,
};

/** Resolve item IDs to StatusItem instances, skipping unknown IDs. */
function resolveItems(ids: string[]): StatusItem[] {
  return ids
    .map((id) => itemRegistry[id])
    .filter((item): item is StatusItem => item !== undefined);
}

/** Convert stdin rate_limits (v2.1.80+) to internal UsageData format. */
export function convertStdinRateLimits(
  rateLimits: Record<string, unknown>,
): UsageData {
  const convert = (
    window: Record<string, unknown> | undefined,
  ): { utilization?: number; resets_at?: string } | undefined => {
    if (!window) return undefined;
    const pct = window.used_percentage as number | undefined;
    const epoch = window.resets_at as number | undefined;
    return {
      utilization: pct,
      resets_at: epoch != null ? new Date(epoch * 1000).toISOString() : undefined,
    };
  };
  return {
    five_hour: convert(rateLimits.five_hour as Record<string, unknown> | undefined),
    seven_day: convert(rateLimits.seven_day as Record<string, unknown> | undefined),
  };
}

export async function renderStatusLine(
  data: Record<string, unknown>,
  options: RenderOptions,
  lines: string[][] = DEFAULT_LINES,
): Promise<string> {
  const cwd = (data.cwd as string) || Deno.cwd();

  // Extract stdin rate_limits (Claude Code v2.1.80+)
  const stdinRateLimits = data.rate_limits as Record<string, unknown> | undefined;

  // Parallel: git, effort, usage API (only if no stdin rate_limits), update check
  const [gitInfo, effort, apiUsageData, updateInfo] = await Promise.all([
    getGitInfo(cwd),
    readEffortLevel(),
    stdinRateLimits ? Promise.resolve(null) : fetchUsageData(),
    checkForUpdate(),
  ]);

  const usageData: UsageData | null = stdinRateLimits
    ? convertStdinRateLimits(stdinRateLimits)
    : apiUsageData;

  const sessionDuration = formatSessionDuration(
    (data.session as Record<string, string>)?.start_time,
  );

  // Build shared context for all items
  const ctx: RenderContext = {
    data,
    options,
    gitInfo,
    effort,
    usageData,
    updateInfo,
    sessionDuration,
  };

  // Render each line from layout config
  const sep = ` ${dim("\u2502")} `;
  const renderedLines: string[] = [];

  for (const lineIds of lines) {
    const items = resolveItems(lineIds);
    const parts = items
      .map((item) => item.render(ctx))
      .filter((s): s is string => s !== null);
    if (parts.length > 0) {
      renderedLines.push(parts.join(sep));
    }
  }

  return renderedLines.join("\n\n");
}
