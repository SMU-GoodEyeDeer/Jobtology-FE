import { useEffect, useRef, useState } from "react";
import type { EvidenceNodeKind, RoleEvidenceGraph } from "../../services/types";
import { isOwned, layoutEvidenceGraph, type PlacedNode } from "./evidenceGraphLayout";

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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<PlacedNode | null>(null);
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    setSelected(null);
    setPan({ x: 0, y: 0 });
  }, [graph]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const start = panStart.current;
      if (start === null) return;
      const dx = e.clientX - start.mx;
      const dy = e.clientY - start.my;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      setPan({ x: start.px + dx, y: start.py + dy });
    }
    function onUp() { panStart.current = null; }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const layout = graph ? layoutEvidenceGraph(graph.nodes, graph.edges) : null;
  const placed = new Map(layout?.nodes.map((p) => [p.node.id, p]) ?? []);
  const owned = (p: PlacedNode) => SKILL_KINDS.has(p.node.kind) && isOwned(p.node.label, ownedSkills);
  const ownedNodes = layout?.nodes.filter(owned) ?? [];
  const me = layout ? { x: 52, y: layout.height - 52 } : null;
  const root = layout?.nodes[0];

  return (
    <>
      <div className="graph-panel-header">
        <div>
          <p className="graph-title">추천 근거 그래프</p>
          <p className="graph-sub">Neo4j 지식그래프 · 드래그로 이동, 노드를 눌러 근거 보기</p>
        </div>
        <button className="graph-center-btn" onClick={() => setPan({ x: 0, y: 0 })}>중앙 정렬</button>
      </div>

      <div className="graph-canvas">
        {status !== "ready" || layout === null || me === null || root === undefined ? (
          <p className="graph-empty">
            {status === "loading" ? "Neo4j에서 근거 그래프를 불러오는 중…"
              : status === "error" ? "근거 그래프를 불러오지 못했어요. 잠시 후 다시 시도해주세요."
              : "목표 직무를 선택하면 근거 그래프가 표시돼요."}
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width="100%"
            height="100%"
            style={{ cursor: "grab" }}
            onMouseDown={(e) => {
              e.preventDefault();
              moved.current = false;
              panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
            }}
          >
            <g transform={`translate(${pan.x}, ${pan.y})`}>
              {graph?.edges.map((edge) => {
                const a = placed.get(edge.source);
                const b = placed.get(edge.target);
                if (a === undefined || b === undefined) return null;
                return (
                  <line key={`${edge.source}>${edge.target}:${edge.kind}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d1d5db" strokeWidth={1.5} />
                );
              })}
              {[root, ...ownedNodes].map((target) => (
                <line key={`me>${target.node.id}`} x1={me.x} y1={me.y} x2={target.x} y2={target.y}
                  stroke="#16a34a" strokeWidth={1.2} strokeDasharray="4 4" opacity={0.6} />
              ))}
              {layout.nodes.map((p) => {
                const visual: Visual = owned(p) ? "have" : p.node.kind;
                const inside = p.node.kind === "role";
                return (
                  <g key={p.node.id} className={`graph-node${p.node.kind === "role" ? " graph-node--no-scale" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => { if (!moved.current) setSelected(p); }}>
                    <title>{p.node.label}</title>
                    <circle cx={p.x} cy={p.y} r={p.r} fill={COLORS[visual]} />
                    <text x={p.x} y={inside ? p.y : p.y + p.r + 15} textAnchor="middle" dominantBaseline="middle"
                      fill={inside ? "#ffffff" : "#374151"} fontSize={p.node.kind === "role" ? 17 : 14}
                      fontWeight={600} fontFamily="inherit">
                      {shorten(p.node.label, inside ? 9 : 13)}
                    </text>
                  </g>
                );
              })}
              <g className="graph-node">
                <circle cx={me.x} cy={me.y} r={32} fill={COLORS.me} />
                <text x={me.x} y={me.y} textAnchor="middle" dominantBaseline="middle" fill="#fff"
                  fontSize={16} fontWeight={600} fontFamily="inherit">나</text>
              </g>
            </g>
          </svg>
        )}
      </div>

      {selected && (
        <div className="node-popup">
          <button className="node-popup-close" onClick={() => setSelected(null)}>✕</button>
          <span className="node-popup-badge">
            {owned(selected) ? "보유 역량" : KIND_LABEL[selected.node.kind]}
          </span>
          <p className="node-popup-title">{selected.node.label}</p>
          {selected.node.detail && (
            <p className="node-popup-desc" style={{ whiteSpace: "pre-line" }}>{selected.node.detail}</p>
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
