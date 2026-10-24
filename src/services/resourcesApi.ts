import { request } from "./api";

export interface LiveSource {
  readonly source_id: string;
  readonly run_id: string | null;
  readonly data_as_of: string | null;
}
export interface PostingItem {
  readonly posting_id: string;
  readonly source_id?: string | null;
  readonly title: string | null;
  readonly organization_code: string | null;
  readonly organization_name: string | null;
  readonly date_posted: string | null;
  readonly closing_date: string | null;
  readonly ongoing: boolean | null;
  readonly source_status?: string | null;
  readonly deadline_kind?: string | null;
  readonly deadline_basis?: string | null;
  readonly ongoing_basis?: string | null;
  readonly application_start_date?: string | null;
  readonly application_start_at?: string | null;
  readonly deadline_at?: string | null;
  readonly source_provenance?: LiveSource | null;
  readonly regions: readonly string[];
  readonly employment_types: readonly string[];
  readonly recruitment_type: string | null;
  readonly education: string | null;
  readonly ncs_categories: readonly { readonly code: string | null; readonly name: string | null }[];
  readonly occupation_associations?: readonly PostingOccupationAssociation[];
  readonly headcount: number | null;
  readonly source_url: string | null;
}
export interface PostingFilters { readonly occupation?: string; readonly q?: string; readonly ncs_category?: string; readonly region?: string; readonly open_on?: string; readonly offset?: number; readonly limit?: number }
export interface PostingsResponse {
  readonly sources: readonly LiveSource[];
  readonly items: readonly PostingItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
export interface PostingResponse { readonly sources: readonly LiveSource[]; readonly item: PostingItem }
export interface AssociationCounts {
  readonly associations: number;
  readonly postings: number;
  readonly current_associations: number;
  readonly source_current_associations: number;
  readonly catalog_current_associations: number;
}
export interface OccupationAssociation {
  readonly posting_key: string;
  readonly posting_identity: string;
  readonly source_id: string;
  readonly occupation_scheme: "NCS" | "ONET";
  readonly occupation_code: string;
  readonly occupation_name: string | null;
  readonly association_id: string;
  readonly basis: "METADATA_INFERRED";
  readonly assertion_kind: "MODEL_INFERRED";
  readonly review_status: "UNREVIEWED" | "ASSISTANT_REVIEWED" | "HUMAN_REVIEWED";
  readonly stage: string;
  readonly confidence: null;
  readonly confidence_state: "UNASSESSED";
  readonly source_freshness: "CURRENT" | "STALE" | "UNKNOWN";
  readonly catalog_freshness: "CURRENT" | "STALE" | "UNKNOWN";
  readonly source_pins: { readonly run_id: string | null; readonly source_hash: string | null; readonly normalized_hash: string | null; readonly source_facts_sha256: string | null };
  readonly catalog_pins: { readonly pin: string | null; readonly catalog_hash: string | null };
  readonly catalog_revalidation?: {
    readonly original_pin: string;
    readonly current_pin: string;
    readonly policy: "FULL_CONTEXT_EQUAL_V1";
    readonly context_hash: string;
    readonly verified_at: string;
  } | null;
  readonly posting: PostingItem | null;
}
export type PostingOccupationAssociation = Omit<OccupationAssociation, "posting"> & { readonly competency_evidence: false };
export interface CrosswalkEndpoint {
  readonly id: string;
  readonly scheme: "NCS" | "ONET";
  readonly kind: "ncs_occupation" | "ncs_competency" | "onet_occupation" | "onet_skill" | "onet_task" | "onet_work_activity" | "onet_knowledge" | "technology";
  readonly code: string;
  readonly name: string;
  readonly description?: string | null;
  readonly catalog_pin: string | null;
  readonly content_hash: string | null;
}
export interface CrosswalkLink {
  readonly mapping_id: string;
  readonly version?: string | null;
  readonly source: CrosswalkEndpoint;
  readonly target: CrosswalkEndpoint;
  readonly relation: "RELATED" | "PARTIAL" | "EXACT";
  readonly status: "PROPOSED" | "APPROVED" | "REJECTED";
  readonly basis: "SHARED_POSTINGS" | "CATALOG_COMPARISON" | "BILINGUAL_CUE";
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly review: { readonly review_id?: number | null; readonly reviewer_kind: "ASSISTANT" | "HUMAN"; readonly reviewer: string; readonly note: string; readonly reviewed_at: string } | null;
  readonly source_freshness: "CURRENT" | "STALE" | "UNKNOWN";
  readonly catalog_freshness: "CURRENT" | "STALE" | "UNKNOWN";
  readonly created_at: string | null;
}
export interface CrosswalkResponse {
  readonly contract_version: "jobtology-ncs-onet-crosswalk-v1";
  readonly basis: "CATALOG_CROSSWALK";
  readonly competency_evidence: false;
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
  readonly items: readonly CrosswalkLink[];
}
export interface OccupationContextResponse {
  readonly role_context?: { readonly role_id: string; readonly version: "posting-context-v1"; readonly basis: "APPLICATION_CONTEXT_SELECTION"; readonly onet_occupations: readonly { readonly code: string; readonly name: string }[] };
  readonly contract_version: "jobtology-inferred-occupation-context-v1";
  readonly basis: "METADATA_INFERRED";
  readonly assertion_kind: "MODEL_INFERRED";
  readonly competency_evidence: false;
  readonly filters: { readonly occupation_codes: readonly string[] | null };
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
  readonly summary: AssociationCounts & {
    readonly stale_associations: number;
    readonly unknown_associations: number;
    readonly by_source: readonly (AssociationCounts & { readonly source_id: string })[];
    readonly by_occupation: readonly (AssociationCounts & { readonly occupation_scheme: "NCS" | "ONET"; readonly occupation_code: string; readonly occupation_name: string | null })[];
  };
  readonly items: readonly OccupationAssociation[];
}
export function formatPostingDateTime(value: string): string {
  try {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
}
export function postingDeadlineLabel(item: PostingItem): string {
  if (item.source_status === "CLOSED") return "모집 종료 · 원문 상태";
  if (item.ongoing_basis === "USER_POLICY" || item.deadline_basis === "USER_POLICY") return "상시 모집 · 사용자 정책에 따른 추정";
  if (item.deadline_kind === "UNTIL_FILLED") return "채용 시 마감 · 원문 확인 필요";
  if (item.deadline_kind === "ROLLING" || item.deadline_kind === "ONGOING") return "상시 모집 · 원문 확인 필요";
  return item.deadline_at ? `접수 마감 ${formatPostingDateTime(item.deadline_at)}` : item.closing_date ? `접수 마감일 ${item.closing_date}` : "접수 마감일 미제공";
}
export const reviewStatusLabel = (status: string) => ({ UNREVIEWED: "미검토", ASSISTANT_REVIEWED: "보조 검토", HUMAN_REVIEWED: "사람 검토" }[status] ?? status);
export const freshnessLabel = (status: string) => ({ CURRENT: "최신", STALE: "과거 자료", UNKNOWN: "확인 안 됨" }[status] ?? status);
export function postingSourceName(sourceId: string): string {
  switch (sourceId) {
    case "jobkorea": return "잡코리아";
    case "job_alio": return "JOB-ALIO";
    case "nara_job": return "나라일터";
    default: return sourceId;
  }
}
export function postingSearchParams(filters: PostingFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params;
}
export function postingsHref(filters: PostingFilters = {}, postingId?: string): string {
  const params = postingSearchParams(filters);
  if (postingId) params.set("posting", postingId);
  return `/postings${params.size ? `?${params}` : ""}`;
}
/** Source data is external; allow ordinary web links only. */
export function safeSourceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export const resourcesApi = {
  crosswalk: (nodeId: string, limit = 6, offset = 0) => request<CrosswalkResponse>("GET", `/v2/live/crosswalk?${new URLSearchParams({ node_id: nodeId, limit: String(limit), offset: String(offset) })}`),
  occupationContext: (occupationCodes: string, limit = 20, offset = 0) => request<OccupationContextResponse>("GET", `/v2/live/occupation-context?${new URLSearchParams({ occupation_codes: occupationCodes, limit: String(limit), offset: String(offset) })}`),
  rolePostingContext: (occupationId: string, limit = 3, offset = 0) => request<OccupationContextResponse>("GET", `/v2/roles/${encodeURIComponent(occupationId)}/posting-context?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`),
  postings: (filters: PostingFilters = {}) => request<PostingsResponse>("GET", `/v2/live/postings?${postingSearchParams(filters)}`),
  posting: (postingId: string) => request<PostingResponse>("GET", `/v2/live/postings/${encodeURIComponent(postingId)}`),
};
