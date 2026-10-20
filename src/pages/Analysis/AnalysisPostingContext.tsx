import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { postingsHref, resourcesApi } from "../../services/resourcesApi";
import type { OccupationContextResponse } from "../../services/resourcesApi";
import { AssociationStatus, ContextSummary } from "../Postings/OccupationContext";
import "../Postings/OccupationContext.css";

export function AnalysisPostingContext({ occupationId }: { readonly occupationId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ id: string; data?: OccupationContextResponse; error?: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    resourcesApi.rolePostingContext(occupationId, 3).then(data => { if (active) setResult({ id: occupationId, data }); }, () => { if (active) setResult({ id: occupationId, error: true }); });
    return () => { active = false; };
  }, [occupationId, attempt]);
  const current = result?.id === occupationId ? result : null;
  const codes = current?.data?.filters.occupation_codes?.join(",");
  return <section className="an-posting-context occupation-context-banner" aria-label="목표 직무 추론 연결 공고">
    <h3>목표 직무와 연결된 공고 <span>모델 추론</span></h3>
    {!current ? <p role="status">직무 연결 공고를 불러오는 중이에요…</p> : current.error || !current.data ? <p>직무 연결 공고를 불러오지 못했어요. <button onClick={() => { setResult(null); setAttempt(value => value + 1); }}>다시 시도</button></p> : <>
      <ContextSummary data={current.data} />
      {!!current.data.items.length && <ul className="an-context-samples">{current.data.items.map(item => <li key={item.association_id}>{item.posting ? <Link to={postingsHref({ occupation: codes }, item.posting.posting_id)}>{item.posting.title || "제목 미제공 공고"} · {item.posting.organization_name || "기관명 미제공"}</Link> : <span>공고 원문 정보 미제공</span>}<AssociationStatus item={item} /></li>)}</ul>}
      {codes && <Link className="an-context-link" to={postingsHref({ occupation: codes })}>직무 연결 공고 모두 보기 →</Link>}
    </>}
  </section>;
}
