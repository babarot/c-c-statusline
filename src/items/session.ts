import { dim, paint } from "../colors.ts";
import type { StatusItem, RenderContext } from "./types.ts";

/** Length of the session ID prefix shown in "short" format. */
const SHORT_LENGTH = 8;

export const sessionItem: StatusItem = {
  id: "session",
  render(ctx: RenderContext): string | null {
    const id = ctx.data.session_id;
    if (typeof id !== "string" || !id) return null;
    const { format, prefix } = ctx.options.session;
    const shown = paint(format === "full" ? id : id.slice(0, SHORT_LENGTH), "muted");
    return prefix ? `${dim(prefix)} ${shown}` : shown;
  },
};
