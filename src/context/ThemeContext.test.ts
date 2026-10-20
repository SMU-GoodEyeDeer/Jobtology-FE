// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeContext";
import { ThemeToggle } from "../components/ThemeToggle";

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear();
  Reflect.deleteProperty(document, "startViewTransition");
  delete document.documentElement.dataset.theme; delete document.documentElement.dataset.themePreference;
  document.documentElement.style.colorScheme = "";
});
async function render() { await act(async () => root.render(createElement(ThemeProvider, null, createElement(ThemeToggle)))); }
async function toggle() { await act(async () => container.querySelector("button")!.click()); }

it("defaults to light even on a dark OS and exposes a two-state toggle button", async () => {
  await render();
  expect(document.documentElement.dataset.theme).toBe("light");
  const button = container.querySelector("button")!;
  expect(button.getAttribute("type")).toBe("button");
  expect(button.getAttribute("aria-label")).toBe("다크 모드");
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(container.querySelector("select")).toBeNull();
  await toggle(); expect(document.documentElement.dataset.theme).toBe("dark");
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  await toggle(); expect(document.documentElement.dataset.theme).toBe("light");
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(window.matchMedia).not.toHaveBeenCalled();
});
it("persists a choice and restores it on remount", async () => {
  await render(); await toggle(); expect(localStorage.getItem("jobtology.theme")).toBe("dark");
  await act(async () => root.unmount()); root = createRoot(container); await render();
  expect(document.documentElement.dataset.theme).toBe("dark"); expect(container.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
});
it("syncs choices from another tab and defaults to light for removed, legacy system or invalid preferences", async () => {
  await render();
  await act(async () => { localStorage.setItem("jobtology.theme", "dark"); window.dispatchEvent(new StorageEvent("storage", { key: "jobtology.theme", newValue: "dark" })); });
  expect(document.documentElement.dataset.theme).toBe("dark");
  for (const value of ["light", "system", "invalid"]) {
    await act(async () => { localStorage.setItem("jobtology.theme", value); window.dispatchEvent(new StorageEvent("storage", { key: "jobtology.theme", newValue: value })); });
    expect(document.documentElement.dataset.theme).toBe("light"); expect(container.querySelector("button")!.getAttribute("aria-pressed")).toBe("false");
  }
  await toggle();
  await act(async () => { localStorage.clear(); window.dispatchEvent(new StorageEvent("storage", { key: null })); });
  expect(document.documentElement.dataset.theme).toBe("light");
});
it("keeps theme changes usable when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  await render(); expect(document.documentElement.dataset.theme).toBe("light");
  await toggle(); expect(document.documentElement.dataset.theme).toBe("dark");
  await toggle(); expect(document.documentElement.dataset.theme).toBe("light");
});
it("commits both theme directions inside a supported view transition", async () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  const transition = vi.fn((update: () => void) => { update(); return { ready: Promise.resolve() }; });
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: transition });
  await render(); await toggle();
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("jobtology.theme")).toBe("dark");
  await toggle();
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(transition).toHaveBeenCalledTimes(2);
  expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
});
it("switches instantly when reduced motion is requested", async () => {
  const transition = vi.fn();
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: transition });
  await render(); await toggle();
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(transition).not.toHaveBeenCalled();
});
