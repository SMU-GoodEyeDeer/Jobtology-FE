import type { ResumeBlock, ResumeScan, ResumeSuggestion } from "../../services/types";
import { specDraft } from "../specs/specModel";
import type { SpecDraft } from "../specs/specModel";

export function pointSlice(text: string, start: number, end?: number): string {
  return Array.from(text).slice(start, end).join("");
}
export function redactContacts(text: string): string {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[이메일 삭제]")
    .replace(/(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}/g, "[전화번호 삭제]");
}
export function importedDraft(scan: ResumeScan, block: ResumeBlock, suggestion?: ResumeSuggestion): SpecDraft {
  const quote = suggestion?.quote ?? block.text;
  const start = suggestion?.start ?? 0;
  const end = suggestion?.end ?? Array.from(block.text).length;
  if (!quote || pointSlice(block.text, start, end) !== quote) throw new Error("원문 근거를 확인하지 못했어요. 해당 문단을 직접 선택해 주세요.");
  return { ...specDraft(), category: suggestion?.category ?? "skill", title: suggestion?.title ?? "",
    proficiency: "", selected: suggestion?.competencies ?? [], evidence: quote, source: "DOCUMENT_IMPORT",
    score: suggestion?.score == null ? "" : String(suggestion.score), score_max: suggestion?.score_max == null ? "" : String(suggestion.score_max),
    document_evidence: { document_sha256: scan.document_sha256, parser_revision: scan.parser_revision,
      block_id: block.block_id, text_hash: block.text_hash, quote, start, end, method: suggestion?.method ?? "SELECTED_TEXT" },
  };
}
// Model offsets refer to the edited/redacted passage. Re-anchor to the original only
// when exact and unambiguous; never silently use the first repeated occurrence.
export function anchorAiSuggestion(suggestion: ResumeSuggestion, sent: string, block: ResumeBlock): ResumeSuggestion | null {
  if (!suggestion.quote) return null;
  if (pointSlice(sent, suggestion.start, suggestion.end) !== suggestion.quote) return null;
  if (sent === block.text) return { ...suggestion, block_id: block.block_id };
  const original = Array.from(block.text), quote = Array.from(suggestion.quote);
  const occurrences: number[] = [];
  for (let start = 0; start <= original.length - quote.length; start++) {
    if (original.slice(start, start + quote.length).join("") === suggestion.quote) occurrences.push(start);
  }
  if (!quote.length || occurrences.length !== 1) return null;
  return { ...suggestion, block_id: block.block_id, start: occurrences[0], end: occurrences[0] + quote.length };
}
export function resumeError(cause: unknown): string {
  const error = cause as { status?: number; detail?: { error?: { code?: string; request_id?: string } } };
  const code = error.detail?.error?.code;
  const messages: Record<string, string> = {
    FILE_TOO_LARGE: "파일은 10MB 이하로 올려 주세요.", PAGE_LIMIT: "PDF는 20쪽 이하로 나눠서 올려 주세요.",
    ENCRYPTED_DOCUMENT: "암호를 해제한 문서를 올려 주세요.", FORMAT_MISMATCH: "확장자와 문서 형식이 일치하지 않아요. 문서를 다시 저장한 뒤 올려 주세요.",
    ARCHIVE_LIMIT: "문서의 압축 크기나 내부 파일이 제한을 넘었어요. PDF로 저장하거나 문서를 줄여 주세요.",
    UNSAFE_XML: "이 문서의 내부 형식을 처리할 수 없어요. 새 DOCX 또는 PDF로 저장해 주세요.",
    PARSE_TIMEOUT: "문서를 읽는 시간이 초과됐어요. 문서를 줄이거나 PDF로 저장해 주세요.",
    SCAN_ALREADY_RUNNING: "이 계정의 다른 이력서를 처리 중이에요. 잠시 후 다시 시도해 주세요.",
    SCANNER_BUSY: "현재 문서 처리 요청이 많아요. 잠시 후 다시 시도해 주세요.",
    FORMAT_UNAVAILABLE: "현재 서버에서 이 형식을 처리할 수 없어요. 지원 형식을 확인해 주세요.",
    SCANNER_UNAVAILABLE: "현재 문서 처리 서비스를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.",
    PARSER_ISOLATION_UNAVAILABLE: "현재 서버의 문서 처리 환경을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.",
    UPLOAD_TIMEOUT: "파일 업로드 시간이 초과됐어요. 연결 상태를 확인하고 다시 올려 주세요.",
    EMPTY_DOCUMENT: "파일이 비어 있어요. 내용이 있는 문서를 올려 주세요.",
    UNREADABLE_DOCUMENT: "문서의 텍스트를 읽지 못했어요. 다시 시도하거나 DOCX 등 다른 형식으로 저장해 주세요.",
    AI_UNAVAILABLE: "AI 도움을 연결하지 못했어요. 직접 검토하거나 잠시 후 다시 시도해 주세요.",
  };
  const message = code && messages[code] ? messages[code] : error.status === 429 ? "요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요."
    : error.status === 401 ? "로그인 상태를 확인하고 다시 시도해 주세요."
    : "문서를 처리하지 못했어요. 다른 형식으로 저장하거나 직접 스펙을 추가해 주세요.";
  const reference = error.detail?.error?.request_id;
  return reference && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(reference)
    ? `${message} (문의 코드: ${reference})` : message;
}
