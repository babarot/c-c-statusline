import { colorForPct, dim, paint } from "../colors.ts";
import { buildBar, buildPaceBar, formatDuration, formatResetTime } from "../format.ts";
import type { UsageData } from "../usage.ts";
import { FIVE_HOUR_MS, forecast, SEVEN_DAY_MS, type WindowState, windowState } from "../usage-window.ts";
import type { StatusItem, RenderContext } from "./types.ts";

const BAR_WIDTH = 10;
const LABEL_WIDTH = 8;

interface LineOptions {
  barStyle: string;
  timeStyle: "absolute" | "relative";
  now: number;
  pace: boolean;
  forecast: boolean;
}

/** The forecast line for the weekly window, or null when there is no forecast to make. */
function renderForecastLine(state: WindowState | null, now: number): string | null {
  const f = state ? forecast(state, SEVEN_DAY_MS, now) : null;
  if (!f) return null;
  const head = paint("forecast", "muted") + " ";
  if (f.kind === "lasts") {
    return `${head}${paint("lasts until reset", "success")} ${dim(`(~${Math.round(f.pctAtReset)}% at reset)`)}`;
  }
  const color = f.inMs < f.beforeResetMs ? "danger" : "caution";
  const runsOut = paint(`runs out in ${formatDuration(f.inMs) || "<1m"}`, color);
  return `${head}${runsOut}${dim(`, ${formatDuration(f.beforeResetMs) || "<1m"} before reset`)}`;
}

/** Points by which usage differs from an even pace through the window. */
export function paceDiff(state: WindowState): number | null {
  if (state.pct === null || state.elapsedRatio === null) return null;
  return state.pct - state.elapsedRatio * 100;
}

function paceLabel(diff: number): string {
  const n = Math.round(diff);
  let text: string;
  if (Math.abs(diff) < 3) text = paint("on pace", "success");
  else if (diff > 0) text = paint(`+${n}pt ahead`, diff > 15 ? "danger" : "caution");
  else text = paint(`${n}pt under`, "success");
  return `${dim("(")}${text}${dim(")")}`;
}

/** Format how old the cached data is (e.g. "3m", "2h"). */
function formatStaleness(fetchedAt: number | undefined, now: number): string {
  if (!fetchedAt) return "";
  const diffMs = now - fetchedAt;
  if (diffMs < 60_000) return "";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h${remMins}m` : `${hours}h`;
}

/** One window as a line: label, bar, percentage and time to reset. */
function renderWindowLine(
  label: string,
  state: WindowState,
  resetStyle: "time" | "datetime",
  opts: LineOptions,
  withPace = false,
): string {
  const head = paint(label, "muted") + " ".repeat(Math.max(1, LABEL_WIDTH - label.length));
  const reset = formatResetTime(state.resetAt?.toISOString(), resetStyle, opts.timeStyle, opts.now);
  const tail = `${dim("⟳")} ${paint(reset, "muted")}`;

  if (state.pct === null) {
    return `${head}${buildBar(0, BAR_WIDTH, opts.barStyle)} ${dim("  ?%")} ${tail}`;
  }
  const pct = paint(`${String(state.pct).padStart(3)}%`, colorForPct(state.pct));
  const diff = withPace ? paceDiff(state) : null;
  if (diff === null || state.elapsedRatio === null) {
    return `${head}${buildBar(state.pct, BAR_WIDTH, opts.barStyle)} ${pct} ${tail}`;
  }
  const bar = buildPaceBar(state.pct, state.elapsedRatio * 100, BAR_WIDTH, opts.barStyle);
  return `${head}${bar} ${pct} ${paceLabel(diff)} ${tail}`;
}

/** An absent weekly window is still drawn, as 0% with no reset. */
const ABSENT: WindowState = { pct: 0, resetAt: null, elapsedRatio: null };

function renderExtraUsage(extra: NonNullable<UsageData["extra_usage"]>, opts: LineOptions): string[] {
  const extraPct = Math.round(extra.utilization ?? 0);
  const extraUsed = ((extra.used_credits ?? 0) / 100).toFixed(2);
  const extraLimit = ((extra.monthly_limit ?? 0) / 100).toFixed(2);
  const extraBar = buildBar(extraPct, BAR_WIDTH, opts.barStyle);

  const today = new Date(opts.now);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const extraReset = `${months[nextMonth.getMonth()]} ${nextMonth.getDate()}`;

  return [
    `${paint("extra", "muted")}   ${extraBar} ${paint(`$${extraUsed}`, colorForPct(extraPct))}${dim("/")}${
      paint(`$${extraLimit}`, "muted")
    }`,
    `${dim("resets")} ${paint(extraReset, "muted")}`,
  ];
}

function renderRateLines(usageData: UsageData, opts: LineOptions): string {
  const fiveHour = windowState(usageData.five_hour, FIVE_HOUR_MS, opts.now);
  const sevenDay = windowState(usageData.seven_day, SEVEN_DAY_MS, opts.now);

  // The 5-hour window is absent on plans without it (Ultra), and on other plans
  // while no window is active. Either way there is nothing to show.
  const lines: string[] = [];
  if (fiveHour) lines.push(renderWindowLine("current", fiveHour, "time", opts));
  lines.push(renderWindowLine("weekly", sevenDay ?? ABSENT, "datetime", opts, opts.pace));
  if (opts.forecast) {
    const line = renderForecastLine(sevenDay, opts.now);
    if (line) lines.push(line);
  }

  const anyExpired = fiveHour?.pct === null || sevenDay?.pct === null;
  const staleLabel = formatStaleness(usageData._fetched_at, opts.now);
  if (anyExpired && staleLabel) {
    lines.push(dim(`(stale: ${staleLabel} ago)`));
  }

  const extra = usageData.extra_usage;
  if (extra?.is_enabled && (extra.used_credits ?? 0) > 0) {
    lines.push(...renderExtraUsage(extra, opts));
  }

  return lines.join("\n");
}

export const usageItem: StatusItem = {
  id: "usage",
  render(ctx: RenderContext): string | null {
    if (!ctx.usageData) return null;
    return renderRateLines(ctx.usageData, {
      barStyle: ctx.options.barStyle,
      timeStyle: ctx.options.timeStyle,
      now: ctx.now,
      pace: ctx.options.usage?.pace ?? false,
      forecast: ctx.options.usage?.forecast ?? false,
    });
  },
};
