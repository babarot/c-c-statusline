import { dim, paint } from "../colors.ts";
import type { StatusItem, RenderContext } from "./types.ts";

export const effortItem: StatusItem = {
  id: "effort",
  render(ctx: RenderContext): string | null {
    switch (ctx.effort) {
      case "high":
        return paint(`\u25CF ${ctx.effort}`, "accent");
      case "low":
        return dim(`\u25D4 ${ctx.effort}`);
      default:
        return dim(`\u25D1 ${ctx.effort}`);
    }
  },
};
