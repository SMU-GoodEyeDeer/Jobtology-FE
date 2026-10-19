import { useEffect, useState } from "react";
import { roadmapsApi } from "../../services/api";
import { planInput } from "../../services/weeklyPlan";
import type { WeeklyPlanInput, WeeklyPlanResponse } from "../../services/types";

export function usePlanPreview(saved: WeeklyPlanResponse, draft: WeeklyPlanInput | null, resetToRecommendation: boolean) {
  const [attempt, setAttempt] = useState(0);
  const unchanged = !resetToRecommendation && JSON.stringify(draft) === JSON.stringify(planInput(saved));
  const key = JSON.stringify([saved, draft, resetToRecommendation, attempt]);
  const [result, setResult] = useState<{ key: string; plan: WeeklyPlanResponse | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!draft || unchanged) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      roadmapsApi.previewPlan(saved.roadmap_id, resetToRecommendation ? null : draft).then(plan => {
        if (!cancelled) setResult({ key, plan, error: null });
      }).catch(() => {
        if (!cancelled) setResult({ key, plan: null, error: "변경한 일정을 확인하지 못했어요. 학습 시간이나 순서를 다시 조정하거나 잠시 후 다시 시도해 주세요." });
      });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [saved, draft, resetToRecommendation, unchanged, key]);

  return {
    plan: !draft || unchanged ? saved : result?.plan ?? saved,
    pending: !!draft && !unchanged && result?.key !== key,
    error: draft && result?.key === key ? result.error : null,
    unchanged,
    retry: () => setAttempt(value => value + 1),
  };
}
