import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReplyText } from "./ReplyText";

describe("ReplyText", () => {
  it.each(["**unclosed text", "**"])("preserves an unmatched bold marker: %s", text => {
    const html = renderToStaticMarkup(createElement(ReplyText, { text }));
    expect(html).toBe(`<span>${text}</span>`);
  });

  it("only bolds captured pairs when an unmatched prefix follows one", () => {
    const html = renderToStaticMarkup(createElement(ReplyText, { text: "**bold****unclosed" }));
    expect(html).toBe("<span></span><strong>bold</strong><span>**unclosed</span>");
  });

  it("preserves unmatched text during animated rendering", () => {
    const text = "**unclosed text";
    const html = renderToStaticMarkup(createElement(ReplyText, { text, animate: true }));
    expect(html).not.toContain("<strong");
    expect(html).toContain(">**unclosed </span>");
    expect(html).toContain(">text</span>");
  });
});
