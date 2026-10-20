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
  readonly regions: readonly string[];
  readonly employment_types: readonly string[];
  readonly recruitment_type: string | null;
  readonly education: string | null;
  readonly ncs_categories: readonly { readonly code: string | null; readonly name: string | null }[];
  readonly headcount: number | null;
  readonly source_url: string | null;
}
export interface PostingFilters { readonly q?: string; readonly ncs_category?: string; readonly region?: string; readonly open_on?: string; readonly offset?: number; readonly limit?: number }
export interface PostingsResponse {
  readonly sources: readonly LiveSource[];
  readonly items: readonly PostingItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
export interface PostingResponse { readonly sources: readonly LiveSource[]; readonly item: PostingItem }
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
  postings: (filters: PostingFilters = {}) => request<PostingsResponse>("GET", `/v2/live/postings?${postingSearchParams(filters)}`),
  posting: (postingId: string) => request<PostingResponse>("GET", `/v2/live/postings/${encodeURIComponent(postingId)}`),
};
