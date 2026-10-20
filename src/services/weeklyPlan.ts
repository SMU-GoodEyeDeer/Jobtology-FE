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
    expected_version: plan.version, weekly_hours: plan.weekly_hours, rest_weeks: [...plan.rest_weeks],
    order: plan.steps.map(s => s.step_id),
    hours: Object.fromEntries(plan.steps.filter(s => s.hours !== s.recommended_hours).map(s => [s.step_id, s.hours])),
  };
}

export function normalizePlanInput(input: WeeklyPlanInput, steps: readonly WeeklyPlanStep[]): WeeklyPlanInput {
  const recommendedHours = new Map(steps.map(step => [step.step_id, step.recommended_hours]));
  return {
    expected_version: input.expected_version,
    weekly_hours: input.weekly_hours,
    rest_weeks: [...input.rest_weeks].sort((a, b) => a - b),
    order: [...input.order],
    hours: Object.fromEntries(Object.entries(input.hours)
      .filter(([id, hours]) => hours !== recommendedHours.get(id))
      .sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function samePlanInput(a: WeeklyPlanInput | null, b: WeeklyPlanInput): boolean {
  if (!a) return false;
  const { expected_version: _a, ...left } = a;
  const { expected_version: _b, ...right } = b;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function recommendedInput(plan: WeeklyPlanResponse): WeeklyPlanInput {
  return { expected_version: plan.version, weekly_hours: plan.recommended_weekly_hours, rest_weeks: [], hours: {},
    order: [...plan.steps].sort((a, b) => a.recommended_number - b.recommended_number).map(s => s.step_id) };
}

export interface WeekAllocation { readonly step_id: string; readonly week: number; readonly hours: number }

export function planAllocations(plan: WeeklyPlanResponse): WeekAllocation[] {
  // Server allocations and dates are authoritative, including customized schedules.
  // Older solver records lack exact slots: only estimate effort within their dates.
  return plan.steps.flatMap(step => {
    if (step.week_allocations?.length) return step.week_allocations.map(allocation => ({ step_id: step.step_id, ...allocation }));
    const start = Date.parse(step.start_date);
    const end = Date.parse(step.end_date);
    const overlaps = Array.from({ length: Math.max(0, step.end_week - step.start_week + 1) }, (_, index) => {
      const week = step.start_week + index;
      const weekStart = Date.parse(addDays(plan.start_date, (week - 1) * 7));
      return { week, days: plan.rest_weeks.includes(week) ? 0 : Math.max(0, Math.round((Math.min(end, weekStart + 6 * DAY) - Math.max(start, weekStart)) / DAY) + 1) };
    }).filter(overlap => overlap.days > 0);
    const days = overlaps.reduce((total, overlap) => total + overlap.days, 0);
    const allocations: WeekAllocation[] = [];
    let allocated = 0;
    for (const [index, overlap] of overlaps.entries()) {
      const hours = index === overlaps.length - 1 ? Math.round((step.hours - allocated) * 10) / 10 : Math.min(step.hours - allocated, Math.round(step.hours * overlap.days / days * 10) / 10);
      allocated += hours;
      allocations.push({ step_id: step.step_id, week: overlap.week, hours });
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
  return step.moved ? `직접 바꾼 학습 우선순위예요 · 추천 우선순위는 ${step.recommended_number}번째` : step.reason;
}

export function stepTitle(step: WeeklyPlanStep): string {
  return step.title.trim() || step.name;
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
