import { colorForPct, dim, paint } from "../colors.ts";
import { buildBar, formatResetTime } from "../format.ts";
import type { UsageData } from "../usage.ts";
import type { StatusItem, RenderContext } from "./types.ts";

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

/** Check if a resets_at timestamp is in the past (window has rolled over). */
function isWindowExpired(isoStr: string | undefined | null): boolean {
  if (!isoStr) return false;
  const t = new Date(isoStr).getTime();
  return !isNaN(t) && t < Date.now();
}

/** Format how old the cached data is (e.g. "3m", "2h"). */
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

function renderRateLines(usageData: UsageData, barStyle: string, timeStyle: "absolute" | "relative"): string {
  const barWidth = 10;
  const lines: string[] = [];

  const staleLabel = formatStaleness(usageData._fetched_at);
  const fiveHourExpired = isWindowExpired(usageData.five_hour?.resets_at);
  const sevenDayExpired = isWindowExpired(usageData.seven_day?.resets_at);

  // Current (5-hour window)
  const fiveHourResetAt = advanceReset(usageData.five_hour?.resets_at, 5 * 60 * 60_000);
  const fiveHourReset = formatResetTime(fiveHourResetAt, "time", timeStyle);
  if (fiveHourExpired) {
    const emptyBar = buildBar(0, barWidth, barStyle);
    lines.push(`${paint("current", "muted")} ${emptyBar} ${dim("  ?%")} ${dim("\u27F3")} ${paint(fiveHourReset, "muted")}`);
  } else {
    const fiveHourPct = Math.round(usageData.five_hour?.utilization ?? 0);
    const fiveHourBar = buildBar(fiveHourPct, barWidth, barStyle);
    const fiveHourPctFmt = String(fiveHourPct).padStart(3);
    lines.push(`${paint("current", "muted")} ${fiveHourBar} ${paint(`${fiveHourPctFmt}%`, colorForPct(fiveHourPct))} ${dim("\u27F3")} ${paint(fiveHourReset, "muted")}`);
  }

  // Weekly (7-day window)
  const sevenDayResetAt = advanceReset(usageData.seven_day?.resets_at, 7 * 24 * 60 * 60_000);
  const sevenDayReset = formatResetTime(sevenDayResetAt, "datetime", timeStyle);
  if (sevenDayExpired) {
    const emptyBar = buildBar(0, barWidth, barStyle);
    lines.push(`${paint("weekly", "muted")}  ${emptyBar} ${dim("  ?%")} ${dim("\u27F3")} ${paint(sevenDayReset, "muted")}`);
  } else {
    const sevenDayPct = Math.round(usageData.seven_day?.utilization ?? 0);
    const sevenDayBar = buildBar(sevenDayPct, barWidth, barStyle);
    const sevenDayPctFmt = String(sevenDayPct).padStart(3);
    lines.push(`${paint("weekly", "muted")}  ${sevenDayBar} ${paint(`${sevenDayPctFmt}%`, colorForPct(sevenDayPct))} ${dim("\u27F3")} ${paint(sevenDayReset, "muted")}`);
  }

  // Stale data indicator
  if ((fiveHourExpired || sevenDayExpired) && staleLabel) {
    lines.push(dim(`(stale: ${staleLabel} ago)`));
  }

  if (usageData.extra_usage?.is_enabled && (usageData.extra_usage.used_credits ?? 0) > 0) {
    const extraPct = Math.round(usageData.extra_usage.utilization ?? 0);
    const extraUsed = ((usageData.extra_usage.used_credits ?? 0) / 100).toFixed(2);
    const extraLimit = ((usageData.extra_usage.monthly_limit ?? 0) / 100).toFixed(2);
    const extraBar = buildBar(extraPct, barWidth, barStyle);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const extraReset = `${months[nextMonth.getMonth()]} ${nextMonth.getDate()}`;

    lines.push(`${paint("extra", "muted")}   ${extraBar} ${paint(`$${extraUsed}`, colorForPct(extraPct))}${dim("/")}${paint(`$${extraLimit}`, "muted")}`);
    lines.push(`${dim("resets")} ${paint(extraReset, "muted")}`);
  }

  return lines.join("\n");
}

export const usageItem: StatusItem = {
  id: "usage",
  render(ctx: RenderContext): string | null {
    if (!ctx.usageData) return null;
    return renderRateLines(ctx.usageData, ctx.options.barStyle, ctx.options.timeStyle);
  },
};
