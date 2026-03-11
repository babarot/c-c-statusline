import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getGitInfo } from "./git.ts";

// ── Helpers ──────────────────────────────────────────

async function git(dir: string, ...args: string[]): Promise<string> {
  const proc = new Deno.Command("git", {
    args: ["-C", dir, ...args],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await proc.output();
  return new TextDecoder().decode(stdout).trim();
}

async function gitOk(dir: string, ...args: string[]): Promise<void> {
  const proc = new Deno.Command("git", {
    args: ["-C", dir, ...args],
    stdout: "null",
    stderr: "null",
  });
  await proc.output();
}

async function initRepo(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "git_test_" });
  await gitOk(dir, "init", "-b", "main");
  await gitOk(dir, "config", "user.email", "test@test.com");
  await gitOk(dir, "config", "user.name", "Test");
  // Need at least one commit for rev-parse HEAD to work
  await Deno.writeTextFile(`${dir}/README.md`, "init");
  await gitOk(dir, "add", "README.md");
  await gitOk(dir, "commit", "-m", "initial");
  return dir;
}

async function cleanup(dir: string): Promise<void> {
  await Deno.remove(dir, { recursive: true });
}

// ── Non-repo ─────────────────────────────────────────

Deno.test("getGitInfo: returns null branch for non-git directory", async () => {
  const dir = await Deno.makeTempDir({ prefix: "git_test_norepo_" });
  try {
    const info = await getGitInfo(dir);
    assertEquals(info.branch, null);
    assertEquals(info.detached, false);
    assertEquals(info.operation, "");
  } finally {
    await cleanup(dir);
  }
});

// ── Branch detection ─────────────────────────────────

Deno.test("getGitInfo: detects branch name", async () => {
  const dir = await initRepo();
  try {
    const info = await getGitInfo(dir);
    assertEquals(info.branch, "main");
    assertEquals(info.detached, false);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects feature branch", async () => {
  const dir = await initRepo();
  try {
    await gitOk(dir, "checkout", "-b", "feature/awesome");
    const info = await getGitInfo(dir);
    assertEquals(info.branch, "feature/awesome");
    assertEquals(info.detached, false);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects detached HEAD", async () => {
  const dir = await initRepo();
  try {
    const sha = await git(dir, "rev-parse", "HEAD");
    await gitOk(dir, "checkout", sha);
    const info = await getGitInfo(dir);
    assertEquals(info.detached, true);
    // branch should be wrapped in parens
    assertEquals(info.branch?.startsWith("("), true);
    assertEquals(info.branch?.endsWith(")"), true);
  } finally {
    await cleanup(dir);
  }
});

// ── Working tree state ───────────────────────────────

Deno.test("getGitInfo: clean repo has no flags", async () => {
  const dir = await initRepo();
  try {
    const info = await getGitInfo(dir);
    assertEquals(info.unstaged, false);
    assertEquals(info.staged, false);
    assertEquals(info.untracked, false);
    assertEquals(info.stash, false);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects unstaged changes", async () => {
  const dir = await initRepo();
  try {
    await Deno.writeTextFile(`${dir}/README.md`, "modified");
    const info = await getGitInfo(dir);
    assertEquals(info.unstaged, true);
    assertEquals(info.staged, false);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects staged changes", async () => {
  const dir = await initRepo();
  try {
    await Deno.writeTextFile(`${dir}/new.txt`, "staged content");
    await gitOk(dir, "add", "new.txt");
    const info = await getGitInfo(dir);
    assertEquals(info.staged, true);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects untracked files", async () => {
  const dir = await initRepo();
  try {
    await Deno.writeTextFile(`${dir}/untracked.txt`, "new file");
    const info = await getGitInfo(dir);
    assertEquals(info.untracked, true);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects stash entries", async () => {
  const dir = await initRepo();
  try {
    await Deno.writeTextFile(`${dir}/README.md`, "to stash");
    await gitOk(dir, "stash", "push", "-m", "test stash");
    const info = await getGitInfo(dir);
    assertEquals(info.stash, true);
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects both staged and unstaged", async () => {
  const dir = await initRepo();
  try {
    // Stage a change
    await Deno.writeTextFile(`${dir}/new.txt`, "staged");
    await gitOk(dir, "add", "new.txt");
    // Make an unstaged change
    await Deno.writeTextFile(`${dir}/README.md`, "unstaged edit");
    const info = await getGitInfo(dir);
    assertEquals(info.staged, true);
    assertEquals(info.unstaged, true);
  } finally {
    await cleanup(dir);
  }
});

// ── Operation detection ──────────────────────────────

Deno.test("getGitInfo: detects MERGING via MERGE_HEAD", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    // Simulate merge in progress
    const sha = await git(dir, "rev-parse", "HEAD");
    await Deno.writeTextFile(`${gitDir}/MERGE_HEAD`, sha);
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "MERGING");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects CHERRY-PICKING via CHERRY_PICK_HEAD", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    const sha = await git(dir, "rev-parse", "HEAD");
    await Deno.writeTextFile(`${gitDir}/CHERRY_PICK_HEAD`, sha);
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "CHERRY-PICKING");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects REVERTING via REVERT_HEAD", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    const sha = await git(dir, "rev-parse", "HEAD");
    await Deno.writeTextFile(`${gitDir}/REVERT_HEAD`, sha);
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "REVERTING");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects BISECTING via BISECT_LOG", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    await Deno.writeTextFile(`${gitDir}/BISECT_LOG`, "# bisect log");
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "BISECTING");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects REBASE via rebase-merge dir", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    await Deno.mkdir(`${gitDir}/rebase-merge`, { recursive: true });
    await Deno.writeTextFile(`${gitDir}/rebase-merge/msgnum`, "2");
    await Deno.writeTextFile(`${gitDir}/rebase-merge/end`, "5");
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "REBASE 2/5");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects REBASE via rebase-apply with rebasing", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    await Deno.mkdir(`${gitDir}/rebase-apply`, { recursive: true });
    await Deno.writeTextFile(`${gitDir}/rebase-apply/next`, "3");
    await Deno.writeTextFile(`${gitDir}/rebase-apply/last`, "7");
    await Deno.writeTextFile(`${gitDir}/rebase-apply/rebasing`, "");
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "REBASE 3/7");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects AM via rebase-apply with applying", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    await Deno.mkdir(`${gitDir}/rebase-apply`, { recursive: true });
    await Deno.writeTextFile(`${gitDir}/rebase-apply/next`, "1");
    await Deno.writeTextFile(`${gitDir}/rebase-apply/last`, "3");
    await Deno.writeTextFile(`${gitDir}/rebase-apply/applying`, "");
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "AM 1/3");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects sequencer cherry-pick", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    await Deno.mkdir(`${gitDir}/sequencer`, { recursive: true });
    await Deno.writeTextFile(`${gitDir}/sequencer/todo`, "pick abc123 some commit\npick def456 another");
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "CHERRY-PICKING");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: detects sequencer revert", async () => {
  const dir = await initRepo();
  try {
    const gitDir = `${dir}/.git`;
    await Deno.mkdir(`${gitDir}/sequencer`, { recursive: true });
    await Deno.writeTextFile(`${gitDir}/sequencer/todo`, "revert abc123 some commit");
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "REVERTING");
  } finally {
    await cleanup(dir);
  }
});

Deno.test("getGitInfo: no operation on clean repo", async () => {
  const dir = await initRepo();
  try {
    const info = await getGitInfo(dir);
    assertEquals(info.operation, "");
  } finally {
    await cleanup(dir);
  }
});

// ── Ahead / behind ───────────────────────────────────

Deno.test("getGitInfo: detects ahead count", async () => {
  const dir = await initRepo();
  // Create a bare remote to set up upstream tracking
  const remote = await Deno.makeTempDir({ prefix: "git_test_remote_" });
  try {
    await gitOk(remote, "init", "--bare");
    await gitOk(dir, "remote", "add", "origin", remote);
    await gitOk(dir, "push", "-u", "origin", "main");
    // Create a local commit ahead of upstream
    await Deno.writeTextFile(`${dir}/ahead.txt`, "ahead");
    await gitOk(dir, "add", "ahead.txt");
    await gitOk(dir, "commit", "-m", "ahead");
    const info = await getGitInfo(dir);
    assertEquals(info.ahead, 1);
    assertEquals(info.behind, 0);
  } finally {
    await cleanup(dir);
    await cleanup(remote);
  }
});

Deno.test("getGitInfo: detects behind count", async () => {
  const dir = await initRepo();
  const remote = await Deno.makeTempDir({ prefix: "git_test_remote_" });
  try {
    await gitOk(remote, "init", "--bare");
    await gitOk(dir, "remote", "add", "origin", remote);
    await gitOk(dir, "push", "-u", "origin", "main");
    // Clone the remote to make a commit there, then push
    const other = await Deno.makeTempDir({ prefix: "git_test_other_" });
    await gitOk(other, "clone", remote, ".");
    await gitOk(other, "config", "user.email", "test@test.com");
    await gitOk(other, "config", "user.name", "Test");
    await Deno.writeTextFile(`${other}/other.txt`, "other");
    await gitOk(other, "add", "other.txt");
    await gitOk(other, "commit", "-m", "other");
    await gitOk(other, "push");
    // Fetch so our repo knows about the new commit
    await gitOk(dir, "fetch");
    const info = await getGitInfo(dir);
    assertEquals(info.behind, 1);
    assertEquals(info.ahead, 0);
    await cleanup(other);
  } finally {
    await cleanup(dir);
    await cleanup(remote);
  }
});
