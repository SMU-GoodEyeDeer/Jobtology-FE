import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { postingDeadlineLabel, postingsHref, resourcesApi } from "../../services/resourcesApi";
import type { OccupationContextResponse } from "../../services/resourcesApi";
import { AssociationStatus } from "../Postings/OccupationContext";
import "../Postings/OccupationContext.css";

export function PostingEvidence({ occupation }: { readonly occupation: string | null | undefined }) {
  const [result, setResult] = useState<{ occupation: string; data?: OccupationContextResponse; error?: boolean } | null>(null);
  useEffect(() => {
    if (!occupation) return;
    let active = true;
    resourcesApi.occupationContext(occupation, 3).then(data => {
      if (active) setResult({ occupation, data });
    }, () => { if (active) setResult({ occupation, error: true }); });
    return () => { active = false; };
  }, [occupation]);
  const current = result?.occupation === occupation ? result : null;
  if (!occupation) return <><p className="node-popup-desc">이 연결에는 조회할 직무 코드가 제공되지 않았어요.</p><Link className="node-popup-link" to="/postings">채용공고에서 검색하기 →</Link></>;
  return <section className="node-postings" aria-label="연결된 실제 채용공고">
    <p className="node-popup-desc">메타데이터로 추론한 직무 연결이에요. 역량 요구나 보유 역량의 근거로 반영하지 않아요.</p>
    {!current ? <p className="node-popup-desc" role="status">공고를 불러오는 중…</p> : current.error ? <p className="node-popup-desc" role="alert">연결된 공고를 불러오지 못했어요.</p> : current.data?.items.length ? current.data.items.map(association => association.posting ? <Link className="node-posting-card" key={association.association_id} to={postingsHref({ occupation }, association.posting.posting_id)}>
      <small>{association.posting.organization_name || "기관명 미제공"}</small><strong>{association.posting.title || "제목 미제공 공고"}</strong><AssociationStatus item={association} /><span>{postingDeadlineLabel(association.posting)}</span><span>공고 상세 보기 →</span>
    </Link> : <p key={association.association_id} className="node-popup-desc">연결된 공고의 원문 정보가 현재 제공되지 않아요.</p>) : <p className="node-popup-desc">현재 이 직무와 연결된 수집 공고가 없어요.</p>}
    <Link className="node-popup-link" to={postingsHref({ occupation })}>이 직무의 추론 연결 공고 모두 보기 →</Link>
  </section>;
}
