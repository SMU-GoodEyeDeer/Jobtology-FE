// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResumeScanner } from "./ResumeScanner";
import type { ResumeAnalysisEvent, ResumeScan } from "../../services/types";
const api = vi.hoisted(() => ({ status: vi.fn(), scan: vi.fn(), interpret: vi.fn(), analyze: vi.fn() }));
vi.mock("../../services/api", () => ({ resumeApi: api }));
const text = "😀 Python과 FastAPI로 로그인 API 프로젝트를 직접 구현했습니다. user@example.com";
const result: ResumeScan = { document_sha256: "d".repeat(64), parser_revision: "jobtology-resume-v1-7541e87", blocks: [{ block_id: "a".repeat(24), text, text_hash: "b".repeat(64), page: null }], warnings: ["EXTRACTED_TEXT_REVIEW"], skipped_pages: [], suggestions: [{ suggestion_id: "rule-1", block_id: "a".repeat(24), title: "서버프로그램 구현", category: "project", quote: text, start: 0, end: Array.from(text).length, method: "KEYWORD", score: null, score_max: null, competencies: [{ entity_id: "ncs:unit:2001020211", label: "서버프로그램 구현", source: "NCS", original_label: "서버프로그램 구현", aliases: ["Python"], ncs_level: 4, requirement_keys: ["BACKEND:2001020211"] }] }] };
let root: Root, container: HTMLDivElement;
const review = vi.fn(), close = vi.fn();
function button(text: string) { const item = [...container.querySelectorAll("button")].find(node => node.textContent === text); if (!item) throw new Error(`Missing ${text}`); return item; }
async function click(text: string) { await act(async () => button(text).click()); }
async function upload(filename = "resume.docx") {
  await act(async () => { const input = container.querySelector<HTMLInputElement>('input[type="file"]')!; Object.defineProperty(input, "files", { configurable: true, value: [new File(["test"], filename)] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.status.mockResolvedValue({ formats: ["docx", "pdf"], max_bytes: 10 * 1024 * 1024, max_pdf_pages: 3, parse_timeout_seconds: 60, ai_available: true, ai_provider: "OpenAI" });
  api.scan.mockResolvedValue(structuredClone(result)); api.interpret.mockResolvedValue({ suggestions: [], rejected_count: 0 });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(ResumeScanner, { onReview: review, onClose: close, existingCompetencyIds: [], occupationId: "BACKEND" })));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("scans without AI, highlights source and opens a draft with no inferred level", async () => {
  await upload(); expect(api.scan).toHaveBeenCalledWith(expect.any(File), "docx", "BACKEND", expect.any(AbortSignal));
  expect(api.interpret).not.toHaveBeenCalled();
  await click("원문 근거 보기"); expect(container.querySelector("mark")?.textContent).toBe(text);
  await click("검토하고 추가");
  expect(review.mock.calls[0][0]).toMatchObject({ proficiency: "", source: "DOCUMENT_IMPORT", category: "project", evidence: text });
  await act(async () => review.mock.calls[0][1]()); expect(button("저장 완료").disabled).toBe(true);
});
it("requires explicit consent before transmitting only the reviewed passage", async () => {
  await upload(); await click("역량을 못 찾겠어요 · AI 도움");
  const input = container.querySelector<HTMLTextAreaElement>("textarea")!;
  expect(input.value).toContain("[이메일 삭제]"); expect(api.interpret).not.toHaveBeenCalled();
  expect(button("이 구절만 AI로 해석").disabled).toBe(true);
  await act(async () => container.querySelector<HTMLInputElement>('.resume-ai input[type="checkbox"]')!.click());
  await click("이 구절만 AI로 해석"); expect(api.interpret).toHaveBeenCalledWith(input.value, "BACKEND");
  expect(container.textContent).toContain("원문과 연결할 수 있는 제안이 없어요");
});
it("renders hostile document content as text and explains partially unreadable PDFs", async () => {
  const hostile = '<img src=x onerror="alert(1)"><script>window.bad=true</script>';
  api.scan.mockResolvedValue({ ...result, suggestions: [], blocks: [{ ...result.blocks[0], text: hostile }], warnings: ["OCR_REQUIRED"], skipped_pages: [2] });
  await upload(); expect(container.textContent).toContain(hostile); expect(container.querySelector("img,script")).toBeNull();
  expect(container.textContent).toContain("읽지 못한 페이지: 2"); await click("이 문단으로 직접 스펙 추가"); expect(review.mock.calls[0][0].selected).toEqual([]);
});
it("ignores a late scan response after cancellation", async () => {
  let complete!: (value: ResumeScan) => void;
  api.scan.mockReturnValue(new Promise<ResumeScan>(resolve => { complete = resolve; }));
  await upload(); await click("읽기 취소");
  await act(async () => complete(result)); expect(container.textContent).not.toContain("서버프로그램 구현");
  expect(api.scan.mock.calls[0][3].aborted).toBe(true);
});
it("shows AI quota failures without losing direct review", async () => {
  await upload(); api.interpret.mockRejectedValue({ status: 429 }); await click("역량을 못 찾겠어요 · AI 도움");
  await act(async () => container.querySelector<HTMLInputElement>('.resume-ai input[type="checkbox"]')!.click()); await click("이 구절만 AI로 해석");
  expect(container.textContent).toContain("요청 한도"); expect(button("이 문단으로 직접 스펙 추가").disabled).toBe(false);
});
it("requires document consent and a PDF, then streams multiple independently reviewable entries", async () => {
  let emit!: (event: ResumeAnalysisEvent) => void, finish!: () => void;
  api.analyze.mockImplementation((_file, _occupation, callback) => { emit = callback; return new Promise<void>(resolve => { finish = resolve; }); });
  await act(async () => container.querySelector<HTMLInputElement>('.resume-bulk-consent input')!.click());
  expect(container.querySelector<HTMLInputElement>('input[type="file"]')!.accept).toBe(".pdf");
  await upload(); expect(api.analyze).not.toHaveBeenCalled(); expect(container.textContent).toContain("PDF만 지원");
  await upload("resume.pdf");
  expect(api.scan).not.toHaveBeenCalled();
  await act(async () => {
    emit({ type: "scan", scan: { ...result, suggestions: [] } });
    emit({ type: "paragraph", block_id: result.blocks[0].block_id, completed: 1, total: 2, suggestions: [result.suggestions[0]], error_code: null, rejected_count: 0 });
  });
  expect(container.querySelector("progress")?.value).toBe(1);
  await click("검토하고 추가"); await act(async () => review.mock.calls[0][1]());
  await act(async () => {
    emit({ type: "paragraph", block_id: result.blocks[0].block_id, completed: 2, total: 2, suggestions: [{ ...result.suggestions[0], suggestion_id: "education", title: "서울대학교", category: "education", competencies: [], fields: {} }], error_code: null, rejected_count: 0 });
    emit({ type: "done", completed: 2, total: 2, failed: 0, rejected_count: 0, omitted_count: 0, timed_out: false }); finish();
  });
  expect(container.querySelectorAll(".resume-candidate")).toHaveLength(2);
  expect(button("저장 완료").disabled).toBe(true);
  await click("검토하고 추가"); expect(review).toHaveBeenCalledTimes(2);
  expect(review.mock.calls[1][0]).toMatchObject({ category: "education", proficiency: "", selected: [] });
});
it("keeps streamed suggestions on cancellation and ignores late results", async () => {
  let emit!: (event: ResumeAnalysisEvent) => void, finish!: () => void;
  api.analyze.mockImplementation((_file, _occupation, callback) => { emit = callback; return new Promise<void>(resolve => { finish = resolve; }); });
  await act(async () => container.querySelector<HTMLInputElement>('.resume-bulk-consent input')!.click());
  await upload("resume.pdf");
  await act(async () => { emit({ type: "scan", scan: result }); });
  await click("분석 중단"); expect(api.analyze.mock.calls[0][3].aborted).toBe(true);
  await act(async () => { emit({ type: "paragraph", block_id: result.blocks[0].block_id, completed: 1, total: 1, suggestions: [{ ...result.suggestions[0], suggestion_id: "late" }], error_code: null, rejected_count: 0 }); finish(); });
  expect(container.querySelectorAll(".resume-candidate")).toHaveLength(1);
  expect(container.textContent).toContain("도착한 제안은 검토할 수 있어요");
});
