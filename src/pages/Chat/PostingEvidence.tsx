import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { postingsHref, resourcesApi } from "../../services/resourcesApi";
import type { PostingsResponse } from "../../services/resourcesApi";

export function PostingEvidence({ category }: { readonly category: string | null | undefined }) {
  const [result, setResult] = useState<{ category: string; data?: PostingsResponse; error?: boolean } | null>(null);
  useEffect(() => {
    if (!category) return;
    let active = true;
    resourcesApi.postings({ ncs_category: category, limit: 3 }).then(data => {
      if (active) setResult({ category, data });
    }, () => { if (active) setResult({ category, error: true }); });
    return () => { active = false; };
  }, [category]);
  const current = result?.category === category ? result : null;
  if (!category) return <><p className="node-popup-desc">이 공고 묶음에는 검색 가능한 분야 코드가 제공되지 않았어요.</p><Link className="node-popup-link" to="/postings">채용공고에서 검색하기 →</Link></>;
  return <section className="node-postings" aria-label="연결된 실제 채용공고">
    <p className="node-popup-desc">직무 분야의 수집 공고예요. 그래프의 과거 집계와 현재 수집 목록은 다를 수 있어요.</p>
    {!current ? <p className="node-popup-desc" role="status">공고를 불러오는 중…</p> : current.error ? <p className="node-popup-desc" role="alert">현재 공고 목록을 불러오지 못했어요.</p> : current.data?.items.length ? current.data.items.map(item => <Link className="node-posting-card" key={item.posting_id} to={postingsHref({ ncs_category: category }, item.posting_id)}>
      <small>{item.organization_name || "기관명 미제공"}</small><strong>{item.title || "제목 미제공 공고"}</strong><span>{item.closing_date ? `접수 마감일 ${item.closing_date}` : "접수 마감일 미제공"}</span><span>공고 상세 보기 →</span>
    </Link>) : <p className="node-popup-desc">현재 수집 목록에는 해당 분야의 공고가 없어요.</p>}
    <Link className="node-popup-link" to={postingsHref({ ncs_category: category })}>이 분야 채용공고 모두 보기 →</Link>
  </section>;
}
