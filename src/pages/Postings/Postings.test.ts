// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostingItem, PostingResponse, PostingsResponse } from "../../services/resourcesApi";
import { resourcesApi } from "../../services/resourcesApi";
import { clearPostingsCache } from "../../services/postingsCache";
import { occupationContext } from "../../testFixtures/occupationContext";
import { AssociationProvenance } from "./OccupationContext";
import { Postings } from "./Postings";
import { PostingDetail } from "./PostingDetail";
import { PostingEvidence } from "../Chat/PostingEvidence";
vi.mock("../../components/AppSidebar", () => ({ AppSidebar: () => null }));
vi.mock("../../services/resourcesApi", async importOriginal => ({ ...await importOriginal<typeof import("../../services/resourcesApi")>(), resourcesApi: { postings: vi.fn(), posting: vi.fn(), occupationContext: vi.fn() } }));
const posting: PostingItem = {
  source_provenance: { source_id: "job_alio", run_id: "exact-run", data_as_of: "2026-10-20T00:00:00Z" },
  posting_id: "urn:posting:a/b", title: "실제 수집 개발자 채용", organization_code: "org", organization_name: "수집 기관", date_posted: "2026-10-01", closing_date: "2026-10-31", ongoing: true,
  regions: ["서울"], employment_types: ["정규직"], recruitment_type: "신입", education: null, ncs_categories: [{ code: "20010203", name: "개발" }], headcount: 0, source_url: "https://example.org/posting",
};
const list: PostingsResponse = { items: [posting], sources: [{ source_id: "job_alio", run_id: "run", data_as_of: "2026-10-20T00:00:00Z" }], total: 25, limit: 20, offset: 0 };
const detail: PostingResponse = { item: posting, sources: list.sources };
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  clearPostingsCache();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(resourcesApi.postings).mockReset().mockResolvedValue(list);
  vi.mocked(resourcesApi.posting).mockReset().mockResolvedValue(detail);
  vi.mocked(resourcesApi.occupationContext).mockReset().mockResolvedValue(occupationContext(posting));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function renderPage(query = "") { await act(async () => root.render(createElement(MemoryRouter, { initialEntries: [`/postings${query}`] }, createElement(Postings)))); }
async function revisit(query = "") { await act(async () => root.unmount()); root = createRoot(container); await renderPage(query); }
function button(label: string) { return Array.from(container.querySelectorAll("button")).find(item => item.textContent === label || item.getAttribute("aria-label") === `${label} 페이지`)!; }
function changeInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
describe("real posting browser", () => {
  it("reuses a page and its open detail when returning quickly", async () => {
    const query = "?q=개발&posting=urn%3Aposting%3Aa%2Fb";
    await renderPage(query); await revisit(query);
    expect(resourcesApi.postings).toHaveBeenCalledTimes(1);
    expect(resourcesApi.posting).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".posting-detail")?.textContent).toContain(posting.title!);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
  it("keeps different searches and occupation results separate", async () => {
    vi.mocked(resourcesApi.postings).mockResolvedValueOnce({ ...list, items: [{ ...posting, title: "검색 A" }] })
      .mockResolvedValueOnce({ ...list, items: [{ ...posting, title: "검색 B" }] });
    await renderPage("?q=A"); await revisit("?q=B");
    expect(container.textContent).toContain("검색 B");
    await revisit("?occupation=20010203");
    expect(resourcesApi.occupationContext).toHaveBeenCalledTimes(1);
    await revisit("?q=A");
    expect(resourcesApi.postings).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("검색 A");
    expect(container.querySelector(".occupation-context-banner")).toBeNull();
    await revisit("?occupation=20010203");
    expect(resourcesApi.occupationContext).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".occupation-context-banner")).not.toBeNull();
  });
  it("shares a pending page request across a quick return", async () => {
    let finish!: (value: PostingsResponse) => void;
    vi.mocked(resourcesApi.postings).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await renderPage(); await revisit();
    expect(resourcesApi.postings).toHaveBeenCalledTimes(1);
    await act(async () => finish(list));
    expect(container.querySelector(".posting-card")?.textContent).toContain(posting.title!);
  });
  it("fetches an expired page again", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    try {
      await renderPage(); clock.mockReturnValue(145_001); await revisit();
      expect(resourcesApi.postings).toHaveBeenCalledTimes(2);
    } finally { clock.mockRestore(); }
  });
  it("refreshes both the selected detail and current filtered page", async () => {
    await renderPage("?q=개발&region=서울&offset=20&posting=urn%3Aposting%3Aa%2Fb");
    const closed = { ...posting, source_status: "CLOSED" };
    vi.mocked(resourcesApi.postings).mockResolvedValue({ ...list, items: [closed] });
    vi.mocked(resourcesApi.posting).mockResolvedValue({ ...detail, item: closed });
    await act(async () => button("새로고침").click());
    expect(resourcesApi.postings).toHaveBeenCalledTimes(2);
    expect(resourcesApi.postings).toHaveBeenLastCalledWith(expect.objectContaining({ q: "개발", region: "서울", offset: 20 }));
    expect(resourcesApi.posting).toHaveBeenCalledTimes(2);
    expect(container.querySelector(".posting-detail")?.textContent).toContain("모집 종료");
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("2");
  });
  it("labels inference provenance fields in Korean and omits missing values", async () => {
    const association = occupationContext(posting).items[0];
    await act(async () => root.render(createElement(AssociationProvenance, { items: [{ ...association,
      source_pins: { run_id: "수집-실행", source_hash: "원문-해시", normalized_hash: "정규화-해시", source_facts_sha256: "사실-해시" },
      catalog_pins: { pin: "분류-버전", catalog_hash: "분류-해시" },
    }] })));
    const rows = Array.from(container.querySelectorAll("dl div"));
    expect(Object.fromEntries(rows.map(row => [row.querySelector("dt")?.textContent, row.querySelector("dd")?.textContent]))).toMatchObject({
      "연결 식별자": association.association_id, "원문 출처": "잡코리아", "원문 수집 실행": "수집-실행", "원문 검증값": "원문-해시",
      "정규화 자료 검증값": "정규화-해시", "원문 사실 검증값": "사실-해시", "분류 기준 버전": "분류-버전", "분류 자료 검증값": "분류-해시",
    });
    await act(async () => root.render(createElement(AssociationProvenance, { items: [{ ...association, source_pins: { run_id: null, source_hash: null, normalized_hash: null, source_facts_sha256: null }, catalog_pins: { pin: null, catalog_hash: null } }] })));
    expect(container.textContent).not.toContain("원문 수집 실행");
    expect(container.textContent).not.toContain("분류 자료 검증값");
  });
  it.each(["2026-10-20T09:30:00", "invalid-start"])("formats an application start instant or preserves its invalid source value: %s", async application_start_at => {
    await act(async () => root.render(createElement(PostingDetail, { postingId: posting.posting_id, posting: { ...posting, application_start_at, application_start_date: "2026-10-01" } })));
    const start = Array.from(container.querySelectorAll("dl div")).find(row => row.querySelector("dt")?.textContent === "접수 시작")?.querySelector("dd")?.textContent;
    if (application_start_at === "invalid-start") expect(start).toBe(application_start_at);
    else {
      expect(start).toMatch(/2026년\s*10월\s*20일\s*오전\s*9:30/);
      expect(start).not.toContain(application_start_at);
    }
  });
  it("loads graph-linked filters and opens the actual selected posting detail", async () => {
    await renderPage("?ncs_category=20010203");
    expect(resourcesApi.postings).toHaveBeenCalledWith(expect.objectContaining({ ncs_category: "20010203", limit: 20, offset: 0 }));
    await act(async () => container.querySelector<HTMLButtonElement>(".posting-card")!.click());
    expect(resourcesApi.posting).toHaveBeenCalledWith("urn:posting:a/b");
    expect(container.querySelector(".posting-detail")?.textContent).toContain("수집 기관");
    expect(container.querySelector(".posting-detail")?.textContent).toContain("0명");
    expect(container.querySelector(".posting-detail")?.textContent).toContain("데이터 반영 2026-10-20");
    expect(container.querySelector('.posting-detail a')?.getAttribute("href")).toBe("https://example.org/posting");
    expect(container.textContent).toContain("현재 접수 여부");
  });
  it("shows each supplied source without reordering a server-paginated feed or inventing NCS mappings", async () => {
    const jobkorea = { ...posting, source_provenance: { source_id: "jobkorea", run_id: "exact-jk", data_as_of: "2026-10-08T02:31:45Z" }, posting_id: "jobkorea:001", source_id: "jobkorea", ncs_categories: [] };
    const alio = { ...posting, posting_id: "001", source_id: "job_alio" };
    const sources = [{ source_id: "jobkorea", run_id: "jk-ready", data_as_of: "2026-10-08T02:31:45Z" }, ...list.sources];
    vi.mocked(resourcesApi.postings).mockResolvedValue({ ...list, sources, items: [jobkorea, alio], total: 2 });
    vi.mocked(resourcesApi.posting).mockResolvedValue({ item: jobkorea, sources: [sources[0]] });
    await renderPage();
    expect(Array.from(container.querySelectorAll(".posting-card-source")).map(item => item.textContent)).toEqual(["잡코리아", "JOB-ALIO"]);
    expect(Array.from(container.querySelectorAll(".postings-source")).map(item => item.textContent)).toEqual(["잡코리아 · 데이터 반영 2026-10-08", "JOB-ALIO · 데이터 반영 2026-10-20"]);
    await act(async () => container.querySelector<HTMLButtonElement>(".posting-card")!.click());
    expect(resourcesApi.posting).toHaveBeenLastCalledWith("jobkorea:001");
    expect(container.querySelector(".posting-detail")?.textContent).toContain("잡코리아 · 데이터 반영 2026-10-08");
    const ncs = Array.from(container.querySelectorAll(".posting-detail dl div")).find(row => row.querySelector("dt")?.textContent === "NCS 분야");
    expect(ncs?.querySelector("dd")?.textContent).toBe("제공되지 않음");
  });
  it("paginates real results and resets paging and detail when search changes", async () => {
    await renderPage("?q=old&offset=20&posting=urn%3Aposting%3Aa%2Fb");
    await act(async () => button("이전").click());
    expect(resourcesApi.postings).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
    await act(async () => changeInput(container.querySelector<HTMLInputElement>('input[placeholder="공고명 또는 기관명"]')!, "백엔드"));
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(resourcesApi.postings).toHaveBeenLastCalledWith(expect.objectContaining({ q: "백엔드", offset: 0 }));
    expect(container.querySelector(".posting-detail")).toBeNull();
  });
  it("shows total pages at both ends of the list and jumps without losing applied filters", async () => {
    vi.mocked(resourcesApi.postings).mockResolvedValue({ ...list, total: 2000 });
    await renderPage("?q=개발&ncs_category=20010203&region=서울&open_on=2026-10-20&posting=urn%3Aposting%3Aa%2Fb");
    const pagers = container.querySelectorAll(".postings-pagination");
    expect(pagers).toHaveLength(2);
    expect(pagers[0].querySelector(".postings-page-count")?.textContent).toContain("1 / 100페이지");
    expect(pagers[0].querySelector<HTMLButtonElement>('[aria-label="이전 페이지"]')?.disabled).toBe(true);
    const jumpForm = pagers[0].querySelector("form")!;
    await act(async () => changeInput(jumpForm.querySelector("input")!, "73"));
    await act(async () => jumpForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(resourcesApi.postings).toHaveBeenLastCalledWith({ q: "개발", ncs_category: "20010203", region: "서울", open_on: "2026-10-20", offset: 1440, limit: 20 });
    expect(container.querySelector(".posting-detail")).toBeNull();
    expect(Array.from(container.querySelectorAll('[aria-current="page"]')).map(item => item.textContent)).toEqual(["73", "73"]);
    expect(document.activeElement).toBe(container.querySelector(".postings-list-heading h2"));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="100페이지"]')!.click());
    expect(resourcesApi.postings).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1980 }));
    expect(container.querySelector<HTMLButtonElement>('[aria-label="다음 페이지"]')?.disabled).toBe(true);
    const requests = vi.mocked(resourcesApi.postings).mock.calls.length;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="1페이지"]')!.click());
    expect(resourcesApi.postings).toHaveBeenCalledTimes(requests);
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("1");
  });
  it("rejects direct page entries outside the result range or between pages", async () => {
    await renderPage();
    const form = container.querySelector(".postings-page-jump")!;
    for (const value of ["0", "3", "1.5", ""]) {
      await act(async () => changeInput(form.querySelector("input")!, value));
      await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    }
    expect(resourcesApi.postings).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("1");
  });
  it.each([25, 0])("recovers an out-of-range URL when only %s postings remain", async total => {
    vi.mocked(resourcesApi.postings).mockResolvedValue({ ...list, total, items: total ? [posting] : [] });
    await renderPage("?q=개발&offset=4000");
    expect(resourcesApi.postings).toHaveBeenLastCalledWith(expect.objectContaining({ q: "개발", offset: total ? 20 : 0 }));
    if (total) expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("2");
    else expect(container.querySelector(".postings-pagination")).toBeNull();
  });
  it("keeps trimmed draft filters when choosing today and clears paging and posting selection", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 20, 12));
    try {
      await renderPage("?q=old&ncs_category=20010203&region=서울&open_on=2026-01-01&offset=20&posting=urn%3Aposting%3Aa%2Fb");
      await act(async () => {
        changeInput(container.querySelector<HTMLInputElement>('input[placeholder="공고명 또는 기관명"]')!, " 백엔드 ");
        changeInput(container.querySelector<HTMLInputElement>('input[placeholder="예: 200102"]')!, " 20010204 ");
        changeInput(container.querySelector<HTMLInputElement>('input[placeholder="예: 서울"]')!, " 부산 ");
      });
      await act(async () => button("오늘 기준").click());
      expect(resourcesApi.postings).toHaveBeenLastCalledWith({ q: "백엔드", ncs_category: "20010204", region: "부산", open_on: "2026-10-20", offset: 0, limit: 20 });
      expect(container.querySelector(".posting-detail")).toBeNull();
      expect(container.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe("2026-10-20");
    } finally { vi.useRealTimers(); }
  });
  it("does not fabricate results for an empty feed and lets a failed feed retry", async () => {
    vi.mocked(resourcesApi.postings).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...list, items: [], total: 0 });
    await renderPage();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("불러오지 못했어요");
    await act(async () => button("다시 시도").click());
    expect(container.textContent).toContain("조건에 맞는 수집 공고가 없어요");
    expect(container.querySelector(".posting-card")).toBeNull();
  });
  it("ignores a detail response arriving after the selected posting changes", async () => {
    let finish!: (value: PostingResponse) => void;
    vi.mocked(resourcesApi.posting).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => root.render(createElement(PostingDetail, { postingId: "old" })));
    await act(async () => root.render(createElement(PostingDetail, { postingId: "new" })));
    await act(async () => finish({ ...detail, item: { ...posting, title: "지연된 이전 공고" } }));
    expect(container.textContent).not.toContain("지연된 이전 공고");
    expect(container.textContent).toContain(posting.title!);
  });
  it("renders missing NCS codes and names without inventing category identifiers", async () => {
    vi.mocked(resourcesApi.posting).mockResolvedValueOnce({ ...detail, item: { ...posting, ncs_categories: [{ code: null, name: "분류명만 제공" }, { code: null, name: null }] } });
    await act(async () => root.render(createElement(PostingDetail, { postingId: posting.posting_id })));
    const value = Array.from(container.querySelectorAll("dl div")).find(row => row.querySelector("dt")?.textContent === "NCS 분야")?.querySelector("dd")?.textContent;
    expect(value).toBe("분류명만 제공");
    expect(value).not.toContain("null");
  });
  it("never renders an executable URL supplied by the source", async () => {
    vi.mocked(resourcesApi.posting).mockResolvedValueOnce({ ...detail, item: { ...posting, source_url: "javascript:alert(1)" } });
    await act(async () => root.render(createElement(PostingDetail, { postingId: posting.posting_id })));
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("원문 링크가 제공되지 않았어요");
  });
  it("paginates associated postings using nested previews and clears context on a normal search", async () => {
    vi.mocked(resourcesApi.occupationContext).mockResolvedValue({ ...occupationContext(posting), total: 25 });
    await renderPage("?occupation=20010203&offset=20&posting=urn%3Aposting%3Aa%2Fb");
    expect(resourcesApi.occupationContext).toHaveBeenLastCalledWith("20010203", 20, 20);
    expect(resourcesApi.postings).not.toHaveBeenCalled();
    expect(resourcesApi.posting).not.toHaveBeenCalled();
    expect(container.textContent).toContain("역량 요구나 보유 역량의 근거로 반영하지 않아요");
    expect(container.textContent).toContain("미검토");
    expect(container.textContent).toContain("exact-catalog");
    await act(async () => button("이전").click());
    expect(resourcesApi.occupationContext).toHaveBeenLastCalledWith("20010203", 20, 0);
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(resourcesApi.postings).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
    expect(container.querySelector(".occupation-context-banner")).toBeNull();
  });
  it("shows the true application start and exact item provenance independently of feed freshness", async () => {
    vi.mocked(resourcesApi.posting).mockResolvedValueOnce({ sources: [{ source_id: "jobkorea", run_id: "latest-run", data_as_of: "2026-10-21" }], item: { ...posting, application_start_date: "2026-10-10", source_status: "CLOSED", source_provenance: { source_id: "jobkorea", run_id: "old-run", data_as_of: "2026-10-01" } } });
    await act(async () => root.render(createElement(PostingDetail, { postingId: posting.posting_id })));
    const fields = Array.from(container.querySelectorAll("dl div"));
    expect(fields.find(row => row.querySelector("dt")?.textContent === "접수 시작")?.textContent).toContain("2026-10-10");
    expect(container.textContent).toContain("모집 종료 · 원문 상태");
    expect(container.textContent).toContain("old-run");
    expect(container.textContent).not.toContain("latest-run");
    expect(container.textContent).not.toContain("데이터 반영 2026-10-21");
  });
  it("shows real posting metadata when an aggregate graph node is opened", async () => {
    await act(async () => root.render(createElement(MemoryRouter, null, createElement(PostingEvidence, { occupation: "20010203" }))));
    expect(resourcesApi.occupationContext).toHaveBeenCalledWith("20010203", 3);
    expect(resourcesApi.postings).not.toHaveBeenCalled();
    expect(container.textContent).toContain(posting.title!);
    expect(container.textContent).toContain(posting.organization_name!);
    const link = container.querySelector<HTMLAnchorElement>(".node-posting-card")!;
    expect(new URL(link.href).searchParams.get("posting")).toBe(posting.posting_id);
    expect(new URL(link.href).searchParams.get("occupation")).toBe("20010203");
  });
});
