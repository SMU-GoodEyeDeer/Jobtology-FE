import type { WeeklyPlanInput, WeeklyPlanResponse, WeeklyPlanStep } from "./weeklyPlanTypes";

const DAY = 86_400_000;
export const phaseLabels = { BASIC: "기초", CORE: "핵심", ADVANCED: "심화" } as const;
export const basisLabels = { OFFICIAL: "공식", ESTIMATED: "추정", CUSTOM: "수정" } as const;
export const stateLabels = { TODO: "예정", IN_PROGRESS: "진행 중", COMPLETED: "완료" } as const;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function targetDeltaDays(completion: string, target: string | null): number | null {
  return target ? Math.round((Date.parse(completion) - Date.parse(target)) / DAY) : null;
}

export function currentWeek(start: string, today = localToday()): number {
  return Math.floor((Date.parse(today) - Date.parse(start)) / DAY / 7) + 1;
}

export function targetLabel(plan: WeeklyPlanResponse): string | null {
  const delta = targetDeltaDays(plan.completion_date, plan.target_date);
  return delta === null ? null : delta === 0 ? "목표일에 완료해요" : `목표일보다 ${Math.abs(delta)}일 ${delta > 0 ? "늦어요" : "빨라요"}`;
}

export const shortDate = (date: string) => date.slice(5, 10).replaceAll("-", ".");
export const fullDate = (date: string) => date.replaceAll("-", ".");

export function planInput(plan: WeeklyPlanResponse): WeeklyPlanInput {
  return {
    weekly_hours: plan.weekly_hours, rest_weeks: [...plan.rest_weeks],
    order: plan.steps.map(s => s.step_id),
    hours: Object.fromEntries(plan.steps.filter(s => s.hours !== s.recommended_hours).map(s => [s.step_id, s.hours])),
  };
}

export function recommendedInput(plan: WeeklyPlanResponse): WeeklyPlanInput {
  return { weekly_hours: plan.recommended_weekly_hours, rest_weeks: [], hours: {},
    order: [...plan.steps].sort((a, b) => a.recommended_number - b.recommended_number).map(s => s.step_id) };
}

export interface WeekAllocation { readonly step_id: string; readonly week: number; readonly hours: number }

export function allocateWeeks(input: WeeklyPlanInput, steps: readonly WeeklyPlanStep[]): WeekAllocation[] {
  const allocations: WeekAllocation[] = [];
  const byId = new Map(steps.map(s => [s.step_id, s]));
  const rests = new Set(input.rest_weeks);
  let week = 1;
  let used = 0;
  for (const id of input.order) {
    const step = byId.get(id);
    if (!step) continue;
    let remaining = input.hours[id] ?? step.recommended_hours;
    while (remaining > 0) {
      while (rests.has(week) || used >= input.weekly_hours) { week += 1; used = 0; }
      const hours = Math.min(remaining, input.weekly_hours - used);
      allocations.push({ step_id: id, week, hours });
      remaining -= hours;
      used += hours;
    }
  }
  return allocations;
}

export function planAllocations(plan: WeeklyPlanResponse): WeekAllocation[] {
  if (plan.schedule_source === "CUSTOM") return allocateWeeks(planInput(plan), plan.steps);
  // Solver dates are authoritative. Only apportion effort for the weekly display;
  // do not pack activities into a second, different schedule in the browser.
  return plan.steps.flatMap(step => {
    const start = Date.parse(step.start_date);
    const end = Date.parse(step.end_date);
    const days = Math.max(1, Math.round((end - start) / DAY) + 1);
    const allocations: WeekAllocation[] = [];
    let allocated = 0;
    for (let week = step.start_week; week <= step.end_week; week += 1) {
      const weekStart = Date.parse(addDays(plan.start_date, (week - 1) * 7));
      const overlapDays = Math.max(0, Math.round((Math.min(end, weekStart + 6 * DAY) - Math.max(start, weekStart)) / DAY) + 1);
      if (!overlapDays) continue;
      const hours = week === step.end_week ? Math.round((step.hours - allocated) * 10) / 10 : Math.round(step.hours * overlapDays / days * 10) / 10;
      allocated += hours;
      allocations.push({ step_id: step.step_id, week, hours });
    }
    return allocations;
  });
}

function weekRanges(weeks: readonly number[]): string {
  const groups: number[][] = [];
  for (const week of [...weeks].sort((a, b) => a - b)) {
    const last = groups.at(-1);
    if (last && last.at(-1) === week - 1) last.push(week);
    else groups.push([week]);
  }
  return groups.map(g => g.length === 1 ? `${g[0]}` : `${g[0]}–${g.at(-1)}`).join(", ");
}

export function planChanges(before: WeeklyPlanResponse, after: WeeklyPlanResponse) {
  const labels: string[] = [];
  const changedIds = new Set<string>();
  let count = 0;
  if (before.weekly_hours !== after.weekly_hours) {
    count += 1; labels.push(`주당 ${before.weekly_hours} → ${after.weekly_hours}시간`);
  }
  const changedRests = [...new Set([...before.rest_weeks, ...after.rest_weeks])]
    .filter(w => before.rest_weeks.includes(w) !== after.rest_weeks.includes(w));
  if (changedRests.length) {
    count += changedRests.length;
    labels.push(after.rest_weeks.length ? `쉬는 주 ${weekRanges(after.rest_weeks)}주차` : "쉬는 주 해제");
  }
  for (const step of after.steps) {
    const previous = before.steps.find(s => s.step_id === step.step_id);
    if (!previous) continue;
    if (previous.number !== step.number) { count += 1; changedIds.add(step.step_id); }
    if (previous.hours !== step.hours) {
      count += 1; changedIds.add(step.step_id); labels.push(`${step.name} ${previous.hours} → ${step.hours}시간`);
    }
  }
  if (after.steps.some(s => before.steps.find(p => p.step_id === s.step_id)?.number !== s.number)) labels.push("학습 순서 변경");
  return { count, labels, changedIds };
}

export function stepReason(step: WeeklyPlanStep): string {
  return step.moved ? `직접 바꾼 순서예요 · 추천 순서는 ${step.recommended_number}번째` : step.reason;
}

export function prerequisiteWarning(step: WeeklyPlanStep, steps: readonly WeeklyPlanStep[]): string | null {
  const names = step.unmet_prerequisite_step_ids.map(id => steps.find(s => s.step_id === id)?.name).filter(Boolean);
  if (names.length < step.unmet_prerequisite_step_ids.length) return "선행 단계 정보가 없어 학습 순서를 확인할 수 없어요";
  return names.length ? `선행 단계(${names.join(" · ")})가 끝나기 전에 시작해요` : null;
}

export function moveStep(input: WeeklyPlanInput, from: string, to: string): WeeklyPlanInput {
  const order = [...input.order];
  const fromIndex = order.indexOf(from);
  const toIndex = order.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) return input;
  order.splice(fromIndex, 1);
  order.splice(toIndex, 0, from);
  return { ...input, order };
}
