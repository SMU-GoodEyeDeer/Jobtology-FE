// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapabilityMutationRequest } from "../../services/types";
import { OnboardingChat } from "./OnboardingChat";

const mocks = vi.hoisted(() => ({
  startGoal: vi.fn(), saveProfile: vi.fn(), refresh: vi.fn(),
  capabilitiesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn() }, profileApi: { get: vi.fn() }, skillsApi: { search: vi.fn() }, chatApi: { status: vi.fn(), send: vi.fn() },
}));
vi.mock("../../services/api", () => ({ capabilitiesApi: mocks.capabilitiesApi, profileApi: mocks.profileApi, skillsApi: mocks.skillsApi, chatApi: mocks.chatApi }));
vi.mock("../../services/onboardingSave", () => ({ startGoal: mocks.startGoal, saveProfile: mocks.saveProfile }));
vi.mock("../../context/SessionContext", () => ({ useSession: () => ({ session: { user_id: "user" }, loading: false, refresh: mocks.refresh }) }));
vi.mock("../../context/OccupationsContext", () => ({ useOccupations: () => ({ occupations: [{ occupation_id: "BACKEND", name: "백엔드 개발자" }] }) }));
vi.mock("motion/react", async importOriginal => ({ ...await importOriginal<typeof import("motion/react")>(), useReducedMotion: () => true }));
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.startGoal.mockReset().mockResolvedValue(undefined); mocks.saveProfile.mockReset().mockResolvedValue(true); mocks.refresh.mockReset().mockResolvedValue(undefined);
  mocks.capabilitiesApi.list.mockReset().mockResolvedValue({ items: [] });
  mocks.profileApi.get.mockReset().mockResolvedValue({ version: 4, profile_version: 4 });
  mocks.skillsApi.search.mockReset().mockResolvedValue({ items: [], total: 0, available_sources: ["NCS", "ONET"] });
  mocks.chatApi.status.mockReset(); mocks.chatApi.send.mockReset();
  mocks.capabilitiesApi.create.mockReset().mockResolvedValue({ capability_id: "cap", profile_version: 5 });
  mocks.capabilitiesApi.get.mockReset().mockImplementation(async () => {
    const request = mocks.capabilitiesApi.create.mock.calls[0][0] as CapabilityMutationRequest;
    return { ...request, capability_id: "cap", lifecycle: "ACTIVE", entity_id: null, verification: "SELF_REPORTED", matching: { status: "UNUSED", credit: 0, competencies: [], message: "활성 목표와 연결된 역량이 없어 보관해요." } };
  });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
function button(text: string) { return [...container.querySelectorAll("button")].find(item => item.textContent === text)!; }
async function click(text: string) { await act(async () => button(text).click()); }
describe("onboarding and MyInfo shared spec flow", () => {
  it.each([["아직 모르겠어요", null], ["백엔드 개발자", "BACKEND"]])("offers the same editor for %s and saves before optional finish", async (choice, occupation) => {
    await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/onboarding"] }, createElement(Routes, null,
      createElement(Route, { path: "/onboarding", element: createElement(OnboardingChat) }), createElement(Route, { path: "/home/first", element: createElement("p", null, "처음 홈") }),
    ))));
    await click(choice!); await click("건너뛰기"); await click("건너뛰기");
    expect(mocks.startGoal).toHaveBeenCalledWith(occupation);
    expect(container.querySelector('[aria-label="내 스펙 관리"]')).not.toBeNull();
    await click("스펙 추가");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    expect(mocks.skillsApi.search).toHaveBeenCalledWith({ q: "", limit: 20, ...(occupation ? { occupation_id: occupation } : {}) });
    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('.spec-editor input[required]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "새 프로젝트"); input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("스펙 저장");
    expect(mocks.capabilitiesApi.create).toHaveBeenCalledWith(expect.objectContaining({ category: "skill", raw_text: "새 프로젝트", expected_profile_version: 4, proficiency: "FAMILIAR", details: expect.objectContaining({ competency_ids: [], source: "MANUAL" }) }), expect.any(String));
    expect(container.querySelector(".spec-item")?.textContent).toContain("현재 목표에 미반영");
    expect(mocks.chatApi.status).not.toHaveBeenCalled(); expect(mocks.chatApi.send).not.toHaveBeenCalled();
    await click("정리 완료, 시작하기");
    expect(mocks.refresh).toHaveBeenCalledOnce(); expect(mocks.startGoal).toHaveBeenCalledOnce();
    expect(container.textContent).toBe("처음 홈");
  });
  it("allows skipping specs without an AI request or empty capability mutation", async () => {
    await act(async () => root.render(createElement(MemoryRouter, null, createElement(OnboardingChat))));
    await click("아직 모르겠어요"); await click("건너뛰기"); await click("건너뛰기");
    await click("스펙은 나중에 추가하기");
    expect(mocks.capabilitiesApi.create).not.toHaveBeenCalled(); expect(mocks.chatApi.send).not.toHaveBeenCalled();
  });
});
