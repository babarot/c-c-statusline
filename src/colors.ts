import { dim as stdDim, rgb24 } from "@std/fmt/colors";
import { type ThemePalette, resolveTheme } from "./themes.ts";

let activePalette: ThemePalette = resolveTheme("default");

export function setTheme(name: string): void {
  activePalette = resolveTheme(name);
}

export type Color = keyof ThemePalette;

export function paint(text: string, color: Color): string {
  return rgb24(text, activePalette[color]);
}

export function colorForPct(pct: number): Color {
  if (pct >= 90) return "danger";
  if (pct >= 70) return "caution";
  if (pct >= 50) return "warning";
  return "success";
}

/**
 * Color for usage judged against an even pace through the window: `diff` is the
 * points by which usage is ahead of it (negative when under). A window used up
 * is danger whatever the pace, since nothing more can be used until it resets.
 */
export function colorForPace(diff: number, pct = 0): Color {
  if (pct >= 100 || diff > 15) return "danger";
  if (diff >= 3) return "caution";
  return "success";
}

export const dim = stdDim;
