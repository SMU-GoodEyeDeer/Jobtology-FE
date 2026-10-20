import type { OccupationContextResponse, PostingItem } from "../services/resourcesApi";
export function occupationContext(posting: PostingItem): OccupationContextResponse {
  const counts = { associations: 1, postings: 1, current_associations: 1, source_current_associations: 1, catalog_current_associations: 1 };
  return {
    contract_version: "jobtology-inferred-occupation-context-v1", basis: "METADATA_INFERRED", assertion_kind: "MODEL_INFERRED", competency_evidence: false,
    filters: { occupation_codes: ["20010203"] }, total: 1, offset: 0, limit: 20,
    summary: { ...counts, stale_associations: 0, unknown_associations: 0, by_source: [{ ...counts, source_id: "jobkorea" }], by_occupation: [{ ...counts, occupation_scheme: "NCS", occupation_code: "20010203", occupation_name: "개발" }] },
    items: [{ posting_key: posting.posting_id, posting_identity: posting.posting_id, source_id: "jobkorea", occupation_scheme: "NCS", occupation_code: "20010203", occupation_name: "개발", association_id: "association-1", basis: "METADATA_INFERRED", assertion_kind: "MODEL_INFERRED", review_status: "UNREVIEWED", stage: "STAGING", confidence: null, confidence_state: "UNASSESSED", source_freshness: "CURRENT", catalog_freshness: "CURRENT", source_pins: { run_id: "exact-run", source_hash: "source-hash", normalized_hash: null, source_facts_sha256: null }, catalog_pins: { pin: "exact-catalog", catalog_hash: null }, posting }],
  };
}
