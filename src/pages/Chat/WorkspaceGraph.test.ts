// @vitest-environment jsdom
import { act, createElement, forwardRef, useEffect, useImperativeHandle } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceGraph as Graph, WorkspaceKind } from "../../services/chatWorkspace";
import { WorkspaceGraph } from "./WorkspaceGraph";
const native = vi.hoisted(() => ({ props: {} as Record<string, any>, reduced: false, fit: vi.fn() }));
vi.mock("motion/react", () => ({ useReducedMotion: () => native.reduced }));
vi.mock("@neo4j-nvl/react", () => ({ InteractiveNvlWrapper: forwardRef((props: Record<string, any>, ref) => {
  native.props = props;
  useImperativeHandle(ref, () => ({ fit: native.fit, getScale: () => .5, setZoom: vi.fn() }));
  useEffect(() => { props.nvlCallbacks.onInitialization(); }, []);
  return createElement("div", { "data-native-graph": true });
}) }));
const graph: Graph = { nodes: [{ id: "a", kind: "technology", label: "SQL", basis: "REFERENCE" },
  { id: "b", kind: "capability", label: "내 경험", basis: "USER_REPORTED" }], edges: [], truncated: false };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  native.reduced = false; native.fit.mockClear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(kinds: WorkspaceKind[] = [], ids: string[] = [], revision = 0, data = graph) {
  await act(async () => root.render(createElement(WorkspaceGraph, { graph: data, selected: null, onSelect: vi.fn(), highlighted: new Set<string>(), highlightedEdges: new Set<string>(), kinds, focus: { ids, revision }, reset: 0 })));
}
describe("native graph view behavior", () => {
  it("uses fixed positions and unanimated fit for reduced motion", async () => {
    native.reduced = true; await render([], ["a"]);
    expect(native.props.nvlOptions.layout).toBe("free");
    expect(native.props.nvlOptions.disableTelemetry).toBe(true);
    expect(native.props.positions).toHaveLength(2);
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
});
