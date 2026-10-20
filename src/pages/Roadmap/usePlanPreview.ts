import { useEffect, useMemo, useState } from "react";
import { roadmapsApi } from "../../services/api";
import { normalizePlanInput, planInput, samePlanInput } from "../../services/weeklyPlan";
import type { WeeklyPlanInput, WeeklyPlanResponse } from "../../services/types";

export function usePlanPreview(saved: WeeklyPlanResponse, draft: WeeklyPlanInput | null, resetToRecommendation: boolean) {
  const [attempt, setAttempt] = useState(0);
  const normalizedInput = useMemo(() => draft ? normalizePlanInput(draft, saved.steps) : null, [draft, saved.steps]);
  const unchanged = !resetToRecommendation && samePlanInput(normalizedInput, normalizePlanInput(planInput(saved), saved.steps));
  const key = JSON.stringify([saved, normalizedInput, resetToRecommendation, attempt]);
  const [result, setResult] = useState<{ key: string; plan: WeeklyPlanResponse | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!normalizedInput || unchanged) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      roadmapsApi.previewPlan(saved.roadmap_id, resetToRecommendation ? null : normalizedInput).then(plan => {
        if (!cancelled) setResult({ key, plan, error: null });
      }).catch(() => {
        if (!cancelled) setResult({ key, plan: null, error: "변경한 일정을 확인하지 못했어요. 학습 시간이나 순서를 다시 조정하거나 잠시 후 다시 시도해 주세요." });
      });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [saved, normalizedInput, resetToRecommendation, unchanged, key]);

  return {
    plan: !draft || unchanged ? saved : result?.plan ?? saved,
    pending: !!draft && !unchanged && result?.key !== key,
    error: draft && result?.key === key ? result.error : null,
    unchanged,
    normalizedInput,
    retry: () => setAttempt(value => value + 1),
  };
}
