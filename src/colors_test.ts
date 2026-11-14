import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { colorForPace, colorForPct, setTheme } from "./colors.ts";

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

Deno.test("colorForPace: under or near an even pace is success", () => {
  assertEquals(colorForPace(-40), "success");
  assertEquals(colorForPace(0), "success");
  assertEquals(colorForPace(2.9), "success");
});

Deno.test("colorForPace: ahead of the pace is caution, then danger past 15pt", () => {
  assertEquals(colorForPace(3), "caution");
  assertEquals(colorForPace(15), "caution");
  assertEquals(colorForPace(15.1), "danger");
});

Deno.test("colorForPace: a used-up window is danger even on pace", () => {
  assertEquals(colorForPace(0, 100), "danger");
  assertEquals(colorForPace(-5, 99), "success");
});
