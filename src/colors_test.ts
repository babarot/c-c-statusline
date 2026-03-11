import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { colorForPct, setTheme } from "./colors.ts";

Deno.test("colorForPct: returns success for low usage", () => {
  assertEquals(colorForPct(0), "success");
  assertEquals(colorForPct(10), "success");
  assertEquals(colorForPct(49), "success");
});

Deno.test("colorForPct: returns warning for 50-69%", () => {
  assertEquals(colorForPct(50), "warning");
  assertEquals(colorForPct(69), "warning");
});

Deno.test("colorForPct: returns caution for 70-89%", () => {
  assertEquals(colorForPct(70), "caution");
  assertEquals(colorForPct(89), "caution");
});

Deno.test("colorForPct: returns danger for 90%+", () => {
  assertEquals(colorForPct(90), "danger");
  assertEquals(colorForPct(100), "danger");
});

Deno.test("setTheme: does not throw for valid theme", () => {
  setTheme("tokyo-night");
  setTheme("default");
});

Deno.test("setTheme: does not throw for unknown theme (falls back)", () => {
  setTheme("unknown-theme");
});
