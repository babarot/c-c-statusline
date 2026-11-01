import { type Color, colorForPct, dim, paint } from "./colors.ts";

const barStyles: Record<string, [string, string]> = {
  dot: ["●", "○"],
  block: ["▰", "▱"],
  fill: ["█", "░"],
};

export function formatTokens(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}m`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}k`;
  return String(num);
}

export function formatPath(fullPath: string, style: string): string {
  const home = Deno.env.get("HOME") ?? "";
  const tilded = home && fullPath.startsWith(home)
    ? "~" + fullPath.slice(home.length)
    : fullPath;
  const parts = tilded.split("/");

  switch (style) {
    case "full":
      return tilded;
    case "short": {
      const last = parts.pop()!;
      const secondLast = parts.pop();
      const abbreviated = parts.map((p) =>
        p === "~" || p === "" ? p : p[0]
      );
      if (secondLast !== undefined) abbreviated.push(secondLast);
      abbreviated.push(last);
      return abbreviated.join("/");
    }
    case "basename":
      return parts[parts.length - 1] ?? fullPath;
    case "parent":
    default:
      return parts.length >= 2
        ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
        : parts[parts.length - 1] ?? fullPath;
  }
}

export function formatResetTime(
  isoStr: string | undefined | null,
  style: "time" | "datetime" | "date" = "date",
  timeStyle: "absolute" | "relative" = "absolute",
  now: number = Date.now(),
): string {
  if (!isoStr || isoStr === "null") return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";

  if (timeStyle === "relative") {
    return formatRelativeTime(d, now);
  }

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  switch (style) {
    case "time": {
      let h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, "0");
      const ampm = h >= 12 ? "pm" : "am";
      h = h % 12 || 12;
      return `${h}:${m}${ampm}`;
    }
    case "datetime": {
      const mon = months[d.getMonth()];
      const day = d.getDate();
      let h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, "0");
      const ampm = h >= 12 ? "pm" : "am";
      h = h % 12 || 12;
      return `${mon} ${day}, ${h}:${m}${ampm}`;
    }
    default:
      return `${months[d.getMonth()]} ${d.getDate()}`;
  }
}

/** A duration as "2d 5h", "1h 30m" or "45m". Minutes are dropped once it spans days. Empty under a minute. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && days === 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

function formatRelativeTime(target: Date, now: number): string {
  const duration = formatDuration(target.getTime() - now);
  return duration ? `${duration} left` : "now";
}

/**
 * A bar with the even-pace position marked. Filled cells up to the pace keep the
 * usual color; filled cells past it are painted as overspend. When usage is below
 * the pace, the pace cell shows a marker instead.
 */
export function buildPaceBar(pct: number, pacePct: number, width: number, style: string): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped * width) / 100);
  const paceFill = Math.round((Math.max(0, Math.min(100, pacePct)) * width) / 100);
  const markerCell = Math.min(width - 1, paceFill);
  const within = Math.min(filled, paceFill);
  const [filledChar, emptyChar] = barStyles[style] ?? barStyles.dot;
  const over = clamped - pacePct > 15 ? "danger" : "caution";

  // Skip empty runs so no bare escape codes are emitted.
  const run = (n: number, ch: string, color: (t: string) => string) => n > 0 ? color(ch.repeat(n)) : "";
  let out = run(within, filledChar, (t) => paint(t, colorForPct(clamped)));
  out += run(filled - within, filledChar, (t) => paint(t, over));
  if (filled <= markerCell) {
    out += run(markerCell - filled, emptyChar, dim);
    out += paint("\u2503", "primary");
    out += run(width - markerCell - 1, emptyChar, dim);
  } else {
    out += run(width - filled, emptyChar, dim);
  }
  return out;
}

/** A usage bar. The filled part is colored by usage unless `color` is given. */
export function buildBar(pct: number, width: number, style: string, color?: Color): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped * width) / 100);
  const empty = width - filled;
  const [filledChar, emptyChar] = barStyles[style] ?? barStyles.dot;
  return paint(filledChar.repeat(filled), color ?? colorForPct(clamped)) +
    dim(emptyChar.repeat(empty));
}
