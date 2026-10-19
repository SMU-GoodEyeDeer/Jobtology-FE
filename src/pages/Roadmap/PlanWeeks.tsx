import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import type { WeeklyPlanInput, WeeklyPlanResponse } from "../../services/types";
import { addDays, allocateWeeks, basisLabels, currentWeek, localToday, planInput, prerequisiteWarning, shortDate, stepReason } from "../../services/weeklyPlan";
import { PlanWeekTasks } from "./PlanWeekTasks";
import { usePlanDrag } from "./usePlanDrag";

interface Props {
  readonly plan: WeeklyPlanResponse;
  readonly draft: WeeklyPlanInput | null;
  readonly changedIds: ReadonlySet<string>;
  readonly busy: boolean;
  readonly onChange: (input: WeeklyPlanInput) => void;
  readonly onSelect: (id: string) => void;
}

export function PlanWeeks({ plan, draft, changedIds, busy, onChange, onSelect }: Props) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const { containerRef, dragging, announcement, handleProps } = usePlanDrag(draft, busy, onChange);
  const allocations = allocateWeeks(planInput(plan), plan.steps);
  const today = localToday();
  const todayWeek = currentWeek(plan.start_date, today);
  const targetWeek = plan.target_date ? currentWeek(plan.start_date, plan.target_date) : null;
  const weekCount = Math.max(1, plan.total_weeks, targetWeek ?? 0, ...plan.rest_weeks);
  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);
  const fields = [...new Set(plan.steps.map(s => s.field_code))].sort();
  const columns: CSSProperties = { gridTemplateColumns: `${draft ? 420 : 330}px repeat(${weekCount}, minmax(25px, 1fr))` };
  function toggleRest(week: number) {
    if (!draft || busy) return;
    onChange({ ...draft, rest_weeks: draft.rest_weeks.includes(week) ? draft.rest_weeks.filter(w => w !== week) : [...draft.rest_weeks, week].sort((a, b) => a - b) });
  }
  const months: { label: string; start: number; end: number }[] = [];
  for (const week of weeks) {
    const date = addDays(plan.start_date, (week - 1) * 7);
    const label = `${Number(date.slice(5, 7)) === 1 ? `${date.slice(2, 4)}년 ` : ""}${Number(date.slice(5, 7))}월`;
    const last = months.at(-1);
    if (last?.label === label) last.end = week;
    else months.push({ label, start: week, end: week });
  }
  return <div className="wp-weeks">
    <section className={`wp-card wp-gantt-card ${draft ? "wp-gantt-card--editing" : ""}`}>
      {draft ? <div className="wp-edit-tools">
        <strong>주당 학습 시간</strong><div className="wp-hour-stepper" role="group" aria-label="주당 학습 시간">
          <button aria-label="1시간 줄이기" disabled={busy || draft.weekly_hours <= 1} onClick={() => onChange({ ...draft, weekly_hours: draft.weekly_hours - 1 })}>−</button>
          <b aria-live="polite">{draft.weekly_hours}시간</b>
          <button aria-label="1시간 늘리기" disabled={busy || draft.weekly_hours >= 60} onClick={() => onChange({ ...draft, weekly_hours: draft.weekly_hours + 1 })}>+</button>
        </div><span>총 <b>{plan.total_hours}시간</b> · {plan.total_weeks}주</span><small id="wp-drag-help">핸들을 끌거나 선택 후 ↑↓ 키로 순서를 바꿔요<br />주차 번호를 누르면 쉬는 주가 돼요</small>
      </div> : <header className="wp-gantt-heading"><h2>주차 플랜</h2><p>막대를 누르면 단계 상세가 열려요 · ‘왜?’로 순서 이유를 확인해요</p></header>}
      <div className="wp-gantt-scroll"><div ref={containerRef} className="wp-gantt" style={{ minWidth: (draft ? 420 : 330) + weekCount * 25 }}>
        <div className="wp-gantt-headers">
          <div className="wp-gantt-months" style={columns}><span className="wp-gantt-label" />{months.map(m => <span key={m.start} style={{ gridColumn: `${m.start + 1} / ${m.end + 2}` }}>{m.label}</span>)}</div>
          <div className="wp-gantt-week-head" style={columns}><span className="wp-gantt-label">학습 순서 · {plan.steps.length}단계</span>{weeks.map(week => <button key={week} disabled={!draft || busy || week > 104}
            aria-label={`${week}주차 쉬는 주`} aria-pressed={plan.rest_weeks.includes(week)} onClick={() => toggleRest(week)} className={plan.rest_weeks.includes(week) ? "wp-rest" : ""}>{plan.rest_weeks.includes(week) ? "쉼" : week}</button>)}</div>
        </div>
        {plan.steps.map((step) => {
          const activeWeeks = allocations.filter(a => a.step_id === step.step_id).map(a => a.week);
          const segments: { start: number; end: number }[] = [];
          for (const week of activeWeeks) {
            const last = segments.at(-1);
            if (last && last.end === week - 1) last.end = week;
            else segments.push({ start: week, end: week });
          }
          const warning = prerequisiteWarning(step, plan.steps);
          const fieldClass = fields.indexOf(step.field_code) % 2 ? "wp-field-secondary" : "";
          return <motion.div key={step.step_id} data-plan-step={step.step_id} layout="position" transition={{ layout: { duration: reduceMotion ? 0 : .16 } }}
            className={`wp-gantt-row ${draft ? "wp-gantt-row--edit" : ""}${dragging?.id === step.step_id ? " wp-gantt-row--dragging" : ""}`} style={columns}>
            <div className={`wp-gantt-label ${reasonId === step.step_id ? "wp-gantt-label--open" : ""}`}>
              {draft && <button className="wp-drag" disabled={busy} {...handleProps(step.step_id, step.name)} title="끌어서 순서 바꾸기">⠿</button>}
              <span className={`wp-changed-dot ${changedIds.has(step.step_id) ? "is-changed" : ""}`} title={changedIds.has(step.step_id) ? "내가 바꾼 단계" : undefined} />
              <span className="wp-row-number">{step.number}</span><span className={`wp-field-dot ${fieldClass}`} />
              <div className="wp-week-name"><button onClick={() => onSelect(step.step_id)}>{step.name}</button>
                {draft && <small>{stepReason(step)}</small>}
                {step.moved && <span className="wp-chip wp-chip--indigo">직접 바꾼 순서</span>}
                {warning && <span className="wp-warning">{warning}</span>}
              </div>
              {draft ? <label className="wp-hours-input"><input type="number" min={1} max={400} step={1} aria-label={`${step.name} 학습 시간`} value={step.hours} disabled={busy} onChange={event => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isInteger(value) && value >= 1 && value <= 400) onChange({ ...draft, hours: { ...draft.hours, [step.step_id]: value } });
              }} /><span>시간</span><small>원래 {step.recommended_hours}시간</small></label> : <><span className="wp-chip">{step.hours}시간 · {basisLabels[step.hours_basis]}</span>
                <div className="wp-why"><button aria-label={`${step.name} 순서 이유`} aria-expanded={reasonId === step.step_id} onClick={() => setReasonId(reasonId === step.step_id ? null : step.step_id)} onKeyDown={event => { if (event.key === "Escape") setReasonId(null); }}>왜?</button>
                  {reasonId === step.step_id && <div role="tooltip" className="wp-popover"><strong>왜 {step.number}번째일까요?</strong><p>{stepReason(step)}</p><small>{step.field_name ?? ""} · NCS {step.ncs_level ?? "—"}수준 · {step.start_week}–{step.end_week}주차</small></div>}
                </div></>}
            </div>
            {weeks.map(week => <span key={week} className={`wp-gantt-cell ${plan.rest_weeks.includes(week) ? "wp-rest" : ""}`} style={{ gridColumn: week + 1 }}>
              {week === todayWeek && <i className="wp-today" style={{ left: `${((Date.parse(today) - Date.parse(plan.start_date)) / 86400000 % 7) / 7 * 100}%` }} />}
              {week === targetWeek && plan.target_date && <i className="wp-target" style={{ left: `${((Date.parse(plan.target_date) - Date.parse(plan.start_date)) / 86400000 % 7) / 7 * 100}%` }} />}
            </span>)}
            {segments.map((segment, i) => <button key={segment.start} className={`wp-bar ${fieldClass} ${step.state === "COMPLETED" ? "wp-bar--done" : ""}`} style={{ gridColumn: `${segment.start + 1} / ${segment.end + 2}` }} aria-label={`${step.name} 일정 상세`} onClick={() => onSelect(step.step_id)}>{i === 0 ? `${step.hours}h` : ""}</button>)}
          </motion.div>;
        })}
      </div></div>
      <div className="wp-legend">{fields.map((field, i) => <span key={field ?? "none"}><i className={`wp-field-dot ${i % 2 ? "wp-field-secondary" : ""}`} />{plan.steps.find(s => s.field_code === field)?.field_name ?? "분야 미제공"}</span>)}<span>✓ 완료</span><span className="wp-rest">쉬는 주</span><span>│ 오늘 {shortDate(today)}</span>{plan.target_date && <span>┆ 목표일 {shortDate(plan.target_date)}</span>}<span>● 내가 바꾼 단계</span><span>막대 숫자 = 학습 시간</span></div>
    </section>
    {!draft && <PlanWeekTasks plan={plan} onSelect={onSelect} />}
    <span className="sr-only" role="status">{announcement}</span>
    {dragging && createPortal(<div className="wp-drag-preview" aria-hidden="true" style={{ left: dragging.x + 16, top: dragging.y + 12 }}>
      <span>⠿</span><div><strong>{dragging.name}</strong><small>{plan.steps.find(step => step.step_id === dragging.id)?.number}번째 위치 · 놓아서 순서 확정</small></div>
    </div>, document.body)}
  </div>;
}
