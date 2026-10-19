import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { WeeklyPlanResponse, WeeklyPlanStep } from "../../services/types";
import { PlanStepDetail } from "./PlanStepDetail";
import { PlanPhases } from "./PlanPhases";
import { PlanWeekTasks } from "./PlanWeekTasks";

const project: WeeklyPlanStep = {
  step_id: "project", number: 1, recommended_number: 1, title: "포트폴리오 프로젝트: REST API 만들기", name: "백엔드 API 개발",
  completion_criteria: ["실행 방법과 설계 결정을 설명한 README를 작성해요.", "동작하는 소스 코드와 테스트 결과를 저장소에 공개해요."],
  requirement_key: null, state: "IN_PROGRESS", phase: "CORE", ncs_level: null, field_code: null, field_name: null,
  hours: 10, recommended_hours: 10, hours_basis: "ESTIMATED", demand_pct: null, start_week: 1, end_week: 2,
  start_date: "2026-10-19", end_date: "2026-11-01", reason: "역량을 적용하는 프로젝트예요", moved: false,
  prerequisite_step_ids: [], unmet_prerequisite_step_ids: [],
};
const plan: WeeklyPlanResponse = {
  roadmap_id: "roadmap", start_date: "2026-10-19", target_date: "2026-11-01", weekly_hours: 10,
  recommended_weekly_hours: 10, rest_weeks: [], is_customized: false, saved_at: null,
  total_hours: 10, total_weeks: 2, completion_date: "2026-11-01", recommended_completion_date: "2026-11-01",
  schedule_source: "SOLVER", deadline_exceeded: false, days_past_target: 0, has_dependency_violations: false,
  warnings: [], steps: [project],
};

function detail(step = project) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(PlanStepDetail, {
    plan, step, busy: false, onComplete: () => {},
  })));
}

describe("roadmap activity deliverables", () => {
  it("shows the portfolio activity and saved README criteria without inventing task progress", () => {
    const html = detail();
    expect(html).toContain(`<h2 id="plan-step-title">${project.title}</h2>`);
    expect(html).toContain(`관련 역량 · ${project.name}`);
    expect(html).toContain("완료 기준");
    for (const criterion of project.completion_criteria) expect(html).toContain(criterion);
    expect(html).not.toContain("/3 완료");
    expect(html).not.toContain("NCS 정의 읽고");
    expect(html).not.toContain("30분");
  });

  it("offers clearly labelled guidance for older steps without saved criteria", () => {
    const html = detail({ ...project, title: project.name, completion_criteria: [], state: "TODO" });
    expect(html).toContain("학습 안내");
    expect(html).toContain("이 단계에 저장된 완료 기준이 없어요");
    expect(html).not.toContain("관련 역량 ·");
    expect(html).not.toContain("/3 완료");
  });

  it("identifies the project and related skill in the phase list and weekly tasks", () => {
    const phases = renderToStaticMarkup(createElement(PlanPhases, { plan, selectedId: project.step_id, onSelect: () => {} }));
    expect(phases).toContain(`<strong>${project.title}</strong>`);
    expect(phases).toContain(`관련 역량 · ${project.name}`);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
      const tasks = renderToStaticMarkup(createElement(PlanWeekTasks, { plan, onSelect: () => {} }));
      expect(tasks).toContain(project.title);
      expect(tasks).toContain(`관련 역량 · ${project.name}`);
    } finally { vi.useRealTimers(); }
  });
});
