import type { CapabilityDetailResponse, CapabilityWrite, ChatCapabilityCandidate, DocumentEvidence, MatchedCompetency, SpecCategory, SpecDetails, SpecProficiency } from "../../services/types";

export const SPEC_CATEGORIES: { value: SpecCategory; label: string }[] = [
  { value: "skill", label: "기술·역량" }, { value: "certification", label: "자격증" },
  { value: "test", label: "시험·어학 점수" }, { value: "project", label: "프로젝트" }, { value: "experience", label: "업무 경험" },
];
export const PROFICIENCIES: { value: SpecProficiency; label: string; credit: number }[] = [
  { value: "FAMILIAR", label: "기초를 이해해요", credit: .25 },
  { value: "GUIDED", label: "도움을 받아 수행해요", credit: .5 },
  { value: "INDEPENDENT", label: "혼자 수행해요", credit: .75 },
  { value: "PRODUCTION", label: "실제 환경에서 수행했어요", credit: 1 },
];
export function suggestedCategory(candidate?: ChatCapabilityCandidate | null): SpecCategory | null {
  return SPEC_CATEGORIES.find(value => value.value === candidate?.category)?.value ?? null;
}
export interface SelectedCompetency extends MatchedCompetency { unavailable?: boolean }
export interface SpecDraft {
  category: SpecCategory;
  title: string;
  proficiency: SpecProficiency | "";
  selected: SelectedCompetency[];
  evidence: string;
  source: SpecDetails["source"];
  document_evidence?: DocumentEvidence | null;
  started_on: string;
  ended_on: string;
  ongoing: boolean;
  issuer: string;
  credential_code: string;
  issued_on: string;
  expires_on: string;
  score: string;
  score_max: string;
  score_unit: string;
  organization: string;
  role: string;
  url: string;
}
export function specDraft(item?: CapabilityDetailResponse | null, candidate?: ChatCapabilityCandidate | null): SpecDraft {
  const details = item?.details;
  return {
    category: item?.category === "ROADMAP_OUTCOME" ? "skill" : item?.category ?? suggestedCategory(candidate) ?? "skill", title: item?.raw_text ?? candidate?.label ?? "", proficiency: item?.proficiency ?? "FAMILIAR",
    selected: item ? (details?.competency_ids ?? item.matching.competencies.map(value => value.entity_id)).map(entity_id => item.matching.competencies.find(value => value.entity_id === entity_id) ?? { entity_id, label: "연결을 확인할 수 없는 역량", requirement_keys: [], unavailable: true }) : (candidate ? [{ entity_id: candidate.entity_id, label: candidate.label, requirement_keys: [] }] : []),
    evidence: details?.evidence ?? candidate?.evidence_quote ?? "", source: details?.source ?? (candidate ? "LLM_ASSISTED" : "MANUAL"),
    document_evidence: details?.document_evidence,
    started_on: details?.started_on ?? "", ended_on: details?.ended_on ?? "", ongoing: details?.ongoing ?? false,
    issuer: details?.issuer ?? "", credential_code: details?.credential_code ?? "", issued_on: details?.issued_on ?? "", expires_on: details?.expires_on ?? "",
    score: details?.score == null ? "" : String(details.score), score_max: details?.score_max == null ? "" : String(details.score_max), score_unit: details?.score_unit ?? "",
    organization: details?.organization ?? "", role: details?.role ?? "", url: details?.url ?? "",
  };
}
export function specPayload(draft: SpecDraft): CapabilityWrite {
  if (!draft.proficiency) throw new Error("직접 수행한 수준을 선택해 주세요.");
  if (!draft.title.trim()) throw new Error("스펙 제목을 입력해 주세요.");
  if (draft.category === "certification" && !draft.issuer.trim()) throw new Error("자격증 발급 기관을 입력해 주세요.");
  if (draft.category === "test" && !draft.score.trim()) throw new Error("시험·어학 점수를 입력해 주세요.");
  if (draft.selected.length > 12) throw new Error("연결할 역량은 최대 12개까지 선택할 수 있어요.");
  const optional = (value: string) => value.trim() || null;
  const details: SpecDetails = { competency_ids: draft.selected.map(item => item.entity_id), evidence: draft.evidence.trim(), source: draft.source, ongoing: false };
  if (draft.document_evidence) details.document_evidence = draft.document_evidence;
  if (draft.url.trim()) {
    try { if (!["http:", "https:"].includes(new URL(draft.url.trim()).protocol)) throw new Error(); }
    catch { throw new Error("자료 링크는 http 또는 https 주소로 입력해 주세요."); }
  }
  details.url = optional(draft.url);
  if (draft.category === "certification" || draft.category === "test") {
    if (draft.issued_on && draft.expires_on && draft.expires_on < draft.issued_on) throw new Error("만료일은 발급일보다 빠를 수 없어요.");
    Object.assign(details, { issuer: optional(draft.issuer), credential_code: optional(draft.credential_code), issued_on: optional(draft.issued_on), expires_on: optional(draft.expires_on) });
  }
  if (draft.category === "test") {
    const score = draft.score.trim() ? Number(draft.score) : null;
    const max = draft.score_max.trim() ? Number(draft.score_max) : null;
    if (score !== null && (!Number.isFinite(score) || score < 0) || max !== null && (!Number.isFinite(max) || max <= 0) || score !== null && max !== null && score > max) throw new Error("점수는 0 이상, 만점은 0보다 크게 입력하고 점수가 만점을 넘지 않는지 확인해 주세요.");
    Object.assign(details, { score, score_max: max, score_unit: optional(draft.score_unit) });
  }
  if (draft.category === "project" || draft.category === "experience") {
    if (!draft.ongoing && draft.started_on && draft.ended_on && draft.ended_on < draft.started_on) throw new Error("종료일은 시작일보다 빠를 수 없어요.");
    Object.assign(details, { started_on: optional(draft.started_on), ended_on: draft.ongoing ? null : optional(draft.ended_on), ongoing: draft.ongoing, role: optional(draft.role) });
    if (draft.category === "experience") details.organization = optional(draft.organization);
  }
  return { category: draft.category, raw_text: draft.title.trim(), proficiency: draft.proficiency, details };
}
