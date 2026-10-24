import type { ResumeBlock, ResumeSuggestion } from "../../services/types";
import { pointSlice } from "./resumeModel";

const nativeLabel = (block: ResumeBlock) => `resume-block:${block.block_id}`;
export function sourceMarks(document: Document, block: ResumeBlock): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("mark[data-label]")].filter(mark => mark.dataset.label === nativeLabel(block));
}

export function previewDocument(html: string, dark: boolean): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const policy = document.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";
  document.head.prepend(policy);
  const style = document.createElement("style");
  // Keep native paper, typography, tables and page dimensions in both app themes.
  // Only viewer chrome and annotation interaction belong to the frontend.
  style.textContent = `html{background:${dark ? "#171e2d" : "#eceef3"};color-scheme:light}body{margin:16px auto;background:transparent;min-width:0;box-sizing:border-box}body:not(:has(.document-page)){background:#fff;padding:24px;box-sizing:border-box}.document-page{color:#1a1a1a}mark[data-label^="resume-block:"]{background:transparent!important;color:inherit;padding:0!important;border-radius:0!important;cursor:pointer}[data-resume-selectable]{cursor:pointer}[data-resume-selectable]:hover,[data-resume-selectable]:focus-visible{outline:2px solid #6550df;outline-offset:3px}mark[data-label][data-resume-active]{background:#f0ecff!important}mark[data-resume-highlight]{background:#d9ceff!important;color:#24164f!important;border-radius:2px;box-shadow:0 0 0 1px #8b74e8}mark[data-resume-review="added"]{background:#d2f2dd!important;color:#174f32!important}mark[data-resume-review="excluded"]{background:#ffe0e2!important;color:#88212c!important}mark[data-resume-review] mark[data-resume-highlight]{background:inherit!important;color:inherit!important}mark[data-resume-highlight]{outline:1px solid #8b74e8}html{scrollbar-width:thin;overscroll-behavior:contain;overflow:hidden}body{user-select:none}`;
  document.head.append(style);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

export function zoomDocument(document: Document, width: number, percent: number | null, height?: number): number {
  document.body.style.zoom = "1";
  const pages = [...document.querySelectorAll<HTMLElement>(".document-page")];
  const pageWidth = Math.max(0, ...pages.map(page => page.offsetWidth));
  document.body.style.width = pageWidth ? `${pageWidth + 32}px` : "";
  const pageHeight = Math.max(0, ...pages.filter(page => !page.hidden).map(page => page.offsetHeight));
  const fitHeight = height && pageHeight ? (height - 32) / (pageHeight + 32) : 1;
  const zoom = percent !== null ? percent / 100 : pageWidth ? Math.min(1, Math.max(.1, Math.min((width - 16) / (pageWidth + 32), fitHeight))) : 1;
  document.body.style.zoom = String(zoom);
  return Math.round(zoom * 100);
}

export function highlightSource(document: Document, block?: ResumeBlock, suggestion?: ResumeSuggestion): boolean {
  for (const mark of document.querySelectorAll("mark[data-resume-highlight]")) {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes); parent?.normalize();
  }
  for (const mark of document.querySelectorAll("[data-resume-active]")) mark.removeAttribute("data-resume-active");
  if (!block) return true;
  if (!block.text || suggestion && suggestion.block_id !== block.block_id) return false;
  const native = sourceMarks(document, block);
  const element = [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(node => node.dataset.nodeId === block.source_node_id);
  if (!native.length && !element) return false;
  // Native markers identify split paragraphs and text inside tables without including
  // generated list markers. Exact quote ranges can span several styled native runs.
  const roots = native.length ? native : [element!];
  const text = roots.map(root => root.textContent ?? "").join("").replaceAll("\u00a0", " ");
  const displayed = (source: string) => source.replaceAll("\t", "    ").replaceAll("\u00a0", " ");
  const blockStart = native.length ? 0 : block.source_start ?? 0;
  // Legacy/node-only previews keep their strict, unique-source fallback.
  const expected = displayed(block.text);
  if (native.length && text !== expected) return false;
  let from = native.length ? 0 : pointSlice(text, 0, blockStart).length;
  if (text.slice(from, from + expected.length) !== expected) {
    const first = text.indexOf(expected);
    if (first < 0 || text.indexOf(expected, first + 1) >= 0) return false;
    from = first;
  }
  const quote = suggestion?.quote ?? block.text, start = suggestion?.start ?? 0;
  const end = suggestion?.end ?? Array.from(block.text).length;
  if (!quote || pointSlice(block.text, start, end) !== quote) return false;
  const to = from + displayed(pointSlice(block.text, 0, end)).length;
  from += displayed(pointSlice(block.text, 0, start)).length;
  const spans: { node: Text; from: number; to: number }[] = [];
  let cursor = 0;
  for (const root of roots) {
    const walker = document.createTreeWalker(root, 4 /* SHOW_TEXT */);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length ?? 0;
      if (cursor < to && cursor + length > from) spans.push({ node: node as Text, from: Math.max(0, from - cursor), to: Math.min(length, to - cursor) });
      cursor += length;
    }
  }
  if (!spans.length) return false;
  for (const mark of native) mark.dataset.resumeActive = "true";
  for (const span of spans.reverse()) {
    const range = document.createRange(); range.setStart(span.node, span.from); range.setEnd(span.node, span.to);
    const mark = document.createElement("mark"); mark.dataset.resumeHighlight = "true"; range.surroundContents(mark);
  }
  return true;
}

export type ResumeReviewState = "added" | "excluded";
/** Apply exact source ranges without scrolling or changing native text/formatting. */
export function reviewSource(document: Document, blocks: ResumeBlock[], suggestions: ResumeSuggestion[], saved: ReadonlySet<string>, excluded: ReadonlySet<string>) {
  highlightSource(document);
  for (const mark of document.querySelectorAll("mark[data-resume-review]")) {
    const parent = mark.parentNode; mark.replaceWith(...mark.childNodes); parent?.normalize();
  }
  for (const block of blocks) {
    const entries = suggestions.filter(item => item.block_id === block.block_id);
    if (saved.has(`manual-${block.block_id}`) && highlightSource(document, block)) {
      for (const mark of document.querySelectorAll<HTMLElement>("mark[data-resume-highlight]")) { mark.dataset.resumeReview = "added"; delete mark.dataset.resumeHighlight; }
    }
    for (const entry of entries) {
      const state = saved.has(entry.suggestion_id) ? "added" : excluded.has(entry.suggestion_id) ? "excluded" : null;
      if (!state || !highlightSource(document, block, entry)) continue;
      for (const mark of document.querySelectorAll<HTMLElement>("mark[data-resume-highlight]")) { mark.dataset.resumeReview = state; delete mark.dataset.resumeHighlight; }
    }
  }
  highlightSource(document);
}

export function showDocumentPage(document: Document, page: number) {
  const pages = [...document.querySelectorAll<HTMLElement>(".document-page")];
  pages.forEach((element, index) => { element.hidden = index + 1 !== page; element.style.display = element.hidden ? "none" : ""; });
}
