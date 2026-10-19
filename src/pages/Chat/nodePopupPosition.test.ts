import { describe, expect, it } from "vitest";
import { nodePopupPosition } from "./nodePopupPosition";

describe("node popup placement", () => {
  const popup = { width: 260, height: 180 };
  const bounds = { width: 600, height: 500 };
  it("points back to the node from an adjacent open space", () => {
    const position = nodePopupPosition({ x: 120, y: 250, r: 20 }, bounds, popup);
    expect(position.side).toBe("right");
    expect(position.x).toBeGreaterThan(140);
    expect(position.y + position.arrow).toBe(250);
  });
  it("flips and stays inside the canvas at the right edge", () => {
    const position = nodePopupPosition({ x: 570, y: 480, r: 20 }, bounds, popup);
    expect(position.side).toBe("left");
    expect(position.x + popup.width).toBeLessThanOrEqual(bounds.width - 8);
    expect(position.y + popup.height).toBeLessThanOrEqual(bounds.height - 8);
  });
  it("uses vertical placement on a narrow canvas", () => {
    const position = nodePopupPosition({ x: 150, y: 50, r: 20 }, { width: 300, height: 500 }, popup);
    expect(position.side).toBe("bottom");
    expect(position.x).toBeGreaterThanOrEqual(8);
    expect(position.x + popup.width).toBeLessThanOrEqual(292);
  });
});
