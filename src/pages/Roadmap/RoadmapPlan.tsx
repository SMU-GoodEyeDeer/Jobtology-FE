import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { roadmapsApi } from "../../services/api";
import type { StepState, WeeklyPlanInput, WeeklyPlanResponse, Skill } from "../../services/types";
import { fullDate, planChanges, planInput, recomputePlan, recommendedInput, shortDate, targetDeltaDays, targetLabel } from "../../services/weeklyPlan";
import { useWeeklyPlan } from "./useWeeklyPlan";
import { PlanPhases } from "./PlanPhases";
import { PlanWeeks } from "./PlanWeeks";
import { PlanStepDetail } from "./PlanStepDetail";
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
  return <PlanContent saved={plan} skills={skills} onSaved={setPlan} onComplete={onComplete} />;
}

function PlanContent({ saved, skills, onSaved, onComplete }: {
  readonly saved: WeeklyPlanResponse; readonly skills: readonly Skill[];
  readonly onSaved: (plan: WeeklyPlanResponse) => void;
  readonly onComplete: Props["onComplete"];
}) {
  const [tab, setTab] = useState<"steps" | "weeks">("steps");
  const [draft, setDraft] = useState<WeeklyPlanInput | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(saved.steps.find(s => s.state !== "COMPLETED")?.step_id ?? saved.steps[0]?.step_id ?? null);
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reduceMotion = useReducedMotion();
  const fade = { duration: reduceMotion ? 0 : .14, ease: "easeOut" as const };
  const plan = draft ? recomputePlan(saved, draft) : saved;
  const recommended = recomputePlan(saved, recommendedInput(saved));
  const differences = planChanges(draft ? saved : recommended, plan);
  const customized = planChanges(recommended, plan);
  const selected = plan.steps.find(s => s.step_id === selectedId);
  const target = targetLabel(plan);
  const late = (targetDeltaDays(plan.completion_date, plan.target_date) ?? 0) > 0;

  async function mutate(action: "save" | "reset" | "complete") {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (action === "complete" && selected) {
        await onComplete(selected.step_id, selected.state);
        onSaved(await roadmapsApi.getPlan(saved.roadmap_id));
      } else if (action === "save" && draft) {
        onSaved(await roadmapsApi.savePlan(saved.roadmap_id, planInput(plan)));
        setDraft(null);
      } else if (action === "reset") {
        onSaved(await roadmapsApi.resetPlan(saved.roadmap_id));
        setDraft(null);
      }
    } catch (cause) {
      const status = cause instanceof Error && "status" in cause ? cause.status : null;
      setError(status === 409 ? "다른 곳에서 플랜이 변경됐어요. 변경 내용은 유지했어요. 다시 시도해 주세요." : status === 422 ? "플랜 값을 확인해 주세요. 시간과 단계 순서를 확인한 뒤 다시 저장해 주세요." : "요청을 처리하지 못했어요. 변경 내용은 유지했어요. 연결을 확인하고 다시 시도해 주세요.");
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
        {!draft && <button className="wp-button" disabled={busy} onClick={() => { setDraft(planInput(saved)); setError(null); switchTab("weeks"); }}>플랜 수정</button>}
      </div>
    </header>
    {error && <p className="wp-error" role="alert">{error}</p>}
    {customized.labels.length > 0 && <div className="wp-diffs"><b>수정 내용</b>{customized.labels.map(label => <span className="wp-chip" key={label}>{label}</span>)}</div>}
    <AnimatePresence initial={false} mode="wait">
    <motion.div key={`${tab}-${draft ? "edit" : "view"}`} role="tabpanel" id="plan-view" aria-labelledby={`plan-tab-${tab}`} className={tab === "steps" ? "wp-split" : ""}
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={fade}>
      {tab === "steps" ? <><PlanPhases plan={plan} selectedId={selectedId} onSelect={select} />{selected && <PlanStepDetail key="pane" plan={plan} step={selected} skill={skills.find(s => s.requirement_key != null && s.requirement_key === selected.requirement_key)} busy={busy || draft !== null} onComplete={() => void mutate("complete")} />}</> : <PlanWeeks plan={plan} draft={draft} changedIds={customized.changedIds} busy={busy} onChange={setDraft} onSelect={select} />}
    </motion.div>
    </AnimatePresence>
    {drawer && selected && <PlanStepDetail key="drawer" plan={plan} step={selected} skill={skills.find(s => s.requirement_key != null && s.requirement_key === selected.requirement_key)} busy={busy || draft !== null} onComplete={() => void mutate("complete")} onClose={() => setDrawer(false)} />}
    <AnimatePresence>
    {draft && <motion.footer className="wp-save-bar wp-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={fade}><span className="wp-chip wp-chip--indigo">변경 {differences.count}건</span><span>완료 예정 {fullDate(saved.completion_date)} → <b>{fullDate(plan.completion_date)}</b></span>{target && <span className={`wp-chip ${late ? "wp-chip--amber" : "wp-chip--green"}`}>{target}</span>}
      <button className="wp-text-button" disabled={busy} onClick={() => setDraft(recommendedInput(saved))}>추천 플랜으로 되돌리기</button>
      <button className="wp-button" disabled={busy} onClick={() => { setDraft(null); setError(null); }}>취소</button>
      <button className="wp-button wp-button--primary" disabled={busy} onClick={() => void mutate("save")}>{busy ? "저장 중..." : "저장"}</button>
    </motion.footer>}
    </AnimatePresence>
  </div>;
}
