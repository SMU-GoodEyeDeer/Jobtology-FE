import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";

interface Props {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly position: "top" | "bottom";
  readonly onChange: (page: number) => void;
}

export function PostingsPagination({ total, page, pageSize, position, onChange }: Props) {
  const pages = Math.ceil(total / pageSize);
  const [destination, setDestination] = useState(String(page));
  const inputId = useId();
  useEffect(() => { setDestination(String(page)); }, [page]);
  if (!pages) return null;
  const windowStart = Math.max(1, Math.min(page - 1, pages - 2));
  const visible = Array.from(new Set([1, windowStart, windowStart + 1, windowStart + 2, pages]))
    .filter(value => value >= 1 && value <= pages).sort((a, b) => a - b);
  const label = position === "top" ? "상단" : "하단";
  function jump(event: FormEvent) {
    event.preventDefault();
    const value = Number(destination);
    if (Number.isSafeInteger(value) && value >= 1 && value <= pages) onChange(value);
  }
  return <nav className="postings-pagination" aria-label={`공고 페이지 (${label})`}>
    <p className="postings-page-count"><strong>{page.toLocaleString()}</strong> / {pages.toLocaleString()}페이지 <span>· {pageSize}개씩</span></p>
    <div className="postings-page-controls">
      <button type="button" aria-label="이전 페이지" disabled={page <= 1} onClick={() => onChange(page - 1)}><span aria-hidden="true">‹</span><span className="postings-page-direction">이전</span></button>
      <div className="postings-page-numbers">{visible.map((number, index) => <span className="postings-page-slot" key={number}>
        {index > 0 && number - visible[index - 1] > 1 && <span className="postings-page-gap" aria-hidden="true">…</span>}
        <button type="button" aria-label={`${number}페이지`} aria-current={number === page ? "page" : undefined} onClick={() => onChange(number)}>{number.toLocaleString()}</button>
      </span>)}</div>
      <button type="button" aria-label="다음 페이지" disabled={page >= pages} onClick={() => onChange(page + 1)}><span className="postings-page-direction">다음</span><span aria-hidden="true">›</span></button>
    </div>
    <form className="postings-page-jump" onSubmit={jump} aria-label={`공고 페이지 바로 이동 (${label})`}>
      <label htmlFor={inputId}>페이지 이동</label>
      <input id={inputId} type="number" inputMode="numeric" min="1" max={pages} step="1" required value={destination} onChange={event => setDestination(event.target.value)} />
      <button type="submit">이동</button>
    </form>
  </nav>;
}
