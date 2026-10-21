import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import type { ResumeBlock, ResumeSuggestion } from "../../services/types";
import { highlightSource, previewDocument, sourceMarks, zoomDocument } from "./resumePreview";

interface Props {
  readonly html: string;
  readonly blocks: ResumeBlock[];
  readonly selected?: ResumeBlock;
  readonly suggestion?: ResumeSuggestion;
  readonly onSelect: (block: ResumeBlock) => void;
}

export function ResumeDocumentPreview({ html, blocks, selected, suggestion, onSelect }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(0), [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null), [appliedZoom, setAppliedZoom] = useState(100);
  const { preference } = useTheme();
  useEffect(() => {
    const iframe = frame.current, document = iframe?.contentDocument;
    if (!iframe || !document?.body) return;
    const resize = () => {
      if (!iframe.clientWidth) return;
      setAppliedZoom(zoomDocument(document, iframe.clientWidth, zoom));
      setMissing(!highlightSource(document, selected, suggestion));
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(iframe);
    return () => observer.disconnect();
  }, [loaded, zoom, selected, suggestion]);
  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (!document?.body) return;
    const byNode = new Map<string, ResumeBlock>();
    const byLabel = new Map(blocks.map(block => [`resume-block:${block.block_id}`, block]));
    for (const block of blocks) if (block.source_node_id && !byNode.has(block.source_node_id)) byNode.set(block.source_node_id, block);
    for (const block of blocks) {
      const first = sourceMarks(document, block)[0];
      if (first) {
        first.dataset.resumeSelectable = "true"; first.tabIndex = 0;
        first.setAttribute("role", "button");
        first.setAttribute("aria-label", `문단 ${blocks.indexOf(block) + 1}: ${Array.from(block.text).slice(0, 60).join("")} · 추출 항목 보기`);
      }
    }
    for (const element of document.querySelectorAll<HTMLElement>("[data-node-id]")) {
      const block = byNode.get(element.dataset.nodeId ?? "");
      if (block && !sourceMarks(document, block).length) {
        element.dataset.resumeSelectable = "true"; element.tabIndex = 0;
        element.setAttribute("role", "button");
        element.setAttribute("aria-label", `문단 ${blocks.indexOf(block) + 1}: ${Array.from(block.text).slice(0, 60).join("")} · 추출 항목 보기`);
      }
    }
    const select = (event: Event) => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const block = byLabel.get(target.closest<HTMLElement>("mark[data-label]")?.dataset.label ?? "");
      if (block) { onSelect(block); return; }
      let element = target.closest<HTMLElement>("[data-node-id]");
      while (element) {
        const block = byNode.get(element.dataset.nodeId ?? "");
        if (block) { onSelect(block); return; }
        element = element.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
      }
    };
    const key = (event: KeyboardEvent) => { if ((event.key === "Enter" || event.key === " ") && (event.target as Element | null)?.closest?.("[data-resume-selectable]")) { event.preventDefault(); select(event); } };
    document.addEventListener("click", select); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", select); document.removeEventListener("keydown", key); };
  }, [loaded, blocks, onSelect]);
  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (document?.body) setMissing(!highlightSource(document, selected, suggestion));
  }, [loaded, selected, suggestion]);
  return <>
    <div className="resume-preview-toolbar">
      <label>확대 <select aria-label="문서 확대 비율" value={zoom ?? "fit"} onChange={event => setZoom(event.target.value === "fit" ? null : Number(event.target.value))}><option value="fit">너비에 맞춤</option>{[50, 75, 100, 125, 150].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
      <span role="status">{selected?.page ? `${selected.page}쪽 · ` : ""}{selected ? `문단 ${blocks.indexOf(selected) + 1} · ` : ""}{appliedZoom}%</span>
    </div>
    <iframe ref={frame} className="resume-document-frame" title="이력서 문서 미리보기" sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={previewDocument(html, preference === "dark")} onLoad={() => setLoaded(value => value + 1)} />
    {missing && <p className="spec-help">이 구절은 문서 배치와 연결하지 못했어요. 텍스트 보기에서 정확한 원문 근거를 확인해 주세요.</p>}
  </>;
}
