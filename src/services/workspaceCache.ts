import type { WorkspaceGraph } from "./chatWorkspace";

interface Snapshot { graph: WorkspaceGraph; warnings: string[] }
const TTL = 45_000, MAX_GOALS = 6;
let account: string | null = null, profileVersion: number | undefined, generation = 0;
const snapshots = new Map<string | null, Snapshot & { expires: number }>();

// Account data stays in memory only. A generation also rejects late writes after edits/logout.
export function clearWorkspaceCache() { snapshots.clear(); generation += 1; }
export function resetWorkspaceCache() { clearWorkspaceCache(); account = null; profileVersion = undefined; }
export function scopeWorkspaceCache(userId: string | null, version?: number) {
  if (userId !== account || version !== profileVersion) {
    clearWorkspaceCache(); account = userId; profileVersion = version;
  }
  return generation;
}
export function cachedWorkspace(userId: string | null, goalId: string | null, version?: number): Snapshot | undefined {
  if (!userId || userId !== account || version !== profileVersion) return;
  const entry = snapshots.get(goalId);
  if (entry && entry.expires > Date.now()) return entry;
  snapshots.delete(goalId);
}
export function cacheWorkspace(userId: string | null, goalId: string | null, expectedGeneration: number, snapshot: Snapshot) {
  if (!userId || userId !== account || expectedGeneration !== generation) return;
  snapshots.delete(goalId);
  snapshots.set(goalId, { ...snapshot, expires: Date.now() + TTL });
  while (snapshots.size > MAX_GOALS) snapshots.delete(snapshots.keys().next().value!);
}
export function invalidateWorkspaceRequest(method: string, path: string) {
  const route = path.split("?")[0];
  if ((method !== "GET" && /^\/v1\/(?:me\/(?:profile|capabilities|route-preferences|goals)(?:\/|$)|analyses$|roadmaps(?:\/|$))/.test(route)
    && !route.endsWith("/preview")) || method === "GET" && /^\/v1\/(?:recomputations|analyses)\//.test(route)) clearWorkspaceCache();
}
