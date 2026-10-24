import { useEffect, useState } from "react";
import { formatPostingDateTime, postingDeadlineLabel, postingSourceName, resourcesApi, safeSourceUrl } from "../../services/resourcesApi";
import type { PostingItem, PostingResponse } from "../../services/resourcesApi";
import { peekPostingsCache, readPostingsCache } from "../../services/postingsCache";
import { PostingClassifications } from "./PostingClassifications";

export function PostingDetail({ postingId, posting }: { readonly postingId: string; readonly posting?: PostingItem }) {
  const [result, setResult] = useState<{ id: string; data?: PostingResponse; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cacheKey = JSON.stringify(["posting-detail", postingId]);
  useEffect(() => {
    if (posting?.occupation_associations !== undefined) return;
    let active = true;
    readPostingsCache(cacheKey, () => resourcesApi.posting(postingId)).then(data => { if (active) setResult({ id: postingId, data }); }, error => {
      if (active) setResult({ id: postingId, error: (error as { status?: number }).status === 404 ? "이 공고는 현재 수집 데이터에서 찾을 수 없어요." : "공고 상세를 불러오지 못했어요." });
    });
    return () => { active = false; };
  }, [postingId, attempt, posting]);
  const saved = peekPostingsCache<PostingResponse>(cacheKey);
  const loaded = result?.id === postingId ? result : saved ? { id: postingId, data: saved, error: undefined } : null;
  const current = posting ? { id: postingId, data: { item: { ...posting, occupation_associations: posting.occupation_associations ?? loaded?.data?.item.occupation_associations }, sources: [] }, error: undefined } : loaded;
  if (!current) return <p role="status">공고 상세를 불러오는 중이에요…</p>;
  if (current.error || !current.data) return <div role="alert"><p>{current.error}</p><button type="button" onClick={() => { setResult(null); setAttempt(value => value + 1); }}>다시 시도</button></div>;
  const { item } = current.data;
  const sources = item.source_provenance ? [item.source_provenance] : [];
  const sourceUrl = safeSourceUrl(item.source_url);
  const fields = [
    ["기관", item.organization_name], ["접수 시작", item.application_start_at ? formatPostingDateTime(item.application_start_at) : item.application_start_date], ["접수 마감·상태", postingDeadlineLabel(item)], ["공고 게시일", item.date_posted],
    ["원문 상태", item.source_status], ["마감 방식", item.deadline_kind], ["마감 판단 근거", item.deadline_basis], ["상시 모집 판단 근거", item.ongoing_basis],
    ["근무 지역", item.regions.join(" · ")], ["고용 형태", item.employment_types.join(" · ")],
    ["채용 구분", item.recruitment_type], ["학력", item.education], ["채용 인원", item.headcount != null ? `${item.headcount}명` : null],
    ["NCS 분야 · 원문", item.ncs_categories.map(category => category.name && category.code ? `${category.name} (${category.code})` : category.name || category.code).filter(Boolean).join(" · ") || "원문에 분류 없음"],
  ];
  return <article className="posting-detail" aria-label="채용공고 상세">
    <h2>{item.title || "제목 미제공 공고"}</h2>
    <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "제공되지 않음"}</dd></div>)}</dl>
    <PostingClassifications items={item.occupation_associations} pending={!!posting && posting.occupation_associations === undefined && !loaded} unavailable={!!posting && posting.occupation_associations === undefined && !!loaded?.error} />
    <p className="postings-note">현재 접수 여부·업무·지원 자격은 원문을 확인해 주세요.</p>
    {sources.map(source => <p className="postings-source" key={`${source.source_id}:${source.run_id}`}>{postingSourceName(source.source_id)}{source.data_as_of ? ` · 데이터 반영 ${source.data_as_of.slice(0, 10)}` : " · 데이터 반영일 미제공"}{source.run_id && <span className="posting-run-id"> · 수집 실행 {source.run_id}</span>}</p>)}
    {!sources.length && <p className="postings-source">이 공고의 수집 기준 정보가 제공되지 않았어요.</p>}
    {sourceUrl ? <a className="postings-primary" href={sourceUrl} target="_blank" rel="noopener noreferrer">공고 원문 보기 ↗</a> : <p className="postings-note">원문 링크가 제공되지 않았어요.</p>}
  </article>;
}
