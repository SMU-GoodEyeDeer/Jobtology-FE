import { describe, expect, it } from "vitest";
import { examOutlook, examOutlookText, formatDemand, formatHours, linkedRoadmapSteps, pickNextExamSession, formatSessionLine, qualificationCaption, qualificationLabel, skillIdentity, yearStart } from "./skillDetail";
import type { ExamSession, RoadmapStep, Skill } from "./types";

const skill: Skill = { name: "UI 구현", type: "필수" };
const session: ExamSession = {
  qualification_code: "7790", qualification_name: null, year: 2026, round: 3,
  category_code: null, name: null, practical: null,
  written: { registration_start: "2026-10-20", registration_end: "2026-10-23", exam_start: "2026-11-01", exam_end: null, result_date: null },
};

describe("skill detail formatting", () => {
  it("identifies skills by requirement, then NCS code, then legacy name", () => {
    expect(skillIdentity({ ...skill, requirement_key: "ui", ncs_base_code: "2001020301" })).toBe("ui");
    expect(skillIdentity({ ...skill, ncs_base_code: "2001020301" })).toBe("2001020301");
    expect(skillIdentity(skill)).toBe(skill.name);
  });
  it.each([
    [{}, "—"],
    [{ demand_pct: 0, demand_postings: 0 }, "0% · 0건"],
    [{ demand_pct: 62, demand_postings: 248 }, "62% · 248건"],
    [{ demand_pct: null, demand_postings: 248, demand_base: 400 }, "400건 중 248건"],
    [{ demand_postings: 12 }, "12건"],
  ])("formats demand without confusing null and zero: %j", (given, expected) => {
    // Given / When
    const actual = formatDemand({ ...skill, ...given });
    // Then
    expect(actual).toBe(expected);
  });

  it.each([
    [{}, "—"], [{ achievement: "프로젝트 제작" }, "프로젝트 제작"],
    [{ estimated_hours: 0 }, "약 0시간"],
    [{ estimated_hours: 18, hours_basis: "ESTIMATED" as const }, "약 18시간 (추정)"],
    [{ estimated_hours: 18, hours_basis: "OFFICIAL" as const }, "약 18시간"],
  ])("formats hours with legacy fallback: %j", (given, expected) => {
    // Given / When
    const actual = formatHours({ ...skill, ...given });
    // Then
    expect(actual).toBe(expected);
  });

  it("links exact requirement keys and sorts by position without mutating steps", () => {
    // Given
    const steps: RoadmapStep[] = [
      { step_id: "2", title: "UI 구현", description: null, state: "TODO", position: 2, outcomes: [{ requirement_key: "ui" }] },
      { step_id: "other", title: "UI 구현", description: null, state: "TODO", position: 1 },
      { step_id: "1", title: "기초", description: null, state: "TODO", position: 1, outcomes: [{ requirement_key: "ui" }] },
    ];
    // When
    const actual = linkedRoadmapSteps({ ...skill, requirement_key: "ui" }, steps);
    // Then
    expect(actual.map(s => s.step_id)).toEqual(["1", "2"]);
    expect(steps[0]?.step_id).toBe("2");
  });

  it("does not link absent keys", () => {
    // Given / When
    const actual = linkedRoadmapSteps(skill, [{ step_id: "1", title: skill.name, description: null, state: "TODO", outcomes: [{}] }]);
    // Then
    expect(actual).toEqual([]);
  });

  it.each([
    ["OFFICIAL" as const, "약 18시간 · 공식"],
    ["ESTIMATED" as const, "약 18시간 · 추정"],
    [null, "약 18시간"],
  ])("shows the actual hours basis in detail: %s", (hours_basis, expected) => {
    const given = { ...skill, estimated_hours: 18, hours_basis };
    const actual = formatHours(given, true);
    expect(actual).toBe(expected);
  });
});

describe("exam sessions", () => {
  it("chooses earliest upcoming exam rather than API ordering or past registrations", () => {
    // Given
    const later = { ...session, written: { ...session.written, registration_start: null, registration_end: null, exam_start: "2026-12-01", exam_end: null, result_date: null } };
    // When
    const actual = pickNextExamSession([later, session], "2026-10-25");
    // Then
    expect(actual).toBe(session);
  });
  it("finds future practical dates even when written dates exist and are past", () => {
    const given = { ...session, practical: { ...session.written!, exam_start: "2026-12-01" } };
    expect(pickNextExamSession([given], "2026-11-02")).toBe(given);
    expect(formatSessionLine(given)).toContain("실기 시험 12.01");
  });
  it("includes today's session", () => {
    // Given / When
    const actual = pickNextExamSession([session], "2026-11-01");
    // Then
    expect(actual).toBe(session);
  });
  it("omits past and undated sessions", () => {
    // Given / When
    const actual = pickNextExamSession([session, { ...session, written: null }], "2026-11-02");
    // Then
    expect(actual).toBeNull();
  });
  it("uses practical dates only when written is null", () => {
    // Given
    const practical = { ...session, written: null, practical: session.written };
    // When
    const actual = formatSessionLine(practical);
    // Then
    expect(actual).toBe("2026년 3회 · 실기 접수 10.20–10.23 · 실기 시험 11.01");
  });
  it("formats written dates", () => {
    // Given / When
    const actual = formatSessionLine(session);
    // Then
    expect(actual).toBe("2026년 3회 · 필기 접수 10.20–10.23 · 필기 시험 11.01");
  });
  it("omits missing dates and metadata", () => {
    // Given / When
    const actual = formatSessionLine({ ...session, year: null, round: null, written: null });
    // Then
    expect(actual).toBe("");
  });

  it("selects an upcoming practical session when written is absent", () => {
    const given = { ...session, written: null, practical: session.written };
    const actual = pickNextExamSession([given], "2026-10-25");
    expect(actual).toBe(given);
  });

  it("uses registration dates when an exam date is unavailable", () => {
    const given = { ...session, written: { registration_start: "2026-11-01", registration_end: null, exam_start: null, exam_end: null, result_date: null } };
    const actual = pickNextExamSession([given], "2026-10-25");
    expect(actual).toBe(given);
  });

  it("does not treat a future result announcement as an upcoming exam", () => {
    const given = { ...session, written: { registration_start: null, registration_end: null, exam_start: "2026-10-01", exam_end: null, result_date: "2026-11-01" } };
    const actual = pickNextExamSession([given], "2026-10-25");
    expect(actual).toBeNull();
  });
});

describe("qualification labels", () => {
  it.each([
    [{ code: "T5A6", name: "SW개발_L5_25V2", display_name: "SW개발 5수준", kind: "WORK_LEARNING" as const }, "SW개발 5수준"],
    [{ code: "C290", name: "정보처리산업기사" }, "정보처리산업기사"],
    [{ code: "Q2", name: null }, "Q2"],
  ])("prefers display name, then raw name, then code: %o", (qualification, expected) => {
    // Given / When
    const actual = qualificationLabel(qualification);
    // Then
    expect(actual).toBe(expected);
  });
  it.each([
    ["NATIONAL_TECHNICAL" as const, "국가기술자격 · Q-Net"],
    ["WORK_LEARNING" as const, "일학습병행자격 · Q-Net"],
    [null, "Q-Net"],
    [undefined, "Q-Net"],
  ])("captions the qualification kind: %s", (kind, expected) => {
    // Given / When
    const actual = qualificationCaption({ code: "X", name: null, kind });
    // Then
    expect(actual).toBe(expected);
  });
});

describe("exam outlook", () => {
  it("queries from the start of the current year", () => {
    // Given / When / Then
    expect(yearStart("2026-10-17")).toBe("2026-01-01");
  });
  it("returns the next session when one is upcoming", () => {
    // Given / When
    const actual = examOutlook([session], "2026-10-25");
    // Then
    expect(actual).toEqual({ kind: "upcoming", session });
  });
  it("reports this year's schedule as ended when only past sessions exist", () => {
    // Given / When
    const actual = examOutlook([session], "2026-11-02");
    // Then
    expect(actual).toEqual({ kind: "ended", year: 2026 });
    expect(examOutlookText(actual)).toBe("확인된 2026년 일정에는 남은 접수·시험일이 없어요");
  });
  it("reports no schedule when nothing was published this year", () => {
    // Given / When
    const actual = examOutlook([], "2026-11-02");
    // Then
    expect(actual).toEqual({ kind: "none" });
    expect(examOutlookText(actual)).toBe("등록된 시험 일정이 없어요");
  });
});
