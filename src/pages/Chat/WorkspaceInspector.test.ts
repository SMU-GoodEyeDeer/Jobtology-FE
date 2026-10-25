// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { emptyGraph } from "../../services/chatWorkspace";
import { formatPostingDateTime, resourcesApi } from "../../services/resourcesApi";
import { clearPostingsCache } from "../../services/postingsCache";
import { WorkspaceInspector } from "./WorkspaceInspector";

describe("workspace inspector dates", () => {
  it("loads a requirement's catalog alias and connects it without repeating requests on graph rerenders", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    clearPostingsCache();
    const node = { id: "requirement:BACKEND_DEVELOPER:2001020406", kind: "ncs_competency" as const, label: "분석 역량", basis: "REVIEWED_REQUIREMENT" as const, ncs_base_code: "2001020406" };
    const catalogId = "ncs:unit:2001020406", connect = vi.fn();
    const read = vi.spyOn(resourcesApi, "crosswalk").mockResolvedValue({
      contract_version: "jobtology-ncs-onet-crosswalk-v1", basis: "CATALOG_CROSSWALK", competency_evidence: false,
      limit: 6, offset: 0, total: 0, items: [], graph: { ...emptyGraph(), nodes: [{ ...node, id: catalogId, basis: "REFERENCE" }] },
    });
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    try {
      const props = { node, graph: emptyGraph(), onClose: vi.fn(), onExpand: vi.fn(), onAsk: vi.fn(), busy: false, onConnections: connect };
      await act(async () => root.render(createElement(MemoryRouter, null, createElement(WorkspaceInspector, props))));
      expect(read).toHaveBeenCalledWith(catalogId, 6);
      expect(connect.mock.calls[0][0].edges.some((edge: { kind: string }) => edge.kind === "CATALOG_REFERENCE")).toBe(true);
      await act(async () => root.render(createElement(MemoryRouter, null, createElement(WorkspaceInspector, { ...props, node: { ...node } }))));
      expect(connect).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount()); host.remove(); read.mockRestore(); clearPostingsCache();
    }
  });
  it.each([
    ["urn:jobtology:onet-detail:software:python", true],
    ["technology:python", false],
  ])("only loads crosswalk details for native O*NET software identities: %s", (id, supported) => {
    const node = { id, kind: "technology" as const, label: "Python", basis: "REFERENCE" as const };
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WorkspaceInspector, {
      node, graph: emptyGraph(), onClose: vi.fn(), onExpand: vi.fn(), onAsk: vi.fn(), busy: false,
    })));
    const host = document.createElement("div"); host.innerHTML = markup;
    expect(!!host.querySelector('[aria-label="NCS와 O*NET 연결"]')).toBe(supported);
  });
  it("shows posting guidance and a search link when the group has no occupation code", () => {
    const node = { id: "posting-search:sample", kind: "posting_evidence" as const, label: "공고 검색", basis: "APPLICATION_CONTEXT_SELECTION" as const };
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WorkspaceInspector, {
      node, graph: emptyGraph(), onClose: vi.fn(), onExpand: vi.fn(), onAsk: vi.fn(), busy: false,
    })));
    const host = document.createElement("div"); host.innerHTML = markup;
    expect(host.textContent).toContain("이 연결에는 조회할 직무 코드가 제공되지 않았어요.");
    expect([...host.querySelectorAll("a")].find(a => a.textContent === "채용공고에서 검색하기 →")?.getAttribute("href")).toBe("/postings");
  });
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
