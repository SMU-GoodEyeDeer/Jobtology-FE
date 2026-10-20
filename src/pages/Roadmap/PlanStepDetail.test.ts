import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { WeeklyPlanResponse, WeeklyPlanStep } from "../../services/types";
import { PlanStepDetail } from "./PlanStepDetail";
import { PlanPhases } from "./PlanPhases";
import { PlanWeekTasks } from "./PlanWeekTasks";
import { PlanWeeks } from "./PlanWeeks";
import { roadmapTarget } from "./roadmapTarget";

const project: WeeklyPlanStep = {
  step_id: "project", number: 1, recommended_number: 1, title: "포트폴리오 프로젝트: REST API 만들기", name: "백엔드 API 개발",
  completion_criteria: ["실행 방법과 설계 결정을 설명한 README를 작성해요.", "동작하는 소스 코드와 테스트 결과를 저장소에 공개해요."],
  requirement_key: null, state: "IN_PROGRESS", phase: "CORE", ncs_level: null, field_code: null, field_name: null,
  hours: 10, recommended_hours: 10, hours_basis: "ESTIMATED", demand_pct: null, start_week: 1, end_week: 2,
  start_date: "2026-10-19", end_date: "2026-11-01", reason: "역량을 적용하는 프로젝트예요", moved: false,
  prerequisite_step_ids: [], unmet_prerequisite_step_ids: [],
};
const plan: WeeklyPlanResponse = {
  version: 0, roadmap_id: "roadmap", start_date: "2026-10-19", target_date: "2026-11-01", weekly_hours: 10,
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

  it("removes repeated NCS help from the step while keeping level 7–8 eligibility context visible", () => {
    expect(detail({ ...project, ncs_level: 6 })).not.toContain("ncs-level-trigger");
    for (const [level, context] of [[7, "석사 수준의 전문 업무"], [8, "박사 수준의 연구·전문 업무"]] as const) {
      const html = detail({ ...project, ncs_level: level, phase: "ADVANCED" });
      expect(html).toContain(context);
      expect(html).toContain("실제 채용공고의 학위·응시 자격을 확인");
      expect(html).not.toContain("ncs-level-trigger");
    }
  });

  it("keeps an advanced-level note visible even when its phase is collapsed", () => {
    const advanced = { ...project, step_id: "advanced", number: 2, phase: "ADVANCED" as const, ncs_level: 7 };
    const mixed = { ...plan, steps: [project, advanced] };
    const html = renderToStaticMarkup(createElement(PlanPhases, { plan: mixed, selectedId: project.step_id, onSelect: () => {} }));
    const advancedSection = html.slice(html.indexOf('aria-controls="phase-ADVANCED"'));
    expect(advancedSection).toContain("석사 수준의 전문 업무");
    expect(advancedSection.indexOf("석사 수준의 전문 업무")).toBeLessThan(advancedSection.indexOf('id="phase-ADVANCED"'));
    expect(advancedSection).toContain('id="phase-ADVANCED" data-expanded="false"');
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

  it("numbers NCS groups locally and keeps learning priority explicit after reordering", () => {
    const mixed = { ...plan, steps: [
      { ...project, step_id: "core", number: 1, phase: "CORE" as const },
      { ...project, step_id: "basic-2", number: 2, phase: "BASIC" as const },
      { ...project, step_id: "basic-1", number: 3, phase: "BASIC" as const },
    ] };
    const html = renderToStaticMarkup(createElement(PlanPhases, { plan: mixed, selectedId: "core", onSelect: () => {} }));
    expect(html).toContain("기초 1"); expect(html).toContain("기초 2"); expect(html).toContain("핵심 1");
    expect(html).toContain("학습 우선순위 3");
    expect(html).not.toContain("STEP 3");
  });

  it("uses an accessible help icon for the schedule explanation", () => {
    const html = renderToStaticMarkup(createElement(PlanWeeks, { plan, draft: null, changedIds: new Set<string>(), busy: false, onChange: () => {}, onSelect: () => {} }));
    expect(html).toContain(`aria-label="${project.name} 배치 이유"`);
    expect(html).toContain('<span aria-hidden="true">?</span>');
    expect(html).not.toContain("왜?");
  });

  it("resolves roadmap deep links by canonical identity or validated NCS code only", () => {
    const linked = { ...project, requirement_key: "BACKEND_DEVELOPER:2001020211" };
    const response = { ...plan, steps: [linked] };
    expect(roadmapTarget(response, [], linked.requirement_key, null)).toBe(linked);
    expect(roadmapTarget(response, [], null, "2001020211")).toBe(linked);
    expect(roadmapTarget(response, [], "FRONTEND_DEVELOPER:2001020211", null)).toBeNull();
    expect(roadmapTarget(response, [], null, "백엔드 API 개발")).toBeNull();
    expect(roadmapTarget({ ...plan, steps: [project] }, [], null, "2001020211")).toBeNull();
  });
});
