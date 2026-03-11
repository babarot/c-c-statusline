import { colorForPct, dim, paint } from "./colors.ts";
import { buildBar, formatPath, formatResetTime } from "./format.ts";
import { getGitInfo } from "./git.ts";
import { formatSessionDuration } from "./session.ts";
import { readEffortLevel } from "./effort.ts";
import { fetchUsageData } from "./usage.ts";

export interface RenderOptions {
  barStyle: string;
  pathStyle: string;
}

export async function renderStatusLine(
  data: Record<string, unknown>,
  options: RenderOptions,
): Promise<string> {
  const sep = ` ${dim("│")} `;

  // Model
  const modelName =
    (data.model as Record<string, string>)?.display_name ?? "Claude";

  // Context
  const ctxWindow = data.context_window as Record<string, unknown> | undefined;
  let size = (ctxWindow?.context_window_size as number) ?? 200000;
  if (size === 0) size = 200000;

  const usage = ctxWindow?.current_usage as Record<string, number> | undefined;
  const current =
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0);
  const pctUsed = size > 0 ? Math.round((current * 100) / size) : 0;

  // CWD
  const cwd = (data.cwd as string) || Deno.cwd();
  const dirname = formatPath(cwd, options.pathStyle);

  // Parallel: git, effort, usage API
  const [gitInfo, effort, usageData] = await Promise.all([
    getGitInfo(cwd),
    readEffortLevel(),
    fetchUsageData(),
  ]);

  // Session
  const sessionDuration = formatSessionDuration(
    (data.session as Record<string, string>)?.start_time,
  );

  // ── Line 1 ──────────────────────────────────────────
  let line1 = paint(modelName, "primary");
  line1 += sep;
  line1 += `✍️ ${paint(`${pctUsed}%`, colorForPct(pctUsed))}`;
  line1 += sep;
  line1 += paint(dirname, "secondary");

  if (gitInfo.branch) {
    // Branch name: success if attached, danger if detached
    const branchColor = gitInfo.detached ? "danger" : "success";
    let gitPart = paint(gitInfo.branch, branchColor);

    // State flags: *=unstaged, +=staged, $=stash, %=untracked
    const flags: string[] = [];
    if (gitInfo.unstaged) flags.push(paint("*", "danger"));
    if (gitInfo.staged) flags.push(paint("+", "success"));
    if (gitInfo.stash) flags.push(paint("$", "primary"));
    if (gitInfo.untracked) flags.push(paint("%", "danger"));
    if (flags.length > 0) {
      gitPart += ` ${flags.join("")}`;
    }

    // Upstream: ahead/behind
    const upstream: string[] = [];
    if (gitInfo.ahead > 0) upstream.push(paint(`↑${gitInfo.ahead}`, "success"));
    if (gitInfo.behind > 0) upstream.push(paint(`↓${gitInfo.behind}`, "danger"));
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

  // ── Rate limit lines ────────────────────────────────
  let rateLines = "";
  const barWidth = 10;

  if (usageData) {
    const fiveHourPct = Math.round(usageData.five_hour?.utilization ?? 0);
    const fiveHourReset = formatResetTime(usageData.five_hour?.resets_at, "time");
    const fiveHourBar = buildBar(fiveHourPct, barWidth, options.barStyle);
    const fiveHourPctFmt = String(fiveHourPct).padStart(3);

    rateLines += `${paint("current", "muted")} ${fiveHourBar} ${paint(`${fiveHourPctFmt}%`, colorForPct(fiveHourPct))} ${dim("⟳")} ${paint(fiveHourReset, "muted")}`;

    const sevenDayPct = Math.round(usageData.seven_day?.utilization ?? 0);
    const sevenDayReset = formatResetTime(usageData.seven_day?.resets_at, "datetime");
    const sevenDayBar = buildBar(sevenDayPct, barWidth, options.barStyle);
    const sevenDayPctFmt = String(sevenDayPct).padStart(3);

    rateLines += `\n${paint("weekly", "muted")}  ${sevenDayBar} ${paint(`${sevenDayPctFmt}%`, colorForPct(sevenDayPct))} ${dim("⟳")} ${paint(sevenDayReset, "muted")}`;

    if (usageData.extra_usage?.is_enabled && (usageData.extra_usage.used_credits ?? 0) > 0) {
      const extraPct = Math.round(usageData.extra_usage.utilization ?? 0);
      const extraUsed = ((usageData.extra_usage.used_credits ?? 0) / 100).toFixed(2);
      const extraLimit = ((usageData.extra_usage.monthly_limit ?? 0) / 100).toFixed(2);
      const extraBar = buildBar(extraPct, barWidth, options.barStyle);

      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const extraReset = `${months[nextMonth.getMonth()]} ${nextMonth.getDate()}`;

      rateLines += `\n${paint("extra", "muted")}   ${extraBar} ${paint(`$${extraUsed}`, colorForPct(extraPct))}${dim("/")}${paint(`$${extraLimit}`, "muted")}`;
      rateLines += `\n${dim("resets")} ${paint(extraReset, "muted")}`;
    }
  }

  // ── Compose ─────────────────────────────────────────
  let output = line1;
  if (rateLines) {
    output += `\n\n${rateLines}`;
  }
  return output;
}
