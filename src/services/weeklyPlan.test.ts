import { describe, expect, it } from "vitest";
import { allocateWeeks, recomputePlan, planInput, recommendedInput, planChanges, targetDeltaDays, currentWeek } from "./weeklyPlan";
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
  recommended_completion_date: "2027-04-18", steps,
};

describe("weekly plan", () => {
  it("packs the contract example continuously including shared boundary weeks", () => {
    // Given / When
    const result = recomputePlan(plan, planInput(plan));
    // Then
    expect(result.steps.map(s => [s.start_week, s.end_week])).toEqual([
      [1, 2], [2, 4], [4, 7], [7, 9], [9, 11], [11, 13],
      [13, 17], [17, 19], [19, 21], [21, 24], [24, 26],
    ]);
    expect(result.completion_date).toBe("2027-04-18");
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

  it("recomputes dates and prerequisite warnings after changing order and hours", () => {
    // Given
    const input = { ...planInput(plan), weekly_hours: 12, order: ["1", "0", ...steps.slice(2).map(s => s.step_id)], hours: { "1": 24 } };
    // When
    const result = recomputePlan(plan, input);
    // Then
    expect(result.steps[0]).toMatchObject({ step_id: "1", hours: 24, start_week: 1, end_week: 2, moved: true, unmet_prerequisite_step_ids: ["0"] });
    expect(result.total_hours).toBe(263);
    expect(result.total_weeks).toBe(22);
  });

  it("allocates only remaining capacity to the next step this week", () => {
    // Given / When
    const result = allocateWeeks(planInput(plan), steps).filter(a => a.week === 2);
    // Then
    expect(result).toEqual([{ step_id: "0", week: 2, hours: 5 }, { step_id: "1", week: 2, hours: 5 }]);
  });

  it("counts differences and groups consecutive rest weeks for labels", () => {
    // Given
    const changed = recomputePlan(plan, { ...planInput(plan), weekly_hours: 12, rest_weeks: [10, 11], hours: { "9": 24 } });
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
