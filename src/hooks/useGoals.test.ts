// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goalsApi } from "../services/api";
import type { GoalResponse } from "../services/types";
import { selectGoal, selectedGoal } from "./goalSelection";
import { useGoals } from "./useGoals";

const session = vi.hoisted(() => ({ account: "a" }));
vi.mock("../context/SessionContext", () => ({ useSession: () => ({ session: { user_id: session.account } }) }));
vi.mock("../context/OccupationsContext", () => ({ useOccupations: () => ({ getName: (id: string) => id, loading: false }) }));
vi.mock("../services/api", () => ({ goalsApi: { list: vi.fn() } }));

function deferred() {
  let resolve!: (value: { items: GoalResponse[] }) => void, reject!: (reason: Error) => void;
  const promise = new Promise<{ items: GoalResponse[] }>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const goal = (id: string): GoalResponse => ({ goal_id: id, version: 1, goal_mode: "TARGETED", occupation_id: "BACKEND_DEVELOPER", status: "ACTIVE", target_by: "2027-01-01T00:00:00Z", timezone: "Asia/Seoul", original_time_phrase: "내년 1월까지" });
let root: Root, host: HTMLDivElement, current: ReturnType<typeof useGoals>;
function Harness() { current = useGoals(); return null; }
async function render() { await act(async () => root.render(createElement(MemoryRouter, null, createElement(Harness)))); }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.account = "a"; selectGoal(null, null); vi.mocked(goalsApi.list).mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("goal refresh request isolation", () => {
  it("ignores a previous account's response while the current account is loading", async () => {
    const old = deferred(), next = deferred();
    vi.mocked(goalsApi.list).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    await render(); const oldRefresh = current.refresh;
    session.account = "b"; await render();
    await act(async () => old.resolve({ items: [goal("private-a")] }));
    expect(current.goals).toEqual([]); expect(current.loading).toBe(true);
    expect(selectedGoal("a")).toBeNull(); expect(selectedGoal("b")).toBeNull();
    await act(async () => oldRefresh());
    expect(goalsApi.list).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({ items: [goal("private-b")] }));
    expect(current.goals.map(g => g.goal_id)).toEqual(["private-b"]);
    expect(current.selectedGoalId).toBe("private-b"); expect(current.loading).toBe(false);
  });
  it.each(["success", "failure"])("ignores previous account %s after the current request finishes", async result => {
    const old = deferred(), next = deferred();
    vi.mocked(goalsApi.list).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    await render(); session.account = "b"; await render();
    await act(async () => next.resolve({ items: [goal("private-b")] }));
    await act(async () => { if (result === "success") old.resolve({ items: [goal("private-a")] }); else old.reject(new Error("old account failed")); });
    expect(current.goals.map(g => g.goal_id)).toEqual(["private-b"]);
    expect(current.selectedGoalId).toBe("private-b"); expect(current.error).toBeNull(); expect(current.loading).toBe(false);
  });
  it("only applies the newest refresh for the same account", async () => {
    const old = deferred(), next = deferred();
    vi.mocked(goalsApi.list).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    await render();
    await act(async () => { void current.refresh().catch(() => {}); });
    await act(async () => old.reject(new Error("stale failure")));
    expect(current.error).toBeNull(); expect(current.loading).toBe(true);
    await act(async () => next.resolve({ items: [goal("latest")] }));
    expect(current.selectedGoalId).toBe("latest"); expect(current.loading).toBe(false);
  });
});
