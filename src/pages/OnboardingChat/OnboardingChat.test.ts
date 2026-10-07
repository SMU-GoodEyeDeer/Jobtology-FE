import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OnboardingChat, QUESTIONS, chatIntroIndex } from "./OnboardingChat";
import { progressIndex, progressSteps } from "./progress";

vi.mock("../../context/SessionContext", () => ({
  useSession: () => ({ session: { user_id: "u1" }, loading: false, error: null, refresh: async () => {} }),
}));
vi.mock("../../context/OccupationsContext", () => ({
  useOccupations: () => ({
    occupations: [{ occupation_id: "BACKEND_DEVELOPER", name: "백엔드 개발자" }],
    loading: false,
    getName: (id: string) => id,
  }),
}));

function render() {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(OnboardingChat)));
}

describe("OnboardingChat", () => {
  it("starts with the occupation question as buttons and a stop button", () => {
    const html = render();
    expect(html).toContain("어떤 IT 직무를 목표로 하세요?");
    expect(html).toContain(">백엔드 개발자</button>");
    expect(html).toContain(">아직 모르겠어요</button>");
    expect(html).toContain("그만하고 시작하기");
  });

  it("keeps the text input disabled while a button answer is expected", () => {
    expect(render()).toMatch(/<input class="ob-input"[^>]*disabled=""/);
  });

  it("renders five progress steps by default", () => {
    const html = render();
    const labels = [...html.matchAll(/ob-progress-label">([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(["직무", "학과", "학년", "해본 것", "대화"]);
    expect(html).toContain('aria-label="온보딩 진행 단계"');
    expect(html).toContain('aria-current="step"');
  });
});

describe("progress trail", () => {
  it("shows 3 steps when there is no target occupation (discovery)", () => {
    expect(progressSteps(true).map((s) => s.label)).toEqual(["직무", "학과", "학년", "해본 것", "대화"]);
    expect(progressSteps(false).map((s) => s.label)).toEqual(["직무", "학과", "학년"]);
  });

  it("maps each step to its trail index", () => {
    expect(progressIndex("occupation")).toBe(0);
    expect(progressIndex("chat")).toBe(4);
    expect(progressIndex("unknown")).toBe(-1);
  });
});

describe("chatIntroIndex", () => {
  it("sends only the conversation that follows the experience prompt", () => {
    const messages = [
      { role: "ai" as const, text: QUESTIONS.occupation },
      { role: "user" as const, text: "백엔드 개발자" },
      { role: "ai" as const, text: QUESTIONS.chat },
      { role: "user" as const, text: "Spring으로 API를 만들었어요" },
    ];
    expect(chatIntroIndex(messages)).toBe(2);
    expect(chatIntroIndex(messages.slice(0, 2))).toBe(0);
  });
});
