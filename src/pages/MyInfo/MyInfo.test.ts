// @vitest-environment jsdom
import { act, createElement } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapabilityDetailResponse, CapabilityMutationRequest, GoalResponse, ProfileDetailResponse, ProfileUpdateRequest } from "../../services/types";
import { MyInfo } from "./MyInfo";

const { api, goalState } = vi.hoisted(() => ({
  api: { profileApi: { get: vi.fn(), update: vi.fn() }, capabilitiesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, skillsApi: { search: vi.fn() }, chatApi: { status: vi.fn(), send: vi.fn() }, analysisApi: { create: vi.fn() } },
  goalState: { goals: [] as GoalResponse[] },
}));
vi.mock("../../services/api", () => api);
vi.mock("../../context/SessionContext", () => ({ useSession: () => ({ session: { user_id: "google-user" }, loading: false }) }));
vi.mock("../../hooks/useGoals", () => ({ useGoals: () => ({ goals: goalState.goals, selectedGoalId: goalState.goals[0]?.goal_id ?? null, selectedGoalName: "백엔드 개발자", setSelectedGoalId: () => {}, getGoalName: () => "백엔드 개발자", loading: false, error: null, refresh: async () => {} }) }));
vi.mock("../../components/AppSidebar", () => ({ AppSidebar: ({ children }: { children: ReactNode }) => createElement("aside", null, children) }));
vi.mock("./GoalManagement", () => ({ GoalManagement: () => null }));
vi.mock("./AccountSettings", () => ({ AccountSettings: () => null }));

let root: Root;
let container: HTMLDivElement;
let profile: ProfileDetailResponse;
let capabilities: CapabilityDetailResponse[];
let nextId: number;

function capability(id: string, title: string, lifecycle = "ACTIVE"): CapabilityDetailResponse {
  return { capability_id: id, raw_text: title, category: "skill", lifecycle, entity_id: null, proficiency: "FAMILIAR", verification: "SELF_REPORTED", details: { competency_ids: [], evidence: "", source: "MANUAL" }, matching: { status: "NEEDS_CLARIFICATION", credit: 0, competencies: [], message: "근거와 역량을 확인해 주세요." } };
}
async function addSpec(title: string) {
  await act(async () => button("스펙 추가").click());
  await input('.spec-editor input[required]', title);
  await act(async () => button("스펙 저장").click());
}
function bumpVersion() { profile = { ...profile, profile_version: profile.version + 1, version: profile.version + 1 }; }
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(item => item.textContent === label);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}
async function mount() {
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/myinfo"] }, createElement(Routes, null,
    createElement(Route, { path: "/myinfo", element: createElement(MyInfo) }),
    createElement(Route, { path: "/analysis", element: createElement("p", null, "Analysis page") }),
  ))));
}
async function remount() {
  await act(async () => root.unmount()); container.remove();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await mount();
}
async function input(selector: string, value: string) {
  await act(async () => {
    const element = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function select(selector: string, value: string) {
  await act(async () => { const element = container.querySelector<HTMLSelectElement>(selector)!; element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  for (const group of Object.values(api)) for (const mock of Object.values(group)) mock.mockReset();
  profile = { user_id: "google-user", version: 4, profile_version: 4, major_raw: "컴퓨터공학", major_concept_id: "major:cs", year: 3, enrollment_status: "ENROLLED", expected_graduation_on: "2028-02-01" };
  capabilities = []; nextId = 0;
  goalState.goals = [{ goal_id: "active-goal", version: 1, goal_mode: "TARGETED", occupation_id: "BACKEND_DEVELOPER", status: "ACTIVE", target_by: "2027-02-01T00:00:00Z", timezone: "Asia/Seoul", original_time_phrase: "2월까지" }];
  api.profileApi.get.mockImplementation(async () => ({ ...profile }));
  api.profileApi.update.mockImplementation(async (request: ProfileUpdateRequest) => {
    if (request.expected_profile_version !== profile.version) throw { status: 409 };
    const { expected_profile_version: _, ...fields } = request;
    profile = { ...profile, ...fields }; bumpVersion();
    // Real PUT returns identifiers/versions, not profile fields.
    return { user_id: profile.user_id, profile_version: profile.profile_version, version: profile.version };
  });
  api.capabilitiesApi.list.mockImplementation(async () => ({ items: capabilities.map(item => ({ ...item })) }));
  api.skillsApi.search.mockResolvedValue({ items: [], total: 0, available_sources: ["NCS"] });
  api.capabilitiesApi.get.mockImplementation(async (id: string) => ({ ...capabilities.find(item => item.capability_id === id)! }));
  api.capabilitiesApi.create.mockImplementation(async (request: CapabilityMutationRequest) => {
    if (request.expected_profile_version !== profile.version) throw { status: 409 };
    const capability_id = `cap-${++nextId}`; capabilities.push({ ...capability(capability_id, request.raw_text), ...request }); bumpVersion();
    return { capability_id, profile_version: profile.profile_version };
  });
  api.capabilitiesApi.delete.mockImplementation(async (id: string, request: { expected_profile_version: number }) => {
    if (request.expected_profile_version !== profile.version) throw { status: 409 };
    capabilities = capabilities.map(item => item.capability_id === id ? { ...item, lifecycle: "REVOKED" } : item); bumpVersion();
    return { capability_id: id, profile_version: profile.profile_version };
  });
  api.analysisApi.create.mockResolvedValue({ recompute_request_id: "new-analysis" });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("MyInfo persistence", () => {
  it("consumes a chat candidate once and clears it from browser history", async () => {
    const candidate = { entity_id: "ncs:unit:2001020211", label: "로그인 API 프로젝트", evidence_quote: "FastAPI로 로그인 기능과 테스트를 직접 구현한 경험이에요.", category: "project" };
    const router = createMemoryRouter([
      { path: "/myinfo", element: createElement(MyInfo) },
      { path: "/analysis", element: createElement("p", null, "Analysis page") },
    ], { initialEntries: [{ pathname: "/myinfo", search: "?old=1", hash: "#specs", state: { specCandidate: candidate } }] });
    await act(async () => root.render(createElement(RouterProvider, { router })));
    expect(router.state.location).toMatchObject({ pathname: "/myinfo", hash: "#specs", search: "", state: null });
    expect(container.querySelector<HTMLInputElement>(".spec-editor input[required]")?.value).toBe(candidate.label);
    expect(api.capabilitiesApi.create).not.toHaveBeenCalled();
    await act(async () => button("취소").click());
    await act(async () => router.navigate("/analysis"));
    await act(async () => router.navigate(-1));
    expect(router.state.location.state).toBeNull();
    expect(container.querySelector(".spec-editor")).toBeNull();
  });
  it("shows a newly created spec immediately using the real minimal response and can then save the profile", async () => {
    await mount(); await addSpec(" Python ");
    expect(container.querySelector(".spec-list")?.textContent).toContain("Python");
    expect(container.textContent).toContain("1개 등록됨");
    expect(container.querySelector(".spec-editor")).toBeNull();
    await act(async () => button("저장").click());
    expect(api.profileApi.update).toHaveBeenCalledWith(expect.objectContaining({ expected_profile_version: 5, major_concept_id: "major:cs", expected_graduation_on: "2028-02-01" }));
    expect(container.textContent).toContain("프로필을 저장했어요");
    await remount();
    expect(container.textContent).toContain("Python");
  });

  it("saves edited fields, clears stale major concepts and nullable fields, and persists them after remount", async () => {
    await mount(); await input("#mi-major", " 데이터사이언스 ");
    await select("#mi-grade", ""); await select("#mi-enrollment", ""); await select("#mi-graduation-year", "");
    await act(async () => button("저장").click());
    expect(api.profileApi.update).toHaveBeenCalledWith({ expected_profile_version: 4, major_raw: "데이터사이언스", major_concept_id: null, year: null, enrollment_status: null, expected_graduation_on: null });
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("데이터사이언스");
    await remount();
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("데이터사이언스");
    expect(container.querySelector<HTMLSelectElement>("#mi-grade")?.value).toBe("");
    expect(container.querySelector<HTMLSelectElement>("#mi-graduation-year")?.value).toBe("");
  });

  it("allows clearing the major without inventing a placeholder value", async () => {
    await mount(); await input("#mi-major", " "); await act(async () => button("저장").click());
    expect(profile.major_raw).toBe("");
    expect(profile.major_concept_id).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("");
  });

  it("shows profile conflicts while preserving edits and succeeds on an explicit retry", async () => {
    await mount(); await input("#mi-major", "새 학과"); bumpVersion();
    await act(async () => button("저장").click());
    expect(api.profileApi.update).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("입력 내용은 유지했어요");
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("새 학과");
    await act(async () => button("저장").click());
    expect(api.profileApi.update).toHaveBeenCalledWith(expect.objectContaining({ expected_profile_version: 5, major_raw: "새 학과" }));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(["profile_version", "version"])("refreshes %s after a PUT conflict so one explicit retry can save", async versionField => {
    await mount(); await input("#mi-major", "내 수정 내용");
    api.profileApi.update.mockImplementationOnce(async () => {
      bumpVersion();
      api.profileApi.get.mockResolvedValueOnce({ [versionField]: profile.version });
      throw { status: 409 };
    });
    await act(async () => button("저장").click());
    expect(api.profileApi.get).toHaveBeenCalledTimes(3);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("입력 내용은 유지했어요");
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("내 수정 내용");
    await act(async () => button("저장").click());
    expect(api.profileApi.update).toHaveBeenCalledTimes(2);
    expect(api.profileApi.update).toHaveBeenLastCalledWith(expect.objectContaining({ expected_profile_version: 5, major_raw: "내 수정 내용" }));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("keeps the 409 message and edits if the conflict refresh fails", async () => {
    await mount(); await input("#mi-major", "내 수정 내용");
    api.profileApi.update.mockImplementationOnce(async () => {
      api.profileApi.get.mockRejectedValueOnce(new Error("offline"));
      throw { status: 409 };
    });
    await act(async () => button("저장").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("다른 정보가 먼저 변경됐어요");
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("내 수정 내용");
    expect(button("저장").disabled).toBe(false);
  });

  it.each([422, 500])("does not refresh profile state after a %s save failure", async status => {
    await mount(); await input("#mi-major", "내 수정 내용");
    api.profileApi.update.mockRejectedValueOnce({ status });
    await act(async () => button("저장").click());
    expect(api.profileApi.get).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(status === 422 ? "입력값을 확인" : "저장하지 못했어요");
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("내 수정 내용");
  });

  it.each(["add", "delete"])("does not hide an external profile change after a successful spec %s", async operation => {
    capabilities = [capability("old", "Java")];
    await mount(); await input("#mi-major", "내 수정 내용");
    profile = { ...profile, major_raw: "외부에서 바뀐 학과" }; bumpVersion();
    if (operation === "add") {
      await addSpec("Python");
      expect(container.querySelector(".spec-list")?.textContent).toContain("Python");
    } else {
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Java 삭제"]')!.click());
      await act(async () => button("삭제 확인").click());
      expect(container.querySelector(".spec-list")?.textContent).not.toContain("Java");
    }
    await act(async () => button("저장").click());
    expect(api.profileApi.update).not.toHaveBeenCalled();
    expect(profile.major_raw).toBe("외부에서 바뀐 학과");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("다른 정보가 먼저 변경됐어요");
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("내 수정 내용");
  });

  it("uses February/August semester selectors and month-end dates while preserving an untouched legacy date", async () => {
    await mount();
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector<HTMLSelectElement>("#mi-graduation-year")?.value).toBe("2028");
    expect(container.querySelector<HTMLSelectElement>("#mi-graduation-term")?.value).toBe("02");
    await act(async () => button("저장").click());
    expect(profile.expected_graduation_on).toBe("2028-02-01");
    await select("#mi-graduation-year", "2028"); await select("#mi-graduation-term", "02");
    await act(async () => button("저장").click());
    expect(profile.expected_graduation_on).toBe("2028-02-29");
    await select("#mi-graduation-year", "2029"); await select("#mi-graduation-term", "08");
    await act(async () => button("저장").click());
    expect(profile.expected_graduation_on).toBe("2029-08-31");
  });

  it("preserves legacy graduation dates and existing grades outside the standard four-year list", async () => {
    profile = { ...profile, year: 5, expected_graduation_on: "2025-03-18" };
    await mount();
    expect(container.querySelector<HTMLSelectElement>("#mi-grade")?.value).toBe("5학년");
    expect(container.querySelector<HTMLSelectElement>("#mi-graduation-term")?.value).toBe("");
    await act(async () => button("저장").click());
    expect(api.profileApi.update).toHaveBeenCalledWith(expect.objectContaining({ year: 5, expected_graduation_on: "2025-03-18" }));
  });

  it("keeps deleted specs absent after a reload even if an old server lists revoked rows", async () => {
    capabilities = [capability("old", "Java"), capability("revoked", "Removed chat skill", "REVOKED")];
    await mount();
    expect(container.textContent).not.toContain("Removed chat skill");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Java 삭제"]')!.click());
      await act(async () => button("삭제 확인").click());
    expect(container.textContent).not.toContain("Java");
    expect(api.capabilitiesApi.delete).toHaveBeenCalledWith("old", { expected_profile_version: 4 });
    await act(async () => button("저장").click());
    expect(api.profileApi.update).toHaveBeenCalledWith(expect.objectContaining({ expected_profile_version: 5 }));
    await remount();
    expect(container.textContent).not.toContain("Java");
    expect(container.textContent).toContain("0개 등록됨");
  });

  it("exposes profile load failures and recovers through the load retry", async () => {
    api.profileApi.get.mockRejectedValueOnce(new Error("offline")); await mount();
    expect(button("저장").disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("프로필을 불러오지 못했어요");
    await act(async () => button("프로필 다시 불러오기").click());
    expect(container.querySelector<HTMLInputElement>("#mi-major")?.value).toBe("컴퓨터공학");
    expect(button("저장").disabled).toBe(false);
  });

  it("requests a fresh analysis only after the user chooses it", async () => {
    await mount(); await addSpec("Python");
    expect(api.analysisApi.create).not.toHaveBeenCalled();
    await act(async () => button("변경 내용으로 다시 분석").click());
    expect(api.analysisApi.create).toHaveBeenCalledWith({ goal_id: "active-goal", expected_profile_version: 5, basis_type: "EDITORIAL" });
    expect(container.textContent).toBe("Analysis page");
  });

  it("keeps saved data and offers retry when explicit reanalysis fails", async () => {
    await mount(); await addSpec("Python");
    api.analysisApi.create.mockRejectedValueOnce(new Error("offline"));
    await act(async () => button("변경 내용으로 다시 분석").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("저장한 내용은 유지됐어요");
    expect(container.querySelector(".spec-list")?.textContent).toContain("Python");
    await act(async () => button("변경 내용으로 다시 분석").click());
    expect(api.capabilitiesApi.create).toHaveBeenCalledTimes(1);
    expect(api.analysisApi.create).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe("Analysis page");
  });

  it("offers goal setup after saving when no analyzable active goal exists", async () => {
    goalState.goals = [];
    await mount(); await addSpec("Python");
    expect(container.querySelector('a[href="/myinfo#goals"]')?.textContent).toContain("목표 설정하기");
    expect(api.analysisApi.create).not.toHaveBeenCalled();
  });
});
