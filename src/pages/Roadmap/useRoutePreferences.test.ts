// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoutePreferencesResponse } from "../../services/types";
import { useRoutePreferences } from "./useRoutePreferences";

const { get, update } = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("../../services/api", () => ({ routePrefsApi: { get, update } }));
const defaults: RoutePreferencesResponse = {
  profile_version: 7, available_hours_per_week: 10, availability_source: "DEFAULT",
  budget_mode: "REGULAR", max_out_of_pocket_krw: null, fastest_path: false,
  needs_portfolio: false, career_switch: false,
};
let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useRoutePreferences>;
function Probe({ user = "user", ready = true }: { user?: string; ready?: boolean }) {
  state = useRoutePreferences(user, ready); return null;
}
async function render(user = "user", ready = true) {
  await act(async () => root.render(createElement(Probe, { user, ready })));
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  get.mockReset(); update.mockReset(); get.mockResolvedValue(defaults);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("roadmap preference loading and saves", () => {
  it("waits for the authenticated session before requesting account preferences", async () => {
    await render("user", false);
    expect(get).not.toHaveBeenCalled();
    await render();
    expect(get).toHaveBeenCalledTimes(1);
    expect(state.preferences).toEqual(defaults);
  });
  it("reports a load failure and supports an explicit retry", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(state.error).toContain("불러오지 못했어요");
    expect(state.preferences).toBeNull();
    await act(async () => state.retry());
    expect(state.preferences).toEqual(defaults);
    expect(state.error).toBeNull();
  });
  it("restores the previous toggle on save failure", async () => {
    await render();
    update.mockRejectedValueOnce(new Error("conflict"));
    await act(async () => state.toggle("needs_portfolio"));
    expect(state.preferences?.needs_portfolio).toBe(false);
    expect(state.error).toContain("이전 값으로 되돌렸어요");
    expect(state.saving).toBe(false);
  });
  it("preserves concurrent changes and uses the version from the same fresh snapshot", async () => {
    await render();
    const fresh = { ...defaults, profile_version: 9, fastest_path: true, available_hours_per_week: 18 };
    get.mockResolvedValueOnce(fresh);
    update.mockResolvedValueOnce({ ...fresh, profile_version: 10, needs_portfolio: true });
    await act(async () => state.toggle("needs_portfolio"));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      expected_profile_version: 9, available_hours_per_week: 18, fastest_path: true, needs_portfolio: true,
    }));
    expect(state.preferences?.fastest_path).toBe(true);
  });
  it("preserves the fresh calendar when toggling other conditions and uses fresh versions for explicit availability edits", async () => {
    await render();
    const weekly_availability = [{ weekday: 2, start_hour: 18, end_hour: 21 }];
    const unavailable_dates = ["2026-12-25"];
    const fresh = { ...defaults, profile_version: 11, weekly_availability, unavailable_dates };
    get.mockResolvedValueOnce(fresh); update.mockResolvedValueOnce({ ...fresh, needs_portfolio: true });
    await act(async () => state.toggle("needs_portfolio"));
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ expected_profile_version: 11, weekly_availability, unavailable_dates, needs_portfolio: true }));
    get.mockResolvedValueOnce({ ...fresh, profile_version: 12, career_switch: true });
    update.mockResolvedValueOnce({ ...fresh, profile_version: 13, career_switch: true, weekly_availability: [] });
    await act(async () => state.saveAvailability({ weekly_availability: [], unavailable_dates }));
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ expected_profile_version: 12, career_switch: true, weekly_availability: [], unavailable_dates }));
  });
  it("serializes rapid toggles while a save is pending", async () => {
    await render();
    let finish!: (value: RoutePreferencesResponse) => void;
    get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    update.mockResolvedValueOnce({ ...defaults, needs_portfolio: true });
    await act(async () => { void state.toggle("needs_portfolio"); void state.toggle("career_switch"); });
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => finish(defaults));
    expect(update).toHaveBeenCalledTimes(1);
    expect(state.preferences?.career_switch).toBe(false);
  });
  it("keeps current preferences during same-account retries but clears them on account changes", async () => {
    await render();
    let finish!: (value: RoutePreferencesResponse) => void;
    get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => state.retry());
    expect(state.preferences).toEqual(defaults);
    expect(state.loading).toBe(true);
    await act(async () => finish({ ...defaults, profile_version: 8 }));
    expect(state.preferences?.profile_version).toBe(8);
    get.mockImplementationOnce(() => new Promise(() => {}));
    await render("another-account");
    expect(state.preferences).toBeNull();
  });
  it("keeps the editor data disabled while the same session is rechecked", async () => {
    await render();
    await render("user", false);
    expect(state.preferences).toEqual(defaults);
    expect(state.loading).toBe(true);
    expect(await state.saveAvailability({ weekly_availability: [], unavailable_dates: [] })).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
  it("does not apply another account's late load response", async () => {
    let finish!: (value: RoutePreferencesResponse) => void;
    get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render("first");
    const next = { ...defaults, profile_version: 2, career_switch: true };
    get.mockResolvedValueOnce(next);
    await render("second");
    await act(async () => finish(defaults));
    expect(state.preferences).toEqual(next);
  });
});
