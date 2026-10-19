// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "./AccountSettings";

const { deleteAccount } = vi.hoisted(() => ({ deleteAccount: vi.fn<() => Promise<void>>() }));
vi.mock("../../context/SessionContext", () => ({
  useSession: () => ({ session: { user_id: "private-hash", display_name: "홍길동" }, deleteAccount }),
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  deleteAccount.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ["/my-info"] },
    createElement(Routes, null,
      createElement(Route, { path: "/my-info", element: createElement(AccountSettings) }),
      createElement(Route, { path: "/", element: createElement("p", null, "Google login") }),
    ),
  )));
});

afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(item => item.textContent === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

async function acknowledge() {
  await act(async () => button("Jobtology 계정 삭제").click());
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
}

describe("account deletion settings", () => {
  it("requires explicit acknowledgement and allows cancellation without deleting", async () => {
    expect(container.textContent).toContain("홍길동님");
    expect(container.textContent).not.toContain("private-hash");
    await act(async () => button("Jobtology 계정 삭제").click());

    expect(button("Jobtology 계정 영구 삭제").disabled).toBe(true);
    expect(container.textContent).toContain("Google 계정은 삭제되지 않아요");
    await act(async () => button("취소").click());

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("prevents repeated requests while deleting and navigates to login on success", async () => {
    let finish!: () => void;
    deleteAccount.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await acknowledge();
    await act(async () => button("Jobtology 계정 영구 삭제").click());

    expect(button("삭제 중...").disabled).toBe(true);
    expect(button("취소").disabled).toBe(true);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(container.textContent).toBe("Google login");
  });

  it("keeps the confirmation available for retry after failure", async () => {
    deleteAccount.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce();
    await acknowledge();
    await act(async () => button("Jobtology 계정 영구 삭제").click());

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("계정을 삭제하지 못했어요");
    expect(button("Jobtology 계정 영구 삭제").disabled).toBe(false);
    await act(async () => button("Jobtology 계정 영구 삭제").click());
    expect(deleteAccount).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe("Google login");
  });
});
