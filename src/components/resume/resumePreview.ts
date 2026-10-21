import type { ResumeBlock, ResumeSuggestion } from "../../services/types";
import { pointSlice } from "./resumeModel";

export function previewDocument(fragment: string, dark: boolean): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>
  *{box-sizing:border-box}body{margin:0;padding:24px;font:14px/1.8 system-ui,sans-serif;overflow-wrap:anywhere;background:${dark ? "#171e2d" : "#fff"};color:${dark ? "#edf0f8" : "#233047"}}p{margin:.55em 0}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{padding:8px;border:1px solid ${dark ? "#394359" : "#d9dfeb"};vertical-align:top}h1,h2,h3,h4{line-height:1.5}div,section,article{max-width:100%}[data-resume-selectable]{cursor:pointer;border-radius:3px}[data-resume-selectable]:hover,[data-resume-selectable]:focus-visible{outline:2px solid ${dark ? "#b3a5ff" : "#6550df"};outline-offset:3px}mark[data-resume-highlight]{background:${dark ? "#514088" : "#e4ddff"};color:inherit;border-radius:2px}@media(max-width:450px){body{padding:14px;font-size:13px}td,th{padding:5px}}
  </style></head><body>${fragment}</body></html>`;
}

export function highlightSource(document: Document, block?: ResumeBlock, suggestion?: ResumeSuggestion): boolean {
  for (const mark of document.querySelectorAll("mark[data-resume-highlight]")) {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes); parent?.normalize();
  }
  if (!block) return true;
  if (!block.text) return false;
  const element = [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(node => node.dataset.nodeId === block.source_node_id);
  if (!element) return false;
  const text = element.textContent ?? "";
  let blockStart = block.source_start ?? 0;
  if (pointSlice(text, blockStart, blockStart + Array.from(block.text).length) !== block.text) {
    const occurrences: number[] = [];
    let cursor = 0;
    while ((cursor = text.indexOf(block.text, cursor)) >= 0) {
      occurrences.push(Array.from(text.slice(0, cursor)).length); cursor += 1;
      if (occurrences.length > 1) break;
    }
    if (occurrences.length !== 1) return false;
    blockStart = occurrences[0];
  }
  const quote = suggestion?.quote ?? block.text, start = blockStart + (suggestion?.start ?? 0);
  const end = blockStart + (suggestion?.end ?? Array.from(block.text).length);
  if (!quote || pointSlice(text, start, end) !== quote) return false;
  // Model/parser offsets count Unicode points; DOM Range offsets count UTF-16 units.
  const from = pointSlice(text, 0, start).length, to = pointSlice(text, 0, end).length;
  const walker = document.createTreeWalker(element, 4 /* SHOW_TEXT */);
  const spans: { node: Text; from: number; to: number }[] = [];
  let node: Node | null, cursor = 0;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (cursor < to && cursor + length > from) spans.push({ node: node as Text, from: Math.max(0, from - cursor), to: Math.min(length, to - cursor) });
    cursor += length;
  }
  for (const span of spans.reverse()) {
    const range = document.createRange(); range.setStart(span.node, span.from); range.setEnd(span.node, span.to);
    const mark = document.createElement("mark"); mark.dataset.resumeHighlight = "true"; range.surroundContents(mark);
  }
  element.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  return true;
}
