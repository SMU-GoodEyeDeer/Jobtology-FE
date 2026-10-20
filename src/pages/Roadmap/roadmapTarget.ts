import type { Skill, WeeklyPlanResponse, WeeklyPlanStep } from "../../services/types";

export function roadmapTarget(plan: WeeklyPlanResponse, skills: readonly Skill[], requirement: string | null, ncs: string | null, stepId: string | null = null) {
  if (stepId) return plan.steps.find(step => step.step_id === stepId) ?? null;
  if (requirement) return plan.steps.find(step => step.requirement_key === requirement) ?? null;
  if (!ncs || !/^[0-9]{10}$/.test(ncs)) return null;
  const matchingKeys = new Set(skills.filter(skill => skill.ncs_base_code === ncs).map(skill => skill.requirement_key));
  return plan.steps.find(step => step.requirement_key && (matchingKeys.has(step.requirement_key)
    || /^[A-Z][A-Z0-9_]*:[0-9]{10}$/.test(step.requirement_key) && step.requirement_key.endsWith(`:${ncs}`))) ?? null;
}

/** A carried completion can share its requirement key with newer release metadata. */
export function roadmapStepSkill(step: WeeklyPlanStep, skills: readonly Skill[]): Skill | undefined {
  return skills.find(skill => skill.step_ids?.includes(step.step_id))
    ?? (step.requirement_key ? skills.find(skill => skill.requirement_key === step.requirement_key) : undefined);
}
