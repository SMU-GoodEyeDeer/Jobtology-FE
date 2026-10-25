import { edgeIdentity, mergeWorkspace, type WorkspaceGraph, type WorkspaceNode } from "./chatWorkspace";
import { resourcesApi } from "./resourcesApi";
import { readPostingsCache } from "./postingsCache";

export function crosswalkNodeId(node: WorkspaceNode): string | null {
  const id = node.id.replace(/^urn:jobtology:ncs:/, "ncs:");
  if (node.kind === "ncs_competency") {
    if (/^ncs:unit:\d{10}(?:_\d{2,4}v\d+)?$/.test(id)) return id;
    return /^\d{10}$/.test(node.ncs_base_code ?? "") ? `ncs:unit:${node.ncs_base_code}` : null;
  }
  if (node.kind === "ncs_occupation") {
    if (/^ncs:occupation:\d{8}$/.test(id)) return id;
    return /^\d{8}$/.test(node.occupation_code ?? "") ? `ncs:occupation:${node.occupation_code}` : null;
  }
  if (node.kind === "onet_occupation") {
    if (/^urn:jobtology:onet:occupation:\d{2}-\d{4}\.\d{2}$/.test(id)) return id;
    if (/^onet:occupation:\d{2}-\d{4}\.\d{2}$/.test(id)) return `urn:jobtology:${id}`;
    return /^\d{2}-\d{4}\.\d{2}$/.test(node.occupation_code ?? "") ? `urn:jobtology:onet:occupation:${node.occupation_code}` : null;
  }
  if (["onet_skill", "technology"].includes(node.kind) && /^(?:onet:skill:|urn:jobtology:onet-detail:)\S+$/.test(id)) return id;
  return null;
}

export function crosswalkContext(graph: WorkspaceGraph): string[] {
  return [...new Set([...graph.nodes]
    .sort((a, b) => Number(!a.kind.endsWith("occupation")) - Number(!b.kind.endsWith("occupation")) || a.id.localeCompare(b.id))
    .flatMap(node => crosswalkNodeId(node) ?? []))].slice(0, 48);
}

export function crosswalkReference(graph: WorkspaceGraph, node: WorkspaceNode, catalogId: string): WorkspaceGraph {
  if (node.id === catalogId || !graph.nodes.some(item => item.id === catalogId)) return graph;
  return mergeWorkspace(graph, { nodes: [node], edges: [{
    id: edgeIdentity(node.id, "CATALOG_REFERENCE", catalogId), source: node.id, target: catalogId,
    kind: "CATALOG_REFERENCE", basis: "REFERENCE", explanation: "현재 카탈로그 탐색용 연결 · 저장된 분석의 평가 근거는 유지돼요.",
  }], truncated: false });
}

export function readCrosswalk(nodeId: string, limit: number, contextNodes: readonly string[] = []) {
  return readPostingsCache(JSON.stringify(["crosswalk-connected", nodeId, limit, contextNodes]), () => contextNodes.length
    ? resourcesApi.crosswalk(nodeId, limit, 0, contextNodes) : resourcesApi.crosswalk(nodeId, limit));
}

export function connectCrosswalk(current: WorkspaceGraph, incoming: WorkspaceGraph, includeNeighbors = false): WorkspaceGraph {
  const originals = new Map(current.nodes.map(node => [node.id, node]));
  const existing = new Set(originals.keys());
  const kept = new Set([...existing, ...(includeNeighbors ? incoming.nodes.map(node => node.id) : [])]);
  return mergeWorkspace(current, { ...incoming,
    nodes: includeNeighbors ? incoming.nodes.map(node => originals.get(node.id) ?? node) : [],
    edges: incoming.edges.filter(edge => kept.has(edge.source) && kept.has(edge.target)),
    truncated: includeNeighbors && incoming.truncated,
  });
}
