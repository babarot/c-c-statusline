import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getOAuthToken } from "./oauth.ts";

// ── Mock helper ──────────────────────────────────────

/**
 * Replace Deno.Command with a fake that intercepts specific commands.
 * Returns a restore function.
 */
function mockCommand(
  handler: (cmd: string, args: string[]) => { success: boolean; stdout: string },
): () => void {
  const Original = Deno.Command;

  // deno-lint-ignore no-explicit-any
  (Deno as any).Command = class FakeCommand {
    #cmd: string;
    #args: string[];
    #opts: Record<string, unknown>;

    constructor(cmd: string, opts?: Record<string, unknown>) {
      this.#cmd = cmd;
      this.#args = (opts?.args as string[]) ?? [];
      this.#opts = opts ?? {};
    }

    output(): Promise<{ success: boolean; stdout: Uint8Array; stderr: Uint8Array }> {
      const result = handler(this.#cmd, this.#args);
      return Promise.resolve({
        success: result.success,
        stdout: new TextEncoder().encode(result.stdout),
        stderr: new Uint8Array(),
      });
    }
  };

  return () => {
    // deno-lint-ignore no-explicit-any
    (Deno as any).Command = Original;
  };
}

// ── Tests ────────────────────────────────────────────

Deno.test("getOAuthToken: returns env var when CLAUDE_CODE_OAUTH_TOKEN is set", async () => {
  const original = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  try {
    Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", "test-token-from-env");
    const token = await getOAuthToken();
    assertEquals(token, "test-token-from-env");
  } finally {
    if (original) {
      Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", original);
    } else {
      Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");
    }
  }
});

Deno.test("getOAuthToken: reads from keychain when env var is not set", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");

  const restore = mockCommand((cmd, args) => {
    if (cmd === "security" && args.includes("find-generic-password")) {
      return {
        success: true,
        stdout: JSON.stringify({
          claudeAiOauth: { accessToken: "keychain-token-123" },
        }),
      };
    }
    return { success: false, stdout: "" };
  });

  try {
    const token = await getOAuthToken();
    assertEquals(token, "keychain-token-123");
  } finally {
    restore();
    if (originalEnv) {
      Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    }
  }
});

Deno.test("getOAuthToken: skips keychain token with value 'null'", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  const originalHome = Deno.env.get("HOME");
  Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");

  // Point HOME to a temp dir without credentials
  const tmpHome = await Deno.makeTempDir({ prefix: "oauth_test_" });
  Deno.env.set("HOME", tmpHome);

  const restore = mockCommand((cmd, args) => {
    if (cmd === "security" && args.includes("find-generic-password")) {
      return {
        success: true,
        stdout: JSON.stringify({
          claudeAiOauth: { accessToken: "null" },
        }),
      };
    }
    return { success: false, stdout: "" };
  });

  try {
    const token = await getOAuthToken();
    assertEquals(token, "");
  } finally {
    restore();
    if (originalEnv) Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    if (originalHome) Deno.env.set("HOME", originalHome);
    await Deno.remove(tmpHome, { recursive: true });
  }
});

Deno.test("getOAuthToken: reads from credentials file when keychain fails", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  const originalHome = Deno.env.get("HOME");
  Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");

  const tmpHome = await Deno.makeTempDir({ prefix: "oauth_test_" });
  Deno.env.set("HOME", tmpHome);

  // Create credentials file
  await Deno.mkdir(`${tmpHome}/.claude`, { recursive: true });
  await Deno.writeTextFile(
    `${tmpHome}/.claude/.credentials.json`,
    JSON.stringify({ claudeAiOauth: { accessToken: "file-token-456" } }),
  );

  // Mock security to fail
  const restore = mockCommand(() => ({ success: false, stdout: "" }));

  try {
    const token = await getOAuthToken();
    assertEquals(token, "file-token-456");
  } finally {
    restore();
    if (originalEnv) Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    if (originalHome) Deno.env.set("HOME", originalHome);
    await Deno.remove(tmpHome, { recursive: true });
  }
});

Deno.test("getOAuthToken: skips credentials file token with value 'null'", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  const originalHome = Deno.env.get("HOME");
  Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");

  const tmpHome = await Deno.makeTempDir({ prefix: "oauth_test_" });
  Deno.env.set("HOME", tmpHome);

  await Deno.mkdir(`${tmpHome}/.claude`, { recursive: true });
  await Deno.writeTextFile(
    `${tmpHome}/.claude/.credentials.json`,
    JSON.stringify({ claudeAiOauth: { accessToken: "null" } }),
  );

  const restore = mockCommand(() => ({ success: false, stdout: "" }));

  try {
    const token = await getOAuthToken();
    assertEquals(token, "");
  } finally {
    restore();
    if (originalEnv) Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    if (originalHome) Deno.env.set("HOME", originalHome);
    await Deno.remove(tmpHome, { recursive: true });
  }
});

Deno.test("getOAuthToken: returns empty when nothing is available", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  const originalHome = Deno.env.get("HOME");
  Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");

  const tmpHome = await Deno.makeTempDir({ prefix: "oauth_test_" });
  Deno.env.set("HOME", tmpHome);

  const restore = mockCommand(() => ({ success: false, stdout: "" }));

  try {
    const token = await getOAuthToken();
    assertEquals(token, "");
  } finally {
    restore();
    if (originalEnv) Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    if (originalHome) Deno.env.set("HOME", originalHome);
    await Deno.remove(tmpHome, { recursive: true });
  }
});

Deno.test("getOAuthToken: handles malformed keychain JSON gracefully", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  const originalHome = Deno.env.get("HOME");
  Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");

  const tmpHome = await Deno.makeTempDir({ prefix: "oauth_test_" });
  Deno.env.set("HOME", tmpHome);

  const restore = mockCommand((cmd) => {
    if (cmd === "security") {
      return { success: true, stdout: "not valid json{{{" };
    }
    return { success: false, stdout: "" };
  });

  try {
    const token = await getOAuthToken();
    assertEquals(token, "");
  } finally {
    restore();
    if (originalEnv) Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    if (originalHome) Deno.env.set("HOME", originalHome);
    await Deno.remove(tmpHome, { recursive: true });
  }
});

Deno.test("getOAuthToken: handles malformed credentials file gracefully", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  const originalHome = Deno.env.get("HOME");
  Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");

  const tmpHome = await Deno.makeTempDir({ prefix: "oauth_test_" });
  Deno.env.set("HOME", tmpHome);

  await Deno.mkdir(`${tmpHome}/.claude`, { recursive: true });
  await Deno.writeTextFile(`${tmpHome}/.claude/.credentials.json`, "{broken json");

  const restore = mockCommand(() => ({ success: false, stdout: "" }));

  try {
    const token = await getOAuthToken();
    assertEquals(token, "");
  } finally {
    restore();
    if (originalEnv) Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    if (originalHome) Deno.env.set("HOME", originalHome);
    await Deno.remove(tmpHome, { recursive: true });
  }
});

Deno.test("getOAuthToken: priority order - env > keychain > file", async () => {
  const originalEnv = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  const originalHome = Deno.env.get("HOME");

  const tmpHome = await Deno.makeTempDir({ prefix: "oauth_test_" });
  Deno.env.set("HOME", tmpHome);

  await Deno.mkdir(`${tmpHome}/.claude`, { recursive: true });
  await Deno.writeTextFile(
    `${tmpHome}/.claude/.credentials.json`,
    JSON.stringify({ claudeAiOauth: { accessToken: "file-token" } }),
  );

  const restore = mockCommand((cmd) => {
    if (cmd === "security") {
      return {
        success: true,
        stdout: JSON.stringify({ claudeAiOauth: { accessToken: "keychain-token" } }),
      };
    }
    return { success: false, stdout: "" };
  });

  try {
    // env var takes priority over everything
    Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", "env-token");
    assertEquals(await getOAuthToken(), "env-token");
  } finally {
    restore();
    if (originalEnv) {
      Deno.env.set("CLAUDE_CODE_OAUTH_TOKEN", originalEnv);
    } else {
      Deno.env.delete("CLAUDE_CODE_OAUTH_TOKEN");
    }
    if (originalHome) Deno.env.set("HOME", originalHome);
    await Deno.remove(tmpHome, { recursive: true });
  }
});
