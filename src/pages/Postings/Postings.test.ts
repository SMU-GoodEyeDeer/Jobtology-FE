// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostingItem, PostingResponse, PostingsResponse } from "../../services/resourcesApi";
import { resourcesApi } from "../../services/resourcesApi";
import { Postings } from "./Postings";
import { PostingDetail } from "./PostingDetail";
import { PostingEvidence } from "../Chat/PostingEvidence";
vi.mock("../../components/AppSidebar", () => ({ AppSidebar: () => null }));
vi.mock("../../services/resourcesApi", async importOriginal => ({ ...await importOriginal<typeof import("../../services/resourcesApi")>(), resourcesApi: { postings: vi.fn(), posting: vi.fn() } }));
const posting: PostingItem = {
  posting_id: "urn:posting:a/b", title: "실제 수집 개발자 채용", organization_code: "org", organization_name: "수집 기관", date_posted: "2026-10-01", closing_date: "2026-10-31", ongoing: true,
  regions: ["서울"], employment_types: ["정규직"], recruitment_type: "신입", education: null, ncs_categories: [{ code: "20010203", name: "개발" }], headcount: 0, source_url: "https://example.org/posting",
};
const list: PostingsResponse = { items: [posting], sources: [{ source_id: "alio", run_id: "run", data_as_of: "2026-10-20T00:00:00Z" }], total: 25, limit: 20, offset: 0 };
const detail: PostingResponse = { item: posting, sources: list.sources };
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(resourcesApi.postings).mockReset().mockResolvedValue(list);
  vi.mocked(resourcesApi.posting).mockReset().mockResolvedValue(detail);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function renderPage(query = "") { await act(async () => root.render(createElement(MemoryRouter, { initialEntries: [`/postings${query}`] }, createElement(Postings)))); }
function button(label: string) { return Array.from(container.querySelectorAll("button")).find(item => item.textContent === label || item.getAttribute("aria-label") === `${label} 페이지`)!; }
function changeInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
describe("real posting browser", () => {
  it("loads graph-linked filters and opens the actual selected posting detail", async () => {
    await renderPage("?ncs_category=20010203");
    expect(resourcesApi.postings).toHaveBeenCalledWith(expect.objectContaining({ ncs_category: "20010203", limit: 20, offset: 0 }));
    await act(async () => container.querySelector<HTMLButtonElement>(".posting-card")!.click());
    expect(resourcesApi.posting).toHaveBeenCalledWith("urn:posting:a/b");
    expect(container.querySelector(".posting-detail")?.textContent).toContain("수집 기관");
    expect(container.querySelector(".posting-detail")?.textContent).toContain("0명");
    expect(container.querySelector(".posting-detail")?.textContent).toContain("수집 기준 2026-10-20");
    expect(container.querySelector('.posting-detail a')?.getAttribute("href")).toBe("https://example.org/posting");
    expect(container.textContent).toContain("현재 접수 여부");
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
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="1페이지"]')!.click());
    expect(resourcesApi.postings).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
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
  it("shows real posting metadata when an aggregate graph node is opened", async () => {
    await act(async () => root.render(createElement(MemoryRouter, null, createElement(PostingEvidence, { category: "20010203" }))));
    expect(resourcesApi.postings).toHaveBeenCalledWith({ ncs_category: "20010203", limit: 3 });
    expect(container.textContent).toContain(posting.title!);
    expect(container.textContent).toContain(posting.organization_name!);
    const link = container.querySelector<HTMLAnchorElement>(".node-posting-card")!;
    expect(new URL(link.href).searchParams.get("posting")).toBe(posting.posting_id);
    expect(new URL(link.href).searchParams.get("ncs_category")).toBe("20010203");
  });
});
