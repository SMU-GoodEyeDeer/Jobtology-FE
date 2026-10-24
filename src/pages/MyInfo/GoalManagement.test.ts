// @vitest-environment jsdom
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoalResponse, GoalUpdateRequest } from "../../services/types";
import { useGoals } from "../../hooks/useGoals";
import { GoalManagement } from "./GoalManagement";

const api = vi.hoisted(() => ({
  goalsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  profileApi: { get: vi.fn() }, analysisApi: { create: vi.fn() },
}));
vi.mock("../../services/api", () => api);
vi.mock("../../context/OccupationsContext", () => ({ useOccupations: () => ({
  occupations: [{ occupation_id: "BACKEND_DEVELOPER", name: "백엔드 개발자" }, { occupation_id: "FRONTEND_DEVELOPER", name: "프론트엔드 개발자" }],
  loading: false, error: null, refresh: async () => {},
  getName: (id: string | null) => id === "BACKEND_DEVELOPER" ? "백엔드 개발자" : id ? "프론트엔드 개발자" : "탐색 모드",
}) }));

let root: Root;
let container: HTMLDivElement;
let stored: GoalResponse[];
let version: number;
const profileChanged = vi.fn();
const existing: GoalResponse = { goal_id: "existing", version: 1, goal_mode: "TARGETED", occupation_id: "BACKEND_DEVELOPER", status: "ACTIVE", target_by: "2027-02-01T14:59:59Z", timezone: "Asia/Seoul", original_time_phrase: "내년 2월까지" };

function Harness() {
  const state = useGoals();
  return createElement(Fragment, null,
    createElement("output", { "data-selected-goal": true }, state.selectedGoalId ?? "none"),
    createElement(GoalManagement, { goals: state.goals, loading: state.loading, error: state.error, refresh: state.refresh, onProfileVersionChange: profileChanged }),
  );
}

async function mount(goals: GoalResponse[] = [], route = "/") {
  stored = goals.map(goal => ({ ...goal }));
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: [route] }, createElement(Harness))));
}

function button(text: string) {
  const found = [...container.querySelectorAll("button")].find(item => item.textContent === text);
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}
async function chooseOccupation(id = "FRONTEND_DEVELOPER") {
  await act(async () => {
    const select = container.querySelector("select")!;
    select.value = id; select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function setInput(selector: string, value: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  for (const group of Object.values(api)) for (const mock of Object.values(group)) mock.mockReset();
  profileChanged.mockReset(); version = 7; stored = [];
  api.profileApi.get.mockImplementation(async () => ({ version }));
  api.goalsApi.list.mockImplementation(async () => ({ items: stored.map(goal => ({ ...goal })) }));
  api.goalsApi.get.mockImplementation(async (id: string) => stored.find(goal => goal.goal_id === id));
  api.goalsApi.create.mockImplementation(async (request: GoalUpdateRequest) => {
    version += 1;
    const goal = { ...request, goal_id: "created", version: 1, occupation_id: request.occupation_id ?? null } as GoalResponse;
    stored.push(goal); return { goal_id: goal.goal_id, status: goal.status };
  });
  api.goalsApi.update.mockImplementation(async (id: string, request: GoalUpdateRequest) => {
    version += 1;
    stored = stored.map(goal => goal.goal_id === id ? { ...goal, ...request, occupation_id: request.occupation_id ?? null } : goal);
    return { goal_id: id, status: request.status };
  });
  api.goalsApi.delete.mockImplementation(async (id: string) => {
    version += 1;
    stored = stored.filter(goal => goal.goal_id !== id);
    return { goal_id: id, profile_version: version };
  });
  api.analysisApi.create.mockResolvedValue({ recompute_request_id: "analysis-request" });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

describe("goal management", () => {
  it("creates the first active goal from an always visible empty panel and starts fresh analysis", async () => {
    await mount();
    expect(container.querySelector("#goals")?.textContent).toContain("아직 목표가 없어요");
    await act(async () => button("목표 추가").click());
    expect(container.querySelector('input[list="mi-goal-timezones"]')?.closest("label")?.querySelector(".mi-label")?.textContent).toBe("시간대");
    await chooseOccupation("BACKEND_DEVELOPER");
    await setInput('input[type="date"]', "2027-02-01");
    await submit();
    expect(api.goalsApi.create).toHaveBeenCalledWith(expect.objectContaining({ expected_profile_version: 7, goal_mode: "TARGETED", occupation_id: "BACKEND_DEVELOPER", status: "ACTIVE", target_by: "2027-02-01T14:59:59.000Z", timezone: "Asia/Seoul" }), expect.any(String));
    expect(api.analysisApi.create).toHaveBeenCalledWith({ goal_id: "created", expected_profile_version: 8, basis_type: "EDITORIAL" });
    expect(api.goalsApi.list).toHaveBeenCalledTimes(2);
    expect(profileChanged).toHaveBeenCalledWith(8);
    expect(container.textContent).toContain("백엔드 개발자");
    expect(container.querySelector("form")).toBeNull();
  });

  it("edits a skipped discovery goal into a targeted active goal in place", async () => {
    await mount([{ ...existing, goal_mode: "DISCOVERY", occupation_id: null }]);
    await act(async () => button("수정").click());
    await chooseOccupation(); await submit();
    expect(api.goalsApi.create).not.toHaveBeenCalled();
    expect(api.goalsApi.update).toHaveBeenCalledWith("existing", expect.objectContaining({ goal_mode: "TARGETED", occupation_id: "FRONTEND_DEVELOPER", status: "ACTIVE", expected_profile_version: 7 }));
    expect(api.analysisApi.create).toHaveBeenCalledWith(expect.objectContaining({ goal_id: "existing", expected_profile_version: 8 }));
  });

  it("adds a draft while preserving an existing active goal and its analysis", async () => {
    await mount([existing]);
    await act(async () => button("목표 추가").click());
    expect(container.textContent).toContain("새 목표는 임시저장해요");
    await chooseOccupation(); await submit();
    expect(api.goalsApi.create).toHaveBeenCalledWith(expect.objectContaining({ status: "DRAFT" }), expect.any(String));
    expect(api.goalsApi.update).not.toHaveBeenCalled();
    expect(api.analysisApi.create).not.toHaveBeenCalled();
    expect(stored.find(goal => goal.goal_id === "existing")?.status).toBe("ACTIVE");
    expect(button("활성화").disabled).toBe(true);
  });

  it("activates a saved goal only when no other active goal exists and requests fresh analysis", async () => {
    await mount([{ ...existing, status: "DRAFT" }]);
    await act(async () => button("활성화").click());
    expect(api.goalsApi.get).toHaveBeenCalledWith("existing");
    expect(api.goalsApi.update).toHaveBeenCalledWith("existing", expect.objectContaining({ status: "ACTIVE", expected_profile_version: 7 }));
    expect(api.analysisApi.create).toHaveBeenCalledWith(expect.objectContaining({ goal_id: "existing", expected_profile_version: 8 }));
    expect(stored[0].status).toBe("ACTIVE");
  });

  it("prevents repeated writes while a goal save is pending", async () => {
    let finish!: (result: unknown) => void;
    await mount();
    api.goalsApi.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => button("목표 추가").click()); await chooseOccupation();
    let save!: Promise<void>;
    await act(async () => { save = submit(); });
    expect(button("저장 중...").disabled).toBe(true);
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(api.goalsApi.create).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ goal_id: "created", status: "ACTIVE" }); await save; });
  });

  it("retains inputs and the active goal after create failure, then retries with the same idempotency key", async () => {
    await mount([existing]);
    api.goalsApi.create.mockRejectedValueOnce(new Error("offline"));
    await act(async () => button("목표 추가").click()); await chooseOccupation(); await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("입력 내용은 유지했어요");
    expect(container.querySelector("select")?.value).toBe("FRONTEND_DEVELOPER");
    expect(stored).toHaveLength(1);
    await submit();
    expect(api.goalsApi.create.mock.calls[0][1]).toBe(api.goalsApi.create.mock.calls[1][1]);
    expect(api.goalsApi.update).not.toHaveBeenCalled();
  });

  it("retries analysis without creating the successfully saved goal again", async () => {
    await mount(); api.analysisApi.create.mockRejectedValueOnce(new Error("analysis offline"));
    await act(async () => button("목표 추가").click()); await chooseOccupation(); await submit();
    expect(container.textContent).toContain("목표는 저장됐어요");
    expect(container.querySelector("form")).toBeNull();
    await act(async () => button("분석 다시 요청").click());
    expect(api.goalsApi.create).toHaveBeenCalledTimes(1);
    expect(api.analysisApi.create).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("새 분석을 요청했어요");
  });

  it("guides back to active goal setup when the saved goal becomes unusable before analysis", async () => {
    await mount();
    api.analysisApi.create.mockRejectedValueOnce({ status: 409, detail: { error: { code: "ACTIVE_TARGETED_GOAL_REQUIRED" } } });
    await act(async () => button("목표 추가").click()); await chooseOccupation(); await submit();
    expect(container.textContent).toContain("직무가 정해진 목표를 활성화해 주세요");
    expect(api.goalsApi.create).toHaveBeenCalledTimes(1);
    expect([...container.querySelectorAll("button")].some(button => button.textContent === "분석 다시 요청")).toBe(false);
    expect(container.querySelector("form")).toBeNull();
  });

  it("rejects invalid timezone and deadline before writing", async () => {
    await mount(); await act(async () => button("목표 추가").click()); await chooseOccupation();
    await setInput('input[list="mi-goal-timezones"]', "Invalid/Zone"); await submit();
    expect(api.goalsApi.create).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("올바른 시간대");
    await setInput('input[list="mi-goal-timezones"]', "UTC");
    await setInput('input[type="date"]', "2026-01-01"); await submit();
    expect(api.goalsApi.create).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("366일 이내");
  });

  it("lets archived goals retain old deadlines and asks to edit them before activation", async () => {
    await mount([{ ...existing, status: "ARCHIVED", target_by: "2026-01-01T00:00:00Z" }]);
    await act(async () => button("목표일 수정 후 활성화").click());
    expect(container.querySelector('input[type="date"]')?.getAttribute("min")).toBeNull();
    await submit();
    expect(api.goalsApi.update).toHaveBeenCalledWith("existing", expect.objectContaining({ status: "ARCHIVED" }));
    expect(api.analysisApi.create).not.toHaveBeenCalled();
    expect(button("목표일 수정 후 활성화")).toBeDefined();
  });

  it("keeps the panel visible when listing fails and retries without a page reload", async () => {
    api.goalsApi.list.mockRejectedValueOnce(new Error("offline"));
    await mount([existing]);
    expect(container.querySelector("#goals")).not.toBeNull();
    expect(container.textContent).toContain("목표 목록을 불러오지 못했어요");
    await act(async () => button("목표 목록 다시 불러오기").click());
    expect(container.textContent).toContain("백엔드 개발자");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("names the goal and explains permanent removal before deletion, with safe cancellation", async () => {
    await mount([existing]);
    await act(async () => button("삭제").click());
    const confirmation = container.querySelector('[aria-labelledby="mi-goal-delete-title"]')!;
    expect(confirmation.textContent).toContain("‘백엔드 개발자’ 목표를 영구 삭제할까요");
    expect(confirmation.textContent).toContain("로드맵, 분석 결과와 학습 진행 기록이 모두 삭제");
    expect(confirmation.textContent).toContain("계정, 프로필과 등록한 역량은 유지");
    expect(api.goalsApi.delete).not.toHaveBeenCalled();
    await act(async () => button("취소").click());
    expect(container.querySelector('[aria-labelledby="mi-goal-delete-title"]')).toBeNull();
    expect(api.goalsApi.delete).not.toHaveBeenCalled();
    expect(stored).toHaveLength(1);
  });

  it("deletes the only active goal with a fresh version and refreshes into the no-goal state", async () => {
    await mount([existing]); version = 15;
    await act(async () => button("삭제").click());
    await act(async () => button("목표 영구 삭제").click());
    expect(api.goalsApi.delete).toHaveBeenCalledWith("existing", { expected_profile_version: 15 });
    expect(profileChanged).toHaveBeenCalledWith(16);
    expect(container.textContent).toContain("아직 목표가 없어요");
    expect(container.querySelector("[data-selected-goal]")?.textContent).toBe("none");
    expect(api.goalsApi.list).toHaveBeenCalledTimes(2);
    expect(api.goalsApi.update).not.toHaveBeenCalled();
    expect(api.analysisApi.create).not.toHaveBeenCalled();
  });

  it("does not activate or analyze a remaining draft when deleting the active goal", async () => {
    await mount([existing, { ...existing, goal_id: "draft", status: "DRAFT", occupation_id: "FRONTEND_DEVELOPER" }]);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="백엔드 개발자 목표 삭제"]')!.click());
    await act(async () => button("목표 영구 삭제").click());
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ goal_id: "draft", status: "DRAFT" });
    expect(container.querySelector("[data-selected-goal]")?.textContent).toBe("draft");
    expect(button("활성화").disabled).toBe(false);
    expect(api.goalsApi.update).not.toHaveBeenCalled();
    expect(api.analysisApi.create).not.toHaveBeenCalled();
  });

  it("retains the confirmation after failure and fetches a fresh version for retry", async () => {
    await mount([existing]); api.goalsApi.delete.mockRejectedValueOnce(new Error("offline"));
    await act(async () => button("삭제").click());
    await act(async () => button("목표 영구 삭제").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("목표를 삭제하지 못했어요");
    expect(stored).toHaveLength(1);
    version = 9;
    await act(async () => button("목표 영구 삭제").click());
    expect(api.goalsApi.delete.mock.calls).toEqual([["existing", { expected_profile_version: 7 }], ["existing", { expected_profile_version: 9 }]]);
    expect(profileChanged).toHaveBeenCalledWith(10);
    expect(container.querySelector('[aria-labelledby="mi-goal-delete-title"]')).toBeNull();
  });

  it("refreshes on a delete conflict and waits for an explicit retry", async () => {
    await mount([existing]); api.goalsApi.delete.mockRejectedValueOnce({ status: 409 });
    await act(async () => button("삭제").click());
    await act(async () => button("목표 영구 삭제").click());
    expect(api.goalsApi.delete).toHaveBeenCalledTimes(1);
    expect(api.goalsApi.list).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("정보가 변경됐어요");
    expect(stored).toHaveLength(1);
    version = 8;
    await act(async () => button("목표 영구 삭제").click());
    expect(api.goalsApi.delete).toHaveBeenLastCalledWith("existing", { expected_profile_version: 8 });
  });

  it("recovers if deletion committed but its response was lost and retry returns 404", async () => {
    await mount([existing]);
    api.goalsApi.delete.mockImplementationOnce(async () => { stored = []; version = 8; throw new Error("lost response"); })
      .mockRejectedValueOnce({ status: 404 });
    await act(async () => button("삭제").click());
    await act(async () => button("목표 영구 삭제").click());
    await act(async () => button("목표 영구 삭제").click());
    expect(container.querySelector('[aria-labelledby="mi-goal-delete-title"]')).toBeNull();
    expect(container.textContent).toContain("이미 삭제됐거나");
    expect(container.textContent).toContain("아직 목표가 없어요");
    expect(container.querySelector("[data-selected-goal]")?.textContent).toBe("none");
    expect(profileChanged).toHaveBeenCalledWith(8);
  });

  it("prevents duplicate requests and cancellation while deleting", async () => {
    await mount([existing]);
    let finish!: (value: unknown) => void;
    api.goalsApi.delete.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => button("삭제").click());
    await act(async () => button("목표 영구 삭제").click());
    expect(button("삭제 중...").disabled).toBe(true);
    expect(button("취소").disabled).toBe(true);
    await act(async () => button("삭제 중...").click());
    expect(api.goalsApi.delete).toHaveBeenCalledTimes(1);
    await act(async () => { stored = []; version = 8; finish({ goal_id: "existing", profile_version: 8 }); });
    expect(container.textContent).toContain("아직 목표가 없어요");
  });

  it("selects the owned goal from a deep link instead of the first active goal", async () => {
    const linked = { ...existing, goal_id: "linked", occupation_id: "FRONTEND_DEVELOPER" };
    await mount([existing, linked], "/myinfo?goal_id=linked");
    expect(container.querySelector("[data-selected-goal]")?.textContent).toBe("linked");
  });

  it("clears pending analysis retry when its goal is deleted", async () => {
    await mount(); api.analysisApi.create.mockRejectedValueOnce(new Error("analysis offline"));
    await act(async () => button("목표 추가").click()); await chooseOccupation(); await submit();
    expect(button("분석 다시 요청")).toBeDefined();
    await act(async () => button("삭제").click());
    expect([...container.querySelectorAll("button")].some(button => button.textContent === "분석 다시 요청")).toBe(false);
    await act(async () => button("목표 영구 삭제").click());
    expect(api.analysisApi.create).toHaveBeenCalledTimes(1);
    expect(container.querySelector("form")).toBeNull();
  });
});
