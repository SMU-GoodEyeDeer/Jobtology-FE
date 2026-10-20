// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapDetailResponse, Skill } from "../../services/types";
import { SkillDetailPanel } from "./SkillDetailPanel";

const evidence = vi.hoisted(() => ({ ready: true }));
vi.mock("./useSkillResources", () => ({
  useSkillEvidenceReady: () => evidence.ready,
  useDefinition: () => ({ state: "missing" }),
  useExamSessions: () => ({ state: "ready", data: { items: [], sources: [] } }),
}));

const skill: Skill = { name: "요구사항 확인", type: "필수", requirement_key: "BACKEND:2001020301", ncs_base_code: "2001020301", ncs_level: 4 };
const roadmap: RoadmapDetailResponse = {
  roadmap_id: "roadmap", version: 1, goal_id: "goal", title: "로드맵", status: "ACTIVE",
  steps: ["study", "project:실습/a?b&c"].map((step_id, position) => ({
    step_id, position, title: step_id, description: null, state: "TODO",
    outcomes: [{ requirement_key: skill.requirement_key! }],
  })),
};
let root: Root; let container: HTMLDivElement;
function Location() { const location = useLocation(); return createElement("output", null, location.pathname + location.search); }
async function render(item = skill, loading = false) {
  await act(async () => root.render(createElement(MemoryRouter, null,
    createElement(SkillDetailPanel, { skill: item, overlay: true, onClose: () => {}, roadmap: loading ? { state: "loading" } : { state: "ready", data: roadmap } }),
    createElement(Location),
  )));
}
function tab(shiftKey = false) {
  const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
  document.activeElement!.dispatchEvent(event);
  return event;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  evidence.ready = true;
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  // jsdom has no layout; provide geometry for visible controls only.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
    return (this.closest("[hidden]") ? [] : [new DOMRect(0, 0, 10, 10)]) as unknown as DOMRectList;
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("skill detail navigation and keyboard focus", () => {
  it("uses the exact NCS fallback in the footer and retains the loading disabled state", async () => {
    const legacy = { ...skill, requirement_key: undefined };
    await render(legacy, true);
    expect(container.querySelector<HTMLButtonElement>(".sd-panel-footer button")!.disabled).toBe(true);
    await render(legacy);
    const footer = container.querySelector<HTMLButtonElement>(".sd-panel-footer button")!;
    expect(footer.disabled).toBe(false);
    await act(async () => footer.click());
    expect(container.querySelector("output")!.textContent).toBe("/roadmap?ncs=2001020301");
  });

  it("passes the chosen step ID when two roadmap activities cover the same requirement", async () => {
    await render();
    const buttons = container.querySelectorAll<HTMLButtonElement>(".sd-step-link");
    expect(buttons).toHaveLength(2);
    await act(async () => buttons[1]!.click());
    const params = new URL(container.querySelector("output")!.textContent!, "https://app.example").searchParams;
    expect(params.get("requirement")).toBe(skill.requirement_key);
    expect(params.get("step")).toBe(roadmap.steps[1]!.step_id);
  });

  it("cycles only through visible controls while evidence content is hidden", async () => {
    evidence.ready = false;
    await render();
    const close = container.querySelector<HTMLButtonElement>(".sd-close")!;
    expect(document.activeElement).toBe(container.querySelector("h2"));
    expect(container.querySelector(".sd-panel-content")!.hasAttribute("hidden")).toBe(true);
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
  });

  it("wraps between the visible first and last controls once content is ready", async () => {
    await render();
    const close = container.querySelector<HTMLButtonElement>(".sd-close")!;
    const footer = container.querySelector<HTMLButtonElement>(".sd-panel-footer button")!;
    close.focus();
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(footer);
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
  });
});
