import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NcsLevel, NCS_LEVELS } from "./NcsLevel";

describe("NCS level meaning", () => {
  it("explains all eight task and responsibility levels and marks the actual source level", () => {
    const html = renderToStaticMarkup(createElement(NcsLevel, { level: 4 }));
    expect(NCS_LEVELS.map(item => item.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(html).toContain("NCS 4수준");
    expect(html).toContain('aria-current="true"><strong>4수준</strong>');
    expect(html).toContain("단순하고 반복적인 과업");
    expect(html).toContain("조직 전반의 권한과 책임");
    expect(html).toContain("나의 숙련도 점수가 아니에요");
    expect(html).toContain("동등 학력, 응시 자격이나 채용 요건을 보장하지 않아요");
    expect(html).toContain("https://www.ncs.go.kr/mobile/rm01/TH10200103.do");
  });
  it("does not invent meaning for an invalid or missing level", () => {
    const html = renderToStaticMarkup(createElement(NcsLevel, { level: 99 }));
    expect(html).toContain("NCS 수준 안내");
    expect(html).not.toContain("NCS 99수준");
    expect(html).not.toContain('aria-current="true"');
  });
});
