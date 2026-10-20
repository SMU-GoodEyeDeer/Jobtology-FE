// @vitest-environment jsdom
import { act, createElement, Fragment, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardApi, roadmapsApi } from "../../services/api";
import type { RoadmapDetailResponse, RoadmapRevision } from "../../services/types";
import { RoadmapRevisionPanel } from "./RoadmapRevisionPanel";
vi.mock("../../services/api", () => ({ dashboardApi: { get: vi.fn() }, roadmapsApi: { compareRevision: vi.fn(), applyRevision: vi.fn() } }));
const roadmap: RoadmapDetailResponse = { roadmap_id: "old", version: 4, goal_id: "goal", title: "현재 경로", status: "ACTIVE", proposal_id: "old-proposal", steps: [{ step_id: "progress", step_key: "old-step", title: "진행 중 학습", description: null, state: "IN_PROGRESS" }] };
const comparison: RoadmapRevision = { roadmap_id: "old", roadmap_version: 4, profile_version: 8, plan_version: 2, proposal_id: "latest", proposal_hash: "hash", analysis_id: "analysis", release_id: "release", feasibility: "PARTIAL", can_apply: true, blocking_reasons: [], preserved_completed_steps: [{ step_id: "done", step_key: "done-key", title: "완료한 학습" }], retained_in_progress_step_ids: [], unretained_in_progress_step_ids: ["progress"], added_step_keys: ["new-step"], removed_step_keys: ["old-step"], revised_step_count: 3, resets_future_customization: true, constraint_changes: { available_hours_per_week: [10, 15] }, schedule_changes: [{ step_key: "old-step", old_planned_start: "2026-10-20", old_planned_end: "2026-10-23", new_planned_start: "2026-10-22", new_planned_end: "2026-10-25" }] };
let root: Root; let container: HTMLDivElement;
const onApplied = vi.fn();
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(dashboardApi.get).mockReset().mockResolvedValue({ state: "READY", proposal_id: "latest" } as never);
  vi.mocked(roadmapsApi.compareRevision).mockReset().mockResolvedValue(comparison);
  vi.mocked(roadmapsApi.applyRevision).mockReset().mockResolvedValue({ roadmap_id: "new", roadmap_version: 1, state: "ACTIVE", previous_roadmap_id: "old", preserved_completed_count: 1 });
  onApplied.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(createElement(RoadmapRevisionPanel, { roadmap, onApplied }))); }
async function click(text: string) { await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click()); }
describe("reviewed roadmap revision adoption", () => {
  it("compares without writing, discloses lost in-progress steps and PARTIAL coverage, then applies the reviewed versions", async () => {
    await render(); await click("변경 내용 비교");
    expect(roadmapsApi.applyRevision).not.toHaveBeenCalled();
    expect(roadmapsApi.compareRevision).toHaveBeenCalledWith("old", "latest");
    expect(container.textContent).toContain("완료 기록 1단계 유지");
    expect(container.textContent).toContain("진행 중인 1단계는 새 경로에 포함되지 않아요: 진행 중 학습");
    expect(container.textContent).toContain("기간 안에 가능한 범위의 일부 경로");
    expect(container.textContent).toContain("10 → 15");
    expect(container.textContent).toContain("직접 수정한 미완료 단계");
    expect(container.textContent).toContain("새 추천 일정으로 바뀌어요");
    await click("검토한 경로 적용");
    expect(roadmapsApi.applyRevision).toHaveBeenCalledWith("old", { proposal_id: "latest", expected_proposal_hash: "hash", expected_roadmap_version: 4, expected_profile_version: 8, expected_plan_version: 2 });
    expect(onApplied).toHaveBeenCalledTimes(1);
  });
  it("reloads comparison after conflict and requires another explicit reviewed application", async () => {
    vi.mocked(roadmapsApi.applyRevision).mockRejectedValueOnce({ status: 409 });
    vi.mocked(roadmapsApi.compareRevision).mockResolvedValueOnce(comparison).mockResolvedValueOnce({ ...comparison, roadmap_version: 5, plan_version: 3 });
    await render(); await click("변경 내용 비교"); await click("검토한 경로 적용");
    expect(roadmapsApi.compareRevision).toHaveBeenCalledTimes(2);
    expect(roadmapsApi.applyRevision).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("검토");
    expect(onApplied).toHaveBeenCalledTimes(1);
    await click("검토한 경로 적용");
    expect(roadmapsApi.applyRevision).toHaveBeenLastCalledWith("old", expect.objectContaining({ expected_roadmap_version: 5, expected_plan_version: 3 }));
  });
  it("discovers a committed revision after its response is lost without applying twice", async () => {
    vi.mocked(roadmapsApi.applyRevision).mockRejectedValueOnce(new Error("response lost after commit"));
    function Host() {
      const [active, setActive] = useState(roadmap);
      return createElement(Fragment, null, createElement("output", null, active.roadmap_id), createElement(RoadmapRevisionPanel, { key: active.roadmap_id, roadmap: active, onApplied: async () => {
        await onApplied();
        setActive({ ...roadmap, roadmap_id: "new", proposal_id: "latest" });
      } }));
    }
    await act(async () => root.render(createElement(Host)));
    await click("변경 내용 비교"); await click("검토한 경로 적용");
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")?.textContent).toBe("new");
    expect(roadmapsApi.applyRevision).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-label="최신 추천 경로 비교"]')).toBeNull();
  });

  it("keeps an unsupported completed history blocked", async () => {
    vi.mocked(roadmapsApi.compareRevision).mockResolvedValueOnce({ ...comparison, can_apply: false, blocking_reasons: ["COMPLETED_HISTORY_UNVERIFIED"] });
    await render(); await click("변경 내용 비교");
    expect(container.textContent).toContain("완료 기록의 연결을 확인할 수 없어");
    expect([...container.querySelectorAll("button")].find(button => button.textContent === "검토한 경로 적용")?.disabled).toBe(true);
    expect(roadmapsApi.applyRevision).not.toHaveBeenCalled();
  });
  it("shows proposal-discovery errors and retries without requiring opaque IDs", async () => {
    vi.mocked(dashboardApi.get).mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("최신 추천 경로를 확인하지 못했어요");
    await click("최신 경로 다시 확인");
    expect(dashboardApi.get).toHaveBeenLastCalledWith("goal");
    expect(container.textContent).toContain("변경 내용 비교");
  });
});
