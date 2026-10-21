// @vitest-environment jsdom
import { expect, it } from "vitest";
import { highlightSource, previewDocument, zoomDocument } from "./resumePreview";
import type { ResumeBlock, ResumeSuggestion } from "../../services/types";

const block: ResumeBlock = { block_id: "block", text: "😀 Python Python", text_hash: "a".repeat(64), page: 1, source_node_id: "p.1", source_start: 0 };
const suggestion: ResumeSuggestion = { suggestion_id: "id", block_id: block.block_id, title: "Python", category: "skill", quote: "Python", start: 9, end: 15, competencies: [], method: "AI_ASSISTED", score: null, score_max: null };
it("highlights the correct Unicode occurrence across runs without destroying formatting", () => {
  const doc = new DOMParser().parseFromString('<p data-node-id="p.1">😀 Python <b>Py</b><span>thon</span></p>', "text/html");
  expect(highlightSource(doc, block, suggestion)).toBe(true);
  expect([...doc.querySelectorAll("mark")].map(mark => mark.textContent).join("")).toBe("Python");
  expect(doc.querySelector("b mark")?.textContent).toBe("Py");
  expect(doc.body.textContent).toBe(block.text);
  expect(highlightSource(doc, block)).toBe(true);
  expect(doc.querySelector("b")?.textContent).toBe("Py");
  expect([...doc.querySelectorAll("mark")].map(mark => mark.textContent).join("")).toBe(block.text);
});
it("refuses missing or ambiguous anchors instead of selecting the first matching text", () => {
  const doc = new DOMParser().parseFromString('<p data-node-id="p.1">prefix Python Python</p>', "text/html");
  expect(highlightSource(doc, { ...block, text: "Python", source_start: 0 })).toBe(false);
  expect(doc.querySelector("mark")).toBeNull();
  expect(highlightSource(doc, { ...block, source_node_id: "absent" })).toBe(false);
});
it("wraps the sanitized fragment with script/network blocking CSP and theme colors", () => {
  const doc = new DOMParser().parseFromString(previewDocument('<p data-node-id="p.1">본문</p>', true), "text/html");
  expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content")).toContain("script-src 'none'");
  expect(doc.querySelector("style")?.textContent).toContain("#171e2d");
  expect(doc.querySelector("p")?.dataset.nodeId).toBe("p.1");
});

it("keeps native styles, page geometry, columns and table formatting instead of reflowing them", () => {
  const html = '<html><head><style>.document-page{width:595pt}td{padding:0}</style></head><body><section class="document-page" style="width:595pt;min-height:842pt"><div class="document-page__content" style="padding:48pt"><table style="width:250pt"><tr><td>원문</td></tr></table></div></section></body></html>';
  const doc = new DOMParser().parseFromString(previewDocument(html, true), "text/html");
  expect(doc.querySelector("style")?.textContent).toBe(".document-page{width:595pt}td{padding:0}");
  expect(doc.querySelector("section")?.getAttribute("style")).toContain("min-height:842pt");
  expect(doc.querySelector("table")?.getAttribute("style")).toBe("width:250pt");
  expect(doc.querySelectorAll("html,body")).toHaveLength(2);
  const page = doc.querySelector("section")!;
  Object.defineProperty(page, "offsetWidth", { value: 800 });
  expect(zoomDocument(doc, 432, null)).toBe(50);
  expect(zoomDocument(doc, 432, 100)).toBe(100);
});

it("uses native block annotations across runs, excluding generated list markers and another split block", () => {
  const split = { ...block, block_id: "b".repeat(24), text: "😀 Python\tPython", source_start: 1800 };
  const label = `resume-block:${split.block_id}`;
  const doc = new DOMParser().parseFromString(`<p data-node-id="p.1"><span class="document-list-marker">1.</span><mark data-label="resume-block:other">earlier fragment</mark><mark data-label="${label}">😀 Python&nbsp;&nbsp;&nbsp;&nbsp;<b>Py</b></mark><mark data-label="${label}">thon</mark></p>`, "text/html");
  expect(highlightSource(doc, split, { ...suggestion, block_id: split.block_id })).toBe(true);
  expect([...doc.querySelectorAll("mark[data-resume-highlight]")].map(mark => mark.textContent).join("")).toBe("Python");
  expect(doc.querySelectorAll("[data-resume-active]")).toHaveLength(2);
  expect(doc.querySelector(".document-list-marker mark")).toBeNull();
  expect(highlightSource(doc, split)).toBe(true);
  expect(doc.querySelectorAll("mark[data-label]")).toHaveLength(3);
  expect(highlightSource(doc, split, { ...suggestion, block_id: "wrong" })).toBe(false);
  const duplicate = doc.querySelector(`mark[data-label="${label}"]`)!.cloneNode(true);
  doc.querySelector("p")!.append(duplicate);
  expect(highlightSource(doc, split)).toBe(false);
});
