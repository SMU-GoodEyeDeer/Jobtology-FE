import { createElement } from "react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Survey2 } from "./Survey2";
import { Survey3 } from "./Survey3";
import { SurveyProvider } from "../../context/SurveyContext";

vi.mock("../../context/SessionContext", () => ({
  useSession: () => ({ session: { user_id: "u1" }, loading: false, error: null, refresh: async () => {} }),
}));

function render(component: ComponentType) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(SurveyProvider, null, createElement(component)))
  );
}

describe("required onboarding fields", () => {
  it("blocks 학과·학년 until both are entered", () => {
    const html = render(Survey2);
    expect(html).toContain("필수");
    expect(html).toContain("학과·학년을(를) 입력해야");
    expect(html).toMatch(/<button class="btn-next" disabled="">다음<\/button>/);
  });

  it("starts every condition unanswered and blocks 시작하기", () => {
    const html = render(Survey3);
    expect(html).toContain("필수");
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain("답하지 않은 조건이 5개");
    expect(html).toMatch(/<button class="btn-next" disabled="">시작하기<\/button>/);
  });
});
