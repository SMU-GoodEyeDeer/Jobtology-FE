import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, zoomCamera } from "./graphCamera";

describe("graph zoom", () => {
  it("keeps the graph point beneath the cursor stationary", () => {
    const camera = { x: 20, y: -30, zoom: 1.2 };
    const anchor = { x: 350, y: 210 };
    const result = zoomCamera(camera, 1.4, anchor);
    expect((anchor.x - result.x) / result.zoom).toBeCloseTo((anchor.x - camera.x) / camera.zoom);
    expect((anchor.y - result.y) / result.zoom).toBeCloseTo((anchor.y - camera.y) / camera.zoom);
  });
  it("bounds zoom and does not drift at either limit", () => {
    const anchor = { x: 300, y: 200 };
    expect(zoomCamera({ x: 0, y: 0, zoom: 1 }, 100, anchor).zoom).toBe(MAX_ZOOM);
    const minimum = { x: 40, y: 80, zoom: MIN_ZOOM };
    expect(zoomCamera(minimum, .1, anchor)).toEqual(minimum);
  });
});
