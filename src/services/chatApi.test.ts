import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatApi, dashboardApi, setCsrfToken } from "./api";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setCsrfToken("csrf-1");
});

afterEach(() => setCsrfToken(""));

describe("chat api", () => {
  it("sends the recent conversation with the CSRF token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ reply: "좋아요", occupation_id: null, candidates: [] }));

    const res = await chatApi.send([{ role: "user", text: "Spring으로 API를 만들었어요" }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/chat\/messages$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("csrf-1");
    expect(JSON.parse(init.body as string)).toEqual({ messages: [{ role: "user", text: "Spring으로 API를 만들었어요" }] });
    expect(res.reply).toBe("좋아요");
  });

  it("reads chat availability", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ available: false }));
    expect(await chatApi.status()).toEqual({ available: false });
  });
});

describe("dashboard api", () => {
  it("exposes the stored analysis id used to skip recomputation", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ state: "READY", analysis_id: "a1", next_actions: [], goal_id: "g1" }));

    const dashboard = await dashboardApi.get("g1");

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/dashboard\?goal_id=g1$/);
    expect(dashboard.analysis_id).toBe("a1");
  });
});
