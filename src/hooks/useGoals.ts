import { useState, useEffect, useCallback } from "react";
import { goalsApi } from "../services/api";
import type { GoalResponse } from "../services/types";
import { useOccupations } from "../context/OccupationsContext";

export function useGoals() {
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getName, loading: occupationsLoading } = useOccupations();

  const refresh = useCallback(async (preferredGoalId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await goalsApi.list();
      setGoals(res.items);
      const active = res.items.find((g) => g.status === "ACTIVE") ?? res.items[0];
      setSelectedGoalId(previous => {
        const preferred = preferredGoalId ?? previous;
        return res.items.some(goal => goal.goal_id === preferred) ? preferred! : active?.goal_id ?? null;
      });
    } catch (cause) {
      setError("목표 목록을 불러오지 못했어요. 다시 시도해 주세요.");
      throw cause;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh().catch(() => {}); }, [refresh]);

  const selectedGoal = goals.find((g) => g.goal_id === selectedGoalId) ?? null;

  // Human-readable name for the selected goal
  const selectedGoalName = selectedGoal
    ? getName(selectedGoal.occupation_id)
    : "목표 선택";

  // Helper: get readable name for any goal
  const getGoalName = (goal: GoalResponse) => getName(goal.occupation_id);

  return { goals, selectedGoalId, setSelectedGoalId, selectedGoal, selectedGoalName, getGoalName, loading: loading || occupationsLoading, error, refresh };
}
