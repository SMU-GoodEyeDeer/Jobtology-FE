import { afterEach, describe, expect, it, vi } from "vitest";
import { analysisApi, roadmapsApi, setCsrfToken } from "./api";
afterEach(() => { setCsrfToken(null); vi.unstubAllGlobals(); });
describe("revision and queued analysis transport", () => {
  it("loads pinned skills, compares read-only, and sends the exact reviewed versions with CSRF on adoption", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock); setCsrfToken("csrf");
    await roadmapsApi.skills("roadmap");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/roadmaps/roadmap/skills", expect.objectContaining({ method: "GET", credentials: "include" }));
    await roadmapsApi.compareRevision("roadmap", "proposal");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/roadmaps/roadmap/revision?proposal_id=proposal", expect.objectContaining({ method: "GET" }));
    const body = { proposal_id: "proposal", expected_proposal_hash: "reviewed-hash", expected_roadmap_version: 3, expected_profile_version: 10, expected_plan_version: 0 };
    await roadmapsApi.applyRevision("roadmap", body);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/roadmaps/roadmap/revision", expect.objectContaining({ method: "POST", body: JSON.stringify(body), headers: expect.objectContaining({ "X-CSRF-Token": "csrf" }) }));
  });
  it("preserves Retry-After on a typed analysis quota error", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { code: "ANALYSIS_RATE_LIMITED" } }), { status: 429, headers: { "Retry-After": "125" } })));
    await expect(analysisApi.create({ goal_id: "goal", expected_profile_version: 2, basis_type: "EDITORIAL", refresh: true }, "retry-key")).rejects.toMatchObject({ status: 429, retryAfterSeconds: 125 });
  });
});
