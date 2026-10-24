import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, setCsrfToken } from "./api";
import { cachedWorkspace, cacheWorkspace, clearWorkspaceCache, resetWorkspaceCache, scopeWorkspaceCache } from "./workspaceCache";

const snapshot = { graph: { nodes: [], edges: [], truncated: false }, warnings: ["NO_ANALYSIS"] };
function seed(goal: string | null = "goal-a") {
  const generation = scopeWorkspaceCache("account-a", 1);
  cacheWorkspace("account-a", goal, generation, snapshot);
  return generation;
}
beforeEach(() => { resetWorkspaceCache(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("memory-only workspace cache", () => {
  it("isolates account, goal and profile version and expires after 45 seconds", () => {
    seed();
    expect(cachedWorkspace("account-a", "goal-a", 1)?.warnings).toEqual(snapshot.warnings);
    expect(cachedWorkspace("account-b", "goal-a", 1)).toBeUndefined();
    expect(cachedWorkspace("account-a", "goal-b", 1)).toBeUndefined();
    expect(cachedWorkspace("account-a", "goal-a", 2)).toBeUndefined();
    vi.advanceTimersByTime(45_000);
    expect(cachedWorkspace("account-a", "goal-a", 1)).toBeUndefined();
  });
  it("rejects late writes after edits, account changes and logout", () => {
    const old = seed(); clearWorkspaceCache();
    cacheWorkspace("account-a", "goal-a", old, snapshot);
    expect(cachedWorkspace("account-a", "goal-a", 1)).toBeUndefined();
    const next = seed(); scopeWorkspaceCache("account-b", 1);
    cacheWorkspace("account-a", "goal-a", next, snapshot);
    expect(cachedWorkspace("account-a", "goal-a", 1)).toBeUndefined();
    setCsrfToken("synthetic-token"); seed(); setCsrfToken(null);
    expect(cachedWorkspace("account-a", "goal-a", 1)).toBeUndefined();
  });
  it("bounds saved goals and never retains an unauthenticated graph", () => {
    for (let i = 0; i < 7; i++) seed(`goal-${i}`);
    expect(cachedWorkspace("account-a", "goal-0", 1)).toBeUndefined();
    expect(cachedWorkspace("account-a", "goal-6", 1)).toBeDefined();
    const generation = scopeWorkspaceCache(null);
    cacheWorkspace(null, null, generation, snapshot);
    expect(cachedWorkspace(null, null)).toBeUndefined();
  });
  it.each([
    ["PUT", "/v1/me/profile"], ["POST", "/v1/me/capabilities"], ["DELETE", "/v1/me/capabilities/id"],
    ["PUT", "/v1/me/route-preferences"], ["PATCH", "/v1/me/goals/id"], ["POST", "/v1/analyses"],
    ["PATCH", "/v1/roadmaps/id/steps/step"], ["PUT", "/v1/roadmaps/id/plan"],
    ["GET", "/v1/recomputations/id"], ["GET", "/v1/analyses/id"],
  ])("invalidates after a successful %s %s", async (method, path) => {
    seed(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await request(method, path);
    expect(cachedWorkspace("account-a", "goal-a", 1)).toBeUndefined();
  });
  it.each([["POST", "/v1/chat/catalog"], ["POST", "/v1/roadmaps/id/plan/preview"], ["GET", "/v1/me/goals"]])(
    "keeps the cache after a read-only %s %s", async (method, path) => {
      seed(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
      await request(method, path);
      expect(cachedWorkspace("account-a", "goal-a", 1)).toBeDefined();
    });
  it("does not invalidate on a failed write", async () => {
    seed(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 409 })));
    await expect(request("PUT", "/v1/me/profile")).rejects.toMatchObject({ status: 409 });
    expect(cachedWorkspace("account-a", "goal-a", 1)).toBeDefined();
  });
});
