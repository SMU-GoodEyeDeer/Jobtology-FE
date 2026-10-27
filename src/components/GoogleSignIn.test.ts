// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GoogleSignIn } from "./GoogleSignIn";
import type { TurnstileOptions } from "./Turnstile";
import { authApi } from "../services/api";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("../services/api", () => ({ authApi: { startGoogleLogin: vi.fn() } }));
let root: Root, host: HTMLDivElement;
let options: TurnstileOptions[];
const navigate = vi.fn();
const reset = vi.fn(), remove = vi.fn();
const authorization_url = "https://accounts.google.com/o/oauth2/v2/auth?state=state";

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  options = []; vi.clearAllMocks(); localStorage.clear();
  window.turnstile = { render: vi.fn((_element, value) => { options.push(value); return `widget-${options.length}`; }), reset, remove };
  vi.mocked(authApi.startGoogleLogin).mockResolvedValue({ authorization_url });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); delete window.turnstile;
  document.querySelectorAll('script[src^="https://challenges.cloudflare.com/turnstile/"]').forEach((script) => script.remove());
});
async function render(strict = false) {
  await act(async () => root.render(createElement(strict ? StrictMode : ThemeProvider, null, createElement(GoogleSignIn, { onNavigate: navigate }))));
}
function button() { return host.querySelector<HTMLButtonElement>(".landing-cta")!; }
async function solve(token = "fresh-token") { await act(async () => options.at(-1)!.callback(token)); }

it("blocks login until verification and submits its token once before navigation", async () => {
  await render(true);
  expect(options).toHaveLength(1);
  expect(options[0]).toMatchObject({ sitekey: "0x4AAAAAAFnjRx897yLX5iji", action: "google_login", theme: "light", "response-field": false });
  expect(button().disabled).toBe(true);
  expect(authApi.startGoogleLogin).not.toHaveBeenCalled();
  await solve();
  await act(async () => { button().click(); button().click(); });
  expect(authApi.startGoogleLogin).toHaveBeenCalledExactlyOnceWith("fresh-token");
  expect(navigate).toHaveBeenCalledExactlyOnceWith(authorization_url);
  expect(button().disabled).toBe(true);
});

it("invalidates expired or failed challenges and removes the specific widget on unmount", async () => {
  await render(); await solve();
  await act(async () => options[0]["expired-callback"]());
  expect(button().disabled).toBe(true);
  await solve();
  await act(async () => options[0]["error-callback"]());
  expect(button().disabled).toBe(true);
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => root.render(null));
  expect(remove).toHaveBeenCalledExactlyOnceWith("widget-1");
});

it("resets the consumed widget after a failed request and retries only with a new token", async () => {
  vi.mocked(authApi.startGoogleLogin).mockRejectedValueOnce(new Error("403"));
  await render(); await solve("first-token");
  await act(async () => button().click());
  expect(reset).toHaveBeenCalledExactlyOnceWith("widget-1");
  expect(button().disabled).toBe(true);
  expect(host.textContent).toContain("로그인을 시작하지 못했어요");
  expect(navigate).not.toHaveBeenCalled();
  await solve("second-token"); await act(async () => button().click());
  expect(vi.mocked(authApi.startGoogleLogin).mock.calls.map(([token]) => token)).toEqual(["first-token", "second-token"]);
  expect(navigate).toHaveBeenCalledOnce();
});

it("rejects unexpected redirect destinations", async () => {
  vi.mocked(authApi.startGoogleLogin).mockResolvedValue({ authorization_url: "https://attacker.example/" });
  await render(); await solve(); await act(async () => button().click());
  expect(navigate).not.toHaveBeenCalled(); expect(reset).toHaveBeenCalledOnce();
});

it("uses the selected dark theme and obtains a fresh token after browser back restoration", async () => {
  localStorage.setItem("jobtology.theme", "dark");
  await render(); expect(options[0].theme).toBe("dark");
  await solve(); await act(async () => button().click());
  await act(async () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  expect(reset).toHaveBeenCalledExactlyOnceWith("widget-1"); expect(button().disabled).toBe(true);
  expect(host.textContent).toContain("Google로 시작하기");
});

it("allows retrying a failed script load without enabling unverified login", async () => {
  delete window.turnstile;
  await render();
  const script = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]')!;
  expect(script.src).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  await act(async () => script.dispatchEvent(new Event("error")));
  expect(button().disabled).toBe(true);
  expect(host.textContent).toContain("보안 확인을 불러오지 못했어요");
  await act(async () => host.querySelector<HTMLButtonElement>(".landing-verification-error button")!.click());
  const retry = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]')!;
  expect(retry).not.toBe(script);
  window.turnstile = { render: vi.fn((_element, value) => { options.push(value); return "widget-retry"; }), reset, remove };
  await act(async () => retry.dispatchEvent(new Event("load")));
  await solve(); expect(button().disabled).toBe(false);
});
