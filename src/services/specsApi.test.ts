import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilitiesApi, chatApi, setCsrfToken, skillsApi } from "./api";
import type { CapabilityMutationRequest } from "./types";
afterEach(() => { vi.unstubAllGlobals(); setCsrfToken(null); });
const write: CapabilityMutationRequest = { expected_profile_version: 4, category: "project", raw_text: "주문 API", proficiency: "INDEPENDENT", details: { competency_ids: ["ncs:2001020301"], evidence: "직접 작성한 주문 API의 테스트를 구현하고 결과를 문서화했어요.", source: "MANUAL", started_on: "2026-01-01", ended_on: null, ongoing: true, role: "개발" } };
describe("structured spec API contracts", () => {
  it("encodes searchable aliases and optional occupation filtering using the authenticated transport", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, available_sources: ["NCS", "ONET"] })));
    vi.stubGlobal("fetch", fetcher);
    await skillsApi.search({ q: "Python & SQL", occupation_id: "BACKEND", limit: 20 });
    const [url, options] = fetcher.mock.calls[0];
    const query = new URL(url, "https://app.example").searchParams;
    expect(query.get("q")).toBe("Python & SQL"); expect(query.get("occupation_id")).toBe("BACKEND");
    expect(options).toMatchObject({ credentials: "include", method: "GET" });
  });
  it("uses full structured writes with CSRF, fresh version, and POST idempotency while GET reads the enriched item", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ capability_id: "cap", profile_version: 5 })));
    vi.stubGlobal("fetch", fetcher); setCsrfToken("csrf");
    await capabilitiesApi.create(write, "stable-key"); await capabilitiesApi.get("cap"); await capabilitiesApi.update("cap", { ...write, expected_profile_version: 5 });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "include", headers: { "X-CSRF-Token": "csrf", "Idempotency-Key": "stable-key" } });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(write);
    expect(fetcher.mock.calls[1][0]).toBe("/api/v1/me/capabilities/cap");
    expect(fetcher.mock.calls[2][1].method).toBe("PATCH"); expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ ...write, expected_profile_version: 5 });
  });
  it("sends an explicitly requested experience description in spec mode without scripted personal profile messages", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: "", candidates: [], occupation_id: null })));
    vi.stubGlobal("fetch", fetcher); setCsrfToken("csrf");
    await chatApi.send([{ role: "user", text: "직접 경험한 일" }], "spec");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ messages: [{ role: "user", text: "직접 경험한 일" }], mode: "spec" });
    expect(fetcher.mock.calls[0][1].headers["X-CSRF-Token"]).toBe("csrf");
  });
});
