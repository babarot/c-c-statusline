import { colorForPct, paint } from "../colors.ts";
import { formatTokens } from "../format.ts";
import type { StatusItem, RenderContext } from "./types.ts";

export const contextItem: StatusItem = {
  id: "context",
  render(ctx: RenderContext): string | null {
    const USABLE_CONTEXT_RATIO = 0.85;
    const ctxWindow = ctx.data.context_window as Record<string, unknown> | undefined;
    const pctUsed = (ctxWindow?.used_percentage as number) ?? 0;
    const ctxSize = (ctxWindow?.context_window_size as number) ?? 200000;
    const ctxUsed = Math.round((pctUsed * ctxSize) / 100);
    const usableTokens = Math.floor(ctxSize * USABLE_CONTEXT_RATIO);
    const compactPct = Math.max(0, Math.min(100, Math.round(((usableTokens - ctxUsed) / usableTokens) * 100)));

    const text = ctx.options.ctxFormat
      .replace(/\{used\}/g, formatTokens(ctxUsed))
      .replace(/\{total\}/g, formatTokens(ctxSize))
      .replace(/\{pct\}/g, String(pctUsed))
      .replace(/\{compact\}/g, String(compactPct));

    return paint(text, colorForPct(pctUsed));
  },
};
