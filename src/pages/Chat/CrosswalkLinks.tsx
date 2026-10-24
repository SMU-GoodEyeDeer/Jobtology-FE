import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatPostingDateTime, freshnessLabel, postingsHref, resourcesApi, type CrosswalkResponse } from "../../services/resourcesApi";
import { readPostingsCache } from "../../services/postingsCache";
import "./CrosswalkLinks.css";

const relations = { RELATED: "관련 항목", PARTIAL: "부분 대응", EXACT: "동등 범위" };
const statuses = { PROPOSED: "검토 전 제안", APPROVED: "검토된 연결", REJECTED: "제외된 연결" };
const bases = { SHARED_POSTINGS: "동일 공고의 직무 분류로 연결", CATALOG_COMPARISON: "분류 자료 비교로 연결", BILINGUAL_CUE: "공통 기술 용어로 제안" };

export function CrosswalkLinks({ nodeId, nodeScheme, onExpand, busy }: { readonly nodeId: string; readonly nodeScheme: "NCS" | "ONET"; readonly onExpand: () => void; readonly busy: boolean }) {
  const [request, setRequest] = useState({ nodeId, limit: 6, attempt: 0 });
  const limit = request.nodeId === nodeId ? request.limit : 6, attempt = request.nodeId === nodeId ? request.attempt : 0;
  const [result, setResult] = useState<{ nodeId: string; limit: number; data?: CrosswalkResponse; error?: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    readPostingsCache(JSON.stringify(["crosswalk", nodeId, limit]), () => resourcesApi.crosswalk(nodeId, limit)).then(data => {
      if (active) setResult({ nodeId, limit, data });
    }, () => { if (active) setResult(previous => ({ nodeId, limit, data: previous?.nodeId === nodeId ? previous.data : undefined, error: true })); });
    return () => { active = false; };
  }, [nodeId, limit, attempt]);
  const current = result?.nodeId === nodeId ? result : null, loading = !current || current.limit !== limit;
  return <section className="workspace-crosswalk" aria-label="NCS와 O*NET 연결">
    <h3>NCS ↔ O*NET</h3>
    {loading && <p role="status">분류 연결을 불러오는 중…</p>}
    {current?.error && <p role="alert">연결을 불러오지 못했어요. <button onClick={() => setRequest({ nodeId, limit, attempt: attempt + 1 })}>다시 시도</button></p>}
    {current?.data && <>
      <p className="workspace-note">탐색용 연결이에요. 보유 역량으로 자동 반영하지 않아요.</p>
      {current.data.items.length ? <ul>{current.data.items.map(item => {
        const other = item.source.scheme === nodeScheme ? item.target : item.source;
        const historical = item.source_freshness !== "CURRENT" || item.catalog_freshness !== "CURRENT";
        return <li key={item.mapping_id} data-historical={historical}>
          <span className="workspace-crosswalk-label">{other.scheme === "ONET" ? "O*NET" : "NCS"} · {other.code}</span><strong>{other.name}</strong>
          <span>{relations[item.relation]} · {statuses[item.status]}{item.review ? ` · ${item.review.reviewer_kind === "HUMAN" ? "사람" : "보조"} 검토` : ""}</span>
          <small>원문 {freshnessLabel(item.source_freshness)} · 분류 {freshnessLabel(item.catalog_freshness)}</small>
          <small>{bases[item.basis]}{typeof item.evidence.shared_postings === "number" && Number.isSafeInteger(item.evidence.shared_postings) && item.evidence.shared_postings >= 0 ? ` · 공고 ${item.evidence.shared_postings}건` : ""}</small>
          {item.status === "PROPOSED" && item.relation !== "RELATED" && <small>대응 범위는 아직 검토되지 않았어요.</small>}
          <div className="workspace-crosswalk-actions">{item.status !== "REJECTED" && <button onClick={onExpand} disabled={busy}>지도에서 보기</button>}
            {other.kind.endsWith("occupation") && <Link to={postingsHref({ occupation: other.code })}>연결 공고 ↗</Link>}</div>
          <details><summary>연결 근거와 버전</summary><p>{item.review?.note || (item.status === "PROPOSED" ? "개별 검토 전인 제안이에요." : "검토 설명이 제공되지 않았어요.")}</p><dl>
            {item.version && <div><dt>연결 규칙 버전</dt><dd>{item.version}</dd></div>}
            {typeof item.evidence.source_quote === "string" && item.evidence.source_quote && <div><dt>NCS 원문</dt><dd><q>{item.evidence.source_quote.slice(0, 600)}</q></dd></div>}
            {typeof item.evidence.target_quote === "string" && item.evidence.target_quote && <div><dt>O*NET 원문</dt><dd><q>{item.evidence.target_quote.slice(0, 600)}</q></dd></div>}
            <div><dt>NCS 기준</dt><dd>{item.source.catalog_pin || "미확인"}</dd></div><div><dt>O*NET 기준</dt><dd>{item.target.catalog_pin || "미확인"}</dd></div>
            {item.review && <div><dt>검토자</dt><dd>{item.review.reviewer}</dd></div>}
            {item.review && <div><dt>검토 시각</dt><dd>{formatPostingDateTime(item.review.reviewed_at)}</dd></div>}
          </dl></details>
        </li>;
      })}</ul> : <p>아직 연결된 분류가 없어요.</p>}
      {current.data.total > current.data.items.length && <p>{current.data.items.length} / {current.data.total}개
        {limit < 100 && <button disabled={loading} onClick={() => setRequest({ nodeId, limit: Math.min(100, limit + 6), attempt: 0 })}>더 불러오기</button>}</p>}
    </>}
  </section>;
}
