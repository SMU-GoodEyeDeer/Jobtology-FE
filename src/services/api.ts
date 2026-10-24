import type {
  ResumeAnalysisEvent,
  SessionResponse,
  ProfileDetailResponse,
  ProfileUpdateRequest,
  ProfileResponse,
  CapabilityDetailResponse,
  CapabilityMutationResponse,
  CapabilityMutationRequest,
  SkillSearchResponse,
  OccupationResponse,
  GoalListResponse,
  GoalDetailResponse,
  GoalResponse,
  GoalUpdateRequest,
  RoutePreferencesResponse,
  RoutePreferencesUpdateRequest,
  DashboardResponse,
  AnalysisRequest,
  AnalysisRequestResponse,
  RecomputeResponse,
  AnalysisResponse,
  RoadmapListResponse,
  RoadmapDetailResponse,
  RoadmapSkillsResponse,
  RoadmapRevision, RoadmapRevisionInput, RoadmapRevisionApplied,
  RoadmapResponse,
  Neo4jOccupationResponse,
  Neo4jPublicationResponse,
  Neo4jNcsAlignmentResponse,
  RouteProposalSummary,
  ChatMessagePayload,
  ChatReplyResponse,
  RoleEvidenceGraph,
  NcsUnitResponse,
  ExamSessionsResponse,
  WeeklyPlanInput,
  WeeklyPlanResponse,
  ResumeStatus, ResumeScan, ResumeFormat, ResumeSuggestion,
} from "./types";
import { readResumeEvents } from "./resumeStream";
import { invalidateWorkspaceRequest, resetWorkspaceCache } from "./workspaceCache";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export const GOOGLE_LOGIN_URL = `${BASE_URL}/v1/auth/google/login`;

// CSRF token stored in memory (set after session fetch)
let _csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  if (token !== _csrfToken) resetWorkspaceCache();
  _csrfToken = token;
}

export function getCsrfToken() {
  return _csrfToken;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  // Attach CSRF token for state-mutating requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && _csrfToken) {
    headers["X-CSRF-Token"] = _csrfToken;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include", // send session cookie
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const err = new Error(`API ${method} ${path} failed: ${res.status}`);
    (err as Error & { status: number; detail: unknown }).status = res.status;
    (err as Error & { status: number; detail: unknown }).detail = detail;
    const retryAfter = Number(res.headers.get("Retry-After"));
    if (retryAfter > 0 && Number.isFinite(retryAfter)) (err as Error & { retryAfterSeconds: number }).retryAfterSeconds = retryAfter;
    throw err;
  }

  invalidateWorkspaceRequest(method, path);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body: unknown, headers?: Record<string, string>) =>
  request<T>("POST", path, body, headers);
const put = <T>(path: string, body: unknown, headers?: Record<string, string>) =>
  request<T>("PUT", path, body, headers);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = <T>(path: string, body?: unknown) => request<T>("DELETE", path, body);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  getSession: () => get<SessionResponse>("/v1/auth/session"),
  logout: () => post<void>("/v1/auth/logout", undefined),
  deleteAccount: () => del<void>("/v1/me/account"),
};

// ─── Profile ─────────────────────────────────────────────────────────────────
export const profileApi = {
  get: () => get<ProfileDetailResponse>("/v1/me/profile"),
  update: (body: ProfileUpdateRequest) => put<ProfileResponse>("/v1/me/profile", body),
};

// ─── Occupations ─────────────────────────────────────────────────────────────
export const occupationsApi = {
  list: () => get<OccupationResponse[]>("/v1/occupations"),
};

// ─── Goals ───────────────────────────────────────────────────────────────────
export const goalsApi = {
  list: () => get<GoalListResponse>("/v1/me/goals"),
  get: (goalId: string) => get<GoalDetailResponse>(`/v1/me/goals/${goalId}`),
  create: (body: GoalUpdateRequest, idempotencyKey?: string) =>
    post<GoalResponse>("/v1/me/goals", body, idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined),
  update: (goalId: string, body: GoalUpdateRequest) =>
    patch<GoalResponse>(`/v1/me/goals/${goalId}`, body),
  delete: (goalId: string, body: { expected_profile_version: number }) =>
    del<{ goal_id: string; profile_version: number }>(`/v1/me/goals/${goalId}`, body),
};

// ─── Route Preferences ───────────────────────────────────────────────────────
export const routePrefsApi = {
  get: () => get<RoutePreferencesResponse>("/v1/me/route-preferences"),
  update: (body: RoutePreferencesUpdateRequest) =>
    put<RoutePreferencesResponse>("/v1/me/route-preferences", body),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: (goalId?: string) => {
    const qs = goalId ? `?goal_id=${goalId}` : "";
    return get<DashboardResponse>(`/v1/dashboard${qs}`);
  },
};

// ─── Analysis ────────────────────────────────────────────────────────────────
export const analysisApi = {
  create: (body: AnalysisRequest, idempotencyKey?: string) =>
    post<AnalysisRequestResponse>("/v1/analyses", body, idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined),
  poll: (recomputeRequestId: string) =>
    get<RecomputeResponse>(`/v1/recomputations/${recomputeRequestId}`),
  get: (analysisId: string) => get<AnalysisResponse>(`/v1/analyses/${analysisId}`),
};

export const liveApi = {
  ncsUnit: (baseCode: string) =>
    get<NcsUnitResponse>(`/v2/live/ncs-units/${encodeURIComponent(baseCode)}`),
  examSessions: (qualification: string, from: string) => {
    const query = new URLSearchParams({ qualification, from, limit: "20" });
    return get<ExamSessionsResponse>(`/v2/live/exam-sessions?${query}`);
  },
};

// ─── Route Proposals ─────────────────────────────────────────────────────────
export const proposalsApi = {
  get: (proposalId: string) => get<RouteProposalSummary>(`/v1/route-proposals/${proposalId}`),
};

// ─── Roadmaps ────────────────────────────────────────────────────────────────
export const roadmapsApi = {
  compareRevision: (roadmapId: string, proposalId: string) => get<RoadmapRevision>(`/v1/roadmaps/${roadmapId}/revision?${new URLSearchParams({ proposal_id: proposalId })}`),
  applyRevision: (roadmapId: string, body: RoadmapRevisionInput) => post<RoadmapRevisionApplied>(`/v1/roadmaps/${roadmapId}/revision`, body),
  skills: (roadmapId: string) => get<RoadmapSkillsResponse>(`/v1/roadmaps/${roadmapId}/skills`),
  getPlan: (roadmapId: string) => get<WeeklyPlanResponse>(`/v1/roadmaps/${roadmapId}/plan`),
  previewPlan: (roadmapId: string, body: WeeklyPlanInput | null) => post<WeeklyPlanResponse>(`/v1/roadmaps/${roadmapId}/plan/preview`, body),
  savePlan: (roadmapId: string, body: WeeklyPlanInput) => put<WeeklyPlanResponse>(`/v1/roadmaps/${roadmapId}/plan`, body),
  resetPlan: (roadmapId: string, expectedVersion: number) => del<WeeklyPlanResponse>(`/v1/roadmaps/${roadmapId}/plan?expected_version=${expectedVersion}`),
  list: () => get<RoadmapListResponse>("/v1/roadmaps"),
  get: (roadmapId: string) => get<RoadmapDetailResponse>(`/v1/roadmaps/${roadmapId}`),
  create: (body: {
    expected_profile_version: number;
    goal_id: string;
    proposal_id: string;
    title: string;
  }, idempotencyKey?: string) =>
    post<RoadmapResponse>("/v1/roadmaps", body, idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined),
  update: (roadmapId: string, body: {
    operation: "ACTIVATE" | "ARCHIVE" | "RENAME";
    expected_roadmap_version: number;
    expected_profile_version: number;
    title?: string;
  }) => patch<RoadmapResponse>(`/v1/roadmaps/${roadmapId}`, body),
  updateStep: (roadmapId: string, stepId: string, body: {
    state: "TODO" | "IN_PROGRESS" | "COMPLETED";
    expected_roadmap_version: number;
    expected_profile_version: number;
  }) => patch<RoadmapResponse>(`/v1/roadmaps/${roadmapId}/steps/${stepId}`, body),
};

// ─── v2 Catalog ──────────────────────────────────────────────────────────────
function buildQs(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const catalogV2Api = {
  listOccupations: (params?: { limit?: number; offset?: number }) =>
    get<Neo4jOccupationResponse[]>(`/v2/occupations${buildQs(params)}`),
  listPublications: (params?: { limit?: number; offset?: number }) =>
    get<Neo4jPublicationResponse[]>(`/v2/publications${buildQs(params)}`),
  listAlignments: (publicationId: string, params?: { limit?: number; offset?: number }) =>
    get<Neo4jNcsAlignmentResponse[]>(`/v2/publications/${publicationId}/alignments${buildQs(params)}`),
};

// ─── Capabilities ────────────────────────────────────────────────────────────
export const roleEvidenceGraphApi = {
  get: (occupationId: string, signal?: AbortSignal) =>
    request<RoleEvidenceGraph>("GET", `/v2/roles/${encodeURIComponent(occupationId)}/evidence-graph`, undefined, undefined, signal),
};

export const capabilitiesApi = {
  list: () => get<{ items: CapabilityDetailResponse[] }>("/v1/me/capabilities"),
  get: (capabilityId: string) => get<CapabilityDetailResponse>(`/v1/me/capabilities/${capabilityId}`),
  create: (body: CapabilityMutationRequest, idempotencyKey?: string) => post<CapabilityMutationResponse>("/v1/me/capabilities", body, idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined),
  update: (capabilityId: string, body: CapabilityMutationRequest) =>
    patch<CapabilityMutationResponse>(`/v1/me/capabilities/${capabilityId}`, body),
  delete: (capabilityId: string, body: { expected_profile_version: number }) =>
    del<CapabilityMutationResponse>(`/v1/me/capabilities/${capabilityId}`, body),
};

export const skillsApi = {
  search: (filters: { q?: string; occupation_id?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") query.set(key, String(value));
    return get<SkillSearchResponse>(`/v1/skills?${query}`);
  },
};

export const resumeApi = {
  status: () => get<ResumeStatus>("/v1/me/resume/status"),
  scan: async (file: File, format: ResumeFormat, occupationId?: string | null, signal?: AbortSignal): Promise<ResumeScan> => {
    const query = new URLSearchParams({ format });
    if (occupationId) query.set("occupation_id", occupationId);
    const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
    if (_csrfToken) headers["X-CSRF-Token"] = _csrfToken;
    const response = await fetch(`${BASE_URL}/v1/me/resume/scan?${query}`, { method: "POST", credentials: "include", headers, body: file, signal });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw Object.assign(new Error("이력서를 읽지 못했어요."), { status: response.status, detail });
    }
    return response.json() as Promise<ResumeScan>;
  },
  interpret: (text: string, occupationId?: string | null) => post<{ suggestions: ResumeSuggestion[]; rejected_count: number }>("/v1/me/resume/interpret", { text, occupation_id: occupationId ?? null }),
  analyze: async (file: File, occupationId: string | null | undefined, onEvent: (event: ResumeAnalysisEvent) => void, signal: AbortSignal): Promise<void> => {
    const query = new URLSearchParams({ format: "pdf", ai_consent: "true" });
    if (occupationId) query.set("occupation_id", occupationId);
    const headers: Record<string, string> = { "Content-Type": "application/octet-stream", Accept: "application/x-ndjson" };
    if (_csrfToken) headers["X-CSRF-Token"] = _csrfToken;
    const response = await fetch(`${BASE_URL}/v1/me/resume/analyze?${query}`, { method: "POST", credentials: "include", headers, body: file, signal });
    if (!response.ok) throw Object.assign(new Error("이력서 분석을 시작하지 못했어요."), { status: response.status, detail: await response.json().catch(() => null) });
    if (!response.body) throw new Error("이력서 분석 응답을 읽지 못했어요.");
    await readResumeEvents(response.body, onEvent, signal);
  },
};

// ─── AI Chat ─────────────────────────────────────────────────────────────────
export const chatApi = {
  status: () => get<{ available: boolean }>("/v1/chat/status"),
  send: (messages: ChatMessagePayload[], mode: "counsel" | "onboarding" | "spec" = "counsel", goalId?: string) =>
    post<ChatReplyResponse>("/v1/chat/messages", { messages, mode, ...(goalId ? { goal_id: goalId } : {}) }),
};
