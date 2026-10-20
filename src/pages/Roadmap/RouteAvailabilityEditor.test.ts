// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoutePreferencesResponse } from "../../services/types";
import { availabilityError, RouteAvailabilityEditor } from "./RouteAvailabilityEditor";
const preferences: RoutePreferencesResponse = { profile_version: 1, available_hours_per_week: 10, availability_source: "DEFAULT", budget_mode: "REGULAR", fastest_path: false, needs_portfolio: false, career_switch: false, max_out_of_pocket_krw: null, weekly_availability: [], unavailable_dates: [] };
let root: Root; let container: HTMLDivElement;
const onSave = vi.fn();
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  onSave.mockReset().mockResolvedValue(true);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => root.render(createElement(RouteAvailabilityEditor, { preferences, timezone: "Asia/Seoul", busy: false, onSave }))); }
async function click(text: string) { await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click()); }
async function submit() { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
describe("route availability editing", () => {
  it("rejects overlapping windows and allows adjacent intervals including midnight", () => {
    expect(availabilityError([{ weekday: 1, start_hour: 19, end_hour: 21 }, { weekday: 1, start_hour: 20, end_hour: 22 }])).toContain("겹쳐요");
    expect(availabilityError([{ weekday: 1, start_hour: 19, end_hour: 21 }, { weekday: 1, start_hour: 21, end_hour: 24 }])).toBeNull();
    expect(availabilityError([{ weekday: 1, start_hour: 21, end_hour: 20 }])).toContain("종료 시간");
  });
  it("retains edited hours after a failed save and retries the same calendar", async () => {
    onSave.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await render(); await click("학습 시간 추가"); await submit();
    expect(onSave).toHaveBeenCalledWith({ weekly_availability: [{ weekday: 1, start_hour: 19, end_hour: 21 }], unavailable_dates: [] });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("입력한 내용은 유지했어요");
    expect(container.querySelector<HTMLSelectElement>('[aria-label="1번째 시작 시간"]')?.value).toBe("19");
    await submit();
    expect(onSave.mock.calls[1]).toEqual(onSave.mock.calls[0]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("저장했어요");
  });
  it("does not submit overlapping time selections", async () => {
    await render(); await click("학습 시간 추가"); await click("학습 시간 추가"); await submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("겹쳐요");
  });
});
