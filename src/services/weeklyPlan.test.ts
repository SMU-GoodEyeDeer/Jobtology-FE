import { describe, expect, it } from "vitest";
import { planAllocations, planInput, recommendedInput, planChanges, targetDeltaDays, currentWeek, moveStep } from "./weeklyPlan";
import type { WeeklyPlanResponse, WeeklyPlanStep } from "./weeklyPlanTypes";

const hours = [15, 20, 30, 20, 24, 20, 40, 20, 20, 30, 20];
const steps: WeeklyPlanStep[] = hours.map((h, index) => ({
  step_id: String(index), number: index + 1, recommended_number: index + 1,
  title: `단계 ${index}`, name: `단계 ${index}`, completion_criteria: [], requirement_key: null, state: "TODO",
  phase: "CORE", ncs_level: index + 1, field_code: "DB", field_name: "DB",
  hours: h, recommended_hours: h, hours_basis: "OFFICIAL", demand_pct: null,
  start_week: 1, end_week: 1, start_date: "2026-10-19", end_date: "2026-10-25",
  reason: "", moved: false, prerequisite_step_ids: index ? [String(index - 1)] : [],
  unmet_prerequisite_step_ids: [],
}));
const plan: WeeklyPlanResponse = {
  version: 0, roadmap_id: "roadmap", start_date: "2026-10-19", target_date: "2027-04-15",
  weekly_hours: 10, recommended_weekly_hours: 10, rest_weeks: [], is_customized: false,
  saved_at: null, total_hours: 259, total_weeks: 26, completion_date: "2027-04-18",
  recommended_completion_date: "2027-04-18", schedule_source: "CUSTOM", deadline_exceeded: true, days_past_target: 3, has_dependency_violations: false, warnings: [], steps,
};

describe("weekly plan", () => {
  it("uses exact server allocations for concurrent custom activities rather than serializing them", () => {
    const customized = { ...plan, steps: [0, 1].map(index => ({ ...steps[index], hours: 6,
      week_allocations: [{ week: 1, hours: 3 }, { week: 2, hours: 3 }],
    })) };
    expect(planAllocations(customized)).toEqual([
      { step_id: "0", week: 1, hours: 3 }, { step_id: "0", week: 2, hours: 3 },
      { step_id: "1", week: 1, hours: 3 }, { step_id: "1", week: 2, hours: 3 },
    ]);
  });

  it("estimates legacy effort only inside returned dates and outside rest weeks", () => {
    const result = planAllocations({ ...plan, rest_weeks: [1, 3], steps: [
      { ...steps[0], hours: 15, start_week: 1, end_week: 4, start_date: "2026-10-19", end_date: "2026-11-15" },
    ] });
    expect(result).toEqual([
      { step_id: "0", week: 2, hours: 7.5 }, { step_id: "0", week: 4, hours: 7.5 },
    ]);
    expect(result.some(a => a.week === 1 || a.week === 3)).toBe(false);
  });

  it.each(["SOLVER", "FALLBACK", "CUSTOM"] as const)("preserves returned gaps, overlap and exact date ranges for %s schedules", (source) => {
    const solver = { ...plan, schedule_source: source, steps: [
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

  it("preserves drag priority independently of the activities' overlapping schedules", () => {
    const moved = moveStep(planInput(plan), "1", "0");
    expect(moved.order.slice(0, 2)).toEqual(["1", "0"]);
    expect(steps[0].number).toBe(1);
    expect(steps[0].start_date).toBe("2026-10-19");
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
