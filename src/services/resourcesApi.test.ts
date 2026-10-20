import { afterEach, describe, expect, it, vi } from "vitest";
import { postingSearchParams, postingsHref, resourcesApi, safeSourceUrl } from "./resourcesApi";
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
  });
});
