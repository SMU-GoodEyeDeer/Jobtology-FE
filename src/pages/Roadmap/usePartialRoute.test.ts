// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proposalsApi } from "../../services/api";
import { usePartialRoute } from "./usePartialRoute";
vi.mock("../../services/api", () => ({ proposalsApi: { get: vi.fn() } }));
let root: Root; let container: HTMLDivElement; let state: ReturnType<typeof usePartialRoute>;
function Probe({ id }: { id: string | null }) { state = usePartialRoute(id); return null; }
async function render(id: string | null) { await act(async () => root.render(createElement(Probe, { id }))); }
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(proposalsApi.get).mockReset();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe("proposal feasibility loading", () => {
  it("exposes unknown feasibility after failure and reveals the PARTIAL warning after retry", async () => {
    vi.mocked(proposalsApi.get).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ proposal_id: "proposal", feasibility: "PARTIAL" });
    await render("proposal");
    expect(state.loading).toBe(false);
    expect(state.error).toContain("일부 역량만 포함된 경로일 수 있어요");
    await act(async () => state.retry());
    expect(proposalsApi.get).toHaveBeenCalledTimes(2);
    expect(state.error).toBeNull();
    expect(state.partial).toBe(true);
    vi.mocked(proposalsApi.get).mockRejectedValueOnce(new Error("offline"));
    await act(async () => state.retry());
    expect(state.partial).toBe(true);
    expect(state.error).not.toBeNull();
  });
  it("ignores a failed response from a previously selected proposal", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(proposalsApi.get).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValueOnce({ proposal_id: "next", feasibility: "PARTIAL" });
    await render("old"); await render("next");
    await act(async () => reject(new Error("late failure")));
    expect(state.partial).toBe(true);
    expect(state.error).toBeNull();
  });
});
