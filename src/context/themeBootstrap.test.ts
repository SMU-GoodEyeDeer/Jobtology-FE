/// <reference types="node" />
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

const bootstrap = readFileSync(new URL("../../public/theme-init.js", import.meta.url), "utf8");
it.each([
  ["dark", false, "dark"], ["light", true, "light"], [null, true, "light"], ["system", true, "light"], ["invalid", true, "light"],
])("applies stored %s and system dark=%s before React starts", (stored, systemDark, expected) => {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  runInNewContext(bootstrap, { localStorage: { getItem: () => stored }, window: { matchMedia: () => ({ matches: systemDark }) }, document: { documentElement: root } });
  expect(root.dataset.theme).toBe(expected); expect(root.style.colorScheme).toBe(expected);
});
it("defaults to light even when reading storage throws", () => {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  runInNewContext(bootstrap, { localStorage: { getItem() { throw new Error("blocked"); } }, window: { matchMedia: () => ({ matches: true }) }, document: { documentElement: root } });
  expect(root.dataset.theme).toBe("light"); expect(root.dataset.themePreference).toBe("light");
});
