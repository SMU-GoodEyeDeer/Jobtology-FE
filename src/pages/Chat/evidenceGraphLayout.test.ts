import { describe, expect, it } from "vitest";
import type { EvidenceEdge, EvidenceNode } from "../../services/types";
import { isOwned, layoutEvidenceGraph } from "./evidenceGraphLayout";

const node = (id: string, kind: EvidenceNode["kind"]): EvidenceNode =>
  ({ id, kind, label: id, detail: null, weight: null });
const edge = (source: string, target: string): EvidenceEdge =>
  ({ source, target, kind: "X", weight: null });

describe("layoutEvidenceGraph", () => {
  it("places the role at the centre and children on increasing rings", () => {
    // Given
    const nodes = [node("role", "role"), node("ncs", "ncs_occupation"), node("tech", "technology")];
    const edges = [edge("role", "ncs"), edge("ncs", "tech")];

    // When
    const layout = layoutEvidenceGraph(nodes, edges);

    // Then
    const [role, ncs, tech] = layout.nodes;
    const [cx, cy] = [layout.width / 2, layout.height / 2];
    expect([role.x, role.y]).toEqual([cx, cy]);
    expect(Math.hypot(ncs.x - cx, ncs.y - cy)).toBeLessThan(Math.hypot(tech.x - cx, tech.y - cy));
  });

  it("places a node shared by two parents only once", () => {
    // Given
    const nodes = [node("role", "role"), node("a", "onet_occupation"), node("b", "onet_occupation"), node("py", "technology")];
    const edges = [edge("role", "a"), edge("role", "b"), edge("a", "py"), edge("b", "py")];

    // When
    const layout = layoutEvidenceGraph(nodes, edges);

    // Then
    expect(layout.nodes.filter((placed) => placed.node.id === "py")).toHaveLength(1);
  });
});

describe("isOwned", () => {
  it("matches a stored capability against a word inside a longer technology name", () => {
    // Given
    const owned = new Set(["sql", "python"]);

    // When / Then
    expect(isOwned("Structured query language SQL", owned)).toBe(true);
    expect(isOwned("Python", owned)).toBe(true);
    expect(isOwned("Apache Kafka", owned)).toBe(false);
  });
});
