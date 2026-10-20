// @vitest-environment jsdom
import { act, createElement } from "react";
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
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  localStorage.clear(); logout.mockReset();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
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
