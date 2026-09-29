import type {
  SessionResponse,
  ProfileDetailResponse,
  ProfileUpdateRequest,
  ProfileResponse,
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
  RoadmapResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://jobtology.yeongmin.net/api";

// CSRF token stored in memory (set after session fetch)
let _csrfToken: string | null = null;

export function setCsrfToken(token: string) {
  _csrfToken = token;
}

export function getCsrfToken() {
  return _csrfToken;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
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
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body: unknown, headers?: Record<string, string>) =>
  request<T>("POST", path, body, headers);
const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = <T>(path: string, body?: unknown) => request<T>("DELETE", path, body);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  getSession: () => get<SessionResponse>("/v1/auth/session"),
  logout: () => post<void>("/v1/auth/logout", undefined),
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

// ─── Roadmaps ────────────────────────────────────────────────────────────────
export const roadmapsApi = {
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

// ─── Capabilities ────────────────────────────────────────────────────────────
export const capabilitiesApi = {
  list: () => get<{ items: unknown[] }>("/v1/me/capabilities"),
  get: (capabilityId: string) => get<unknown>(`/v1/me/capabilities/${capabilityId}`),
  create: (body: {
    expected_profile_version: number;
    category: string;
    raw_text: string;
    entity_id?: string;
    proficiency?: string;
    details?: Record<string, unknown>;
  }) => post<unknown>("/v1/me/capabilities", body),
  update: (capabilityId: string, body: unknown) =>
    patch<unknown>(`/v1/me/capabilities/${capabilityId}`, body),
  delete: (capabilityId: string, body: { expected_profile_version: number }) =>
    del<unknown>(`/v1/me/capabilities/${capabilityId}`, body),
};
