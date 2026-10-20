// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeeklyPlanResponse, WeeklyPlanStep } from "../../services/types";
import { PlanPhases } from "./PlanPhases";
import { RoadmapPlan } from "./RoadmapPlan";
import { roadmapTarget } from "./roadmapTarget";

const state = vi.hoisted(() => ({ plan: null as WeeklyPlanResponse | null }));
vi.mock("./useWeeklyPlan", () => ({ useWeeklyPlan: () => ({ plan: state.plan, loading: false, skills: [], setPlan: () => {} }) }));
vi.mock("./usePlanPreview", () => ({ usePlanPreview: (plan: WeeklyPlanResponse) => ({ plan, pending: false, error: null }) }));
vi.mock("./PlanStepDetail", () => ({ PlanStepDetail: ({ step }: { step: WeeklyPlanStep }) => createElement("aside", { "data-selected-step": step.step_id }, step.title) }));
vi.mock("./PlanWeeks", () => ({ PlanWeeks: () => null }));

const step: WeeklyPlanStep = {
  step_id: "basic", number: 1, recommended_number: 1, title: "기초 학습", name: "역량", requirement_key: "BACKEND:2001020301", state: "TODO",
  phase: "BASIC", ncs_level: 2, field_code: null, field_name: null, hours: 10, recommended_hours: 10, hours_basis: "ESTIMATED", demand_pct: null,
  start_week: 1, end_week: 1, start_date: "2026-10-19", end_date: "2026-10-23", reason: "학습", moved: false,
  prerequisite_step_ids: [], unmet_prerequisite_step_ids: [], completion_criteria: [],
};
const plan: WeeklyPlanResponse = {
  version: 0, roadmap_id: "roadmap", start_date: "2026-10-19", target_date: "2026-11-30", weekly_hours: 10, recommended_weekly_hours: 10, rest_weeks: [],
  is_customized: false, saved_at: null, total_hours: 30, total_weeks: 3, completion_date: "2026-11-02", recommended_completion_date: "2026-11-02",
  schedule_source: "SOLVER", deadline_exceeded: false, days_past_target: 0, has_dependency_violations: false, warnings: [],
  steps: [step, { ...step, step_id: "core-one", title: "핵심 학습", phase: "CORE", ncs_level: 4, number: 2 }, { ...step, step_id: "core-two", title: "핵심 실습", phase: "CORE", ncs_level: 4, number: 3 }],
};
let root: Root; let container: HTMLDivElement;
const scrolledHidden: boolean[] = [];
function ChangeStep() { const navigate = useNavigate(); return createElement("button", { onClick: () => navigate("/roadmap?requirement=BACKEND%3A2001020301&step=core-two") }, "다른 단계 링크"); }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.plan = plan; scrolledHidden.length = 0;
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  HTMLElement.prototype.scrollIntoView = function () { scrolledHidden.push(!!this.closest('[aria-hidden="true"]')); };
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("roadmap step deep links and visible phase scrolling", () => {
  it("selects the exact activity and responds to a new step link for the same competency", async () => {
    await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/roadmap?requirement=BACKEND%3A2001020301&step=core-one"] },
      createElement(RoadmapPlan, { roadmapId: "roadmap", goalId: "goal", children: null, onComplete: async () => {} }), createElement(ChangeStep))));
    expect(container.querySelector("[data-selected-step]")?.getAttribute("data-selected-step")).toBe("core-one");
    await act(async () => Array.from(container.querySelectorAll("button")).find(button => button.textContent === "다른 단계 링크")!.click());
    expect(container.querySelector("[data-selected-step]")?.getAttribute("data-selected-step")).toBe("core-two");
    expect(scrolledHidden.every(hidden => !hidden)).toBe(true);
    expect(roadmapTarget(plan, [], step.requirement_key, null, "missing")).toBeNull();
  });

  it("initially expands both the current and deep-linked phases before effects run", () => {
    const markup = renderToStaticMarkup(createElement(PlanPhases, { plan, selectedId: "core-one", onSelect: () => {} }));
    const template = document.createElement("template"); template.innerHTML = markup;
    expect(template.content.querySelector("#phase-BASIC")?.getAttribute("data-expanded")).toBe("true");
    expect(template.content.querySelector("#phase-CORE")?.getAttribute("data-expanded")).toBe("true");
  });

  it("does not scroll a newly selected row in a collapsed phase and scrolls when reopened", async () => {
    async function render(selectedId: string) { await act(async () => root.render(createElement(PlanPhases, { plan, selectedId, onSelect: () => {} }))); }
    await render("core-one");
    expect(scrolledHidden).toEqual([false]);
    const toggle = () => container.querySelector<HTMLButtonElement>('[aria-controls="phase-CORE"]')!.click();
    await act(async () => toggle());
    scrolledHidden.length = 0;
    await render("core-two");
    expect(scrolledHidden).toEqual([]);
    await act(async () => toggle());
    expect(scrolledHidden).toEqual([false]);
  });
});
