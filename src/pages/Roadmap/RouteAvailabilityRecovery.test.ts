// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoalResponse, RoadmapDetailResponse, WeeklyPlanResponse } from "../../services/types";
import { proposalsApi, roadmapsApi } from "../../services/api";
import { Roadmap } from "./Roadmap";
const goal: GoalResponse = { goal_id: "goal", version: 1, goal_mode: "TARGETED", occupation_id: "BACKEND_DEVELOPER", status: "ACTIVE", target_by: "2026-12-31T00:00:00Z", timezone: "Asia/Seoul", original_time_phrase: "12월까지" };
const roadmap: RoadmapDetailResponse = { roadmap_id: "roadmap", version: 1, goal_id: "goal", title: "현재 로드맵", status: "ACTIVE", proposal_id: "original-proposal", steps: [] };
const { prefsGet, prefsUpdate, account } = vi.hoisted(() => ({ prefsGet: vi.fn(), prefsUpdate: vi.fn(), account: { id: "first" } }));
const preferences = { profile_version: 1, available_hours_per_week: 10, availability_source: "DEFAULT", budget_mode: "REGULAR", fastest_path: false, needs_portfolio: false, career_switch: false, max_out_of_pocket_krw: null, weekly_availability: [], unavailable_dates: [] };
vi.mock("../../components/AppSidebar", () => ({ AppSidebar: () => null }));
vi.mock("../../context/SessionContext", () => ({ useSession: () => ({ session: { user_id: account.id }, loading: false }) }));
vi.mock("../../hooks/useGoals", () => ({ useGoals: () => ({ goals: [goal], selectedGoal: goal, selectedGoalId: goal.goal_id, setSelectedGoalId: vi.fn(), selectedGoalName: "개발자", getGoalName: () => "개발자", loading: false }) }));
vi.mock("../../hooks/useRoadmap", () => ({ useRoadmap: () => ({ roadmaps: [roadmap], activeRoadmap: roadmap, loading: false, error: null, updateStepState: vi.fn(), progressPct: 0, refetch: vi.fn().mockResolvedValue(undefined) }) }));
vi.mock("../../services/api", () => ({ routePrefsApi: { get: prefsGet, update: prefsUpdate }, profileApi: { get: vi.fn() }, catalogV2Api: { listPublications: vi.fn().mockResolvedValue([]) }, dashboardApi: { get: vi.fn().mockResolvedValue({ state: "READY", proposal_id: "latest-proposal" }) }, proposalsApi: { get: vi.fn() }, roadmapsApi: { getPlan: vi.fn(), skills: vi.fn(), previewPlan: vi.fn() } }));
vi.mock("./PlanPhases", () => ({ PlanPhases: () => createElement("div", { "data-plan-phases": true }) }));
vi.mock("./PlanStepDetail", () => ({ PlanStepDetail: () => null }));
vi.mock("./PlanWeeks", () => ({ PlanWeeks: () => null }));
const plan: WeeklyPlanResponse = { version: 0, roadmap_id: "roadmap", start_date: "2026-10-19", target_date: null, weekly_hours: 10, recommended_weekly_hours: 10, rest_weeks: [], is_customized: false, saved_at: null, total_hours: 0, total_weeks: 0, completion_date: "2026-10-19", recommended_completion_date: "2026-10-19", schedule_source: "SOLVER", deadline_exceeded: false, days_past_target: 0, has_dependency_violations: false, warnings: [], steps: [] };
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  account.id = "first";
  prefsGet.mockReset().mockResolvedValue(preferences);
  prefsUpdate.mockReset();
  vi.mocked(roadmapsApi.getPlan).mockReset().mockResolvedValue(plan);
  vi.mocked(roadmapsApi.skills).mockReset().mockResolvedValue({ roadmap_id: "roadmap", analysis_id: "pinned", release_id: "release", skills: [] });
  vi.mocked(proposalsApi.get).mockReset().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ proposal_id: "original-proposal", feasibility: "PARTIAL" });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/roadmap"] }, createElement(Roadmap)))); }
async function click(text: string) { await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click()); }
async function submit() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
describe("availability recovery in the roadmap page", () => {
  it("keeps an unsaved calendar mounted through a failed save and preference reload", async () => {
    await render();
    await click("학습 시간 추가");
    const editor = container.querySelector(".rm-availability");
    const weekday = container.querySelector<HTMLSelectElement>('[aria-label="1번째 학습 요일"]')!;
    await act(async () => { weekday.value = "3"; weekday.dispatchEvent(new Event("change", { bubbles: true })); });
    prefsUpdate.mockRejectedValueOnce(new Error("offline"));
    await submit();
    expect(container.textContent).toContain("입력한 내용은 유지했어요");
    let finish!: (value: typeof preferences) => void;
    prefsGet.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await click("조건 다시 불러오기");
    expect(container.querySelector(".rm-availability")).toBe(editor);
    expect(weekday.value).toBe("3");
    expect(container.querySelector<HTMLFieldSetElement>(".rm-availability fieldset")?.disabled).toBe(true);
    await act(async () => finish({ ...preferences, profile_version: 2 }));
    expect(container.querySelector(".rm-availability")).toBe(editor);
    expect(weekday.value).toBe("3");
    prefsGet.mockResolvedValueOnce({ ...preferences, profile_version: 2 });
    prefsUpdate.mockResolvedValueOnce({ ...preferences, profile_version: 3 });
    await submit();
    expect(prefsUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      expected_profile_version: 2,
      weekly_availability: [{ weekday: 3, start_hour: 19, end_hour: 21 }], unavailable_dates: [],
    }));
  });
  it("drops the previous account's dirty calendar even when the new preferences resolve immediately", async () => {
    await render(); await click("학습 시간 추가");
    const editor = container.querySelector(".rm-availability");
    account.id = "second";
    prefsGet.mockResolvedValueOnce({ ...preferences, profile_version: 4, weekly_availability: [{ weekday: 2, start_hour: 9, end_hour: 10 }] });
    await render();
    expect(container.querySelector(".rm-availability")).not.toBe(editor);
    expect(container.querySelector<HTMLSelectElement>('[aria-label="1번째 학습 요일"]')?.value).toBe("2");
    expect([...container.querySelectorAll("button")].find(button => button.textContent === "학습 가능 시간 저장")?.disabled).toBe(true);
  });
});
