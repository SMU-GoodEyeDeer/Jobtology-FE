import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "../../components/AppSidebar";
import { resourcesApi } from "../../services/resourcesApi";
import type { PostingsResponse } from "../../services/resourcesApi";
import { localToday } from "../../services/skillDetail";
import { PostingDetail } from "./PostingDetail";
import "../Home/Home.css";
import "./Postings.css";

const PAGE_SIZE = 20;
export function Postings() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("ncs_category") || "";
  const region = params.get("region") || "";
  const openOn = params.get("open_on") || "";
  const rawOffset = Number(params.get("offset") || "0");
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const postingId = params.get("posting");
  const [draft, setDraft] = useState({ q, category, region, openOn });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: PostingsResponse; error?: string } | null>(null);
  const key = JSON.stringify([q, category, region, openOn, offset, attempt]);
  useEffect(() => { setDraft({ q, category, region, openOn }); }, [q, category, region, openOn]);
  useEffect(() => {
    let active = true;
    resourcesApi.postings({ q, ncs_category: category, region, open_on: openOn, offset, limit: PAGE_SIZE }).then(
      data => { if (active) setResult({ key, data }); },
      () => { if (active) setResult({ key, error: "채용공고를 불러오지 못했어요. 필터를 확인하거나 다시 시도해 주세요." }); },
    );
    return () => { active = false; };
  }, [key, q, category, region, openOn, offset]);
  const current = result?.key === key ? result : null;
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
  return <div className="home-layout postings-page">
    <AppSidebar />
    <div className="main-area">
      <header className="main-header"><h1 className="main-title">채용공고</h1><span className="postings-header-caption">직무와 역량의 실제 근거를 살펴보세요</span></header>
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
        <p className="postings-note">수집된 공고를 보여드려요. 날짜 필터는 수집된 접수 기간 기준이며, 실제 모집 여부는 공고 원문을 확인해 주세요.</p>
        <div className={`postings-grid${postingId ? " postings-grid--selected" : ""}`}>
          <section className="postings-list" aria-label="채용공고 목록" aria-busy={!current}>
            {!current ? <p className="postings-state" role="status">공고를 불러오는 중이에요…</p>
              : current.error ? <div className="postings-state" role="alert"><p>{current.error}</p><button onClick={() => setAttempt(value => value + 1)}>다시 시도</button></div>
              : current.data && <>
                <div className="postings-list-heading"><h2>검색 결과 <span>{current.data.total.toLocaleString()}건</span></h2><small>{offset + (current.data.items.length ? 1 : 0)}–{offset + current.data.items.length}</small></div>
                {current.data.items.length ? current.data.items.map(item => <button className={`posting-card${postingId === item.posting_id ? " posting-card--selected" : ""}`} key={item.posting_id} aria-pressed={postingId === item.posting_id} onClick={() => update("posting", item.posting_id)}>
                  <span className="posting-card-org">{item.organization_name || "기관명 미제공"}</span>
                  <strong>{item.title || "제목 미제공 공고"}</strong>
                  <span>{[item.regions.join(" · "), item.employment_types.join(" · ")].filter(Boolean).join(" / ") || "지역·고용 형태 미제공"}</span>
                  <small>{item.closing_date ? `접수 마감일 ${item.closing_date}` : "접수 마감일 미제공"}</small>
                </button>) : <p className="postings-state">조건에 맞는 수집 공고가 없어요. 다른 검색어나 날짜로 찾아보세요.</p>}
                <nav className="postings-pagination" aria-label="공고 페이지"><button disabled={offset === 0} onClick={() => update("offset", String(Math.max(0, offset - PAGE_SIZE)))}>이전</button><span>{Math.floor(offset / PAGE_SIZE) + 1}페이지</span><button disabled={offset + current.data.items.length >= current.data.total} onClick={() => update("offset", String(offset + PAGE_SIZE))}>다음</button></nav>
                {current.data.sources.map(source => <p className="postings-source" key={`${source.source_id}:${source.run_id}`}>{source.source_id}{source.data_as_of ? ` · 수집 기준 ${source.data_as_of.slice(0, 10)}` : " · 수집 기준일 미제공"}</p>)}
              </>}
          </section>
          {postingId && <section className="postings-detail-panel" aria-label="선택한 공고"><button className="postings-close" onClick={() => update("posting", null)}>상세 닫기 ×</button><PostingDetail key={postingId} postingId={postingId} /></section>}
        </div>
      </main>
    </div>
  </div>;
}
