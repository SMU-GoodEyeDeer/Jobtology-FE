// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { emptyGraph } from "../../services/chatWorkspace";
import { formatPostingDateTime } from "../../services/resourcesApi";
import { WorkspaceInspector } from "./WorkspaceInspector";

describe("workspace inspector dates", () => {
  it("preserves calendar-only dates and formats timestamps with the existing formatter", () => {
    const timestamp = "2027-01-03T09:30:00Z";
    const node = { id: "step:a", kind: "activity" as const, label: "학습", basis: "APPLICATION_RECORD" as const,
      detail: JSON.stringify({ planned_start: "2027-01-01", current_start: "2027-01-02", target_by: "2027-01-04", planned_end: timestamp }) };
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WorkspaceInspector, {
      node, graph: emptyGraph(), onClose: vi.fn(), onExpand: vi.fn(), onAsk: vi.fn(), busy: false,
    })));
    const host = document.createElement("div"); host.innerHTML = markup;
    const values = [...host.querySelectorAll("dd")].map(value => value.textContent);
    expect(values).toEqual(["2027-01-01", "2027-01-02", "2027-01-04", formatPostingDateTime(timestamp)]);
    expect(formatPostingDateTime(timestamp)).not.toBe(timestamp);
  });
});
