import { afterEach, expect, it, vi } from "vitest";
import { resumeApi, setCsrfToken } from "./api";
afterEach(() => { vi.unstubAllGlobals(); setCsrfToken(null); });
it("sends a raw document with session CSRF and cancellation without sending its filename", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ blocks: [] }) });
  vi.stubGlobal("fetch", fetch); setCsrfToken("session-csrf");
  const file = new File(["synthetic document"], "private-name@example.com.docx"), controller = new AbortController();
  await resumeApi.scan(file, "docx", "BACKEND", controller.signal);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("/api/v1/me/resume/scan?format=docx&occupation_id=BACKEND");
  expect(options).toMatchObject({ method: "POST", credentials: "include", headers: { "Content-Type": "application/octet-stream", "X-CSRF-Token": "session-csrf" }, body: file, signal: controller.signal });
  expect(url).not.toContain(file.name); expect(JSON.stringify(options.headers)).not.toContain(file.name);
});
it("preserves the bounded API error code for actionable upload feedback", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: { code: "PAGE_LIMIT" } }) }));
  await expect(resumeApi.scan(new File(["test"], "resume.pdf"), "pdf")).rejects.toMatchObject({ status: 422, detail: { error: { code: "PAGE_LIMIT" } } });
});
