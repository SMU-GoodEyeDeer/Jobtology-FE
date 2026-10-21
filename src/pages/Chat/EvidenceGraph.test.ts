// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceNode, RoleEvidenceGraph } from "../../services/types";
import type { ForceSeed } from "./evidenceGraphForce";
import { resourcesApi } from "../../services/resourcesApi";
import { occupationContext } from "../../testFixtures/occupationContext";
import { EvidenceGraph } from "./EvidenceGraph";
const exam = vi.hoisted(() => vi.fn().mockReturnValue({ state: "ready", data: { items: [], total: 0 } }));
vi.mock("../Analysis/useSkillResources", () => ({ useExamSessions: exam }));
vi.mock("../../services/resourcesApi", async importOriginal => ({ ...await importOriginal<typeof import("../../services/resourcesApi")>(), resourcesApi: { postings: vi.fn(), posting: vi.fn(), occupationContext: vi.fn() } }));
vi.mock("./evidenceGraphForce", () => ({ createEvidenceSimulation: (seed: ForceSeed) => {
  const nodes = new Map(seed.nodes.map(node => [node.id, { ...node }]));
  return { nodes, links: seed.links.map(link => ({ ...link, source: nodes.get(link.source), target: nodes.get(link.target) })), simulation: { on: vi.fn(), stop: vi.fn() } };
} }));
const base = { detail: null, weight: null };
const graph: RoleEvidenceGraph = {
  occupation_id: "BACKEND_DEVELOPER", name: "백엔드 개발자",
  nodes: [
    { ...base, id: "role", kind: "role", label: "백엔드 개발자" },
    { ...base, id: "occupation", kind: "ncs_occupation", label: "개발 직무", ncs_category: "20010203", excluded_associations: 7 },
    { ...base, id: "postings:20010203", kind: "posting_evidence", label: "공고 50건", ncs_category: "20010203" },
    { ...base, id: "unit", kind: "ncs_competency", label: "API 구현", requirement_key: "BACKEND_DEVELOPER:2001020301", ncs_base_code: "2001020301" },
    { ...base, id: "qualification", kind: "qualification", label: "실제 자격", qualification_code: "C290" },
    { ...base, id: "onet", kind: "onet_occupation", label: "Software Developers", occupation_code: "15-1252.00", basis: "APPLICATION_CONTEXT_SELECTION" },
    { ...base, id: "onet-skill", kind: "onet_skill", label: "Critical Thinking" },
    { ...base, id: "technology", kind: "technology", label: "Python" },
  ],
  edges: [{ source: "role", target: "occupation", kind: "MAPPED_TO", weight: null }, { source: "role", target: "postings:20010203", kind: "EVIDENCED_BY", weight: null }, { source: "role", target: "unit", kind: "HAS_COMPETENCY", weight: null }, { source: "role", target: "qualification", kind: "QUALIFIED_BY", weight: null },
    { source: "role", target: "onet", kind: "CONTEXT_FOR", weight: null, basis: "APPLICATION_CONTEXT_SELECTION" },
    { source: "onet", target: "onet-skill", kind: "ESSENTIAL_SKILL", weight: null },
    { source: "onet", target: "technology", kind: "HOT_TECHNOLOGY", weight: null }],
};
function Location() { const location = useLocation(); return createElement("output", { "data-location": true }, location.pathname + location.search); }
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.mocked(resourcesApi.occupationContext).mockReset().mockResolvedValue(occupationContext({ posting_id: "urn:posting:a/b", title: "실제 API 채용", organization_name: "실제 기관", closing_date: "2026-10-31", organization_code: null, date_posted: null, ongoing: null, regions: [], employment_types: [], recruitment_type: null, education: null, ncs_categories: [], headcount: null, source_url: null }));
  exam.mockClear(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(nodes: readonly EvidenceNode[] = graph.nodes, warnings: readonly string[] = []) {
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/chat"] }, createElement(EvidenceGraph, { graph: { ...graph, nodes, warnings }, status: "ready", ownedSkills: new Set<string>(), onOpenRoadmap: vi.fn() }), createElement(Location))));
}
async function select(label: string) { await act(async () => container.querySelector(`[aria-label="${label} 상세정보"]`)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))); }
function button(label: string) { return Array.from(container.querySelectorAll("button")).find(item => item.textContent === label)!; }
describe("evidence graph resource actions", () => {
  it("discloses unavailable posting counts while keeping catalog nodes available", async () => {
    await render(graph.nodes, ['POSTING_CONTEXT_UNAVAILABLE']);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('공고 연결 집계를 확인하지 못했어요');
    expect(container.querySelector('[aria-label="Software Developers 상세정보"]')).not.toBeNull();
  });
  it("renders distinct NCS, O*NET skill and technology legend counts and highlights on hover/focus", async () => {
    await render();
    const legend = (name: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${name} 노드 강조"]`)!;
    expect(legend("NCS 능력단위").textContent).toContain("1");
    expect(legend("O*NET 핵심 역량").textContent).toContain("1");
    expect(legend("기술 스택").textContent).toContain("1");
    await act(async () => legend("NCS 능력단위").dispatchEvent(new Event("pointerover", { bubbles: true })));
    expect(container.querySelector('.graph-node--highlighted[data-legend="ncs_competency"]')).not.toBeNull();
    expect(container.querySelector('.graph-node--dimmed[data-legend="technology"]')).not.toBeNull();
    await act(async () => legend("NCS 능력단위").dispatchEvent(new Event("pointerout", { bubbles: true })));
    expect(container.querySelector('.graph-node--dimmed')).toBeNull();
    await act(async () => legend("O*NET 직업").focus());
    expect(container.querySelector('.graph-node--highlighted[data-legend="onet_occupation"]')).not.toBeNull();
    await act(async () => legend("O*NET 직업").dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })));
    expect(container.querySelector('.graph-node--dimmed')).toBeNull();
  });
  it("explains empty categories and excluded historical NCS associations", async () => {
    await render();
    const empty = container.querySelector<HTMLButtonElement>('[aria-label="보유 역량 노드 강조"]')!;
    expect(empty.textContent).toContain("0"); expect(empty.getAttribute('aria-disabled')).toBe('true');
    await act(async () => empty.focus());
    expect(container.querySelector('[role="status"]')?.textContent).toContain('보유 역량 노드가 없어요');
    expect(container.querySelector('.graph-node--dimmed')).toBeNull();
    expect(container.textContent).toContain('NCS 연결 7건은 제외');
  });
  it("keeps O*NET reference context explicit and opens postings by its own occupation code", async () => {
    await render(); await select("Software Developers");
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('직무 탐색용 참고 연결');
    expect(dialog.textContent).toContain('NCS와의 동등성');
    await act(async () => button("연결된 채용공고 보기").click());
    expect(container.querySelector("output")!.textContent).toBe('/postings?occupation=15-1252.00');
  });
  it("loads O*NET posting aggregates with the general occupation identity", async () => {
    await render(graph.nodes.map(node => node.kind === 'posting_evidence' ? { ...node, occupation_code:'15-1252.00', ncs_category:null } : node));
    await select("공고 50건");
    expect(resourcesApi.occupationContext).toHaveBeenCalledWith('15-1252.00',3);
  });
  it("opens an aggregate posting node with real samples then navigates to the chosen detail", async () => {
    await render(); await select("공고 50건");
    expect(resourcesApi.occupationContext).toHaveBeenCalledWith("20010203", 3);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("실제 API 채용");
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("실제 기관");
    await act(async () => container.querySelector<HTMLAnchorElement>(".node-posting-card")!.click());
    const location = new URL(container.querySelector("output")!.textContent!, "https://app.example");
    expect(location.pathname).toBe("/postings");
    expect(location.searchParams.get("posting")).toBe("urn:posting:a/b");
    expect(location.searchParams.get("occupation")).toBe("20010203");
  });
  it("shows actual review and source pins, excluded stale counts, and occupation navigation", async () => {
    const sources = [{ source_id: "jobkorea", source_run_id: "exact-source-run", catalog_run_id: "exact-catalog-pin", source_current: true, catalog_current: true, review_status: "ASSISTANT_REVIEWED", stage: "REVIEWED", accepted: false, postings: 4, basis: "METADATA_INFERRED" as const, confidence: null, confidence_state: "UNASSESSED" as const }];
    await render(graph.nodes.map(node => node.id === "occupation" ? { ...node, basis: "METADATA_INFERRED", evidence_sources: sources } : node));
    await select("개발 직무");
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("과거 연결 7건");
    expect(dialog.textContent).toContain("보조 검토");
    expect(dialog.textContent).toContain("exact-source-run");
    expect(dialog.textContent).toContain("exact-catalog-pin");
    expect(dialog.textContent).toContain("역량 충족에 반영하지 않아요");
    await act(async () => button("연결된 채용공고 보기").click());
    expect(container.querySelector("output")!.textContent).toBe("/postings?occupation=20010203");
  });
  it("retains exact requirement identity in both roadmap and analysis actions", async () => {
    await render(); await select("API 구현");
    await act(async () => button("로드맵에서 보기").click());
    expect(container.querySelector("output")!.textContent).toBe("/roadmap?requirement=BACKEND_DEVELOPER%3A2001020301");
    await act(async () => button("역량분석에서 보기 →").click());
    expect(container.querySelector("output")!.textContent).toBe("/analysis?requirement=BACKEND_DEVELOPER%3A2001020301");
  });
  it("uses only a validated exact base code when the reviewed planning identity is absent", async () => {
    await render(graph.nodes.map(node => node.id === "unit" ? { ...node, requirement_key: null } : node)); await select("API 구현");
    await act(async () => button("역량분석에서 보기 →").click());
    expect(container.querySelector("output")!.textContent).toBe("/analysis?ncs=2001020301");
  });
  it("uses the real qualification code for schedules rather than offering an unrelated roadmap", async () => {
    await render(); await select("실제 자격");
    expect(exam).toHaveBeenCalledWith("C290", expect.stringMatching(/^\d{4}-01-01$/));
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("등록된 시험 일정이 없어요");
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain("로드맵에서 보기");
    expect(container.querySelector('[role="dialog"] a')?.getAttribute("href")).toBe("https://www.q-net.or.kr/");
  });
});
