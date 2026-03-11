export async function exec(
  cmd: string[],
  options?: { cwd?: string },
): Promise<string | null> {
  try {
    const proc = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      cwd: options?.cwd,
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await proc.output();
    if (!success) return null;
    return new TextDecoder().decode(stdout).trim();
  } catch {
    return null;
  }
}
