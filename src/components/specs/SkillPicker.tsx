import { useEffect, useId, useState } from "react";
import { skillsApi } from "../../services/api";
import type { MatchedCompetency, SkillSearchResponse } from "../../services/types";

interface Props {
  readonly occupationId?: string | null;
  readonly selected: MatchedCompetency[];
  readonly disabled?: boolean;
  readonly onChange: (items: MatchedCompetency[]) => void;
}
export function SkillPicker({ occupationId, selected, disabled, onChange }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [targetOnly, setTargetOnly] = useState(Boolean(occupationId));
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([query.trim(), targetOnly ? occupationId : null, attempt]);
  const [result, setResult] = useState<{ key: string; data?: SkillSearchResponse; error?: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      skillsApi.search({ q: query.trim(), ...(targetOnly && occupationId ? { occupation_id: occupationId } : {}), limit: 20 }).then(
        data => { if (active) setResult({ key, data }); }, () => { if (active) setResult({ key, error: true }); },
      );
    }, query.trim() ? 200 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [key, query, targetOnly, occupationId]);
  const current = result?.key === key ? result : null;
  return <fieldset className="spec-picker" disabled={disabled}>
    <legend className="spec-sr-only">연결할 역량</legend>
    <label htmlFor={id}>역량 검색</label>
    <input id={id} type="search" value={query} maxLength={200} placeholder="예: SQL, 데이터 분석, 프로그래밍" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault(); }} />
    {occupationId && <label className="spec-check"><input type="checkbox" checked={targetOnly} onChange={event => setTargetOnly(event.target.checked)} />현재 목표의 NCS 역량 우선</label>}
    {!!selected.length && <ul className="spec-selected" aria-label="선택한 역량">{selected.map(item => <li key={item.entity_id}><span>{item.label}</span><button type="button" aria-label={`${item.label} 선택 해제`} onClick={() => onChange(selected.filter(value => value.entity_id !== item.entity_id))}>×</button></li>)}</ul>}
    <div className="spec-search-results" aria-busy={!current}>
      {!current ? <p className="spec-help" role="status">역량을 찾는 중이에요…</p>
        : current.error ? <div className="spec-error" role="alert">역량 목록을 불러오지 못했어요. <button type="button" onClick={() => setAttempt(value => value + 1)}>다시 검색</button></div>
        : current.data && <>
          <p className="spec-source-note">검색 가능한 자료: {current.data.available_sources.map(source => source === "ONET" ? "O*NET" : source).join(" · ") || "없음"}. NCS는 직무 능력단위, O*NET은 일반 업무 역량으로 서로 다른 기준이에요.</p>
          {!current.data.available_sources.includes("ONET") && <p className="spec-help">현재 O*NET 검색 자료는 연결되어 있지 않아요.</p>}
          {current.data.items.length ? current.data.items.map(item => {
            const checked = selected.some(value => value.entity_id === item.entity_id);
            return <label className="spec-skill-option" key={item.entity_id}><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 12} onChange={() => onChange(checked ? selected.filter(value => value.entity_id !== item.entity_id) : [...selected, item])} /><span><strong>{item.label}</strong><small>{item.source === "ONET" ? "O*NET" : "NCS"}{item.ncs_level != null ? ` · ${item.ncs_level}수준` : ""}{item.original_label !== item.label ? ` · ${item.original_label}` : ""}</small>{!!item.aliases.length && <small>검색 별칭 · {item.aliases.slice(0, 3).join(" · ")}</small>}</span></label>;
          }) : <p className="spec-help">일치하는 역량이 없어요. 다른 검색어를 쓰거나 아래의 경험 설명 기능을 이용해 주세요.</p>}
          {current.data.total > current.data.items.length && <p className="spec-help">검색 결과 {current.data.total}개 중 {current.data.items.length}개예요. 검색어를 더 구체적으로 입력해 주세요.</p>}
          {current.data.available_sources.includes("ONET") && <p className="spec-source-note"><a href="https://www.onetcenter.org/license_db.html" target="_blank" rel="noopener noreferrer">O*NET® 31.0 · USDOL/ETA · CC BY 4.0</a><br />한국어 이름은 Jobtology 번역이며 공식 번역이 아니에요.</p>}
        </>}
    </div>
  </fieldset>;
}
