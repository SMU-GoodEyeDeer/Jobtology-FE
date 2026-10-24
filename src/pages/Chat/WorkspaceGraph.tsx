import { InteractiveNvlWrapper } from "@neo4j-nvl/react";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { useReducedMotion } from "motion/react";
import { useTheme } from "../../context/ThemeContext";
import { nodeLabels, type WorkspaceGraph as Graph, type WorkspaceKind } from "../../services/chatWorkspace";

const colors: Record<WorkspaceKind, string> = {
  role: "#7056c7", goal: "#7056c7", profile: "#345d79", preferences: "#64748b",
  capability: "#15805c", analysis: "#6d58a4", activity: "#438273",
  ncs_occupation: "#5965b3", ncs_competency: "#7b86bd", onet_occupation: "#287a9f",
  onet_skill: "#55a0b1", technology: "#698a9c", qualification: "#b0762f",
  exam_session: "#b4934a", posting: "#ba7159", posting_evidence: "#ba7159", publication: "#8c7a67",
};
interface Props {
  graph: Graph; selected: string | null; onSelect: (id: string) => void;
  highlighted: ReadonlySet<string>; highlightedEdges: ReadonlySet<string>; kinds: WorkspaceKind[];
  focus: { ids: string[]; revision: number }; reset: number;
}
export function WorkspaceGraph({ graph, selected, onSelect, highlighted, highlightedEdges, kinds, focus, reset }: Props) {
  const nvl = useRef<ComponentRef<typeof InteractiveNvlWrapper>>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const { preference } = useTheme();
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);
  const fittingIds = useRef<string[] | null>(null);
  const [previewKind, setPreviewKind] = useState<WorkspaceKind | null>(null);
  const [pinnedKind, setPinnedKind] = useState<WorkspaceKind | null>(null);
  const activeKind = previewKind ?? pinnedKind;
  const labels = useRef(new Map<string, { label: string; element: HTMLSpanElement }>());
  useEffect(() => { const ids = new Set(graph.nodes.map(n => n.id)); for (const id of labels.current.keys()) if (!ids.has(id)) labels.current.delete(id); }, [graph.nodes]);
  const labelScale = useRef(0);
  function syncLabelScale(zoom = nvl.current?.getScale?.() ?? 1) {
    const next = Math.min(2, Math.max(.65, 1 / Math.max(.08, zoom)));
    if (Math.abs(next - labelScale.current) > .01) { canvas.current?.style.setProperty("--node-label-scale", String(next)); labelScale.current = next; }
  }
  const visible = useMemo(() => graph.nodes.filter(n => !kinds.length || kinds.includes(n.kind)), [graph, kinds]);
  const nodes = useMemo(() => visible.map(node => {
    let label = labels.current.get(node.id);
    if (!label || label.label !== node.label) {
      const element = document.createElement("span");
      element.className = "workspace-node-label"; element.textContent = node.label;
      label = { label: node.label, element }; labels.current.set(node.id, label);
    }
    const dimmed = activeKind ? node.kind !== activeKind : highlighted.size > 0 && !highlighted.has(node.id);
    label.element.dataset.dimmed = String(dimmed);
    return {
    id: node.id, html: label.element, color: dimmed ? preference === "dark" ? "#30394a" : "#d9dde6" : colors[node.kind],
    size: node.kind === "role" || node.kind === "goal" ? 22 : node.kind === "profile" ? 19 : 13,
    selected: selected === node.id,
    activated: highlighted.has(node.id) || (activeKind !== null && activeKind === node.kind),
    disabled: false,
  }; }), [visible, selected, highlighted, activeKind, preference]);
  const rels = useMemo(() => {
    const ids = new Set(visible.map(n => n.id));
    return graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({
      id: e.id, from: e.source, to: e.target, color: highlightedEdges.has(e.id) ? "#8d6de0" : preference === "dark" ? "#49536b" : "#c0c7d6",
      width: highlightedEdges.has(e.id) ? 3 : 1.5, selected: highlightedEdges.has(e.id),
      caption: e.basis === "PROPOSED" ? "제안 연결" : highlightedEdges.has(e.id) ? e.kind : undefined,
    }));
  }, [graph, visible, highlightedEdges, preference]);
  const options = useMemo(() => ({
    renderer: "canvas" as const, layout: reduced ? "free" as const : "forceDirected" as const,
    disableTelemetry: true, disableWebGL: true, maxFps: 30, minZoom: .08, maxZoom: 2,
    styling: { selectedBorderColor: "#9b84ec" },
  }), [preference, reduced]);
  const positions = useMemo(() => reduced ? visible.map((n, index) => ({ id: n.id, x: (index % 7) * 135, y: Math.floor(index / 7) * 120 })) : undefined, [visible, reduced]);
  function fitAll() { fittingIds.current = null; nvl.current?.fit?.(visible.map(n => n.id), { animated: !reduced, maxZoom: 1.2 }); }
  const kindKey = kinds.join("|");
  useEffect(() => { if (ready) fitAll(); }, [reset, ready, kindKey]);
  useEffect(() => {
    fittingIds.current = focus.ids.length ? focus.ids : null;
    if (ready && focus.ids.length) nvl.current?.fit?.(focus.ids.filter(id => visible.some(n => n.id === id)), { animated: !reduced, maxZoom: 1.2 });
  }, [focus, ready, reduced]);
  const currentView = useRef({ visible, focus }); currentView.current = { visible, focus };
  useEffect(() => {
    if (!ready || !canvas.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const view = currentView.current;
        const ids = (fittingIds.current ?? []).filter(id => view.visible.some(n => n.id === id));
        nvl.current?.fit?.(ids.length ? ids : view.visible.map(n => n.id), { animated: false, maxZoom: 1.2 });
      });
    });
    observer.observe(canvas.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [ready]);
  const counts = new Map<WorkspaceKind, number>();
  for (const node of graph.nodes) counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  return <>
    <div ref={canvas} className="workspace-canvas" aria-label="커리어 근거 그래프">
      {!failed && nodes.length > 0 && <InteractiveNvlWrapper ref={nvl} nodes={nodes} rels={rels} positions={positions}
        style={{ width: "100%", height: "100%" }} nvlOptions={options}
        onInitializationError={() => setFailed(true)}
        nvlCallbacks={{ onInitialization: () => setReady(true), onLayoutStep: () => syncLabelScale(), onZoomTransitionDone: () => syncLabelScale(), onLayoutDone: () => {
          if (!fitted.current) { nvl.current?.fit?.(nodes.map(n => n.id), { animated: false }); fitted.current = true; }
        } }}
        mouseEventCallbacks={{ onNodeClick: node => onSelect(node.id), onPan: true, onZoomAndPan: zoom => syncLabelScale(zoom), onDrag: true }} />}
      {!graph.nodes.length && <div className="workspace-empty">목표를 선택하거나 궁금한 역량을 검색해 보세요.</div>}
      {failed && <p className="workspace-render-error" role="status">그래픽을 표시하지 못했어요. 아래 노드 목록에서 탐색할 수 있어요.</p>}
    </div>
    <div className="workspace-camera" role="group" aria-label="그래프 보기 조절">
      <button onClick={() => { nvl.current?.setZoom?.((nvl.current?.getScale?.() ?? 1) / 1.25); syncLabelScale(); }} aria-label="그래프 축소">−</button>
      <button onClick={fitAll}>전체 보기</button>
      <button onClick={() => { nvl.current?.setZoom?.((nvl.current?.getScale?.() ?? 1) * 1.25); syncLabelScale(); }} aria-label="그래프 확대">+</button>
    </div>
    <div className="workspace-legend" role="group" aria-label="노드 유형별 강조">
      {[...counts].map(([kind, count]) => <button key={kind} aria-pressed={pinnedKind === kind} onPointerEnter={() => setPreviewKind(kind)} onPointerLeave={() => setPreviewKind(null)}
        onFocus={() => setPreviewKind(kind)} onBlur={() => setPreviewKind(null)} onClick={() => setPinnedKind(previous => previous === kind ? null : kind)}>
        <i style={{ background: colors[kind] }} />{nodeLabels[kind]} <span>{count}</span>
      </button>)}
    </div>
    <details className="workspace-node-list"><summary>노드 목록 · {visible.length}</summary>
      <div>{visible.map(n => <button key={n.id} aria-pressed={selected === n.id} onClick={() => onSelect(n.id)}>
        <small>{nodeLabels[n.kind]}</small>{n.label}</button>)}</div>
    </details>
  </>;
}
