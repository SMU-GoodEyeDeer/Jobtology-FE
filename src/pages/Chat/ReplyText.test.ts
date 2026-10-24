// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReplyText } from "./ReplyText";

function render(text: string) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(createElement(ReplyText, { text }));
  return host;
}

describe("assistant Markdown", () => {
  it("renders structured replies with headings, lists, emphasis, code and GFM tables", () => {
    const host = render("## 다음 단계\n\n**프로젝트**에 *직접* 적용해요.\n\n- [x] API 구현\n- [ ] 테스트\n\n```python\nprint('hello')\n```\n\n| 역량 | 근거 |\n| --- | --- |\n| SQL | 프로젝트 |\n\n[공식 문서](https://example.com/docs)");
    expect(host.querySelector("h2")?.textContent).toBe("다음 단계");
    expect(host.querySelector("strong")?.textContent).toBe("프로젝트");
    expect(host.querySelector("em")?.textContent).toBe("직접");
    expect(host.querySelectorAll("li")).toHaveLength(2);
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    expect(host.querySelector("pre code")?.textContent).toBe("print('hello')\n");
    expect(host.querySelector("table td")?.textContent).toBe("SQL");
    expect(host.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("blocks raw HTML, unsafe links and automatic remote image requests", () => {
    const host = render('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[위험](javascript:alert%281%29)\n\n![추적 이미지](https://example.com/tracker.png)');
    expect(host.querySelector("script, img, iframe")).toBeNull();
    expect(host.querySelector("a")).toBeNull();
    expect(host.textContent).toContain("위험");
    expect(host.textContent).toContain("[추적 이미지]");
  });

  it.each(["**unclosed text", "**", "```python\nprint('partial')"])("keeps unfinished streaming Markdown readable: %s", text => {
    const host = render(text);
    expect(host.textContent?.trim()).toBe(text.startsWith("```") ? "print('partial')" : text);
  });
});
