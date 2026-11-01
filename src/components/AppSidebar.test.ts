// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./AppSidebar";
const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock("../context/SessionContext", () => ({ useSession: () => ({ logout }) }));
vi.mock("./ThemeToggle", () => ({ ThemeToggle: () => null }));
let root: Root; let container: HTMLDivElement;
function Location() { return createElement("output", null, useLocation().pathname); }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 1024px)", addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  localStorage.clear(); logout.mockReset();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});

describe("mobile navigation", () => {
  function mobileMedia() {
    const listeners = new Map<string, Set<(event: { matches: boolean }) => void>>();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      addEventListener: (_: string, handler: (event: { matches: boolean }) => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(handler);
      },
      removeEventListener: (_: string, handler: (event: { matches: boolean }) => void) => listeners.get(query)?.delete(handler),
    }));
    return listeners;
  }
  async function renderMobile() {
    await act(async () => root.render(createElement(StrictMode, null, createElement(MemoryRouter, { initialEntries: ["/postings"] }, createElement(AppSidebar, null, createElement("p", null, "내 목표")), createElement(Location)))));
  }
  async function openMenu() {
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="메뉴 열기"]')!.click());
  }
  it("opens a native modal without a sidebar column, closes on navigation, and restores scrolling", async () => {
    mobileMedia(); await renderMobile();
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="메뉴 열기"]')!;
    await openMenu();
    expect(container.querySelector("dialog")?.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(container.textContent).toContain("내 목표");
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("채용공고");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="내 정보"]')!.click());
    expect(container.querySelector("output")?.textContent).toBe("/myinfo");
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
  });
  it("synchronizes Escape/native close, can reopen, and switches back to the desktop sidebar", async () => {
    const listeners = mobileMedia(); await renderMobile(); await openMenu();
    await act(async () => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(container.querySelector("dialog")).toBeNull();
    await openMenu();
    await act(async () => {
      const dialog = container.querySelector("dialog")!;
      dialog.close(); dialog.dispatchEvent(new Event("close"));
    });
    expect(container.querySelector("dialog")).toBeNull();
    await openMenu();
    await act(async () => listeners.get("(max-width: 760px)")!.forEach(handler => handler({ matches: false })));
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.querySelector("aside")).not.toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(container.querySelector('[aria-label="로그아웃"]')).not.toBeNull();
  });
  it("keeps a failed mobile logout retryable inside the menu", async () => {
    mobileMedia(); logout.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    await renderMobile(); await openMenu();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="로그아웃"]')!.click());
    expect(container.querySelector("dialog")?.open).toBe(true);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
    expect(container.querySelector("output")?.textContent).toBe("/");
    expect(container.querySelector("dialog")).toBeNull();
  });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe("sidebar logout", () => {
  it("keeps the current page after failure and provides a visible retry even while collapsed", async () => {
    logout.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/postings"] }, createElement(AppSidebar), createElement(Location))));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="로그아웃"]')!.click());
    expect(container.querySelector("output")?.textContent).toBe("/postings");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("로그아웃을 완료하지 못했어요");
    expect(container.querySelector('[role="alert"]')?.parentElement?.classList.contains("sidebar--collapsed")).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
    expect(logout).toHaveBeenCalledTimes(2);
    expect(container.querySelector("output")?.textContent).toBe("/");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
