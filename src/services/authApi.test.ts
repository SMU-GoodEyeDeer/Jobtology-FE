import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("Google login URL", () => {
  it("follows the explicitly configured API base, including its path", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://backend.example/service/api/");
    vi.resetModules();
    const { GOOGLE_LOGIN_URL } = await import("./api");
    expect(GOOGLE_LOGIN_URL).toBe("https://backend.example/service/api/v1/auth/google/login");
  });
});

it("posts the Turnstile token in the request body, never the URL", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authorization_url: "https://accounts.google.com/" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const { authApi } = await import("./api");
  await authApi.startGoogleLogin("one-use-token");
  expect(fetcher).toHaveBeenCalledWith("/api/v1/auth/google/login", expect.objectContaining({
    method: "POST", credentials: "include", body: JSON.stringify({ "cf-turnstile-response": "one-use-token" }),
  }));
});
