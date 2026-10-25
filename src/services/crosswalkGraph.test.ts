import { describe, expect, it } from "vitest";
import { connectCrosswalk, crosswalkContext, crosswalkNodeId, crosswalkReference } from "./crosswalkGraph";
import type { WorkspaceGraph, WorkspaceNode } from "./chatWorkspace";

const current: WorkspaceGraph = { nodes: [
  { id: "ncs", kind: "ncs_competency", label: "내 역량", basis: "REVIEWED_REQUIREMENT", source_pin: "approved" },
  { id: "onet", kind: "onet_occupation", label: "Software Developers", basis: "REFERENCE" },
], edges: [], truncated: false };
const incoming: WorkspaceGraph = { nodes: [
  { ...current.nodes[0], label: "카탈로그 이름", basis: "REFERENCE" }, current.nodes[1],
  { id: "skill", kind: "onet_skill", label: "Programming", basis: "REFERENCE" },
], edges: [
  { id: "occupation-map", source: "ncs", target: "onet", kind: "CROSSWALK_RELATED", basis: "PROPOSED", association_id: "one" },
  { id: "skill-map", source: "ncs", target: "skill", kind: "CROSSWALK_RELATED", basis: "PROPOSED", association_id: "two" },
  { id: "parent", source: "onet", target: "skill", kind: "ONET_ESSENTIAL_SKILL", basis: "REFERENCE" },
], truncated: false };

describe("crosswalk canvas connections", () => {
  it.each<[WorkspaceNode["kind"], string, string | null]>([
    ["onet_skill", "onet:skill:", null],
    ["onet_skill", "urn:jobtology:onet-detail:", null],
    ["technology", "onet:skill:", null],
    ["technology", "urn:jobtology:onet-detail:", null],
    ["onet_skill", "onet:skill: ", null],
    ["technology", "urn:jobtology:onet-detail:\t", null],
    ["onet_skill", "onet:skill:2.B.3.e", "onet:skill:2.B.3.e"],
    ["onet_skill", "urn:jobtology:onet-detail:element:2.A.2.a", "urn:jobtology:onet-detail:element:2.A.2.a"],
    ["technology", "urn:jobtology:onet-detail:software:python", "urn:jobtology:onet-detail:software:python"],
    ["technology", "technology:python", null],
    ["qualification", "onet:skill:2.B.3.e", null],
  ])("requires a nonempty O*NET identifier for %s: %s", (kind, id, expected) => {
    expect(crosswalkNodeId({ id, kind, label: "항목", basis: "REFERENCE" })).toBe(expected);
  });
  it("resolves requirement cards to catalog IDs and deduplicates context without mutating the graph", () => {
    const requirement = { id: "requirement:BACKEND_DEVELOPER:2001020406", kind: "ncs_competency" as const, label: "평가", basis: "REVIEWED_REQUIREMENT" as const, ncs_base_code: "2001020406" };
    const graph: WorkspaceGraph = { ...current, nodes: [requirement,
      { ...requirement, id: "ncs:unit:2001020406" },
      { id: "ncs:occupation:20010202", kind: "ncs_occupation", label: "직무", basis: "REFERENCE" },
    ] };
    expect(crosswalkNodeId(requirement)).toBe("ncs:unit:2001020406");
    const before = [...graph.nodes];
    expect(crosswalkContext(graph)).toEqual(["ncs:occupation:20010202", "ncs:unit:2001020406"]);
    expect(graph.nodes).toEqual(before);
    expect(crosswalkNodeId({ ...requirement, ncs_base_code: undefined })).toBeNull();
    expect(crosswalkNodeId({ ...requirement, id: "ncs:unit:2001020406_19v4" })).toBe("ncs:unit:2001020406_19v4");
  });
  it("links a stored requirement to current catalog context without replacing its assessment", () => {
    const requirement = { id: "requirement:BACKEND_DEVELOPER:2001020406", kind: "ncs_competency" as const, label: "저장된 평가", basis: "REVIEWED_REQUIREMENT" as const, source_pin: "old-analysis" };
    const catalog = { ...requirement, id: "ncs:unit:2001020406", label: "현재 카탈로그", basis: "REFERENCE" as const, source_pin: "current-catalog" };
    const reference = crosswalkReference({ ...incoming, nodes: [catalog] }, requirement, catalog.id);
    expect(reference.nodes.find(node => node.id === requirement.id)).toEqual(requirement);
    expect(reference.edges.some(edge => edge.source === requirement.id && edge.target === catalog.id && edge.kind === "CATALOG_REFERENCE")).toBe(true);
  });
  it("connects already visible categories without adding unrelated candidates or overwriting provenance", () => {
    const graph = connectCrosswalk(current, incoming);
    expect(graph.nodes).toEqual(current.nodes);
    expect(graph.edges.map(edge => edge.id)).toEqual(["occupation-map"]);
  });
  it("adds inspected mapping endpoints together with their actual category relationships", () => {
    const graph = connectCrosswalk(current, incoming, true);
    expect(graph.nodes.find(node => node.id === "ncs")).toEqual(current.nodes[0]);
    expect(graph.edges.map(edge => edge.id)).toEqual(["occupation-map", "skill-map", "parent"]);
    expect(graph.nodes.some(node => node.id === "skill")).toBe(true);
  });
  it("keeps mapping endpoints connected when the canvas reaches its node limit", () => {
    const crowded: WorkspaceGraph = { ...current, nodes: [...current.nodes,
      ...Array.from({ length: 158 }, (_, index) => ({ id: `other:${index}`, label: "기타", kind: "technology" as const, basis: "REFERENCE" as const }))] };
    const graph = connectCrosswalk(crowded, incoming, true);
    expect(graph.nodes).toHaveLength(160);
    expect(graph.edges.map(edge => edge.id)).toContain("skill-map");
    expect(graph.nodes.find(node => node.id === "ncs")?.source_pin).toBe("approved");
  });
});
