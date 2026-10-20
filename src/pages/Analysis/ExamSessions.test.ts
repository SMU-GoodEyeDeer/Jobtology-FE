// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExamSession } from "../../services/types";
import { ExamSessions } from "./ExamSessions";

const session: ExamSession = {
  qualification_code: "C290", qualification_name: "실제 자격", year: 2026, round: 1, category_code: null, name: "정기 시험",
  written: { registration_start: "2026-10-01", registration_end: "2026-10-05", exam_start: "2026-10-20", exam_end: "2026-10-20", result_date: null },
  practical: { registration_start: null, registration_end: null, exam_start: "2026-11-01", exam_end: "2026-11-02", result_date: "2026-11-20" },
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("animated exam schedule fold", () => {
  it("uses a keyboard-native button and disables its collapsed accessibility subtree immediately", async () => {
    await act(async () => root.render(createElement(ExamSessions, { items: [session], total: 4 })));
    const button = container.querySelector<HTMLButtonElement>(".sd-exam-toggle")!;
    const fold = container.querySelector<HTMLDivElement>(".sd-exam-fold")!;
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-controls")).toBe(fold.id);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(fold.getAttribute("aria-hidden")).toBe("true");
    expect(fold.hasAttribute("inert")).toBe(true);
    expect(button.textContent).toContain("1건 / 전체 4건 보기");
    button.focus();
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(fold.getAttribute("data-expanded")).toBe("true");
    expect(fold.hasAttribute("inert")).toBe(false);
    expect(fold.textContent).toContain("필기 접수 2026-10-01 ~ 2026-10-05");
    expect(fold.textContent).toContain("실기 시험 2026-11-01 ~ 2026-11-02");
    expect(fold.textContent).toContain("실기 발표 2026-11-20");
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(fold.getAttribute("data-expanded")).toBe("false");
    expect(fold.hasAttribute("inert")).toBe(true);
    expect(fold.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(button);
  });

  it("preserves missing-date and partial-feed information", async () => {
    await act(async () => root.render(createElement(ExamSessions, { items: [{ ...session, written: null, practical: null }], total: 1 })));
    expect(container.textContent).toContain("세부 날짜가 제공되지 않았어요");
    expect(container.querySelector("button")?.textContent).toBe("수집된 시험 일정 1건 보기");
  });
});
