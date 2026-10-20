import { describe, expect, it } from "vitest";
import { anchorAiSuggestion, importedDraft, pointSlice, redactContacts } from "./resumeModel";
import { specPayload } from "../specs/specModel";
import type { ResumeBlock, ResumeScan, ResumeSuggestion } from "../../services/types";
const block: ResumeBlock = { block_id: "a".repeat(24), text: "😀 Python Python", text_hash: "b".repeat(64), page: null };
const suggestion: ResumeSuggestion = { suggestion_id: "rule-1", block_id: block.block_id, title: "Python", category: "skill", quote: "Python", start: 9, end: 15, method: "KEYWORD", competencies: [], score: null, score_max: null };
const scan: ResumeScan = { document_sha256: "c".repeat(64), parser_revision: "jobtology-resume-v1-7541e87", blocks: [block], suggestions: [suggestion], warnings: [], skipped_pages: [] };
describe("resume source evidence", () => {
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
});
