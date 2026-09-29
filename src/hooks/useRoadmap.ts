import { useState, useEffect, useCallback } from "react";
import { roadmapsApi, profileApi } from "../services/api";
import type { RoadmapDetailResponse, RoadmapResponse, StepState } from "../services/types";

export function useRoadmap(goalId: string | null) {
  const [roadmaps, setRoadmaps] = useState<RoadmapResponse[]>([]);
  const [activeRoadmap, setActiveRoadmap] = useState<RoadmapDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoadmaps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await roadmapsApi.list();
      const all = res.items;
      setRoadmaps(all);

      // Find active roadmap for this goal
      const match = goalId
        ? all.find((r) => r.goal_id === goalId && r.status === "ACTIVE")
        : all.find((r) => r.status === "ACTIVE");

      if (match) {
        const detail = await roadmapsApi.get(match.roadmap_id);
        setActiveRoadmap(detail);
      } else {
        setActiveRoadmap(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchRoadmaps();
  }, [fetchRoadmaps]);

  async function updateStepState(stepId: string, state: StepState) {
    if (!activeRoadmap) return;
    try {
      const profile = await profileApi.get();
      const updated = await roadmapsApi.updateStep(
        activeRoadmap.roadmap_id,
        stepId,
        {
          state,
          expected_roadmap_version: activeRoadmap.version,
          expected_profile_version: profile.version,
        }
      );
      // Re-fetch detail to get updated steps
      const detail = await roadmapsApi.get(updated.roadmap_id);
      setActiveRoadmap(detail);
    } catch (err) {
      console.error("Step update failed:", err);
    }
  }

  const progressPct =
    activeRoadmap && activeRoadmap.steps.length > 0
      ? Math.round(
          (activeRoadmap.steps.filter((s) => s.state === "COMPLETED").length /
            activeRoadmap.steps.length) *
            100
        )
      : 0;

  return { roadmaps, activeRoadmap, loading, error, updateStepState, progressPct, refetch: fetchRoadmaps };
}
