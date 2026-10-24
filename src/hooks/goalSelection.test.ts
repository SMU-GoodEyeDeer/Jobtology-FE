import { describe, expect, it, vi } from "vitest";
import { selectGoal, selectedGoal, subscribeGoal } from "./goalSelection";

describe("shared goal selection", () => {
  it("shares a selected goal across pages and isolates account changes", () => {
    const listener = vi.fn(), unsubscribe = subscribeGoal(listener);
    selectGoal("account-a", "goal-b");
    expect(selectedGoal("account-a")).toBe("goal-b");
    expect(selectedGoal("account-b")).toBeNull();
    selectGoal("account-b", "goal-c");
    expect(selectedGoal("account-a")).toBeNull();
    expect(selectedGoal("account-b")).toBe("goal-c");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe(); selectGoal(null, null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
