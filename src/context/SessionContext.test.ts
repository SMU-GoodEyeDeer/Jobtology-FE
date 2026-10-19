// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequireSession } from "../components/RequireSession";
import { getCsrfToken, setCsrfToken } from "../services/api";
import { SessionProvider, useSession } from "./SessionContext";

const session = { user_id: "google-user", csrf_token: "csrf-google", profile_version: 1 };
const fetchMock = vi.fn<typeof fetch>();
let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useSession>;

function Probe() {
  state = useSession();
  return createElement("span", null, state.session?.user_id ?? "signed out");
}

function response(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function mount() {
  await act(async () => { root.render(createElement(SessionProvider, null, createElement(Probe))); });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setCsrfToken(null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  setCsrfToken(null);
  vi.unstubAllGlobals();
});

describe("Google account session", () => {
  it("clears the local account and CSRF token without fetching a new session on logout", async () => {
    fetchMock.mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response(null, 204));
    await mount();
    expect(state.session).toEqual(session);
    expect(getCsrfToken()).toBe(session.csrf_token);

    await act(async () => { await state.logout(); });

    expect(state.session).toBeNull();
    expect(state.error).toBeNull();
    expect(getCsrfToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(["/api/v1/auth/logout", expect.objectContaining({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({ "X-CSRF-Token": session.csrf_token }),
    })]);
  });

  it("clears stale credentials when the session expires", async () => {
    fetchMock.mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response({}, 401));
    await mount();

    await act(async () => { await state.refresh(); });

    expect(state.session).toBeNull();
    expect(state.error).toBeNull();
    expect(getCsrfToken()).toBeNull();
  });

  it("exposes a retryable error rather than treating a failed session check as signed out", async () => {
    fetchMock.mockResolvedValueOnce(response({}, 503));
    await mount();
    expect(state.session).toBeNull();
    expect(state.error).toContain("로그인 상태를 확인하지 못했어요");

    fetchMock.mockResolvedValueOnce(response(session));
    await act(async () => { await state.refresh(); });
    expect(state.session).toEqual(session);
    expect(state.error).toBeNull();
  });

  it("does not silently report a successful logout after a server failure", async () => {
    fetchMock.mockResolvedValueOnce(response(session)).mockRejectedValueOnce(new Error("offline"));
    await mount();

    await act(async () => { await state.logout(); });

    expect(state.session).toBeNull();
    expect(getCsrfToken()).toBeNull();
    expect(state.error).toContain("로그아웃을 완료하지 못했어요");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores an older session response that arrives after logout", async () => {
    let completeRefresh!: (value: Response) => void;
    fetchMock.mockResolvedValueOnce(response(session));
    await mount();
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { completeRefresh = resolve; }))
      .mockResolvedValueOnce(response(null, 204));
    let refresh!: Promise<void>;
    await act(async () => { refresh = state.refresh(); });
    await act(async () => { await state.logout(); });
    await act(async () => { completeRefresh(response(session)); await refresh; });

    expect(state.session).toBeNull();
    expect(getCsrfToken()).toBeNull();
  });

  it.each([false, true])("only mounts protected pages for authenticated users (%s)", async (authenticated) => {
    const mounted = vi.fn();
    function ProtectedPage() {
      useEffect(mounted, []);
      return createElement("span", null, "private account page");
    }
    fetchMock.mockResolvedValueOnce(authenticated ? response(session) : response({}, 401));
    await act(async () => root.render(createElement(SessionProvider, null,
      createElement(MemoryRouter, { initialEntries: ["/home"] },
        createElement(Routes, null,
          createElement(Route, { path: "/", element: createElement("span", null, "Google login") }),
          createElement(Route, { element: createElement(RequireSession) },
            createElement(Route, { path: "/home", element: createElement(ProtectedPage) })),
        ),
      ),
    )));

    expect(mounted).toHaveBeenCalledTimes(authenticated ? 1 : 0);
    expect(container.textContent).toBe(authenticated ? "private account page" : "Google login");
  });
});
