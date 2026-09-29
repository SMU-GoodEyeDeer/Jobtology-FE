import { useState, useEffect } from "react";
import { goalsApi } from "../services/api";
import type { GoalResponse } from "../services/types";
import { useOccupations } from "../context/OccupationsContext";

export function useGoals() {
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { getName } = useOccupations();

  useEffect(() => {
    goalsApi.list().then((res) => {
      setGoals(res.items);
      const active = res.items.find((g) => g.status === "ACTIVE") ?? res.items[0];
      if (active) setSelectedGoalId(active.goal_id);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const selectedGoal = goals.find((g) => g.goal_id === selectedGoalId) ?? null;

  // Human-readable name for the selected goal
  const selectedGoalName = selectedGoal
    ? getName(selectedGoal.occupation_id)
    : "목표 선택";

  // Helper: get readable name for any goal
  const getGoalName = (goal: GoalResponse) => getName(goal.occupation_id);

  return { goals, selectedGoalId, setSelectedGoalId, selectedGoal, selectedGoalName, getGoalName, loading };
}
