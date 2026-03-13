import { colorForPct, dim, paint } from "./colors.ts";
import { buildBar, formatPath, formatResetTime, formatTokens } from "./format.ts";
import { getGitInfo } from "./git.ts";
import type { GitSymbols } from "./git.ts";
import { formatSessionDuration } from "./session.ts";
import { readEffortLevel } from "./effort.ts";
import { fetchUsageData } from "./usage.ts";
import { checkForUpdate } from "./upgrade.ts";

export interface RenderOptions {
  barStyle: string;
  pathStyle: string;
  timeStyle: "absolute" | "relative";
  ctxFormat: string;
  gitSymbols: GitSymbols;
  vimMode: "auto" | "always" | "off";
}

/** Advance a past resets_at by windowMs increments until it's in the future. */
function advanceReset(
  isoStr: string | undefined | null,
  windowMs: number,
): string | undefined | null {
  if (!isoStr) return isoStr;
  const t = new Date(isoStr).getTime();
  if (isNaN(t)) return isoStr;
  const now = Date.now();
  if (t >= now) return isoStr;
  const periods = Math.ceil((now - t) / windowMs);
  return new Date(t + periods * windowMs).toISOString();
}

import type { UsageData } from "./usage.ts";

/** Check if a resets_at timestamp is in the past (window has rolled over). */
function isWindowExpired(isoStr: string | undefined | null): boolean {
  if (!isoStr) return false;
  const t = new Date(isoStr).getTime();
  return !isNaN(t) && t < Date.now();
}

/** Format how old the cached data is (e.g. "3m前", "2h前"). */
function formatStaleness(fetchedAt: number | undefined): string {
  if (!fetchedAt) return "";
  const diffMs = Date.now() - fetchedAt;
  if (diffMs < 60_000) return "";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h${remMins}m` : `${hours}h`;
}

function renderRateLines(usageData: UsageData, options: RenderOptions): string {
  const barWidth = 10;
  const lines: string[] = [];

  const staleLabel = formatStaleness(usageData._fetched_at);
  const fiveHourExpired = isWindowExpired(usageData.five_hour?.resets_at);
  const sevenDayExpired = isWindowExpired(usageData.seven_day?.resets_at);

  // Current (5-hour window)
  const fiveHourResetAt = advanceReset(usageData.five_hour?.resets_at, 5 * 60 * 60_000);
  const fiveHourReset = formatResetTime(fiveHourResetAt, "time", options.timeStyle);
  if (fiveHourExpired) {
    const emptyBar = buildBar(0, barWidth, options.barStyle);
    lines.push(`${paint("current", "muted")} ${emptyBar} ${dim("  ?%")} ${dim("⟳")} ${paint(fiveHourReset, "muted")}`);
  } else {
    const fiveHourPct = Math.round(usageData.five_hour?.utilization ?? 0);
    const fiveHourBar = buildBar(fiveHourPct, barWidth, options.barStyle);
    const fiveHourPctFmt = String(fiveHourPct).padStart(3);
    lines.push(`${paint("current", "muted")} ${fiveHourBar} ${paint(`${fiveHourPctFmt}%`, colorForPct(fiveHourPct))} ${dim("⟳")} ${paint(fiveHourReset, "muted")}`);
  }

  // Weekly (7-day window)
  const sevenDayResetAt = advanceReset(usageData.seven_day?.resets_at, 7 * 24 * 60 * 60_000);
  const sevenDayReset = formatResetTime(sevenDayResetAt, "datetime", options.timeStyle);
  if (sevenDayExpired) {
    const emptyBar = buildBar(0, barWidth, options.barStyle);
    lines.push(`${paint("weekly", "muted")}  ${emptyBar} ${dim("  ?%")} ${dim("⟳")} ${paint(sevenDayReset, "muted")}`);
  } else {
    const sevenDayPct = Math.round(usageData.seven_day?.utilization ?? 0);
    const sevenDayBar = buildBar(sevenDayPct, barWidth, options.barStyle);
    const sevenDayPctFmt = String(sevenDayPct).padStart(3);
    lines.push(`${paint("weekly", "muted")}  ${sevenDayBar} ${paint(`${sevenDayPctFmt}%`, colorForPct(sevenDayPct))} ${dim("⟳")} ${paint(sevenDayReset, "muted")}`);
  }

  // Stale data indicator
  if ((fiveHourExpired || sevenDayExpired) && staleLabel) {
    lines.push(dim(`(stale: ${staleLabel} ago)`));
  }

  if (usageData.extra_usage?.is_enabled && (usageData.extra_usage.used_credits ?? 0) > 0) {
    const extraPct = Math.round(usageData.extra_usage.utilization ?? 0);
    const extraUsed = ((usageData.extra_usage.used_credits ?? 0) / 100).toFixed(2);
    const extraLimit = ((usageData.extra_usage.monthly_limit ?? 0) / 100).toFixed(2);
    const extraBar = buildBar(extraPct, barWidth, options.barStyle);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const extraReset = `${months[nextMonth.getMonth()]} ${nextMonth.getDate()}`;

    lines.push(`${paint("extra", "muted")}   ${extraBar} ${paint(`$${extraUsed}`, colorForPct(extraPct))}${dim("/")}${paint(`$${extraLimit}`, "muted")}`);
    lines.push(`${dim("resets")} ${paint(extraReset, "muted")}`);
  }

  return lines.join("\n");
}

export async function renderStatusLine(
  data: Record<string, unknown>,
  options: RenderOptions,
): Promise<string> {
  const sep = ` ${dim("│")} `;

  // Model
  const modelName =
    (data.model as Record<string, string>)?.display_name ?? "Claude";

  // Context — prefer pre-calculated percentage from Claude Code
  const USABLE_CONTEXT_RATIO = 0.85;
  const ctxWindow = data.context_window as Record<string, unknown> | undefined;
  const pctUsed = (ctxWindow?.used_percentage as number) ?? 0;
  const ctxSize = (ctxWindow?.context_window_size as number) ?? 200000;
  const ctxUsed = Math.round((pctUsed * ctxSize) / 100);
  const usableTokens = Math.floor(ctxSize * USABLE_CONTEXT_RATIO);
  const compactPct = Math.max(0, Math.min(100, Math.round(((usableTokens - ctxUsed) / usableTokens) * 100)));

  // CWD
  const cwd = (data.cwd as string) || Deno.cwd();
  const dirname = formatPath(cwd, options.pathStyle);

  // Parallel: git, effort, usage API, update check
  const [gitInfo, effort, usageData, updateInfo] = await Promise.all([
    getGitInfo(cwd),
    readEffortLevel(),
    fetchUsageData(),
    checkForUpdate(),
  ]);

  // Session
  const sessionDuration = formatSessionDuration(
    (data.session as Record<string, string>)?.start_time,
  );

  // ── Line 1 ──────────────────────────────────────────
  let line1 = paint(modelName, "primary");
  line1 += sep;

  const ctxText = options.ctxFormat
    .replace(/\{used\}/g, formatTokens(ctxUsed))
    .replace(/\{total\}/g, formatTokens(ctxSize))
    .replace(/\{pct\}/g, String(pctUsed))
    .replace(/\{compact\}/g, String(compactPct));
  line1 += paint(ctxText, colorForPct(pctUsed));

  line1 += sep;
  line1 += paint(dirname, "secondary");

  if (gitInfo.branch) {
    // Branch name: success if attached, danger if detached
    const branchColor = gitInfo.detached ? "danger" : "success";
    let gitPart = paint(gitInfo.branch, branchColor);

    // State flags
    const gs = options.gitSymbols;
    const flags: string[] = [];
    if (gitInfo.unstaged) flags.push(paint(gs.unstaged, "danger"));
    if (gitInfo.staged) flags.push(paint(gs.staged, "success"));
    if (gitInfo.stash) flags.push(paint(gs.stash, "primary"));
    if (gitInfo.untracked) flags.push(paint(gs.untracked, "danger"));
    if (flags.length > 0) {
      gitPart += ` ${flags.join("")}`;
    }

    // Upstream: ahead/behind
    const upstream: string[] = [];
    if (gitInfo.ahead > 0) upstream.push(paint(`${gs.ahead}${gitInfo.ahead}`, "success"));
    if (gitInfo.behind > 0) upstream.push(paint(`${gs.behind}${gitInfo.behind}`, "danger"));
    if (gitInfo.ahead === 0 && gitInfo.behind === 0 && gitInfo.branch && !gitInfo.detached) {
      // only show = if upstream exists (we got a count back)
      // We can't distinguish "no upstream" from "equal" here since both give ahead=0 behind=0
      // but if upstream didn't exist, rev-list would fail and return nulls → 0,0
      // Skip the = indicator to avoid noise
    }
    if (upstream.length > 0) {
      gitPart += ` ${upstream.join(" ")}`;
    }

    // Operation: |REBASE, |MERGING, etc.
    if (gitInfo.operation) {
      gitPart += paint(`|${gitInfo.operation}`, "accent");
    }

    line1 += ` ${paint("(", branchColor)}${gitPart}${paint(")", branchColor)}`;
  }

  if (sessionDuration) {
    line1 += sep;
    line1 += `${dim("⏱")} ${paint(sessionDuration, "muted")}`;
  }

  line1 += sep;
  switch (effort) {
    case "high":
      line1 += paint(`● ${effort}`, "accent");
      break;
    case "low":
      line1 += dim(`◔ ${effort}`);
      break;
    default:
      line1 += dim(`◑ ${effort}`);
      break;
  }

  // Vim mode
  const vimMode = (data.vim as Record<string, string>)?.mode;
  if (vimMode && options.vimMode !== "off") {
    const show = options.vimMode === "always" ||
      (options.vimMode === "auto" && vimMode === "NORMAL");
    if (show) {
      line1 += sep;
      const vimColor = vimMode === "INSERT" ? "success" : "primary";
      line1 += paint(vimMode, vimColor);
    }
  }

  // Update notification
  if (updateInfo?.available) {
    line1 += sep;
    line1 += paint(`↑ ${updateInfo.latest}`, "accent");
  }

  const rateLines = usageData ? renderRateLines(usageData, options) : "";

  // ── Compose ─────────────────────────────────────────
  let output = line1;
  if (rateLines) {
    output += `\n\n${rateLines}`;
  }
  return output;
}
