export interface WeeklyPlanStep {
  readonly step_id: string;
  readonly number: number;
  readonly recommended_number: number;
  readonly title: string;
  readonly name: string;
  readonly requirement_key: string | null;
  readonly state: "TODO" | "IN_PROGRESS" | "COMPLETED";
  readonly phase: "BASIC" | "CORE" | "ADVANCED";
  readonly ncs_level: number | null;
  readonly field_code: string | null;
  readonly field_name: string | null;
  readonly hours: number;
  readonly recommended_hours: number;
  readonly hours_basis: "OFFICIAL" | "ESTIMATED" | "CUSTOM";
  readonly demand_pct: number | null;
  readonly start_week: number;
  readonly end_week: number;
  readonly start_date: string;
  readonly end_date: string;
  readonly reason: string;
  readonly moved: boolean;
  readonly prerequisite_step_ids: readonly string[];
  readonly unmet_prerequisite_step_ids: readonly string[];
}

export interface WeeklyPlanResponse {
  readonly roadmap_id: string;
  readonly start_date: string;
  readonly target_date: string | null;
  readonly weekly_hours: number;
  readonly recommended_weekly_hours: number;
  readonly rest_weeks: readonly number[];
  readonly is_customized: boolean;
  readonly saved_at: string | null;
  readonly total_hours: number;
  readonly total_weeks: number;
  readonly completion_date: string;
  readonly recommended_completion_date: string;
  readonly steps: readonly WeeklyPlanStep[];
}

export interface WeeklyPlanInput {
  readonly weekly_hours: number;
  readonly rest_weeks: readonly number[];
  readonly order: readonly string[];
  readonly hours: Readonly<Record<string, number>>;
}
