import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveTheme, themes, themeNames } from "./themes.ts";

Deno.test("resolveTheme: returns default theme for 'default'", () => {
  const palette = resolveTheme("default");
  assertEquals(palette, themes["default"]);
});

Deno.test("resolveTheme: returns named theme", () => {
  assertEquals(resolveTheme("tokyo-night"), themes["tokyo-night"]);
  assertEquals(resolveTheme("dracula"), themes["dracula"]);
  assertEquals(resolveTheme("nord"), themes["nord"]);
});

Deno.test("resolveTheme: falls back to default for unknown theme", () => {
  assertEquals(resolveTheme("nonexistent"), themes["default"]);
  assertEquals(resolveTheme(""), themes["default"]);
});

Deno.test("themeNames contains all expected themes", () => {
  assertEquals(themeNames.includes("default"), true);
  assertEquals(themeNames.includes("tokyo-night"), true);
  assertEquals(themeNames.includes("catppuccin-mocha"), true);
  assertEquals(themeNames.includes("dracula"), true);
  assertEquals(themeNames.includes("rose-pine"), true);
  assertEquals(themeNames.length, 13);
});

Deno.test("every theme has all 8 required color roles", () => {
  const roles = ["primary", "secondary", "success", "warning", "caution", "danger", "muted", "accent"] as const;
  for (const name of themeNames) {
    const palette = themes[name];
    for (const role of roles) {
      assertNotEquals(palette[role], undefined, `${name} missing '${role}'`);
      assertEquals(typeof palette[role], "number", `${name}.${role} should be a number`);
    }
  }
});
