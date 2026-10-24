// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { emptyGraph } from "../../services/chatWorkspace";
import { formatPostingDateTime } from "../../services/resourcesApi";
import { WorkspaceInspector } from "./WorkspaceInspector";

describe("workspace inspector dates", () => {
  it("shows Korean posting metadata and keeps closed status separate from association freshness", () => {
    const node = { id: "posting:sample", kind: "posting" as const, label: "개발자", basis: "REFERENCE" as const,
      source_id: "jobkorea", detail: JSON.stringify({ source_id: "jobkorea", source_status: "CLOSED", closing_date: "2026-10-01", regions: ["서울", "경기"], ongoing: false }) };
    const parent = { id: "postings:20010202", kind: "posting_evidence" as const, label: "연결 공고", basis: "METADATA_INFERRED" as const };
    const graph = { ...emptyGraph(), nodes: [parent, node], edges: [{ id: "association", source: parent.id, target: node.id,
      kind: "INFERRED_POSTING_CONTEXT", basis: "METADATA_INFERRED" as const, source_freshness: "CURRENT" as const, catalog_freshness: "STALE" as const }] };
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WorkspaceInspector, {
      node, graph, onClose: vi.fn(), onExpand: vi.fn(), onAsk: vi.fn(), busy: false,
    })));
    const host = document.createElement("div"); host.innerHTML = markup;
    expect([...host.querySelectorAll("dd")].map(value => value.textContent)).toEqual(["잡코리아", "모집 종료", "2026-10-01", "서울, 경기", "아니요"]);
    expect(host.textContent).toContain("원문 최신 · 분류 과거 기준");
    expect(host.textContent).not.toContain("출처: jobkorea");
  });
  it("preserves calendar-only dates and formats timestamps with the existing formatter", () => {
    const timestamp = "2027-01-03T09:30:00Z";
    const node = { id: "step:a", kind: "activity" as const, label: "학습", basis: "APPLICATION_RECORD" as const,
      detail: JSON.stringify({ planned_start: "2027-01-01", current_start: "2027-01-02", target_by: "2027-01-04", planned_end: timestamp }) };
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WorkspaceInspector, {
      node, graph: emptyGraph(), onClose: vi.fn(), onExpand: vi.fn(), onAsk: vi.fn(), busy: false,
    })));
    const host = document.createElement("div"); host.innerHTML = markup;
    const values = [...host.querySelectorAll("dd")].map(value => value.textContent);
    expect(values).toEqual(["2027-01-01", "2027-01-02", "2027-01-04", formatPostingDateTime(timestamp)]);
    expect(formatPostingDateTime(timestamp)).not.toBe(timestamp);
  });
});
