import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useSession } from "../context/SessionContext";
import { selectGoal, selectedGoal as getSelectedGoal, subscribeGoal } from "./goalSelection";
import { useLocation, useNavigate } from "react-router-dom";
import { goalsApi } from "../services/api";
import type { GoalResponse } from "../services/types";
import { useOccupations } from "../context/OccupationsContext";

export function useGoals() {
  const [goals, setGoals] = useState<GoalResponse[]>([]);
  const { session } = useSession();
  const account = session?.user_id ?? null;
  const location = useLocation(), navigate = useNavigate();
  const requestedGoalId = new URLSearchParams(location.search).get("goal_id");
  const selectedGoalId = useSyncExternalStore(subscribeGoal, () => getSelectedGoal(account));
  const setSelectedGoalId = useCallback((goalId: string | null) => {
    selectGoal(account, goalId);
    if (requestedGoalId && requestedGoalId !== goalId) {
      const params = new URLSearchParams(location.search);
      if (goalId) params.set("goal_id", goalId); else params.delete("goal_id");
      for (const key of ["step", "requirement", "ncs"]) params.delete(key);
      navigate({ pathname: location.pathname, search: params.size ? `?${params}` : "", hash: location.hash }, { replace: true });
    }
  }, [account, requestedGoalId, location.search, location.pathname, location.hash, navigate]);
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
      const preferred = preferredGoalId ?? requestedGoalId ?? getSelectedGoal(account);
      setSelectedGoalId(res.items.some(goal => goal.goal_id === preferred) ? preferred! : active?.goal_id ?? null);
    } catch (cause) {
      setError("목표 목록을 불러오지 못했어요. 다시 시도해 주세요.");
      throw cause;
    } finally { setLoading(false); }
  }, [account, requestedGoalId, setSelectedGoalId]);

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
