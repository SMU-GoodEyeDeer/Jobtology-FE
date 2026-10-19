// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeeklyPlanInput, WeeklyPlanResponse } from "../../services/types";
import { planInput } from "../../services/weeklyPlan";
import { usePlanPreview } from "./usePlanPreview";

const { previewPlan } = vi.hoisted(() => ({ previewPlan: vi.fn<(id: string, input: WeeklyPlanInput | null) => Promise<WeeklyPlanResponse>>() }));
vi.mock("../../services/api", () => ({ roadmapsApi: { previewPlan } }));

const saved: WeeklyPlanResponse = {
  roadmap_id: "roadmap", start_date: "2026-10-19", target_date: "2026-11-01", weekly_hours: 10,
  recommended_weekly_hours: 10, rest_weeks: [], is_customized: false, saved_at: null,
  total_hours: 10, total_weeks: 2, completion_date: "2026-10-29", recommended_completion_date: "2026-10-29",
  schedule_source: "SOLVER", deadline_exceeded: false, days_past_target: 0, has_dependency_violations: false, warnings: [],
  steps: [{ step_id: "step", number: 1, recommended_number: 1, title: "Study", name: "Study", completion_criteria: [], requirement_key: null,
    state: "TODO", phase: "CORE", ncs_level: null, field_code: null, field_name: null, hours: 10, recommended_hours: 10,
    hours_basis: "ESTIMATED", demand_pct: null, start_week: 2, end_week: 2, start_date: "2026-10-27", end_date: "2026-10-29",
    reason: "", moved: false, prerequisite_step_ids: [], unmet_prerequisite_step_ids: [] }],
};

let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof usePlanPreview>;

function Probe({ draft, reset = false }: { draft: WeeklyPlanInput | null; reset?: boolean }) {
  state = usePlanPreview(saved, draft, reset);
  return null;
}

async function render(draft: WeeklyPlanInput | null, reset = false) {
  await act(async () => root.render(createElement(Probe, { draft, reset })));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  previewPlan.mockReset();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

describe("authoritative weekly preview", () => {
  it("preserves exact solver dates until the saved inputs change", async () => {
    await render(planInput(saved));
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(previewPlan).not.toHaveBeenCalled();
    expect(state.plan.steps[0].start_date).toBe("2026-10-27");
    expect(state.plan.completion_date).toBe("2026-10-29");
    expect(state.pending).toBe(false);
  });

  it("treats an explicit recommended-hour value as unchanged", async () => {
    await render({ ...planInput(saved), hours: { step: 10 } });
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(previewPlan).not.toHaveBeenCalled();
    expect(state.unchanged).toBe(true);
    expect(state.normalizedInput).toEqual(planInput(saved));
    expect(state.plan).toBe(saved);
  });

  it("restores the saved solver dates when changed hours are undone", async () => {
    previewPlan.mockResolvedValueOnce({ ...saved, is_customized: true, completion_date: "2026-11-01" });
    await render({ ...planInput(saved), hours: { step: 11 } });
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(state.unchanged).toBe(false);
    await render({ ...planInput(saved), hours: { step: 10 } });
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(previewPlan).toHaveBeenCalledTimes(1);
    expect(state.unchanged).toBe(true);
    expect(state.plan.completion_date).toBe("2026-10-29");
    expect(state.normalizedInput?.hours).toEqual({});
  });

  it("previews and exposes the same normalized save input", async () => {
    previewPlan.mockResolvedValueOnce(saved);
    await render({ ...planInput(saved), weekly_hours: 2, rest_weeks: [3, 1], hours: { step: 10 } });
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(state.normalizedInput).toEqual({ ...planInput(saved), weekly_hours: 2, rest_weeks: [1, 3], hours: {} });
    expect(previewPlan).toHaveBeenCalledWith("roadmap", state.normalizedInput);
  });

  it("uses backend dates and deadline warnings after changing inputs", async () => {
    const input = { ...planInput(saved), weekly_hours: 1 };
    const response = { ...saved, schedule_source: "CUSTOM" as const, weekly_hours: 1, completion_date: "2026-12-27", deadline_exceeded: true, days_past_target: 56,
      warnings: [{ code: "TARGET_DATE_EXCEEDED" as const, message: "late", step_ids: [], prerequisite_step_ids: [] }] };
    previewPlan.mockResolvedValueOnce(response);
    await render(input);
    expect(state.pending).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(previewPlan).toHaveBeenCalledWith("roadmap", input);
    expect(state.plan).toEqual(response);
    expect(state.pending).toBe(false);
  });

  it("ignores stale responses when a newer edit finishes first", async () => {
    let finishFirst!: (value: WeeklyPlanResponse) => void;
    previewPlan.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    await render({ ...planInput(saved), weekly_hours: 2 });
    await act(async () => vi.advanceTimersByTimeAsync(200));
    const latest = { ...saved, weekly_hours: 3, completion_date: "2026-11-15" };
    previewPlan.mockResolvedValueOnce(latest);
    await render({ ...planInput(saved), weekly_hours: 3 });
    await act(async () => vi.advanceTimersByTimeAsync(200));
    await act(async () => finishFirst({ ...saved, weekly_hours: 2, completion_date: "2026-11-29" }));
    expect(state.plan).toEqual(latest);
    expect(state.pending).toBe(false);
  });

  it("reports failed previews instead of inventing a local schedule", async () => {
    previewPlan.mockRejectedValueOnce(new Error("offline"));
    await render({ ...planInput(saved), rest_weeks: [2] });
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(state.plan).toEqual(saved);
    expect(state.error).toContain("변경한 일정을 확인하지 못했어요");
    expect(state.pending).toBe(false);

    previewPlan.mockResolvedValueOnce(saved);
    await act(async () => state.retry());
    expect(state.pending).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(state.error).toBeNull();
    expect(previewPlan).toHaveBeenCalledTimes(2);
  });

  it("requests the original solver schedule with a null recommendation preview", async () => {
    previewPlan.mockResolvedValueOnce(saved);
    await render(planInput(saved), true);
    await act(async () => vi.advanceTimersByTimeAsync(200));
    expect(previewPlan).toHaveBeenCalledWith("roadmap", null);
    expect(state.plan).toEqual(saved);
  });
});
