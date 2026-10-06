import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "./api";
import { saveProfile, startGoal } from "./onboardingSave";

const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

function calls() {
  return fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit).method} ${String(url).replace(/.*\/api/, "")}`);
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setCsrfToken("csrf");
});

afterEach(() => setCsrfToken(""));

describe("onboarding saves", () => {
  it("archives the active goal before creating the new one", async () => {
    const active = {
      goal_id: "g1", goal_mode: "TARGETED", target_by: "2027-01-01T00:00:00Z", timezone: "Asia/Seoul",
      original_time_phrase: "6개월 내", occupation_id: "DATA_ANALYST", status: "ACTIVE",
    };
    fetchMock
      .mockResolvedValueOnce(json({ items: [active] }))
      .mockResolvedValueOnce(json({ version: 3 }))
      .mockResolvedValueOnce(json({ goal_id: "g1", status: "ARCHIVED" }))
      .mockResolvedValueOnce(json({ version: 4 }))
      .mockResolvedValueOnce(json({ goal_id: "g2", status: "ACTIVE" }, 201));

    await startGoal("BACKEND_DEVELOPER");

    expect(calls()).toEqual(["GET /v1/me/goals", "GET /v1/me/profile", "PATCH /v1/me/goals/g1", "GET /v1/me/profile", "POST /v1/me/goals"]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).status).toBe("ARCHIVED");
    const created = JSON.parse(fetchMock.mock.calls[4][1].body);
    expect(created).toMatchObject({ expected_profile_version: 4, goal_mode: "TARGETED", occupation_id: "BACKEND_DEVELOPER" });
  });

  it("skips the profile update when no major is known", async () => {
    fetchMock.mockResolvedValueOnce(json({ version: 2, major_raw: "" }));

    expect(await saveProfile(null, 3)).toBe(false);
    expect(calls()).toEqual(["GET /v1/me/profile"]);
  });

  it("saves the typed major with the selected grade", async () => {
    fetchMock.mockResolvedValueOnce(json({ version: 2, major_raw: "" })).mockResolvedValueOnce(json({ version: 3 }));

    expect(await saveProfile(" 컴퓨터공학과 ", 3)).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ expected_profile_version: 2, major_raw: "컴퓨터공학과", year: 3 });
  });
});
