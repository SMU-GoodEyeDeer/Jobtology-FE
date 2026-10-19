import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { occupationsApi } from "../services/api";
import type { OccupationResponse } from "../services/types";

interface OccupationsContextValue {
  occupations: OccupationResponse[];
  getName: (occupationId: string | null | undefined) => string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const OccupationsContext = createContext<OccupationsContextValue>({
  occupations: [],
  getName: () => "목표 직무",
  loading: true,
  error: null,
  refresh: async () => {},
});

export function OccupationsProvider({ children }: { children: ReactNode }) {
  const [occupations, setOccupations] = useState<OccupationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setOccupations(await occupationsApi.list()); }
    catch (cause) { setError("직무 목록을 불러오지 못했어요."); throw cause; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh().catch(() => {}); }, [refresh]);

  function getName(occupationId: string | null | undefined): string {
    if (!occupationId) return "탐색 모드";
    const match = occupations.find((o) => o.occupation_id === occupationId);
    return match?.name ?? occupationId;
  }

  return (
    <OccupationsContext.Provider value={{ occupations, getName, loading, error, refresh }}>
      {children}
    </OccupationsContext.Provider>
  );
}

export function useOccupations() {
  return useContext(OccupationsContext);
}
