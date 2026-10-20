// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeContext";
import { ThemeSelect } from "../components/ThemeSelect";

let root: Root, container: HTMLDivElement, dark: boolean;
let listeners: Set<() => void>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); dark = false; listeners = new Set();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return dark; }, addEventListener: (_type: string, callback: () => void) => listeners.add(callback), removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback) })));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear();
  delete document.documentElement.dataset.theme; delete document.documentElement.dataset.themePreference;
  document.documentElement.style.colorScheme = "";
});
async function render() { await act(async () => root.render(createElement(ThemeProvider, null, createElement(ThemeSelect)))); }
async function choose(value: string) { await act(async () => { const select = container.querySelector("select")!; select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); }); }
async function system(value: boolean) { await act(async () => { dark = value; for (const listener of listeners) listener(); }); }

it("follows OS changes until an explicit preference is chosen, then returns to system mode", async () => {
  dark = true; await render();
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(container.querySelector("select")!.value).toBe("system");
  await system(false); expect(document.documentElement.dataset.theme).toBe("light");
  await choose("light"); await system(true);
  expect(document.documentElement.dataset.theme).toBe("light");
  await choose("system"); expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
});
it("persists a choice and restores it on remount", async () => {
  await render(); await choose("dark"); expect(localStorage.getItem("jobtology.theme")).toBe("dark");
  await act(async () => root.unmount()); root = createRoot(container); await render();
  expect(document.documentElement.dataset.theme).toBe("dark"); expect(container.querySelector("select")!.value).toBe("dark");
});
it("syncs choices from another tab and falls back to the OS for removed or invalid preferences", async () => {
  await render();
  await act(async () => { localStorage.setItem("jobtology.theme", "dark"); window.dispatchEvent(new StorageEvent("storage", { key: "jobtology.theme", newValue: "dark" })); });
  expect(document.documentElement.dataset.theme).toBe("dark");
  await act(async () => { localStorage.setItem("jobtology.theme", "invalid"); window.dispatchEvent(new StorageEvent("storage", { key: "jobtology.theme", newValue: "invalid" })); });
  expect(document.documentElement.dataset.theme).toBe("light"); expect(container.querySelector("select")!.value).toBe("system");
  await system(true);
  await act(async () => { localStorage.clear(); window.dispatchEvent(new StorageEvent("storage", { key: null })); });
  expect(document.documentElement.dataset.theme).toBe("dark");
});
it("keeps theme changes usable when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  await render(); await choose("dark"); expect(document.documentElement.dataset.theme).toBe("dark");
  await choose("light"); expect(document.documentElement.dataset.theme).toBe("light");
});
