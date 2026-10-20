// ─── Auth ────────────────────────────────────────────────────────────────────
export interface SessionResponse {
  user_id: string;
  display_name?: string | null;
  csrf_token: string;
  profile_version: number;
}

// ─── Profile ─────────────────────────────────────────────────────────────────
export interface ProfileResponse {
  user_id: string;
  profile_version: number;
  version: number;
}

export interface ProfileDetailResponse extends ProfileResponse {
  major_raw: string | null;
  major_concept_id: string | null;
  year: number | null;
  enrollment_status: string | null;
  expected_graduation_on: string | null;
}

export interface ProfileUpdateRequest {
  expected_profile_version: number;
  major_raw: string;
  major_concept_id?: string | null;
  year?: number | null;
  enrollment_status?: string | null;
  expected_graduation_on?: string | null;
}

export type SpecCategory = "skill" | "certification" | "test" | "project" | "experience";
export type SpecProficiency = "FAMILIAR" | "GUIDED" | "INDEPENDENT" | "PRODUCTION";
export interface DocumentEvidence {
  document_sha256: string;
  parser_revision: string;
  block_id: string;
  text_hash: string;
  quote: string;
  start: number;
  end: number;
  method: "KEYWORD" | "AI_ASSISTED" | "SELECTED_TEXT";
}
export interface SpecDetails {
  competency_ids: string[];
  evidence: string;
  source: "MANUAL" | "LLM_ASSISTED" | "DOCUMENT_IMPORT";
  document_evidence?: DocumentEvidence | null;
  started_on?: string | null;
  ended_on?: string | null;
  ongoing?: boolean;
  issuer?: string | null;
  credential_code?: string | null;
  issued_on?: string | null;
  expires_on?: string | null;
  score?: number | null;
  score_max?: number | null;
  score_unit?: string | null;
  organization?: string | null;
  role?: string | null;
  url?: string | null;
}
export interface MatchedCompetency { entity_id: string; label: string; requirement_keys: string[] }
export interface SpecMatching {
  status: "MATCHED" | "NEEDS_CLARIFICATION" | "UNUSED" | "EXPIRED";
  credit: number;
  competencies: MatchedCompetency[];
  message: string;
}
export interface CapabilityDetailResponse {
  capability_id: string;
  raw_text: string;
  category: SpecCategory | "ROADMAP_OUTCOME";
  lifecycle: string;
  entity_id: string | null;
  proficiency: SpecProficiency | null;
  verification: string;
  details: Partial<SpecDetails>;
  matching: SpecMatching;
}
export interface CapabilityWrite {
  category: SpecCategory;
  raw_text: string;
  proficiency: SpecProficiency;
  details: SpecDetails;
}
export interface CapabilityMutationRequest extends CapabilityWrite {
  expected_profile_version: number;
}

export interface CapabilityMutationResponse {
  capability_id: string;
  profile_version: number;
}

export interface CatalogSkill extends MatchedCompetency {
  source: "NCS" | "ONET";
  original_label: string;
  aliases: string[];
  ncs_level: number | null;
  source_url?: string | null;
  translation_status?: string | null;
}
export interface SkillSearchResponse {
  items: CatalogSkill[];
  total: number;
  available_sources: ("NCS" | "ONET")[];
}

export type ResumeFormat = "pdf" | "docx" | "hwpx" | "hwp" | "doc";
export interface ResumeStatus {
  formats: ResumeFormat[];
  max_bytes: number;
  max_pdf_pages: number;
  parse_timeout_seconds: number;
  ai_available: boolean;
  ai_provider: string | null;
  retention: "REQUEST_ONLY";
}
export interface ResumeBlock { block_id: string; text: string; text_hash: string; page: number | null }
export interface ResumeSuggestion {
  suggestion_id: string;
  category: SpecCategory;
  title: string;
  competencies: CatalogSkill[];
  block_id: string;
  quote: string;
  start: number;
  end: number;
  method: "KEYWORD" | "AI_ASSISTED";
  score: number | null;
  score_max: number | null;
}
export interface ResumeScan {
  document_sha256: string;
  parser_revision: string;
  blocks: ResumeBlock[];
  suggestions: ResumeSuggestion[];
  warnings: string[];
  skipped_pages: number[];
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
  profile_version: number;
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
  kind: string;
  step_id: string;
  title: string;
  reason_code: string;
  due_at: string | null;
}

export interface DashboardResponse {
  state?: string;
  analysis_id?: string | null;
  recompute_request_id?: string | null;
  recompute_state?: string | null;
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
  error_code?: string | null;
}

export interface AnalysisResponse {
  analysis_id: string;
  goal_id: string;
  result: AnalysisResult | null;
}

export interface AnalysisResult {
  readonly required_pct?: number | null;
  readonly preferred_pct?: number | null;
  readonly weighted_required_pct?: number | null;
  readonly weighted_preferred_pct?: number | null;
  readonly weighted_score_method?: string;
  readonly skills?: readonly Skill[];
}

export interface Skill {
  readonly name: string;
  readonly type: "필수" | "우대";
  readonly demand_pct?: number | null;
  readonly demand_postings?: number | null;
  readonly demand_base?: number | null;
  readonly difficulty?: string | null;
  readonly experienced_pct?: number | null;
  readonly achievement?: string | null;
  readonly requirement_key?: string;
  readonly ncs_base_code?: string | null;
  readonly status?: "UNMET" | "NEEDS_INPUT" | "PARTIAL";
  readonly credit?: number;
  readonly base_estimated_hours?: number | null;
  readonly ncs_level?: number | null;
  readonly estimated_hours?: number | null;
  readonly hours_basis?: "OFFICIAL" | "ESTIMATED" | null;
  readonly qualifications?: readonly SkillQualification[];
}

export interface SkillQualification {
  readonly code: string;
  readonly name: string | null;
  readonly display_name?: string;
  readonly kind?: "NATIONAL_TECHNICAL" | "WORK_LEARNING" | null;
}

export interface NcsUnitResponse {
  readonly contract_version: string;
  readonly sources: readonly { readonly source_id: string; readonly run_id: string | null; readonly data_as_of: string | null }[];
  readonly item: {
    readonly base_code: string;
    readonly code: string;
    readonly name: string;
    readonly level: number | null;
    readonly definition: string | null;
  };
}

export interface ExamDateGroup {
  readonly registration_start: string | null;
  readonly registration_end: string | null;
  readonly exam_start: string | null;
  readonly exam_end: string | null;
  readonly result_date: string | null;
}

export interface ExamSession {
  readonly qualification_code: string;
  readonly qualification_name: string | null;
  readonly year: number | null;
  readonly round: number | null;
  readonly category_code: string | null;
  readonly name: string | null;
  readonly written: ExamDateGroup | null;
  readonly practical: ExamDateGroup | null;
}

export interface ExamSessionsResponse {
  readonly sources?: readonly { readonly source_id: string; readonly data_as_of: string | null }[];
  readonly items: readonly ExamSession[];
  readonly total: number;
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────
export type RoadmapStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type StepState = "TODO" | "IN_PROGRESS" | "COMPLETED";

export interface RoadmapStep {
  step_id: string;
  title: string;
  description: string | null;
  state: StepState;
  order?: number;
  readonly step_key?: string;
  readonly position?: number;
  readonly action_id?: string | null;
  readonly planned_start?: string | null;
  readonly planned_end?: string | null;
  readonly outcomes?: readonly { readonly requirement_key?: string }[];
}

export interface RoadmapResponse {
  roadmap_id: string;
  version: number;
  goal_id: string;
  title: string;
  status: RoadmapStatus;
  proposal_id?: string;
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

// ─── Route Proposals ─────────────────────────────────────────────────────────
// PARTIAL: no route covers every required capability before the target date,
// so the proposal covers as many required capabilities as possible.
export type RouteFeasibility = "FEASIBLE" | "RISKY" | "PARTIAL" | "INFEASIBLE";

export interface RouteProposalSummary {
  proposal_id: string;
  feasibility: RouteFeasibility;
}

// ─── AI Chat ─────────────────────────────────────────────────────────────────
export interface ChatMessagePayload {
  role: "user" | "assistant";
  text: string;
}

export interface ChatCapabilityCandidate {
  entity_id: string;
  label: string;
  evidence_quote: string;
  category?: SpecCategory | null;
}

export interface ChatReplyResponse {
  reply: string;
  occupation_id: string | null;
  candidates: ChatCapabilityCandidate[];
  suggestions?: string[];
}

// ─── API Error ────────────────────────────────────────────────────────────────
export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
}

// ─── Role evidence graph (Neo4j) ─────────────────────────────────────────────
export type EvidenceNodeKind =
  | "role"
  | "ncs_occupation"
  | "posting_evidence"
  | "ncs_competency"
  | "onet_occupation"
  | "onet_skill"
  | "qualification"
  | "technology";

export interface EvidenceNode {
  readonly ncs_category?: string | null;
  readonly ncs_base_code?: string | null;
  readonly requirement_key?: string | null;
  readonly qualification_code?: string | null;
  readonly id: string;
  readonly kind: EvidenceNodeKind;
  readonly label: string;
  readonly detail: string | null;
  readonly weight: number | null;
}

export interface EvidenceEdge {
  readonly source: string;
  readonly target: string;
  readonly kind: string;
  readonly weight: number | null;
}

export interface RoleEvidenceGraph {
  readonly occupation_id: string;
  readonly name: string;
  readonly nodes: readonly EvidenceNode[];
  readonly edges: readonly EvidenceEdge[];
}
export type { WeeklyPlanInput, WeeklyPlanResponse, WeeklyPlanStep } from "./weeklyPlanTypes";
