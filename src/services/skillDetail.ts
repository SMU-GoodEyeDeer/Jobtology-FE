import type { ExamSession, RoadmapStep, Skill } from "./types";

export function skillIdentity(skill: Skill): string {
  return skill.requirement_key ?? skill.name;
}

export function formatDemand(skill: Skill): string {
  if (skill.demand_pct != null) {
    return `${skill.demand_pct}%${skill.demand_postings != null ? ` · ${skill.demand_postings}건` : ""}`;
  }
  if (skill.demand_postings != null) {
    return `${skill.demand_base != null ? `${skill.demand_base}건 중 ` : ""}${skill.demand_postings}건`;
  }
  return "—";
}

export function formatHours(skill: Skill, detail = false): string {
  if (skill.estimated_hours == null) return skill.achievement ?? "—";
  const basis = skill.hours_basis === "ESTIMATED" ? "추정" : skill.hours_basis === "OFFICIAL" ? "공식" : null;
  const suffix = detail ? (basis ? ` · ${basis}` : "") : (basis === "추정" ? " (추정)" : "");
  return `약 ${skill.estimated_hours}시간${suffix}`;
}

export function linkedRoadmapSteps(skill: Skill, steps: readonly RoadmapStep[]): RoadmapStep[] {
  if (!skill.requirement_key) return [];
  return steps.filter(step => step.outcomes?.some(outcome => outcome.requirement_key === skill.requirement_key))
    .sort((a, b) => (a.position ?? a.order ?? 0) - (b.position ?? b.order ?? 0));
}

export function shortDate(value: string | null | undefined): string {
  return value ? value.slice(5, 10).replace("-", ".") : "";
}

export function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  return [shortDate(start), shortDate(end)].filter(Boolean).join("–");
}

export function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function pickNextExamSession(items: readonly ExamSession[], today: string): ExamSession | null {
  const dated = items.flatMap(item => {
    const dates = item.written ?? item.practical;
    if (!dates) return [];
    const upcoming = [dates.registration_start, dates.registration_end, dates.exam_start, dates.exam_end]
      .filter((date): date is string => date != null && date.slice(0, 10) >= today).sort();
    return upcoming[0] ? [{ item, date: upcoming[0] }] : [];
  });
  return dated.sort((a, b) => a.date.localeCompare(b.date))[0]?.item ?? null;
}

export function formatSessionLine(item: ExamSession): string {
  const dates = item.written ?? item.practical;
  const label = item.written ? "필기" : "실기";
  const metadata = [item.year != null ? `${item.year}년` : "", item.round != null ? `${item.round}회` : ""].filter(Boolean).join(" ");
  const registration = formatPeriod(dates?.registration_start, dates?.registration_end);
  const exam = shortDate(dates?.exam_start ?? dates?.exam_end);
  return [metadata, registration ? `${label} 접수 ${registration}` : "", exam ? `시험 ${exam}` : ""].filter(Boolean).join(" · ");
}
