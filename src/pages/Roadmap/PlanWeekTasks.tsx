import type { WeeklyPlanResponse } from "../../services/types";
import { addDays, planAllocations, currentWeek, shortDate } from "../../services/weeklyPlan";

export function PlanWeekTasks({ plan, onSelect }: { readonly plan: WeeklyPlanResponse; readonly onSelect: (id: string) => void }) {
  const week = currentWeek(plan.start_date);
  const allocations = planAllocations(plan);
  const active = allocations.filter(a => a.week === week);
  const next = allocations.filter(a => a.week === week + 1);
  return <section className="wp-week-tasks wp-card">
    <div><h3>이번 주 할 일 · {week}주차</h3><small>{shortDate(addDays(plan.start_date, (week - 1) * 7))}–{shortDate(addDays(plan.start_date, week * 7 - 1))}</small>
      {!active.length && <p>{week < 1 ? "아직 플랜 시작 전이에요." : plan.rest_weeks.includes(week) ? "이번 주는 쉬는 주예요." : "이번 주 예정된 학습이 없어요."}</p>}
      {active.map(a => { const step = plan.steps.find(s => s.step_id === a.step_id); return <div key={a.step_id} className="wp-current-task">
        <button className="wp-text-button" onClick={() => onSelect(a.step_id)}>STEP {step?.number} · {step?.name} →</button><p>이번 주 학습{plan.schedule_source !== "CUSTOM" ? " 약" : ""} <b>{a.hours}시간</b></p>
      </div>; })}
    </div><div className="wp-week-next"><h3>다음 주 · {week + 1}주차</h3>{next.length ? next.map(a => <p key={a.step_id}>{plan.steps.find(s => s.step_id === a.step_id)?.name}<b>{a.hours}시간</b></p>) : <p>예정된 학습이 없어요.</p>}</div>
  </section>;
}
