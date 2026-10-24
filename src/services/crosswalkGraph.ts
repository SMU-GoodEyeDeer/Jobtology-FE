import { mergeWorkspace, type WorkspaceGraph } from "./chatWorkspace";
import { resourcesApi } from "./resourcesApi";
import { readPostingsCache } from "./postingsCache";

export function crosswalkContext(graph: WorkspaceGraph): string[] {
  return graph.nodes.filter(node => ["ncs_occupation", "onet_occupation", "ncs_competency", "onet_skill"].includes(node.kind))
    .sort((a, b) => Number(!a.kind.endsWith("occupation")) - Number(!b.kind.endsWith("occupation")) || a.id.localeCompare(b.id))
    .slice(0, 48).map(node => node.id);
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
