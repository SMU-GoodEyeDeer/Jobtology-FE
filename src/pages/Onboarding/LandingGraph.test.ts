// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LandingGraph } from "./LandingGraph";

vi.mock("motion/react", async importOriginal => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => true };
});
let root: Root, container: HTMLDivElement;
const button = (label: string) => {
  const node = [...container.querySelectorAll<HTMLButtonElement>("button")].find(item => item.getAttribute("aria-label") === label || item.textContent === label);
  if (!node) throw new Error(`Missing button: ${label}`);
  return node;
};
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(createElement(LandingGraph)));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

it("switches example roles and related skills, clearing the previous selection", async () => {
  await act(async () => button("Python 연결 보기").click());
  expect(button("Python 연결 보기").getAttribute("aria-pressed")).toBe("true");
  await act(async () => button("프런트엔드 개발자").click());
  expect(button("프런트엔드 개발자").getAttribute("aria-pressed")).toBe("true");
  expect(button("JavaScript 연결 보기")).toBeDefined();
  expect(button("웹 인터페이스 만들기 연결 보기")).toBeDefined();
  expect(container.querySelector('.landing-node[aria-pressed="true"]')).toBeNull();
  expect(container.querySelector(".landing-graph-footer")).toBeNull();
  expect(container.querySelectorAll("a")).toHaveLength(0);
});

it("highlights a selected node's connections and allows Escape to clear selection", async () => {
  const node = button("Python 연결 보기");
  await act(async () => node.click());
  const connected = [...container.querySelectorAll("g.is-connected .landing-edge")];
  expect(connected).toHaveLength(3);
  expect(connected.every(edge => edge.getAttribute("data-edge-from") === "skill1" || edge.getAttribute("data-edge-to") === "skill1")).toBe(true);
  await act(async () => node.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(node.getAttribute("aria-pressed")).toBe("false");
  expect(container.querySelector(".is-dimmed")).toBeNull();
});
