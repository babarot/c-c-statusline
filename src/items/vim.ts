import { paint } from "../colors.ts";
import type { StatusItem, RenderContext } from "./types.ts";

export const vimItem: StatusItem = {
  id: "vim",
  render(ctx: RenderContext): string | null {
    const vimMode = (ctx.data.vim as Record<string, string>)?.mode;
    if (!vimMode || ctx.options.vimMode === "off") return null;

    const show = ctx.options.vimMode === "always" ||
      (ctx.options.vimMode === "auto" && vimMode === "NORMAL");
    if (!show) return null;

    const vimColor = vimMode === "INSERT" ? "success" : "primary";
    return paint(vimMode, vimColor);
  },
};
