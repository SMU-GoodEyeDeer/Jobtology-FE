import { describe, expect, it } from "vitest";
import { goalCalendarDate, goalDateRange, goalDeadline } from "./goalDates";

describe("goal calendar dates", () => {
  it.each([
    ["2027-02-01", "Asia/Seoul", "2027-02-01T14:59:59.000Z"],
    ["2027-02-01", "UTC", "2027-02-01T23:59:59.000Z"],
    ["2027-03-13", "America/New_York", "2027-03-14T04:59:59.000Z"],
    ["2027-03-14", "America/New_York", "2027-03-15T03:59:59.000Z"],
    ["2026-11-01", "America/New_York", "2026-11-02T04:59:59.000Z"],
  ])("stores %s at the end of the day in %s", (date, zone, expected) => {
    expect(goalDeadline(date, zone)).toBe(expected);
    expect(goalCalendarDate(expected, zone)).toBe(date);
  });

  it("displays an existing deadline in its stored timezone", () => {
    expect(goalCalendarDate("2026-10-20T01:00:00Z", "America/New_York")).toBe("2026-10-19");
    expect(goalDateRange("Asia/Seoul", new Date("2026-10-20T20:00:00Z"))).toEqual({ min: "2026-10-21", max: "2027-10-21" });
  });

  it.each([["2027-02-30", "UTC"], ["2027-01-01", "Invalid/Zone"], ["2011-12-30", "Pacific/Apia"]])("rejects invalid calendar date or timezone %s %s", (date, zone) => {
    expect(() => goalDeadline(date, zone)).toThrow();
  });
});
