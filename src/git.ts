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
  // Single command: branch, upstream, all file statuses
  const status = await exec(
    ["git", "--no-optional-locks", "-C", cwd, "status", "--porcelain=v2", "--branch", "--show-stash"],
  );
  if (status === null) return { ...emptyInfo };

  let branch: string | null = null;
  let detached = false;
  let ahead = 0;
  let behind = 0;
  let unstaged = false;
  let staged = false;
  let untracked = false;
  let stash = false;
  let oid = "";

  for (const line of status.split("\n")) {
    if (line.startsWith("# branch.head ")) {
      const head = line.slice("# branch.head ".length);
      if (head === "(detached)") {
        detached = true;
      } else {
        branch = head;
      }
    } else if (line.startsWith("# branch.ab ")) {
      const m = line.match(/\+(\d+) -(\d+)/);
      if (m) {
        ahead = parseInt(m[1], 10);
        behind = parseInt(m[2], 10);
      }
    } else if (line.startsWith("# branch.oid ")) {
      oid = line.slice("# branch.oid ".length);
    } else if (line.startsWith("# stash ")) {
      stash = true;
    } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
      // "1 XY ..." ordinary, "2 XY ..." rename/copy
      const xy = line.split(" ")[1];
      if (xy) {
        if (xy[0] !== ".") staged = true;
        if (xy[1] !== ".") unstaged = true;
      }
    } else if (line.startsWith("u ")) {
      // unmerged entry — both staged and unstaged
      staged = true;
      unstaged = true;
    } else if (line.startsWith("? ")) {
      untracked = true;
    }
  }

  // Detached HEAD — describe with tag or short SHA
  if (detached) {
    const described = await exec(
      ["git", "-C", cwd, "describe", "--tags", "--exact-match", "HEAD"],
    ) ?? await exec(
      ["git", "-C", cwd, "describe", "--contains", "--all", "HEAD"],
    );
    const shortSha = oid.slice(0, 7);
    branch = described ? `(${described})` : `(${shortSha}...)`;
  }

  // Detect in-progress operation (needs git dir)
  const gitDirRaw = await exec(["git", "-C", cwd, "rev-parse", "--git-dir"]);
  let operationStr = "";
  if (gitDirRaw) {
    const gitDir = gitDirRaw.startsWith("/") ? gitDirRaw : `${cwd}/${gitDirRaw}`;
    const { operation, step, total } = await detectOperation(gitDir);
    operationStr = operation;
    if (operation && step && total) {
      operationStr = `${operation} ${step}/${total}`;
    }
  }

  return {
    branch,
    detached,
    unstaged,
    staged,
    stash,
    untracked,
    ahead,
    behind,
    operation: operationStr,
  };
}
