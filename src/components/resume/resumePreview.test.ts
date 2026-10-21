// @vitest-environment jsdom
import { expect, it } from "vitest";
import { highlightSource, previewDocument } from "./resumePreview";
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
