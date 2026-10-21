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
  EXTRACTED_TEXT_REVIEW: "추출한 텍스트를 표시해요. 원본의 배치·표·글꼴과 다를 수 있고 누락이나 읽기 순서 오류가 있을 수 있어요.",
  KEYWORDS_ARE_NOT_PROOF: "키워드는 학습 희망·타인의 경험에도 나올 수 있어요. 본인이 수행한 내용인지 확인해야 하며 자동 저장·반영되지 않아요.",
  AI_ENTRIES_REQUIRE_REVIEW: "AI가 읽은 항목은 본인 확인이 필요해요. 원문 근거와 각 필드를 검토하고 저장해 주세요. 실력이나 자격을 검증한 결과는 아니에요.",
  PREVIEW_UNAVAILABLE: "문서 미리보기를 만들지 못했어요. 추출한 텍스트에서 원문 근거를 확인해 주세요.",
  HIDDEN_TEXT_REMOVED: "DOCX에 명시적으로 숨기거나 삭제한 텍스트를 제외했어요.",
  OCR_REQUIRED: "이미지 위주이거나 읽지 못한 PDF 페이지가 있어요. OCR 처리는 아직 지원하지 않아요. 해당 내용은 직접 입력하거나 텍스트가 있는 PDF를 올려 주세요.",
  TEXT_TRUNCATED: "문서가 길어 일부 텍스트만 표시해요. 필요한 부분을 나눠 올려 주세요.",
  SUGGESTIONS_TRUNCATED: "자동 제안은 최대 200개예요. 나머지 문단도 직접 선택해서 추가할 수 있어요.",
  NO_READABLE_TEXT: "읽을 수 있는 텍스트가 없어요. 텍스트가 있는 문서나 직접 입력을 이용해 주세요.",
  NCS_CATALOG_UNAVAILABLE: "현재 목표에 사용할 NCS 카탈로그를 확인하지 못했어요. O*NET 후보를 검토하거나 카탈로그가 연결된 뒤 다시 검색해 주세요.",
};

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
    } catch (cause) { if (id === generation.current) setError(resumeError(cause)); }
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
    } catch (cause) { if (id === generation.current) setError(resumeError(cause)); }
    finally { if (id === generation.current) setAiBusy(false); }
  }
  const suggestions = scan?.suggestions.filter(item => !excluded.has(item.suggestion_id)) ?? [];
  return <section className="resume-scanner" aria-label="이력서에서 스펙 가져오기">
    <header className="resume-heading"><div><h3 ref={heading} tabIndex={-1}>이력서에서 가져오기</h3><p>파일 읽기 → 원문·제안 확인 → 수행 수준 선택 → 스펙 저장</p></div><button type="button" className="spec-secondary" disabled={disabled} onClick={onClose}>가져오기 끝내기</button></header>
    <details className="spec-explainer resume-privacy"><summary>파일은 처리 후 삭제돼요 · AI 분석은 동의 후 실행해요</summary><p className="spec-help">파일은 서버에서 읽은 뒤 바로 삭제해요. 비정상 종료 때 남은 임시 파일은 15분 후 정리 대상이 돼요. 미리보기는 이 화면에만 유지돼요. 확인해서 저장한 인용·역량·정보만 내 스펙에 남아요. AI 분석을 선택하면 추출한 문단을 AI에 보내고, 선택하지 않으면 키워드로만 찾아요.</p></details>
    {!status && <p role="status" className="spec-help">{statusError ? <><span>지원 형식을 확인하지 못했어요. </span><button type="button" onClick={() => void loadStatus()}>다시 확인</button></> : "지원 형식을 확인하는 중이에요…"}</p>}
    {status && <div className="resume-upload"><label className="spec-check resume-bulk-consent"><input type="checkbox" checked={documentConsent} disabled={!status.ai_available || disabled || scanning || aiBusy} onChange={event => setDocumentConsent(event.target.checked)} />문단별 AI 분석 · 추출한 문단을 {status.ai_provider ?? "설정된 AI"}에 보내는 데 동의해요</label><p className="spec-help">AI 분석: PDF 최대 {status.max_pdf_pages}쪽 · {status.ai_max_paragraphs ?? 64}문단 · {(status.ai_max_characters ?? 12000).toLocaleString()}자. 업로드 전에 이름·주소·비공개 정보를 확인해 주세요.</p><label>{documentConsent ? "PDF 선택하고 AI로 항목 찾기" : "이력서·경력기술서 파일"}<input ref={input} type="file" accept={documentConsent ? ".pdf" : status.formats.map(format => `.${format}`).join(",")} disabled={disabled || scanning || aiBusy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label><p className="spec-help">{documentConsent ? "PDF" : status.formats.map(format => format.toUpperCase()).join(" · ")} · 최대 10MB · PDF 최대 {status.max_pdf_pages}쪽 · 암호 해제 필요</p>{!status.ai_available && <p className="spec-help">AI 연결을 확인하지 못했어요. 문서를 읽고 직접 검토할 수 있어요.</p>}{scan && <p className="spec-help">다른 파일을 선택하면 현재 미리보기와 미저장 제안을 지워요. 저장한 스펙은 유지해요.</p>}</div>}
    {scanning && <div className="resume-progress" role="status">{progress ? <><progress max={Math.max(1, progress.total)} value={progress.completed} aria-label="AI 문단 분석 진행" /><span>{progress.completed}/{progress.total}문단 분석 · 항목이 도착하는 대로 표시해요</span></> : <span>문서를 읽는 중이에요… 최대 {status?.parse_timeout_seconds ?? 60}초 정도 걸릴 수 있어요.</span>}<button type="button" onClick={cancel}>{progress ? "분석 중단" : "읽기 취소"}</button></div>}
    {analysisNotice && <p className="spec-notice" role="status">{analysisNotice}</p>}
    {error && <p className="spec-error" role="alert">{error}</p>}
    {scan && <>
      <ul className="resume-warnings">{scan.warnings.map(code => <li key={code}>{warningText[code] ?? "일부 문서 정보를 읽지 못했어요. 원문을 확인해 주세요."}</li>)}{!!scan.skipped_pages.length && <li>읽지 못한 페이지: {scan.skipped_pages.join(", ")}</li>}</ul>
      {!!scan.blocks.length && <>
        <div className="resume-tabs" role="group" aria-label="이력서 검토 보기"><button type="button" aria-pressed={tab === "source"} onClick={() => setTab("source")}>추출한 원문</button><button type="button" aria-pressed={tab === "suggestions"} onClick={() => setTab("suggestions")}>제안 {suggestions.length}개</button></div>
        <div className={`resume-workspace resume-workspace--${tab}`}>
          <section className="resume-source" aria-label="추출한 원문"><h4>추출한 원문</h4><p className="spec-help">원문이나 제안을 선택하면 서로 연결해서 보여 줘요. 미리보기 배치는 원본과 다를 수 있어요.</p>{scan.preview_html && <div className="resume-tabs" role="group" aria-label="원문 표시 방식"><button type="button" aria-pressed={preview === "document"} onClick={() => setPreview("document")}>문서 미리보기</button><button type="button" aria-pressed={preview === "text"} onClick={() => setPreview("text")}>텍스트 보기</button></div>}{scan.preview_html && preview === "document" ? <ResumeDocumentPreview html={scan.preview_html} blocks={scan.blocks} selected={active} suggestion={activeSuggestion} onSelect={block => { choose(block); setTab("suggestions"); }} /> : <div className="resume-source-scroll">{scan.blocks.map((block, index) => {
            const selected = active?.block_id === block.block_id;
            const start = selected && activeSuggestion?.block_id === block.block_id ? activeSuggestion.start : 0;
            const end = selected && activeSuggestion?.block_id === block.block_id ? activeSuggestion.end : Array.from(block.text).length;
            return <button type="button" key={block.block_id} ref={node => { if (node) blockNodes.current.set(block.block_id, node); else blockNodes.current.delete(block.block_id); }} className={`resume-block${selected ? " resume-block--selected" : ""}`} aria-pressed={selected} aria-label={`원문 문단 ${index + 1} 선택`} onClick={() => choose(block)}><small>{block.page ? `${block.page}쪽 · ` : ""}문단 {index + 1}{selected ? " · 선택됨" : ""}</small><span>{selected ? <>{pointSlice(block.text, 0, start)}<mark>{pointSlice(block.text, start, end)}</mark>{pointSlice(block.text, end)}</> : block.text}</span></button>;
          })}</div>}</section>
          <section className="resume-suggestions" aria-label="스펙 제안"><h4>확인이 필요한 제안</h4><p className="spec-help">수행 수준은 문서에서 추정하지 않아요. 같은 역량은 가장 높은 근거 하나만 반영하며 중복으로 합산하지 않아요.</p>
            {!suggestions.length && <p className="spec-empty">자동으로 연결할 역량을 찾지 못했어요. 원문 문단을 선택해 직접 추가하거나 AI 도움으로 찾아보세요.</p>}
            {suggestions.map(suggestion => {
              const block = scan.blocks.find(value => value.block_id === suggestion.block_id);
              const complete = saved.has(suggestion.suggestion_id);
              const duplicate = suggestion.competencies.some(item => existingCompetencyIds.includes(item.entity_id));
              const information = suggestion.category === "education" || suggestion.category === "other";
              return <article key={suggestion.suggestion_id} className={`resume-candidate${selectedSuggestion === suggestion.suggestion_id || !selectedSuggestion && selected === suggestion.block_id ? " resume-candidate--selected" : ""}`}><small>{suggestion.method === "KEYWORD" ? "키워드 발견" : "AI 제안"} · {SPEC_CATEGORIES.find(category => category.value === suggestion.category)?.label} · 본인 확인 필요</small><h5>{suggestion.title}</h5><blockquote>{suggestion.quote}</blockquote>{!!Object.keys(suggestion.fields ?? {}).length && <dl className="resume-fields">{Object.entries(suggestion.fields ?? {}).map(([name, value]) => <div key={name}><dt>{RESUME_FIELDS[name] ?? name}</dt><dd>{value}</dd></div>)}</dl>}<ul>{suggestion.competencies.map(item => <li key={item.entity_id}>{item.label} <small>{item.source === "ONET" ? `O*NET · ${item.original_label} · NCS 등가 아님` : "NCS"}</small></li>)}</ul>{information ? <p className="spec-help">기록으로 보관해요. 역량 점수에 자동 반영되지 않아요.</p> : !suggestion.competencies.length && <p className="spec-help">아직 연결한 역량이 없어요. 저장 전 직접 선택할 수 있어요.</p>}{duplicate && <p className="spec-help">이미 등록한 역량이 포함돼 있어요. 같은 경험을 중복 등록하지 않았는지 확인해 주세요.</p>}<div className="resume-card-actions"><button type="button" className="spec-secondary" disabled={!block} onClick={() => { if (block) { choose(block, suggestion); setTab("source"); } }}>원문 근거 보기</button><button type="button" className="spec-primary" disabled={disabled || !block || complete} onClick={() => { if (block) { choose(block, suggestion); review(block, suggestion); } }}>{complete ? "저장 완료" : "검토하고 추가"}</button><button type="button" className="spec-text-button" disabled={disabled} onClick={() => setExcluded(previous => new Set([...previous, suggestion.suggestion_id]))}>제외</button></div></article>;
            })}
          </section>
        </div>
        {active && <section className="resume-selected" aria-label="선택한 문단 작업"><h4>선택한 문단으로 작업</h4><blockquote>{active.text}</blockquote><div className="resume-card-actions"><button type="button" className="spec-secondary" disabled={disabled || saved.has(`manual-${active.block_id}`)} onClick={() => review(active)}>{saved.has(`manual-${active.block_id}`) ? "이 문단 저장 완료" : "이 문단으로 직접 스펙 추가"}</button><button type="button" className="spec-text-button" disabled={disabled || scanning || !status?.ai_available} onClick={() => { setAiOpen(true); setAiText(redactContacts(active.text)); setAiConsent(false); setAiNotice(null); }}>역량을 못 찾겠어요 · AI 도움</button></div>{!status?.ai_available && <p className="spec-help">AI가 연결되지 않았어요. 직접 역량을 검색하고 추가할 수 있어요.</p>}
          {aiOpen && <div className="resume-ai"><label>AI에 보낼 선택 구절<textarea value={aiText} maxLength={2000} rows={5} disabled={aiBusy || disabled} onChange={event => { setAiText(event.target.value); setAiConsent(false); }} /></label><p className="spec-help">이 구절만 {status?.ai_provider ?? "설정된 AI 서비스"}에 전송돼요. 이메일·전화번호를 일부 가렸지만 이름, 주소, 회사의 비공개 정보 등은 직접 확인하고 지워 주세요. 삭제한 구절은 제안의 원문 근거가 될 수 없어요.</p><label className="spec-check"><input type="checkbox" checked={aiConsent} disabled={aiBusy || disabled} onChange={event => setAiConsent(event.target.checked)} />전송할 내용을 확인했고 AI 해석을 요청해요.</label><button type="button" className="spec-secondary" disabled={!aiConsent || !aiText.trim() || aiBusy || disabled} onClick={() => void interpret()}>{aiBusy ? "역량 제안 찾는 중…" : "이 구절만 AI로 해석"}</button></div>}
          {aiNotice && <p className="spec-notice" role="status">{aiNotice}</p>}
        </section>}
        <p className="spec-source-note">O*NET® 정보: USDOL/ETA · CC BY 4.0. 한국어 역량명은 Jobtology 번역이에요. 문서의 자격증·시험 점수는 진위나 NCS와의 동등성을 검증하지 않아요.</p>
      </>}
    </>}
  </section>;
}
