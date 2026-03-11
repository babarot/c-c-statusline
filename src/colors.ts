import { dim as stdDim, rgb24 } from "@std/fmt/colors";

export const palette = {
  blue: 0x0099ff,
  orange: 0xffb055,
  green: 0x00af50,
  cyan: 0x56b6c2,
  red: 0xff5555,
  yellow: 0xe6c800,
  white: 0xdcdcdc,
  magenta: 0xb48cff,
} as const;

export type Color = keyof typeof palette;

export function paint(text: string, color: Color): string {
  return rgb24(text, palette[color]);
}

export function colorForPct(pct: number): Color {
  if (pct >= 90) return "red";
  if (pct >= 70) return "yellow";
  if (pct >= 50) return "orange";
  return "green";
}

export const dim = stdDim;
