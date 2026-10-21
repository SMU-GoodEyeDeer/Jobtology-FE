import { useId, useState } from "react";
import type { FormEvent } from "react";
import { chatApi } from "../../services/api";
import type { CapabilityDetailResponse, CapabilityWrite, ChatCapabilityCandidate } from "../../services/types";
import { SkillPicker } from "./SkillPicker";
import { PROFICIENCIES, SPEC_CATEGORIES, specDraft, specPayload, suggestedCategory } from "./specModel";
import type { SpecDraft } from "./specModel";
import { RESUME_FIELDS } from "../resume/resumeModel";

interface Props {
  readonly item?: CapabilityDetailResponse | null;
  readonly candidate?: ChatCapabilityCandidate | null;
  readonly initialDraft?: SpecDraft;
  readonly occupationId?: string | null;
  readonly busy?: boolean;
  readonly canSave?: boolean;
  readonly error?: string | null;
  readonly onSave: (value: CapabilityWrite) => Promise<void>;
  readonly onCancel: () => void;
}
export function SpecEditor({ item, candidate, initialDraft, occupationId, busy, canSave = true, error, onSave, onCancel }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(() => initialDraft ?? specDraft(item, candidate));
  const [validation, setValidation] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [description, setDescription] = useState(draft.evidence);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ChatCapabilityCandidate[] | null>(null);
  const [reply, setReply] = useState("");
  const disabled = busy || aiBusy;
  function change<K extends keyof SpecDraft>(field: K, value: SpecDraft[K]) {
    setDraft(previous => ({ ...previous, [field]: value })); setValidation(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || !canSave) return;
    let value: CapabilityWrite;
    try { value = specPayload(draft); } catch (cause) { setValidation((cause as Error).message); return; }
    await onSave(value);
  }
  async function openAi() {
    setAiOpen(true); setAiError(null); setAiBusy(true);
    try {
      const status = await chatApi.status(); setAiAvailable(status.available);
      if (!status.available) setAiError("지금은 AI 도움을 연결할 수 없어요. 역량 검색과 직접 입력은 계속 이용할 수 있어요.");
    } catch { setAiAvailable(false); setAiError("AI 연결 상태를 확인하지 못했어요. 직접 검색하거나 잠시 후 다시 시도해 주세요."); }
    finally { setAiBusy(false); }
  }
  async function suggest() {
    if (!description.trim() || disabled) return;
    setAiBusy(true); setAiError(null); setSuggestions(null);
    try {
      const response = await chatApi.send([{ role: "user", text: description.trim() }], "spec");
      setReply(response.reply); setSuggestions(response.candidates);
    } catch (cause) {
      setAiError((cause as { status?: number }).status === 429 ? "AI 요청 한도에 도달했어요. 잠시 후 다시 시도하거나 직접 검색해 주세요." : "경험에서 역량을 찾지 못했어요. 직접 검색하거나 잠시 후 다시 시도해 주세요.");
    } finally { setAiBusy(false); }
  }
  function accept(suggestion: ChatCapabilityCandidate) {
    if (draft.selected.length >= 12 && !draft.selected.some(value => value.entity_id === suggestion.entity_id)) { setValidation("연결할 역량은 최대 12개까지 선택할 수 있어요."); return; }
    setDraft(previous => ({ ...previous,
      category: suggestedCategory(suggestion) ?? previous.category,
      title: previous.title || suggestion.label,
      selected: previous.selected.some(value => value.entity_id === suggestion.entity_id) ? previous.selected : [...previous.selected, { entity_id: suggestion.entity_id, label: suggestion.label, requirement_keys: [] }],
      evidence: previous.evidence || description.trim() || suggestion.evidence_quote,
      source: previous.document_evidence ? "DOCUMENT_IMPORT" : "LLM_ASSISTED",
    }));
  }
  const information = draft.category === "education" || draft.category === "other";
  const datedExperience = draft.category === "project" || draft.category === "experience" || draft.category === "education";
  const credential = draft.category === "certification" || draft.category === "test";
  return <form className={`spec-editor${information ? " spec-editor--information" : ""}`} onSubmit={event => void submit(event)} aria-labelledby={`${id}-title`}>
    <h3 className="spec-sr-only" id={`${id}-title`}>{item ? "스펙 수정" : "스펙 추가"}</h3>
    {candidate && <p className="spec-notice">AI가 제안한 내용을 가져왔어요. 역량과 근거, 수행 수준을 직접 검토한 뒤 저장해 주세요.</p>}
    {draft.document_evidence && <div className="spec-import-evidence"><strong>이력서 원문 근거 · 본인 확인 필요</strong><blockquote>{draft.document_evidence.quote}</blockquote><p className="spec-help">키워드나 AI 제안은 실력·자격을 검증하지 않아요. 종류, 역량, 근거와 수행 수준을 확인해 주세요. 원문 인용은 저장한 스펙과 함께 남아요.</p></div>}
    {!!Object.keys(draft.imported_fields ?? {}).length && <details className="spec-explainer"><summary>원문에서 읽은 필드</summary><dl className="resume-fields">{Object.entries(draft.imported_fields ?? {}).map(([name, value]) => <div key={name}><dt>{RESUME_FIELDS[name] ?? name}</dt><dd>{value}</dd></div>)}</dl><p className="spec-help">연도·월만 있는 날짜는 그대로 보관해요. 아래 날짜 입력에는 원문에 일까지 있는 값만 채웠어요.</p></details>}
    <fieldset className="spec-fields" disabled={disabled}>
      <section className="spec-editor-section spec-editor-search" aria-labelledby={`${id}-skills`}>
      <header className="spec-section-heading"><span>01</span><div><h3 id={`${id}-skills`}>{information ? "어떤 기록인가요?" : "어떤 역량을 사용했나요?"}</h3><p>{information ? "학력·기타 기록은 역량 점수에 자동 반영되지 않아요." : "내 경험에 해당하는 역량을 여러 개 선택할 수 있어요."}</p></div></header>
      <label>스펙 종류<select value={draft.category} onChange={event => change("category", event.target.value as SpecDraft["category"])}>{SPEC_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
      {!information && <>
      <SkillPicker occupationId={occupationId} selected={draft.selected} disabled={disabled} onChange={selected => {
        setDraft(previous => ({ ...previous, selected, title: previous.title || (previous.category === "skill" ? selected[0]?.label ?? "" : "") }));
      }} />
      {draft.selected.some(value => value.unavailable) && <p className="spec-error">현재 카탈로그에서 확인되지 않는 선택이 있어요. 저장 전에 해당 선택을 해제하고 역량을 다시 찾아 주세요.</p>}
      <button type="button" className="spec-text-button" disabled={disabled} onClick={() => void openAi()}>찾는 역량이 없나요? 경험을 설명해서 찾기</button>
      {aiOpen && <section className="spec-ai" aria-label="경험 설명으로 역량 찾기">
        <p className="spec-help">설명은 AI에 전송돼요. 제안은 확인해서 선택해야 하며 자동 저장되지 않아요. 개인정보나 회사의 비공개 정보는 제외해 주세요.</p>
        <label>역량을 찾을 경험 설명<textarea value={description} maxLength={2000} rows={3} onChange={event => setDescription(event.target.value)} placeholder="어떤 일을 했고, 직접 맡은 부분과 결과는 무엇인가요?" /></label>
        {aiAvailable === false ? <button type="button" className="spec-secondary" onClick={() => void openAi()}>AI 연결 다시 확인</button> : <button type="button" className="spec-secondary" disabled={aiAvailable !== true || aiBusy || !description.trim()} onClick={() => void suggest()}>{aiBusy ? "역량 찾는 중…" : "AI로 역량 제안 받기"}</button>}
        {aiBusy && <p className="spec-help" role="status">AI 연결을 확인하거나 경험을 살펴보는 중이에요…</p>}
        {aiError && <p className="spec-error" role="alert">{aiError}</p>}
        {suggestions && <><p className="spec-help">{reply}</p>{suggestions.length ? suggestions.map(suggestion => {
          const selected = draft.selected.some(value => value.entity_id === suggestion.entity_id);
          const category = suggestedCategory(suggestion);
          const accepted = selected && (!category || draft.category === category);
          return <div className="spec-ai-candidate" key={suggestion.entity_id}><strong>{suggestion.label}</strong>{category && <p className="spec-help">추천 종류 · {SPEC_CATEGORIES.find(value => value.value === category)?.label}</p>}<blockquote>“{suggestion.evidence_quote}”</blockquote><button type="button" className="spec-secondary" disabled={accepted} onClick={() => accept(suggestion)}>{accepted ? "선택했어요" : selected ? "확인하고 추천 종류 적용" : "확인하고 이 역량 선택"}</button></div>;
        }) : <p className="spec-help">확인할 수 있는 역량 제안이 없어요. 직접 검색하거나 연결할 역량 없이 보관할 수 있어요.</p>}</>}
      </section>}
      </>}
      </section>
      <section className="spec-editor-section spec-editor-experience" aria-labelledby={`${id}-experience`}>
      <header className="spec-section-heading"><span>02</span><div><h3 id={`${id}-experience`}>{information ? "기록할 정보를 확인해 주세요" : "직접 해낸 경험을 알려 주세요"}</h3><p>{information ? "원문에서 확인한 내용을 보관해요." : "무엇을, 어느 정도로 수행했는지 남겨 주세요."}</p></div></header>
      <label>스펙 제목<input value={draft.title} required maxLength={500} onChange={event => change("title", event.target.value)} placeholder="예: Python 데이터 분석, 정보처리기사, 주문 API 프로젝트" /></label>
      {!information && <label>직접 수행한 수준<select required value={draft.proficiency} onChange={event => change("proficiency", event.target.value as SpecDraft["proficiency"])}><option value="" disabled>직접 수행한 수준을 선택해 주세요</option>{PROFICIENCIES.map(value => <option key={value.value} value={value.value}>{value.label}</option>)}</select></label>}
      {draft.category === "education" && <div className="spec-field-grid"><label>학교<input value={draft.school} maxLength={200} onChange={event => change("school", event.target.value)} /></label><label>전공<input value={draft.major} maxLength={200} onChange={event => change("major", event.target.value)} /></label><label>학위<input value={draft.degree} maxLength={200} onChange={event => change("degree", event.target.value)} /></label></div>}
      <label>수행 내용·근거<textarea value={draft.evidence} maxLength={2000} rows={4} onChange={event => change("evidence", event.target.value)} placeholder="직접 한 일, 사용한 방법, 결과를 구체적으로 적어 주세요." /></label>
      <p className="spec-help spec-evidence-hint">{Array.from(draft.evidence.trim()).length}/2000자 · {information ? "학력·기타 기록은 역량 점수에 자동 반영되지 않아요." : "분석에 반영하려면 목표와 연결된 역량과 20자 이상의 근거가 필요해요."}</p>
      {credential && <div className="spec-field-grid">
        <label>발급·주관 기관<input value={draft.issuer} required={draft.category === "certification"} maxLength={200} onChange={event => change("issuer", event.target.value)} /></label>
        <label>자격·시험 코드<input value={draft.credential_code} maxLength={128} onChange={event => change("credential_code", event.target.value)} /></label>
        <label>발급·응시일<input type="date" value={draft.issued_on} onChange={event => change("issued_on", event.target.value)} /></label>
        <label>만료일<input type="date" value={draft.expires_on} onChange={event => change("expires_on", event.target.value)} /></label>
      </div>}
      {draft.category === "test" && <div className="spec-field-grid">
        <label>점수<input type="number" required min="0" step="any" value={draft.score} onChange={event => change("score", event.target.value)} /></label>
        <label>만점<input type="number" min="0.000001" step="any" value={draft.score_max} onChange={event => change("score_max", event.target.value)} /></label>
        <label>점수 단위<input value={draft.score_unit} maxLength={64} placeholder="예: 점, 등급" onChange={event => change("score_unit", event.target.value)} /></label>
      </div>}
      {datedExperience && <div className="spec-field-grid">
        {draft.category === "experience" && <label>회사·기관<input value={draft.organization} maxLength={200} onChange={event => change("organization", event.target.value)} /></label>}
        {draft.category !== "education" && <label>담당 역할<input value={draft.role} maxLength={200} onChange={event => change("role", event.target.value)} /></label>}
        <label>시작일<input type="date" value={draft.started_on} onChange={event => change("started_on", event.target.value)} /></label>
        <label>종료일<input type="date" disabled={draft.ongoing} value={draft.ongoing ? "" : draft.ended_on} onChange={event => change("ended_on", event.target.value)} /></label>
        <label className="spec-check"><input type="checkbox" checked={draft.ongoing} onChange={event => change("ongoing", event.target.checked)} />현재 진행 중</label>
      </div>}
      <label>자료 링크 (선택)<input type="url" value={draft.url} maxLength={2000} onChange={event => change("url", event.target.value)} placeholder="https://" /></label>
      {!information && <details className="spec-explainer"><summary>수행 수준과 분석 반영 기준</summary><p className="spec-help">수행 수준에 따른 모델 반영 비율은 25%·50%·75%·100%예요. 검증된 실력이나 취업 확률이 아니며, 같은 역량은 가장 높은 근거 하나만 반영해요. 연결 정보나 근거가 없으면 저장만 되고 반영 비율은 0이에요. 실제 목표 반영 여부는 저장 결과에서 확인해 주세요.</p></details>}
      </section>
    </fieldset>
    {(validation || error) && <p className="spec-error" role="alert">{validation || error}</p>}
    <footer className="spec-actions spec-editor-actions"><span className="spec-save-hint">{information ? "정보로 보관하며 역량 점수에는 자동 반영하지 않아요." : `선택한 역량 ${draft.selected.length}/12개 · 저장 후 연결 여부를 확인할 수 있어요.`}</span><button className="spec-secondary" type="button" disabled={disabled} onClick={onCancel}>취소</button><button className="spec-primary" type="submit" disabled={disabled || !canSave}>{busy ? "저장 중…" : "스펙 저장"}</button></footer>
  </form>;
}
