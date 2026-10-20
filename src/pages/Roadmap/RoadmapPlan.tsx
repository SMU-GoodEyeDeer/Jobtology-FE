import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { roadmapsApi } from "../../services/api";
import type { StepState, WeeklyPlanInput, WeeklyPlanResponse, Skill } from "../../services/types";
import { fullDate, planChanges, planInput, recommendedInput, shortDate, targetDeltaDays, targetLabel } from "../../services/weeklyPlan";
import { useWeeklyPlan } from "./useWeeklyPlan";
import { usePlanPreview } from "./usePlanPreview";
import { PlanPhases } from "./PlanPhases";
import { PlanWeeks } from "./PlanWeeks";
import { PlanStepDetail } from "./PlanStepDetail";
import { roadmapTarget } from "./roadmapTarget";
import "../Analysis/SkillDetail.css";
import "./WeeklyPlan.css";

interface Props {
  readonly roadmapId: string;
  readonly goalId: string;
  readonly onComplete: (id: string, state: StepState) => Promise<void>;
  readonly children: ReactNode;
  readonly onReady?: (id: string) => void;
}

export function RoadmapPlan({ roadmapId, goalId, onComplete, children, onReady }: Props) {
  const { plan, setPlan, loading, skills } = useWeeklyPlan(roadmapId, goalId);
  useEffect(() => { if (!loading) onReady?.(roadmapId); }, [loading, roadmapId, onReady]);
  if (loading) return <div className="rm-card" role="status">플랜을 불러오는 중...</div>;
  if (!plan) return children;
  return <PlanContent key={roadmapId} saved={plan} skills={skills} onSaved={setPlan} onComplete={onComplete} />;
}

function PlanContent({ saved, skills, onSaved, onComplete }: {
  readonly saved: WeeklyPlanResponse; readonly skills: readonly Skill[];
  readonly onSaved: (plan: WeeklyPlanResponse) => void;
  readonly onComplete: Props["onComplete"];
}) {
  const [search] = useSearchParams();
  const requirement = search.get("requirement");
  const ncs = search.get("ncs");
  const stepId = search.get("step");
  const requested = !!(requirement || ncs || stepId);
  const linkedStep = roadmapTarget(saved, skills, requirement, ncs, stepId);
  const [tab, setTab] = useState<"steps" | "weeks">("steps");
  const [draft, setDraft] = useState<WeeklyPlanInput | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(linkedStep?.step_id ?? saved.steps.find(s => s.state !== "COMPLETED")?.step_id ?? saved.steps[0]?.step_id ?? null);
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetToRecommendation, setResetToRecommendation] = useState(false);
  const [original, setOriginal] = useState<WeeklyPlanResponse | null>(saved.is_customized ? null : saved);
  const reduceMotion = useReducedMotion();
  const fade = { duration: reduceMotion ? 0 : .14, ease: "easeOut" as const };
  const preview = usePlanPreview(saved, draft, resetToRecommendation);
  const plan = preview.plan;
  const recommended = original ?? saved;
  const differences = planChanges(draft ? saved : recommended, plan);
  const customized = planChanges(recommended, plan);
  const selected = plan.steps.find(s => s.step_id === selectedId);
  const target = targetLabel(plan);
  const late = (targetDeltaDays(plan.completion_date, plan.target_date) ?? 0) > 0;

  useEffect(() => {
    if (linkedStep) { setSelectedId(linkedStep.step_id); setTab("steps"); setDrawer(false); }
  }, [linkedStep?.step_id, requirement, ncs, stepId]);

  useEffect(() => {
    if (!saved.is_customized) { setOriginal(saved); return; }
    let cancelled = false;
    roadmapsApi.previewPlan(saved.roadmap_id, null).then(value => { if (!cancelled) setOriginal(value); }).catch(() => { if (!cancelled) setOriginal(null); });
    return () => { cancelled = true; };
  }, [saved]);

  function changeDraft(value: WeeklyPlanInput) { setResetToRecommendation(false); setDraft(value); }

  async function mutate(action: "save" | "reset" | "complete") {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (action === "complete" && selected) {
        await onComplete(selected.step_id, selected.state);
        onSaved(await roadmapsApi.getPlan(saved.roadmap_id));
      } else if (action === "save" && preview.normalizedInput && !preview.pending && !preview.error) {
        if (resetToRecommendation) onSaved(await roadmapsApi.resetPlan(saved.roadmap_id, saved.version));
        else if (!preview.unchanged) onSaved(await roadmapsApi.savePlan(saved.roadmap_id, preview.normalizedInput));
        setDraft(null);
      } else if (action === "reset") {
        onSaved(await roadmapsApi.resetPlan(saved.roadmap_id, saved.version));
        setDraft(null);
      }
    } catch (cause) {
      const status = cause instanceof Error && "status" in cause ? cause.status : null;
      if (status === 409) {
        try {
          const latest = await roadmapsApi.getPlan(saved.roadmap_id);
          onSaved(latest);
          setDraft(previous => {
            const input = previous ?? (action === "reset" ? recommendedInput(latest) : planInput(saved));
            const hours = { ...input.hours };
            for (const step of latest.steps.filter(step => step.state === "COMPLETED")) {
              if (step.hours === step.recommended_hours) delete hours[step.step_id];
              else hours[step.step_id] = step.hours;
            }
            return { ...input, hours, expected_version: latest.version };
          });
          if (action === "reset") setResetToRecommendation(true);
          setError("다른 곳에서 변경된 최신 플랜을 불러왔어요. 내 수정 내용은 유지했어요. 최신 플랜과 변경 내용을 검토한 뒤 저장을 다시 눌러 주세요.");
        } catch {
          setError("다른 곳에서 플랜이 변경됐지만 최신 플랜을 불러오지 못했어요. 내 수정 내용은 유지했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
        }
      } else setError(status === 422 ? "플랜 값을 확인해 주세요. 완료한 단계의 학습 시간은 바꿀 수 없어요. 시간과 단계 순서를 확인한 뒤 다시 저장해 주세요." : "요청을 처리하지 못했어요. 변경 내용은 유지했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  function select(id: string) { setSelectedId(id); if (tab === "weeks") setDrawer(true); }
  function switchTab(value: "steps" | "weeks") { setTab(value); setDrawer(false); }
  return <div className="weekly-plan">
    <header className="wp-toolbar wp-card">
      <div role="tablist" aria-label="보기 방식" className="wp-tabs">
        <motion.span className="wp-tab-indicator" aria-hidden="true" initial={false} animate={{ x: tab === "steps" ? "0%" : "100%" }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 36 }} />
        {(["steps", "weeks"] as const).map(value => <button key={value} id={`plan-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="plan-view" tabIndex={tab === value ? 0 : -1}
          onClick={() => switchTab(value)} onKeyDown={event => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
              event.preventDefault(); const next = event.key === "Home" ? "steps" : event.key === "End" ? "weeks" : tab === "steps" ? "weeks" : "steps";
              switchTab(next); document.getElementById(`plan-tab-${next}`)?.focus();
            }
          }}>{value === "steps" ? "단계별" : "주차별"}</button>)}
      </div>
      <span className="wp-summary" aria-live="polite">주 <b>{plan.weekly_hours}시간</b> · <b>{plan.total_weeks}주</b> · 예상 완료 <b>{fullDate(plan.completion_date)}</b></span>
      {target && <span className={`wp-chip ${late ? "wp-chip--amber" : "wp-chip--green"}`}>{target}</span>}
      {draft ? <span className="wp-chip wp-chip--amber">수정 중 · 저장 전</span> : saved.is_customized && <span className="wp-chip wp-chip--indigo">내가 수정한 플랜{saved.saved_at ? ` · ${shortDate(saved.saved_at)} 저장` : ""}</span>}
      <div className="wp-toolbar-actions">
        {!draft && saved.is_customized && <button className="wp-text-button" disabled={busy} onClick={() => { if (window.confirm("수정한 플랜을 지우고 추천 플랜으로 돌아갈까요?")) void mutate("reset"); }}>추천 플랜 다시 보기</button>}
        {!draft && <button className="wp-button" disabled={busy} onClick={() => { changeDraft(planInput(saved)); setError(null); switchTab("weeks"); }}>플랜 수정</button>}
      </div>
    </header>
    {error && <p className="wp-error" role="alert">{error}</p>}
    {requested && !linkedStep && <p className="wp-error" role="status">요청한 역량에 해당하는 학습 단계가 현재 로드맵에 없어요. 이미 충족한 역량이거나 다른 목표의 역량일 수 있어요.</p>}
    {preview.error && <div className="wp-error" role="alert"><p>{preview.error}</p><button className="wp-text-button" disabled={busy} onClick={preview.retry}>일정 다시 확인</button></div>}
    {preview.pending && <p className="wp-preview-status" role="status">변경한 일정을 확인하고 있어요. 완료일과 경고는 확인 후 갱신돼요.</p>}
    {!preview.pending && (plan.warnings?.length ?? 0) > 0 && <div className="wp-plan-warnings" role="status" aria-label="일정 경고">{plan.warnings.map((warning, index) => <p key={`${warning.code}-${index}`}>{warning.message}</p>)}</div>}
    {customized.labels.length > 0 && <div className="wp-diffs"><b>수정 내용</b>{customized.labels.map(label => <span className="wp-chip" key={label}>{label}</span>)}</div>}
    <AnimatePresence initial={false} mode="wait">
    <motion.div key={`${tab}-${draft ? "edit" : "view"}`} role="tabpanel" id="plan-view" aria-labelledby={`plan-tab-${tab}`} className={tab === "steps" ? "wp-split" : ""}
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={fade}>
      {tab === "steps" ? <><PlanPhases plan={plan} selectedId={selectedId} onSelect={select} />{selected && <PlanStepDetail key="pane" plan={plan} step={selected} skill={skills.find(s => s.requirement_key != null && s.requirement_key === selected.requirement_key)} busy={busy || draft !== null} onComplete={() => void mutate("complete")} />}</> : <PlanWeeks plan={plan} draft={draft} changedIds={customized.changedIds} busy={busy} onChange={changeDraft} onSelect={select} />}
    </motion.div>
    </AnimatePresence>
    <AnimatePresence>
    {drawer && selected && <PlanStepDetail key="drawer" plan={plan} step={selected} skill={skills.find(s => s.requirement_key != null && s.requirement_key === selected.requirement_key)} busy={busy || draft !== null} onComplete={() => void mutate("complete")} onClose={() => setDrawer(false)} />}
    </AnimatePresence>
    <AnimatePresence>
    {draft && <motion.footer className="wp-save-bar wp-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={fade}><span className="wp-chip wp-chip--indigo">변경 {differences.count}건</span><span>완료 예정 {fullDate(saved.completion_date)} → <b>{fullDate(plan.completion_date)}</b></span>{target && <span className={`wp-chip ${late ? "wp-chip--amber" : "wp-chip--green"}`}>{target}</span>}
      <button className="wp-text-button" disabled={busy} onClick={() => { setResetToRecommendation(true); setDraft({ ...recommendedInput(recommended), expected_version: saved.version }); }}>추천 플랜으로 되돌리기</button>
      <button className="wp-button" disabled={busy} onClick={() => { setDraft(null); setError(null); }}>취소</button>
      <button className="wp-button wp-button--primary" disabled={busy || preview.pending || !!preview.error} onClick={() => void mutate("save")}>{busy ? "저장 중..." : preview.pending ? "일정 확인 중..." : "저장"}</button>
    </motion.footer>}
    </AnimatePresence>
  </div>;
}
