import { afterEach, describe, expect, it, vi } from "vitest";
import { goalsApi, setCsrfToken } from "./api";

afterEach(() => { setCsrfToken(null); vi.unstubAllGlobals(); });

describe("goal deletion transport", () => {
  it("sends the expected version as JSON with authenticated CSRF credentials", async () => {
    const result = { goal_id: "owned-goal", profile_version: 16 };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock); setCsrfToken("session-csrf");
    expect(await goalsApi.delete("owned-goal", { expected_profile_version: 15 })).toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/goals/owned-goal", expect.objectContaining({
      method: "DELETE", credentials: "include", body: JSON.stringify({ expected_profile_version: 15 }),
      headers: expect.objectContaining({ "Content-Type": "application/json", "X-CSRF-Token": "session-csrf" }),
    }));
  });
});
