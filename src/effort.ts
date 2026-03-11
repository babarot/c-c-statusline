export async function readEffortLevel(): Promise<string> {
  const home = Deno.env.get("HOME") ?? "";
  try {
    const settings = JSON.parse(
      await Deno.readTextFile(`${home}/.claude/settings.json`),
    );
    return settings?.effortLevel ?? "default";
  } catch {
    return "default";
  }
}
