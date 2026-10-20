// The optional shared spec editor is available with or without a target role.
export const PROGRESS_STEPS = [
  { step: "occupation", label: "직무" },
  { step: "major", label: "학과" },
  { step: "grade", label: "학년" },
  { step: "specs", label: "내 스펙" },
] as const;
export type ProgressStep = (typeof PROGRESS_STEPS)[number];
export function progressSteps(): readonly ProgressStep[] { return PROGRESS_STEPS; }
export function progressIndex(step: string): number { return PROGRESS_STEPS.findIndex(value => value.step === step); }
