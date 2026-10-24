import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "./api";
import { clearPostingsCache, peekPostingsCache, readPostingsCache } from "./postingsCache";

beforeEach(() => clearPostingsCache());
afterEach(() => vi.restoreAllMocks());
describe("public posting memory cache", () => {
  it("deduplicates pending reads and expires successful results after 45 seconds", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    let finish!: (value: { total: number }) => void;
    const load = vi.fn(() => new Promise<{ total: number }>(resolve => { finish = resolve; }));
    const first = readPostingsCache("page", load), second = readPostingsCache("page", load);
    expect(second).toBe(first);
    expect(peekPostingsCache("page")).toBeUndefined();
    await Promise.resolve(); finish({ total: 20 }); await first;
    expect(peekPostingsCache("page")).toEqual({ total: 20 });
    await readPostingsCache("page", load); expect(load).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(145_001);
    expect(peekPostingsCache("page")).toBeUndefined();
  });
  it("bounds the cache to 40 pages/details", async () => {
    await Promise.all(Array.from({ length: 41 }, (_, index) => readPostingsCache(String(index), async () => ({ index }))));
    expect(peekPostingsCache("0")).toBeUndefined();
    expect(peekPostingsCache("40")).toEqual({ index: 40 });
  });
  it("evicts failures so a retry can fetch again", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ total: 0 });
    await expect(readPostingsCache("page", load)).rejects.toThrow("offline");
    expect(peekPostingsCache("page")).toBeUndefined();
    await expect(readPostingsCache("page", load)).resolves.toEqual({ total: 0 });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("clears on logout/account credential changes and rejects late cache writes", async () => {
    setCsrfToken("synthetic-account-a");
    let finish!: (value: { total: number }) => void;
    const old = readPostingsCache("page", () => new Promise<{ total: number }>(resolve => { finish = resolve; }));
    await Promise.resolve(); setCsrfToken(null); finish({ total: 99 }); await old;
    expect(peekPostingsCache("page")).toBeUndefined();
    await readPostingsCache("page", async () => ({ total: 1 }));
    setCsrfToken("synthetic-account-b");
    expect(peekPostingsCache("page")).toBeUndefined();
    setCsrfToken(null);
  });
  it("does not let an invalidated request replace the refreshed value", async () => {
    let finish!: (value: string) => void;
    const old = readPostingsCache("detail", () => new Promise<string>(resolve => { finish = resolve; }));
    await Promise.resolve(); clearPostingsCache();
    await readPostingsCache("detail", async () => "new");
    finish("old"); await old;
    expect(peekPostingsCache("detail")).toBe("new");
  });
});
