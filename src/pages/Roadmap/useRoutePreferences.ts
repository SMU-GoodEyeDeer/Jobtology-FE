import { useEffect, useRef, useState } from "react";
import { routePrefsApi } from "../../services/api";
import type { RoutePreferencesResponse } from "../../services/types";

export type PreferenceField = "budget_mode" | "fastest_path" | "needs_portfolio" | "career_switch";

export function useRoutePreferences(userId: string | undefined, sessionReady: boolean) {
  const [preferences, setPreferences] = useState<RoutePreferencesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const savingNow = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setPreferences(null); setError(null); setSaving(false); savingNow.current = false;
    if (!sessionReady || !userId) { setLoading(false); return; }
    setLoading(true);
    routePrefsApi.get().then(value => {
      if (current === generation.current) setPreferences(value);
    }).catch(() => {
      if (current === generation.current) setError("로드맵 조건을 불러오지 못했어요. 다시 시도해 주세요.");
    }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current += 1; };
  }, [userId, sessionReady, attempt]);

  async function toggle(field: PreferenceField) {
    if (!preferences || loading || savingNow.current) return;
    const previous = preferences;
    const current = generation.current;
    const enabled = field === "budget_mode" ? previous.budget_mode !== "LOW_COST" : !previous[field];
    const change = field === "budget_mode" ? { budget_mode: enabled ? "LOW_COST" as const : "REGULAR" as const } : { [field]: enabled };
    savingNow.current = true; setSaving(true); setError(null);
    setPreferences({ ...previous, ...change });
    try {
      // Use one fresh snapshot and its concurrency version; preserve changes from other pages.
      const latest = await routePrefsApi.get();
      if (current !== generation.current) return;
      const updated = await routePrefsApi.update({
        expected_profile_version: latest.profile_version,
        available_hours_per_week: latest.available_hours_per_week,
        availability_source: latest.availability_source,
        budget_mode: latest.budget_mode,
        fastest_path: latest.fastest_path,
        needs_portfolio: latest.needs_portfolio,
        career_switch: latest.career_switch,
        ...(latest.max_out_of_pocket_krw !== null ? { max_out_of_pocket_krw: latest.max_out_of_pocket_krw } : {}),
        ...change,
      });
      if (current === generation.current) setPreferences(updated);
    } catch {
      if (current === generation.current) {
        setPreferences(previous);
        setError("로드맵 조건을 저장하지 못해 이전 값으로 되돌렸어요. 다시 불러온 뒤 시도해 주세요.");
      }
    } finally {
      if (current === generation.current) { savingNow.current = false; setSaving(false); }
    }
  }

  return { preferences, loading, saving, error, toggle, retry: () => setAttempt(value => value + 1) };
}
