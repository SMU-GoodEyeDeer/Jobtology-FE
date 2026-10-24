import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import type { ResumeBlock, ResumeSuggestion } from "../../services/types";
import { highlightSource, previewDocument, reviewSource, showDocumentPage, sourceMarks, zoomDocument } from "./resumePreview";

interface Props {
  readonly html: string;
  readonly blocks: ResumeBlock[];
  readonly selected?: ResumeBlock;
  readonly suggestion?: ResumeSuggestion;
  readonly suggestions?: ResumeSuggestion[];
  readonly saved?: ReadonlySet<string>;
  readonly excluded?: ReadonlySet<string>;
  readonly zoom?: number | null;
  readonly page?: number;
  readonly onZoom?: (zoom: number) => void;
  readonly onInfo?: (info: { zoom: number; pages: number }) => void;
  readonly onSelect: (block: ResumeBlock) => void;
}
const emptySet = new Set<string>();
const emptySuggestions: ResumeSuggestion[] = [];

export function ResumeDocumentPreview({ html, blocks, selected, suggestion, suggestions = emptySuggestions, saved = emptySet, excluded = emptySet, zoom = null, page = 1, onZoom, onInfo, onSelect }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(0), [missing, setMissing] = useState(false);
  const { preference } = useTheme();
  const source = useMemo(() => previewDocument(html, preference === "dark"), [html, preference]);
  const handlers = useRef({ onSelect, onZoom, onInfo, selected, suggestion, zoom });
  handlers.current = { onSelect, onZoom, onInfo, selected, suggestion, zoom };
  useEffect(() => {
    const iframe = frame.current, document = iframe?.contentDocument;
    if (!iframe || !document?.body) return;
    showDocumentPage(document, page);
    const resize = () => {
      if (!iframe.clientWidth) return;
      const applied = zoomDocument(document, iframe.clientWidth, zoom, iframe.clientHeight);
      handlers.current.onInfo?.({ zoom: applied, pages: Math.max(1, document.querySelectorAll(".document-page").length) });
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(iframe);
    return () => observer.disconnect();
  }, [loaded, zoom, page]);
  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (!document?.body) return;
    reviewSource(document, blocks, suggestions, saved, excluded);
    setMissing(!highlightSource(document, handlers.current.selected, handlers.current.suggestion));
  }, [loaded, blocks, suggestions, saved, excluded]);
  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (document?.body) setMissing(!highlightSource(document, selected, suggestion));
  }, [loaded, selected, suggestion]);
  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (!document?.body) return;
    const byNode = new Map<string, ResumeBlock>();
    const byLabel = new Map(blocks.map(block => [`resume-block:${block.block_id}`, block]));
    for (const block of blocks) if (block.source_node_id && !byNode.has(block.source_node_id)) byNode.set(block.source_node_id, block);
    for (const [index, block] of blocks.entries()) {
      const first = sourceMarks(document, block)[0] ?? [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(element => element.dataset.nodeId === block.source_node_id);
      if (first) {
        first.dataset.resumeSelectable = "true"; first.tabIndex = 0; first.setAttribute("role", "button");
        first.setAttribute("aria-label", `문단 ${index + 1}: ${Array.from(block.text).slice(0, 60).join("")} · 추출 항목 보기`);
      }
    }
    const blockAt = (target: EventTarget | null) => {
      const element = target as Element | null;
      if (!element?.closest) return;
      const marked = byLabel.get(element.closest<HTMLElement>("mark[data-label]")?.dataset.label ?? "");
      if (marked) return marked;
      let node = element.closest<HTMLElement>("[data-node-id]");
      while (node) { const block = byNode.get(node.dataset.nodeId ?? ""); if (block) return block; node = node.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null; }
    };
    let drag: { x: number; y: number; moved: boolean } | null = null, dragged = false;
    const select = (event: Event) => { if (dragged) return; const block = blockAt(event.target); if (block) handlers.current.onSelect(block); };
    const key = (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && blockAt(event.target)) { event.preventDefault(); dragged = false; select(event); }
      if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "0"].includes(event.key)) {
        event.preventDefault(); handlers.current.onZoom?.(event.key === "0" ? 100 : Math.max(25, Math.min(200, (handlers.current.zoom ?? 100) + (event.key === "-" ? -10 : 10))));
      }
    };
    let hoveredBlock: string | undefined;
    const hover = (event: MouseEvent) => { if (drag?.moved) return; const block = blockAt(event.target); if (hoveredBlock === block?.block_id) return; hoveredBlock = block?.block_id; highlightSource(document, block ?? handlers.current.selected, block ? undefined : handlers.current.suggestion); };
    const leave = () => { hoveredBlock = undefined; highlightSource(document, handlers.current.selected, handlers.current.suggestion); };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); handlers.current.onZoom?.(Math.max(25, Math.min(200, (handlers.current.zoom ?? 100) + (event.deltaY < 0 ? 10 : -10))));
    };
    const down = (event: PointerEvent) => { if (event.button === 0) { dragged = false; drag = { x: event.clientX, y: event.clientY, moved: false }; } };
    const move = (event: PointerEvent) => {
      if (!drag || !event.buttons) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) { document.scrollingElement?.scrollBy?.({ left: -dx, top: -dy }); drag.x = event.clientX; drag.y = event.clientY; event.preventDefault(); }
    };
    const up = () => { dragged = drag?.moved ?? false; drag = null; };
    document.addEventListener("click", select); document.addEventListener("keydown", key); document.addEventListener("mouseover", hover); document.addEventListener("mouseleave", leave);
    document.addEventListener("wheel", wheel, { passive: false }); document.addEventListener("pointerdown", down); document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    return () => {
      document.removeEventListener("click", select); document.removeEventListener("keydown", key); document.removeEventListener("mouseover", hover); document.removeEventListener("mouseleave", leave);
      document.removeEventListener("wheel", wheel); document.removeEventListener("pointerdown", down); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up);
    };
  }, [loaded, blocks]);
  return <div className="resume-preview-document">
    <iframe ref={frame} className="resume-document-frame" title="이력서 문서 미리보기" sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={source} onLoad={() => setLoaded(value => value + 1)} />
    {missing && <p className="resume-anchor-note" role="status">텍스트 보기에서 원문 근거를 확인해 주세요.</p>}
  </div>;
}
