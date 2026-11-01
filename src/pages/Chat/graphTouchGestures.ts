import type { InteractiveNvlWrapper } from "@neo4j-nvl/react";
import type { ComponentRef } from "react";

type TouchGraph = Pick<ComponentRef<typeof InteractiveNvlWrapper>, "getScale" | "getPan" | "getZoomLimits" | "getHits" | "setZoomAndPan" | "setNodePositions">;
type Point = { x: number; y: number };

// NVL's built-in interactions only listen for mouse and wheel events.
export function attachGraphTouchGestures(element: HTMLElement, graph: TouchGraph, onSelect: (id: string | null) => void, onViewChange: (zoom: number) => void) {
  const pointers = new Map<number, Point>();
  let start: { center: Point; distance: number; zoom: number; pan: Point } | null = null;
  let draggedNode: { id: string; x: number; y: number } | null = null;
  let tapId: string | null = null;
  let canTap = false;
  let suppressClickUntil = 0;

  function measure() {
    const [a, b] = [...pointers.values()];
    return { center: b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a,
      distance: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0 };
  }
  function rebase() {
    start = pointers.size ? { ...measure(), zoom: graph.getScale(), pan: graph.getPan() } : null;
  }
  function down(event: PointerEvent) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    event.preventDefault(); // Avoid compatibility mouse events starting a second interaction.
    suppressClickUntil = performance.now() + 500;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    element.setPointerCapture(event.pointerId);
    draggedNode = null;
    canTap = pointers.size === 1;
    if (canTap) {
      const hit = graph.getHits(event, ["node"]).nvlTargets.nodes[0];
      tapId = hit?.data.id ?? null;
      if (hit?.insideNode) draggedNode = { id: hit.data.id, ...hit.targetCoordinates };
    }
    rebase();
  }
  function move(event: PointerEvent) {
    if (!pointers.has(event.pointerId) || !start) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const { center, distance } = measure();
    const dx = center.x - start.center.x, dy = center.y - start.center.y;
    if (canTap && Math.hypot(dx, dy) < 5) return;
    canTap = false;
    const ratio = window.devicePixelRatio || 1;
    if (pointers.size === 1 && draggedNode) {
      graph.setNodePositions([{ id: draggedNode.id, x: draggedNode.x + dx * ratio / start.zoom,
        y: draggedNode.y + dy * ratio / start.zoom, pinned: true }], true);
      onViewChange(start.zoom);
      return;
    }
    const limits = graph.getZoomLimits();
    const zoom = pointers.size > 1
      ? Math.max(limits.minZoom, Math.min(limits.maxZoom, start.zoom * distance / Math.max(1, start.distance)))
      : start.zoom;
    const bounds = element.getBoundingClientRect();
    const offset = { x: (start.center.x - bounds.left - bounds.width / 2) * ratio,
      y: (start.center.y - bounds.top - bounds.height / 2) * ratio };
    // Keep the graph point beneath the fingers fixed while their midpoint moves.
    graph.setZoomAndPan(zoom, start.pan.x + offset.x / start.zoom - (offset.x + dx * ratio) / zoom,
      start.pan.y + offset.y / start.zoom - (offset.y + dy * ratio) / zoom);
    onViewChange(zoom);
  }
  function up(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    if (event.type === "pointerup" && canTap) onSelect(tapId);
    canTap = false;
    draggedNode = null;
    pointers.delete(event.pointerId);
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    suppressClickUntil = performance.now() + 500;
    // Pinch → one finger pan must continue from the current camera without jumping.
    rebase();
  }
  function suppressClick(event: MouseEvent) {
    if (event.detail > 0 && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  element.addEventListener("pointerdown", down, { capture: true, passive: false });
  element.addEventListener("pointermove", move, { capture: true, passive: false });
  element.addEventListener("pointerup", up, true);
  element.addEventListener("pointercancel", up, true);
  element.addEventListener("lostpointercapture", up, true);
  element.addEventListener("click", suppressClick, true);
  return () => {
    element.removeEventListener("pointerdown", down, true);
    element.removeEventListener("pointermove", move, true);
    element.removeEventListener("pointerup", up, true);
    element.removeEventListener("pointercancel", up, true);
    element.removeEventListener("lostpointercapture", up, true);
    element.removeEventListener("click", suppressClick, true);
    for (const id of pointers.keys()) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  };
}
