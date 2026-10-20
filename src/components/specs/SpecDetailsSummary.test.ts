import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CapabilityDetailResponse } from "../../services/types";
import { SpecDetailsSummary } from "./SpecDetailsSummary";

const item: CapabilityDetailResponse = { capability_id: "spec", raw_text: "등록한 기록", category: "skill", lifecycle: "ACTIVE", entity_id: null, proficiency: "FAMILIAR", verification: "SELF_REPORTED", details: {}, matching: { status: "UNUSED", credit: 0, competencies: [], message: "" } };
function summary(changes: Partial<CapabilityDetailResponse>) { return renderToStaticMarkup(createElement(SpecDetailsSummary, { item: { ...item, ...changes } })); }
describe("saved structured spec details", () => {
  it("shows a test score including zero, maximum, unit and issuing details", () => {
    const html = summary({ category: "test", details: { score: 0, score_max: 990, score_unit: "점", issuer: "ETS", credential_code: "TOEIC", issued_on: "2026-10-01", expires_on: "2028-10-01" } });
    for (const value of ["점수", "0 / 990 점", "주관 기관", "ETS", "시험 코드", "TOEIC", "응시일", "2026-10-01", "만료일", "2028-10-01"]) expect(html).toContain(value);
  });
  it("shows project roles, date ranges, and ongoing work with its organization", () => {
    const project = summary({ category: "project", details: { role: "API 설계·개발", started_on: "2026-01-01", ended_on: "2026-06-30", ongoing: false } });
    expect(project).toContain("담당 역할"); expect(project).toContain("API 설계·개발"); expect(project).toContain("2026-01-01 ~ 2026-06-30");
    const work = summary({ category: "experience", details: { organization: "개발 회사", role: "개발 인턴", started_on: "2026-07-01", ongoing: true } });
    expect(work).toContain("회사·기관"); expect(work).toContain("개발 회사"); expect(work).toContain("개발 인턴"); expect(work).toContain("2026-07-01 ~ 진행 중");
  });
  it("shows certification issuer, credential code and validity dates without inventing missing fields", () => {
    const html = summary({ category: "certification", details: { issuer: "한국산업인력공단", credential_code: "1320", issued_on: "2025-08-01", expires_on: "2028-08-01" } });
    for (const value of ["발급 기관", "한국산업인력공단", "자격 코드", "1320", "발급일", "2025-08-01", "2028-08-01"]) expect(html).toContain(value);
    expect(summary({ category: "certification", details: {} })).toBe("");
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "/relative", "//example.org", "invalid"])("does not render unsafe source URL %s", url => {
    expect(summary({ details: { url } })).not.toContain("<a");
  });
  it("renders a safe web link with external-window isolation", () => {
    const html = summary({ details: { url: "https://example.org/project?readme=1" } });
    expect(html).toContain('href="https://example.org/project?readme=1"'); expect(html).toContain('rel="noopener noreferrer"');
  });
  it("keeps original internal completion details outside the editable spec summary", () => {
    expect(summary({ category: "ROADMAP_OUTCOME", details: { role: "내부 원본", url: "javascript:alert(1)" } })).toBe("");
  });
});
