import { useEffect } from "react";
import type { RefObject } from "react";
import { useReducedMotion } from "motion/react";
import { connectionPath } from "./landingGraphModel";
import type { Point } from "./landingGraphModel";
import { attractionOffset, characterAttraction } from "./mouseField";

export function useMouseField(root: RefObject<HTMLElement | null>, enabled: boolean) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const page = root.current;
    if (!page || !enabled || reduceMotion) return;
    const finePointer = window.matchMedia("(any-pointer: fine)");
    const items = [...page.querySelectorAll<HTMLElement>("[data-mouse-field]")].map(element => ({ element, offset: { x: 0, y: 0 }, strength: Number(element.dataset.mouseField) || 16, radius: Number(element.dataset.fieldRadius) || 200, character: element.dataset.fieldKind === "character" }));
    const board = page.querySelector<HTMLElement>(".landing-graph");
    const edges = [...page.querySelectorAll<SVGPathElement>("[data-edge-from]")];
    let pointer: Point | null = null, frame = 0, previousTime = 0;

    function tick(time: number) {
      frame = 0;
      const easing = 1 - Math.exp(-12 * Math.min((time - previousTime) / 1000 || 1 / 60, .05));
      previousTime = time;
      const area = board?.getBoundingClientRect();
      const nodes = new Map<string, Point>();
      // Read all geometry first, then write transforms and paths together.
      const updates = items.map(item => {
        const rect = item.element.getBoundingClientRect();
        const bounds = { left: rect.left - item.offset.x, top: rect.top - item.offset.y, width: rect.width, height: rect.height };
        const localPointer = item.element.matches(":focus-visible") || item.element.querySelector(":focus-visible") ? null : pointer;
        const target = (item.character ? characterAttraction : attractionOffset)(bounds, localPointer, item.strength, item.radius);
        const offset = { x: item.offset.x + (target.x - item.offset.x) * easing, y: item.offset.y + (target.y - item.offset.y) * easing };
        if (Math.abs(target.x - offset.x) < .02) offset.x = target.x;
        if (Math.abs(target.y - offset.y) < .02) offset.y = target.y;
        if (item.element.dataset.graphNode && area?.width && area.height) nodes.set(item.element.dataset.graphNode, {
          x: (bounds.left + bounds.width / 2 + offset.x - area.left) / area.width * 100,
          y: (bounds.top + bounds.height / 2 + offset.y - area.top) / area.height * 100,
        });
        return { item, offset, moving: offset.x !== target.x || offset.y !== target.y };
      });
      for (const { item, offset } of updates) {
        item.offset = offset;
        item.element.style.setProperty("--field-x", `${offset.x}px`);
        item.element.style.setProperty("--field-y", `${offset.y}px`);
        if (item.character) item.element.style.setProperty("--field-tilt", `${offset.x * .18}deg`);
      }
      for (const edge of edges) {
        const from = nodes.get(edge.dataset.edgeFrom!), to = nodes.get(edge.dataset.edgeTo!);
        if (from && to) edge.setAttribute("d", connectionPath(from, to));
      }
      if (updates.some(update => update.moving)) frame = requestAnimationFrame(tick);
    }
    function schedule() { if (!frame) { previousTime = 0; frame = requestAnimationFrame(tick); } }
    function clear() { pointer = null; schedule(); }
    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse" || !finePointer.matches) return;
      pointer = { x: event.clientX, y: event.clientY }; schedule();
    }
    page.addEventListener("pointermove", move);
    page.addEventListener("pointerleave", clear);
    page.addEventListener("keydown", clear);
    window.addEventListener("blur", clear);
    window.addEventListener("scroll", clear, { passive: true });
    window.addEventListener("resize", clear);
    finePointer.addEventListener("change", clear);
    return () => {
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerleave", clear);
      page.removeEventListener("keydown", clear);
      window.removeEventListener("blur", clear);
      window.removeEventListener("scroll", clear);
      window.removeEventListener("resize", clear);
      finePointer.removeEventListener("change", clear);
      if (frame) cancelAnimationFrame(frame);
      for (const { element } of items) { element.style.removeProperty("--field-x"); element.style.removeProperty("--field-y"); element.style.removeProperty("--field-tilt"); }
      // Restore SVG endpoints as well when reduced motion changes at runtime.
      const area = board?.getBoundingClientRect();
      if (!area?.width || !area.height) return;
      const nodes = new Map(items.filter(item => item.element.dataset.graphNode).map(({ element }) => {
        const rect = element.getBoundingClientRect();
        return [element.dataset.graphNode!, { x: (rect.left + rect.width / 2 - area.left) / area.width * 100, y: (rect.top + rect.height / 2 - area.top) / area.height * 100 }] as const;
      }));
      for (const edge of edges) {
        const from = nodes.get(edge.dataset.edgeFrom!), to = nodes.get(edge.dataset.edgeTo!);
        if (from && to) edge.setAttribute("d", connectionPath(from, to));
      }
    };
  }, [root, enabled, reduceMotion]);
}
