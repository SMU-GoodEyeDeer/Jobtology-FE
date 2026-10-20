import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPostingDateTime, postingDeadlineLabel, postingSearchParams, postingsHref, resourcesApi, safeSourceUrl } from "./resourcesApi";
import type { PostingItem } from "./resourcesApi";
import { analysisSkillHref, roadmapSkillHref } from "./skillNavigation";
afterEach(() => vi.unstubAllGlobals());

describe("live resource navigation and transport", () => {
  it("keeps exact filters, paging, and opaque posting identities in shareable URLs", () => {
    const id = "urn:posting:기관/공고?x&y";
    const href = postingsHref({ q: "개발 & 운영", ncs_category: "20010203", offset: 20, limit: 20 }, id);
    const params = new URL(href, "https://app.example").searchParams;
    expect(params.get("posting")).toBe(id);
    expect(params.get("q")).toBe("개발 & 운영");
    expect(params.get("offset")).toBe("20");
    expect(postingSearchParams({ q: "", offset: 0 }).toString()).toBe("offset=0");
  });
  it("uses the authenticated transport and encodes the complete posting ID once", async () => {
    const result = { item: { posting_id: "urn:posting:a/b" }, sources: [] };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await resourcesApi.posting("urn:posting:a/b")).toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/live/postings/urn%3Aposting%3Aa%2Fb", expect.objectContaining({ method: "GET", credentials: "include" }));
  });
  it("loads occupation and role context through separate authenticated endpoints with association paging", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await resourcesApi.occupationContext("20010203,15-1252.00", 20, 40);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v2/live/occupation-context?occupation_codes=20010203%2C15-1252.00&limit=20&offset=40", expect.objectContaining({ credentials: "include" }));
    await resourcesApi.rolePostingContext("BACKEND_DEVELOPER", 3);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v2/roles/BACKEND_DEVELOPER/posting-context?limit=3&offset=0", expect.objectContaining({ credentials: "include" }));
    expect(new URL(postingsHref({ occupation: "20010203,15-1252.00", offset: 40 }), "https://app.example").searchParams.get("occupation")).toBe("20010203,15-1252.00");
  });
  it("keeps closed, policy rolling, and dated deadlines distinct", () => {
    const item = {} as PostingItem;
    expect(postingDeadlineLabel({ ...item, source_status: "CLOSED", deadline_kind: "ROLLING", ongoing_basis: "USER_POLICY" })).toBe("모집 종료 · 원문 상태");
    expect(postingDeadlineLabel({ ...item, deadline_kind: "ROLLING", ongoing_basis: "USER_POLICY" })).toBe("상시 모집 · 사용자 정책에 따른 추정");
    expect(postingDeadlineLabel({ ...item, deadline_kind: "UNTIL_FILLED" })).toBe("채용 시 마감 · 원문 확인 필요");
    expect(postingDeadlineLabel({ ...item, ongoing: true, closing_date: "2026-10-31" })).toBe("접수 마감일 2026-10-31");
  });
  it("formats posting instants in Korean local time and keeps date-only labels unchanged", () => {
    const instant = "2026-10-20T09:30:00";
    const formatted = formatPostingDateTime(instant);
    expect(formatted).toMatch(/2026년\s*10월\s*20일\s*오전\s*9:30/);
    expect(postingDeadlineLabel({ deadline_at: instant } as PostingItem)).toBe(`접수 마감 ${formatted}`);
    expect(postingDeadlineLabel({ closing_date: "2026-10-31" } as PostingItem)).toBe("접수 마감일 2026-10-31");
  });
  it.each(["invalid", "2026-99-99T25:00:00Z", ""])("preserves an invalid posting time: %s", value => {
    expect(formatPostingDateTime(value)).toBe(value);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "//example.com", "/relative", "not a url"])("rejects unsafe or relative source URL %s", value => {
    expect(safeSourceUrl(value)).toBeNull();
  });
  it("permits ordinary source links", () => {
    expect(safeSourceUrl("https://example.org/posting?id=1")).toBe("https://example.org/posting?id=1");
  });
  it("links by canonical requirement identity before exact validated NCS fallback", () => {
    expect(new URL(roadmapSkillHref("BACKEND:2001020301", "2001020302"), "https://app.example").searchParams.get("requirement")).toBe("BACKEND:2001020301");
    expect(analysisSkillHref(null, "2001020301")).toBe("/analysis?ncs=2001020301");
    expect(analysisSkillHref(null, "label instead of code")).toBe("/analysis");
    const params = new URL(roadmapSkillHref("BACKEND:2001020301", null, "step:실습/a?b&c"), "https://app.example").searchParams;
    expect(params.get("requirement")).toBe("BACKEND:2001020301");
    expect(params.get("step")).toBe("step:실습/a?b&c");
    expect(roadmapSkillHref(null, "2001020301", "second")).toBe("/roadmap?ncs=2001020301&step=second");
    expect(roadmapSkillHref(null, null, "second")).toBe("/roadmap?step=second");
  });
});
