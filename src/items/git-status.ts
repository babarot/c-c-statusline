import { paint } from "../colors.ts";
import { formatPath } from "../format.ts";
import type { RemoteInfo } from "../git.ts";
import type { StatusItem, RenderContext } from "./types.ts";

/** Wrap text with an OSC 8 hyperlink escape so terminals render it as clickable. */
function osc8(url: string, text: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

/** Expand template placeholders. Returns null if any placeholder remains unresolved. */
function expandLinkTemplate(
  template: string,
  remote: RemoteInfo,
  branch: string,
): string | null {
  // Preserve '/' in branch names (e.g., feature/foo → feature/foo)
  const encodedBranch = encodeURIComponent(branch).replace(/%2F/g, "/");
  const url = template
    .replaceAll("{host}", remote.host)
    .replaceAll("{owner}", remote.owner)
    .replaceAll("{repo}", remote.repo)
    .replaceAll("{branch}", encodedBranch);
  if (/\{[^}]+\}/.test(url)) return null;
  return url;
}

export const gitStatusItem: StatusItem = {
  id: "git",
  render(ctx: RenderContext): string | null {
    const cwd = (ctx.data.cwd as string) || Deno.cwd();
    const dirname = formatPath(cwd, ctx.options.pathStyle);
    let result = paint(dirname, "secondary");

    const { gitInfo } = ctx;
    if (!gitInfo.branch) return result;

    const branchColor = gitInfo.detached ? "danger" : "success";
    let branchText = paint(gitInfo.branch, branchColor);

    // OSC 8 hyperlink on branch name (skip when detached or remote info unavailable)
    if (
      ctx.options.gitLink.enabled &&
      !gitInfo.detached &&
      ctx.remoteInfo
    ) {
      const url = expandLinkTemplate(
        ctx.options.gitLink.template,
        ctx.remoteInfo,
        gitInfo.branch,
      );
      if (url) branchText = osc8(url, branchText);
    }

    let gitPart = branchText;

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
