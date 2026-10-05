import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SurveyCapabilities } from "./SurveyCapabilities";
import { SurveyProvider } from "../../context/SurveyContext";
import { isPartialRoute } from "../Roadmap/usePartialRoute";

function renderStep() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(SurveyProvider, null, createElement(SurveyCapabilities)))
  );
}

describe("SurveyCapabilities checklist step", () => {
  it("is step 2 of 4 and starts by loading the checklist", () => {
    const html = renderStep();
    expect(html).toContain("STEP 2 / 4");
    expect(html).toContain("항목을 불러오는 중");
  });

  it("always offers a skip and labels answers as self-reported", () => {
    const html = renderStep();
    expect(html).toContain("건너뛸게요");
    expect(html).toContain("본인 응답으로 저장");
  });

  it("keeps 다음 disabled until the checklist is loaded", () => {
    expect(renderStep()).toMatch(/<button class="btn-next" disabled="">다음<\/button>/);
  });
});

describe("partial route detection", () => {
  it("flags only PARTIAL proposals", () => {
    expect(isPartialRoute("PARTIAL")).toBe(true);
    expect(isPartialRoute("RISKY")).toBe(false);
    expect(isPartialRoute(null)).toBe(false);
  });
});
