import { describe, expect, it } from "vitest";
import { anchorAiSuggestion, importedDraft, pointSlice, redactContacts, resumeError } from "./resumeModel";
import { specPayload } from "../specs/specModel";
import type { ResumeBlock, ResumeScan, ResumeSuggestion } from "../../services/types";
const block: ResumeBlock = { block_id: "a".repeat(24), text: "😀 Python Python", text_hash: "b".repeat(64), page: null };
const suggestion: ResumeSuggestion = { suggestion_id: "rule-1", block_id: block.block_id, title: "Python", category: "skill", quote: "Python", start: 9, end: 15, method: "KEYWORD", competencies: [], score: null, score_max: null };
const scan: ResumeScan = { document_sha256: "c".repeat(64), parser_revision: "jobtology-resume-v1-7541e87", blocks: [block], suggestions: [suggestion], warnings: [], skipped_pages: [] };
describe("resume source evidence", () => {
  it("keeps the scan limit at twenty pages and uses three pages only for AI errors", () => {
    const cause = { detail: { error: { code: "PAGE_LIMIT" } } };
    expect(resumeError(cause)).toBe("이력서는 20쪽 이하로 나눠서 올려 주세요.");
    expect(resumeError(cause, "scan")).toBe(resumeError(cause));
    expect(resumeError(cause, "ai")).toBe("이력서는 3쪽 이하로 나눠서 올려 주세요.");
  });
  it("shows parser errors with the same request reference as backend logs", () => {
    const request_id = "12345678-abcd-4321-abcd-123456789abc";
    expect(resumeError({ status: 422, detail: { error: { code: "UNREADABLE_DOCUMENT", request_id } } }))
      .toBe(`문서의 텍스트를 읽지 못했어요. 다시 시도하거나 DOCX 등 다른 형식으로 저장해 주세요. (문의 코드: ${request_id})`);
    expect(resumeError({ status: 422, detail: { error: { code: "PARSE_TIMEOUT", request_id } } }))
      .toContain("시간이 초과됐어요");
    expect(resumeError({ status: 503, detail: { error: { code: "PARSER_ISOLATION_UNAVAILABLE", request_id } } }))
      .toBe(`현재 서버의 문서 처리 환경을 사용할 수 없어요. 잠시 후 다시 시도해 주세요. (문의 코드: ${request_id})`);
    expect(resumeError({ status: 500, detail: { error: { request_id: "untrusted text" } } })).not.toContain("untrusted text");
  });
  it("rejects empty quotations before every anchoring and draft path", () => {
    const empty = { ...suggestion, quote: "", start: 0, end: 0 };
    expect(anchorAiSuggestion(empty, block.text, block)).toBeNull();
    expect(anchorAiSuggestion(empty, "edited passage", block)).toBeNull();
    expect(anchorAiSuggestion(empty, "", { ...block, text: "" })).toBeNull();
    expect(() => importedDraft(scan, block, empty)).toThrow("원문 근거");
    expect(() => importedDraft(scan, { ...block, text: "" })).toThrow("원문 근거");
  });
  it("uses Unicode code points and the specified repeated occurrence", () => {
    expect(pointSlice(block.text, 9, 15)).toBe("Python");
    const draft = importedDraft(scan, block, suggestion);
    expect(draft.document_evidence?.start).toBe(9);
    expect(draft.proficiency).toBe("");
    expect(() => specPayload(draft)).toThrow("수행한 수준");
    const payload = specPayload({ ...draft, proficiency: "GUIDED" });
    expect(payload.details.source).toBe("DOCUMENT_IMPORT");
    expect(payload.details.document_evidence?.quote).toBe("Python");
  });
  it("rejects mismatched spans and does not anchor an ambiguous quote after redaction", () => {
    expect(() => importedDraft(scan, block, { ...suggestion, start: 0 })).toThrow();
    expect(anchorAiSuggestion(suggestion, block.text, block)?.start).toBe(9);
    expect(anchorAiSuggestion({ ...suggestion, start: 0, end: 6 }, "Python", block)).toBeNull();
    expect(anchorAiSuggestion({ ...suggestion, quote: "invented" }, block.text, block)).toBeNull();
  });
  it("redacts common contact patterns without rewriting dates or source evidence", () => {
    expect(redactContacts("user@example.com 010-1234-5678 2026.06")).toBe("[이메일 삭제] [전화번호 삭제] 2026.06");
    expect(importedDraft(scan, block).evidence).toBe(block.text);
  });
  it("preserves partial dates as quoted fields and saves education without a made-up proficiency", () => {
    const text = "서울대학교 컴퓨터공학 학사 2023.02 졸업";
    const source = { ...block, text };
    const item = { ...suggestion, category: "education" as const, quote: text, start: 0, end: Array.from(text).length,
      fields: { school: "서울대학교", degree: "학사", major: "컴퓨터공학", ended_on: "2023.02", organization: "invented" } };
    const draft = importedDraft(scan, source, item);
    expect(draft).toMatchObject({ school: "서울대학교", major: "컴퓨터공학", ended_on: "", proficiency: "" });
    expect(draft.imported_fields).not.toHaveProperty("organization");
    expect(specPayload(draft)).toMatchObject({ category: "education", proficiency: null, details: { competency_ids: [], ended_on: null, imported_fields: { ended_on: "2023.02" } } });
  });
  it("prefills only valid complete dates and never invents the first day of a month", () => {
    const text = "진행: 2024.1.2 2024.02 2024.02.31";
    const source = { ...block, text };
    const draft = importedDraft(scan, source, { ...suggestion, quote: text, start: 0, end: text.length,
      fields: { started_on: "2024.1.2", ended_on: "2024.02", issued_on: "2024.02.31" } });
    expect(draft).toMatchObject({ started_on: "2024-01-02", ended_on: "", issued_on: "" });
  });
  it("retains oversized extracted fields for review without putting unsavable values in form controls", () => {
    const text = "학교".repeat(110);
    const source = { ...block, text };
    const draft = importedDraft(scan, source, { ...suggestion, category: "education", quote: text, start: 0, end: text.length, fields: { school: text } });
    expect(draft.school).toBe(""); expect(draft.imported_fields?.school).toBe(text);
    expect(specPayload(draft).details.school).toBeNull();
  });
});
