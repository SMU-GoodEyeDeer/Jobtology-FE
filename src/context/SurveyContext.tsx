import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export interface SurveyData {
  // Survey1
  occupationId: string | null;       // null = DISCOVERY mode
  occupationName: string | null;
  // Capability checklist step. `capabilityAnswered` is false when the step was
  // skipped or unavailable, so a skip never overwrites earlier answers.
  capabilityItemIds: string[];
  capabilityAnswered: boolean;
  // Survey2
  majorRaw: string;
  year: number | null;
  // Survey3 (conditions)
  lowCostBudget: boolean;
  limitedHours: boolean;
  fastestPath: boolean;
  needsPortfolio: boolean;
  careerSwitch: boolean;
}

const DEFAULT: SurveyData = {
  occupationId: null,
  occupationName: null,
  capabilityItemIds: [],
  capabilityAnswered: false,
  majorRaw: "",
  year: null,
  lowCostBudget: false,
  limitedHours: false,
  fastestPath: false,
  needsPortfolio: false,
  careerSwitch: false,
};

interface SurveyContextValue {
  data: SurveyData;
  update: (partial: Partial<SurveyData>) => void;
  reset: () => void;
}

const SurveyContext = createContext<SurveyContextValue>({
  data: DEFAULT,
  update: () => {},
  reset: () => {},
});

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SurveyData>(DEFAULT);

  const update = (partial: Partial<SurveyData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const reset = () => setData(DEFAULT);

  return (
    <SurveyContext.Provider value={{ data, update, reset }}>
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurvey() {
  return useContext(SurveyContext);
}
