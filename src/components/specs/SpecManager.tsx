import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { capabilitiesApi, profileApi } from "../../services/api";
import type { CapabilityDetailResponse, CapabilityWrite, ChatCapabilityCandidate } from "../../services/types";
import { SpecEditor } from "./SpecEditor";
import { SpecDialog } from "./SpecDialog";
import { SpecDetailsSummary } from "./SpecDetailsSummary";
import { PROFICIENCIES, SPEC_CATEGORIES } from "./specModel";
import type { SpecDraft } from "./specModel";
import { ResumeScanner } from "../resume/ResumeScanner";
import "./Specs.css";

export interface SpecMutationNotice { requestVersion: number; profileVersion: number; message: string }
interface Props {
  readonly searchable?: boolean;
  readonly occupationId?: string | null;
  readonly candidate?: ChatCapabilityCandidate | null;
  readonly disabled?: boolean;
  readonly mutationLock?: MutableRefObject<boolean>;
  readonly onBusyChange?: (busy: boolean) => void;
  readonly onCountChange?: (count: number) => void;
  readonly onMutation?: (result: SpecMutationNotice) => void;
  readonly onEditingChange?: (editing: boolean) => void;
}
const categoryLabel = (category: CapabilityDetailResponse["category"]) => category === "ROADMAP_OUTCOME" ? "로드맵 완료 기록" : SPEC_CATEGORIES.find(value => value.value === category)?.label;
const statusLabels = { MATCHED: "현재 목표와 연결됨", NEEDS_CLARIFICATION: "근거·역량 확인 필요", UNUSED: "현재 목표에 미반영", EXPIRED: "유효기간 만료" };

export function SpecManager({ searchable, occupationId, candidate, disabled, mutationLock, onBusyChange, onCountChange, onMutation, onEditingChange }: Props) {
  const [items, setItems] = useState<CapabilityDetailResponse[]>([]);
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ item: CapabilityDetailResponse | null; candidate?: ChatCapabilityCandidate | null; baseline?: number; initialDraft?: SpecDraft; onSaved?: () => void } | null>(() => candidate ? { item: null, candidate } : null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CapabilityDetailResponse | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const loadGeneration = useRef(0);
  const newKey = useRef<string | null>(null);
  const lastAttempt = useRef<{ payload: string; key: string; version: number } | null>(null);
  const countCallback = useRef(onCountChange); countCallback.current = onCountChange;
  const editingCallback = useRef(onEditingChange); editingCallback.current = onEditingChange;
  useEffect(() => { countCallback.current?.(items.length); }, [items]);
  useEffect(() => { editingCallback.current?.(editor !== null || resumeOpen); }, [editor !== null, resumeOpen]);

  async function load() {
    const generation = ++loadGeneration.current;
    setLoading(true); setError(null);
    try { const response = await capabilitiesApi.list(); if (generation === loadGeneration.current) { setItems(response.items.filter(item => item.lifecycle === "ACTIVE")); setReady(true); } }
    catch { if (generation === loadGeneration.current) setError("스펙을 불러오지 못했어요. 다시 불러온 뒤 수정해 주세요."); }
    finally { if (generation === loadGeneration.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { loadGeneration.current += 1; }; }, [occupationId]);
  useEffect(() => { if (candidate) setEditor({ item: null, candidate }); }, [candidate]);

  function begin() {
    if (inFlight.current || disabled || mutationLock?.current || loading || !ready) return false;
    inFlight.current = true;
    if (mutationLock) mutationLock.current = true;
    setBusy(true); onBusyChange?.(true); setError(null); setNotice(null); setEditorError(null);
    return true;
  }
  function end() {
    inFlight.current = false;
    if (mutationLock) mutationLock.current = false;
    setBusy(false); onBusyChange?.(false);
  }
  function report(requestVersion: number, profileVersion: number, message: string) {
    onMutation?.({ requestVersion, profileVersion, message }); setNotice(message);
  }
  async function edit(item: CapabilityDetailResponse) {
    if (!begin()) return;
    try {
      const profile = await profileApi.get();
      const fresh = await capabilitiesApi.get(item.capability_id);
      setEditor({ item: fresh, baseline: profile.profile_version ?? profile.version }); setRemoving(null);
    } catch { setError("수정할 스펙을 불러오지 못했어요. 다시 시도해 주세요."); }
    finally { end(); }
  }
  async function readSaved(id: string) {
    const generation = loadGeneration.current;
    const saved = await capabilitiesApi.get(id);
    // A goal switch can start a newer matching-context reload during this read.
    if (generation === loadGeneration.current) setItems(previous => [saved, ...previous.filter(item => item.capability_id !== id)]);
    setSavedId(null);
  }
  async function save(value: CapabilityWrite) {
    if (!editor || !begin()) return;
    let committed = false;
    try {
      const profile = await profileApi.get();
      const requestVersion = profile.profile_version ?? profile.version;
      if (editor.item && editor.baseline !== requestVersion) {
        setEditor(previous => previous ? { ...previous, baseline: requestVersion } : null);
        setEditorError("다른 정보가 먼저 변경됐어요. 입력은 유지했어요. 내용을 확인하고 저장을 다시 눌러 주세요.");
        return;
      }
      const payload = JSON.stringify(value);
      // A lost POST response can be retried with the same original version/key.
      // Editing the form starts a new operation instead of replaying stale input.
      if (!editor.item && lastAttempt.current?.payload !== payload) { lastAttempt.current = null; newKey.current = null; }
      const attempt = lastAttempt.current;
      const version = !editor.item && attempt ? attempt.version : requestVersion;
      const body = { ...value, expected_profile_version: version };
      if (!editor.item && !newKey.current) newKey.current = crypto.randomUUID();
      if (!editor.item && !attempt) lastAttempt.current = { payload, version, key: newKey.current! };
      const response = editor.item ? await capabilitiesApi.update(editor.item.capability_id, body)
        : await capabilitiesApi.create(body, lastAttempt.current!.key);
      committed = true;
      editor.onSaved?.();
      report(version, response.profile_version, "스펙을 저장했어요. 현재 목표와의 연결 여부를 확인하고 다시 분석해 주세요.");
      newKey.current = null; lastAttempt.current = null;
      try { await readSaved(response.capability_id); }
      catch { setSavedId(response.capability_id); setError("저장은 완료됐지만 결과를 불러오지 못했어요. 새로 추가하지 말고 저장 결과를 다시 불러와 주세요."); }
      setEditor(null);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (status === 409 || status === 422) { lastAttempt.current = null; newKey.current = null; }
      if (status === 409 && editor?.item) {
        try { const profile = await profileApi.get(); setEditor(previous => previous ? { ...previous, baseline: profile.profile_version ?? profile.version } : null); } catch { /* Keep edits for a later retry. */ }
      }
      if (!committed) setEditorError(status === 409 ? "다른 정보가 먼저 변경됐어요. 입력은 유지했어요. 저장을 다시 눌러 주세요." : status === 422 ? "입력값이나 선택한 역량을 확인해 주세요. 입력은 유지했어요. 역량 목록이 바뀌었다면 다시 선택해 주세요." : "저장 응답을 확인하지 못했어요. 입력은 유지했어요. 같은 내용으로 다시 저장하면 중복 요청을 확인해요.");
    } finally { end(); }
  }
  async function remove() {
    if (!removing || !begin()) return;
    try {
      const profile = await profileApi.get();
      const version = profile.profile_version ?? profile.version;
      const response = await capabilitiesApi.delete(removing.capability_id, { expected_profile_version: version });
      setItems(previous => previous.filter(item => item.capability_id !== removing.capability_id));
      if (editor?.item?.capability_id === removing.capability_id) setEditor(null);
      setRemoving(null); report(version, response.profile_version, "스펙을 삭제했어요. 다음 분석의 입력에서 제외돼요.");
    } catch (cause) {
      if ((cause as { status?: number }).status === 404) { await load(); setRemoving(null); setNotice("이미 삭제된 스펙이에요. 목록을 새로 불러왔어요."); }
      else setError((cause as { status?: number }).status === 409 ? "다른 정보가 변경됐어요. 스펙은 유지했어요. 삭제를 다시 눌러 주세요." : "스펙을 삭제하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally { end(); }
  }
  function cancelEditor() {
    setEditor(null); setEditorError(null); lastAttempt.current = null; newKey.current = null;
  }
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleItems = items.filter(item => !normalizedQuery || [item.raw_text, item.details.evidence, categoryLabel(item.category), ...item.matching.competencies.map(value => value.label)].some(value => value?.toLocaleLowerCase().includes(normalizedQuery)));
  const dialogOpen = resumeOpen || editor !== null;
  const feedback = <>
    {error && <div className="spec-error" role="alert"><p>{error}</p>{savedId ? <button type="button" disabled={busy} onClick={async () => {
      if (!begin()) return;
      try { await readSaved(savedId); } catch { setError("저장 결과를 불러오지 못했어요. 잠시 후 다시 불러와 주세요."); } finally { end(); }
    }}>저장 결과 다시 불러오기</button> : !ready && <button type="button" disabled={loading} onClick={() => void load()}>스펙 다시 불러오기</button>}</div>}
    {notice && <p className="spec-notice" role="status">{notice}</p>}
  </>;
  return <section className="spec-manager" aria-label="내 스펙 관리" aria-busy={loading || busy}>
    <header className="spec-manager-heading"><div><h2>내 스펙 <span className="spec-count">{items.length}</span></h2></div><div className="spec-entry-actions"><button type="button" className="spec-secondary" disabled={disabled || busy || loading || !ready || savedId !== null || dialogOpen} onClick={() => { setResumeOpen(true); setError(null); setNotice(null); }}>이력서에서 가져오기</button><button type="button" className="spec-primary" disabled={disabled || busy || loading || !ready || savedId !== null || dialogOpen} onClick={() => { setEditor({ item: null }); setEditorError(null); setNotice(null); newKey.current = null; lastAttempt.current = null; }}>스펙 추가</button></div></header>
    <details className="spec-explainer"><summary>내 스펙은 분석에 어떻게 반영되나요?</summary><p className="spec-help">현재 목표에 연결된 역량·근거·수행 수준으로 남은 학습량을 추정해요. 변경 후 다시 분석해야 하며, 진행 중인 로드맵은 자동으로 바뀌지 않아요.</p></details>
    {loading && <p className="spec-help" role="status">스펙을 불러오는 중이에요…</p>}
    {!dialogOpen && feedback}
    {dialogOpen && <SpecDialog title={editor ? editor.item ? "스펙 수정" : "새로운 스펙 추가" : "이력서에서 스펙 찾기"}
      view={editor ? "editor" : "resume"} busy={busy || disabled} back={resumeOpen && editor !== null}
      onDismiss={() => { if (editor) cancelEditor(); else setResumeOpen(false); }}>
      {feedback}
      {resumeOpen && <div className="resume-scanner-wrapper" hidden={editor !== null}><ResumeScanner occupationId={occupationId} existingCompetencyIds={items.flatMap(item => item.details.competency_ids ?? [])} disabled={disabled || busy || loading || !ready || savedId !== null || editor !== null} onReview={(initialDraft, onSaved) => { setEditor({ item: null, initialDraft, onSaved }); setEditorError(null); setNotice(null); newKey.current = null; lastAttempt.current = null; }} onClose={() => setResumeOpen(false)} /></div>}
      {editor && <SpecEditor key={editor.item?.capability_id ?? "new"} item={editor.item} candidate={editor.candidate} initialDraft={editor.initialDraft} occupationId={occupationId} busy={busy || disabled} canSave={ready && !loading} error={editorError} onSave={save} onCancel={cancelEditor} />}
    </SpecDialog>}
    {!loading && ready && !items.length && !dialogOpen && <div className="spec-empty"><strong>등록한 스펙이 없어요</strong><p>이력서를 가져오거나 직접 추가하세요.</p></div>}
    {searchable && <label className="spec-list-search"><span className="spec-sr-only">내 스펙 검색</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="내 스펙 검색" /></label>}
    {searchable && items.length > 0 && !visibleItems.length && <p className="spec-help" role="status">검색 결과가 없어요.</p>}
    <ul className="spec-list">{visibleItems.map(item => <li className="spec-item" key={item.capability_id}>
      <div className="spec-item-heading"><div><small className="spec-category">{categoryLabel(item.category)}</small><h3>{item.raw_text}</h3><small>{item.details.source === "DOCUMENT_IMPORT" ? "이력서에서 가져옴 · 본인 확인" : "본인 입력"}</small></div>{item.category !== "ROADMAP_OUTCOME" && <div className="spec-item-actions"><button type="button" disabled={disabled || busy || loading || dialogOpen} onClick={() => void edit(item)} aria-label={`${item.raw_text} 수정`}>수정</button><button type="button" disabled={disabled || busy || loading || dialogOpen} onClick={() => { setRemoving(item); setError(null); }} aria-label={`${item.raw_text} 삭제`}>삭제</button></div>}</div>
      {item.proficiency && !["certification", "test"].includes(item.category) && <p className="spec-help">{PROFICIENCIES.find(value => value.value === item.proficiency)?.label}</p>}
      <p className={`spec-matching spec-matching--${item.matching.status}`}><strong>{statusLabels[item.matching.status]}</strong> · 모델 반영 비율 {Math.round(item.matching.credit * 100)}%</p>
      <details className="spec-item-detail"><summary>근거와 연결 역량 보기</summary>
      <SpecDetailsSummary item={item} />
      <p className="spec-help">{item.matching.message}</p>
      {!!item.matching.competencies.length && <ul className="spec-competencies">{item.matching.competencies.map(value => <li key={value.entity_id}>{value.label}{!value.requirement_keys.length && <small>현재 목표와 연결 없음</small>}</li>)}</ul>}
      {item.details.evidence && <p className="spec-evidence">{item.details.evidence}</p>}
      </details>
      {removing?.capability_id === item.capability_id && <section className="spec-delete-confirm" aria-label={`${item.raw_text} 삭제 확인`}><p>‘{item.raw_text}’ 스펙을 삭제할까요? 다음 분석의 입력에서 제외돼요.</p><div className="spec-actions"><button type="button" disabled={busy} onClick={() => setRemoving(null)}>취소</button><button type="button" className="spec-danger" disabled={disabled || busy} onClick={() => void remove()}>{busy ? "삭제 중…" : "삭제 확인"}</button></div></section>}
    </li>)}</ul>
  </section>;
}
