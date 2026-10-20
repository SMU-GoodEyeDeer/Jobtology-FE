import type { GoalResponse } from "./types";

export function isAnalyzableGoal(goal: GoalResponse | null | undefined): boolean {
  return goal?.status === "ACTIVE" && goal.goal_mode === "TARGETED" && !!goal.occupation_id?.trim();
}

export function requiresActiveTargetedGoal(cause: unknown): boolean {
  return (cause as { detail?: { error?: { code?: string } } } | null)?.detail?.error?.code === "ACTIVE_TARGETED_GOAL_REQUIRED";
}
