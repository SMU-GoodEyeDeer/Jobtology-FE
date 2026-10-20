// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { roadmapsApi } from "../../services/api";
import type { WeeklyPlanResponse } from "../../services/types";
import { useWeeklyPlan } from "./useWeeklyPlan";
vi.mock("../../services/api", () => ({ roadmapsApi: { getPlan: vi.fn(), skills: vi.fn() } }));
let root: Root; let container: HTMLDivElement; let state: ReturnType<typeof useWeeklyPlan>;
function Probe({ id }: { id: string }) { state = useWeeklyPlan(id); return null; }
async function render(id: string) { await act(async () => root.render(createElement(Probe, { id }))); }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(roadmapsApi.getPlan).mockReset();
  vi.mocked(roadmapsApi.skills).mockReset().mockResolvedValue({ roadmap_id: "roadmap", analysis_id: "pinned", release_id: "release", skills: [] });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe("weekly plan fetch recovery", () => {
  it("uses the roadmap's pinned skills including satisfied steps and retries metadata independently", async () => {
    vi.mocked(roadmapsApi.getPlan).mockResolvedValue({ roadmap_id: "roadmap", version: 2 } as WeeklyPlanResponse);
    const skills = [{ name: "완료한 역량", type: "필수" as const, status: "SATISFIED" as const, requirement_key: "pinned:requirement", ncs_level: 3 }];
    vi.mocked(roadmapsApi.skills).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ roadmap_id: "roadmap", analysis_id: "pinned", release_id: "release", skills });
    await render("roadmap");
    expect(state.skills).toEqual([]);
    expect(state.skillsError).toContain("이 로드맵을 만들 때의 역량 정보");
    await act(async () => state.retrySkills());
    expect(state.skills).toEqual(skills);
    expect(state.skillsError).toBeNull();
    expect(roadmapsApi.skills).toHaveBeenLastCalledWith("roadmap");
    expect(roadmapsApi.getPlan).toHaveBeenCalledTimes(1);
  });
  it("exposes a load failure and fetches the authoritative plan on explicit retry", async () => {
    const plan = { roadmap_id: "roadmap", version: 2 } as WeeklyPlanResponse;
    vi.mocked(roadmapsApi.getPlan).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(plan);
    await render("roadmap");
    expect(state.error).toContain("주차 플랜을 불러오지 못했어요");
    expect(state.loading).toBe(false);
    await act(async () => state.retry());
    expect(state.error).toBeNull();
    expect(state.plan).toEqual(plan);
  });
});
