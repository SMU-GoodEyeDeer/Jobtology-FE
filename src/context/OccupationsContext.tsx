import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { occupationsApi } from "../services/api";
import type { OccupationResponse } from "../services/types";

interface OccupationsContextValue {
  occupations: OccupationResponse[];
  getName: (occupationId: string | null | undefined) => string;
  loading: boolean;
}

const OccupationsContext = createContext<OccupationsContextValue>({
  occupations: [],
  getName: () => "목표 직무",
  loading: true,
});

export function OccupationsProvider({ children }: { children: ReactNode }) {
  const [occupations, setOccupations] = useState<OccupationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    occupationsApi.list()
      .then(setOccupations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function getName(occupationId: string | null | undefined): string {
    if (!occupationId) return "탐색 모드";
    const match = occupations.find((o) => o.occupation_id === occupationId);
    return match?.name ?? occupationId;
  }

  return (
    <OccupationsContext.Provider value={{ occupations, getName, loading }}>
      {children}
    </OccupationsContext.Provider>
  );
}

export function useOccupations() {
  return useContext(OccupationsContext);
}
