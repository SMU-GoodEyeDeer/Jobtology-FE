import { useState, useEffect, useCallback, useRef } from "react";
import { roadmapsApi, profileApi } from "../services/api";
import type { RoadmapDetailResponse, RoadmapResponse, StepState } from "../services/types";

export function useRoadmap(goalId: string | null, enabled = true) {
  const [roadmaps, setRoadmaps] = useState<RoadmapResponse[]>([]);
  const [activeRoadmap, setActiveRoadmap] = useState<RoadmapDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchRoadmaps = useCallback(async () => {
    if (!enabled) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await roadmapsApi.list();
      const all = res.items;

      // Find active roadmap for this goal
      const match = goalId
        ? all.find((r) => r.goal_id === goalId && r.status === "ACTIVE")
        : all.find((r) => r.status === "ACTIVE");

      const detail = match ? await roadmapsApi.get(match.roadmap_id) : null;
      if (currentRequest !== requestId.current) return;
      setRoadmaps(all);
      setActiveRoadmap(detail);
    } catch (err) {
      if (currentRequest === requestId.current) setError((err as Error).message);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [goalId, enabled]);

  useEffect(() => {
    fetchRoadmaps();
    return () => { requestId.current += 1; };
  }, [fetchRoadmaps]);

  async function updateStepState(stepId: string, state: StepState) {
    if (!activeRoadmap) return;
    const [profile, currentRoadmap] = await Promise.all([
      profileApi.get(), roadmapsApi.get(activeRoadmap.roadmap_id),
    ]);
    const updated = await roadmapsApi.updateStep(
      activeRoadmap.roadmap_id,
      stepId,
      {
        state,
        expected_roadmap_version: currentRoadmap.version,
        expected_profile_version: profile.version,
      }
    );
    const detail = await roadmapsApi.get(updated.roadmap_id);
    setActiveRoadmap(detail);
  }

  const progressPct =
    activeRoadmap && activeRoadmap.steps.length > 0
      ? Math.round(
          (activeRoadmap.steps.filter((s) => s.state === "COMPLETED").length /
            activeRoadmap.steps.length) *
            100
        )
      : 0;

  return { roadmaps, activeRoadmap, loading: !enabled || loading, error, updateStepState, progressPct, refetch: fetchRoadmaps };
}
