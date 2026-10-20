import { freshnessLabel, postingSourceName, reviewStatusLabel } from "../../services/resourcesApi";
import type { OccupationAssociation, OccupationContextResponse } from "../../services/resourcesApi";

export function AssociationStatus({ item }: { readonly item: OccupationAssociation }) {
  return <span className="occupation-association-status">추론 연결 · {reviewStatusLabel(item.review_status)} · 원문 {freshnessLabel(item.source_freshness)} · 분류 {freshnessLabel(item.catalog_freshness)}</span>;
}

export function ContextSummary({ data }: { readonly data: OccupationContextResponse }) {
  const summary = data.summary;
  return <div className="occupation-context-summary">
    <p>메타데이터로 추론한 직무 연결이에요. 역량 요구나 보유 역량의 근거로 반영하지 않아요.</p>
    <p>공고 {summary.postings.toLocaleString()}건 · 연결 {summary.associations.toLocaleString()}건 · 최신 연결 {summary.current_associations.toLocaleString()}건{summary.stale_associations > 0 && ` · 과거 연결 ${summary.stale_associations}건`}{summary.unknown_associations > 0 && ` · 최신 여부 미확인 ${summary.unknown_associations}건`}</p>
    {!!summary.by_source.length && <p>{summary.by_source.map(source => `${postingSourceName(source.source_id)} 공고 ${source.postings}건 / 연결 ${source.associations}건`).join(" · ")}</p>}
    {!!summary.by_occupation.length && <details><summary>연결 직무 {summary.by_occupation.length}개</summary><ul>{summary.by_occupation.map(occupation => <li key={`${occupation.occupation_scheme}:${occupation.occupation_code}`}>{occupation.occupation_name || occupation.occupation_code} · {occupation.occupation_code} · 공고 {occupation.postings}건 / 연결 {occupation.associations}건</li>)}</ul></details>}
  </div>;
}

export function AssociationProvenance({ items }: { readonly items: readonly OccupationAssociation[] }) {
  return <div className="occupation-association-provenance">{items.map(item => <details key={item.association_id}>
    <summary>{item.occupation_name || item.occupation_code} · 연결 출처와 검토</summary>
    <p><AssociationStatus item={item} /></p>
    <dl><div><dt>직무 코드</dt><dd>{item.occupation_scheme} {item.occupation_code}</dd></div><div><dt>연결 단계</dt><dd>{item.stage}</dd></div><div><dt>신뢰도</dt><dd>평가되지 않음</dd></div>
      {Object.entries({ 연결: item.association_id, 원문: postingSourceName(item.source_id), ...item.source_pins, ...item.catalog_pins }).map(([label, value]) => value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </details>)}</div>;
}
