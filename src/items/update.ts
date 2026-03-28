import { paint } from "../colors.ts";
import type { StatusItem, RenderContext } from "./types.ts";

export const updateItem: StatusItem = {
  id: "update",
  render(ctx: RenderContext): string | null {
    if (!ctx.updateInfo?.available) return null;
    return paint(`\u2191 ${ctx.updateInfo.latest}`, "accent");
  },
};
