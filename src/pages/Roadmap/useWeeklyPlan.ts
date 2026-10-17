import { useEffect, useState } from "react";
import { analysisApi, dashboardApi, roadmapsApi } from "../../services/api";
import type { Skill, WeeklyPlanResponse } from "../../services/types";

export function useWeeklyPlan(roadmapId: string, goalId: string) {
  const [plan, setPlan] = useState<WeeklyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<readonly Skill[]>([]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPlan(null);
    roadmapsApi.getPlan(roadmapId).then(result => {
      if (!cancelled) setPlan(result);
    }).catch(() => {
      if (!cancelled) setPlan(null);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roadmapId]);

  useEffect(() => {
    let cancelled = false;
    setSkills([]);
    dashboardApi.get(goalId).then(async dashboard => {
      if (dashboard.state !== "READY" || !dashboard.analysis_id) return;
      const analysis = await analysisApi.get(dashboard.analysis_id);
      if (!cancelled) setSkills(analysis.result?.skills ?? []);
    }).catch(() => { if (!cancelled) setSkills([]); });
    return () => { cancelled = true; };
  }, [goalId]);
  return { plan, setPlan, skills, loading };
}
