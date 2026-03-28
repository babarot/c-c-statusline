import { paint } from "../colors.ts";
import type { StatusItem, RenderContext } from "./types.ts";

export const modelItem: StatusItem = {
  id: "model",
  render(ctx: RenderContext): string | null {
    if (ctx.options.modelName === "off") return null;
    const name =
      (ctx.data.model as Record<string, string>)?.display_name ?? "Claude";
    return paint(name, "primary");
  },
};
