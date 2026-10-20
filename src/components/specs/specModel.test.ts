import { describe, expect, it } from "vitest";
import { specDraft, specPayload, suggestedCategory } from "./specModel";
import type { CapabilityDetailResponse, ChatCapabilityCandidate } from "../../services/types";

describe("structured spec payloads", () => {
  it("prefills only validated category recommendations from the chat review action", () => {
    const candidate: ChatCapabilityCandidate = { entity_id: "ncs:unit:2001020301", label: "API 구현", evidence_quote: "API를 직접 구현했어요", category: "project" };
    expect(specDraft(null, candidate).category).toBe("project");
    const unknown = { ...candidate, category: "unsupported" } as unknown as ChatCapabilityCandidate;
    expect(suggestedCategory(unknown)).toBeNull();
    expect(specDraft(null, unknown).category).toBe("skill");
  });
  it("keeps an unlinked or evidence-free record as storage, without inventing credit", () => {
    const payload = specPayload({ ...specDraft(), title: "보관할 기록" });
    expect(payload).toEqual({ category: "skill", raw_text: "보관할 기록", proficiency: "FAMILIAR", details: { competency_ids: [], evidence: "", source: "MANUAL", ongoing: false, url: null } });
    expect(payload).not.toHaveProperty("credit");
  });
  it("sends certification identity and expiry with explicit nullable fields", () => {
    expect(specPayload({ ...specDraft(), category: "certification", title: "정보처리기사", issuer: " 한국산업인력공단 ", issued_on: "2025-01-01", expires_on: "2026-01-01" }).details)
      .toMatchObject({ issuer: "한국산업인력공단", credential_code: null, issued_on: "2025-01-01", expires_on: "2026-01-01" });
  });
  it("requires a certification issuer and a test score while preserving numeric zero", () => {
    expect(() => specPayload({ ...specDraft(), category: "certification", title: "자격" })).toThrow("발급 기관");
    expect(() => specPayload({ ...specDraft(), category: "test", title: "시험" })).toThrow("점수");
    expect(specPayload({ ...specDraft(), category: "test", title: "시험", score: "0", score_max: "100", score_unit: "점" }).details).toMatchObject({ score: 0, score_max: 100, score_unit: "점" });
  });
  it.each([
    { score: "101", score_max: "100" }, { score: "-1", score_max: "100" }, { score: "1", score_max: "0" }, { score: "NaN", score_max: "100" },
  ])("rejects an inconsistent score %j", values => {
    expect(() => specPayload({ ...specDraft(), category: "test", title: "시험", ...values })).toThrow("점수");
  });
  it("models ongoing projects and employment separately from credential fields", () => {
    const project = specPayload({ ...specDraft(), category: "project", title: "프로젝트", started_on: "2026-01-01", ended_on: "2025-01-01", ongoing: true, role: "개발", issuer: "미포함" });
    expect(project.details).toMatchObject({ started_on: "2026-01-01", ended_on: null, ongoing: true, role: "개발" });
    expect(project.details).not.toHaveProperty("issuer");
    expect(specPayload({ ...specDraft(), category: "experience", title: "인턴", organization: "회사", role: "개발자" }).details).toMatchObject({ organization: "회사", role: "개발자", started_on: null, ended_on: null });
  });
  it("rejects reversed periods and non-web evidence URLs", () => {
    expect(() => specPayload({ ...specDraft(), category: "project", title: "일", started_on: "2026-01-02", ended_on: "2026-01-01" })).toThrow("종료일");
    expect(() => specPayload({ ...specDraft(), category: "certification", title: "자격", issuer: "기관", issued_on: "2026-01-02", expires_on: "2026-01-01" })).toThrow("만료일");
    expect(() => specPayload({ ...specDraft(), title: "일", url: "javascript:alert(1)" })).toThrow("http");
  });
  it("preserves unknown selected IDs until the user explicitly removes them", () => {
    const item: CapabilityDetailResponse = { capability_id: "item", raw_text: "기존 기록", category: "skill", entity_id: null, proficiency: "GUIDED", verification: "SELF_REPORTED", lifecycle: "ACTIVE", details: { competency_ids: ["ncs:known", "ncs:removed"], evidence: "구체적인 수행 근거를 충분히 적어 두었어요.", source: "MANUAL" }, matching: { status: "NEEDS_CLARIFICATION", credit: 0, message: "다시 선택", competencies: [{ entity_id: "ncs:known", label: "기존 역량", requirement_keys: [] }] } };
    const draft = specDraft(item);
    expect(draft.selected[1].unavailable).toBe(true);
    expect(specPayload(draft).details.competency_ids).toEqual(["ncs:known", "ncs:removed"]);
    expect(specPayload({ ...draft, selected: draft.selected.filter(value => !value.unavailable) }).details.competency_ids).toEqual(["ncs:known"]);
  });
});
