// @vitest-environment jsdom
import { StrictMode, act, createElement, forwardRef, useEffect, useImperativeHandle } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceBasis, WorkspaceGraph as Graph, WorkspaceKind } from "../../services/chatWorkspace";
import { WorkspaceGraph } from "./WorkspaceGraph";
const native = vi.hoisted(() => ({ props: {} as Record<string, any>, reduced: false, fit: vi.fn(), point: { x: 120, y: 90 } }));
vi.mock("motion/react", () => ({ useReducedMotion: () => native.reduced }));
vi.mock("@neo4j-nvl/react", () => ({ InteractiveNvlWrapper: forwardRef((props: Record<string, any>, ref) => {
  native.props = props;
  useImperativeHandle(ref, () => ({ fit: native.fit, getScale: () => .5, setZoom: vi.fn(), getNodes: () => props.nodes.map((node: { id: string }) => ({ id: node.id, clientPosition: native.point })) }));
  useEffect(() => { props.nvlCallbacks.onInitialization(); }, []);
  return createElement("div", { "data-native-graph": true, ref: (element: HTMLDivElement | null) => { if (element) element.replaceChildren(...props.nodes.map((node: {html:HTMLElement}) => node.html.cloneNode(true))); } });
}) }));
const graph: Graph = { nodes: [{ id: "a", kind: "technology", label: "SQL", basis: "REFERENCE" },
  { id: "b", kind: "capability", label: "내 경험", basis: "USER_REPORTED" }], edges: [], truncated: false };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  native.reduced = false; native.point = { x: 120, y: 90 }; native.fit.mockClear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(kinds: WorkspaceKind[] = [], ids: string[] = [], revision = 0, data = graph, highlightedEdges = new Set<string>()) {
  await act(async () => root.render(createElement(WorkspaceGraph, { graph: data, selected: null, onSelect: vi.fn(), highlighted: new Set<string>(), highlightedEdges, kinds, focus: { ids, revision }, reset: 0 })));
}
describe("native graph view behavior", () => {
  it("keeps the first layout covered until node positions are ready", async () => {
    await render();
    expect(host.querySelector(".workspace-loading")?.textContent).toContain("그래프를 준비하고 있어요");
    await act(async () => native.props.nvlCallbacks.onLayoutDone());
    expect(host.querySelector(".workspace-loading")).toBeNull();
  });
  it.each<[EvidenceBasis, string]>([
    ["METADATA_INFERRED", "과거 추론 연결"], ["REFERENCE", "과거 참고 자료"],
    ["REVIEWED_REQUIREMENT", "과거 검토된 요구 역량"], ["USER_REPORTED", "과거 본인 입력"],
    ["APPLICATION_RECORD", "과거 저장된 계획·평가"], ["APPLICATION_CONTEXT_SELECTION", "과거 직무 탐색 참고"],
    ["PROPOSED", "과거 제안 연결"],
  ])("preserves the %s basis in historical edge captions", async (basis, caption) => {
    await render([], [], 0, { ...graph, edges: [{ id: "edge", source: "a", target: "b", kind: "LINK", basis, catalog_freshness: "STALE" }] });
    expect(native.props.rels[0].caption).toBe(caption);
  });
  it("retains proposal and highlighted captions for current edges", async () => {
    await render([], [], 0, { ...graph, edges: [
      { id: "proposed", source: "a", target: "b", kind: "SUGGESTED_LINK", basis: "PROPOSED" },
      { id: "highlighted", source: "a", target: "b", kind: "MATCHED_TO", basis: "USER_REPORTED" },
      { id: "ordinary", source: "a", target: "b", kind: "REFERENCE", basis: "REFERENCE" },
    ] }, new Set(["proposed", "highlighted"]));
    expect(native.props.rels.map((r: { caption?: string }) => r.caption)).toEqual(["제안 연결", "MATCHED_TO", undefined]);
  });
  it("labels crosswalk connections by their actual review state", async () => {
    await render([], [], 0, { ...graph, edges: [
      { id: "candidate", source: "a", target: "b", kind: "CROSSWALK_RELATED", basis: "PROPOSED" },
      { id: "partial", source: "a", target: "b", kind: "CROSSWALK_PARTIAL", basis: "REFERENCE" },
      { id: "exact", source: "a", target: "b", kind: "CROSSWALK_EXACT", basis: "REFERENCE", catalog_freshness: "STALE" },
    ] });
    expect(native.props.rels.map((r: { caption?: string }) => r.caption)).toEqual([
      "NCS ↔ O*NET · 제안", "NCS ↔ O*NET · 부분 대응", "과거 NCS ↔ O*NET · 검토된 대응",
    ]);
    expect(native.props.rels.every((r: { width: number }) => r.width === 2)).toBe(true);
  });
  it("uses fixed positions and unanimated fit for reduced motion", async () => {
    native.reduced = true; await render([], ["a"]);
    expect(native.props.nvlOptions.layout).toBe("free");
    expect(native.props.nvlOptions.disableTelemetry).toBe(true);
    expect(native.props.positions).toHaveLength(2);
    expect(host.querySelector(".workspace-loading")).toBeNull();
    expect(native.fit).toHaveBeenLastCalledWith(["a"], expect.objectContaining({ animated: false, maxZoom: 1.2 }));
  });
  it("citation focus wins over a simultaneous filter reset", async () => {
    await render(["capability"]); native.fit.mockClear();
    await render([], ["a"], 1);
    expect(native.fit).toHaveBeenLastCalledWith(["a"], expect.objectContaining({ maxZoom: 1.2 }));
  });
  it("renders untrusted node labels as text rather than executable HTML", async () => {
    await render([], [], 0, { ...graph, nodes: [{ ...graph.nodes[0], label: '<img src=x onerror="alert(1)">' }] });
    const element = native.props.nodes[0].html as HTMLSpanElement;
    expect(element.querySelector("img")).toBeNull(); expect(element.textContent).toContain("<img");
  });
  it("keeps clicked legend emphasis pinned after pointer and keyboard previews end", async () => {
    await render();
    const [technology, capability] = [...host.querySelectorAll<HTMLButtonElement>(".workspace-legend button")];
    const dimmed = (id: string) => (native.props.nodes.find((n: { id: string }) => n.id === id).html as HTMLSpanElement).dataset.dimmed;
    await act(async () => { technology.dispatchEvent(new Event("pointerover", { bubbles: true })); });
    await act(async () => technology.click());
    expect(technology.getAttribute("aria-pressed")).toBe("true");
    await act(async () => { technology.dispatchEvent(new Event("pointerout", { bubbles: true })); });
    expect(dimmed("a")).toBe("false"); expect(dimmed("b")).toBe("true");
    await act(async () => capability.focus());
    expect(dimmed("a")).toBe("true"); expect(dimmed("b")).toBe("false");
    expect(technology.getAttribute("aria-pressed")).toBe("true");
    await act(async () => capability.blur());
    expect(dimmed("a")).toBe("false"); expect(dimmed("b")).toBe("true");
    await act(async () => technology.click());
    expect(technology.getAttribute("aria-pressed")).toBe("false");
    expect(dimmed("a")).toBe("false"); expect(dimmed("b")).toBe("false");
  });
});

it("declutters rendered native label copies while preserving selected labels and popup anchors", async () => {
  const boxes = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x:20,y:20,left:20,top:20,right:140,bottom:40,width:120,height:20,toJSON:()=>({}) });
  vi.stubGlobal("requestAnimationFrame", (callback:FrameRequestCallback) => setTimeout(() => callback(0),0));
  vi.stubGlobal("cancelAnimationFrame", (id:number) => clearTimeout(id));
  const anchor=vi.fn();
  await act(async()=>{root.render(createElement(StrictMode,null,createElement(WorkspaceGraph,{graph,selected:"b",onSelect:vi.fn(),onAnchor:anchor,highlighted:new Set<string>(),highlightedEdges:new Set<string>(),kinds:[],focus:{ids:[],revision:0},reset:0})));});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
  expect(host.querySelector('[data-workspace-node-id="b"]')?.getAttribute("data-cluttered")).toBe("false");
  expect(host.querySelector('[data-workspace-node-id="a"]')?.getAttribute("data-cluttered")).toBe("true");
  expect(anchor).toHaveBeenLastCalledWith({ x: 120, y: 90 });
  // A camera movement updates the native node center independently of its label.
  native.point = { x: 200, y: 140 };
  await act(async () => { native.props.mouseEventCallbacks.onZoomAndPan(.8); await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(anchor).toHaveBeenLastCalledWith({ x: 200, y: 140 });
  expect(native.props.nodes[0].html.isConnected).toBe(false);
  boxes.mockRestore();
});
