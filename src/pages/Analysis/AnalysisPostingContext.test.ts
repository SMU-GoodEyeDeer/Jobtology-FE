// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resourcesApi } from "../../services/resourcesApi";
import type { PostingItem } from "../../services/resourcesApi";
import { occupationContext } from "../../testFixtures/occupationContext";
import { AnalysisPostingContext } from "./AnalysisPostingContext";
vi.mock("../../services/resourcesApi", async importOriginal => ({ ...await importOriginal<typeof import("../../services/resourcesApi")>(), resourcesApi: { rolePostingContext: vi.fn() } }));
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(resourcesApi.rolePostingContext).mockReset().mockResolvedValue(occupationContext({ posting_id: "jobkorea:real", title: "연결된 실제 공고", organization_name: "수집 기관" } as PostingItem));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe("analysis occupation context", () => {
  it("uses the active role's server mapping and labels inferred counts separately from competency evidence", async () => {
    await act(async () => root.render(createElement(MemoryRouter, null, createElement(AnalysisPostingContext, { occupationId: "BACKEND_DEVELOPER" }))));
    expect(resourcesApi.rolePostingContext).toHaveBeenCalledWith("BACKEND_DEVELOPER", 3);
    expect(container.textContent).toContain("역량 요구나 보유 역량의 근거로 반영하지 않아요");
    expect(container.textContent).toContain("잡코리아 공고 1건 / 연결 1건");
    expect(container.textContent).toContain("미검토");
    const link = container.querySelector<HTMLAnchorElement>(".an-context-samples a")!;
    expect(new URL(link.href).searchParams.get("occupation")).toBe("20010203");
    expect(new URL(link.href).searchParams.get("posting")).toBe("jobkorea:real");
  });
});
