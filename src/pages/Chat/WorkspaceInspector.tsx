import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { basisLabels, goalScopedHref, nodeLabels, safeLocalHref, type WorkspaceGraph, type WorkspaceNode } from "../../services/chatWorkspace";
import { analysisSkillHref, roadmapSkillHref } from "../../services/skillNavigation";
import { QualificationCard } from "../Analysis/SkillEvidence";
import { formatPostingDateTime } from "../../services/resourcesApi";
import { PostingEvidence } from "./PostingEvidence";
import { GraphEvidenceMetadata } from "./GraphEvidenceMetadata";
import { postingsHref } from "../../services/resourcesApi";

const relationshipLabels: Record<string, string> = { REQUIRES: "검토된 요구 역량", TEACHES: "학습할 역량", HAS_GOAL: "내 목표", TARGETS: "목표 직무", REPORTED: "본인 입력", MATCHED_TO: "역량 연결", PLANNED_WITH: "계획 선호 반영", ANALYZED_BY: "분석 결과", PLANNED_ACTIVITY: "학습 계획", PREREQUISITE: "선행 활동", DEVELOPS: "학습할 역량", EVALUATED_AS: "반영 결과", SATISFIED: "충족", PARTIAL: "부분 반영", UNMET: "미충족", NEEDS_INPUT: "추가 정보 필요", MAPPED_TO: "직무 분류", CLASSIFIED_AS: "직무 분류", QUALIFIED_BY: "관련 자격", QUALIFICATION_MAPPING: "관련 자격", HAS_EXAM_SESSION: "시험 일정", EVIDENCED_BY: "공고 연결", CONTEXT_FOR: "탐색 참고", MATCHED_ONET: "공고를 통한 참고 연결", ESSENTIAL_SKILL: "O*NET 주요 역량", ONET_ESSENTIAL_SKILL: "O*NET 주요 역량", HOT_TECHNOLOGY: "주요 기술", ONET_SOFTWARE_EXAMPLE: "기술 활용 예시", SUGGESTED_LINK: "학습 연결 제안" };
function readable(key: string, value: unknown): string {
  const names: Record<string, string> = { CUSTOM: "직접 조정한 일정", SOLVER: "추천 일정", FAMILIAR: "접해 봄", GUIDED: "도움을 받아 수행", INDEPENDENT: "독립적으로 수행", PRODUCTION: "실무에서 수행", TODO: "예정", IN_PROGRESS: "진행 중", COMPLETED: "완료", ENROLLED: "재학", MATCHED: "역량에 연결됨", NEEDS_CLARIFICATION: "추가 설명 필요", UNUSED: "현재 목표에 미반영", EXPIRED: "유효기간 지남", skill: "역량", project: "프로젝트", experience: "경험", certification: "자격증", test: "시험", education: "학력", other: "기타" };
  if (typeof value === "boolean") return value ? "선호함" : "기본 설정";
  if (typeof value === "string") return key.includes("planned_") || key === "target_by" || key === "current_start" || key === "current_end" ? formatPostingDateTime(value) : names[value] ?? value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (key === "matching") return `${names[String(record.status)] ?? "연결 확인 필요"}${typeof record.credit === "number" ? ` · 계획 반영치 ${Math.round(record.credit * 100)}%` : ""}\n${record.message ?? ""}`;
    if (key === "evidence") return typeof record.evidence === "string" ? record.evidence : "저장한 경험의 상세정보는 내 정보에서 확인할 수 있어요.";
    return "상세정보는 관련 페이지에서 확인할 수 있어요.";
  }
  return String(value);
}

export function WorkspaceInspector({ node, graph, onClose, onExpand, busy, onAsk, goalId }: {
  node: WorkspaceNode; graph: WorkspaceGraph; onClose: () => void; onExpand: () => void; busy: boolean; onAsk: () => void;
  goalId?: string | null;
}) {
  const inspector = useRef<HTMLElement>(null);
  useEffect(() => { inspector.current?.focus({ preventScroll: true }); }, [node.id]);
  const links = graph.edges.filter(e => e.source === node.id || e.target === node.id);
  let detail = node.detail ?? "";
  // Application records are structured facts; show readable fields without dumping raw JSON.
  let fields: [string, unknown][] = [];
  try { const parsed = JSON.parse(detail); if (parsed && typeof parsed === "object") { fields = Object.entries(parsed); detail = ""; } } catch { /* Catalog descriptions are plain text. */ }
  const labels: Record<string, string> = { category: "분류", proficiency: "경험 수준", state: "진행 상태", status: "상태", current_start: "현재 일정 시작", current_end: "현재 일정 종료", schedule_source: "일정 기준", hours: "학습 시간", planned_start: "원래 계획 시작", planned_end: "원래 계획 종료", profile_version: "기준 프로필", current_profile_version: "현재 프로필", matching: "역량 연결", evidence: "경험 근거", credit: "계획 반영치", name: "역량", estimated_hours: "남은 학습 시간", ncs_level: "NCS 수준", major_raw: "전공", year: "학년", enrollment_status: "학적", expected_graduation_on: "졸업 예정", available_hours_per_week: "주당 학습 시간", needs_portfolio: "프로젝트 선호", career_switch: "기초 학습 선호", target_by: "목표일", timezone: "시간대" };
  const href = safeLocalHref(node.href);
  return <aside ref={inspector} tabIndex={-1} className="workspace-inspector" aria-label={`${node.label} 상세정보`} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <div className="workspace-inspector-head"><span>{nodeLabels[node.kind]}</span><button onClick={onClose} aria-label="상세정보 닫기">×</button></div>
    <h2>{node.label}</h2><span className="workspace-basis">{basisLabels[node.basis]}</span>
    {detail && <p className="workspace-description">{detail}</p>}
    {fields.length > 0 && <dl>{fields.filter(([key, value]) => key in labels && value != null).map(([key, value]) => <div key={key}><dt>{labels[key]}</dt><dd>{readable(key, value)}</dd></div>)}</dl>}
    {node.source_id && <p className="workspace-provenance">출처: {node.source_id}</p>}
    {node.source_pin && <details><summary>출처 버전</summary><code>{node.source_pin}</code></details>}
    {node.sourceMetadata && <GraphEvidenceMetadata node={node.sourceMetadata} edges={graph.edges.flatMap(e => e.sourceMetadata && (e.source === node.id || e.target === node.id) ? [e.sourceMetadata] : [])} />}
    {node.kind === "posting_evidence" && <PostingEvidence occupation={node.occupation_code} />}
    {node.basis === "METADATA_INFERRED" && <p className="workspace-note">공고 분류로 추정한 관계예요. 검토된 요구 역량이나 역량 충족을 의미하지 않아요.</p>}
    {node.kind === "onet_occupation" || node.kind === "onet_skill" ? <p className="workspace-note">O*NET 참고 자료는 NCS 역량과 자동으로 동등하게 처리하지 않아요.</p> : null}
    {node.qualification_code && <QualificationCard qualification={{ code: node.qualification_code, name: node.label }} />}
    {!!links.length && <details open><summary>연결 근거 · {links.length}</summary><ul>{links.slice(0, 12).map(e => {
      const other = graph.nodes.find(n => n.id === (e.source === node.id ? e.target : e.source));
      return <li key={e.id}><strong>{other?.label ?? "연결된 항목"}</strong><small>{relationshipLabels[e.kind] ?? "참고 관계"} · {basisLabels[e.basis]}</small>{e.explanation && <p>{e.explanation}</p>}</li>;
    })}</ul></details>}
    <div className="workspace-inspector-actions">
      <button className="workspace-primary" onClick={onAsk}>이 항목 질문하기</button>
      {!node.id.startsWith("account:") && !["capability", "goal", "activity", "analysis"].includes(node.kind) && <button onClick={onExpand} disabled={busy}>{busy ? "찾는 중…" : "연결 더 보기"}</button>}
      {href && <Link to={goalScopedHref(href, goalId)}>관련 페이지 열기 →</Link>}
      {(node.kind === "ncs_occupation" || node.kind === "onet_occupation") && node.occupation_code && <Link to={postingsHref({ occupation: node.occupation_code })}>연결된 채용공고 보기 →</Link>}
      {(node.requirement_key || node.ncs_base_code) && <><Link to={goalScopedHref(analysisSkillHref(node.requirement_key, node.ncs_base_code), goalId)}>역량분석에서 보기</Link><Link to={goalScopedHref(roadmapSkillHref(node.requirement_key, node.ncs_base_code), goalId)}>로드맵에서 보기</Link></>}
    </div>
  </aside>;
}
