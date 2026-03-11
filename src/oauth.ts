import { exec } from "./exec.ts";

export async function getOAuthToken(): Promise<string> {
  const envToken = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  if (envToken) return envToken;

  // macOS Keychain
  const blob = await exec([
    "security", "find-generic-password", "-s", "Claude Code-credentials", "-w",
  ]);
  if (blob) {
    try {
      const token = JSON.parse(blob)?.claudeAiOauth?.accessToken;
      if (token && token !== "null") return token;
    } catch { /* ignore */ }
  }

  // Credentials file
  const home = Deno.env.get("HOME") ?? "";
  try {
    const text = await Deno.readTextFile(`${home}/.claude/.credentials.json`);
    const token = JSON.parse(text)?.claudeAiOauth?.accessToken;
    if (token && token !== "null") return token;
  } catch { /* ignore */ }

  return "";
}
