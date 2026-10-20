import { postingSourceName, reviewStatusLabel } from "../../services/resourcesApi";
import type { EvidenceEdge, EvidenceNode } from "../../services/types";

export function GraphEvidenceMetadata({ node, edges }: { readonly node: EvidenceNode; readonly edges: readonly EvidenceEdge[] }) {
  const sources = [...new Map([...(node.evidence_sources ?? []), ...edges.flatMap(edge => edge.evidence_sources ?? [])].map(source => [JSON.stringify(source), source])).values()];
  const reviewed = [...new Set([...(node.review_statuses ?? []), ...edges.flatMap(edge => edge.review_statuses ?? []), ...sources.map(source => source.review_status)])];
  const stages = [...new Set([...(node.stages ?? []), ...edges.flatMap(edge => edge.stages ?? []), ...sources.map(source => source.stage)])];
  const inferred = node.basis === "METADATA_INFERRED";
  const provenanceEdges = edges.filter(edge => edge.basis === "METADATA_INFERRED");
  if (!inferred && !sources.length && !node.excluded_associations && !provenanceEdges.length) return null;
  return <div className="graph-evidence-metadata">
    {inferred && <p className="node-popup-desc">모델 추론 · 신뢰도 미평가 · 역량 충족에 반영하지 않아요.</p>}
    {!!node.excluded_associations && <p className="node-popup-desc">기준이 바뀐 과거 연결 {node.excluded_associations.toLocaleString()}건은 그래프 집계에서 제외했어요.</p>}
    <details><summary>출처와 검토 정보</summary>
      {!!reviewed.length && <p>검토: {reviewed.map(reviewStatusLabel).join(" · ")}</p>}
      {!!stages.length && <p>연결 단계: {stages.join(" · ")}</p>}
      {sources.map((source, index) => <div key={index} className="graph-evidence-source"><strong>{source.source_id ? postingSourceName(source.source_id) : "출처 미제공"} · 공고 {source.postings}건</strong><p>{reviewStatusLabel(source.review_status)} · {source.stage} · {source.accepted ? "승인됨" : "미승인"}</p><p>원문 {source.source_current ? "최신" : "기준 불일치 또는 미확인"} · 분류 {source.catalog_current ? "최신" : "기준 불일치 또는 미확인"}</p><p>원문 실행: {source.source_run_id || "미제공"}<br />분류 기준: {source.catalog_run_id || "미제공"}</p></div>)}
      {provenanceEdges.map((edge, index) => <div key={index} className="graph-evidence-source"><strong>추론 연결 · {edge.kind}</strong>{!!edge.review_statuses?.length && <p>검토: {edge.review_statuses.map(reviewStatusLabel).join(" · ")}</p>}{!!edge.stages?.length && <p>연결 단계: {edge.stages.join(" · ")}</p>}{!!edge.source_run_ids?.length && <p>원문 실행: {edge.source_run_ids.join(" · ")}</p>}{!!edge.catalog_pins?.length && <p>분류 기준: {edge.catalog_pins.join(" · ")}</p>}</div>)}
    </details>
  </div>;
}
