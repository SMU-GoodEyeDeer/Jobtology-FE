// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StepState, WeeklyPlanInput, WeeklyPlanResponse } from "../../services/types";
import { roadmapsApi } from "../../services/api";
import { RoadmapPlan } from "./RoadmapPlan";

const state = vi.hoisted(() => ({ plan: null as WeeklyPlanResponse | null }));
vi.mock("../../services/api", () => ({ roadmapsApi: { previewPlan: vi.fn(), savePlan: vi.fn(), resetPlan: vi.fn(), getPlan: vi.fn() } }));
vi.mock("./useWeeklyPlan", () => ({ useWeeklyPlan: () => { const [plan, setPlan] = useState(state.plan); return { plan, setPlan, loading: false, skills: [] }; } }));
vi.mock("./PlanPhases", () => ({ PlanPhases: () => null }));
vi.mock("./PlanStepDetail", () => ({ PlanStepDetail: ({ onComplete }: { onComplete: () => void }) => createElement("button", { onClick: onComplete }, "완료 요청") }));
vi.mock("./PlanWeeks", () => ({ PlanWeeks: ({ draft, onChange }: { draft: WeeklyPlanInput | null; onChange: (draft: WeeklyPlanInput) => void }) => createElement("button", { onClick: () => draft && onChange({ ...draft, weekly_hours: 20 }) }, "시간 변경") }));
const saved: WeeklyPlanResponse = {
  version: 1, roadmap_id: "roadmap", start_date: "2026-10-19", target_date: null, weekly_hours: 10, recommended_weekly_hours: 10, rest_weeks: [], is_customized: false, saved_at: null, total_hours: 10, total_weeks: 1, completion_date: "2026-10-25", recommended_completion_date: "2026-10-25", schedule_source: "SOLVER", deadline_exceeded: false, days_past_target: 0, has_dependency_violations: false, warnings: [],
  steps: [{ step_id: "step", number: 1, recommended_number: 1, title: "학습", name: "학습", completion_criteria: [], requirement_key: null, state: "TODO", phase: "CORE", ncs_level: null, field_code: null, field_name: null, hours: 10, recommended_hours: 10, hours_basis: "ESTIMATED", demand_pct: null, start_week: 1, end_week: 1, start_date: "2026-10-19", end_date: "2026-10-25", reason: "", moved: false, prerequisite_step_ids: [], unmet_prerequisite_step_ids: [] }],
};
const latest = { ...saved, version: 2, is_customized: true, weekly_hours: 15 };
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); state.plan = saved;
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  vi.mocked(roadmapsApi.getPlan).mockReset().mockResolvedValue(latest);
  vi.mocked(roadmapsApi.previewPlan).mockReset().mockImplementation(async (_id, input) => ({ ...latest, weekly_hours: input?.weekly_hours ?? 10 }));
  vi.mocked(roadmapsApi.savePlan).mockReset().mockRejectedValueOnce(Object.assign(new Error("conflict"), { status: 409 })).mockResolvedValue({ ...latest, version: 3, weekly_hours: 20 });
  vi.mocked(roadmapsApi.resetPlan).mockReset().mockRejectedValueOnce(Object.assign(new Error("conflict"), { status: 409 })).mockResolvedValue({ ...saved, version: 3 });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function render(onComplete: (id: string, state: StepState) => Promise<void> = async () => {}) { await act(async () => root.render(createElement(MemoryRouter, null, createElement(RoadmapPlan, { roadmapId: "roadmap", goalId: "goal", children: null, onComplete })))); }
async function click(text: string) { await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click()); }
async function preview() { await act(async () => vi.advanceTimersByTimeAsync(250)); }

describe("weekly plan conflict recovery", () => {
  it.each([false, true])("reloads a completion conflict without creating an edit draft (reload failure: %s)", async reloadFails => {
    const onComplete = vi.fn().mockRejectedValue(Object.assign(new Error("conflict"), { status: 409 }));
    if (reloadFails) vi.mocked(roadmapsApi.getPlan).mockRejectedValueOnce(new Error("offline"));
    await render(onComplete); await click("완료 요청");
    expect(onComplete).toHaveBeenCalledWith("step", "TODO");
    expect(roadmapsApi.getPlan).toHaveBeenCalledWith("roadmap");
    expect(container.querySelector(".wp-summary")?.textContent).toContain(`${reloadFails ? 10 : 15}시간`);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(reloadFails ? "현재 플랜을 유지했어요" : "학습 진행 상태가 변경되어 최신 플랜");
    expect(container.querySelector(".wp-save-bar")).toBeNull();
    expect(container.textContent).not.toContain("수정 중 · 저장 전");
    expect(container.textContent).not.toContain("검토한 뒤 저장을 다시 눌러");
    expect(vi.mocked(roadmapsApi.previewPlan).mock.calls.every(([, input]) => input === null)).toBe(true);
    expect(roadmapsApi.savePlan).not.toHaveBeenCalled();
  });
  it("uses a progress-specific failure message for a rejected completion", async () => {
    await render(vi.fn().mockRejectedValue(Object.assign(new Error("invalid progress"), { status: 422 })));
    await click("완료 요청");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("학습 진행 상태를 변경하지 못했어요");
    expect(container.textContent).not.toContain("학습 시간은 바꿀 수 없어요");
    expect(container.querySelector(".wp-save-bar")).toBeNull();
    expect(roadmapsApi.getPlan).not.toHaveBeenCalled();
  });
  it("reloads the latest version, preserves a draft, and waits for explicit save after review", async () => {
    await render(); await click("플랜 수정"); await preview(); await click("시간 변경"); await preview(); await click("저장");
    expect(roadmapsApi.savePlan).toHaveBeenCalledWith("roadmap", expect.objectContaining({ expected_version: 1, weekly_hours: 20 }));
    expect(roadmapsApi.getPlan).toHaveBeenCalledWith("roadmap");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("검토한 뒤 저장을 다시 눌러");
    await preview();
    expect(roadmapsApi.previewPlan).toHaveBeenLastCalledWith("roadmap", expect.objectContaining({ expected_version: 2, weekly_hours: 20 }));
    expect(roadmapsApi.savePlan).toHaveBeenCalledTimes(1);
    await click("저장");
    expect(roadmapsApi.savePlan).toHaveBeenLastCalledWith("roadmap", expect.objectContaining({ expected_version: 2, weekly_hours: 20 }));
  });
  it("reloads a conflicting reset and waits for review before resetting the new version", async () => {
    state.plan = { ...saved, is_customized: true };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await render(); await click("추천 플랜 다시 보기");
    expect(roadmapsApi.resetPlan).toHaveBeenCalledWith("roadmap", 1);
    expect(roadmapsApi.getPlan).toHaveBeenCalledWith("roadmap");
    await preview();
    expect(roadmapsApi.resetPlan).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("최신 플랜");
    await click("저장");
    expect(roadmapsApi.resetPlan).toHaveBeenLastCalledWith("roadmap", 2);
    expect(roadmapsApi.savePlan).not.toHaveBeenCalled();
  });
  it("keeps completed hours read-only", async () => {
    const { PlanWeeks } = await vi.importActual<typeof import("./PlanWeeks")>("./PlanWeeks");
    const completed = { ...saved, steps: [{ ...saved.steps[0], state: "COMPLETED" as const, hours: 8 }] };
    const markup = renderToStaticMarkup(createElement(PlanWeeks, { plan: completed, draft: { expected_version: 1, weekly_hours: 10, rest_weeks: [], order: ["step"], hours: {} }, changedIds: new Set<string>(), busy: false, onChange: vi.fn(), onSelect: vi.fn() }));
    const template = document.createElement("template"); template.innerHTML = markup;
    const input = template.content.querySelector<HTMLInputElement>('[aria-label="학습 학습 시간"]')!;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe("8");
    expect(template.content.textContent).toContain("완료 기록 유지");
  });
});
