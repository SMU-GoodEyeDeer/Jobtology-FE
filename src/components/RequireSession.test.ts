// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RequireSession } from "./RequireSession";
const state = vi.hoisted(() => ({ loading: false, session: { user_id: "user" } as { user_id: string } | null }));
vi.mock("../context/SessionContext", () => ({ useSession: () => state }));
function Page() { const [value, setValue] = useState(0); return createElement("button", { onClick: () => setValue(previous => previous + 1) }, `step ${value}`); }
let root: Root, host: HTMLDivElement;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; state.loading = false; state.session = { user_id: "user" }; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render() { await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/onboarding"] }, createElement(Routes, null, createElement(Route, { element: createElement(RequireSession) }, createElement(Route, { path: "/onboarding", element: createElement(Page) })), createElement(Route, { path: "/", element: createElement("p", null, "login") }))))); }
it("keeps signed-in onboarding state mounted during a session refresh", async () => {
  await render(); await act(async () => host.querySelector("button")!.click());
  state.loading = true; await render(); expect(host.textContent).toBe("step 1");
  state.loading = false; await render(); expect(host.textContent).toBe("step 1");
});
it("does not expose protected pages without an authenticated session", async () => {
  state.session = null; state.loading = true; await render(); expect(host.textContent).toBe("");
  state.loading = false; await render(); expect(host.textContent).toBe("login");
});
