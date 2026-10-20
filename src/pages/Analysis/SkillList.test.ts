// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "../../services/types";
import { skillIdentity } from "../../services/skillDetail";
import { SkillList } from "./SkillList";
vi.mock("./useSkillResources", () => ({ prefetchSkillResources: vi.fn().mockResolvedValue([]), useActiveSkillRoadmap: () => ({ state: "ready", data: null }) }));
vi.mock("./SkillDetailPanel", () => ({ SkillDetailPanel: ({ skill, onClose }: { skill: Skill; onClose: () => void }) => createElement("aside", { "data-selected-skill": skillIdentity(skill) }, skill.name, createElement("button", { onClick: onClose }, "패널 닫기")) }));
vi.mock("motion/react", () => ({
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: new Proxy({}, { get: (_, tag: string) => ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: Record<string, unknown> & { children: ReactNode }) => createElement(tag, props, children) }),
}));
const skills: Skill[] = [
  { name: "같은 이름", type: "필수", requirement_key: "BACKEND:2001020301", ncs_base_code: "2001020301" },
  { name: "같은 이름", type: "우대", requirement_key: "BACKEND:2001020302", ncs_base_code: "2001020302" },
];
let root: Root; let container: HTMLDivElement; const scroll = vi.fn();
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  HTMLElement.prototype.scrollIntoView = scroll; scroll.mockReset();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(query: string, items = skills, linksReady = true) {
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: [`/analysis?${query}`] }, createElement(SkillList, { skills: items, goalId: "goal", emptyMessage: "empty", linksReady }))));
}
describe("analysis competency deep links", () => {
  it("selects only the requested NCS skill when legacy skills share a name and lack requirement keys", async () => {
    const legacy = skills.map(({ requirement_key: _key, ...skill }) => skill);
    await render("ncs=2001020302", legacy);
    expect(container.querySelector("[data-selected-skill]")?.getAttribute("data-selected-skill")).toBe("2001020302");
    expect(container.querySelectorAll('.sd-row[aria-pressed="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('.sd-row--linked')).toHaveLength(1);
    const firstRow = container.querySelector<HTMLButtonElement>(".sd-row")!;
    await act(async () => firstRow.click());
    expect(container.querySelector("[data-selected-skill]")?.getAttribute("data-selected-skill")).toBe("2001020301");
  });
  it("selects, highlights and scrolls the exact identity, not a matching label", async () => {
    await render("requirement=BACKEND%3A2001020302");
    expect(container.querySelector("[data-selected-skill]")?.getAttribute("data-selected-skill")).toBe("BACKEND:2001020302");
    expect(container.querySelector(".sd-row--linked")?.getAttribute("data-requirement")).toBe("BACKEND:2001020302");
    expect(scroll).toHaveBeenCalled();
    await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "패널 닫기")!.click());
    expect(container.querySelector("[data-selected-skill]")).toBeNull();
  });
  it("waits for asynchronous analysis data then resolves an exact NCS fallback", async () => {
    await render("ncs=2001020301", [], false);
    expect(container.querySelector(".sd-link-notice")).toBeNull();
    await render("ncs=2001020301", skills, true);
    expect(container.querySelector("[data-selected-skill]")?.getAttribute("data-selected-skill")).toBe("BACKEND:2001020301");
  });
  it("waits until hidden loading content is revealed", async () => {
    const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const strict = (linksReady: boolean) => createElement(StrictMode, null, createElement(MemoryRouter, { initialEntries: ["/analysis?requirement=BACKEND%3A2001020301"] }, createElement(SkillList, { skills, goalId: "goal", emptyMessage: "empty", linksReady })));
    await act(async () => root.render(strict(false)));
    expect(container.querySelector("[data-selected-skill]")).toBeNull();
    await act(async () => root.render(strict(true)));
    await act(async () => { for (const callback of frames.values()) callback(0); });
    expect(scroll).toHaveBeenCalledOnce();
    expect(scroll).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    expect(container.querySelector("[data-selected-skill]")?.getAttribute("data-selected-skill")).toBe("BACKEND:2001020301");
  });
  it("retains the scroll scheduled during a StrictMode initial mount", async () => {
    const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    await act(async () => root.render(createElement(StrictMode, null, createElement(MemoryRouter, { initialEntries: ["/analysis?requirement=BACKEND%3A2001020301"] }, createElement(SkillList, { skills, goalId: "goal", emptyMessage: "empty", linksReady: true })))));
    expect(frames.size).toBe(1);
    await act(async () => { for (const callback of frames.values()) callback(0); });
    expect(scroll).toHaveBeenCalledOnce();
  });
  it("shows missing-target feedback without choosing a similarly named or other-role skill", async () => {
    await render("requirement=OTHER%3A2001020301&ncs=2001020301");
    expect(container.querySelector("[data-selected-skill]")).toBeNull();
    expect(container.querySelector(".sd-link-notice")?.textContent).toContain("현재 목표의 부족한 역량 목록에 없어요");
  });
});
