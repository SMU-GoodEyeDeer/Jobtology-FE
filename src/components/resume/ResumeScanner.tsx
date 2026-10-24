import { useEffect, useRef, useState } from "react";
import { resumeApi } from "../../services/api";
import type { ResumeBlock, ResumeFormat, ResumeScan, ResumeStatus, ResumeSuggestion } from "../../services/types";
import type { SpecDraft } from "../specs/specModel";
import { SPEC_CATEGORIES } from "../specs/specModel";
import { anchorAiSuggestion, importedDraft, pointSlice, redactContacts, resumeError, RESUME_FIELDS } from "./resumeModel";
import { ResumeDocumentPreview } from "./ResumeDocumentPreview";
import "./ResumeScanner.css";

interface Props {
  readonly occupationId?: string | null;
  readonly disabled?: boolean;
  readonly existingCompetencyIds: string[];
  readonly onReview: (draft: SpecDraft, onSaved: () => void) => void;
  readonly onClose: () => void;
}
const warningText: Record<string, string> = {
  EXTRACTED_TEXT_REVIEW: "미리보기 배치·텍스트는 원본과 다를 수 있어요.",
  KEYWORDS_ARE_NOT_PROOF: "키워드만으로 본인 경험을 판단하지 않아요. 확인 후 저장해 주세요.",
  AI_ENTRIES_REQUIRE_REVIEW: "AI 제안은 실력·자격 검증 결과가 아니에요. 원문과 필드를 확인해 주세요.",
  PREVIEW_UNAVAILABLE: "미리보기를 만들지 못했어요. 텍스트 보기에서 확인해 주세요.",
  HIDDEN_TEXT_REMOVED: "DOCX에 명시적으로 숨기거나 삭제한 텍스트를 제외했어요.",
  OCR_REQUIRED: "이미지·읽지 못한 페이지는 OCR 미지원으로 제외했어요. 직접 입력하거나 텍스트 PDF를 올려 주세요.",
  TEXT_TRUNCATED: "문서가 길어 일부 텍스트만 표시해요. 필요한 부분을 나눠 올려 주세요.",
  SUGGESTIONS_TRUNCATED: "자동 제안은 최대 200개예요. 나머지 문단도 직접 선택해서 추가할 수 있어요.",
  NO_READABLE_TEXT: "읽을 수 있는 텍스트가 없어요. 텍스트가 있는 문서나 직접 입력을 이용해 주세요.",
  NCS_CATALOG_UNAVAILABLE: "NCS 자료를 불러오지 못했어요. O*NET 후보를 검토하거나 나중에 다시 검색해 주세요.",
};

const reviewNotes = new Set(["EXTRACTED_TEXT_REVIEW", "KEYWORDS_ARE_NOT_PROOF", "AI_ENTRIES_REQUIRE_REVIEW"]);

export function ResumeScanner({ occupationId, disabled, existingCompetencyIds, onReview, onClose }: Props) {
  const [status, setStatus] = useState<ResumeStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [scan, setScan] = useState<ResumeScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<"ai" | "scan">("ai");
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [documentPage, setDocumentPage] = useState(1);
  const [documentInfo, setDocumentInfo] = useState({ zoom: 100, pages: 1 });
  const [hovered, setHovered] = useState<ResumeSuggestion | null>(null);
  const [documentConsent, setDocumentConsent] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<"document" | "text">("document");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"source" | "suggestions">("suggestions");
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const suggestionNodes = useRef(new Map<string, HTMLElement>());
  const suggestionList = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const active = scan?.blocks.find(block => block.block_id === selected);
  const activeSuggestion = scan?.suggestions.find(item => item.suggestion_id === selectedSuggestion);
  const aiMode = mode === "ai" && status?.ai_available !== false;
  const uploadAllowed = Boolean(status) && (!aiMode || documentConsent) && !disabled && !scanning && !aiBusy;
  async function loadStatus() {
    setStatusError(false);
    try { setStatus(await resumeApi.status()); } catch { setStatusError(true); }
  }
  useEffect(() => { void loadStatus(); heading.current?.focus({ preventScroll: true }); return () => { generation.current += 1; controller.current?.abort(); }; }, []);
  async function upload(file: File) {
    if (!status || disabled || scanning || aiBusy) return;
    if (aiMode && !documentConsent) { setError("AI 분석 동의 후 파일을 선택해 주세요."); return; }
    const format = file.name.split(".").pop()?.toLowerCase() as ResumeFormat;
    if (aiMode && format !== "pdf") { setError("AI 분석은 3쪽 이하 PDF만 지원해요. PDF로 저장한 뒤 올려 주세요."); return; }
    if (!status.formats.includes(format)) { setError("현재 서버가 지원하는 문서 형식을 선택해 주세요."); return; }
    if (!file.size || file.size > status.max_bytes) { setError("비어 있지 않은 10MB 이하 파일을 선택해 주세요."); return; }
    const id = ++generation.current;
    controller.current?.abort(); controller.current = new AbortController();
    setFilename(file.name); setZoom(null); setDocumentPage(1); setDocumentInfo({ zoom: 100, pages: 1 }); setHovered(null);
    setScanning(true); setProgress(null); setAnalysisNotice(null); setPreview("document"); setError(null); setScan(null); setSaved(new Set()); setExcluded(new Set()); setAiOpen(false); setAiText(""); setAiNotice(null);
    try {
      if (aiMode) {
        await resumeApi.analyze(file, occupationId, event => {
          if (id !== generation.current) return;
          if (event.type === "scan") {
            setScan(event.scan); setSelected(event.scan.blocks[0]?.block_id ?? null); setSelectedSuggestion(null); setTab("suggestions");
            setProgress({ completed: 0, total: event.scan.blocks.length });
          } else if (event.type === "paragraph") {
            setProgress({ completed: event.completed, total: event.total });
            setScan(previous => previous ? { ...previous, suggestions: [...previous.suggestions, ...event.suggestions].sort((a, b) => previous.blocks.findIndex(block => block.block_id === a.block_id) - previous.blocks.findIndex(block => block.block_id === b.block_id) || a.start - b.start) } : previous);
          } else if (event.type === "done") {
            setAnalysisNotice(`${event.completed}/${event.total}문단 처리 · ${event.failed ? `${event.failed}문단은 처리하지 못했어요. 도착한 제안은 검토할 수 있어요.` : "제안을 검토하고 필요한 항목을 저장해 주세요."}${event.rejected_count ? " 원문에서 확인할 수 없는 필드는 제외했어요." : ""}${event.omitted_count ? ` 제안 한도로 ${event.omitted_count}개는 생략했어요.` : ""}`);
          }
        }, controller.current.signal);
      } else {
        const result = await resumeApi.scan(file, format, occupationId, controller.current.signal);
        if (id !== generation.current) return;
        setScan(result); setSelected(result.blocks[0]?.block_id ?? null); setSelectedSuggestion(null); setTab("suggestions");
      }
    } catch (cause) { if (id === generation.current) setError(resumeError(cause, aiMode ? "ai" : "scan")); }
    finally { if (id === generation.current) { setScanning(false); if (input.current) input.current.value = ""; } }
  }
  function cancel() {
    generation.current += 1; controller.current?.abort(); setScanning(false); setError(null);
    if (scan) setAnalysisNotice("분석을 중단했어요. 도착한 제안은 검토할 수 있어요.");
    if (input.current) input.current.value = "";
  }
  function choose(block: ResumeBlock, suggestion?: ResumeSuggestion) {
    setSelected(block.block_id); setSelectedSuggestion(suggestion?.suggestion_id ?? null); setAiOpen(false); setAiText(""); setAiNotice(null);
  }
  function review(block: ResumeBlock, suggestion?: ResumeSuggestion) {
    if (!scan || disabled) return;
    const key = suggestion?.suggestion_id ?? `manual-${block.block_id}`;
    try {
      const draft = importedDraft(scan, block, suggestion);
      onReview(draft, () => setSaved(previous => new Set([...previous, key])));
    } catch (cause) { setError((cause as Error).message); }
  }
  async function interpret() {
    if (!active || !aiConsent || !aiText.trim() || aiBusy || disabled) return;
    const id = generation.current, block = active, sent = aiText.trim();
    setAiBusy(true); setError(null); setAiNotice(null);
    try {
      const response = await resumeApi.interpret(sent, occupationId);
      if (id !== generation.current) return;
      const anchored = response.suggestions.map(item => anchorAiSuggestion(item, sent, block)).filter((item): item is ResumeSuggestion => item !== null)
        .map((item, index) => ({ ...item, suggestion_id: `ai-${block.block_id}-${Date.now()}-${index}` }));
      setScan(previous => previous ? { ...previous, suggestions: [...previous.suggestions.filter(item => item.block_id !== block.block_id || item.method !== "AI_ASSISTED"), ...anchored] } : previous);
      setAiNotice(anchored.length ? `AI 제안 ${anchored.length}개를 찾았어요. 원문과 수행 내용을 확인해 주세요.${response.rejected_count || anchored.length !== response.suggestions.length ? " 원문이나 역량을 확인할 수 없는 제안은 제외했어요." : ""}` : "원문과 연결할 수 있는 제안이 없어요. 직접 역량을 선택하거나 다른 구절로 시도해 주세요.");
      setTab("suggestions");
    } catch (cause) { if (id === generation.current) setError(resumeError(cause, "ai")); }
    finally { if (id === generation.current) setAiBusy(false); }
  }
  function chooseFromDocument(block: ResumeBlock) {
    choose(block); setTab("suggestions");
    const target = scan?.suggestions.find(item => item.block_id === block.block_id);
    if (!target) return;
    requestAnimationFrame(() => {
      const node = suggestionNodes.current.get(target.suggestion_id), list = suggestionList.current;
      if (!node || !list) return;
      const top = node.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop - 48;
      list.scrollTo?.({ top: Math.max(0, top), behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }
  const suggestions = scan?.suggestions ?? [];
  const notes = scan?.warnings.filter(code => reviewNotes.has(code)) ?? [];
  const warnings = scan?.warnings.filter(code => !reviewNotes.has(code)) ?? [];
  const reviewed = suggestions.filter(item => saved.has(item.suggestion_id) || excluded.has(item.suggestion_id)).length;
  const previewSuggestion = hovered ?? activeSuggestion;
  const previewBlock = hovered ? scan?.blocks.find(block => block.block_id === hovered.block_id) : active;
  return <section className={`resume-scanner${scan ? " resume-scanner--review" : ""}`} aria-label="이력서에서 스펙 가져오기">
    <header className="resume-heading"><h3 ref={heading} tabIndex={-1}>{scan ? filename : "이력서 가져오기"}</h3>{!scan && <button type="button" className="spec-secondary" disabled={disabled} onClick={onClose}>가져오기 끝내기</button>}</header>
    <input ref={input} className="spec-sr-only" type="file" aria-label="이력서 파일" accept={aiMode ? ".pdf" : status?.formats.map(format => `.${format}`).join(",")} disabled={!uploadAllowed} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    {!status && <p role="status" className="spec-help">{statusError ? <><span>지원 형식을 확인하지 못했어요. </span><button type="button" onClick={() => void loadStatus()}>다시 확인</button></> : "지원 형식을 확인하는 중이에요…"}</p>}
    {status && !scan && <div className="resume-upload">
      <div className="resume-import-modes" role="group" aria-label="분석 방식"><button type="button" aria-pressed={aiMode} disabled={!status.ai_available || scanning} onClick={() => setMode("ai")}>AI로 항목 찾기</button><button type="button" aria-pressed={!aiMode} disabled={scanning} onClick={() => setMode("scan")}>AI 없이 직접 검토</button></div>
      {aiMode && <label className="spec-check resume-bulk-consent"><input type="checkbox" checked={documentConsent} disabled={disabled || scanning || aiBusy} onChange={event => {
        setDocumentConsent(event.target.checked); setError(null);
        // Open in the same user gesture; the input is enabled before invoking the picker.
        if (event.target.checked && input.current) { input.current.disabled = false; input.current.click(); }
      }} />추출 문단을 {status.ai_provider ?? "설정된 AI"}에 보내 항목을 찾는 데 동의해요</label>}
      <div className={`resume-dropzone${dragging ? " is-dragging" : ""}`} aria-disabled={!uploadAllowed} onDragOver={event => { event.preventDefault(); if (uploadAllowed) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => {
        event.preventDefault(); setDragging(false); const files = event.dataTransfer.files;
        if (!uploadAllowed) { if (aiMode && !documentConsent) setError("AI 분석 동의 후 파일을 선택해 주세요."); return; }
        if (files.length !== 1) { setError("한 번에 문서 하나를 올려 주세요."); return; } void upload(files[0]);
      }}>
        <span className="resume-upload-icon" aria-hidden="true">↥</span><strong>이력서를 여기에 놓으세요</strong>
        <button type="button" className="spec-primary" disabled={!uploadAllowed} onClick={() => input.current?.click()}>파일 선택</button>
        <p className="spec-help">{aiMode ? "PDF" : status.formats.map(format => format.toUpperCase()).join(" · ")} · 최대 10MB · PDF 최대 {aiMode ? status.ai_max_pdf_pages ?? 3 : status.max_pdf_pages}쪽</p>
      </div>
      {!status.ai_available && <p className="spec-help">AI 연결 불가 · 키워드 검색과 직접 검토는 가능해요.</p>}
    </div>}
    <details className="spec-explainer resume-privacy"><summary>파일·분석 안내{warnings.length ? ` · 알림 ${warnings.length}개` : ""}</summary><p className="spec-help">파일은 처리 후 삭제해요. 저장한 원문·정보는 내 스펙에 남아요.</p>{notes.map(code => <p className="spec-help" key={code}>{warningText[code]}</p>)}{warnings.map(code => <p className="spec-help" key={code}>{warningText[code] ?? "일부 정보를 읽지 못했어요. 원문을 확인해 주세요."}</p>)}{!!scan?.skipped_pages.length && <p className="spec-help">읽지 못한 페이지: {scan.skipped_pages.join(", ")}</p>}</details>
    {scanning && <div className="resume-progress" role="status">{progress ? <><progress max={Math.max(1, progress.total)} value={progress.completed} aria-label="AI 문단 분석 진행" /><span>{progress.completed}/{progress.total}문단 분석</span></> : <span>문서를 읽고 있어요… 최대 {status?.parse_timeout_seconds ?? 60}초</span>}<button type="button" onClick={cancel}>{progress ? "분석 중단" : "읽기 취소"}</button></div>}
    {analysisNotice && <p className="spec-notice resume-analysis-notice" role="status">{analysisNotice}</p>}
    {error && <p className="spec-error" role="alert">{error}</p>}
    {scan && <>
      <div className="resume-tabs resume-mobile-tabs" role="group" aria-label="이력서 검토 보기"><button type="button" aria-pressed={tab === "source"} onClick={() => setTab("source")}>원문</button><button type="button" aria-pressed={tab === "suggestions"} onClick={() => setTab("suggestions")}>제안 {suggestions.length}개</button></div>
      <div className={`resume-workspace resume-workspace--${tab}`}>
        <section className="resume-source" aria-label="추출한 원문"><h4>원문</h4>
          {scan.preview_html && <div className="resume-document-view" hidden={preview !== "document"}><ResumeDocumentPreview html={scan.preview_html} blocks={scan.blocks} selected={previewBlock} suggestion={previewSuggestion} suggestions={suggestions} saved={saved} excluded={excluded} zoom={zoom} page={documentPage} onZoom={setZoom} onInfo={setDocumentInfo} onSelect={chooseFromDocument} /></div>}
          <div className="resume-source-scroll" hidden={!!scan.preview_html && preview !== "text"}>{scan.blocks.map((block, index) => {
            const isSelected = active?.block_id === block.block_id;
            const entries = suggestions.filter(item => item.block_id === block.block_id);
            const state = saved.has(`manual-${block.block_id}`) || entries.length && entries.every(item => saved.has(item.suggestion_id)) ? "added" : entries.length && entries.every(item => excluded.has(item.suggestion_id)) ? "excluded" : "pending";
            const start = isSelected && activeSuggestion ? activeSuggestion.start : 0, end = isSelected && activeSuggestion ? activeSuggestion.end : Array.from(block.text).length;
            return <button type="button" key={block.block_id} className={`resume-block${isSelected ? " resume-block--selected" : ""}`} data-review={state} aria-pressed={isSelected} aria-label={`원문 문단 ${index + 1} 선택`} onClick={() => chooseFromDocument(block)}><small>{block.page ? `${block.page}쪽 · ` : ""}문단 {index + 1}</small><span>{isSelected ? <>{pointSlice(block.text, 0, start)}<mark>{pointSlice(block.text, start, end)}</mark>{pointSlice(block.text, end)}</> : block.text}</span></button>;
          })}</div>
        </section>
        <section ref={suggestionList} className="resume-suggestions" aria-label="스펙 제안"><h4>제안 <span>{suggestions.length}개</span><small>추가됨 <i className="resume-state-dot is-added" /> · 제외 <i className="resume-state-dot is-excluded" /></small></h4>
          {!suggestions.length && <p className="spec-empty">연결할 역량을 찾지 못했어요. 원문을 선택해 직접 추가할 수 있어요.</p>}
          {suggestions.map(suggestion => {
            const block = scan.blocks.find(value => value.block_id === suggestion.block_id), complete = saved.has(suggestion.suggestion_id), dismissed = excluded.has(suggestion.suggestion_id);
            const state = complete ? "added" : dismissed ? "excluded" : "pending";
            return <article key={suggestion.suggestion_id} ref={node => { if (node) suggestionNodes.current.set(suggestion.suggestion_id, node); else suggestionNodes.current.delete(suggestion.suggestion_id); }} className={`resume-candidate${selectedSuggestion === suggestion.suggestion_id || !selectedSuggestion && selected === suggestion.block_id ? " resume-candidate--selected" : ""}`} data-review={state} onMouseEnter={() => setHovered(suggestion)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(suggestion)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHovered(null); }}>
              <small>{SPEC_CATEGORIES.find(category => category.value === suggestion.category)?.label}<span className="resume-review-status">{complete ? "✓ 추가됨" : dismissed ? "− 제외됨" : "미검토"}</span></small><h5>{suggestion.title}</h5><blockquote>{suggestion.quote}</blockquote>
              {!!Object.keys(suggestion.fields ?? {}).length && <dl className="resume-fields">{Object.entries(suggestion.fields ?? {}).map(([name, value]) => <div key={name}><dt>{RESUME_FIELDS[name] ?? name}</dt><dd>{value}</dd></div>)}</dl>}
              {!!suggestion.competencies.length && <ul>{suggestion.competencies.map(item => <li key={item.entity_id}>{item.label} <small>{item.source === "ONET" ? "O*NET · NCS 등가 아님" : "NCS"}{existingCompetencyIds.includes(item.entity_id) ? " · 등록된 역량" : ""}</small></li>)}</ul>}
              <div className="resume-card-actions"><button type="button" className="spec-primary" disabled={disabled || !block || complete} onClick={() => { if (block) { choose(block, suggestion); review(block, suggestion); } }}>검토하고 추가</button><button type="button" className="spec-secondary" aria-pressed={dismissed} disabled={disabled || complete} onClick={() => setExcluded(previous => { const next = new Set(previous); if (next.has(suggestion.suggestion_id)) next.delete(suggestion.suggestion_id); else next.add(suggestion.suggestion_id); return next; })}>제외</button></div>
            </article>;
          })}
          {active && <section className="resume-selected" aria-label="선택한 문단 작업"><h4>문단 {scan.blocks.indexOf(active) + 1}</h4><p>{active.text}</p><div className="resume-card-actions"><button type="button" className="spec-secondary" disabled={disabled || saved.has(`manual-${active.block_id}`)} onClick={() => review(active)}>{saved.has(`manual-${active.block_id}`) ? "이 문단 저장 완료" : "이 문단으로 직접 스펙 추가"}</button><button type="button" className="spec-text-button" disabled={disabled || scanning || !status?.ai_available} onClick={() => { setAiOpen(true); setAiText(redactContacts(active.text)); setAiConsent(false); setAiNotice(null); }}>역량을 못 찾겠어요 · AI 도움</button></div>
            {aiOpen && <div className="resume-ai"><label>AI에 보낼 선택 구절<textarea value={aiText} maxLength={2000} onChange={event => setAiText(event.target.value)} /></label><label className="spec-check"><input type="checkbox" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)} />이 구절을 AI에 보내는 데 동의해요</label><button type="button" className="spec-secondary" disabled={!aiConsent || !aiText.trim() || aiBusy || disabled} onClick={() => void interpret()}>{aiBusy ? "해석 중…" : "이 구절만 AI로 해석"}</button>{aiNotice && <p className="spec-help" role="status">{aiNotice}</p>}</div>}
          </section>}
        </section>
      </div>
      <footer className="resume-dock">
        <div className="resume-tabs" role="group" aria-label="원문 표시 방식"><button type="button" disabled={!scan.preview_html} aria-pressed={preview === "document" && !!scan.preview_html} onClick={() => { setPreview("document"); setTab("source"); }}>문서 미리보기</button><button type="button" aria-pressed={preview === "text" || !scan.preview_html} onClick={() => { setPreview("text"); setTab("source"); }}>텍스트 보기</button></div>
        {scan.preview_html && <div className="resume-dock-document"><label><span className="spec-sr-only">문서 페이지</span><select aria-label="문서 페이지" value={documentPage} onChange={event => setDocumentPage(Number(event.target.value))}>{Array.from({ length: documentInfo.pages }, (_, index) => <option key={index} value={index + 1}>{index + 1} / {documentInfo.pages}쪽</option>)}</select></label><label><span className="spec-sr-only">문서 확대 비율</span><select aria-label="문서 확대 비율" value={zoom ?? "fit"} onChange={event => setZoom(event.target.value === "fit" ? null : Number(event.target.value))}><option value="fit">페이지 맞춤</option>{[...new Set([25, 50, 75, 100, 125, 150, 200, ...(zoom === null ? [] : [zoom])])].sort((a,b) => a-b).map(value => <option key={value} value={value}>{value}%</option>)}</select></label><small title="Ctrl + 스크롤로 확대 · 끌어서 이동">{documentInfo.zoom}% · Ctrl ⌘ ±</small></div>}
        <span className="resume-review-count" role="status">{reviewed}/{suggestions.length} 검토 완료</span>
        <div className="resume-dock-actions"><button type="button" className="spec-secondary" disabled={!uploadAllowed} onClick={() => input.current?.click()}>다른 파일</button><button type="button" className="spec-primary" disabled={disabled} onClick={onClose}>가져오기 끝내기</button></div>
      </footer>
    </>}
  </section>;
}
