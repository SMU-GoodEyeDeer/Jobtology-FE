// ─── Auth ────────────────────────────────────────────────────────────────────
export interface SessionResponse {
  user_id: string;
  csrf_token: string;
  profile_version: number;
}

// ─── Profile ─────────────────────────────────────────────────────────────────
export interface ProfileResponse {
  user_id: string;
  version: number;
  major_raw: string | null;
  major_concept_id: string | null;
  year: number | null;
  enrollment_status: string | null;
  expected_graduation_on: string | null;
}

export interface ProfileDetailResponse extends ProfileResponse {}

export interface ProfileUpdateRequest {
  expected_profile_version: number;
  major_raw: string;
  major_concept_id?: string;
  year?: number;
  enrollment_status?: string;
  expected_graduation_on?: string;
}

// ─── Occupations ─────────────────────────────────────────────────────────────
export interface OccupationResponse {
  occupation_id: string;
  name: string;
  description?: string;
}

// ─── Goals ───────────────────────────────────────────────────────────────────
export type GoalMode = "TARGETED" | "DISCOVERY";
export type GoalStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface GoalResponse {
  goal_id: string;
  version: number;
  goal_mode: GoalMode;
  target_by: string;
  timezone: string;
  original_time_phrase: string;
  occupation_id: string | null;
  status: GoalStatus;
}

export interface GoalDetailResponse extends GoalResponse {
  analysis_id: string | null;
}

export interface GoalListResponse {
  items: GoalResponse[];
}

export interface GoalUpdateRequest {
  expected_profile_version: number;
  goal_mode: GoalMode;
  target_by: string;
  timezone: string;
  original_time_phrase: string;
  occupation_id?: string;
  status?: GoalStatus;
}

// ─── Route Preferences ───────────────────────────────────────────────────────
export type BudgetMode = "REGULAR" | "LOW_COST";

export interface RoutePreferencesResponse {
  version: number;
  available_hours_per_week: number;
  availability_source: string;
  budget_mode: BudgetMode;
  fastest_path: boolean;
  needs_portfolio: boolean;
  career_switch: boolean;
  max_out_of_pocket_krw: number | null;
}

export interface RoutePreferencesUpdateRequest {
  expected_profile_version: number;
  available_hours_per_week: number;
  availability_source: string;
  budget_mode: BudgetMode;
  fastest_path: boolean;
  needs_portfolio: boolean;
  career_switch: boolean;
  max_out_of_pocket_krw?: number;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardNextAction {
  type: string;
  label: string;
  url?: string;
}

export interface DashboardResponse {
  next_actions: DashboardNextAction[];
  goal_id: string | null;
  profile_completion_pct: number | null;
  roadmap_progress_pct: number | null;
}

// ─── Analysis ────────────────────────────────────────────────────────────────
export interface AnalysisRequest {
  goal_id: string;
  expected_profile_version: number;
  basis_type: "EDITORIAL";
}

export interface AnalysisRequestResponse {
  recompute_request_id: string;
  status_url: string;
}

export interface RecomputeResponse {
  recompute_request_id: string;
  state: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  analysis_id: string | null;
}

export interface AnalysisResponse {
  analysis_id: string;
  goal_id: string;
  result: unknown | null;
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────
export type RoadmapStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type StepState = "TODO" | "IN_PROGRESS" | "COMPLETED";

export interface RoadmapStep {
  step_id: string;
  title: string;
  description: string | null;
  state: StepState;
  order: number;
}

export interface RoadmapResponse {
  roadmap_id: string;
  version: number;
  goal_id: string;
  title: string;
  status: RoadmapStatus;
}

export interface RoadmapDetailResponse extends RoadmapResponse {
  steps: RoadmapStep[];
}

export interface RoadmapListResponse {
  items: RoadmapResponse[];
}

// ─── v2 Catalog ──────────────────────────────────────────────────────────────
export interface Neo4jOccupationResponse {
  id: string;
  code: string;
  kind: string;
  name: string;
}

export interface SourceCapabilities {
  source: boolean;
  catalog: boolean;
  editorial_analysis: boolean;
  route_planning: boolean;
}

export interface Neo4jPublicationResponse {
  publication_id: string;
  source_state: string;
  capabilities: SourceCapabilities;
}

export interface Neo4jNcsCompetencyResponse {
  id: string;
  code: string;
  kind: string;
  name: string;
}

export interface Neo4jNcsAlignmentResponse {
  publication_id: string;
  source_enrichment_id: string;
  source_posting_id: string;
  source_current: boolean;
  accepted: boolean;
  competency: Neo4jNcsCompetencyResponse;
}

// ─── API Error ────────────────────────────────────────────────────────────────
export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
}
