import { afterEach, describe, expect, it, vi } from "vitest";
import { roadmapsApi, setCsrfToken } from "./api";
afterEach(() => { setCsrfToken(null); vi.unstubAllGlobals(); });
describe("versioned weekly plan transport", () => {
  it("sends the expected version on preview, save and reset with authenticated CSRF credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock); setCsrfToken("csrf");
    const input = { expected_version: 4, weekly_hours: 10, rest_weeks: [], order: ["step"], hours: {} };
    await roadmapsApi.previewPlan("roadmap", input);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/roadmaps/roadmap/plan/preview", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
    await roadmapsApi.savePlan("roadmap", input);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/roadmaps/roadmap/plan", expect.objectContaining({ method: "PUT", body: JSON.stringify(input) }));
    await roadmapsApi.resetPlan("roadmap", 4);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/roadmaps/roadmap/plan?expected_version=4", expect.objectContaining({ method: "DELETE", credentials: "include", headers: expect.objectContaining({ "X-CSRF-Token": "csrf" }) }));
  });
});
