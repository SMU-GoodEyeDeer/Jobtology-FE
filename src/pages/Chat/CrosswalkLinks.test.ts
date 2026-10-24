// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resourcesApi, type CrosswalkResponse } from "../../services/resourcesApi";
import { clearPostingsCache } from "../../services/postingsCache";
import { CrosswalkLinks } from "./CrosswalkLinks";

const response: CrosswalkResponse = {
  contract_version: "jobtology-ncs-onet-crosswalk-v1", basis: "CATALOG_CROSSWALK", competency_evidence: false,
  limit: 6, offset: 0, total: 1, items: [{
    mapping_id: "mapping:one", relation: "RELATED", status: "PROPOSED", basis: "SHARED_POSTINGS", evidence: { shared_postings: 12 },
    source: { id: "ncs:occupation:20010202", scheme: "NCS", kind: "ncs_occupation", code: "20010202", name: "응용SW엔지니어링", catalog_pin: "ncs-run", content_hash: "ncs-hash" },
    target: { id: "urn:jobtology:onet:occupation:15-1252.00", scheme: "ONET", kind: "onet_occupation", code: "15-1252.00", name: "Software Developers", catalog_pin: "31.0", content_hash: "onet-hash" },
    review: null, source_freshness: "CURRENT", catalog_freshness: "STALE", created_at: "2026-10-25T00:00:00Z",
  }],
};
let root: Root, host: HTMLDivElement;
const expand = vi.fn();
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearPostingsCache(); expand.mockReset();
  vi.spyOn(resourcesApi, "crosswalk").mockResolvedValue(response);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(nodeId = response.items[0].source.id, nodeScheme: "NCS" | "ONET" = "NCS") {
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(CrosswalkLinks, { nodeId, nodeScheme, onExpand: expand, busy: false }))));
}
describe("NCS and O*NET crosswalk details", () => {
  it("adds returned connections automatically and focuses the clicked mapping rather than a generic expansion", async () => {
    const graph = { nodes: [], edges: [], truncated: false };
    vi.mocked(resourcesApi.crosswalk).mockResolvedValue({ ...response, graph });
    const connect = vi.fn(), show = vi.fn();
    await act(async () => root.render(createElement(MemoryRouter, null, createElement(CrosswalkLinks, {
      nodeId: response.items[0].source.id, nodeScheme: "NCS", onExpand: expand, busy: false, onConnections: connect, onShowMapping: show,
    }))));
    expect(connect).toHaveBeenCalledWith(graph);
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "지도에서 보기")!.click());
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ graph }), "mapping:one");
    expect(expand).not.toHaveBeenCalled();
  });
  it("labels inferred proposals, stale catalog pins and their retrieval-only purpose", async () => {
    await render();
    expect(resourcesApi.crosswalk).toHaveBeenCalledWith(response.items[0].source.id, 6);
    expect(host.textContent).toContain("Software Developers");
    expect(host.textContent).toContain("관련 항목 · 검토 전 제안");
    expect(host.textContent).toContain("분류 과거 자료");
    expect(host.textContent).toContain("보유 역량으로 자동 반영하지 않아요");
    expect(host.textContent).toContain("동일 공고의 직무 분류로 연결");
    expect(host.textContent).toContain("공고 12건");
    expect(host.textContent).toContain("ncs-run"); expect(host.textContent).toContain("31.0");
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "지도에서 보기")!.click());
    expect(expand).toHaveBeenCalledOnce();
    expect(new URL(host.querySelector("a")!.href).searchParams.get("occupation")).toBe("15-1252.00");
  });
  it("shows the opposite endpoint and preserves actual review status", async () => {
    vi.mocked(resourcesApi.crosswalk).mockResolvedValue({ ...response, items: [{ ...response.items[0], status: "APPROVED", relation: "PARTIAL", catalog_freshness: "CURRENT",
      review: { reviewer_kind: "ASSISTANT", reviewer: "catalog-review", note: "일부 업무 범위만 대응", reviewed_at: "2026-10-25T00:00:00Z" } }] });
    await render(response.items[0].target.id, "ONET");
    expect(host.querySelector("li strong")?.textContent).toBe("응용SW엔지니어링");
    expect(host.textContent).toContain("부분 대응 · 검토된 연결 · 보조 검토");
    expect(host.textContent).toContain("일부 업무 범위만 대응");
    expect(host.textContent).not.toContain("사람 검토");
  });
  it("ignores a previous node's late response", async () => {
    let finish!: (value: CrosswalkResponse) => void;
    vi.mocked(resourcesApi.crosswalk).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ ...response, items: [], total: 0 });
    await render(); await render("ncs:occupation:20010204");
    await act(async () => finish(response));
    expect(host.textContent).toContain("아직 연결된 분류가 없어요");
    expect(host.textContent).not.toContain("Software Developers");
  });
  it("uses the selected node's scheme for canonical aliases resolved to versioned catalog IDs", async () => {
    vi.mocked(resourcesApi.crosswalk).mockResolvedValue({ ...response, items: [{ ...response.items[0], source: {
      ...response.items[0].source, id: "ncs:competency:2001020401_23v1", kind: "ncs_competency", code: "2001020401_23v1", name: "데이터베이스 구현",
    } }] });
    await render("ncs:unit:2001020401", "NCS");
    expect(host.querySelector("li strong")?.textContent).toBe("Software Developers");
    expect(host.querySelector("li strong")?.textContent).not.toBe("데이터베이스 구현");
  });
  it("shows missing catalog versions as unknown and does not offer rejected links in the map", async () => {
    vi.mocked(resourcesApi.crosswalk).mockResolvedValue({ ...response, items: [{ ...response.items[0], status: "REJECTED",
      source: { ...response.items[0].source, catalog_pin: null, content_hash: null },
      target: { ...response.items[0].target, catalog_pin: null, content_hash: null },
    }] });
    await render();
    expect([...host.querySelectorAll("dd")].map(value => value.textContent)).toEqual(["미확인", "미확인"]);
    expect(host.textContent).toContain("제외된 연결");
    expect([...host.querySelectorAll("button")].some(button => button.textContent === "지도에서 보기")).toBe(false);
  });
  it("shows software technology endpoints without an occupation-postings link", async () => {
    vi.mocked(resourcesApi.crosswalk).mockResolvedValue({ ...response, items: [{ ...response.items[0], target: {
      ...response.items[0].target, id: "urn:jobtology:onet-detail:software:python", kind: "technology", code: "Python", name: "Python",
    } }] });
    await render();
    expect(host.querySelector("li strong")?.textContent).toBe("Python");
    expect(host.querySelector("a")).toBeNull();
    expect([...host.querySelectorAll("button")].some(button => button.textContent === "지도에서 보기")).toBe(true);
  });
  it("shows exact catalog quotes for a bilingual proposal without presenting an approved equivalence", async () => {
    vi.mocked(resourcesApi.crosswalk).mockResolvedValue({ ...response, items: [{ ...response.items[0], basis: "BILINGUAL_CUE", version: "bilingual-technical-cues-v1",
      evidence: { cue: "database", source_quote: "데이터베이스", target_quote: "database", summary: "기술 용어 일치 후보" } }] });
    await render();
    expect(host.textContent).toContain("공통 기술 용어로 제안");
    expect([...host.querySelectorAll("dl div")].find(row => row.querySelector("dt")?.textContent === "연결 규칙 버전")?.querySelector("dd")?.textContent).toBe("bilingual-technical-cues-v1");
    expect([...host.querySelectorAll("q")].map(quote => quote.textContent)).toEqual(["데이터베이스", "database"]);
    expect(host.textContent).toContain("검토 전 제안");
    expect(host.textContent).not.toContain("동등 범위");
  });
  it("retries failed lookups", async () => {
    vi.mocked(resourcesApi.crosswalk).mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("연결을 불러오지 못했어요");
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(host.textContent).toContain("Software Developers");
    expect(resourcesApi.crosswalk).toHaveBeenCalledTimes(2);
  });
});
