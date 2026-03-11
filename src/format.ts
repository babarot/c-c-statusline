import { colorForPct, dim, paint } from "./colors.ts";

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
): string {
  if (!isoStr || isoStr === "null") return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";

  const months = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
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

export function buildBar(pct: number, width: number, style: string): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped * width) / 100);
  const empty = width - filled;
  const [filledChar, emptyChar] = barStyles[style] ?? barStyles.dot;
  return paint(filledChar.repeat(filled), colorForPct(clamped)) +
    dim(emptyChar.repeat(empty));
}
