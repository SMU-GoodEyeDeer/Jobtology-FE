import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("Google login URL", () => {
  it("follows the explicitly configured API base, including its path", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://backend.example/service/api/");
    vi.resetModules();
    const { GOOGLE_LOGIN_URL } = await import("./api");
    expect(GOOGLE_LOGIN_URL).toBe("https://backend.example/service/api/v1/auth/google/login");
  });
});
