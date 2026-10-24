import { describe, expect, it } from "vitest";
import { connectCrosswalk } from "./crosswalkGraph";
import type { WorkspaceGraph } from "./chatWorkspace";

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
