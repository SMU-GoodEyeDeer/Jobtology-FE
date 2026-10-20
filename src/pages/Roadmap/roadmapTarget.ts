import type { Skill, WeeklyPlanResponse } from "../../services/types";

export function roadmapTarget(plan: WeeklyPlanResponse, skills: readonly Skill[], requirement: string | null, ncs: string | null) {
  if (requirement) return plan.steps.find(step => step.requirement_key === requirement) ?? null;
  if (!ncs || !/^[0-9]{10}$/.test(ncs)) return null;
  const matchingKeys = new Set(skills.filter(skill => skill.ncs_base_code === ncs).map(skill => skill.requirement_key));
  return plan.steps.find(step => step.requirement_key && (matchingKeys.has(step.requirement_key)
    || /^[A-Z][A-Z0-9_]*:[0-9]{10}$/.test(step.requirement_key) && step.requirement_key.endsWith(`:${ncs}`))) ?? null;
}
