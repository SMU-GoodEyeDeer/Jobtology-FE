import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OnboardingChat, QUESTIONS, chatIntroIndex } from "./OnboardingChat";

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
