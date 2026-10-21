// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapabilityDetailResponse, CapabilityMutationRequest, CapabilityMutationResponse, CatalogSkill } from "../../services/types";
import { SpecManager } from "./SpecManager";

const api = vi.hoisted(() => ({
  capabilitiesApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  profileApi: { get: vi.fn() }, skillsApi: { search: vi.fn() }, chatApi: { status: vi.fn(), send: vi.fn() },
  resumeApi: { status: vi.fn(), scan: vi.fn(), interpret: vi.fn() },
}));
vi.mock("../../services/api", () => api);
const ncs: CatalogSkill = { entity_id: "ncs:2001020301", label: "프로그래밍", source: "NCS", original_label: "프로그래밍", aliases: ["Python", "programming"], requirement_keys: ["BACKEND:2001020301"], ncs_level: 4 };
const onet: CatalogSkill = { entity_id: "onet:skill:2.B.3.e", label: "수학", source: "ONET", original_label: "Mathematics", aliases: ["수학", "Mathematics"], requirement_keys: [], ncs_level: null };
let root: Root; let container: HTMLDivElement;
let version: number; let count: number;
let items: CapabilityDetailResponse[];
let replay: Map<string, CapabilityMutationResponse>;
const onMutation = vi.fn();
function stored(id: string, request?: CapabilityMutationRequest): CapabilityDetailResponse {
  const selected = request?.details.competency_ids ?? [ncs.entity_id];
  const evidence = request?.details.evidence ?? "Python으로 데이터를 정제하고 분석 결과를 문서로 정리했어요.";
  const competencies = [ncs, onet].filter(value => selected.includes(value.entity_id));
  const linked = competencies.some(value => value.requirement_keys.length);
  return { capability_id: id, category: request?.category ?? "skill", raw_text: request?.raw_text ?? "Python 분석", lifecycle: "ACTIVE", entity_id: null, verification: "SELF_REPORTED", proficiency: request?.proficiency ?? "INDEPENDENT", details: request?.details ?? { competency_ids: selected, evidence, source: "MANUAL" }, matching: { status: evidence.length >= 20 && linked ? "MATCHED" : "UNUSED", credit: evidence.length >= 20 && linked ? .75 : 0, competencies, message: linked ? "입력 근거로 학습량을 줄이는 모델이에요." : "현재 목표와 연결된 역량이 없어 보관만 해요." } };
}
async function render(occupationId?: string) { await act(async () => root.render(createElement(SpecManager, { occupationId, onMutation }))); }
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }
function button(text: string) {
  const result = [...container.querySelectorAll("button")].find(element => element.textContent === text);
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
}
function field(text: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const label = [...container.querySelectorAll("label")].find(element => element.firstChild?.textContent === text);
  if (!label) throw new Error(`Missing field ${text}`);
  return (label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector("input,select,textarea")) as HTMLInputElement;
}
async function change(text: string, value: string) {
  await act(async () => {
    const input = field(text);
    const prototype = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function click(text: string) { await act(async () => button(text).click()); }
async function start(title = "새 스펙") { await click("스펙 추가"); await settle(); await change("스펙 제목", title); }
async function choose(label = ncs.label) {
  await act(async () => [...container.querySelectorAll<HTMLLabelElement>(".spec-skill-option")].find(item => item.textContent?.includes(label))!.querySelector<HTMLInputElement>("input")!.click());
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  for (const group of Object.values(api)) for (const mock of Object.values(group)) mock.mockReset();
  items = []; version = 4; count = 0; replay = new Map(); onMutation.mockClear();
  api.profileApi.get.mockImplementation(async () => ({ version, profile_version: version }));
  api.skillsApi.search.mockResolvedValue({ items: [ncs, onet], total: 2, available_sources: ["NCS", "ONET"] });
  api.capabilitiesApi.list.mockImplementation(async () => ({ items: items.filter(item => item.lifecycle === "ACTIVE") }));
  api.capabilitiesApi.get.mockImplementation(async (id: string) => {
    const item = items.find(value => value.capability_id === id && value.lifecycle === "ACTIVE");
    if (!item) throw { status: 404 }; return { ...item };
  });
  api.capabilitiesApi.create.mockImplementation(async (request: CapabilityMutationRequest, key: string) => {
    if (replay.has(key)) return replay.get(key)!;
    if (request.expected_profile_version !== version) throw { status: 409 };
    const id = `cap-${++count}`; items.push(stored(id, request)); version += 1;
    const response = { capability_id: id, profile_version: version }; replay.set(key, response); return response;
  });
  api.capabilitiesApi.update.mockImplementation(async (id: string, request: CapabilityMutationRequest) => {
    if (request.expected_profile_version !== version) throw { status: 409 };
    items = items.map(item => item.capability_id === id ? stored(id, request) : item); version += 1;
    return { capability_id: id, profile_version: version };
  });
  api.capabilitiesApi.delete.mockImplementation(async (id: string, request: { expected_profile_version: number }) => {
    if (request.expected_profile_version !== version) throw { status: 409 };
    items = items.filter(item => item.capability_id !== id); version += 1; return { capability_id: id, profile_version: version };
  });
  api.chatApi.status.mockResolvedValue({ available: true });
  api.chatApi.send.mockResolvedValue({ reply: "직접 수행한 내용을 확인해 주세요.", candidates: [{ entity_id: ncs.entity_id, label: ncs.label, evidence_quote: "Python으로 분석했어요" }] });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("shared spec CRUD and canonical selection", () => {
  it("searches Korean and English canonical entries without invoking AI, and shows distinct provenance", async () => {
    await render("BACKEND"); await start();
    expect(api.skillsApi.search).toHaveBeenCalledWith({ q: "", occupation_id: "BACKEND", limit: 20 });
    expect(container.textContent).toContain("Mathematics");
    expect(container.textContent).toContain("O*NET® 31.0 · USDOL/ETA · CC BY 4.0");
    expect(container.textContent).toContain("Jobtology 한국어 번역(비공식)");
    await change("역량 검색", "Python");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 210)); });
    expect(api.skillsApi.search).toHaveBeenLastCalledWith({ q: "Python", occupation_id: "BACKEND", limit: 20 });
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    await act(async () => field("역량 검색").dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    expect(api.capabilitiesApi.create).not.toHaveBeenCalled();
    expect(api.chatApi.status).not.toHaveBeenCalled(); expect(api.chatApi.send).not.toHaveBeenCalled();
  });
  it("creates, fetches full matching feedback, edits a full replacement, and deletes with fresh versions", async () => {
    await render(); await start("Python 분석"); await choose(); await change("수행 내용·근거", "Python으로 데이터를 정제하고 분석 결과를 문서로 정리했어요."); await change("직접 수행한 수준", "INDEPENDENT");
    await click("스펙 저장");
    expect(api.capabilitiesApi.create).toHaveBeenCalledWith(expect.objectContaining({ expected_profile_version: 4, category: "skill", proficiency: "INDEPENDENT", details: expect.objectContaining({ competency_ids: [ncs.entity_id] }) }), expect.any(String));
    expect(api.capabilitiesApi.get).toHaveBeenCalledWith("cap-1");
    expect(container.querySelector(".spec-list")?.textContent).toContain("모델 반영 비율 75%");
    expect(onMutation).toHaveBeenLastCalledWith(expect.objectContaining({ requestVersion: 4, profileVersion: 5 }));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Python 분석 수정"]')!.click()); await settle();
    await change("스펙 제목", "분석 프로젝트"); await change("스펙 종류", "project"); await change("담당 역할", "데이터 분석");
    await click("스펙 저장");
    expect(api.capabilitiesApi.update).toHaveBeenCalledWith("cap-1", expect.objectContaining({ expected_profile_version: 5, category: "project", raw_text: "분석 프로젝트", details: expect.objectContaining({ role: "데이터 분석", competency_ids: [ncs.entity_id] }) }));
    expect(container.querySelector(".spec-details-summary")?.textContent).toContain("담당 역할데이터 분석");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="분석 프로젝트 삭제"]')!.click()); await click("취소");
    expect(api.capabilitiesApi.delete).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="분석 프로젝트 삭제"]')!.click()); await click("삭제 확인");
    expect(api.capabilitiesApi.delete).toHaveBeenCalledWith("cap-1", { expected_profile_version: 6 });
    expect(container.querySelector(".spec-item")).toBeNull();
  });
  it("stores an unlinked spec without inventing current-goal credit", async () => {
    await render(); await start(); await choose(onet.label); await click("스펙 저장");
    expect(container.querySelector(".spec-item")?.textContent).toContain("현재 목표에 미반영");
    expect(container.querySelector(".spec-item")?.textContent).toContain("모델 반영 비율 0%");
    expect(api.capabilitiesApi.create.mock.calls[0][0].details.evidence).toBe("");
    expect(api.skillsApi.search.mock.calls[0][0]).not.toHaveProperty("occupation_id");
  });
  it.each([
    ["project", "시작일", "종료일", "2026-09-30", "2026-10-01", "started_on", "ended_on"],
    ["certification", "발급·응시일", "만료일", "2027-09-30", "2027-10-01", "issued_on", "expires_on"],
  ])("persists native DOM date input/change events through %s create, readback and edit", async (category, startLabel, endLabel, end, revisedEnd, startKey, endKey) => {
    async function enterDate(label: string, value: string) {
      await act(async () => {
        const input = field(label) as HTMLInputElement;
        expect(input.type).toBe("date");
        // Native editing changes the DOM value before input/change events.
        // Bypass React's value tracker exactly as a browser date control does.
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(field(label).value).toBe(value);
      expect(field(label).getAttribute("value")).toBe(value);
    }
    await render(); await start("날짜가 있는 기록"); await change("스펙 종류", category);
    if (category === "certification") await change("발급·주관 기관", "발급 기관");
    await enterDate(startLabel, "2026-07-01"); await enterDate(endLabel, end);
    await click("스펙 저장");
    expect(api.capabilitiesApi.create.mock.calls[0][0].details).toMatchObject({ [startKey]: "2026-07-01", [endKey]: end });
    expect(container.querySelector(".spec-details-summary")?.textContent).toContain("2026-07-01");
    expect(container.querySelector(".spec-details-summary")?.textContent).toContain(end);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="날짜가 있는 기록 수정"]')!.click()); await settle();
    expect(field(startLabel).value).toBe("2026-07-01"); expect(field(endLabel).value).toBe(end);
    await enterDate(endLabel, revisedEnd); await click("스펙 저장");
    expect(api.capabilitiesApi.update.mock.calls[0][1].details).toMatchObject({ [startKey]: "2026-07-01", [endKey]: revisedEnd });
    expect(container.querySelector(".spec-details-summary")?.textContent).toContain(revisedEnd);
  });
  it("preserves edits on an external version conflict and saves only after explicit retry", async () => {
    items = [stored("old")]; await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Python 분석 수정"]')!.click()); await settle();
    await change("스펙 제목", "내 수정"); version += 1;
    await click("스펙 저장");
    expect(api.capabilitiesApi.update).not.toHaveBeenCalled();
    expect(field("스펙 제목").value).toBe("내 수정");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("입력은 유지");
    await click("스펙 저장");
    expect(api.capabilitiesApi.update).toHaveBeenCalledWith("old", expect.objectContaining({ expected_profile_version: 5, raw_text: "내 수정" }));
  });
  it("retries a committed save readback without creating the item again", async () => {
    await render(); await start(); api.capabilitiesApi.get.mockRejectedValueOnce(new Error("offline"));
    await click("스펙 저장");
    expect(container.querySelector(".spec-editor")).toBeNull();
    expect(container.textContent).toContain("저장은 완료됐지만");
    expect(button("스펙 추가").disabled).toBe(true);
    await click("저장 결과 다시 불러오기");
    expect(api.capabilitiesApi.create).toHaveBeenCalledOnce();
    expect(container.querySelector(".spec-item")?.textContent).toContain("새 스펙");
  });
  it("replays a lost create response with the identical original version and idempotency key", async () => {
    await render(); await start();
    const create = api.capabilitiesApi.create.getMockImplementation()!;
    api.capabilitiesApi.create.mockImplementationOnce(async (...args) => { await create(...args); throw new Error("response lost"); });
    await click("스펙 저장");
    expect(items).toHaveLength(1); expect(version).toBe(5);
    await click("스펙 저장");
    expect(api.capabilitiesApi.create).toHaveBeenCalledTimes(2);
    expect(api.capabilitiesApi.create.mock.calls[1]).toEqual(api.capabilitiesApi.create.mock.calls[0]);
    expect(items).toHaveLength(1);
    expect(onMutation).toHaveBeenLastCalledWith(expect.objectContaining({ requestVersion: 4, profileVersion: 5 }));
  });
  it("retains failed deletes and retries using a fresh profile version", async () => {
    items = [stored("old")]; await render(); api.capabilitiesApi.delete.mockRejectedValueOnce({ status: 409 });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Python 분석 삭제"]')!.click()); await click("삭제 확인");
    expect(container.querySelector(".spec-item")).not.toBeNull(); version += 1;
    await click("삭제 확인");
    expect(api.capabilitiesApi.delete).toHaveBeenLastCalledWith("old", { expected_profile_version: 5 });
    expect(container.querySelector(".spec-item")).toBeNull();
  });
  it("does not overwrite a newer goal matching reload with a late saved-item response", async () => {
    items = [stored("old")]; await render("BACKEND");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Python 분석 수정"]')!.click()); await settle();
    await change("스펙 제목", "수정한 스펙");
    let finish!: (item: CapabilityDetailResponse) => void;
    api.capabilitiesApi.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await click("스펙 저장");
    const stale = { ...items[0] };
    items = items.map(item => ({ ...item, matching: { ...item.matching, status: "UNUSED", credit: 0, message: "새 목표에는 연결되지 않아요.", competencies: [] } }));
    await render("FRONTEND");
    await act(async () => finish(stale));
    expect(container.querySelector(".spec-item")?.textContent).toContain("새 목표에는 연결되지 않아요");
    expect(container.querySelector(".spec-item")?.textContent).toContain("모델 반영 비율 0%");
    expect(container.querySelector(".spec-item")?.textContent).not.toContain("모델 반영 비율 75%");
  });
  it("blocks duplicate pending writes even if a second form submit bypasses its disabled button", async () => {
    await render(); await start();
    const create = api.capabilitiesApi.create.getMockImplementation()!;
    let finish!: () => Promise<void>;
    api.capabilitiesApi.create.mockImplementationOnce((...args) => new Promise(resolve => { finish = async () => resolve(await create(...args)); }));
    await click("스펙 저장");
    expect(button("저장 중…").disabled).toBe(true);
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(api.capabilitiesApi.create).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(items).toHaveLength(1);
  });
  it("shows internal roadmap completion records without a legacy edit path", async () => {
    items = [{ ...stored("completion"), category: "ROADMAP_OUTCOME", details: {}, proficiency: null }]; await render();
    expect(container.querySelector(".spec-item")?.textContent).toContain("로드맵 완료 기록");
    expect(container.querySelector(".spec-item button")).toBeNull();
  });
});

describe("explicit AI fallback and confirmation", () => {
  it("applies a proposed project category only after confirmation and leaves final saving explicit", async () => {
    api.chatApi.send.mockResolvedValueOnce({ reply: "프로젝트 경험으로 정리해 보세요.", candidates: [{ entity_id: ncs.entity_id, label: ncs.label, evidence_quote: "프로젝트 API를 직접 구현했어요", category: "project" }] });
    await render(); await start(""); await click("찾는 역량이 없나요? 경험을 설명해서 찾기");
    await change("역량을 찾을 경험 설명", "주문 API 프로젝트의 데이터 모델과 테스트를 직접 구현하고 기록했어요.");
    await click("AI로 역량 제안 받기");
    expect(container.querySelector(".spec-ai-candidate")?.textContent).toContain("추천 종류 · 프로젝트");
    expect(field("스펙 종류").value).toBe("skill");
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(api.capabilitiesApi.create).not.toHaveBeenCalled();
    await click("확인하고 이 역량 선택");
    expect(field("스펙 종류").value).toBe("project");
    expect(field("담당 역할")).not.toBeNull();
    expect(field("시작일")).not.toBeNull();
    expect(field("종료일")).not.toBeNull();
    expect(api.capabilitiesApi.create).not.toHaveBeenCalled();
    await change("스펙 종류", "experience");
    expect(field("회사·기관")).not.toBeNull();
    await click("스펙 저장");
    expect(api.capabilitiesApi.create.mock.calls[0][0].category).toBe("experience");
  });
  it("keeps AI candidates separate until confirmed into the editor and explicitly saved", async () => {
    await render(); await start("");
    await click("찾는 역량이 없나요? 경험을 설명해서 찾기");
    expect(api.chatApi.status).toHaveBeenCalledOnce(); expect(api.chatApi.send).not.toHaveBeenCalled();
    await change("역량을 찾을 경험 설명", "Python으로 데이터를 정제하고 분석 결과를 문서로 정리했어요.");
    await click("AI로 역량 제안 받기");
    expect(api.chatApi.send).toHaveBeenCalledWith([{ role: "user", text: "Python으로 데이터를 정제하고 분석 결과를 문서로 정리했어요." }], "spec");
    expect(container.querySelector(".spec-selected")).toBeNull(); expect(api.capabilitiesApi.create).not.toHaveBeenCalled();
    await click("확인하고 이 역량 선택");
    expect(container.querySelector(".spec-selected")?.textContent).toContain(ncs.label);
    expect(api.capabilitiesApi.create).not.toHaveBeenCalled();
    await click("스펙 저장");
    expect(api.capabilitiesApi.create.mock.calls[0][0].details).toMatchObject({ source: "LLM_ASSISTED", competency_ids: [ncs.entity_id], evidence: "Python으로 데이터를 정제하고 분석 결과를 문서로 정리했어요." });
  });
  it("keeps manual entry usable when AI is unavailable", async () => {
    api.chatApi.status.mockResolvedValueOnce({ available: false });
    await render(); await start(); await click("찾는 역량이 없나요? 경험을 설명해서 찾기");
    expect(container.textContent).toContain("직접 입력은 계속 이용");
    expect(api.chatApi.send).not.toHaveBeenCalled();
    await click("스펙 저장"); expect(api.capabilitiesApi.create).toHaveBeenCalledOnce();
  });
});

describe("resume review through the shared spec manager", () => {
  it("keeps one modal and the scan between reviews, returning on Escape and saving successive entries", async () => {
    const quote = "Python으로 데이터를 정제하고 분석 결과를 문서로 정리했어요.";
    const block = { block_id: "b".repeat(24), text: quote, text_hash: "c".repeat(64), page: null };
    const suggestion = { block_id: block.block_id, category: "project", competencies: [ncs], quote, start: 0, end: Array.from(quote).length, method: "KEYWORD", score: null, score_max: null };
    api.resumeApi.status.mockResolvedValue({ formats: ["docx"], max_bytes: 10485760, max_pdf_pages: 20, parse_timeout_seconds: 60, ai_available: false });
    api.resumeApi.scan.mockResolvedValue({ document_sha256: "a".repeat(64), parser_revision: "jobtology-resume-v1-7541e87", warnings: [], skipped_pages: [], blocks: [block], suggestions: [{ ...suggestion, suggestion_id: "first", title: "분석 프로젝트" }, { ...suggestion, suggestion_id: "second", title: "문서화 프로젝트", competencies: [onet] }] });
    await render(); await act(async () => button("이력서에서 가져오기").focus()); await click("이력서에서 가져오기");
    const dialog = container.querySelector("dialog")!;
    expect(dialog.open).toBe(true); expect(document.body.style.overflow).toBe("hidden");
    await act(async () => { const input = container.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, "files", { value: [new File(["test"], "resume.docx")] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await click("검토하고 추가");
    expect(container.querySelector(".resume-scanner")?.parentElement?.hidden).toBe(true);
    await act(async () => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(container.querySelector(".spec-editor")).toBeNull();
    expect(container.querySelector(".resume-scanner")?.parentElement?.hidden).toBe(false);
    expect(container.querySelector("dialog")).toBe(dialog);
    await click("검토하고 추가");
    await act(async () => { dialog.close(); dialog.dispatchEvent(new Event("close")); });
    expect(container.querySelector(".spec-editor")).toBeNull();
    expect(container.querySelector(".resume-scanner")?.parentElement?.hidden).toBe(false);
    expect(dialog.open).toBe(true);
    await click("검토하고 추가"); await change("직접 수행한 수준", "GUIDED"); await click("스펙 저장");
    expect(button("검토하고 추가").disabled).toBe(false);
    await click("검토하고 추가");
    expect(field("스펙 제목").value).toBe("문서화 프로젝트");
    expect(field("직접 수행한 수준").value).toBe("");
    await change("직접 수행한 수준", "INDEPENDENT"); await click("스펙 저장");
    expect(api.resumeApi.scan).toHaveBeenCalledOnce();
    expect(api.capabilitiesApi.create.mock.calls.map(([request]) => request.expected_profile_version)).toEqual([4, 5]);
    expect(container.querySelectorAll(".spec-item")).toHaveLength(2);
    await act(async () => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(container.querySelector("dialog")).toBeNull(); expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(button("이력서에서 가져오기"));
  });
  it("keeps the dialog open during a save and restores scrolling and focus after success", async () => {
    let finish!: (value: CapabilityMutationResponse) => void;
    api.capabilitiesApi.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    document.body.style.overflow = "auto";
    await render(); await act(async () => button("스펙 추가").focus()); await start(); await click("스펙 저장");
    const dialog = container.querySelector("dialog")!;
    await act(async () => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(dialog.open).toBe(true); expect(container.querySelector(".spec-editor")).not.toBeNull();
    await act(async () => { dialog.close(); dialog.dispatchEvent(new Event("close")); });
    expect(dialog.open).toBe(true); expect(field("스펙 제목").value).toBe("새 스펙");
    expect(api.capabilitiesApi.create).toHaveBeenCalledOnce();
    items.push(stored("cap-1"));
    await act(async () => finish({ capability_id: "cap-1", profile_version: 5 }));
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("auto"); expect(document.activeElement).toBe(button("스펙 추가"));
    document.body.style.overflow = "";
  });
  it("ignores a queued close after reopening, then synchronizes an idle native close and restores the trigger", async () => {
    await render(); await act(async () => button("스펙 추가").focus()); await start();
    const dialog = container.querySelector("dialog")!;
    await act(async () => dialog.dispatchEvent(new Event("close")));
    expect(container.querySelector("dialog")).toBe(dialog); expect(dialog.open).toBe(true);
    await act(async () => { dialog.close(); dialog.dispatchEvent(new Event("close")); });
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(button("스펙 추가"));
    expect(button("스펙 추가").disabled).toBe(false);
  });
  it("ignores native close events on a detached dialog", async () => {
    await render(); await start();
    const dialog = container.querySelector("dialog")!;
    container.remove();
    await act(async () => { dialog.close(); dialog.dispatchEvent(new Event("close")); });
    expect(container.querySelector("dialog")).toBe(dialog); expect(dialog.open).toBe(false);
  });
  it("requires a chosen level, saves once with source evidence, then shows full matching feedback immediately", async () => {
    const quote = "Python으로 데이터를 정제하고 분석 결과를 문서로 정리했어요.";
    api.resumeApi.status.mockResolvedValue({ formats: ["docx"], max_bytes: 10485760, max_pdf_pages: 20, parse_timeout_seconds: 60, ai_available: false });
    api.resumeApi.scan.mockResolvedValue({ document_sha256: "a".repeat(64), parser_revision: "jobtology-resume-v1-7541e87", warnings: [], skipped_pages: [], blocks: [{ block_id: "b".repeat(24), text: quote, text_hash: "c".repeat(64), page: null }], suggestions: [{ suggestion_id: "rule", block_id: "b".repeat(24), title: "분석 프로젝트", category: "project", competencies: [ncs], quote, start: 0, end: Array.from(quote).length, method: "KEYWORD", score: null, score_max: null }] });
    await render(); await click("이력서에서 가져오기");
    await act(async () => { const input = container.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, "files", { value: [new File(["test"], "resume.docx")] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
    await click("검토하고 추가");
    expect(field("직접 수행한 수준").value).toBe("");
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(api.capabilitiesApi.create).not.toHaveBeenCalled();
    await change("직접 수행한 수준", "GUIDED"); await click("스펙 저장");
    expect(api.capabilitiesApi.create).toHaveBeenCalledOnce();
    expect(api.capabilitiesApi.create.mock.calls[0][0]).toMatchObject({ category: "project", proficiency: "GUIDED", expected_profile_version: 4, details: { source: "DOCUMENT_IMPORT", evidence: quote, document_evidence: { quote, method: "KEYWORD", block_id: "b".repeat(24) } } });
    expect(api.capabilitiesApi.get).toHaveBeenCalledWith("cap-1");
    expect(container.querySelector(".spec-item")?.textContent).toContain("분석 프로젝트");
    expect(container.querySelector(".spec-item")?.textContent).toContain("현재 목표와 연결됨");
    expect(button("저장 완료").disabled).toBe(true);
    expect(api.resumeApi.interpret).not.toHaveBeenCalled(); expect(api.chatApi.send).not.toHaveBeenCalled();
    await click("가져오기 끝내기"); expect(container.querySelector(".resume-scanner")).toBeNull();
    expect(items).toHaveLength(1);
  });
});
