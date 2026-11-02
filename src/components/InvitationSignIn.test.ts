// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InvitationSignIn } from "./InvitationSignIn";

vi.mock("./GoogleSignIn", () => ({ GoogleSignIn: ({ invitationCode }: { invitationCode?: string }) => createElement("button", { "data-google": true, "data-invitation": invitationCode }, "Google로 계속") }));
let host: HTMLDivElement, root: Root;
const code = "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF";
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/");
  const priorFocus = new WeakMap<HTMLDialogElement, HTMLElement>();
  const nativeFocus = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    const modal = document.querySelector("dialog[open]");
    // Native modal dialogs make controls outside them inert, including focus().
    if (modal && !modal.contains(this)) return;
    nativeFocus.call(this, options);
  });
  HTMLDialogElement.prototype.showModal = function () {
    priorFocus.set(this, this.contains(document.activeElement) ? document.body : document.activeElement as HTMLElement);
    this.open = true;
    this.querySelector<HTMLElement>("button, input")?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    priorFocus.get(this)?.focus();
    this.dispatchEvent(new Event("close"));
  };
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render() { await act(async () => root.render(createElement(StrictMode, null, createElement(InvitationSignIn)))); }

it("opens a code screen, rejects malformed codes, then binds a normalized code to Google login", async () => {
  await render();
  expect(host.querySelector("dialog")).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>(".landing-cta")!.click());
  expect(host.querySelector("dialog")!.open).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  const form = host.querySelector("form")!;
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(host.textContent).toContain("24자리");
  const input = host.querySelector<HTMLInputElement>("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, code.toLowerCase());
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(host.querySelector("[data-google]")!.getAttribute("data-invitation")).toBe(code.replaceAll("-", ""));
  await act(async () => host.querySelector<HTMLButtonElement>(".invitation-close")!.click());
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.body.style.overflow).toBe("");
  expect(document.activeElement).toBe(host.querySelector(".landing-cta"));
});

it("QR invitation skips manual entry and removes the raw code from browser history", async () => {
  window.history.replaceState({ keep: true }, "", `/?other=1#invite=${code}`);
  await render();
  expect(host.querySelector("input")).toBeNull();
  expect(host.querySelector("[data-google]")!.getAttribute("data-invitation")).toBe(code);
  expect(window.location.href).not.toContain(code);
  expect(window.location.search).toBe("?other=1");
  expect(window.history.state).toEqual({ keep: true });
  expect(localStorage.length).toBe(0);
});

it("existing users can proceed without a code; Escape closes and clears it", async () => {
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>(".landing-cta")!.click());
  await act(async () => host.querySelector<HTMLButtonElement>(".invitation-existing")!.click());
  expect(host.querySelector("[data-google]")!.hasAttribute("data-invitation")).toBe(false);
  await act(async () => host.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(host.querySelector("dialog")).toBeNull();
});

it("shows a safe expiration message after OAuth and strips callback status", async () => {
  window.history.replaceState({}, "", "/?auth_error=ACCESS_EXPIRED");
  await render();
  expect(host.querySelector('[role="alert"]')!.textContent).toContain("이용 기간이 끝났어요");
  expect(window.location.search).toBe("");
});


it.each(["close button", "Escape"])("restores trigger focus after closing a QR-opened native modal via %s", async (method) => {
  window.history.replaceState({}, "", `/#invite=${code}`);
  await render();
  const dialog = host.querySelector("dialog")!;
  expect(dialog.open).toBe(true);
  const trigger = host.querySelector<HTMLButtonElement>(".landing-cta")!;
  // A focus attempt while the dialog is open must be ignored like a real browser.
  await act(async () => trigger.focus());
  expect(document.activeElement).not.toBe(trigger);
  await act(async () => {
    if (method === "close button") host.querySelector<HTMLButtonElement>(".invitation-close")!.click();
    else dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  });
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
