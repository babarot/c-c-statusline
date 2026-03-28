import { dim, paint } from "../colors.ts";
import type { StatusItem, RenderContext } from "./types.ts";

export const durationItem: StatusItem = {
  id: "duration",
  render(ctx: RenderContext): string | null {
    if (!ctx.sessionDuration) return null;
    return `${dim("\u23F1")} ${paint(ctx.sessionDuration, "muted")}`;
  },
};
