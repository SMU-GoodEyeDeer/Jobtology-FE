import type { EvidenceEdge, EvidenceNode, EvidenceNodeKind } from "../../services/types";

export interface PlacedNode {
  readonly node: EvidenceNode;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly depth: number;
}

export interface GraphLayout {
  readonly nodes: readonly PlacedNode[];
  readonly width: number;
  readonly height: number;
}

const RING_RADIUS = [0, 105, 190, 262] as const;
const MARGIN = 72;
// The chat graph panel is tall and narrow, so rings are stretched vertically to fill it.
const Y_STRETCH = 1.4;

export function nodeRadius(kind: EvidenceNodeKind): number {
  switch (kind) {
    case "role": return 50;
    case "ncs_occupation": return 34;
    case "onet_occupation": return 30;
    case "posting_evidence": return 26;
    case "ncs_competency": return 20;
    case "onet_skill": return 18;
    case "qualification": return 22;
    case "technology": return 18;
    default: return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled evidence node kind: ${String(value)}`);
}

/**
 * Radial tree layout: the role sits at the centre and every subtree receives an
 * angular span proportional to its leaf count, so siblings never overlap.
 * Nodes reachable through several parents are placed under the first one found
 * (breadth-first); their extra edges are still drawn by the caller.
 */
export function layoutEvidenceGraph(
  nodes: readonly EvidenceNode[],
  edges: readonly EvidenceEdge[],
): GraphLayout {
  const root = nodes.find((node) => node.kind === "role");
  const outerRadius = RING_RADIUS[RING_RADIUS.length - 1];
  const width = 2 * (outerRadius + MARGIN);
  const height = 2 * (outerRadius * Y_STRETCH + MARGIN);
  if (root === undefined) return { nodes: [], width, height };

  const children = new Map<string, string[]>();
  const depth = new Map<string, number>([[root.id, 0]]);
  const queue = [root.id];
  for (let head = 0; head < queue.length; head += 1) {
    const parent = queue[head];
    for (const edge of edges) {
      if (edge.source !== parent || depth.has(edge.target)) continue;
      depth.set(edge.target, (depth.get(parent) ?? 0) + 1);
      children.set(parent, [...(children.get(parent) ?? []), edge.target]);
      queue.push(edge.target);
    }
  }

  const leaves = new Map<string, number>();
  const countLeaves = (id: string): number => {
    const kids = children.get(id) ?? [];
    const count = kids.length === 0 ? 1 : kids.reduce((sum, kid) => sum + countLeaves(kid), 0);
    leaves.set(id, count);
    return count;
  };
  countLeaves(root.id);

  const angle = new Map<string, number>();
  const assign = (id: string, start: number, span: number): void => {
    angle.set(id, start + span / 2);
    let cursor = start;
    for (const kid of children.get(id) ?? []) {
      const kidSpan = (span * (leaves.get(kid) ?? 1)) / (leaves.get(id) ?? 1);
      assign(kid, cursor, kidSpan);
      cursor += kidSpan;
    }
  };
  assign(root.id, -Math.PI / 2, 2 * Math.PI);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const placed: PlacedNode[] = [];
  for (const id of queue) {
    const node = byId.get(id);
    if (node === undefined) continue;
    const level = Math.min(depth.get(id) ?? 0, RING_RADIUS.length - 1);
    const theta = angle.get(id) ?? 0;
    const ring = RING_RADIUS[level];
    placed.push({
      node,
      x: width / 2 + ring * Math.cos(theta),
      y: height / 2 + ring * Y_STRETCH * Math.sin(theta),
      r: nodeRadius(node.kind),
      depth: level,
    });
  }
  return { nodes: placed, width, height };
}

export function isOwned(label: string, owned: ReadonlySet<string>): boolean {
  const lower = label.toLowerCase();
  if (owned.has(lower)) return true;
  return lower.split(/[^\p{L}\p{N}+#.]+/u).some((token) => token !== "" && owned.has(token));
}
