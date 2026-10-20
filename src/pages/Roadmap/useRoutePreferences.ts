import { useEffect, useRef, useState } from "react";
import { routePrefsApi } from "../../services/api";
import type { RouteAvailability, RoutePreferencesResponse, RoutePreferencesUpdateRequest } from "../../services/types";

export type PreferenceField = "budget_mode" | "fastest_path" | "needs_portfolio" | "career_switch";

export function useRoutePreferences(userId: string | undefined, sessionReady: boolean) {
  const [preferences, setPreferences] = useState<RoutePreferencesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const savingNow = useRef(false);
  const preferencesOwner = useRef(userId);

  useEffect(() => {
    const current = ++generation.current;
    if (preferencesOwner.current !== userId) {
      preferencesOwner.current = userId;
      setPreferences(null);
    }
    setError(null); setSaving(false); savingNow.current = false;
    if (!sessionReady || !userId) { setLoading(!!userId && !sessionReady); return; }
    setLoading(true);
    routePrefsApi.get().then(value => {
      if (current === generation.current) setPreferences(value);
    }).catch(() => {
      if (current === generation.current) setError("로드맵 조건을 불러오지 못했어요. 다시 시도해 주세요.");
    }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current += 1; };
  }, [userId, sessionReady, attempt]);

  async function save(change: Partial<Omit<RoutePreferencesUpdateRequest, "expected_profile_version">>): Promise<boolean> {
    if (!preferences || !sessionReady || !userId || preferencesOwner.current !== userId || loading || savingNow.current) return false;
    const previous = preferences;
    const current = generation.current;
    savingNow.current = true; setSaving(true); setError(null);
    setPreferences({ ...previous, ...change });
    try {
      // Use one fresh snapshot and its concurrency version; preserve changes from other pages.
      const latest = await routePrefsApi.get();
      if (current !== generation.current) return false;
      const updated = await routePrefsApi.update({
        expected_profile_version: latest.profile_version,
        available_hours_per_week: latest.available_hours_per_week,
        availability_source: latest.availability_source,
        budget_mode: latest.budget_mode,
        fastest_path: latest.fastest_path,
        needs_portfolio: latest.needs_portfolio,
        career_switch: latest.career_switch,
        weekly_availability: latest.weekly_availability ?? [],
        unavailable_dates: latest.unavailable_dates ?? [],
        ...(latest.max_out_of_pocket_krw !== null ? { max_out_of_pocket_krw: latest.max_out_of_pocket_krw } : {}),
        ...change,
      });
      if (current !== generation.current) return false;
      setPreferences(updated);
      return true;
    } catch {
      if (current === generation.current) {
        setPreferences(previous);
        setError("로드맵 조건을 저장하지 못해 이전 값으로 되돌렸어요. 다시 불러온 뒤 시도해 주세요.");
      }
      return false;
    } finally {
      if (current === generation.current) { savingNow.current = false; setSaving(false); }
    }
  }

  function toggle(field: PreferenceField) {
    if (!preferences) return Promise.resolve(false);
    const enabled = field === "budget_mode" ? preferences.budget_mode !== "LOW_COST" : !preferences[field];
    return save(field === "budget_mode" ? { budget_mode: enabled ? "LOW_COST" : "REGULAR" } : { [field]: enabled });
  }

  return { preferences: preferencesOwner.current === userId ? preferences : null, loading, saving, error, toggle, saveAvailability: (value: RouteAvailability) => save(value), retry: () => setAttempt(value => value + 1) };
}
