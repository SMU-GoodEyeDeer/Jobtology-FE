// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NcsLevel } from "./NcsLevel";
import { SkillDetailPanel } from "../pages/Analysis/SkillDetailPanel";

vi.mock("../pages/Analysis/useSkillResources", () => ({
  useSkillEvidenceReady: () => true,
  useDefinition: () => ({ state: "ready", data: { item: { definition: null }, sources: [] } }),
  useExamSessions: () => ({ state: "ready", data: { items: [], total: 0 } }),
}));

let root: Root;
let container: HTMLDivElement;
let app: HTMLDivElement;
const showPopover = vi.fn(function (this: HTMLElement) { toggle(this, "open"); });
const hidePopover = vi.fn(function (this: HTMLElement) { toggle(this, "closed"); });
function toggle(element: HTMLElement, newState: "open" | "closed") {
  // jsdom has the UA closed-popover rule but no native top-layer implementation.
  element.style.display = newState === "open" ? "block" : "none";
  const event = new Event("toggle");
  Object.defineProperty(event, "newState", { value: newState });
  element.dispatchEvent(event);
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("ncs-level-trigger") ? { left: 980, top: 700, bottom: 724, width: 110, height: 24 } as DOMRect
      : { width: 430, height: 500 } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: showPopover });
  Object.defineProperty(HTMLElement.prototype, "hidePopover", { configurable: true, value: hidePopover });
  showPopover.mockClear(); hidePopover.mockClear();
  app = document.createElement("div"); app.id = "root"; document.body.append(app);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); app.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
  delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
});

describe("NCS popup focus and dismissal", () => {
  it("uses the native top layer, clamps its position, and restores focus on Escape", async () => {
    await act(async () => root.render(createElement(NcsLevel, { level: 7, compact: true })));
    const trigger = container.querySelector<HTMLButtonElement>(".ncs-level-trigger")!;
    const popup = container.querySelector<HTMLDivElement>("[popover]")!;
    const close = popup.querySelector<HTMLButtonElement>("button")!;
    expect(close.disabled).toBe(true);
    expect(popup.hasAttribute("inert")).toBe(true);
    expect(popup.querySelector("a")?.tabIndex).toBe(-1);
    await act(async () => trigger.click());
    expect(showPopover).toHaveBeenCalledOnce();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(popup.style.left).toBe("578px");
    expect(popup.style.top).toBe("192px");
    await act(async () => close.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(hidePopover).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popup.hasAttribute("inert")).toBe(true);
  });

  it("syncs native light dismissal and supports the explicit close button", async () => {
    await act(async () => root.render(createElement(NcsLevel)));
    const trigger = container.querySelector<HTMLButtonElement>(".ncs-level-trigger")!;
    const popup = container.querySelector<HTMLDivElement>("[popover]")!;
    await act(async () => trigger.click());
    await act(async () => toggle(popup, "closed"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popup.hasAttribute("inert")).toBe(true);
    await act(async () => trigger.click());
    await act(async () => popup.querySelector<HTMLButtonElement>("button")!.click());
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("stays in the Analysis overlay focus boundary and consumes Escape before the parent", async () => {
    const onClose = vi.fn();
    await act(async () => root.render(createElement(MemoryRouter, null, createElement(SkillDetailPanel, {
      skill: { name: "전문 역량", type: "필수", ncs_level: 8 }, roadmap: { state: "ready", data: null }, overlay: true, onClose,
    }))));
    expect(app.inert).toBe(true);
    const trigger = container.querySelector<HTMLButtonElement>(".ncs-level-trigger")!;
    const popup = container.querySelector<HTMLDivElement>("[popover]")!;
    expect(container.querySelector(".sd-panel")!.contains(popup)).toBe(true);
    await act(async () => trigger.click());
    // Escape still dismisses the popup first after Tab has moved back into its parent.
    const panelClose = container.querySelector<HTMLButtonElement>(".sd-close")!;
    panelClose.focus();
    await act(async () => panelClose.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    expect(popup.hasAttribute("inert")).toBe(true);
    await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onClose).toHaveBeenCalledOnce();
    expect(app.inert).toBe(true);
  });
});
