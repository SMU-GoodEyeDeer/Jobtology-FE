import { useEffect, useRef, useState } from "react";
import { dashboardApi, roadmapsApi } from "../../services/api";
import type { RoadmapDetailResponse, RoadmapRevision } from "../../services/types";
import { PARTIAL_ROUTE_NOTICE } from "./usePartialRoute";

const blockedLabels: Record<string, string> = {
  ACTIVE_ROADMAP_REQUIRED: "현재 사용 중인 로드맵만 새 경로로 바꿀 수 있어요.", DIFFERENT_PROPOSAL_REQUIRED: "이미 이 추천 경로를 사용하고 있어요.",
  STALE_PROPOSAL: "더 최신의 분석이 있어요. 최신 경로를 다시 불러와 주세요.", ACTIVE_TARGETED_GOAL_REQUIRED: "직무가 정해진 활성 목표가 필요해요.",
  PROPOSAL_NOT_ACTIONABLE: "이 추천 경로는 아직 적용할 수 없어요.", COMPLETED_HISTORY_UNVERIFIED: "완료 기록의 연결을 확인할 수 없어 경로를 바꿀 수 없어요.", DUPLICATE_PROPOSAL_STEPS: "새 경로의 단계 구성을 확인해야 해요.",
};
const constraintLabels: Record<string, string> = { available_hours_per_week: "주당 학습 시간", weekly_availability: "학습 요일·시간", unavailable_dates: "쉬는 날짜", target_by: "목표일", target_date: "목표일", timezone: "시간대", budget_mode: "교육비 조건", max_out_of_pocket_krw: "교육비 한도", fastest_path: "빠른 취업 우선", needs_portfolio: "포트폴리오 우선", career_switch: "기초 학습 우선" };
function valueLabel(value: unknown): string {
  if (value == null) return "설정 없음";
  if (typeof value === "boolean") return value ? "사용" : "사용 안 함";
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === "object" && item !== null && "weekday" in item ? `${["월", "화", "수", "목", "금", "토", "일"][Number(item.weekday) - 1]} ${item.start_hour}–${item.end_hour}시` : String(item)).join(" · ") : "설정 없음";
  return ({ REGULAR: "기본", LOW_COST: "낮은 비용 우선" }[String(value)] ?? String(value));
}
function dates(start: string | null, end: string | null) { return [start?.slice(0, 10), end?.slice(0, 10)].filter(Boolean).join(" ~ ") || "일정 없음"; }

export function RoadmapRevisionPanel({ roadmap, onApplied }: { readonly roadmap: RoadmapDetailResponse; readonly onApplied: () => Promise<void> }) {
  const [attempt, setAttempt] = useState(0);
  const [discovery, setDiscovery] = useState<{ id: string; proposalId: string | null; pending: boolean; error?: string } | null>(null);
  const [comparison, setComparison] = useState<RoadmapRevision | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const comparisonRequest = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setComparison(null); setError(null); setDiscovery(null);
    dashboardApi.get(roadmap.goal_id).then(dashboard => {
      if (current === generation.current) setDiscovery({ id: roadmap.roadmap_id, proposalId: dashboard.state === "READY" ? dashboard.proposal_id ?? null : null, pending: dashboard.state === "RECOMPUTING" });
    }).catch(() => { if (current === generation.current) setDiscovery({ id: roadmap.roadmap_id, proposalId: null, pending: false, error: "최신 추천 경로를 확인하지 못했어요." }); });
    return () => { generation.current += 1; };
  }, [roadmap.roadmap_id, roadmap.goal_id, attempt]);
  const current = discovery?.id === roadmap.roadmap_id ? discovery : null;
  async function compare(proposalId: string, conflict = false) {
    const current = generation.current;
    const request = ++comparisonRequest.current;
    setLoading(true);
    if (!conflict) setError(null);
    setComparison(null);
    try {
      const result = await roadmapsApi.compareRevision(roadmap.roadmap_id, proposalId);
      if (current === generation.current && request === comparisonRequest.current) setComparison(result);
    } catch {
      if (current === generation.current && request === comparisonRequest.current) setError("경로의 변경 내용을 불러오지 못했어요. 다시 비교해 주세요.");
    } finally { if (current === generation.current && request === comparisonRequest.current) setLoading(false); }
  }
  async function apply() {
    if (!comparison?.can_apply || inFlight.current) return;
    inFlight.current = true; setApplying(true); setError(null);
    const current = generation.current;
    try {
      await roadmapsApi.applyRevision(roadmap.roadmap_id, { proposal_id: comparison.proposal_id, expected_proposal_hash: comparison.proposal_hash, expected_roadmap_version: comparison.roadmap_version, expected_profile_version: comparison.profile_version, expected_plan_version: comparison.plan_version });
      if (current === generation.current) await onApplied();
    } catch (cause) {
      // A committed revision can lose its HTTP response. Discover the active roadmap
      // before offering another write, including a retry against an archived original.
      try { await onApplied(); } catch { /* Keep the retry message if the read also fails. */ }
      if (current !== generation.current) return;
      if ((cause as { status?: number }).status === 409) {
        setError("로드맵이나 조건이 변경됐어요. 새 비교 내용을 불러왔어요. 변경 내용을 검토한 뒤 적용을 다시 눌러 주세요.");
        await compare(comparison.proposal_id, true);
      } else setError("새 경로의 적용 결과를 확인하지 못했어요. 최신 경로와 로드맵 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally { if (current === generation.current) { inFlight.current = false; setApplying(false); } }
  }
  if (current && !current.error && !current.pending && (!current.proposalId || current.proposalId === roadmap.proposal_id)) return null;
  return <section className="rm-card rm-revision" aria-label="최신 추천 경로 비교" aria-busy={!current || loading || applying}>
    <h3 className="rm-section-title">최신 추천 경로</h3>
    {!current ? <p className="rm-card-sub" role="status">현재 조건의 추천 경로를 확인하고 있어요…</p> : current.error ? <p className="rm-card-sub" role="alert">{current.error}</p> : current.pending ? <p className="rm-card-sub">변경된 조건의 경로를 계산하고 있어요. 현재 로드맵을 사용하면서 잠시 후 다시 확인해 주세요.</p> : <p className="rm-card-sub">새 분석의 경로가 있어요. 완료 기록과 달라지는 내용을 검토한 뒤 적용할 수 있어요.</p>}
    {current && (current.error || current.pending) && <button className="rm-bottom-btn" onClick={() => setAttempt(value => value + 1)}>최신 경로 다시 확인</button>}
    {current?.proposalId && <button className="rm-bottom-btn" disabled={loading || applying} onClick={() => void compare(current.proposalId!)}>{loading ? "비교 중…" : comparison ? "다시 비교" : "변경 내용 비교"}</button>}
    {error && <p className="rm-card-sub" role="alert">{error}</p>}
    {comparison && <div className="rm-revision-comparison">
      <p>변경 후 {comparison.revised_step_count}단계 · 추가 {comparison.added_step_keys.length}단계 · 제외 {comparison.removed_step_keys.length}단계</p>
      <p>완료 기록 {comparison.preserved_completed_steps.length}단계 유지 · 진행 중 {comparison.retained_in_progress_step_ids.length}단계 유지</p>
      {!!comparison.preserved_completed_steps.length && <details><summary>유지되는 완료 기록</summary><ul>{comparison.preserved_completed_steps.map(step => <li key={step.step_id}>{step.title}</li>)}</ul></details>}
      {!!comparison.unretained_in_progress_step_ids.length && <p className="rm-revision-warning">진행 중인 {comparison.unretained_in_progress_step_ids.length}단계는 새 경로에 포함되지 않아요: {comparison.unretained_in_progress_step_ids.map(id => roadmap.steps.find(step => step.step_id === id)?.title || "기존 학습 단계").join(" · ")}</p>}
      {comparison.feasibility === "PARTIAL" && <p className="rm-revision-warning">{PARTIAL_ROUTE_NOTICE}</p>}
      {comparison.feasibility === "RISKY" && <p className="rm-revision-warning">새 경로는 목표 기간을 지키기 어려울 수 있어요. 학습 시간과 일정을 확인해 주세요.</p>}
      {!!Object.keys(comparison.constraint_changes).length && <details><summary>학습 조건 변경 {Object.keys(comparison.constraint_changes).length}건</summary><dl>{Object.entries(comparison.constraint_changes).map(([key, [before, after]]) => <div key={key}><dt>{constraintLabels[key] ?? "기타 학습 조건"}</dt><dd>{valueLabel(before)} → {valueLabel(after)}</dd></div>)}</dl></details>}
      {!!comparison.schedule_changes.length && <details><summary>일정 변경 {comparison.schedule_changes.length}건</summary><ul>{comparison.schedule_changes.map((change, index) => <li key={index}>{roadmap.steps.find(step => step.step_key === change.step_key)?.title || "학습 단계"}: {dates(change.old_planned_start, change.old_planned_end)} → {dates(change.new_planned_start, change.new_planned_end)}</li>)}</ul></details>}
      {!comparison.can_apply && <div role="alert">{comparison.blocking_reasons.map(reason => <p key={reason}>{blockedLabels[reason] ?? "현재 상태에서는 이 경로를 적용할 수 없어요. 최신 경로를 다시 확인해 주세요."}</p>)}<button className="rm-bottom-btn" disabled={applying} onClick={() => setAttempt(value => value + 1)}>최신 경로 다시 확인</button></div>}
      {comparison.resets_future_customization && <p className="rm-revision-warning">직접 수정한 미완료 단계의 순서·학습 시간·쉬는 주·주당 시간은 새 추천 일정으로 바뀌어요. 기존 수정 일정은 보관되는 로드맵에 남고, 완료 기록은 유지해요.</p>}
      <p className="rm-card-sub">적용하면 새 로드맵으로 전환하고 기존 로드맵을 보관해요. 확인된 완료 기록은 유지해요.</p>
      <button className="rm-bottom-btn" disabled={!comparison.can_apply || applying || loading} onClick={() => void apply()}>{applying ? "적용 중…" : "검토한 경로 적용"}</button>
    </div>}
  </section>;
}
