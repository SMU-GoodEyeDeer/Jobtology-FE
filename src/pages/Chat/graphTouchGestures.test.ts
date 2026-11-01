// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachGraphTouchGestures } from "./graphTouchGestures";

type TouchGraph = Parameters<typeof attachGraphTouchGestures>[1];
let element: HTMLDivElement, cleanup: () => void;
let zoom: number, pan: { x: number; y: number }, hit: { id: string; x: number; y: number } | null;
let graph: TouchGraph;
let select: ReturnType<typeof vi.fn<(id: string | null) => void>>, change: ReturnType<typeof vi.fn<(zoom: number) => void>>;
let captured: Set<number>;
function pointer(type: string, id: number, x: number, y: number, pointerType = "touch") {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: pointerType } });
  element.dispatchEvent(event);
  return event;
}
beforeEach(() => {
  vi.stubGlobal("devicePixelRatio", 2);
  element = document.createElement("div"); document.body.append(element);
  element.getBoundingClientRect = () => ({ left: 20, top: 50, width: 400, height: 300 }) as DOMRect;
  captured = new Set();
  element.setPointerCapture = id => { captured.add(id); };
  element.hasPointerCapture = id => captured.has(id);
  element.releasePointerCapture = id => { captured.delete(id); };
  zoom = .5; pan = { x: 10, y: 20 }; hit = null;
  graph = {
    getScale: () => zoom, getPan: () => ({ ...pan }), getZoomLimits: () => ({ minZoom: .08, maxZoom: 2 }),
    getHits: vi.fn(() => ({ nvlTargets: { nodes: hit ? [{ data: { id: hit.id }, targetCoordinates: { x: hit.x, y: hit.y }, insideNode: true }] : [] } }) as ReturnType<TouchGraph["getHits"]>),
    setZoomAndPan: vi.fn((next, x, y) => { zoom = next; pan = { x, y }; }),
    setNodePositions: vi.fn(),
  };
  select = vi.fn<(id: string | null) => void>(); change = vi.fn<(zoom: number) => void>();
  cleanup = attachGraphTouchGestures(element, graph, select, change);
});
afterEach(() => { cleanup(); element.remove(); vi.unstubAllGlobals(); });

describe("graph touch gestures", () => {
  it("pans the map with one finger at the current zoom and pixel density", () => {
    expect(pointer("pointerdown", 1, 100, 200).defaultPrevented).toBe(true);
    expect(captured.has(1)).toBe(true);
    pointer("pointermove", 1, 140, 170);
    expect(graph.setZoomAndPan).toHaveBeenLastCalledWith(.5, -150, 140);
    expect(change).toHaveBeenLastCalledWith(.5);
    pointer("pointerup", 1, 140, 170);
    expect(captured.size).toBe(0);
    expect(select).not.toHaveBeenCalled();
  });
  it("zooms around the pinch midpoint and continues panning after one finger lifts", () => {
    pointer("pointerdown", 1, 120, 150);
    pointer("pointerdown", 2, 220, 150);
    pointer("pointermove", 1, 70, 150);
    pointer("pointermove", 2, 270, 150);
    expect(graph.setZoomAndPan).toHaveBeenLastCalledWith(1, -90, -80);
    pointer("pointerup", 2, 270, 150);
    pointer("pointermove", 1, 90, 160);
    expect(graph.setZoomAndPan).toHaveBeenLastCalledWith(1, -130, -100);
    pointer("pointerup", 1, 90, 160);
    expect(select).not.toHaveBeenCalled();
  });
  it("honors zoom limits while two fingers pan together", () => {
    pointer("pointerdown", 1, 120, 150);
    pointer("pointerdown", 2, 220, 150);
    pointer("pointermove", 2, 1120, 150);
    expect(zoom).toBe(2);
    pointer("pointermove", 2, 121, 150);
    expect(zoom).toBe(.08);
    expect(Number.isFinite(pan.x) && Number.isFinite(pan.y)).toBe(true);
  });
  it("drags and pins a node without panning or selecting it", () => {
    hit = { id: "skill", x: 5, y: 15 };
    pointer("pointerdown", 1, 100, 200);
    pointer("pointermove", 1, 130, 210);
    expect(graph.setNodePositions).toHaveBeenLastCalledWith([{ id: "skill", x: 125, y: 55, pinned: true }], true);
    expect(graph.setZoomAndPan).not.toHaveBeenCalled();
    pointer("pointerup", 1, 130, 210);
    expect(select).not.toHaveBeenCalled();
  });
  it("switches from node dragging to pinch without moving the node again", () => {
    hit = { id: "skill", x: 5, y: 15 };
    pointer("pointerdown", 1, 100, 200);
    pointer("pointermove", 1, 130, 210);
    pointer("pointerdown", 2, 230, 210);
    pointer("pointermove", 2, 280, 210);
    expect(graph.setNodePositions).toHaveBeenCalledTimes(1);
    expect(zoom).toBe(.75);
  });
  it("selects a tapped node once and suppresses its compatibility click", () => {
    hit = { id: "skill", x: 5, y: 15 };
    const nativeClick = vi.fn(); element.addEventListener("click", nativeClick);
    pointer("pointerdown", 1, 100, 200);
    pointer("pointermove", 1, 102, 201);
    pointer("pointerup", 1, 102, 201);
    expect(select).toHaveBeenCalledExactlyOnceWith("skill");
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(nativeClick).not.toHaveBeenCalled();
    element.click(); // Keyboard/programmatic activation still reaches the native handler.
    expect(nativeClick).toHaveBeenCalledTimes(1);
  });
  it("clears selection on a canvas tap and cancels interrupted gestures", () => {
    pointer("pointerdown", 1, 100, 200);
    pointer("pointerup", 1, 100, 200);
    expect(select).toHaveBeenCalledExactlyOnceWith(null);
    select.mockClear();
    pointer("pointerdown", 1, 100, 200);
    pointer("pointercancel", 1, 100, 200);
    pointer("pointermove", 1, 200, 300);
    expect(select).not.toHaveBeenCalled();
    expect(graph.setZoomAndPan).not.toHaveBeenCalled();
    expect(captured.size).toBe(0);
  });
  it("leaves mouse interactions to NVL and releases capture when detached", () => {
    expect(pointer("pointerdown", 1, 100, 200, "mouse").defaultPrevented).toBe(false);
    pointer("pointermove", 1, 200, 300, "mouse");
    expect(graph.setZoomAndPan).not.toHaveBeenCalled();
    pointer("pointerdown", 2, 100, 200, "pen");
    expect(captured.has(2)).toBe(true);
    cleanup();
    expect(captured.size).toBe(0);
    pointer("pointermove", 2, 200, 300, "pen");
    expect(graph.setZoomAndPan).not.toHaveBeenCalled();
  });
});
