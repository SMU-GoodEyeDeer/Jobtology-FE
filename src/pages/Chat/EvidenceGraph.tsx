import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { EvidenceNodeKind, RoleEvidenceGraph } from "../../services/types";
import {
  createEvidenceSimulation,
  type EvidenceSimulation,
  type ForceSeed,
  type SimNode,
} from "./evidenceGraphForce";
import { isOwned, layoutEvidenceGraph } from "./evidenceGraphLayout";
import { MAX_ZOOM, MIN_ZOOM, zoomCamera } from "./graphCamera";

type Visual = EvidenceNodeKind | "have" | "me";

const COLORS: Record<Visual, string> = {
  me: "#111827",
  role: "#1e1b4b",
  ncs_occupation: "#4f46e5",
  onet_occupation: "#0284c7",
  posting_evidence: "#d97706",
  ncs_competency: "#9ca3af",
  onet_skill: "#a78bfa",
  qualification: "#0d9488",
  technology: "#9ca3af",
  have: "#16a34a",
};

const KIND_LABEL: Record<EvidenceNodeKind, string> = {
  role: "목표 직무",
  ncs_occupation: "NCS 직무",
  posting_evidence: "채용공고 근거",
  ncs_competency: "NCS 능력단위",
  onet_occupation: "O*NET 직업",
  onet_skill: "O*NET 핵심 역량",
  qualification: "Q-Net 자격",
  technology: "기술 스택",
};

const LEGEND: readonly { readonly visual: Visual; readonly label: string }[] = [
  { visual: "role", label: "목표 직무" },
  { visual: "ncs_occupation", label: "NCS 직무" },
  { visual: "onet_occupation", label: "O*NET 직업" },
  { visual: "posting_evidence", label: "공고 근거" },
  { visual: "qualification", label: "Q-Net 자격" },
  { visual: "onet_skill", label: "핵심 역량" },
  { visual: "technology", label: "필요 역량" },
  { visual: "have", label: "보유 역량" },
];

const SKILL_KINDS: ReadonlySet<EvidenceNodeKind> = new Set(["ncs_competency", "onet_skill", "technology"]);

const ME_ID = "__me__";
const DRAG_THRESHOLD = 3;

type Drag =
  | { readonly kind: "node"; readonly node: SimNode; readonly startX: number; readonly startY: number }
  | { readonly kind: "pan"; readonly startX: number; readonly startY: number; readonly panX: number; readonly panY: number };

function shorten(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

interface Props {
  readonly graph: RoleEvidenceGraph | null;
  readonly status: "idle" | "loading" | "error" | "ready";
  readonly ownedSkills: ReadonlySet<string>;
  readonly onOpenRoadmap: () => void;
}

export function EvidenceGraph({ graph, status, ownedSkills, onOpenRoadmap }: Props) {
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setFrame] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const simRef = useRef<{ readonly graph: RoleEvidenceGraph; readonly sim: EvidenceSimulation } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const movedRef = useRef(false);

  const model = useMemo(() => {
    if (graph === null) return null;
    const layout = layoutEvidenceGraph(graph.nodes, graph.edges);
    const root = layout.nodes[0];
    if (root === undefined) return null;
    const ownedIds = new Set(
      layout.nodes
        .filter((p) => SKILL_KINDS.has(p.node.kind) && isOwned(p.node.label, ownedSkills))
        .map((p) => p.node.id),
    );
    const seed: ForceSeed = {
      width: layout.width,
      height: layout.height,
      nodes: [
        ...layout.nodes.map((p) => ({ id: p.node.id, r: p.r, x: p.x, y: p.y })),
        { id: ME_ID, r: 32, x: 52, y: layout.height - 52 },
      ],
      links: [
        ...graph.edges.map((edge) => ({ source: edge.source, target: edge.target, dashed: false })),
        ...[root.node.id, ...ownedIds].map((target) => ({ source: ME_ID, target, dashed: true })),
      ],
    };
    return { graph, seed, ownedIds, byId: new Map(graph.nodes.map((node) => [node.id, node])) };
  }, [graph, ownedSkills]);

  useEffect(() => {
    setSelectedId(null);
    setCamera({ x: 0, y: 0, zoom: 1 });
  }, [graph]);

  useEffect(() => {
    if (model === null) {
      simRef.current = null;
      return;
    }
    const previous = simRef.current?.graph === model.graph ? simRef.current.sim.nodes : undefined;
    const sim = createEvidenceSimulation(model.seed, previous);
    simRef.current = { graph: model.graph, sim };
    sim.simulation.on("tick", () => setFrame((frame) => frame + 1));
    setFrame((frame) => frame + 1);
    return () => { sim.simulation.stop(); };
  }, [model]);

  function toGraphPoint(e: PointerEvent): { x: number; y: number } | null {
    const matrix = layerRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function toSvgPoint(x: number, y: number) {
    const matrix = svgRef.current?.getScreenCTM();
    return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : null;
  }

  function startNodeDrag(e: PointerEvent, node: SimNode) {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    movedRef.current = false;
    dragRef.current = { kind: "node", node, startX: e.clientX, startY: e.clientY };
    node.fx = node.x;
    node.fy = node.y;
    simRef.current?.sim.simulation.alphaTarget(0.3).restart();
  }

  function startPan(e: PointerEvent) {
    svgRef.current?.setPointerCapture(e.pointerId);
    movedRef.current = false;
    dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, panX: camera.x, panY: camera.y };
  }

  function onPointerMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (drag === null) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true;
    switch (drag.kind) {
      case "node": {
        const point = toGraphPoint(e);
        if (point === null) return;
        drag.node.fx = point.x;
        drag.node.fy = point.y;
        return;
      }
      case "pan": {
        const start = toSvgPoint(drag.startX, drag.startY);
        const point = toSvgPoint(e.clientX, e.clientY);
        if (start && point) setCamera(previous => ({ ...previous, x: drag.panX + point.x - start.x, y: drag.panY + point.y - start.y }));
        return;
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (drag?.kind !== "node") return;
    drag.node.fx = null;
    drag.node.fy = null;
    simRef.current?.sim.simulation.alphaTarget(0);
    if (!movedRef.current && drag.node.id !== ME_ID) setSelectedId(drag.node.id);
  }

  function recenter() {
    setCamera({ x: 0, y: 0, zoom: 1 });
    simRef.current?.sim.simulation.alpha(0.6).restart();
  }

  const sim = model !== null && simRef.current?.graph === model.graph ? simRef.current.sim : null;
  const me = sim?.nodes.get(ME_ID);
  const selected = selectedId === null ? undefined : model?.byId.get(selectedId);
  const selectedOwned = selectedId !== null && (model?.ownedIds.has(selectedId) ?? false);

  function zoom(factor: number) {
    if (model) setCamera(previous => zoomCamera(previous, factor, { x: model.seed.width / 2, y: model.seed.height / 2 }));
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toSvgPoint(event.clientX, event.clientY);
      if (point) setCamera(previous => zoomCamera(previous, Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .003), point));
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [model, sim]);

  return (
    <>
      <div className="graph-panel-header">
        <div>
          <p className="graph-title">추천 근거 그래프</p>
          <p className="graph-sub">지식그래프 · 노드를 클릭하여 상세정보를 확인하세요</p>
        </div>
        <div className="graph-controls" role="group" aria-label="그래프 보기 조절">
          <button className="graph-zoom-btn" aria-label="그래프 축소" disabled={!sim || camera.zoom <= MIN_ZOOM} onClick={() => zoom(1 / 1.2)}>−</button>
          <button className="graph-center-btn" onClick={recenter} title="확대와 위치 초기화">{Math.round(camera.zoom * 100)}%</button>
          <button className="graph-zoom-btn" aria-label="그래프 확대" disabled={!sim || camera.zoom >= MAX_ZOOM} onClick={() => zoom(1.2)}>+</button>
        </div>
      </div>

      <div className="graph-canvas">
        {status !== "ready" || model === null || sim === null || me === undefined ? (
          <p className="graph-empty">
            {status === "loading" ? "Neo4j에서 근거 그래프를 불러오는 중…"
              : status === "error" ? "근거 그래프를 불러오지 못했어요. 잠시 후 다시 시도해주세요."
              : "목표 직무를 선택하면 근거 그래프가 표시돼요."}
          </p>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${model.seed.width} ${model.seed.height}`}
            width="100%"
            height="100%"
            style={{ cursor: "grab", touchAction: "none", userSelect: "none" }}
            onPointerDown={startPan}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <g ref={layerRef} transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
              {sim.links.map((link) => (
                <line key={`${link.source.id}>${link.target.id}`}
                  x1={link.source.x} y1={link.source.y} x2={link.target.x} y2={link.target.y}
                  {...(link.dashed
                    ? { stroke: "#16a34a", strokeWidth: 1.2, strokeDasharray: "4 4", opacity: 0.6 }
                    : { stroke: "#d1d5db", strokeWidth: 1.5 })} />
              ))}
              {model.graph.nodes.map((node) => {
                const p = sim.nodes.get(node.id);
                if (p === undefined) return null;
                const visual: Visual = model.ownedIds.has(node.id) ? "have" : node.kind;
                const inside = node.kind === "role";
                return (
                  <g key={node.id} className={`graph-node${inside ? " graph-node--no-scale" : ""}`}
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => startNodeDrag(e, p)}>
                    <title>{node.label}</title>
                    <circle cx={p.x} cy={p.y} r={p.r} fill={COLORS[visual]} />
                    <text x={p.x} y={inside ? p.y : p.y + p.r + 15} textAnchor="middle" dominantBaseline="middle"
                      fill={inside ? "#ffffff" : "#374151"} fontSize={inside ? 17 : 14}
                      fontWeight={600} fontFamily="inherit" style={{ pointerEvents: "none" }}>
                      {shorten(node.label, inside ? 9 : 13)}
                    </text>
                  </g>
                );
              })}
              <g className="graph-node" style={{ cursor: "pointer" }} onPointerDown={(e) => startNodeDrag(e, me)}>
                <circle cx={me.x} cy={me.y} r={me.r} fill={COLORS.me} />
                <text x={me.x} y={me.y} textAnchor="middle" dominantBaseline="middle" fill="#fff"
                  fontSize={16} fontWeight={600} fontFamily="inherit" style={{ pointerEvents: "none" }}>나</text>
              </g>
            </g>
          </svg>
        )}
      </div>

      {selected && (
        <div className="node-popup">
          <button className="node-popup-close" onClick={() => setSelectedId(null)}>✕</button>
          <span className="node-popup-badge">{selectedOwned ? "보유 역량" : KIND_LABEL[selected.kind]}</span>
          <p className="node-popup-title">{selected.label}</p>
          {selected.detail && (
            <p className="node-popup-desc" style={{ whiteSpace: "pre-line" }}>{selected.detail}</p>
          )}
          <button className="node-popup-btn" onClick={onOpenRoadmap}>로드맵에서 보기</button>
        </div>
      )}

      <div className="graph-legend">
        {LEGEND.map(({ visual, label }) => (
          <span key={visual} className="legend-item">
            <span className="legend-dot" style={{ background: COLORS[visual] }} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
