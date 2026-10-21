import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "../../components/AppSidebar";
import { postingDeadlineLabel, postingSourceName, resourcesApi } from "../../services/resourcesApi";
import type { OccupationContextResponse, PostingsResponse } from "../../services/resourcesApi";
import { localToday } from "../../services/skillDetail";
import { AssociationProvenance, AssociationStatus, ContextSummary } from "./OccupationContext";
import { PostingDetail } from "./PostingDetail";
import { PostingsPagination } from "./PostingsPagination";
import "../Home/Home.css";
import "./Postings.css";
import "./OccupationContext.css";

const PAGE_SIZE = 20;
export function Postings() {
  const [params, setParams] = useSearchParams();
  const occupation = params.get("occupation") || "";
  const q = params.get("q") || "";
  const category = params.get("ncs_category") || "";
  const region = params.get("region") || "";
  const openOn = params.get("open_on") || "";
  const rawOffset = Number(params.get("offset") || "0");
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset / PAGE_SIZE) * PAGE_SIZE : 0;
  const postingId = params.get("posting");
  const [draft, setDraft] = useState({ q, category, region, openOn });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: PostingsResponse; context?: OccupationContextResponse; error?: string } | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const pageChanged = useRef(false);
  const key = JSON.stringify([occupation, q, category, region, openOn, offset, attempt]);
  useEffect(() => { setDraft({ q, category, region, openOn }); }, [q, category, region, openOn]);
  useEffect(() => {
    let active = true;
    const load = occupation
      ? resourcesApi.occupationContext(occupation, PAGE_SIZE, offset).then(context => ({
        data: { sources: [], items: context.items.flatMap(item => item.posting ? [item.posting] : []), total: context.total, limit: context.limit, offset: context.offset } as PostingsResponse, context,
      }))
      : resourcesApi.postings({ q, ncs_category: category, region, open_on: openOn, offset, limit: PAGE_SIZE }).then(data => ({ data, context: undefined }));
    load.then(
      ({ data, context }) => {
        if (!active) return;
        const lastOffset = Math.max(0, Math.ceil(data.total / PAGE_SIZE) - 1) * PAGE_SIZE;
        if (offset > lastOffset) {
          setParams(previous => {
            const next = new URLSearchParams(previous);
            if (lastOffset) next.set("offset", String(lastOffset)); else next.delete("offset");
            next.delete("posting");
            return next;
          }, { replace: true });
        } else setResult({ key, data, context });
      },
      () => { if (active) setResult({ key, error: "채용공고를 불러오지 못했어요. 필터를 확인하거나 다시 시도해 주세요." }); },
    );
    return () => { active = false; };
  }, [key, occupation, q, category, region, openOn, offset]);
  const current = result?.key === key ? result : null;
  useEffect(() => {
    if (!current?.data || !pageChanged.current) return;
    pageChanged.current = false;
    listHeading.current?.focus({ preventScroll: true });
    listHeading.current?.scrollIntoView?.({ block: "start", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [current]);
  function search(event: FormEvent) {
    event.preventDefault();
    applyFilters(draft.openOn);
  }
  function applyFilters(openOn: string) {
    const next = new URLSearchParams();
    for (const [field, value] of Object.entries({ q: draft.q.trim(), ncs_category: draft.category.trim(), region: draft.region.trim(), open_on: openOn })) if (value) next.set(field, value);
    setParams(next);
  }
  function update(field: string, value: string | null) {
    const next = new URLSearchParams(params); if (value) next.set(field, value); else next.delete(field); setParams(next);
  }
  function changePage(page: number) {
    const nextOffset = (page - 1) * PAGE_SIZE;
    if (nextOffset === offset) return;
    const next = new URLSearchParams(params);
    if (nextOffset) next.set("offset", String(nextOffset)); else next.delete("offset");
    next.delete("posting");
    pageChanged.current = true;
    setParams(next);
  }
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const selectedAssociations = current?.context?.items.filter(association => association.posting?.posting_id === postingId) ?? [];
  const selectedPosting = selectedAssociations[0]?.posting ?? undefined;
  return <div className="home-layout postings-page">
    <AppSidebar />
    <div className="main-area">
      <header className="main-header"><h1 className="main-title">채용공고</h1></header>
      <main className="postings-content">
        <form className="postings-filters" onSubmit={search} aria-label="채용공고 검색">
          <label className="postings-search">공고·기관 검색<input value={draft.q} onChange={event => setDraft({ ...draft, q: event.target.value })} placeholder="공고명 또는 기관명" maxLength={200} /></label>
          <label>NCS 분야 코드<input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} placeholder="예: 200102" pattern="[0-9]*" maxLength={20} inputMode="numeric" /></label>
          <label>근무 지역<input value={draft.region} onChange={event => setDraft({ ...draft, region: event.target.value })} placeholder="예: 서울" maxLength={100} /></label>
          <label>접수 기간에 포함할 날짜<input type="date" value={draft.openOn} onChange={event => setDraft({ ...draft, openOn: event.target.value })} /></label>
          <button className="postings-primary" type="submit">검색</button>
          <button className="postings-secondary" type="button" onClick={() => applyFilters(localToday())}>오늘 기준</button>
          <button className="postings-reset" type="button" onClick={() => setParams({})}>초기화</button>
        </form>
        {occupation && <section className="occupation-context-banner" aria-label="직무 추론 연결 공고"><h2>직무 추론 연결 공고</h2><p>직무 {occupation} 연결 공고 · 검색 시 일반 공고 검색으로 전환돼요.</p>{current?.context && <ContextSummary data={current.context} />}<button className="postings-secondary" onClick={() => setParams({})}>일반 공고 검색으로 전환</button></section>}
        <p className="postings-note">{occupation ? "과거·미확인 연결이 포함될 수 있어요. 연결 상태를 확인해 주세요." : "잡코리아 우선 · 수집된 접수 기간 기준. 현재 모집 여부는 공고 원문을 확인해 주세요."}</p>
        <div className={`postings-grid${postingId ? " postings-grid--selected" : ""}`}>
          <section className="postings-list" aria-label="채용공고 목록" aria-busy={!current}>
            {!current ? <p className="postings-state" role="status">공고를 불러오는 중이에요…</p>
              : current.error ? <div className="postings-state" role="alert"><p>{current.error}</p><button onClick={() => setAttempt(value => value + 1)}>다시 시도</button></div>
              : current.data && <>
                <div className="postings-list-heading"><h2 ref={listHeading} tabIndex={-1}>{occupation ? "직무 추론 연결" : "검색 결과"} <span>{current.data.total.toLocaleString()}건</span></h2><small>{offset + (current.data.items.length ? 1 : 0)}–{offset + current.data.items.length}</small></div>
                <PostingsPagination total={current.data.total} page={page} pageSize={PAGE_SIZE} position="top" onChange={changePage} />
                {current.data.items.length ? current.data.items.map((item, index) => <button className={`posting-card${postingId === item.posting_id ? " posting-card--selected" : ""}`} key={`${item.posting_id}:${index}`} aria-pressed={postingId === item.posting_id} onClick={() => update("posting", item.posting_id)}>
                  <span className="posting-card-header"><span className="posting-card-org">{item.organization_name || "기관명 미제공"}</span>{item.source_id && <span className="posting-card-source">{postingSourceName(item.source_id)}</span>}</span>
                  <strong>{item.title || "제목 미제공 공고"}</strong>
                  <span>{[item.regions.join(" · "), item.employment_types.join(" · ")].filter(Boolean).join(" / ") || "지역·고용 형태 미제공"}</span>
                  <small>{postingDeadlineLabel(item)}</small>
                  {current.context && current.context.items.filter(association => association.posting?.posting_id === item.posting_id).map(association => <AssociationStatus key={association.association_id} item={association} />)}
                </button>) : <p className="postings-state">조건에 맞는 수집 공고가 없어요. 다른 검색어나 날짜로 찾아보세요.</p>}
                <PostingsPagination total={current.data.total} page={page} pageSize={PAGE_SIZE} position="bottom" onChange={changePage} />
                {current.context?.items.some(association => !association.posting) && <p className="postings-note">일부 연결 공고는 현재 원문 정보를 제공하지 않아 목록에 표시되지 않아요.</p>}
                {current.data.sources.map(source => <p className="postings-source" key={`${source.source_id}:${source.run_id}`}>{postingSourceName(source.source_id)}{source.data_as_of ? ` · 데이터 반영 ${source.data_as_of.slice(0, 10)}` : " · 데이터 반영일 미제공"}</p>)}
              </>}
          </section>
          {postingId && <section className="postings-detail-panel" aria-label="선택한 공고"><button className="postings-close" onClick={() => update("posting", null)}>상세 닫기 ×</button>{occupation && !current ? <p role="status">공고 정보를 불러오는 중이에요…</p> : <PostingDetail key={postingId} postingId={postingId} posting={selectedPosting} />}{!!selectedAssociations.length && <AssociationProvenance items={selectedAssociations} />}</section>}
        </div>
      </main>
    </div>
  </div>;
}
