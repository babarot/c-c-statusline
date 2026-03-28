import { paint } from "../colors.ts";
import { formatPath } from "../format.ts";
import type { StatusItem, RenderContext } from "./types.ts";

export const gitStatusItem: StatusItem = {
  id: "git",
  render(ctx: RenderContext): string | null {
    const cwd = (ctx.data.cwd as string) || Deno.cwd();
    const dirname = formatPath(cwd, ctx.options.pathStyle);
    let result = paint(dirname, "secondary");

    const { gitInfo } = ctx;
    if (!gitInfo.branch) return result;

    const branchColor = gitInfo.detached ? "danger" : "success";
    let gitPart = paint(gitInfo.branch, branchColor);

    // State flags
    const gs = ctx.options.gitSymbols;
    const flags: string[] = [];
    if (gitInfo.unstaged) flags.push(paint(gs.unstaged, "danger"));
    if (gitInfo.staged) flags.push(paint(gs.staged, "success"));
    if (gitInfo.stash) flags.push(paint(gs.stash, "primary"));
    if (gitInfo.untracked) flags.push(paint(gs.untracked, "danger"));
    if (flags.length > 0) {
      gitPart += ` ${flags.join("")}`;
    }

    // Upstream: ahead/behind
    const upstream: string[] = [];
    if (gitInfo.ahead > 0) upstream.push(paint(`${gs.ahead}${gitInfo.ahead}`, "success"));
    if (gitInfo.behind > 0) upstream.push(paint(`${gs.behind}${gitInfo.behind}`, "danger"));
    if (upstream.length > 0) {
      gitPart += ` ${upstream.join(" ")}`;
    }

    // Operation: |REBASE, |MERGING, etc.
    if (gitInfo.operation) {
      gitPart += paint(`|${gitInfo.operation}`, "accent");
    }

    result += ` ${paint("(", branchColor)}${gitPart}${paint(")", branchColor)}`;
    return result;
  },
};
