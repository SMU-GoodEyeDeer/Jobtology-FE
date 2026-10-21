// @vitest-environment jsdom
import { act, createElement as h, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMouseField } from "./useMouseField";
import { attractionOffset, characterAttraction } from "./mouseField";

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", () => ({ useReducedMotion: () => motion.reduced }));
let container: HTMLDivElement, root: ReturnType<typeof createRoot>, callbacks: Map<number, FrameRequestCallback>, now: number;
function Fixture() {
  const ref = useRef<HTMLElement>(null);
  useMouseField(ref, true);
  return h("main", { ref },
    h("h1", { "data-mouse-field": "18" }, "Heading"),
    h("div", { className: "landing-graph" },
      h("button", { "data-mouse-field": "36", "data-graph-node": "me" }, "Experience"),
      h("button", { "data-mouse-field": "36", "data-graph-node": "goal" }, "Goal"),
      h("svg", null, h("path", { "data-edge-from": "me", "data-edge-to": "goal", d: "M 10 25 C 20 25, 20 25, 30 25" })),
    ),
    h("h2", null,
      h("span", { "data-mouse-field": "24", "data-field-kind": "character", "data-field-radius": "160" }, "나"),
      h("span", { "data-mouse-field": "24", "data-field-kind": "character", "data-field-radius": "160" }, "의"),
    ),
  );
}
function frames(count = 90) {
  for (let i = 0; i < count && callbacks.size; i++) {
    const pending = [...callbacks.values()]; callbacks.clear(); now += 16;
    for (const callback of pending) callback(now);
  }
}
async function pointer(type: string, x: number, y: number, pointerType = "mouse") {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  await act(async () => container.querySelector("main")!.dispatchEvent(event));
  frames();
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  motion.reduced = false; callbacks = new Map(); now = 0;
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { callbacks.set(++id, callback); return id; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((key: number) => callbacks.delete(key)));
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(h(Fixture)));
  vi.spyOn(container.querySelector(".landing-graph")!, "getBoundingClientRect").mockReturnValue({ left: 100, top: 300, width: 1000, height: 400 } as DOMRect);
  for (const [index, element] of [...container.querySelectorAll<HTMLElement>("[data-mouse-field]")].entries()) {
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => ({
      left: (index === 2 ? 380 : index === 4 ? 240 : 180) + parseFloat(element.style.getPropertyValue("--field-x") || "0"),
      top: (index === 0 || index >= 3 ? 100 : 380) + parseFloat(element.style.getPropertyValue("--field-y") || "0"), width: 40, height: 40,
    } as DOMRect));
  }
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("attracts toward the pointer with bounded strength and no distant force", () => {
  const bounds = { left: 100, top: 100, width: 40, height: 40 };
  const offset = attractionOffset(bounds, { x: 90, y: 110 }, 36);
  expect(offset.x).toBeLessThan(0); expect(offset.y).toBeLessThan(0);
  expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(36);
  expect(attractionOffset(bounds, { x: 1000, y: 1000 }, 36)).toEqual({ x: 0, y: 0 });
  expect(attractionOffset(bounds, null, 36)).toEqual({ x: 0, y: 0 });
});

it("warps characters locally without pulling them through the pointer", async () => {
  const bounds = { left: 100, top: 100, width: 40, height: 40 };
  const close = characterAttraction(bounds, { x: 130, y: 120 }, 24, 160);
  expect(close.x).toBeGreaterThan(0); expect(close.x).toBeLessThan(10);
  expect(characterAttraction(bounds, { x: 400, y: 120 }, 24, 160)).toEqual({ x: 0, y: 0 });
  expect(characterAttraction(bounds, { x: 120, y: 120 }, 24, 160)).toEqual({ x: 0, y: 0 });
  await pointer("pointermove", 190, 120);
  const characters = [...container.querySelectorAll<HTMLElement>('[data-field-kind="character"]')];
  const offsets = characters.map(character => parseFloat(character.style.getPropertyValue("--field-x")));
  expect(offsets[0]).not.toBe(offsets[1]);
  expect(offsets.every(offset => offset < 0)).toBe(true);
  expect(parseFloat(characters[0].style.getPropertyValue("--field-tilt"))).toBeLessThan(0);
  expect(container.querySelector("h2")!.style.getPropertyValue("--field-x")).toBe("");
  await pointer("pointerleave", 0, 0);
  expect(characters.every(character => character.style.getPropertyValue("--field-x") === "0px" && character.style.getPropertyValue("--field-tilt") === "0deg")).toBe(true);
});

it("moves text and graph nodes, keeps SVG endpoints attached, and settles without an idle loop", async () => {
  const heading = container.querySelector("h1")!;
  await pointer("pointermove", 175, 120);
  expect(parseFloat(heading.style.getPropertyValue("--field-x"))).toBeLessThan(0);
  const node = container.querySelector<HTMLElement>('[data-graph-node="me"]')!;
  await pointer("pointermove", 170, 400);
  const x = parseFloat(node.style.getPropertyValue("--field-x"));
  expect(x).toBeLessThan(0);
  const path = container.querySelector("path")!.getAttribute("d")!;
  expect(parseFloat(path.split(" ")[1])).toBeCloseTo(10 + x / 10, 4);
  expect(callbacks.size).toBe(0);
  await pointer("pointerleave", 0, 0);
  expect(node.style.getPropertyValue("--field-x")).toBe("0px");
  expect(container.querySelector("path")!.getAttribute("d")).toBe("M 10 25 C 20 25, 20 25, 30 25");
  expect(callbacks.size).toBe(0);
});

it("leaves touch input stable and resets the field for keyboard interaction and reduced motion", async () => {
  const heading = container.querySelector("h1")!;
  await pointer("pointermove", 175, 120, "touch");
  expect(heading.style.getPropertyValue("--field-x")).toBe("");
  await pointer("pointermove", 175, 120);
  await act(async () => heading.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })));
  frames();
  expect(heading.style.getPropertyValue("--field-x")).toBe("0px");
  await pointer("pointermove", 175, 120);
  motion.reduced = true;
  await act(async () => root.render(h(Fixture)));
  expect(heading.style.getPropertyValue("--field-x")).toBe("");
  await pointer("pointermove", 175, 120);
  expect(callbacks.size).toBe(0);
});
