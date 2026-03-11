import { exec } from "./exec.ts";

export interface GitInfo {
  branch: string | null;
  dirty: boolean;
}

export async function getGitInfo(cwd: string): Promise<GitInfo> {
  const branch = await exec(
    ["git", "-C", cwd, "symbolic-ref", "--short", "HEAD"],
  );

  if (!branch) return { branch: null, dirty: false };

  const porcelain = await exec(
    ["git", "-C", cwd, "status", "--porcelain"],
  );

  return { branch, dirty: !!porcelain };
}
