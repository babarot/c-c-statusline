import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sessionItem } from "./session.ts";
import type { RenderContext } from "./types.ts";
import { DEFAULT_SESSION, type SessionConfig } from "../config.ts";

const ID = "8045a195-d2a7-49a1-852f-7fff313d4be0";

// deno-lint-ignore no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

function render(data: Record<string, unknown>, session: Partial<SessionConfig> = {}): string | null {
  const ctx = { data, options: { session: { ...DEFAULT_SESSION, ...session } } } as unknown as RenderContext;
  const out = sessionItem.render(ctx);
  return out === null ? null : stripAnsi(out);
}

Deno.test("sessionItem: short shows the first 8 characters", () => {
  assertEquals(render({ session_id: ID }), "# 8045a195");
});

Deno.test("sessionItem: full shows the whole ID", () => {
  assertEquals(render({ session_id: ID }, { format: "full" }), `# ${ID}`);
});

Deno.test("sessionItem: custom prefix", () => {
  assertEquals(render({ session_id: ID }, { prefix: "sid:" }), "sid: 8045a195");
});

Deno.test("sessionItem: empty prefix shows the ID only", () => {
  assertEquals(render({ session_id: ID }, { prefix: "" }), "8045a195");
});

Deno.test("sessionItem: hidden when session_id is missing", () => {
  assertEquals(render({}), null);
  assertEquals(render({ session_id: "" }), null);
  assertEquals(render({ session_id: 123 }), null);
});
