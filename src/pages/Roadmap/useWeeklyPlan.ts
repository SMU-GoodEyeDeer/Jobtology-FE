import { useEffect, useState } from "react";
import { roadmapsApi } from "../../services/api";
import type { Skill, WeeklyPlanResponse } from "../../services/types";

export function useWeeklyPlan(roadmapId: string) {
  const [plan, setPlan] = useState<WeeklyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [skills, setSkills] = useState<readonly Skill[]>([]);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsAttempt, setSkillsAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlan(null);
    roadmapsApi.getPlan(roadmapId).then(result => {
      if (!cancelled) setPlan(result);
    }).catch(() => {
      if (!cancelled) { setPlan(null); setError("주차 플랜을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요."); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roadmapId, attempt]);

  useEffect(() => {
    let cancelled = false;
    setSkills([]);
    setSkillsError(null);
    roadmapsApi.skills(roadmapId).then(result => {
      if (!cancelled) setSkills(result.skills);
    }).catch(() => { if (!cancelled) setSkillsError("이 로드맵을 만들 때의 역량 정보를 불러오지 못했어요. 단계의 역량 설명을 확인하려면 다시 시도해 주세요."); });
    return () => { cancelled = true; };
  }, [roadmapId, skillsAttempt]);
  return { plan, setPlan, skills, skillsError, retrySkills: () => setSkillsAttempt(value => value + 1), loading, error, retry: () => setAttempt(value => value + 1) };
}
