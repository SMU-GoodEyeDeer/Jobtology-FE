import { safeSourceUrl } from "../../services/resourcesApi";
import type { CapabilityDetailResponse } from "../../services/types";
import { RESUME_FIELDS } from "../resume/resumeModel";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function date(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function SpecDetailsSummary({ item }: { readonly item: CapabilityDetailResponse }) {
  // Completion records retain their internal event details, not editable spec fields.
  if (item.category === "ROADMAP_OUTCOME") return null;
  const details = item.details;
  const rows: { label: string; value: string | null }[] = [];
  if (item.category === "education") rows.push(
    { label: "학교", value: text(details.school) }, { label: "학위", value: text(details.degree) }, { label: "전공", value: text(details.major) },
  );
  if (item.category === "certification" || item.category === "test") {
    rows.push({ label: item.category === "test" ? "주관 기관" : "발급 기관", value: text(details.issuer) },
      { label: item.category === "test" ? "시험 코드" : "자격 코드", value: text(details.credential_code) },
      { label: item.category === "test" ? "응시일" : "발급일", value: date(details.issued_on) },
      { label: "만료일", value: date(details.expires_on) });
  }
  if (item.category === "test" && typeof details.score === "number" && Number.isFinite(details.score) && details.score >= 0) {
    const max = typeof details.score_max === "number" && Number.isFinite(details.score_max) && details.score_max > 0 ? ` / ${details.score_max}` : "";
    const unit = text(details.score_unit);
    rows.unshift({ label: "점수", value: `${details.score}${max}${unit ? ` ${unit}` : ""}` });
  }
  if (item.category === "project" || item.category === "experience" || item.category === "education") {
    if (item.category === "experience") rows.push({ label: "회사·기관", value: text(details.organization) });
    const start = date(details.started_on);
    const end = date(details.ended_on);
    const period = details.ongoing === true ? `${start ? `${start} ~ ` : ""}진행 중`
      : start && end ? `${start} ~ ${end}` : start ? `${start} 시작` : end ? `${end} 종료` : null;
    rows.push({ label: "담당 역할", value: text(details.role) }, { label: "기간", value: period });
  }
  const visible = rows.filter(row => row.value !== null);
  const source = safeSourceUrl(text(details.url));
  const importedFields = Object.entries(details.imported_fields ?? {});
  if (!visible.length && !source && !details.document_evidence && !importedFields.length) return null;
  return <div className="spec-details-summary" aria-label="등록한 스펙 세부 정보">
    {!!visible.length && <dl>{visible.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
    {source && <a href={source} target="_blank" rel="noopener noreferrer">자료 보기 ↗</a>}
    {details.document_evidence && <details><summary>이력서 원문 근거 · 본인 확인</summary><blockquote className="spec-evidence">{details.document_evidence.quote}</blockquote><p className="spec-help">원본 파일은 보관하지 않아요. 이 인용은 실력이나 자격을 검증한 기록이 아니에요.</p></details>}
    {!!importedFields.length && <details><summary>원문에서 읽은 필드</summary><dl>{importedFields.map(([key, value]) => <div key={key}><dt>{RESUME_FIELDS[key] ?? key}</dt><dd>{value}</dd></div>)}</dl></details>}
  </div>;
}
