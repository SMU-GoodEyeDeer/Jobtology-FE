// Onboarding progress trail shown in the chat header.
// The full flow is 5 steps; when the user picks "아직 모르겠어요" (discovery,
// no target occupation) the flow ends after 학년, so only 3 steps are shown.

export const PROGRESS_STEPS = [
  { step: "occupation", label: "직무" },
  { step: "major", label: "학과" },
  { step: "grade", label: "학년" },
  { step: "checklist", label: "해본 것" },
  { step: "chat", label: "대화" },
] as const;

export type ProgressStep = (typeof PROGRESS_STEPS)[number];

export function progressSteps(hasTargetOccupation: boolean): readonly ProgressStep[] {
  return hasTargetOccupation ? PROGRESS_STEPS : PROGRESS_STEPS.slice(0, 3);
}

export function progressIndex(step: string): number {
  return PROGRESS_STEPS.findIndex((s) => s.step === step);
}
