// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoalResponse } from "../../services/types";
import { Analysis } from "./Analysis";

const mocks = vi.hoisted(() => ({
  goals: [] as GoalResponse[], selectedGoalId: null as string | null, loading: false, error: null as string | null,
  refresh: vi.fn(), selectGoal: vi.fn(),
  profileApi: { get: vi.fn() }, dashboardApi: { get: vi.fn() },
  analysisApi: { create: vi.fn(), poll: vi.fn(), get: vi.fn() },
}));
vi.mock("../../services/api", () => ({ profileApi: mocks.profileApi, dashboardApi: mocks.dashboardApi, analysisApi: mocks.analysisApi }));
vi.mock("../../hooks/useGoals", () => ({ useGoals: () => ({
  goals: mocks.goals, selectedGoalId: mocks.selectedGoalId,
  selectedGoal: mocks.goals.find(goal => goal.goal_id === mocks.selectedGoalId) ?? null,
  selectedGoalName: "선택한 목표", getGoalName: (goal: GoalResponse) => goal.goal_id,
  loading: mocks.loading, error: mocks.error, refresh: mocks.refresh, setSelectedGoalId: mocks.selectGoal,
}) }));
vi.mock("../../context/SessionContext", () => ({ useSession: () => ({ session: { user_id: "user" }, loading: false }) }));
vi.mock("../../components/AppSidebar", () => ({ AppSidebar: ({ children }: { children: ReactNode }) => createElement("aside", null, children) }));
vi.mock("./SkillList", () => ({ SkillList: () => null }));
vi.mock("./AnalysisPublications", () => ({ AnalysisPublications: ({ onLoadingChange }: { onLoadingChange: (value: boolean) => void }) => {
  useEffect(() => { onLoadingChange(false); }, [onLoadingChange]); return null;
} }));

const targeted: GoalResponse = { goal_id: "targeted", version: 1, goal_mode: "TARGETED", occupation_id: "BACKEND_DEVELOPER", status: "ACTIVE", target_by: "2027-02-01T14:59:59Z", timezone: "Asia/Seoul", original_time_phrase: "2월까지" };
const unusable: [string, GoalResponse | null][] = [
  ["no goal", null],
  ["active discovery", { ...targeted, goal_mode: "DISCOVERY", occupation_id: null }],
  ["draft targeted", { ...targeted, status: "DRAFT" }],
  ["archived targeted", { ...targeted, status: "ARCHIVED" }],
  ["missing occupation", { ...targeted, occupation_id: " " }],
];
let root: Root;
let container: HTMLDivElement;

async function render() { await act(async () => root.render(createElement(MemoryRouter, null, createElement(Analysis)))); }

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  for (const api of [mocks.profileApi, mocks.dashboardApi, mocks.analysisApi]) for (const mock of Object.values(api)) mock.mockReset();
  mocks.refresh.mockReset().mockResolvedValue(undefined); mocks.selectGoal.mockReset();
  mocks.goals = []; mocks.selectedGoalId = null; mocks.loading = false; mocks.error = null;
  mocks.profileApi.get.mockResolvedValue({ version: 4 });
  mocks.dashboardApi.get.mockResolvedValue({ state: "EMPTY" });
  mocks.analysisApi.create.mockResolvedValue({ recompute_request_id: "request" });
  mocks.analysisApi.poll.mockResolvedValue({ state: "COMPLETED", analysis_id: "analysis" });
  mocks.analysisApi.get.mockResolvedValue({ analysis_id: "analysis", goal_id: targeted.goal_id, result: { skills: [] } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("analysis goal eligibility", () => {
  it.each(unusable)("shows goal setup without requesting analysis for %s", async (_, goal) => {
    mocks.goals = goal ? [goal] : []; mocks.selectedGoalId = goal?.goal_id ?? null;
    await render();
    expect(mocks.profileApi.get).not.toHaveBeenCalled();
    expect(mocks.dashboardApi.get).not.toHaveBeenCalled();
    expect(mocks.analysisApi.create).not.toHaveBeenCalled();
    expect(container.querySelector('a[href="/myinfo#goals"]')?.textContent).toContain("목표 설정하기");
    expect(container.textContent).not.toContain("분석 중 오류가 발생했어요");
    expect(container.querySelector<HTMLButtonElement>(".an-reanalyze-btn")?.disabled).toBe(true);
  });

  it("waits for goal loading before starting an eligible analysis", async () => {
    mocks.goals = [targeted]; mocks.selectedGoalId = targeted.goal_id; mocks.loading = true;
    await render();
    expect(mocks.analysisApi.create).not.toHaveBeenCalled();
    mocks.loading = false; await render();
    expect(mocks.analysisApi.create).toHaveBeenCalledWith({ goal_id: targeted.goal_id, expected_profile_version: 4, basis_type: "EDITORIAL" });
  });

  it("handles the typed goal requirement before the generic 409 stored-analysis fallback", async () => {
    mocks.goals = [targeted]; mocks.selectedGoalId = targeted.goal_id;
    mocks.analysisApi.create.mockRejectedValueOnce({ status: 409, detail: { error: { code: "ACTIVE_TARGETED_GOAL_REQUIRED" } } });
    await render();
    expect(mocks.dashboardApi.get).toHaveBeenCalledTimes(1);
    expect(mocks.analysisApi.poll).not.toHaveBeenCalled();
    expect(container.querySelector('a[href="/myinfo#goals"]')).not.toBeNull();
    expect(container.textContent).not.toContain("분석 중 오류가 발생했어요");
    expect(container.querySelector<HTMLButtonElement>(".an-reanalyze-btn")?.disabled).toBe(true);
  });

  it("preserves stored-analysis recovery for ordinary version conflicts", async () => {
    mocks.goals = [targeted]; mocks.selectedGoalId = targeted.goal_id;
    mocks.dashboardApi.get.mockResolvedValueOnce({ state: "EMPTY" }).mockResolvedValueOnce({ state: "READY", analysis_id: "analysis" });
    mocks.analysisApi.create.mockRejectedValueOnce({ status: 409, detail: { error: { code: "VERSION_CONFLICT" } } });
    await render();
    expect(mocks.dashboardApi.get).toHaveBeenCalledTimes(2);
    expect(mocks.analysisApi.get).toHaveBeenCalledWith("analysis");
    expect(container.querySelector('a[href="/myinfo#goals"]')).toBeNull();
  });

  it("does not submit after the selected goal is archived while fetching the profile", async () => {
    mocks.goals = [targeted]; mocks.selectedGoalId = targeted.goal_id;
    let finishProfile!: (value: { version: number }) => void;
    mocks.profileApi.get.mockImplementationOnce(() => new Promise(resolve => { finishProfile = resolve; }));
    await render();
    expect(mocks.profileApi.get).toHaveBeenCalledTimes(1);
    mocks.goals = [{ ...targeted, status: "ARCHIVED" }]; await render();
    await act(async () => finishProfile({ version: 4 }));
    expect(mocks.analysisApi.create).not.toHaveBeenCalled();
    expect(container.querySelector('a[href="/myinfo#goals"]')).not.toBeNull();
  });

  it("offers the existing active targeted goal when an unusable goal is selected", async () => {
    mocks.goals = [{ ...targeted, goal_id: "draft", status: "DRAFT" }, targeted]; mocks.selectedGoalId = "draft";
    await render();
    const select = [...container.querySelectorAll("button")].find(button => button.textContent === "활성 목표 선택")!;
    await act(async () => select.click());
    expect(mocks.selectGoal).toHaveBeenCalledWith(targeted.goal_id);
    expect(mocks.analysisApi.create).not.toHaveBeenCalled();
  });
});
