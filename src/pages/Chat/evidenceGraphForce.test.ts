import { describe, expect, it } from "vitest";
import { createEvidenceSimulation, type ForceSeed } from "./evidenceGraphForce";

const seed: ForceSeed = {
  width: 600,
  height: 800,
  nodes: [
    { id: "role", r: 50, x: 300, y: 400 },
    { id: "a", r: 30, x: 300, y: 400 },
    { id: "b", r: 30, x: 301, y: 401 },
    { id: "leaf", r: 18, x: 302, y: 402 },
  ],
  links: [
    { source: "role", target: "a", dashed: false },
    { source: "role", target: "b", dashed: false },
    { source: "a", target: "leaf", dashed: false },
    { source: "role", target: "missing", dashed: false },
  ],
};

const settle = (sim: ReturnType<typeof createEvidenceSimulation>) => {
  sim.simulation.stop();
  sim.simulation.tick(300);
};

const node = (sim: ReturnType<typeof createEvidenceSimulation>, id: string) => {
  const found = sim.nodes.get(id);
  if (found === undefined) throw new Error(`missing node ${id}`);
  return found;
};

describe("createEvidenceSimulation", () => {
  it("pushes stacked nodes apart until their circles no longer overlap", () => {
    // Given
    const sim = createEvidenceSimulation(seed);

    // When
    settle(sim);

    // Then
    const nodes = [...sim.nodes.values()];
    for (const a of nodes) {
      for (const b of nodes) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
      }
    }
    expect(sim.links).toHaveLength(3);
  });

  it("pulls connected nodes along when one node is dragged and pinned", () => {
    // Given
    const sim = createEvidenceSimulation(seed);
    settle(sim);
    const a = node(sim, "a");
    const leaf = node(sim, "leaf");
    const leafBefore = { x: leaf.x, y: leaf.y };

    // When
    a.fx = a.x + 200;
    a.fy = a.y + 200;
    sim.simulation.alpha(0.5);
    sim.simulation.tick(120);

    // Then
    expect(Math.hypot(leaf.x - leafBefore.x, leaf.y - leafBefore.y)).toBeGreaterThan(80);
  });

  it("keeps every node inside the panel even when dragged past its edge", () => {
    // Given
    const sim = createEvidenceSimulation(seed);
    const leaf = node(sim, "leaf");

    // When
    leaf.fx = 5000;
    leaf.fy = -5000;
    sim.simulation.stop();
    sim.simulation.tick(50);

    // Then
    for (const each of sim.nodes.values()) {
      expect(each.x).toBeGreaterThanOrEqual(each.r);
      expect(each.x).toBeLessThanOrEqual(seed.width - each.r);
      expect(each.y).toBeGreaterThanOrEqual(each.r);
      expect(each.y).toBeLessThanOrEqual(seed.height - each.r);
    }
  });

  it("keeps the previous position of nodes that survive a rebuild", () => {
    // Given
    const previous = new Map([["leaf", { x: 42, y: 24 }]]);

    // When
    const sim = createEvidenceSimulation(seed, previous);

    // Then
    const leaf = node(sim, "leaf");
    expect([leaf.x, leaf.y]).toEqual([42, 24]);
  });
});
