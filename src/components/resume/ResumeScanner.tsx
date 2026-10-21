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
  const blockNodes = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const active = scan?.blocks.find(block => block.block_id === selected);
  const activeSuggestion = scan?.suggestions.find(item => item.suggestion_id === selectedSuggestion);
  async function loadStatus() {
    setStatusError(false);
    try { setStatus(await resumeApi.status()); } catch { setStatusError(true); }
  }
  useEffect(() => { void loadStatus(); heading.current?.focus(); return () => { generation.current += 1; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (!selected || tab !== "source") return;
    const node = blockNodes.current.get(selected);
    node?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    node?.focus({ preventScroll: true });
  }, [selected, selectedSuggestion, tab]);
  async function upload(file: File) {
    if (!status || disabled || scanning) return;
    const format = file.name.split(".").pop()?.toLowerCase() as ResumeFormat;
    if (documentConsent && format !== "pdf") { setError("AI 분석은 3쪽 이하 PDF만 지원해요. PDF로 저장한 뒤 올려 주세요."); return; }
    if (!status.formats.includes(format)) { setError("현재 서버가 지원하는 문서 형식을 선택해 주세요."); return; }
    if (!file.size || file.size > status.max_bytes) { setError("비어 있지 않은 10MB 이하 파일을 선택해 주세요."); return; }
    const id = ++generation.current;
    controller.current?.abort(); controller.current = new AbortController();
    setScanning(true); setProgress(null); setAnalysisNotice(null); setPreview("document"); setError(null); setScan(null); setSaved(new Set()); setExcluded(new Set()); setAiOpen(false); setAiText(""); setAiNotice(null);
    try {
      if (documentConsent) {
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
    } catch (cause) { if (id === generation.current) setError(resumeError(cause, documentConsent ? "ai" : "scan")); }
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
  const suggestions = scan?.suggestions.filter(item => !excluded.has(item.suggestion_id)) ?? [];
  const notes = scan?.warnings.filter(code => reviewNotes.has(code)) ?? [];
  const warnings = scan?.warnings.filter(code => !reviewNotes.has(code)) ?? [];
  return <section className="resume-scanner" aria-label="이력서에서 스펙 가져오기">
    <header className="resume-heading"><div><h3 ref={heading} tabIndex={-1}>파일 선택</h3></div><button type="button" className="spec-secondary" disabled={disabled} onClick={onClose}>가져오기 끝내기</button></header>
    <details className="spec-explainer resume-privacy"><summary>파일·분석 안내</summary><p className="spec-help">파일은 읽은 뒤 삭제하며, 비정상 종료로 남은 파일은 15분 후 정리해요. 미리보기는 이 화면에만, 저장한 인용·정보는 내 스펙에 남아요. 동의하면 추출 문단을 AI로 분석하고, 동의하지 않으면 키워드로 찾아요.</p>{notes.map(code => <p className="spec-help" key={code}>{warningText[code]}</p>)}</details>
    {!status && <p role="status" className="spec-help">{statusError ? <><span>지원 형식을 확인하지 못했어요. </span><button type="button" onClick={() => void loadStatus()}>다시 확인</button></> : "지원 형식을 확인하는 중이에요…"}</p>}
    {status && <div className="resume-upload"><label className="spec-check resume-bulk-consent"><input type="checkbox" checked={documentConsent} disabled={!status.ai_available || disabled || scanning || aiBusy} onChange={event => setDocumentConsent(event.target.checked)} />AI 분석 · 추출 문단을 {status.ai_provider ?? "설정된 AI"}에 전송하는 데 동의해요</label>{documentConsent && <p className="spec-help">최대 {status.ai_max_paragraphs ?? 64}문단 · {(status.ai_max_characters ?? 12000).toLocaleString()}자. 이름·주소·비공개 정보는 지운 뒤 올려 주세요.</p>}<label>{documentConsent ? "PDF 선택하고 AI로 항목 찾기" : "이력서·경력기술서 파일"}<input ref={input} type="file" accept={documentConsent ? ".pdf" : status.formats.map(format => `.${format}`).join(",")} disabled={disabled || scanning || aiBusy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label><p className="spec-help">{documentConsent ? "PDF" : status.formats.map(format => format.toUpperCase()).join(" · ")} · 최대 10MB · PDF 최대 {documentConsent ? status.ai_max_pdf_pages ?? 3 : status.max_pdf_pages}쪽 · 암호 해제 필요</p>{!status.ai_available && <p className="spec-help">AI 연결 불가 · 키워드 검색과 직접 검토는 가능해요.</p>}{scan && <p className="spec-help">파일을 바꾸면 미리보기·미저장 제안만 지워져요.</p>}</div>}
    {scanning && <div className="resume-progress" role="status">{progress ? <><progress max={Math.max(1, progress.total)} value={progress.completed} aria-label="AI 문단 분석 진행" /><span>{progress.completed}/{progress.total}문단 분석 · 항목이 도착하는 대로 표시해요</span></> : <span>문서를 읽는 중이에요… 최대 {status?.parse_timeout_seconds ?? 60}초 정도 걸릴 수 있어요.</span>}<button type="button" onClick={cancel}>{progress ? "분석 중단" : "읽기 취소"}</button></div>}
    {analysisNotice && <p className="spec-notice" role="status">{analysisNotice}</p>}
    {error && <p className="spec-error" role="alert">{error}</p>}
    {scan && <>
      {(warnings.length > 0 || scan.skipped_pages.length > 0) && <ul className="resume-warnings">{warnings.map(code => <li key={code}>{warningText[code] ?? "일부 정보를 읽지 못했어요. 원문을 확인해 주세요."}</li>)}{!!scan.skipped_pages.length && <li>읽지 못한 페이지: {scan.skipped_pages.join(", ")}</li>}</ul>}
      {!!scan.blocks.length && <>
        <div className="resume-tabs" role="group" aria-label="이력서 검토 보기"><button type="button" aria-pressed={tab === "source"} onClick={() => setTab("source")}>추출한 원문</button><button type="button" aria-pressed={tab === "suggestions"} onClick={() => setTab("suggestions")}>제안 {suggestions.length}개</button></div>
        <div className={`resume-workspace resume-workspace--${tab}`}>
          <section className="resume-source" aria-label="추출한 원문"><h4>추출한 원문</h4>{scan.preview_html && <div className="resume-tabs" role="group" aria-label="원문 표시 방식"><button type="button" aria-pressed={preview === "document"} onClick={() => setPreview("document")}>문서 미리보기</button><button type="button" aria-pressed={preview === "text"} onClick={() => setPreview("text")}>텍스트 보기</button></div>}{scan.preview_html && preview === "document" ? <ResumeDocumentPreview html={scan.preview_html} blocks={scan.blocks} selected={active} suggestion={activeSuggestion} onSelect={block => { choose(block); setTab("suggestions"); }} /> : <div className="resume-source-scroll">{scan.blocks.map((block, index) => {
            const selected = active?.block_id === block.block_id;
            const start = selected && activeSuggestion?.block_id === block.block_id ? activeSuggestion.start : 0;
            const end = selected && activeSuggestion?.block_id === block.block_id ? activeSuggestion.end : Array.from(block.text).length;
            return <button type="button" key={block.block_id} ref={node => { if (node) blockNodes.current.set(block.block_id, node); else blockNodes.current.delete(block.block_id); }} className={`resume-block${selected ? " resume-block--selected" : ""}`} aria-pressed={selected} aria-label={`원문 문단 ${index + 1} 선택`} onClick={() => choose(block)}><small>{block.page ? `${block.page}쪽 · ` : ""}문단 {index + 1}{selected ? " · 선택됨" : ""}</small><span>{selected ? <>{pointSlice(block.text, 0, start)}<mark>{pointSlice(block.text, start, end)}</mark>{pointSlice(block.text, end)}</> : block.text}</span></button>;
          })}</div>}</section>
          <section className="resume-suggestions" aria-label="스펙 제안"><h4>확인이 필요한 제안</h4>
            {!suggestions.length && <p className="spec-empty">자동으로 연결할 역량을 찾지 못했어요. 원문 문단을 선택해 직접 추가하거나 AI 도움으로 찾아보세요.</p>}
            {suggestions.map(suggestion => {
              const block = scan.blocks.find(value => value.block_id === suggestion.block_id);
              const complete = saved.has(suggestion.suggestion_id);
              const duplicate = suggestion.competencies.some(item => existingCompetencyIds.includes(item.entity_id));
              const information = suggestion.category === "education" || suggestion.category === "other";
              return <article key={suggestion.suggestion_id} className={`resume-candidate${selectedSuggestion === suggestion.suggestion_id || !selectedSuggestion && selected === suggestion.block_id ? " resume-candidate--selected" : ""}`}><small>{suggestion.method === "KEYWORD" ? "키워드 발견" : "AI 제안"} · {SPEC_CATEGORIES.find(category => category.value === suggestion.category)?.label}</small><h5>{suggestion.title}</h5><blockquote>{suggestion.quote}</blockquote>{!!Object.keys(suggestion.fields ?? {}).length && <dl className="resume-fields">{Object.entries(suggestion.fields ?? {}).map(([name, value]) => <div key={name}><dt>{RESUME_FIELDS[name] ?? name}</dt><dd>{value}</dd></div>)}</dl>}<ul>{suggestion.competencies.map(item => <li key={item.entity_id}>{item.label} <small>{item.source === "ONET" ? `O*NET · ${item.original_label} · NCS 등가 아님` : "NCS"}</small></li>)}</ul>{information ? <p className="spec-help">정보 기록 · 역량 점수 미반영</p> : !suggestion.competencies.length && <p className="spec-help">연결 역량 없음 · 저장 전 선택 가능</p>}{duplicate && <p className="spec-help">이미 등록한 역량이에요. 중복된 경험인지 확인해 주세요.</p>}<div className="resume-card-actions"><button type="button" className="spec-secondary" disabled={!block} onClick={() => { if (block) { choose(block, suggestion); setTab("source"); } }}>원문 근거 보기</button><button type="button" className="spec-primary" disabled={disabled || !block || complete} onClick={() => { if (block) { choose(block, suggestion); review(block, suggestion); } }}>{complete ? "저장 완료" : "검토하고 추가"}</button><button type="button" className="spec-text-button" disabled={disabled} onClick={() => setExcluded(previous => new Set([...previous, suggestion.suggestion_id]))}>제외</button></div></article>;
            })}
          </section>
        </div>
        {active && <section className="resume-selected" aria-label="선택한 문단 작업"><h4>선택한 문단으로 작업</h4><blockquote>{active.text}</blockquote><div className="resume-card-actions"><button type="button" className="spec-secondary" disabled={disabled || saved.has(`manual-${active.block_id}`)} onClick={() => review(active)}>{saved.has(`manual-${active.block_id}`) ? "이 문단 저장 완료" : "이 문단으로 직접 스펙 추가"}</button><button type="button" className="spec-text-button" disabled={disabled || scanning || !status?.ai_available} onClick={() => { setAiOpen(true); setAiText(redactContacts(active.text)); setAiConsent(false); setAiNotice(null); }}>역량을 못 찾겠어요 · AI 도움</button></div>{!status?.ai_available && <p className="spec-help">AI가 연결되지 않았어요. 직접 역량을 검색하고 추가할 수 있어요.</p>}
          {aiOpen && <div className="resume-ai"><label>AI에 보낼 선택 구절<textarea value={aiText} maxLength={2000} rows={5} disabled={aiBusy || disabled} onChange={event => { setAiText(event.target.value); setAiConsent(false); }} /></label><p className="spec-help">이 구절만 {status?.ai_provider ?? "설정된 AI 서비스"}에 전송해요. 남은 개인정보·비공개 정보를 지워 주세요. 삭제한 내용은 원문 근거에서 제외돼요.</p><label className="spec-check"><input type="checkbox" checked={aiConsent} disabled={aiBusy || disabled} onChange={event => setAiConsent(event.target.checked)} />전송할 내용을 확인했고 AI 해석을 요청해요.</label><button type="button" className="spec-secondary" disabled={!aiConsent || !aiText.trim() || aiBusy || disabled} onClick={() => void interpret()}>{aiBusy ? "역량 제안 찾는 중…" : "이 구절만 AI로 해석"}</button></div>}
          {aiNotice && <p className="spec-notice" role="status">{aiNotice}</p>}
        </section>}
        <p className="spec-source-note">O*NET® · USDOL/ETA · CC BY 4.0 · Jobtology 한국어 번역. 자격·점수 진위 및 NCS 동등성 미검증.</p>
      </>}
    </>}
  </section>;
}
