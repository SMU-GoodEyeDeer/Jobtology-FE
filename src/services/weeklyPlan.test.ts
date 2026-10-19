import { describe, expect, it } from "vitest";
import { allocateWeeks, planAllocations, planInput, recommendedInput, planChanges, targetDeltaDays, currentWeek } from "./weeklyPlan";
import type { WeeklyPlanResponse, WeeklyPlanStep } from "./weeklyPlanTypes";

const hours = [15, 20, 30, 20, 24, 20, 40, 20, 20, 30, 20];
const steps: WeeklyPlanStep[] = hours.map((h, index) => ({
  step_id: String(index), number: index + 1, recommended_number: index + 1,
  title: `단계 ${index}`, name: `단계 ${index}`, requirement_key: null, state: "TODO",
  phase: "CORE", ncs_level: index + 1, field_code: "DB", field_name: "DB",
  hours: h, recommended_hours: h, hours_basis: "OFFICIAL", demand_pct: null,
  start_week: 1, end_week: 1, start_date: "2026-10-19", end_date: "2026-10-25",
  reason: "", moved: false, prerequisite_step_ids: index ? [String(index - 1)] : [],
  unmet_prerequisite_step_ids: [],
}));
const plan: WeeklyPlanResponse = {
  roadmap_id: "roadmap", start_date: "2026-10-19", target_date: "2027-04-15",
  weekly_hours: 10, recommended_weekly_hours: 10, rest_weeks: [], is_customized: false,
  saved_at: null, total_hours: 259, total_weeks: 26, completion_date: "2027-04-18",
  recommended_completion_date: "2027-04-18", schedule_source: "CUSTOM", deadline_exceeded: true, days_past_target: 3, has_dependency_violations: false, warnings: [], steps,
};

describe("weekly plan", () => {
  it("packs the contract example continuously including shared boundary weeks", () => {
    // Given / When
    const result = allocateWeeks(planInput(plan), steps);
    // Then
    expect(steps.map(s => {
      const weeks = result.filter(item => item.step_id === s.step_id).map(item => item.week);
      return [weeks[0], weeks.at(-1)];
    })).toEqual([
      [1, 2], [2, 4], [4, 7], [7, 9], [9, 11], [11, 13],
      [13, 17], [17, 19], [19, 21], [21, 24], [24, 26],
    ]);
  });

  it("skips rest weeks without consuming capacity", () => {
    // Given / When
    const result = allocateWeeks({ ...planInput(plan), rest_weeks: [1, 3] }, steps);
    // Then
    expect(result.filter(a => a.step_id === "0")).toEqual([
      { step_id: "0", week: 2, hours: 10 }, { step_id: "0", week: 4, hours: 5 },
    ]);
    expect(result.some(a => a.week === 1 || a.week === 3)).toBe(false);
  });

  it("preserves solver gaps, overlap and exact date ranges in the weekly display", () => {
    const solver = { ...plan, schedule_source: "SOLVER" as const, steps: [
      { ...steps[0], hours: 12, start_week: 3, end_week: 4, start_date: "2026-11-06", end_date: "2026-11-11" },
      { ...steps[1], hours: 4, start_week: 3, end_week: 3, start_date: "2026-11-02", end_date: "2026-11-03" },
    ] };
    expect(planAllocations(solver)).toEqual([
      { step_id: "0", week: 3, hours: 6 }, { step_id: "0", week: 4, hours: 6 },
      { step_id: "1", week: 3, hours: 4 },
    ]);
    expect(solver.steps[0].start_date).toBe("2026-11-06");
    expect(solver.steps[0].end_date).toBe("2026-11-11");
  });

  it("allocates only remaining capacity to the next step this week", () => {
    // Given / When
    const result = allocateWeeks(planInput(plan), steps).filter(a => a.week === 2);
    // Then
    expect(result).toEqual([{ step_id: "0", week: 2, hours: 5 }, { step_id: "1", week: 2, hours: 5 }]);
  });

  it("counts differences and groups consecutive rest weeks for labels", () => {
    // Given
    const changed = { ...plan, weekly_hours: 12, rest_weeks: [10, 11], steps: steps.map(step => step.step_id === "9" ? { ...step, hours: 24 } : step) };
    // When
    const result = planChanges(plan, changed);
    // Then
    expect(result.count).toBe(4);
    expect(result.labels).toEqual(["주당 10 → 12시간", "쉬는 주 10–11주차", "단계 9 30 → 24시간"]);
    expect(planInput(changed).hours).toEqual({ "9": 24 });
    expect(recommendedInput(changed)).toEqual(planInput(plan));
  });

  it("computes signed calendar-day deltas and handles missing targets", () => {
    // Given / When / Then
    expect(targetDeltaDays("2027-04-18", "2027-04-15")).toBe(3);
    expect(targetDeltaDays("2027-04-04", "2027-04-15")).toBe(-11);
    expect(targetDeltaDays("2027-04-04", null)).toBeNull();
    expect(currentWeek("2026-10-19", "2026-10-26")).toBe(2);
    expect(currentWeek("2026-10-19", "2026-10-18")).toBe(0);
  });
});
