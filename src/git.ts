import { exec } from "./exec.ts";

export interface GitSymbols {
  unstaged: string;
  staged: string;
  stash: string;
  untracked: string;
  ahead: string;
  behind: string;
}

export const defaultGitSymbols: GitSymbols = {
  unstaged: "*",
  staged: "+",
  stash: "$",
  untracked: "%",
  ahead: "↑",
  behind: "↓",
};

export function parseGitSymbols(input: string): Partial<GitSymbols> {
  const result: Partial<GitSymbols> = {};
  for (const pair of input.split(",")) {
    const [key, val] = pair.split("=", 2);
    if (key && val !== undefined && key in defaultGitSymbols) {
      result[key as keyof GitSymbols] = val;
    }
  }
  return result;
}

export interface GitInfo {
  /** Branch name, detached HEAD description, or null if not in a repo */
  branch: string | null;
  /** true if HEAD is detached */
  detached: boolean;
  /** Unstaged changes exist */
  unstaged: boolean;
  /** Staged changes exist */
  staged: boolean;
  /** Stash entries exist */
  stash: boolean;
  /** Untracked files exist */
  untracked: boolean;
  /** Commits ahead of upstream */
  ahead: number;
  /** Commits behind upstream */
  behind: number;
  /** In-progress operation (REBASE, MERGING, CHERRY-PICKING, etc.) */
  operation: string;
}

const emptyInfo: GitInfo = {
  branch: null,
  detached: false,
  unstaged: false,
  staged: false,
  stash: false,
  untracked: false,
  ahead: 0,
  behind: 0,
  operation: "",
};

async function readFile(path: string): Promise<string | null> {
  try {
    const text = await Deno.readTextFile(path);
    return text.trim();
  } catch {
    return null;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function detectOperation(gitDir: string): Promise<{ operation: string; step?: string; total?: string }> {
  // Rebase (merge-based)
  if (await exists(`${gitDir}/rebase-merge`)) {
    const step = await readFile(`${gitDir}/rebase-merge/msgnum`);
    const total = await readFile(`${gitDir}/rebase-merge/end`);
    return { operation: "REBASE", step: step ?? undefined, total: total ?? undefined };
  }

  // Rebase (apply-based)
  if (await exists(`${gitDir}/rebase-apply`)) {
    const step = await readFile(`${gitDir}/rebase-apply/next`);
    const total = await readFile(`${gitDir}/rebase-apply/last`);
    if (await exists(`${gitDir}/rebase-apply/rebasing`)) {
      return { operation: "REBASE", step: step ?? undefined, total: total ?? undefined };
    }
    if (await exists(`${gitDir}/rebase-apply/applying`)) {
      return { operation: "AM", step: step ?? undefined, total: total ?? undefined };
    }
    return { operation: "AM/REBASE", step: step ?? undefined, total: total ?? undefined };
  }

  // Merge
  if (await exists(`${gitDir}/MERGE_HEAD`)) {
    return { operation: "MERGING" };
  }

  // Cherry-pick
  if (await exists(`${gitDir}/CHERRY_PICK_HEAD`)) {
    return { operation: "CHERRY-PICKING" };
  }

  // Revert
  if (await exists(`${gitDir}/REVERT_HEAD`)) {
    return { operation: "REVERTING" };
  }

  // Sequencer (cherry-pick/revert in progress via todo)
  const todo = await readFile(`${gitDir}/sequencer/todo`);
  if (todo) {
    const firstLine = todo.split("\n")[0];
    if (firstLine.startsWith("p ") || firstLine.startsWith("pick ")) {
      return { operation: "CHERRY-PICKING" };
    }
    if (firstLine.startsWith("revert ")) {
      return { operation: "REVERTING" };
    }
  }

  // Bisect
  if (await exists(`${gitDir}/BISECT_LOG`)) {
    return { operation: "BISECTING" };
  }

  return { operation: "" };
}

export async function getGitInfo(cwd: string): Promise<GitInfo> {
  // Get git dir and HEAD info in one call
  const revParse = await exec(
    ["git", "-C", cwd, "rev-parse", "--git-dir", "--short", "HEAD"],
  );
  if (!revParse) return { ...emptyInfo };

  const lines = revParse.split("\n");
  const gitDirRaw = lines[0];
  const shortSha = lines[1] ?? "";

  // Resolve git dir to absolute path
  const gitDir = gitDirRaw.startsWith("/")
    ? gitDirRaw
    : `${cwd}/${gitDirRaw}`;

  // Detect branch or detached HEAD
  let branch: string | null = null;
  let detached = false;

  const symbolicRef = await exec(
    ["git", "-C", cwd, "symbolic-ref", "--short", "HEAD"],
  );

  if (symbolicRef) {
    branch = symbolicRef;
  } else {
    // Detached HEAD — try to describe
    detached = true;
    const described = await exec(
      ["git", "-C", cwd, "describe", "--tags", "--exact-match", "HEAD"],
    ) ?? await exec(
      ["git", "-C", cwd, "describe", "--contains", "--all", "HEAD"],
    );
    branch = described ? `(${described})` : `(${shortSha}...)`;
  }

  // Detect in-progress operation
  const { operation, step, total } = await detectOperation(gitDir);
  let operationStr = operation;
  if (operation && step && total) {
    operationStr = `${operation} ${step}/${total}`;
  }

  // Run remaining checks in parallel
  const [diffUnstaged, diffStaged, stashCheck, untrackedCheck, upstreamCount] =
    await Promise.all([
      // Unstaged changes
      exec(["git", "-C", cwd, "diff", "--no-ext-diff", "--quiet"])
        .then((r) => r === null), // exit code != 0 means changes exist... but exec returns null on failure
      // Staged changes
      exec(["git", "-C", cwd, "diff", "--no-ext-diff", "--cached", "--quiet"])
        .then((r) => r === null),
      // Stash
      exec(["git", "-C", cwd, "rev-parse", "--verify", "--quiet", "refs/stash"]),
      // Untracked files
      exec([
        "git", "-C", cwd, "ls-files", "--others", "--exclude-standard",
        "--directory", "--no-empty-directory", "--error-unmatch", ":/*",
      ]),
      // Upstream ahead/behind
      exec(["git", "-C", cwd, "rev-list", "--count", "--left-right", "@{upstream}...HEAD"]),
    ]);

  // diff --quiet returns empty string "" on success (no changes), null on failure (has changes)
  // But exec returns null both for non-zero exit AND for actual errors
  // Let's re-check: exec returns stdout.trim() on success, null on !success
  // git diff --quiet exits 0 (no diff) -> exec returns "" ; exits 1 (has diff) -> exec returns null
  const unstaged = diffUnstaged; // null means exit code != 0 = has changes = true
  const staged = diffStaged;

  // Parse upstream
  let ahead = 0;
  let behind = 0;
  if (upstreamCount) {
    const parts = upstreamCount.split(/\s+/);
    behind = parseInt(parts[0], 10) || 0;
    ahead = parseInt(parts[1], 10) || 0;
  }

  return {
    branch,
    detached,
    unstaged,
    staged,
    stash: !!stashCheck,
    untracked: !!untrackedCheck,
    ahead,
    behind,
    operation: operationStr,
  };
}
